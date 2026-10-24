/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentChunk } from '../types/rag.ts';
import { ExtractedPage } from './pdf-parser.ts';

export interface SemanticChunkOptions {
  maxSemanticSize?: number; // Maximum target characters for a cohesive semantic block (default 650)
  minSemanticSize?: number; // Minimum characters to avoid tiny fragmented snippets (default 100)
}

/**
 * Splits extracted document pages into coherent Semantic Chunks.
 * Instead of mechanical sliding windows with arbitrary character overlaps,
 * this groups text by semantic units: complete paragraphs, section headings,
 * structured lists, and cohesive sentence groups.
 */
export function chunkDocumentPages(
  documentId: string,
  documentName: string,
  pages: ExtractedPage[],
  options: SemanticChunkOptions = {}
): DocumentChunk[] {
  const maxSemanticSize = options.maxSemanticSize || 650;
  const minSemanticSize = options.minSemanticSize || 100;

  const chunks: DocumentChunk[] = [];
  let globalChunkIndex = 1;

  for (const page of pages) {
    const rawText = page.text.trim();
    if (!rawText) continue;

    // 1. Break page into natural structural/semantic blocks:
    // Split by double newlines, heading patterns, or bullet/numbered lists
    const rawBlocks = rawText
      .split(/\n\s*\n|(?=(?:^|\n)(?:[A-Z0-9][a-zA-Z0-9\s]{2,40}:|Chapter\s+\d+|Section\s+\d+|[0-9]+\.\s+[A-Z]))/)
      .map((b) => b.trim())
      .filter(Boolean);

    // 2. Process each semantic block
    for (const block of rawBlocks) {
      if (block.length <= maxSemanticSize) {
        // If the block is within semantic target size, keep it as an integral unit
        if (block.length >= minSemanticSize || rawBlocks.length === 1) {
          chunks.push({
            id: `${documentId}-p${page.pageNumber}-c${globalChunkIndex}`,
            documentId,
            documentName,
            pageNumber: page.pageNumber,
            chunkIndex: globalChunkIndex++,
            content: block,
          });
        } else {
          // If block is very short (e.g. a lone heading), merge with next or keep if standalone
          const previousChunk = chunks[chunks.length - 1];
          if (
            previousChunk &&
            previousChunk.pageNumber === page.pageNumber &&
            previousChunk.content.length + block.length < maxSemanticSize
          ) {
            previousChunk.content += '\n\n' + block;
          } else {
            chunks.push({
              id: `${documentId}-p${page.pageNumber}-c${globalChunkIndex}`,
              documentId,
              documentName,
              pageNumber: page.pageNumber,
              chunkIndex: globalChunkIndex++,
              content: block,
            });
          }
        }
      } else {
        // 3. For large paragraphs/sections, perform Semantic Sentence Clustering:
        // Split strictly along full sentence boundaries (never cut words or clauses)
        const sentences = block
          .split(/(?<=[.?!])\s+(?=[A-Z0-9"'\(\[])/)
          .map((s) => s.trim())
          .filter(Boolean);

        let currentCluster = '';

        for (const sentence of sentences) {
          // If adding this sentence exceeds maximum size and we already have substantive text,
          // finish current semantic chunk and start the next complete thought unit
          if (
            currentCluster.length > 0 &&
            currentCluster.length + sentence.length > maxSemanticSize
          ) {
            chunks.push({
              id: `${documentId}-p${page.pageNumber}-c${globalChunkIndex}`,
              documentId,
              documentName,
              pageNumber: page.pageNumber,
              chunkIndex: globalChunkIndex++,
              content: currentCluster.trim(),
            });
            currentCluster = sentence;
          } else {
            currentCluster = currentCluster
              ? `${currentCluster} ${sentence}`
              : sentence;
          }
        }

        // Push trailing cluster if non-empty
        if (currentCluster.trim().length > 0) {
          chunks.push({
            id: `${documentId}-p${page.pageNumber}-c${globalChunkIndex}`,
            documentId,
            documentName,
            pageNumber: page.pageNumber,
            chunkIndex: globalChunkIndex++,
            content: currentCluster.trim(),
          });
        }
      }
    }
  }

  return chunks;
}
