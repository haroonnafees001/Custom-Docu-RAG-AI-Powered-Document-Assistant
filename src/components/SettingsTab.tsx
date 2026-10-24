/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  RotateCcw,
  Check,
  Search,
  Zap,
  Bookmark,
  ShieldCheck,
} from 'lucide-react';
import { SystemSettings, DocumentChunk } from '../types/rag.ts';
import { DEFAULT_SYSTEM_SETTINGS } from '../data/starter-document.ts';
import { queryVectorIndex, getQueryEmbedding, ScoredChunk } from '../utils/vector-store.ts';

interface SettingsTabProps {
  settings: SystemSettings;
  onSaveSettings: (newSettings: SystemSettings) => void;
  chunks: DocumentChunk[];
}

const PERSONA_PRESETS = [
  {
    name: 'Technical Architecture Expert',
    description: 'Strict technical accuracy with detailed structural citations.',
    prompt: `You are the DocuRAG Senior Technical Intelligence Assistant. Your role is to answer user queries with absolute fidelity to the uploaded document context.
Rules:
1. Ground every claim strictly in the provided document excerpts.
2. Formulate answers clearly with paragraphs, bullet points, or bold headers.
3. Explicitly cite the document and page using tags like [Source: DocName, p. X].
4. If an answer cannot be deduced from the provided excerpts, state clearly: "Based on the indexed documents, this information is not available."`,
    temperature: 0.2,
    topK: 4,
  },
  {
    name: 'Concise Executive Advisor',
    description: 'High-level executive takeaways and decision summaries.',
    prompt: `You are an Executive Intelligence Advisor. Synthesize the provided document excerpts into high-impact, actionable business summaries.
Rules:
1. Deliver crisp, bulleted insights without technical fluff.
2. Every key finding must cite the source document and page number.
3. Highlight risks, operational numbers, and deadlines.
4. If the data is absent from the excerpts, state so immediately.`,
    temperature: 0.1,
    topK: 3,
  },
  {
    name: 'Strict Compliance & Legal Auditor',
    description: 'Extreme adherence to source text with verbatim quotations where applicable.',
    prompt: `You are a Strict Legal & Compliance Auditor. Your task is to provide audit-grade answers based solely on the provided document excerpts.
Rules:
1. Never extrapolate, extrapolate, or assume facts not explicitly stated in the context.
2. Provide exact quotations when referring to policies or clauses, followed by citation [DocName, p. X].
3. If there is ambiguity or missing information in the documents, declare an audit gap.`,
    temperature: 0.05,
    topK: 5,
  },
  {
    name: 'Friendly Customer Support Specialist',
    description: 'Approachable, warm explanations with easy-to-follow steps.',
    prompt: `You are a helpful, courteous Customer Support Specialist. Guide the user through solutions clearly and politely based on the documentation.
Rules:
1. Maintain a warm, encouraging tone while keeping answers factual.
2. Break complex instructions into numbered steps.
3. Mention the relevant guide page so users can read more.`,
    temperature: 0.4,
    topK: 4,
  },
];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onSaveSettings,
  chunks,
}) => {
  const [formState, setFormState] = useState<SystemSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);

  // Test sandbox state
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<ScoredChunk[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const handleApplyPreset = (preset: (typeof PERSONA_PRESETS)[0]) => {
    setFormState((prev) => ({
      ...prev,
      systemPrompt: preset.prompt,
      temperature: preset.temperature,
      topKRetrieval: preset.topK,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formState);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    setFormState(DEFAULT_SYSTEM_SETTINGS);
    onSaveSettings(DEFAULT_SYSTEM_SETTINGS);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleRunRetrievalTest = async () => {
    if (!testQuery.trim() || isTesting) return;
    setIsTesting(true);
    setTestError(null);
    setTestResults([]);

    try {
      const embedding = await getQueryEmbedding(testQuery.trim());
      const results = queryVectorIndex(
        embedding,
        chunks,
        formState.topKRetrieval,
        formState.minSimilarityThreshold
      );
      setTestResults(results);
    } catch (err: any) {
      setTestError(err.message || 'Retrieval test failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            System Persona & RAG Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Customize the system instruction prompt, retrieval top-k parameters, cosine similarity thresholds, and test retrieval in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{isSaved ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Form Settings (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Persona Presets */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Persona Presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PERSONA_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-3 text-left bg-white border border-slate-200 hover:border-blue-400 rounded-lg transition-colors shadow-2xs group"
                >
                  <span className="font-semibold text-xs text-slate-900 group-hover:text-blue-700 block">
                    {preset.name}
                  </span>
                  <span className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Active System Persona Instruction
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Dictates the tone, grounding boundaries, and citation formatting enforced across all responses.
            </p>
            <textarea
              rows={7}
              value={formState.systemPrompt}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, systemPrompt: e.target.value }))
              }
              className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Sliders Grid */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Retrieval & Model Parameters
            </h3>

            {/* Top-K Retrieval */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Top-K Retrieval Candidates</span>
                <span className="font-mono text-blue-600 font-semibold tabular-nums">
                  {formState.topKRetrieval} chunks
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={formState.topKRetrieval}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    topKRetrieval: parseInt(e.target.value, 10),
                  }))
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Maximum number of semantically closest chunks passed to Gemini.
              </span>
            </div>

            {/* Minimum Similarity Threshold */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Minimum Cosine Similarity</span>
                <span className="font-mono text-blue-600 font-semibold tabular-nums">
                  {Math.round(formState.minSimilarityThreshold * 100)}% (
                  {formState.minSimilarityThreshold.toFixed(2)})
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={formState.minSimilarityThreshold}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    minSimilarityThreshold: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Chunks scoring below this threshold are omitted to reduce noise.
              </span>
            </div>

            {/* Model Temperature */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Model Temperature</span>
                <span className="font-mono text-blue-600 font-semibold tabular-nums">
                  {formState.temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={formState.temperature}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    temperature: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Lower values (0.0 - 0.3) provide strict, deterministic factual responses.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Retrieval Sandbox & Architecture Info */}
        <div className="space-y-6">
          {/* Model Specification Card */}
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 text-xs border border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-200">
                Engine Specifications
              </span>
            </div>
            <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">LLM:</span> Gemma 4 (gemma-4-26b-a4b-it)
              </div>
              <div>
                <span className="text-slate-500">Embeddings:</span> gemini-embedding-001 (Stable GA)
              </div>
              <div>
                <span className="text-slate-500">Distance:</span> Cosine (L2 Normalized)
              </div>
              <div>
                <span className="text-slate-500">Total Indexed:</span>{' '}
                <span className="text-blue-400 tabular-nums">
                  {chunks.length} chunks
                </span>
              </div>
            </div>
          </div>

          {/* Live Retrieval Tester */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Real-Time Retrieval Sandbox</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Test semantic matching live against your active vector store before querying the chatbot.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunRetrievalTest()}
                placeholder="Type a test phrase (e.g. overlap)..."
                className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleRunRetrievalTest}
                disabled={!testQuery.trim() || isTesting}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {isTesting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>{isTesting ? 'Computing...' : 'Test Similarity Match'}</span>
              </button>
            </div>

            {testError && (
              <div className="text-[11px] text-rose-600 p-2 bg-rose-50 rounded-md">
                {testError}
              </div>
            )}

            {testResults.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-600 block">
                  Matched Top Candidates ({testResults.length}):
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {testResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-slate-600 truncate max-w-[150px]">
                          p. {result.pageNumber} · #{result.chunkIndex}
                        </span>
                        <span className="font-semibold text-blue-700 tabular-nums">
                          {Math.round(result.score * 100)}% match
                        </span>
                      </div>
                      <p className="text-slate-700 line-clamp-3 leading-relaxed">
                        {result.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
