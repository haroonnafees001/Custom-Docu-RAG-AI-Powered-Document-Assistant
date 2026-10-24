/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Check, Copy, Bookmark } from 'lucide-react';
import { CitationItem } from '../types/rag.ts';

interface CitationModalProps {
  citation: CitationItem | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ citation, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!citation) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(citation.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const percentage = Math.round(citation.score * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                Source Context Inspector
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Verified Grounding Excerpt
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
            aria-label="Close inspection drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Source Document</span>
              <span className="font-semibold text-slate-800 break-words line-clamp-2">
                {citation.documentName}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Exact Location</span>
              <span className="font-mono font-medium text-slate-800 tabular-nums">
                Page {citation.pageNumber} · Chunk #{citation.chunkIndex}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Similarity Score</span>
              <span className="font-mono font-semibold text-blue-700 tabular-nums">
                {percentage}% ({citation.score.toFixed(4)})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Internal Chunk ID</span>
              <span className="font-mono text-slate-600 truncate block">
                {citation.chunkId}
              </span>
            </div>
          </div>

          {/* Excerpt Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Grounding Excerpt
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-4 bg-slate-900 text-slate-100 rounded-lg text-sm leading-relaxed font-sans border border-slate-800 selection:bg-blue-500 selection:text-white whitespace-pre-wrap">
              {citation.snippet}
            </div>
          </div>

          {/* Verification Explanation */}
          <div className="text-xs text-slate-500 space-y-2 border-t border-slate-100 pt-4">
            <p>
              <strong className="text-slate-700">RAG Verification Note:</strong> This exact passage was retrieved from the active vector index based on cosine distance to the user prompt and provided to Gemini 3.8 Flash to synthesize the answer.
            </p>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
