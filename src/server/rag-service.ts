/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

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
 * Generate embedding for a single text string
 */
export async function generateSingleEmbedding(text: string): Promise<number[]> {
  try {
    const cleanText = text.trim();
    if (!cleanText) return [];

    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: cleanText,
    });

    const values =
      (response as any).embedding?.values ||
      (response as any).embeddings?.[0]?.values ||
      (Array.isArray((response as any).embeddings) ? (response as any).embeddings[0] : null) ||
      (response as any).values;

    if (Array.isArray(values) && values.length > 0) {
      return normalizeVector(values);
    }

    throw new Error('No embedding values returned in response');
  } catch (error: any) {
    console.error('Error generating embedding with gemini-embedding-001:', error);
    // Fallback: try gemini-embedding-2 if needed
    try {
      const fbResponse = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: text.trim(),
      });
      const fbValues =
        (fbResponse as any).embedding?.values ||
        (fbResponse as any).embeddings?.[0]?.values ||
        (Array.isArray((fbResponse as any).embeddings) ? (fbResponse as any).embeddings[0] : null);
      if (Array.isArray(fbValues)) {
        return normalizeVector(fbValues);
      }
    } catch (fallbackError) {
      console.error('Fallback embedding also failed:', fallbackError);
    }
    throw error;
  }
}

/**
 * Batch embedding generator for multiple text chunks
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  // Process in small batches of 5 to prevent timeouts or rate limits
  const BATCH_SIZE = 5;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice = texts.slice(i, i + BATCH_SIZE);
    const promises = slice.map((t) => generateSingleEmbedding(t));
    const batchEmbeddings = await Promise.all(promises);
    results.push(...batchEmbeddings);
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
 * Synthesizes grounded answer using gemini-3.8-flash with citation tags
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
2. Whenever you mention information from a source, cite it directly in the text with a citation badge like \`[Source 1: DocName, p. X]\`.
3. Provide a direct, well-structured, easy-to-read response with clear paragraphs, bullet points, or bold headers where helpful.
4. If the provided context does not have sufficient information, explain what is missing politely.`;

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
    console.warn('Gemma 4 primary call error, attempting fallback:', err);
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
