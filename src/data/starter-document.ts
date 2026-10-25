/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentChunk, DocumentRecord, SystemSettings } from '../types/rag.ts';

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  systemPrompt: `You are the DocuRAG Senior Technical Intelligence Assistant. Your role is to answer user queries with absolute fidelity to the uploaded document context.
Rules:
1. Ground every claim strictly in the provided document excerpts.
2. Formulate answers clearly with paragraphs, bullet points, or bold headers.
3. Explicitly cite the document and page using tags like [Source: DocName, p. X].
4. If an answer cannot be deduced from the provided excerpts, state clearly: "Based on the indexed documents, this information is not available."`,
  temperature: 0.25,
  topKRetrieval: 4,
  minSimilarityThreshold: 0.35,
  chunkSize: 650,
  chunkOverlap: 0,
};

export const STARTER_DOCUMENT_RECORD: DocumentRecord = {
  id: 'doc-starter-rag-manual',
  name: 'DocuRAG System Architecture & Ingestion Manual.pdf',
  sizeBytes: 142800,
  pageCount: 4,
  uploadedAt: new Date().toISOString(),
  status: 'ready',
  chunkCount: 6,
  systemPrompt: `You are the Lead Systems Architect specializing in the DocuRAG System Architecture & Ingestion Manual.
Your goal is to answer inquiries with authoritative precision based strictly on this document.
Rules:
1. Ground all answers exclusively in the excerpts from "DocuRAG System Architecture & Ingestion Manual.pdf".
2. Explain dual-stage ingestion, normalized L2 Gemini embeddings, and semantic chunking with high technical clarity.
3. Structure answers using bold technical terms, clean bullet points, or tables.
4. Always cite using [Source: DocuRAG System Architecture & Ingestion Manual.pdf, p. X].
5. If a topic is not in the manual, state clearly that it is not covered.`,
};

export const STARTER_DOCUMENT_CHUNKS: DocumentChunk[] = [
  {
    id: 'doc-starter-p1-c1',
    documentId: 'doc-starter-rag-manual',
    documentName: 'DocuRAG System Architecture & Ingestion Manual.pdf',
    pageNumber: 1,
    chunkIndex: 1,
    content:
      'Chapter 1: Real-Time Vector Indexing Architecture. DocuRAG employs a streaming dual-stage ingestion pipeline. When a PDF file is submitted via the admin dashboard, the document is decomposed into structured text streams page-by-page. Each page is sanitized to remove artifact noise while preserving layout boundaries. The text is subsequently segmented into semantic chunk windows designed to maintain paragraph integrity and grammatical completeness.',
  },
  {
    id: 'doc-starter-p1-c2',
    documentId: 'doc-starter-rag-manual',
    documentName: 'DocuRAG System Architecture & Ingestion Manual.pdf',
    pageNumber: 1,
    chunkIndex: 2,
    content:
      'Section 1.2: Embedding Generation via Gemini. High-dimensional vector representations are synthesized using Google Gemini embedding models (gemini-embedding-2-preview). Vectors are mathematically normalized onto a unit hypersphere (L2 norm: ||v|| = 1.0). Normalization optimizes vector distance computations, reducing cosine similarity calculations to high-speed algebraic dot products without sacrificing positional nuance or semantic depth.',
  },
  {
    id: 'doc-starter-p2-c3',
    documentId: 'doc-starter-rag-manual',
    documentName: 'DocuRAG System Architecture & Ingestion Manual.pdf',
    pageNumber: 2,
    chunkIndex: 3,
    content:
      'Chapter 2: Semantic Chunking Mechanics. Rather than arbitrary mechanical sliding windows with repetitive character overlap, DocuRAG employs purely semantic chunking. The text is partitioned along natural thematic boundaries: complete paragraphs, section headers, and cohesive sentence propositions. Sentences discussing a unified concept are preserved in a single contextual block, preventing chopped clauses and maintaining complete proposition fidelity for the embedding model.',
  },
  {
    id: 'doc-starter-p2-c4',
    documentId: 'doc-starter-rag-manual',
    documentName: 'DocuRAG System Architecture & Ingestion Manual.pdf',
    pageNumber: 2,
    chunkIndex: 4,
    content:
      'Section 2.3: Retrieval Top-K and Thresholding. When a user submits an inquiry, the query is vectorized and compared against all indexed document chunks. Chunks exceeding the minimum similarity threshold (default: 0.35) are ranked by cosine similarity score. The top-K candidates (typically 3 to 5) are passed to the Gemini 3.8 Flash generation model as strict grounding context.',
  },
  {
    id: 'doc-starter-p3-c5',
    documentId: 'doc-starter-rag-manual',
    documentName: 'DocuRAG System Architecture & Ingestion Manual.pdf',
    pageNumber: 3,
    chunkIndex: 5,
    content:
      'Chapter 3: Interactive Citation Auditing & Source Attribution. To guarantee zero hallucination and verify factual authenticity, every AI response attaches structured citation identifiers linked to source document name, page number, and chunk index. Clicking any citation pill opens the full context inspector, revealing the exact matched passage and vector similarity percentage.',
  },
  {
    id: 'doc-starter-p4-c6',
    documentId: 'doc-starter-rag-manual',
    documentName: 'DocuRAG System Architecture & Ingestion Manual.pdf',
    pageNumber: 4,
    chunkIndex: 6,
    content:
      'Chapter 4: Administrative Persona & System Configuration. System administrators can customize the AI persona via the Settings console. Personas include Technical Expert, Concise Executive Advisor, Compliance Auditor, and Support Specialist. Adjustable parameters include model temperature (0.0 for strict factual answers, up to 1.0 for creative prose) and retrieval sensitivity thresholds.',
  },
];
