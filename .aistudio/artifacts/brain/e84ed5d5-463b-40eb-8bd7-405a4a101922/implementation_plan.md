# RAG Chatbot with Automated PDF Indexing & Admin Studio

An end-to-end Retrieval-Augmented Generation (RAG) platform featuring real-time automated PDF ingestion, semantic chunking, vector embeddings via Gemini, in-memory cosine vector search, and a comprehensive Admin Studio for document management and system persona configuration.

***

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and user experience decisions were confirmed during requirements clarification and form the foundation of the build:

- **Confirmed Vector Strategy**: Real-time vector store powered by Gemini embeddings (`gemini-embedding-2-preview` / server-side embeddings proxy) with real-time cosine similarity search and persistent local state.
- **Confirmed Navigation Layout**: Unified workspace featuring a high-density top header with tabbed navigation between **Interactive Chatbot**, **Document Manager & Indexing**, **System Role & Settings**, and **Vector Index Inspector**.
- **Confirmed Citation UX**: Interactive inline citation badges attached to AI responses; clicking any citation opens an inspection drawer showing the exact PDF source name, page number, similarity score, and excerpted chunk context.
- **Pre-loaded Knowledge Base**: To ensure immediate out-of-the-box delight without forcing users to find a PDF first, the app includes a sample starter document ("RAG Knowledge Base & System Architecture Manual") ready to chat with immediately.

***

## 1. Overview & Core Concept

### What It Does
The platform enables administrators and knowledge workers to turn static PDF documents into an intelligent conversational knowledge base in seconds. When a PDF is uploaded in the Admin Panel:
1. The document is automatically extracted page-by-page.
2. Text is split into cohesive semantic units (complete paragraphs, section titles, and complete thought clusters—without mechanical sliding windows or artificial overlaps).
3. High-dimensional vector embeddings are computed via server-side Gemini integration.
4. Chunks are indexed in real time into an active vector space.
5. In the Chat interface, user questions are embedded, the most relevant passages are retrieved using cosine similarity, and Gemini (`gemini-3.8-flash`) synthesizes an accurate, hallucination-free response with clickable citation pills.

### Target Audience & Persona
- **Knowledge Teams & Administrators**: Managing technical documentation, manuals, legal contracts, policy guidelines, and customer support catalogs.
- **End Users & Analysts**: Asking complex queries in natural language and receiving cited, verifiable answers with instant source previews.

### Key Value Delivered
- **Zero-Friction Ingestion**: Drag, drop, and query—no manual vector database configuration or complex external pipelines required.
- **Transparency & Trust**: Interactive citation pills eliminate "black-box" AI anxiety by displaying exact matched paragraphs and similarity metrics.
- **Administrative Control**: Live tuning of the system persona, temperature, similarity thresholds, and top-k retrieval parameters without application restarts.

***

## 2. User Experience & Visual Design

### Key User Flows
1. **Document Upload & Ingestion Flow**:
   - Admin navigates to the **Document Manager** tab.
   - Admin drags a PDF onto the upload dropzone (or selects from sample documents).
   - Real-time progress indicators show: *Extracting text* $\rightarrow$ *Generating semantic chunks* $\rightarrow$ *Vectorizing with Gemini* $\rightarrow$ *Indexed successfully*.
   - The document card updates with total page count, chunk count, file size, and indexing timestamp.
2. **Interactive RAG Querying Flow**:
   - User switches to the **Chatbot** tab and enters a question.
   - The system embeds the query, searches the indexed vector database, extracts top-$k$ relevant chunks exceeding the similarity threshold, and prompts Gemini with the grounded context.
   - The response streams or displays with clear markdown formatting and inline citation pills (e.g. `[Page 3 · Chunk 12 (88% match)]`).
   - Clicking a citation opens a sliding inspection panel showing the original text snippet and source metadata.
3. **System Role & Persona Tuning Flow**:
   - Admin switches to **Settings & Persona**.
   - Admin updates the System Prompt (e.g. "Strict Technical Support Specialist", "Corporate Policy Advisor", or "Friendly Research Assistant"), adjusts the Temperature slider ($0.0$ to $1.0$), and sets Retrieval Top-K ($1$ to $8$).
   - A live test prompt allows testing changes immediately before returning to chat.
4. **Vector Inspector & Similarity Debugger**:
   - Admin explores the **Vector Index** tab to search chunks by keyword, inspect raw chunk content, and test vector similarity matches against test queries.

### Visual Identity & Theme
- **Domain Aesthetic**: Modern Enterprise SaaS / Developer Console (clean slate and zinc neutrals, refined typographic hierarchy, zero pill slop, high-density tabular alignment).
- **Color Palette**:
  - Dominant Neutral Canvas (60%): Clean white (`#FFFFFF`) / Slate light-neutral (`#F8FAFC`) with dark mode support (`#0F172A`).
  - Structural Surfaces (30%): Hairline borders (`border-slate-200 dark:border-slate-800`), crisp surface cards (`#FFFFFF` / `#1E293B`).
  - Accent Budget (10%): Electric Indigo / Cobalt (`#3B82F6` / `#2563EB`) reserved for primary action triggers and active states.
  - Semantic Indicators: Subtle emerald text for indexed status, amber for indexing, rose for deletion.
