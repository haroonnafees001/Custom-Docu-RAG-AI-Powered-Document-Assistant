/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header, TabType } from './components/Header.tsx';
import { ChatTab } from './components/ChatTab.tsx';
import { DocumentManagerTab } from './components/DocumentManagerTab.tsx';
import { SettingsTab } from './components/SettingsTab.tsx';
import { VectorInspectorTab } from './components/VectorInspectorTab.tsx';
import { CitationModal } from './components/CitationModal.tsx';
import { ProcessingModal } from './components/ProcessingModal.tsx';
import { ConfirmationModal } from './components/ConfirmationModal.tsx';
import {
  DocumentRecord,
  DocumentChunk,
  SystemSettings,
  ChatMessage,
  CitationItem,
} from './types/rag.ts';
import {
  DEFAULT_SYSTEM_SETTINGS,
  STARTER_DOCUMENT_RECORD,
  STARTER_DOCUMENT_CHUNKS,
} from './data/starter-document.ts';
import { extractTextFromPdf } from './utils/pdf-parser.ts';
import { chunkDocumentPages } from './utils/chunker.ts';
import {
  queryVectorIndex,
  getQueryEmbedding,
  getBatchEmbeddings,
  queryRagChatbot,
} from './utils/vector-store.ts';

import { get, set, del, clear } from 'idb-keyval';

