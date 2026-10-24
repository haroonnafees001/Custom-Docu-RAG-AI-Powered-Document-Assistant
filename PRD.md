# Product Requirements Document (PRD)
## DocuRAG Studio: Automated PDF Ingestion & Real-Time RAG Chatbot

---

### 1. Executive Summary
**DocuRAG Studio** is a production-grade, full-stack Retrieval-Augmented Generation (RAG) web platform. It eliminates manual vector database pipelines by enabling administrators and users to simply drag and drop any PDF document, which the system automatically parses, segments into natural **Semantic Chunks** (complete paragraphs, section headings, and thematic sentence propositions—eliminating arbitrary mechanical sliding windows), generates high-dimensional vector embeddings for via Gemini, and indexes in real time into an active vector store. End-users can immediately chat with their knowledge base, receiving strictly grounded answers with interactive, clickable source citation badges.

---

### 2. Problem Statement & Objectives
- **Problem**: Traditional RAG systems often rely on naive character sliding windows with fixed overlap, which indiscriminately cuts words, severs sentences mid-thought, and inflates index noise with duplicate text fragments. Additionally, manual vector databases require tedious offline setup, and standard chatbots suffer from hallucinations and lack verifiable citations.
- **Objectives**:
  1. **Automated Pure Semantic Chunking**: Upload any PDF; the system decomposes pages into cohesive semantic units (paragraphs, headers, complete sentence clusters) without mechanical sliding windows or artificial character slicing.
  2. **Auditability & Zero Hallucinations**: Every synthesized answer must cite source documents and page numbers (`[DocName, p. X]`). Users can click any citation pill to view the exact grounding snippet and similarity percentage.
  3. **Full Admin Governance**: Document lifecycle management (upload, re-index, inspect chunks, delete), system persona customization (prompt editor, temperature, top-$K$, similarity threshold), and real-time vector diagnostics.

---

### 3. User Personas & Target Audience
1. **Knowledge Administrator / Engineer**:
   - Manages company manuals, legal policies, technical specifications, and research papers.
   - Needs visibility into chunk boundaries, semantic cohesion, and vector similarity metrics.
2. **Business User / Analyst**:
   - Queries documents in natural language (Urdu/English/Multilingual).
   - Needs direct, verifiable answers with instant source previews.
3. **Customer Support / Compliance Auditor**:
   - Requires strict adherence to policy text without speculative extrapolation.

---

### 4. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DocuRAG Studio Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [ Admin / User ]                                                          │
│          │                                                                  │
│          ▼ (Uploads PDF)                                                    │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ 1. PDF Parser (`pdfjs-dist`)                                          │ │
│   │    • Extracts raw text page-by-page preserving page numbers           │ │
│   └──────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                      │
│                                      ▼                                      │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ 2. Semantic Chunker (No Sliding Windows)                              │ │
│   │    • Natural structural boundaries: Paragraphs (\n\n) & Section Titles│ │
│   │    • Cohesive Sentence Clustering: Full thoughts preserved intact     │ │
│   │    • Sentence termination points (. ? !) — Zero mid-thought slicing   │ │
│   └──────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                      │
│                                      ▼                                      │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ 3. Vector Embedding Engine (`gemini-embedding-001` - Stable GA)       │ │
│   │    • Generates 3,072-dim vectors, normalizes to L2 unit hypersphere   │ │
│   └──────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                      │
│                                      ▼                                      │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ 4. Real-Time Vector Index                                             │ │
│   │    • Fast algebraic dot-product cosine similarity: sim(u, v) = u · v  │ │
│   │    • Filter by minimum threshold (default: 0.35), sort descending     │ │
│   └──────────────────────────────────┬────────────────────────────────────┘ │
│                                      │                                      │
│                                      ▼                                      │
│   ┌───────────────────────────────────────────────────────────────────────┐ │
│   │ 5. Grounded Synthesis (`gemma-4-26b-a4b-it`)                          │ │
│   │    • Gemma 4 model with grounded prompt context & citation tags       │ │
│   │    • Generates answer + clickable citation pills for frontend         │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Functional Requirements

#### 5.1 Document Management (Admin Panel)
- **Drag-and-Drop Uploader**: Accepts PDF documents up to 25MB.
- **Automated Real-Time Progress Pipeline**:
  - *Phase 1*: Extracting pages.
  - *Phase 2*: **Semantic Chunking**: Grouping text into cohesive paragraphs, headers, and sentence clusters.
  - *Phase 3*: Generating Gemini embeddings via server API.
  - *Phase 4*: Indexing into active vector database.
- **Document Inventory Table**:
  - Columns: Document Name, ID, Page Count, Chunk Count, File Size, Indexing Status (`Indexed`, `Vectorizing`, `Failed`), Upload Date, Actions.
  - Actions: Inspect Chunks, Re-index Document, Delete Document.
- **Pre-Loaded Sample Knowledge Base**: Includes a comprehensive starter manual ("DocuRAG System Architecture & Ingestion Manual") ready to test immediately out of the box.

#### 5.2 Conversational RAG Chatbot
- **Query Vectorization**: Embeds user query on submission using identical embedding model.
- **Vector Retrieval**: Computes cosine similarity against all active chunks, retrieves top-$K$ candidates above minimum threshold.
- **Context Injection**: Injects matched semantic excerpts into Gemini context window with system instructions.
- **Interactive Citation Pills**:
  - Formatted as `[DocName, p. X · Score%]`.
  - Clicking any citation opens a **Slide-Over Context Inspector** showing:
    - Source document title & page number.
    - Exact similarity score and internal chunk ID.
    - Complete unedited passage excerpt.
    - Copy passage button.
