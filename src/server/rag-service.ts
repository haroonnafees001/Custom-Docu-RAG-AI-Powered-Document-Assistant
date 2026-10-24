/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

const rawKey = process.env.GEMINI_API_KEY || '';

const ai = new GoogleGenAI({
  apiKey: rawKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Normalizes a vector to unit length (L2 norm) for fast dot product cosine similarity
 */
export function normalizeVector(vec: number[]): number[] {
  if (!vec || vec.length === 0) return [];
  let norm = 0;
  for (let i = 0; i < vec.length; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/**
 * Helper to pause execution
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Standardized retry logic for API calls (Exponential Backoff)
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = `${error?.message || ''} ${JSON.stringify(error || '')}`;
    const isRateLimit = errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED');
    if (retries > 0 && isRateLimit) {
      console.warn(`Rate limit hit, retrying in ${delay}ms... (${retries} attempts left)`);
      await sleep(delay + Math.random() * 800); // Add jitter
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Generate embedding for a single text string using @google/genai SDK
 */
export async function generateSingleEmbedding(text: string): Promise<number[]> {
  const cleanText = text.trim();
  if (!cleanText) return [];

  try {
    return await withRetry(async () => {
      const response = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: cleanText,
      });

      const values =
        (response as any).embeddings?.[0]?.values ||
        (response as any).embedding?.values ||
        (response as any).values;

      if (Array.isArray(values) && values.length > 0) {
        return normalizeVector(values);
      }
      throw new Error('No embedding values returned in response');
    });
  } catch (error: any) {
    console.error('Error generating embedding with gemini-embedding-001:', error);
    // Fallback: try gemini-embedding-2 if needed
    try {
      return await withRetry(async () => {
        const fbResponse = await ai.models.embedContent({
          model: 'gemini-embedding-2',
          contents: cleanText,
        });
        const fbValues =
          (fbResponse as any).embeddings?.[0]?.values ||
          (fbResponse as any).embedding?.values ||
          (fbResponse as any).values;
        if (Array.isArray(fbValues) && fbValues.length > 0) {
          return normalizeVector(fbValues);
        }
        throw new Error('Fallback failed');
      });
    } catch (fallbackError) {
      console.error('Fallback embedding also failed:', fallbackError);
    }
    throw error;
  }
}

/**
 * Optimized batch embedding generator using native batch API
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  const BATCH_SIZE = 3; // Process in very small chunks to stay strictly within 30k TPM Free Tier limit

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE).map((t) => t.trim() || ' ');

    try {
      const batchEmbeddings = await withRetry(async () => {
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: slice,
        });

        const embeddingsList = (response as any).embeddings || [];
        return embeddingsList.map((e: any) => normalizeVector(e.values || e));
      });

      results.push(...batchEmbeddings);

      if (i + BATCH_SIZE < texts.length) {
        await sleep(2500); // Significant pause between small batches to avoid token limit exhaustion
      }
    } catch (err) {
      console.error(`Batch processing failed at index ${i}, falling back to sequential calls:`, err);
      for (const text of slice) {
        results.push(await generateSingleEmbedding(text));
        await sleep(500); // Extra safety for sequential calls
      }
    }
  }

  return results;
}

export interface GroundedChunk {
  id: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface GenerateRagAnswerParams {
  query: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  systemInstruction?: string;
  contextChunks: GroundedChunk[];
  temperature?: number;
}

/**
 * Synthesizes grounded answer using gemma-4-26b-a4b-it (with gemini-2.5-flash fallback) with citation tags
 */
export async function generateRagAnswer(params: GenerateRagAnswerParams): Promise<{
  answer: string;
  citedChunks: GroundedChunk[];
}> {
  const { query, history = [], systemInstruction, contextChunks, temperature = 0.3 } = params;

  // Build context block
  let contextBlock = '';
  if (contextChunks && contextChunks.length > 0) {
    contextBlock = contextChunks
      .map((chunk, idx) => {
        return `[Source ${idx + 1}: "${chunk.documentName}", Page ${chunk.pageNumber}, Chunk #${chunk.chunkIndex}]
${chunk.content}`;
      })
      .join('\n\n---\n\n');
  } else {
    contextBlock = 'No document context found for this query.';
  }

  const baseInstruction =
    systemInstruction ||
    'You are an authoritative, accurate, and concise AI knowledge assistant. You answer user questions strictly based on the provided document excerpts. When stating facts, explicitly reference the relevant source using format `[Source N: DocName, p. PageNumber]`. If the excerpts do not contain the answer, state honestly that the information is not present in the indexed documents rather than speculating.';

  const prompt = `DOCUMENT CONTEXT:
${contextBlock}

USER QUESTION:
${query}

Instructions:
1. Answer the question using ONLY the facts present in the DOCUMENT CONTEXT above.
2. **Readability is Priority**: Write like a professional human consultant, not a robot. Avoid repeating the same sentence structure or source name constantly.
3. **Smart Citations**: Do NOT put a citation after every single sentence. 
   - If a whole paragraph or list section comes from Source 1, just put \`[Source 1: DocName, p. X]\` once at the end of that paragraph or section.
   - Use citations only where necessary to prove a claim, keeping the text clean.
4. **Professional Formatting**:
   - Use **Bold** for emphasis on key results or names.
   - Use clean **Bullet Points** for lists.
   - Use **Tables** for structured data (like contact info or dates).
   - Use **Headers (###)** to organize different sections of your answer.
5. If the provided context does not have sufficient information, state clearly that it is not in the documents.`;

  const contentsPayload: any =
    history && history.length > 0
      ? [
          ...history.slice(-4).map((h) => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.text }],
          })),
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ]
      : prompt;

  let responseText = '';
  try {
    const response = await ai.models.generateContent({
      model: 'gemma-4-26b-a4b-it',
      contents: contentsPayload,
      config: {
        systemInstruction: baseInstruction,
        temperature: temperature,
        topP: 0.95,
      },
    });
    responseText = response.text || '';
  } catch (err: any) {
    console.warn('Gemma 4 primary call error, attempting fallback to gemini-2.5-flash:', err);
    try {
      const fbResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contentsPayload,
        config: {
          systemInstruction: baseInstruction,
          temperature: temperature,
        },
      });
      responseText = fbResponse.text || '';
    } catch (fallbackError) {
      console.error('Fallback generation also failed:', fallbackError);
    }
  }

  const answer = responseText || 'Unable to generate response from model.';

  return {
    answer,
    citedChunks: contextChunks,
  };
}

