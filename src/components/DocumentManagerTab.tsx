/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Sparkles,
  Layers,
} from 'lucide-react';
import { DocumentRecord, DocumentChunk } from '../types/rag.ts';

interface DocumentManagerTabProps {
  documents: DocumentRecord[];
  chunks: DocumentChunk[];
  onUploadPdf: (file: File) => Promise<void>;
  onDeleteDocument: (documentId: string) => void;
  onReindexDocument: (documentId: string) => Promise<void>;
  onInspectDocument: (documentId: string) => void;
  onLoadStarterDocument: () => void;
  isProcessing: boolean;
  processingStep: string;
}

export const DocumentManagerTab: React.FC<DocumentManagerTabProps> = ({
  documents,
  chunks,
  onUploadPdf,
  onDeleteDocument,
  onReindexDocument,
  onInspectDocument,
  onLoadStarterDocument,
  isProcessing,
  processingStep,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        await onUploadPdf(file);
      } else {
        alert('Please upload a valid PDF document (.pdf)');
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await onUploadPdf(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Page Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Document Management & Real-Time Indexing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Upload PDFs to automatically extract text, generate overlapping semantic chunks, compute Gemini embeddings, and index into the vector space.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onLoadStarterDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Load Sample PDF</span>
          </button>
        </div>
      </div>

      {/* Upload Dropzone / Processing Panel */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 shadow-sm ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
            : isProcessing
            ? 'border-blue-200 bg-slate-50/50 cursor-wait'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/30 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="max-w-md mx-auto space-y-6 py-4 animate-in fade-in duration-500">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-40" />
              <div className="relative z-10 w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
                <RefreshCw className="w-10 h-10 animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                AI Knowledge Pipeline Active
              </h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                We're turning your document into searchable semantic intelligence.
              </p>
            </div>

            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                </div>
                <span className="text-xs font-bold text-blue-700 font-mono uppercase tracking-wider">
                  Current Status
                </span>
              </div>
              <div className="text-sm font-medium text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                {processingStep || 'Initializing engine...'}
              </div>
              
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-2/3 animate-[loading_2s_ease-in-out_infinite]" style={{
                  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                  backgroundSize: '1rem 1rem'
                }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform duration-300">
              <FileUp className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-base font-bold text-slate-900 block">
                Upload knowledge source
              </span>
              <p className="text-sm text-slate-500 px-4">
                Drag your PDF here or <span className="text-blue-600 underline font-medium">browse files</span>
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Up to 25MB
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                OCR Enabled
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Semantic Chunking
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Document Inventory Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Indexed Documents
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              ({documents.length} files · {chunks.length} total vector chunks)
            </span>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800">
              No documents indexed yet
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload any PDF document above, or click "Load Sample PDF" to start testing RAG retrieval immediately.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Document Name</th>
                    <th className="py-3 px-4">Pages</th>
                    <th className="py-3 px-4">Chunks</th>
                    <th className="py-3 px-4">File Size</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Uploaded</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => {
                    const docChunks = chunks.filter((c) => c.documentId === doc.id);
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block truncate max-w-xs sm:max-w-sm">
                                {doc.name}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {doc.id}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                          {doc.pageCount} page{doc.pageCount !== 1 ? 's' : ''}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                          {docChunks.length || doc.chunkCount} chunks
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                          {formatBytes(doc.sizeBytes)}
                        </td>
                        <td className="py-3 px-4">
                          {doc.status === 'ready' && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Indexed</span>
                            </span>
                          )}
                          {doc.status === 'indexing' && (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Vectorizing</span>
                            </span>
                          )}
                          {doc.status === 'error' && (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Failed</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(doc.uploadedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onInspectDocument(doc.id)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Inspect vector chunks"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onReindexDocument(doc.id)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                              title="Re-index document"
                              disabled={isProcessing}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteDocument(doc.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Delete document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
