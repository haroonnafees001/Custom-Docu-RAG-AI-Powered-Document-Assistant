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

const STORAGE_KEYS = {
  DOCS: 'docurag_documents_v1',
  CHUNKS: 'docurag_chunks_v1',
  SETTINGS: 'docurag_settings_v1',
  MESSAGES: 'docurag_messages_v1',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeCitation, setActiveCitation] = useState<CitationItem | null>(null);

  // Ingestion & Query State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [selectedDocFilter, setSelectedDocFilter] = useState<string | null>(null);

  // Hidden file input trigger for header upload button
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted state or bootstrap with starter document
  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem(STORAGE_KEYS.DOCS);
      const savedChunks = localStorage.getItem(STORAGE_KEYS.CHUNKS);
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);

      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }

      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }

      if (savedDocs && savedChunks) {
        const parsedDocs = JSON.parse(savedDocs);
        const parsedChunks = JSON.parse(savedChunks);
        if (parsedDocs.length > 0) {
          setDocuments(parsedDocs);
          setChunks(parsedChunks);
          return;
        }
      }

      // Bootstrap with starter document
      bootstrapStarterDocument();
    } catch (e) {
      console.error('Failed to load local storage state:', e);
      bootstrapStarterDocument();
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    if (documents.length > 0) {
      localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(documents));
    }
  }, [documents]);

  useEffect(() => {
    if (chunks.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CHUNKS, JSON.stringify(chunks));
    }
  }, [chunks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  }, [messages]);

  /**
   * Initializes starter document and computes its vector embeddings
   */
  const bootstrapStarterDocument = async () => {
    setDocuments([STARTER_DOCUMENT_RECORD]);
    setChunks(STARTER_DOCUMENT_CHUNKS);

    try {
      // Generate embeddings in background for starter chunks
      const texts = STARTER_DOCUMENT_CHUNKS.map((c) => c.content);
      const embeddings = await getBatchEmbeddings(texts);
      const embeddedChunks = STARTER_DOCUMENT_CHUNKS.map((c, i) => ({
        ...c,
        embedding: embeddings[i],
      }));
      setChunks(embeddedChunks);
      localStorage.setItem(STORAGE_KEYS.CHUNKS, JSON.stringify(embeddedChunks));
      localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify([STARTER_DOCUMENT_RECORD]));
    } catch (err) {
      console.warn('Initial starter embeddings computation queued or deferred:', err);
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

      // Step 4: Index into database
      setProcessingStep(`Indexing into real-time vector database...`);

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

      setProcessingStep('Indexed successfully!');
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStep('');
        setActiveTab('documents');
      }, 1000);
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
      const retrievedChunks = queryVectorIndex(
        queryEmbedding,
        chunks,
        settings.topKRetrieval,
        settings.minSimilarityThreshold
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
    if (confirm('Are you sure you want to delete this document and remove all its vector chunks?')) {
      const updatedDocs = documents.filter((d) => d.id !== documentId);
      const updatedChunks = chunks.filter((c) => c.documentId !== documentId);
      setDocuments(updatedDocs);
      setChunks(updatedChunks);
      localStorage.setItem(STORAGE_KEYS.DOCS, JSON.stringify(updatedDocs));
      localStorage.setItem(STORAGE_KEYS.CHUNKS, JSON.stringify(updatedChunks));
    }
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
      localStorage.setItem(STORAGE_KEYS.CHUNKS, JSON.stringify(finalChunks));

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
    if (confirm('Clear entire conversation history?')) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    }
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
    </div>
  );
}
