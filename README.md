# Image-Based Product Search

A full-stack application that enables users to upload an image of a furniture item and receive **relevant matches** from a furniture catalog, with optional natural-language query refinement. The system prioritizes **match quality and relevance** over simply returning results.

## Overview

This repository contains a complete full-stack system for **image-based furniture search**:

- **Frontend (`frontend`)**: React + TypeScript single-page app built with Vite, featuring a modern, responsive UI.
- **Backend (`backend`)**: Node.js + TypeScript API using Express and MongoDB.

Users can upload a furniture photo, optionally add a natural-language query, and receive **ranked matches** from a read-only MongoDB product catalog. An **admin tab** exposes retrieval and ranking meta-parameters for tuning, and an **evaluation tab** supports lightweight relevance judgments with precision metrics.

The system uses **frontier AI models** (OpenAI, Anthropic Claude, or Google Gemini) for vision analysis and embeddings. The **API keys are never persisted** to disk; they are only held in memory in the browser and passed to the backend per request.

## Architecture

### Data Source

- **MongoDB Atlas (read-only)**  
  Connection string is configured via environment variables (see setup instructions below):
  - Database: `catalog`
  - Collection: `products`

Each product document has:
- `title`, `description`, `category`, `type`
- `price` (USD), `width`, `height`, `depth` (cm)

The backend treats products as immutable and **never modifies the database**.

### Backend: Retrieval & Ranking Pipeline

Key files (in `backend/src`):

- `index.ts`: Express app bootstrap (`/health`, `/api/search`, error handling).
- `config/env.ts`: Central configuration (port, Mongo URI from environment variables).
- `services/mongoClient.ts`: MongoDB client and `fetchAllProducts()` helper with connection pooling.
- `services/aiProvider.ts`: Multi-provider abstraction for OpenAI, Anthropic, and Google AI clients.
- `services/embeddingCache.ts`: In-memory embedding cache and cosine similarity computation.
- `services/searchService.ts`: Orchestrates image analysis, query construction, and multi-signal ranking.
- `routes/search.ts`: Validates requests, wires API keys, and calls `performSearch`.
- `types.ts`: Shared backend types (product, search config, scored product).
- `middleware/errorHandler.ts`: Centralized error handling middleware.

**Search Flow**:

1. **Client Request**  
   - Endpoint: `POST /api/search`  
   - Headers: 
     - `x-openai-api-key`, `x-anthropic-api-key`, or `x-google-api-key` (vision provider)
     - `x-embedding-api-key` (optional, for embeddings if different from vision)
   - Body:
     - `imageBase64`: data URL of the uploaded image.
     - `queryText` (optional): user prompt to refine results.
     - `config`: retrieval meta-parameters (from admin UI).

2. **Image Understanding (Vision Model)**  
   - `searchService.performSearch` calls the selected AI provider (configurable via Admin) with:
     - A system prompt focused on furniture attributes (category, type, style, materials, color, dimensions, usage).
     - The uploaded image and optional user text.
   - The model first determines if the image is furniture, then returns a **structured analysis** (category, type, description).
   - If not furniture, the request is rejected with a clear reason.

3. **Query Construction**  
   - The backend builds a `combinedQueryText` string:
     - Explicit type and category from the vision analysis.
     - Detailed description from the vision step.
     - Optional user preferences (e.g., "light oak, Scandinavian, compact").

4. **Catalog Retrieval & Embeddings**  
   - `fetchAllProducts()` pulls the current product set from MongoDB.
   - Optional price range filtering (if enabled in config).
   - `getProductEmbeddings(products, provider, apiKey, model)`:
     - For any product lacking an embedding in the in-memory cache, calls the embeddings API on:
       - `title | category | type | description`
     - Stores embeddings in a **process-local Map** keyed by product ID.
     - Batches requests (100 products per batch) to optimize API usage.
   - `createQueryEmbedding(combinedQueryText, provider, apiKey, model)` generates a query vector.