const STORAGE_KEYS = {
  DOCS: 'docurag_documents_v1',
  CHUNKS: 'docurag_chunks_v1',
  SETTINGS: 'docurag_settings_v1',
  MESSAGES: 'docurag_messages_v1',
  MIGRATED: 'docurag_migrated_to_idb_v1',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(null);

  // Tracking if initial load from IDB is finished to prevent overwriting with empty state
  const isInitialLoadComplete = useRef(false);

  // Ingestion & Query State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [selectedDocFilter, setSelectedDocFilter] = useState<string | null>(null);
  const [chatDocumentFilter, setChatDocumentFilter] = useState<string | null>(null);

  // Confirmation Modal State
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant: 'danger' | 'primary';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    confirmVariant: 'primary',
    onConfirm: () => {},
  });

  // Hidden file input trigger for header upload button
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted state from IndexedDB
  useEffect(() => {
    const initStorage = async () => {
      try {
        // 1. Check for migration from localStorage
        const hasMigrated = localStorage.getItem(STORAGE_KEYS.MIGRATED);
        if (!hasMigrated) {
          console.log('Starting migration to IndexedDB...');
          const legacyDocs = localStorage.getItem(STORAGE_KEYS.DOCS);
          const legacyChunks = localStorage.getItem(STORAGE_KEYS.CHUNKS);
          const legacySettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
          const legacyMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);

          if (legacyDocs) await set(STORAGE_KEYS.DOCS, JSON.parse(legacyDocs));
          if (legacyChunks) await set(STORAGE_KEYS.CHUNKS, JSON.parse(legacyChunks));
          if (legacySettings) await set(STORAGE_KEYS.SETTINGS, JSON.parse(legacySettings));
          if (legacyMessages) await set(STORAGE_KEYS.MESSAGES, JSON.parse(legacyMessages));

          localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
          localStorage.removeItem(STORAGE_KEYS.DOCS);
          localStorage.removeItem(STORAGE_KEYS.CHUNKS);
        }

        // 2. Load from IDB
        const [savedDocs, savedChunks, savedSettings, savedMessages] = await Promise.all([
          get(STORAGE_KEYS.DOCS),
          get(STORAGE_KEYS.CHUNKS),
          get(STORAGE_KEYS.SETTINGS),
          get(STORAGE_KEYS.MESSAGES),
        ]);

        if (savedSettings) setSettings(savedSettings);
        if (savedMessages) setMessages(savedMessages);

        if (savedDocs && savedChunks && savedDocs.length > 0) {
          setDocuments(savedDocs);
          setChunks(savedChunks);
        } else {
          await bootstrapStarterDocument();
        }
      } catch (e) {
        console.error('Failed to load IndexedDB state:', e);
        await bootstrapStarterDocument();
      } finally {
        isInitialLoadComplete.current = true;
      }
    };

    initStorage();
  }, []);

  // Persist state to IndexedDB on changes
  useEffect(() => {
    if (isInitialLoadComplete.current) {
      set(STORAGE_KEYS.DOCS, documents);
    }
  }, [documents]);

  useEffect(() => {
    if (isInitialLoadComplete.current) {
      set(STORAGE_KEYS.CHUNKS, chunks).catch(err => {
        console.error('Critical storage error (Chunks):', err);
      });
    }
  }, [chunks]);

  useEffect(() => {
    if (isInitialLoadComplete.current) {
      set(STORAGE_KEYS.SETTINGS, settings);
    }
  }, [settings]);

  useEffect(() => {
    if (isInitialLoadComplete.current) {
      set(STORAGE_KEYS.MESSAGES, messages);
    }
  }, [messages]);

  /**
   * Initializes starter document and computes its vector embeddings
   */
  const bootstrapStarterDocument = async () => {
    setDocuments([STARTER_DOCUMENT_RECORD]);
    setChunks(STARTER_DOCUMENT_CHUNKS);

    try {
      const texts = STARTER_DOCUMENT_CHUNKS.map((c) => c.content);
      const embeddings = await getBatchEmbeddings(texts);
      const embeddedChunks = STARTER_DOCUMENT_CHUNKS.map((c, i) => ({
        ...c,
        embedding: embeddings[i],
      }));
      
      setChunks(embeddedChunks);
      await set(STORAGE_KEYS.CHUNKS, embeddedChunks);
      await set(STORAGE_KEYS.DOCS, [STARTER_DOCUMENT_RECORD]);
    } catch (err) {
      console.warn('Initial starter embeddings computation deferred:', err);
    }
  };

  /**
   * Automated Real-Time PDF Ingestion Pipeline
   */
  const handleUploadPdf = async (file: File) => {
    setIsProcessing(true);
    const documentId = `doc-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

    try {
      // Step 1: Extract PDF text page-by-page
      setProcessingStep(`Parsing pages from ${file.name}...`);
      const { pages, pageCount } = await extractTextFromPdf(file);

      // Step 2: Segment pages into natural semantic blocks and complete thoughts
      setProcessingStep(`Forming semantic blocks & paragraph units...`);
      const newChunks = chunkDocumentPages(documentId, file.name, pages, {
        maxSemanticSize: settings.chunkSize,
      });

      if (newChunks.length === 0) {
        throw new Error('Could not generate text chunks from this document.');
      }

      // Step 3: Compute high-dimensional Gemini embeddings
      setProcessingStep(
        `Computing vector embeddings for ${newChunks.length} chunks via Gemini...`
      );
      const texts = newChunks.map((c) => c.content);
      const embeddings = await getBatchEmbeddings(texts);

      // Attach embeddings to chunks
      const embeddedChunks: DocumentChunk[] = newChunks.map((chunk, idx) => ({
        ...chunk,
        embedding: embeddings[idx] || [],
      }));

      // Step 4: Auto-optimize AI Instructions for this specific document
      setProcessingStep(`Analyzing document nature to optimize AI instructions...`);
      try {
        const sampleText = newChunks.slice(0, 5).map(c => c.content).join('\n\n');
        const suggestRes = await fetch('/api/suggest-instructions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentSample: sampleText })
        });
        if (suggestRes.ok) {
          const { suggestedPrompt } = await suggestRes.json();
          if (suggestedPrompt) {
            setSettings(prev => ({
              ...prev,
              systemPrompt: suggestedPrompt
            }));
          }
        }
      } catch (err) {
        console.warn('Could not auto-optimize instructions:', err);
      }

      // Step 5: Index into database
      setProcessingStep(`Indexing into real-time vector database...`);
      await new Promise(resolve => setTimeout(resolve, 800));

      const newDocRecord: DocumentRecord = {
        id: documentId,
        name: file.name,
        sizeBytes: file.size,
        pageCount,
        uploadedAt: new Date().toISOString(),
        status: 'ready',
        chunkCount: embeddedChunks.length,
      };

      setDocuments((prev) => [newDocRecord, ...prev]);
      setChunks((prev) => [...embeddedChunks, ...prev]);

      setProcessingStep('Indexing successful! Finishing up...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsProcessing(false);
      setProcessingStep('');
      setActiveTab('documents');
    } catch (error: any) {
      console.error('PDF ingestion pipeline failed:', error);
      alert(`PDF Ingestion Failed: ${error.message || 'Unknown error'}`);
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  /**
   * Handle user question & RAG grounded generation
   */
  const handleSendMessage = async (query: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsAnswering(true);

    try {
      // Step 1: Generate embedding for the user query
      const queryEmbedding = await getQueryEmbedding(query);

      // Step 2: Query the in-memory vector index with cosine similarity
      // respect the document filter if set in the chat UI
      const retrievedChunks = queryVectorIndex(
        queryEmbedding,
        chunks,
        settings.topKRetrieval,
        settings.minSimilarityThreshold,
        chatDocumentFilter
      );

      // Format citations for UI pills
      const citations: CitationItem[] = retrievedChunks.map((c) => ({
        chunkId: c.id,
        documentName: c.documentName,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        snippet: c.content,
        score: c.score,
      }));

      // Prepare conversation history for Gemini chat context
      const history = messages.slice(-4).map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        text: m.text,
      }));

      // Step 3: Request grounded generation from server
      const result = await queryRagChatbot({
        query,
        history,
        systemInstruction: settings.systemPrompt,
        contextChunks: retrievedChunks,
        temperature: settings.temperature,
      });

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        sender: 'assistant',
        text: result.answer,
        timestamp: new Date().toISOString(),
        citations,
        retrievalCount: retrievedChunks.length,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('RAG Query execution error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        sender: 'assistant',
        text: 'I encountered an issue retrieving context or contacting the Gemini service.',
        timestamp: new Date().toISOString(),
        error: error.message || 'Failed to synthesize answer.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleDeleteDocument = (documentId: string) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Document?',
      message: 'Are you sure you want to delete this document? This will permanently remove all associated vector chunks from the memory.',
      confirmLabel: 'Delete Permanently',
      confirmVariant: 'danger',
      onConfirm: () => {
        const updatedDocs = documents.filter((d) => d.id !== documentId);
        const updatedChunks = chunks.filter((c) => c.documentId !== documentId);
        setDocuments(updatedDocs);
        setChunks(updatedChunks);
      },
    });
  };

  const handleReindexDocument = async (documentId: string) => {
    const doc = documents.find((d) => d.id === documentId);
    if (!doc) return;

    setIsProcessing(true);
    setProcessingStep(`Re-vectorizing chunks for ${doc.name}...`);

    try {
      const docChunks = chunks.filter((c) => c.documentId === documentId);
      const texts = docChunks.map((c) => c.content);
      const embeddings = await getBatchEmbeddings(texts);

      const reIndexedChunks = docChunks.map((chunk, idx) => ({
        ...chunk,
        embedding: embeddings[idx],
      }));

      const otherChunks = chunks.filter((c) => c.documentId !== documentId);
      const finalChunks = [...otherChunks, ...reIndexedChunks];
      setChunks(finalChunks);

      setProcessingStep('Re-indexed successfully!');
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStep('');
      }, 800);
    } catch (err: any) {
      alert(`Re-indexing failed: ${err.message}`);
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleInspectDocument = (documentId: string) => {
    setSelectedDocFilter(documentId);
    setActiveTab('inspector');
  };

  const handleClearChat = () => {
    setConfirmation({
      isOpen: true,
      title: 'Clear Conversation?',
      message: 'This will wipe your entire chat history and reset your current session. This action cannot be undone.',
      confirmLabel: 'Clear History',
      confirmVariant: 'danger',
      onConfirm: () => {
        setMessages([]);
        setChatDocumentFilter(null);
      },
    });
  };

  const handleHeaderUploadClick = () => {
    headerFileInputRef.current?.click();
  };

  const handleHeaderFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadPdf(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Hidden file picker input for header quick action */}
      <input
        ref={headerFileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleHeaderFileSelect}
        className="hidden"
      />

      {/* Global Top Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'inspector') setSelectedDocFilter(null);
          setActiveTab(tab);
        }}
        documentCount={documents.length}
        chunkCount={chunks.length}
        onUploadClick={handleHeaderUploadClick}
      />

      {/* Active Tab Viewport */}
      <main className="flex-1">
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            onSendMessage={handleSendMessage}
            onClearChat={handleClearChat}
            isLoading={isAnswering}
            onSelectCitation={(cit) => setActiveCitation(cit)}
            documentCount={documents.length}
            chunkCount={chunks.length}
            documents={documents}
            activeFilter={chatDocumentFilter}
            onFilterChange={setChatDocumentFilter}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentManagerTab
            documents={documents}
            chunks={chunks}
            onUploadPdf={handleUploadPdf}
            onDeleteDocument={handleDeleteDocument}
            onReindexDocument={handleReindexDocument}
            onInspectDocument={handleInspectDocument}
            onLoadStarterDocument={bootstrapStarterDocument}
            isProcessing={isProcessing}
            processingStep={processingStep}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            onSaveSettings={(s) => setSettings(s)}
            chunks={chunks}
          />
        )}

        {activeTab === 'inspector' && (
          <VectorInspectorTab
            chunks={chunks}
            onSelectChunk={(cit) => setActiveCitation(cit)}
            selectedDocumentFilter={selectedDocFilter}
            onClearFilter={() => setSelectedDocFilter(null)}
          />
        )}
      </main>

      {/* Slide-Over Context Citation Inspector */}
      <CitationModal
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      {/* Global AI Ingestion Pipeline Loader */}
      <ProcessingModal 
        isOpen={isProcessing} 
        step={processingStep} 
      />

      {/* Global Confirmation Dialog */}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        confirmVariant={confirmation.confirmVariant}
        onConfirm={confirmation.onConfirm}
        onClose={() => setConfirmation(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
