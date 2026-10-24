/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentChunk } from '../types/rag.ts';

/**
 * Calculates dot product cosine similarity between two normalized vectors
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  // Handle float precision bounds
  return Math.max(0, Math.min(1, dotProduct));
}

export interface ScoredChunk extends DocumentChunk {
  score: number;
}

/**
 * Retrieves the most relevant chunks using vector similarity
 */
export function queryVectorIndex(
  queryEmbedding: number[],
  chunks: DocumentChunk[],
  topK = 4,
  minThreshold = 0.35,
  documentIdFilter?: string | null
): ScoredChunk[] {
  if (!queryEmbedding || queryEmbedding.length === 0 || chunks.length === 0) {
    return [];
  }

  // Apply document filter if provided
  const targetChunks = documentIdFilter 
    ? chunks.filter(c => c.documentId === documentIdFilter)
    : chunks;

  const scored: ScoredChunk[] = [];

  for (const chunk of targetChunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) continue;
    const score = calculateCosineSimilarity(queryEmbedding, chunk.embedding);
    if (score >= minThreshold) {
      scored.push({
        ...chunk,
        score,
      });
    }
  }

  // Sort descending by similarity score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Request embedding for a single query text from server
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
  const response = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: query }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Embedding request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.embedding || [];
}

/**
 * Request batch embeddings for document chunks from server
 */
export async function getBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch('/api/embed-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Batch embedding failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.embeddings || [];
}

/**
 * Request RAG answer generation from server
 */
export async function queryRagChatbot(payload: {
  query: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  systemInstruction?: string;
  contextChunks: ScoredChunk[];
  temperature?: number;
}): Promise<{ answer: string; citedChunks: any[] }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Chatbot query failed with status ${response.status}`);
  }

  return response.json();
}
