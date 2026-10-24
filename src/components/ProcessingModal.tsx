import React from 'react';
import { RefreshCw, Layers, ShieldCheck, Sparkles, FileText } from 'lucide-react';

interface ProcessingModalProps {
  isOpen: boolean;
  step: string;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, step }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
        {/* Animated Header */}
        <div className="bg-blue-600 p-6 flex flex-col items-center text-white">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping scale-150 opacity-0 group-hover:opacity-100" />
            <div className="relative z-10 w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-center">
            AI Ingestion Pipeline
          </h2>
          <p className="text-blue-100 text-[11px] font-medium uppercase tracking-widest mt-1">
            Processing Knowledge Base
          </p>
        </div>

        {/* Status Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Current Pipeline Stage
                </span>
                <p className="text-sm font-semibold text-slate-800 leading-tight">
                  {step || 'Initializing engine...'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="bg-blue-600 h-full w-full animate-[loading_2s_ease-in-out_infinite]" 
                  style={{
                    backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                    backgroundSize: '1rem 1rem'
                  }} 
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-slate-400">
                <span>PARSING</span>
                <span>CHUNKING</span>
                <span>EMBEDDING</span>
                <span>INDEXING</span>
              </div>
            </div>
          </div>

          {/* Value Props / Context */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Gemma 4 Logic</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>3,072 Dims</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 text-center leading-relaxed">
            Please keep this tab open. We're creating high-dimensional vector representations for sub-millisecond retrieval.
          </p>
        </div>
      </div>
    </div>
  );
};