5. **Scoring and Ranking**  
   - Candidate set: first `maxCandidates` products (configurable; default 200).
   - For each candidate:
     - **Semantic Score**: Cosine similarity between product and query embeddings (primary signal).
     - **Type/Category Match Score**: Exact and partial matching with synonym handling (boost signal, 25% weight).
     - **Lexical Score**: Token overlap between query string and product text.
     - **Price Proximity Score**: Optional proximity to target price or average price.
   - Final weighted score:
     - `score = imageWeight * semanticScore + typeCategoryWeight * typeCategoryScore + textWeight * lexicalScore + priceWeight * priceScore`
     - Weights are configurable via Admin UI and normalized to sum to 100%.
   - Results below `minScore` are filtered.
   - Top `topK` products by score are returned.

6. **Response**  
   - Shape:
     - `results`: array of `{ product, score, explanation }`.
     - `debug`: includes the vision description, analysis, combined query text, config, total products, candidate counts, and top score.
     - `isFurniture`: boolean indicating if furniture was detected.

**Why This Design?**

- **Separation of Concerns**:
  - Mongo access, AI provider integration, caching, and search orchestration are kept in separate modules.
- **KISS**:
  - Single main `/api/search` endpoint with a straightforward pipeline.
- **DRY / Reuse**:
  - Common product and scoring logic is centralized (e.g., `embeddingCache`, `searchService`).
- **Multi-Provider Support**:
  - Abstracted AI provider interface allows switching between OpenAI, Anthropic, and Google without changing core logic.
- **Runtime-Only Secret Handling**:
  - Only the client knows the API key; it is forwarded via header and never persisted.

### Frontend: UI/UX and Workflows

Key files (in `frontend/src`):

- `App.tsx`: Tabbed layout (Search / Admin / Evaluation) with API key management.
- `pages/SearchPage.tsx`: Main image search flow with history.
- `pages/AdminPage.tsx`: Internal configuration UI for retrieval and ranking parameters.
- `pages/EvaluationPage.tsx`: Lightweight evaluation dashboard with precision metrics.
- `state/SearchConfigContext.tsx`: Provides search configuration across tabs.
- `state/EvaluationContext.tsx`: Stores relevance judgments in memory.
- `state/SearchHistoryContext.tsx`: Maintains search history with results.
- `state/ApiKeysContext.tsx`: Manages API keys in memory (never persisted).
- `services/searchApi.ts`: Typed client for the backend search endpoint.
- `components/ApiKeyModal.tsx`: Modal for configuring API keys for different providers.
- `components/ui/`: Reusable UI components (buttons, cards, inputs, etc.).

**Search Tab (User Workflow)**:

- Enter **AI provider API keys** via the API Keys button (masked input, never stored; passed per request).
- Upload a **furniture image** (drag-and-drop or click to upload).
- Optionally type a **prompt** to refine results (style, color, room, price, etc.).
- Click **"Search catalog"**:
  - Client calls backend `/api/search` with:
    - Image (data URL).
    - Query text.
    - Current admin config values.
    - Appropriate API key headers based on selected provider.
- Results are shown as cards with:
  - Title, category, type.
  - Description.
  - Price and dimensions.
  - Relevance score (as a percentage) and scoring breakdown.
- Each result can be marked **Relevant** or **Not relevant**, feeding the evaluation tab.
- **Search History** tab shows past searches with ability to view previous results.

**Admin Tab (Internal / Back-Office)**:

Controls (all live in `SearchConfigContext` and are sent to the backend):

- **Vision Model**:
  - Provider selection (OpenAI, Anthropic, Google).
  - Model selection (provider-specific models).
- **Embedding Model**:
  - Provider selection (OpenAI, Google; Anthropic not supported).
  - Model selection (provider-specific embedding models).
- **Retrieval Settings**:
  - `maxCandidates` (10–500): How many products to consider pre-ranking.
  - `topK` (1–50): Maximum number of results to return.
  - `minScore` (0–1): Filter threshold for weak matches.
