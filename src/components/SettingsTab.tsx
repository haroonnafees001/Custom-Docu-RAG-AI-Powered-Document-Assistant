import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  RotateCcw,
  Check,
  Search,
  Zap,
  ShieldCheck,
  Brain,
  Eye,
  Microscope,
  Info,
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
    name: 'Technical Expert',
    description: 'Detailed and accurate, perfect for engineering or technical docs.',
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
    name: 'Executive Summary',
    description: 'Crisp takeaways and decision-ready summaries for busy managers.',
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
    name: 'Strict Auditor',
    description: 'Uses exact quotes and never guesses. Best for legal or policy work.',
    prompt: `You are a Strict Legal & Compliance Auditor. Your task is to provide audit-grade answers based solely on the provided document excerpts.
Rules:
1. Never extrapolate, extrapolate, or assume facts not explicitly stated in the context.
2. Provide exact quotations when referring to policies or clauses, followed by citation [DocName, p. X].
3. If there is ambiguity or missing information in the documents, declare an audit gap.`,
    temperature: 0.05,
    topK: 5,
  },
  {
    name: 'Helpful Support',
    description: 'Friendly, step-by-step guidance that is easy to follow.',
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

  // Manual Instruction Generation state
  const [isGeneratingInstructions, setIsGeneratingInstructions] = useState(false);

  const handleGenerateAIInstructions = async () => {
    if (chunks.length === 0 || isGeneratingInstructions) return;
    setIsGeneratingInstructions(true);

    try {
      // Pick a diverse sample of content from the indexed chunks
      const sampleIndices = [0, Math.floor(chunks.length / 2), chunks.length - 1];
      const uniqueIndices = [...new Set(sampleIndices)];
      const sampleText = uniqueIndices
        .map(i => chunks[i]?.content)
        .filter(Boolean)
        .join('\n\n');

      const res = await fetch('/api/suggest-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentSample: sampleText })
      });

      if (res.ok) {
        const { suggestedPrompt } = await res.json();
        if (suggestedPrompt) {
          setFormState(prev => ({
            ...prev,
            systemPrompt: suggestedPrompt
          }));
        }
      } else {
        throw new Error('Server returned an error');
      }
    } catch (err) {
      console.error('Manual instruction generation failed:', err);
      alert('Could not generate instructions. Please try again.');
    } finally {
      setIsGeneratingInstructions(false);
    }
  };

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
      setTestError(err.message || 'Search test failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            AI Personality & Logic Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Choose how the AI should talk, how much it should "read" before answering, and how creative it should be.
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
        <div className="lg:col-span-2 space-y-8">
          {/* Persona Presets */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <h2 className="text-sm font-bold text-slate-800">Quick Personality Styles</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PERSONA_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-3 text-left bg-white border border-slate-200 hover:border-blue-400 rounded-xl transition-all shadow-sm hover:shadow-md group relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <span className="font-bold text-xs text-slate-900 group-hover:text-blue-700 block">
                      {preset.name}
                    </span>
                    <span className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {preset.description}
                    </span>
                  </div>
                  <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-10 transition-opacity">
                    <Zap className="w-8 h-8 text-blue-600" />
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* System Prompt */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-rose-500" />
                <h2 className="text-sm font-bold text-slate-800">Instructions for the AI</h2>
              </div>
              <button
                type="button"
                onClick={handleGenerateAIInstructions}
                disabled={chunks.length === 0 || isGeneratingInstructions}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {isGeneratingInstructions ? (
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isGeneratingInstructions ? 'Generating...' : 'Generate with AI'}</span>
              </button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-[11px] text-slate-600 mb-3 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                These instructions tell the AI how to behave. You can change them to make the AI more polite, formal, or brief.
              </p>
              <textarea
                rows={6}
                value={formState.systemPrompt}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, systemPrompt: e.target.value }))
                }
                className="w-full text-xs font-mono p-4 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 leading-relaxed shadow-inner"
                placeholder="Write how you want the AI to behave..."
              />
            </div>
          </section>

          {/* Sliders Grid */}
          <section className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center gap-2">
              <Microscope className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-800">Advanced Logic Control</h2>
            </div>

            {/* Top-K Retrieval */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Source Reading Depth</span>
                  <span className="text-[10px] text-slate-400">How many different parts of the document should the AI check?</span>
                </div>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-mono text-xs font-bold">
                  {formState.topKRetrieval} sources
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
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Minimum Similarity Threshold */}
            <div className="space-y-3 pt-2 border-t border-slate-50">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Strictness of Matches</span>
                  <span className="text-[10px] text-slate-400">How closely must the document match the question to be included?</span>
                </div>
                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md font-mono text-xs font-bold">
                  {Math.round(formState.minSimilarityThreshold * 100)}% Match
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
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Model Temperature */}
            <div className="space-y-3 pt-2 border-t border-slate-50">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-700 block">Creativity & Style</span>
                  <span className="text-[10px] text-slate-400">Low is factual/robotic, High is creative/conversational.</span>
                </div>
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md font-mono text-xs font-bold">
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
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </section>
        </div>

        {/* Right Column: Live Retrieval Sandbox & Architecture Info */}
        <div className="space-y-6">
          {/* Model Specification Card */}
          <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-4 shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-500/10 blur-3xl rounded-full" />
            <div className="flex items-center gap-2 relative z-10">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-sm tracking-tight">
                Engine Specifications
              </span>
            </div>
            <div className="space-y-2.5 text-slate-300 font-mono text-[11px] relative z-10">
              <div className="flex justify-between">
                <span className="text-slate-500">Main AI Model:</span> 
                <span className="text-white">Gemma 4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reading Engine:</span>
                <span className="text-white">Stable GA (001)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Knowledge Depth:</span>
                <span className="text-white">3,072 Dims</span>
              </div>
              <div className="pt-2 flex justify-between border-t border-slate-800">
                <span className="text-slate-500">Total Memories:</span>{' '}
                <span className="text-blue-400 font-bold tabular-nums">
                  {chunks.length} snippets
                </span>
              </div>
            </div>
          </div>

          {/* Live Retrieval Tester */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Eye className="w-4 h-4 text-amber-500" />
              <span>Search Simulation</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Test how well the AI "finds" information in your documents based on your current settings.
            </p>

            <div className="space-y-2.5">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunRetrievalTest()}
                placeholder="Type something to find..."
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleRunRetrievalTest}
                disabled={!testQuery.trim() || isTesting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-sm active:scale-95"
              >
                {isTesting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>{isTesting ? 'Searching...' : 'Run Test Search'}</span>
              </button>
            </div>

            {testError && (
              <div className="text-[11px] text-rose-600 p-3 bg-rose-50 rounded-xl border border-rose-100">
                {testError}
              </div>
            )}

            {testResults.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Top {testResults.length} Matches Found:
                </span>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                  {testResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1.5 hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-slate-500 font-bold">
                          Page {result.pageNumber}
                        </span>
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">
                          {Math.round(result.score * 100)}% Match
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