- **Typography**:
  - Headings & Navigation: `Plus Jakarta Sans` or `Manrope` for sharp, contemporary executive clarity.
  - Body & Reading: Clean `Public Sans` / `Plus Jakarta Sans` with balanced line heights.
  - Metrics & Chunks: `font-mono tabular-nums` for similarity percentages, vector dimensions, chunk tokens, and page numbers.
- **Interactive Micro-Interactions**:
  - Smooth tab switching transitions via `motion/react`.
  - Responsive dropzone hover feedback with file-type validation.
  - Smooth slide-over drawer for source citations without interrupting chat context.

***

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Hybrid PDF Text Parsing Strategy
- **Chosen Approach**: Client-side resilient PDF parsing using `pdfjs-dist` (extracting text page-by-page) combined with a server-side embedding pipeline via `@google/genai`.
- **Why**: Keeps large PDF parsing responsive and private, provides exact page number tracking for each chunk, and handles multi-page documents without server memory timeouts.
- **Alternatives Considered**: Sending raw PDF binary to server for OCR; rejected due to latency, potential size limits, and lack of granular per-chunk page boundary control.

### Decision 2: Real-Time Vector Store with In-Memory Cosine Similarity
- **Chosen Approach**: Normalized high-dimensional vector embeddings stored with metadata (document ID, document name, page number, chunk text, token estimate). Cosine similarity calculated using optimized vector dot products.
- **Why**: Delivers sub-millisecond retrieval speeds for documents up to hundreds of pages without requiring complex external cloud databases, and persists locally in `localStorage` / server session state.
- **Alternatives Considered**: External Cloud SQL / Pinecone database; adds external billing and setup hurdles that are unnecessary for immediate, real-time PDF RAG workflows.

### Decision 3: Inline Citation Pills with Inspection Modal
- **Chosen Approach**: AI generated answers include structured references (`[Source 1: DocName, p. X]`). The UI parses these into clickable interactive citation badges that open a context inspection modal.
- **Why**: Meets the user's specific choice from Turn 1, providing complete transparency and auditability for every claim made by the chatbot.

***

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RAG Application Workspace                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar: Brand Wordmark · Tab Navigation · Knowledge Base Quick Stats  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────┬─────────────────────────┬─────────────────────┐  │
│  │      Chatbot View     │   Document Manager Tab  │   Settings & Role   │  │
│  │                       │                         │                     │  │
│  │ • Message Thread      │ • PDF Dropzone Uploader │ • System Persona    │  │
│  │ • Citation Badges     │ • Document Table & Meta │ • Retrieval Top-K   │  │
│  │ • Source Drawer       │ • Chunk Inspector       │ • Temperature & TopP│  │
│  │ • Query Input Box     │ • Re-index & Delete Ops │ • Vector Stats      │  │
│  └───────────┬───────────┴────────────┬────────────┴──────────┬──────────┘  │
│              │                        │                       │             │
│              ▼                        ▼                       ▼             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Client State & Store                           │  │
│  │   • Documents Store       • Active Persona Config   • Chat History    │  │
│  │   • In-Memory Vector DB   • Search & Filter State   • UI Modals State │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ HTTP /api calls
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Backend Server (`server.ts`)                         │
│                                                                             │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌───────────────┐  │
│  │  POST /api/rag/embed    │  │  POST /api/rag/query  │  │ GET /api/heal │  │
│  │  Generates embeddings   │  │  Gemini 3.8 Flash RAG │  │ System check  │  │
│  │  via gemini-embedding-2 │  │  grounded synthesis   │  │               │  │
│  └───────────┬─────────────┘  └───────────┬───────────┘  └───────────────┘  │
│              │                            │                                 │
│              └──────────────┬─────────────┘                                 │
│                             ▼                                               │
│             Google GenAI SDK (`@google/genai`)                              │
│             Using Server-Side GEMINI_API_KEY                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Entities

```typescript
// Core Document Entity
interface DocumentRecord {
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number;
  uploadedAt: string;
  status: 'parsing' | 'indexing' | 'ready' | 'error';
  errorMessage?: string;
  chunkCount: number;
}

// Vector Chunk Entity
interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  embedding?: number[]; // normalized embedding vector
}

// System Persona Configuration
interface SystemSettings {
  systemPrompt: string;
  temperature: number;
  topKRetrieval: number;
  minSimilarityThreshold: number;
  chunkSize: number;
  chunkOverlap: number;
}

// Chat Message with Grounding Citations
interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: Array<{
    chunkId: string;
    documentName: string;
    pageNumber: number;
    snippet: string;
    score: number;
  }>;
}
```

### Key API & Service Endpoints
1. `POST /api/rag/embed-batch`: Takes an array of text chunks, batches requests to `ai.models.embedContent({ model: 'gemini-embedding-2-preview' })`, and returns high-dimensional embedding vectors.
2. `POST /api/rag/generate-answer`: Receives the user question, conversation history, retrieved context snippets with metadata, and system instructions, querying `ai.models.generateContent({ model: 'gemini-3.8-flash' })` with explicit citation formatting instructions.
3. Client-side semantic similarity search: Computes cosine similarity between query embedding and all indexed chunks, sorts descending, and returns top-$K$ candidates above `minSimilarityThreshold`.