- **Ranking Weights** (normalized to sum to 100%):
  - `imageWeight` (0–1): Relative weight of embedding similarity.
  - `textWeight` (0–1): Relative weight of lexical overlap.
  - `priceProximityWeight` (0–1): Relative weight of price proximity.
- **Filters**:
  - Price range filter (optional, with min/max values).
- **Backend Configuration**:
  - `backendUrl`: Base URL for the API (default `http://localhost:4000`).

This tab is designed as the **tuning surface** for relevance vs. latency and for adjusting how strongly the system leans on different signals.

**Evaluation Tab (Lightweight Evaluation)**:

- **Overview Tab**:
  - Key metrics: Total evaluated, Relevant, Not relevant, Overall precision.
  - Precision@K metrics (Precision@1, Precision@3, Precision@5, Precision@10).
  - Score analysis: Average scores for relevant vs. not relevant products.
  - Category breakdown: Performance by furniture category.
- **Details Tab**:
  - Complete table of all relevance judgments with product IDs, scores, ranks, and timestamps.
- **Insights Tab**:
  - Automated recommendations based on evaluation data.
  - Suggestions for improving search quality.
  - Alerts for low precision or score ranking issues.

This gives a quick, in-app way to compare different configurations (e.g., before/after changing `maxCandidates` or weights) and understand system performance.

## Evaluation Strategy

### Conceptual Approach

- **Primary Metric**:  
  - **Precision@K** (fraction of top-K results that are relevant).
- **Signal Collection**:
  - Manual marking of each result as relevant / not relevant.
  - Focus on:
    - How often the top few results (e.g., top 5) are truly good matches.
    - When and why irrelevant items appear (e.g., mismatch in category, color, style).
- **Configuration Experiments**:
  - Vary `maxCandidates`, `topK`, `imageWeight`, `textWeight`, `minScore`.
  - For each setting, run a few representative queries:
    - Different furniture categories (chairs, tables, sofas).
    - Varying styles (modern, rustic, Scandinavian).
  - Compare precision and qualitative feel of results.

### Built-in Lightweight Evaluation

The Evaluation tab is a minimal in-app layer for:

- Capturing **binary relevance labels** (`relevant` vs `not relevant`).
- Computing **overall precision** and **Precision@K** across all labeled results.
- Analyzing score distributions and category performance.
- Providing actionable insights and recommendations.

In a real system, this would be extended to:

- Persist labels server-side keyed by query type and config.
- Support offline batch evaluation.
- Slice metrics by configuration and query category.
- Track precision trends over time.

## Running the System Locally

### Prerequisites

- Node.js **22.12+** is recommended (Vite warns if using <22.12).  
  Node 22.0.0 works for this demo but will log an engine warning.
- npm (comes with Node).
- **AI Provider API Keys** with access to:
  - **OpenAI**: `gpt-4o` or `gpt-4o-mini` (vision), `text-embedding-3-small` (embeddings).
  - **Anthropic**: `claude-3-5-sonnet-20241022` or other Claude models (vision only; embeddings require OpenAI).
  - **Google**: `gemini-1.5-pro` or `gemini-1.5-flash` (vision), `text-embedding-004` (embeddings).

### 1. Install Dependencies

From the repo root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Then edit `.env` and set your MongoDB connection string:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
PORT=4000
```

**Important**: The `.env` file is already in `.gitignore` and will not be committed to version control. Never commit sensitive credentials like MongoDB connection strings.

### 3. Run the Backend

From `backend`:

```bash
npm run dev
```

This starts the API on **`http://localhost:4000`** by default.

Health check:

```bash
curl http://localhost:4000/health
```

You should see:

```json
{ "status": "ok" }
```

### 4. Run the Frontend

From `frontend`:

```bash
npm run dev
```

Vite will print a local URL, typically `http://localhost:5173`. Open it in your browser.

### 5. Using the App

