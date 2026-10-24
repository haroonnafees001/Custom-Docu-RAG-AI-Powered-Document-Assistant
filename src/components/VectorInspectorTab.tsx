/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  Zap,
  Bookmark,
  Layers,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { DocumentChunk, CitationItem } from '../types/rag.ts';
import { calculateCosineSimilarity, getQueryEmbedding } from '../utils/vector-store.ts';

interface VectorInspectorTabProps {
  chunks: DocumentChunk[];
  onSelectChunk: (citation: CitationItem) => void;
  selectedDocumentFilter?: string | null;
  onClearFilter?: () => void;
}

export const VectorInspectorTab: React.FC<VectorInspectorTabProps> = ({
  chunks,
  onSelectChunk,
  selectedDocumentFilter,
  onClearFilter,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [similarityQuery, setSimilarityQuery] = useState('');
  const [similarityScores, setSimilarityScores] = useState<Record<string, number>>({});
  const [isComputingSimilarity, setIsComputingSimilarity] = useState(false);

  // Filter chunks based on text or selected document
  const filteredChunks = useMemo(() => {
    let result = chunks;

    if (selectedDocumentFilter) {
      result = result.filter((c) => c.documentId === selectedDocumentFilter);
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      result = result.filter(
        (c) =>
          c.content.toLowerCase().includes(q) ||
          c.documentName.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    // If similarity search was performed, sort by similarity score descending
    if (Object.keys(similarityScores).length > 0) {
      result = [...result].sort((a, b) => {
        const scoreA = similarityScores[a.id] || 0;
        const scoreB = similarityScores[b.id] || 0;
        return scoreB - scoreA;
      });
    }

    return result;
  }, [chunks, searchFilter, selectedDocumentFilter, similarityScores]);

  const handleComputeSimilarity = async () => {
    if (!similarityQuery.trim() || isComputingSimilarity) return;
    setIsComputingSimilarity(true);

    try {
      const queryVector = await getQueryEmbedding(similarityQuery.trim());
      const scores: Record<string, number> = {};

      for (const chunk of chunks) {
        if (chunk.embedding && chunk.embedding.length > 0) {
          scores[chunk.id] = calculateCosineSimilarity(queryVector, chunk.embedding);
        }
      }

      setSimilarityScores(scores);
    } catch (e) {
      console.error('Similarity search failed:', e);
      alert('Failed to compute similarity search: ' + (e as any).message);
    } finally {
      setIsComputingSimilarity(false);
    }
  };

  const handleResetScores = () => {
    setSimilarityQuery('');
    setSimilarityScores({});
  };

  const totalWords = useMemo(() => {
    return chunks.reduce((acc, c) => acc + c.content.split(/\s+/).length, 0);
  }, [chunks]);

  const avgChunkLength = useMemo(() => {
    if (chunks.length === 0) return 0;
    return Math.round(chunks.reduce((acc, c) => acc + c.content.length, 0) / chunks.length);
  }, [chunks]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title & Stats Ribbon */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Vector Index Inspector & Diagnostic Console
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Explore extracted semantic chunks, preview high-dimensional vector embeddings, and benchmark cosine similarity rankings live.
        </p>

        {/* High-density metric strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
            <span className="text-slate-500 text-[11px] block">Total Indexed Chunks</span>
            <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {chunks.length}
            </span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
            <span className="text-slate-500 text-[11px] block">Avg Chunk Window</span>
            <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {avgChunkLength} chars
            </span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
            <span className="text-slate-500 text-[11px] block">Total Word Corpus</span>
            <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              {totalWords.toLocaleString()}
            </span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
            <span className="text-slate-500 text-[11px] block">Vector Dimensions</span>
            <span className="text-lg font-bold font-mono text-blue-600 tabular-nums">
              3,072 / L2 Unit
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Real-Time Similarity Benchmark Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Keyword Filter */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter chunks by keyword or chunk ID..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Live Vector Similarity Tester */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Zap className="w-4 h-4 text-amber-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={similarityQuery}
              onChange={(e) => setSimilarityQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComputeSimilarity()}
              placeholder="Test semantic similarity (e.g. overlap rate)..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleComputeSimilarity}
            disabled={!similarityQuery.trim() || isComputingSimilarity}
            className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            {isComputingSimilarity ? 'Scoring...' : 'Rank Chunks'}
          </button>
          {Object.keys(similarityScores).length > 0 && (
            <button
              onClick={handleResetScores}
              className="px-2.5 py-2 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Clear similarity ranking"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Active Document Filter Badge */}
      {selectedDocumentFilter && (
        <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Filtering by document:{' '}
            <strong>
              {chunks.find((c) => c.documentId === selectedDocumentFilter)?.documentName ||
                selectedDocumentFilter}
            </strong>
          </span>
          {onClearFilter && (
            <button
              onClick={onClearFilter}
              className="ml-auto text-blue-700 hover:text-blue-900 font-semibold underline"
            >
              Show all documents
            </button>
          )}
        </div>
      )}

      {/* Chunks List */}
      <div className="space-y-3">
        {filteredChunks.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
            <Database className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800">
              No matching chunks found
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search filter or upload more documents to index.
            </p>
          </div>
        ) : (
          filteredChunks.map((chunk) => {
            const score = similarityScores[chunk.id];
            const hasScore = typeof score === 'number';

            return (
              <div
                key={chunk.id}
                className={`p-4 bg-white border rounded-xl shadow-2xs hover:border-slate-400 transition-all ${
                  hasScore && score > 0.4
                    ? 'border-blue-400 ring-1 ring-blue-100'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 mb-2 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 truncate max-w-xs">
                      {chunk.documentName}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      Page {chunk.pageNumber} · Chunk #{chunk.chunkIndex}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
                      {chunk.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasScore && (
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 tabular-nums">
                        {(score * 100).toFixed(1)}% match
                      </span>
                    )}
                    <button
                      onClick={() =>
                        onSelectChunk({
                          chunkId: chunk.id,
                          documentName: chunk.documentName,
                          pageNumber: chunk.pageNumber,
                          chunkIndex: chunk.chunkIndex,
                          snippet: chunk.content,
                          score: hasScore ? score : 0.85,
                        })
                      }
                      className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      Inspect Chunk
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
                  {chunk.content}
                </p>

                {/* Vector preview snippet */}
                {chunk.embedding && chunk.embedding.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="truncate max-w-sm">
                      Embedding: [{chunk.embedding.slice(0, 5).map((v) => v.toFixed(4)).join(', ')}, ...]
                    </span>
                    <span className="tabular-nums">
                      {chunk.embedding.length} dimensions
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
