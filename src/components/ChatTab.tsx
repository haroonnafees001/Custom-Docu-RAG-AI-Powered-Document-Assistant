/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Trash2, Bookmark, AlertCircle, FileText, Bot, User } from 'lucide-react';
import { ChatMessage, CitationItem } from '../types/rag.ts';

interface ChatTabProps {
  messages: ChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  onClearChat: () => void;
  isLoading: boolean;
  onSelectCitation: (citation: CitationItem) => void;
  documentCount: number;
  chunkCount: number;
}

const SAMPLE_QUESTIONS = [
  'How does the dual-stage PDF ingestion pipeline work?',
  'What embedding model is used and how are vectors normalized?',
  'How does semantic chunking preserve thematic continuity?',
  'How do interactive citation pills verify facts against hallucinations?',
];

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  onSendMessage,
  onClearChat,
  isLoading,
  onSelectCitation,
  documentCount,
  chunkCount,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const query = inputText.trim();
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 sm:px-6 py-4">
      {/* Top status & toolbar */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">RAG Knowledge State:</span>
          <span>{documentCount} document{documentCount !== 1 ? 's' : ''}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{chunkCount} indexed vector chunks</span>
        </div>

        {messages.length > 0 && (
          <button
            onClick={onClearChat}
            className="flex items-center gap-1 text-slate-500 hover:text-rose-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear conversation</span>
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 shadow-xs">
              <Bot className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Conversational RAG Assistant
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Ask questions about your uploaded PDFs. The system retrieves the most relevant semantic passages in real-time, calculates cosine similarities, and grounds every answer with clickable citations.
            </p>

            <div className="w-full text-left">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2 text-center">
                Try asking about the indexed knowledge base
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SAMPLE_QUESTIONS.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage(question)}
                    className="p-3 text-left text-xs text-slate-700 bg-white hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 rounded-lg transition-colors shadow-2xs group flex items-start gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <span className="group-hover:text-blue-900">{question}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`flex gap-3 max-w-3xl ${
                  message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-white'
                  }`}
                >
                  {message.sender === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                {/* Message body */}
                <div
                  className={`rounded-xl p-4 text-sm ${
                    message.sender === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 shadow-2xs text-slate-800'
                  }`}
                >
                  {message.error ? (
                    <div className="flex items-center gap-2 text-rose-600 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{message.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-2 whitespace-pre-wrap leading-relaxed">
                      {message.text}
                    </div>
                  )}

                  {/* Grounded Citation Badges */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-500 block mr-1">
                        Sources:
                      </span>
                      {message.citations.map((citation, idx) => (
                        <button
                          key={idx}
                          onClick={() => onSelectCitation(citation)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 border border-slate-200 transition-colors cursor-pointer group"
                          title="Click to inspect source context"
                        >
                          <Bookmark className="w-3 h-3 text-blue-500" />
                          <span className="truncate max-w-[150px]">
                            {citation.documentName}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono tabular-nums">
                            p. {citation.pageNumber}
                          </span>
                          <span className="font-mono text-[10px] text-blue-600 font-semibold tabular-nums ml-0.5">
                            ({Math.round(citation.score * 100)}%)
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-slate-400 mt-1 px-1 font-mono">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex items-start gap-3 max-w-2xl">
            <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 shadow-2xs rounded-xl p-4 text-xs text-slate-500 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>
                Embedding query, retrieving top semantic chunks & synthesizing grounded answer...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Query Input Box */}
      <form onSubmit={handleSubmit} className="mt-3 relative">
        <div className="flex items-end gap-2 bg-white border border-slate-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 rounded-xl p-2 shadow-xs transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputText}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={
              chunkCount > 0
                ? 'Ask anything about the indexed documents... (Enter to send, Shift+Enter for newline)'
                : 'Upload a PDF or load starter documents first...'
            }
            className="flex-1 max-h-40 resize-none border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden px-2 py-1.5"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors shrink-0"
            aria-label="Send question"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