1. Click the **API Keys** button in the header and enter your AI provider API keys.
2. Go to the **Search** tab.
3. Upload a furniture image.
4. (Optional) Enter a short text query to refine the match.
5. Click **"Search catalog"**.
6. Inspect the ranked results and mark them as **Relevant** or **Not relevant**.
7. Switch to the **Evaluation** tab to see precision metrics and insights.
8. Use the **Admin** tab to adjust retrieval parameters and repeat to see their impact.

## Design Choices and Tradeoffs

- **No Database Writes**
  - Embeddings are cached **in memory** only. This keeps the MongoDB catalog read-only and avoids schema changes.
  - Tradeoff: Embeddings are recomputed after each server restart until the cache warms up.

- **Single Endpoint for Search**
  - Keeps the API surface simple: `/api/search` does all orchestration.
  - Debug information is returned with every response to make relevance tuning easier.

- **Multi-Signal Ranking**
  - **Semantic similarity** (embeddings) provides robust matching across the catalog.
  - **Type/category matching** ensures basic relevance and handles synonyms.
  - **Lexical overlap** provides a cheap, transparent textual signal.
  - **Price proximity** (optional) helps match user budget preferences.
  - Configurable weights allow tuning the balance between signals.

- **Multi-Provider Support**
  - Abstracted provider interface allows switching between OpenAI, Anthropic, and Google.
  - Anthropic doesn't support embeddings, so OpenAI is used for embeddings when Anthropic is selected for vision.
  - Each provider can use different models for vision and embeddings.

- **Admin-Controlled Meta-Parameters**
  - Puts **ranking control** into a dedicated, non-consumer UI.
  - Keeps the matching core generic and configurable without code changes.

- **In-Browser Evaluation**  
  - Lightweight but effective for this assignment:
    - No persistence or complex labeling taxonomy.
  - Emphasizes **qualitative exploration plus simple metrics (precision, Precision@K)**.

- **Error Handling**  
  - Graceful handling of:
    - Invalid or missing API keys (clear error messages).
    - Rate limit errors (user-friendly notifications).
    - Invalid image formats (validation and feedback).
    - Non-furniture images (structured rejection with reasons).
    - API failures (retry guidance where appropriate).

## Future Enhancements

- **Persistent Evaluation Storage**
  - Store relevance judgments server-side with user/session identifiers.
  - Enable comparison of performance across time and configuration sets.
  - Support A/B testing of different ranking strategies.

- **Better Candidate Retrieval**
  - Use more informed MongoDB filters driven by structured JSON intent from the LLM (e.g., category, price range, size).
  - Potentially layer in vector indices (e.g., external vector DB) if database schema could be extended.
  - Implement approximate nearest neighbor search for faster embedding-based retrieval.

- **Re-ranking with an LLM**
  - After initial relevance scoring, send the top-N product summaries and the image+query to a model for **pairwise or list-wise re-ranking**.
  - Use cross-encoder models for more accurate relevance scoring.

- **UI Improvements**
  - Thumbnail gallery of search history with filtering.
  - Side-by-side comparison of configuration A vs. configuration B (A/B testing UI).
  - Visual score breakdown charts.
  - Export evaluation data as CSV/JSON.

- **Error Handling & Resilience**
  - More explicit UI states for:
    - Unrecognized images.
    - Timeouts / rate limits from AI providers.
    - Partial failures (e.g., missing embeddings).
  - Automatic retry with exponential backoff.
  - Graceful degradation when embeddings fail.

- **Performance Optimizations**
  - Implement vector database (e.g., Pinecone, Weaviate) for faster similarity search.
  - Cache product embeddings in a persistent store (Redis, file system).
  - Parallelize embedding generation for multiple products.
  - Implement request queuing for rate limit management.

- **Advanced Features**
  - Multi-image search (upload multiple images to find similar items).
  - Image-to-image similarity (compare uploaded image directly with product images if available).
  - Filter by multiple categories, price ranges, dimensions.
  - Save favorite searches and results.
  - Share search results via URL.