/**
 * Analyzes document sample and suggests an optimized System Prompt
 */
export async function suggestSystemInstruction(documentSample: string): Promise<string> {
  const prompt = `You are an AI System Architect. I will provide you with a sample text from a document knowledge base.
Your task is to analyze the nature of this content (is it a technical manual, a legal contract, a medical report, a company policy, etc.?) and write a highly optimized "System Instruction" (System Prompt) for a RAG chatbot.

DOCUMENT SAMPLE:
"""
${documentSample.slice(0, 4000)}
"""

Instructions for you:
1. Identify the core domain and target audience of the document.
2. Draft a "System Instruction" (approx 150-250 words) that tells the chatbot:
   - What its persona should be (e.g., "Senior Legal Auditor", "Friendly Technical Support").
   - How to handle citations (always [Source: Name, p. X]).
   - How to structure answers (e.g., tables for comparisons, bullets for steps).
   - What to do if information is missing (state clearly that it is not available).
3. The response should ONLY contain the suggested system prompt text, nothing else.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemma-4-26b-a4b-it',
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });
    return response.text || '';
  } catch (error) {
    console.warn('Error suggesting instructions with Gemma 4, attempting fallback to gemini-2.5-flash:', error);
    try {
      const fbResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });
      return fbResponse.text || '';
    } catch (fbErr) {
      console.error('Fallback suggest instructions also failed:', fbErr);
      return '';
    }
  }
}