- **Conversational History**: Maintains multi-turn context (last 4 dialogue turns) for follow-up questions.
- **Starter Prompts**: 4 pre-configured sample questions to test immediately.

#### 5.3 Semantic Chunking Strategy (Updated: No Sliding Windows)
- **Structural Heading & Paragraph Preservation**: Rather than blindly slicing text every $N$ characters with artificial overlap, the chunker identifies natural structural blocks:
  1. Section headers, chapter titles, and numbered lists.
  2. Double line-break paragraph transitions (`\n\n`).
- **Thematic Sentence Clustering**: For larger paragraphs, the algorithm clusters sentences together up to an optimal semantic boundary ($~650$ characters), ensuring that every chunk contains complete sentences and coherent ideas. No clauses are ever severed across chunks.
- **Zero Redundant Overlap**: Eliminates mechanical overlap duplication, yielding cleaner embeddings and reducing vector search noise.

#### 5.4 System Persona & Role Configuration
- **Persona Presets**:
  1. *Technical Architecture Expert*: Deep technical rigor with structural citations.
  2. *Concise Executive Advisor*: High-impact, bulleted executive decision points.
  3. *Strict Legal & Compliance Auditor*: Verbatim quotation adherence without speculation.
  4. *Customer Support Specialist*: Friendly, step-by-step guidance.
- **Interactive Prompt Editor**: Full custom editable system instruction textarea.
- **Retrieval & Model Sliders**:
  - Top-$K$ Retrieval Candidates (1 to 8).
  - Minimum Cosine Similarity Threshold (0.10 to 0.80).
  - Model Temperature (0.0 to 1.0).
  - Target Semantic Chunk Size (200 to 1000 characters).
- **Live Retrieval Sandbox**: Allows testing semantic matches and scores live without having to open the chat.

#### 5.5 Vector Store Inspector & Diagnostic Console
- **Search & Filter**: Filter chunks by keyword, document ID, or text snippet.
- **Real-Time Similarity Tester**: Enter any test sentence to calculate dot products across all chunks and see ranking order live.
- **Metric Tiles**: Total Indexed Chunks, Average Chunk Window, Total Word Corpus, Vector Dimensions (3,072).

---

### 6. Technical Stack & Architecture

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | React 19 + TypeScript | Type safety, component modularity, reactive state |
| **Styling & Theme** | Tailwind CSS v4 + Plus Jakarta Sans + JetBrains Mono | Clean enterprise SaaS design, tabular figure alignment |
| **PDF Extraction** | `pdfjs-dist` | In-memory, client-side, page-by-page extraction |
| **Chunking Logic** | Pure Semantic Chunker | Natural paragraphs, headings & sentence clusters (No sliding windows) |
| **Embeddings Model** | `gemini-embedding-001` (Stable GA · 3,072 dims) | Official production GA model with 3,072-dim semantic embeddings |
| **LLM Generation** | **Gemma 4** (`gemma-4-26b-a4b-it`) | Advanced open weights Gemma 4 model with grounded RAG reasoning |
| **Server Runtime** | Express.js + Vite Connect middleware | Server-side API key protection, full-stack proxy |
| **Vector Index** | In-memory normalized vector matrix + Cosine Dot Product | Sub-millisecond retrieval, persistent in localStorage |

---

### 7. Non-Functional Requirements & Security
- **API Key Security**: The Gemini API key is managed strictly on the server side (`process.env.GEMINI_API_KEY`). No secrets or keys are ever bundled or exposed to the client.
- **Performance & Latency**:
  - Vector cosine search: $< 5\text{ms}$ for hundreds of chunks.
  - Embedding batching: Chunks are processed in small parallel batches to prevent API rate limits.
  - Grounded answer response: $< 3\text{s}$ average latency.
- **Data Privacy**: PDF files are processed directly in browser memory and temporary server embedding buffers; no raw PDF binaries are permanently stored on third-party servers.
- **Offline / Local Persistence**: Uploaded document records, chunk metadata, vector embeddings, and conversation histories persist in browser storage (`localStorage`), surviving browser refreshes.

---

### 8. Acceptance Criteria
- [x] Chunking is purely semantic: segments by natural paragraphs, headings, and cohesive sentence groups (no mechanical sliding windows or arbitrary overlap).
- [x] Admin can upload a PDF and watch automated progress (Extracting $\rightarrow$ Semantic Chunking $\rightarrow$ Embedding $\rightarrow$ Ready).
- [x] Indexed documents appear in the Document Manager table with page count, chunk count, and file size.
- [x] Chatbot retrieves semantically relevant chunks for user questions and produces grounded answers.
- [x] AI responses contain interactive citation badges displaying document name, page number, and similarity score.
- [x] Clicking a citation badge opens the slide-over inspector displaying the exact source excerpt.
- [x] Admin can switch between Persona Presets (Technical Expert, Executive, Compliance, Support) or edit the system prompt.
- [x] Admin can adjust Top-$K$, Temperature, and Similarity Threshold sliders and test retrieval live in the Sandbox.
- [x] Vector Inspector displays all chunks with dimensions and allows real-time similarity ranking.
