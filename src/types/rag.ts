/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DocumentRecord {
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number;
  uploadedAt: string;
  status: 'parsing' | 'indexing' | 'ready' | 'error';
  errorMessage?: string;
  chunkCount: number;
  systemPrompt?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  embedding?: number[];
}

export interface SystemSettings {
  systemPrompt: string;
  temperature: number;
  topKRetrieval: number;
  minSimilarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
}

export interface CitationItem {
  chunkId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  snippet: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: CitationItem[];
  retrievalCount?: number;
  error?: string;
}
