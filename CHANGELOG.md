# Changelog

All notable changes to this project are documented in this file.

## Unreleased

### Added

- Initial implementation of **image-based furniture search** system.

  - **Backend (`backend`)**:
    - Scaffolding of a Node.js + TypeScript Express API with health check endpoint.
    - `/api/search` endpoint with comprehensive request validation using Zod.
    - MongoDB integration with a read-only connection to the `catalog.products` collection.
    - Connection pooling and efficient product fetching from MongoDB.
    - **Multi-provider AI support**:
      - Abstracted AI provider interface (`aiProvider.ts`) supporting OpenAI, Anthropic (Claude), and Google (Gemini).
      - Vision-based furniture analysis using configurable models (default: `gpt-4o`).
      - Structured output: Two-stage analysis that first determines if image is furniture, then extracts category, type, and description.
      - Text embeddings using configurable models (default: `text-embedding-3-small`).
      - Automatic fallback to OpenAI embeddings when using Anthropic for vision (Anthropic doesn't support embeddings).
    - In-memory product embedding cache to avoid recomputation during the server lifetime.
    - Batched embedding generation (100 products per batch) to optimize API usage and handle rate limits.
    - **Retrieval and ranking pipeline**:
      - Build a combined text query from the vision description + optional user prompt.
      - Fetch products from MongoDB (with optional price range filtering).
      - Compute cosine similarity between query and product embeddings.
      - Enhanced lexical matching with type/category priority scoring:
        - Exact and partial type matching with synonym handling (bench/chair/sofa, desk/table, etc.).
        - Category matching with fuzzy matching.
        - Type/category boost signal (25% weight) to ensure basic relevance.
      - Price proximity scoring (optional, configurable weight).
      - Multi-signal weighted scoring combining:
        - Semantic similarity (embeddings) - primary signal
        - Type/category matching - boost signal
        - Lexical overlap - secondary signal
        - Price proximity - optional signal
      - Combine signals with configurable `imageWeight`, `textWeight`, and `priceProximityWeight` (normalized to sum to 100%).
      - Filter by configurable `minScore` and return top `topK` results.
    - Comprehensive error handling:
      - Clear error messages for invalid API keys, rate limits, and API failures.
      - Graceful handling of non-furniture images with structured rejection reasons.
      - Provider-specific error messages for better debugging.
    - Centralized error handling middleware.

  - **Frontend (`frontend`)**:
    - Vite-based React + TypeScript single-page app with a modern, responsive layout.
    - Tabbed navigation between **Search**, **Admin**, and **Evaluation** views.
    - **Search page**:
      - Multi-provider API key management (OpenAI, Anthropic, Google, and separate embedding key).
      - API keys stored in memory only, never persisted to disk.
      - Image upload with drag-and-drop support and live preview.
      - Optional free-text refinement input.
      - Display of ranked product matches with price, dimensions, and relevance scores.
      - Detailed scoring breakdown showing type match, category match, semantic, lexical, and price scores.
      - Controls to mark each result as **Relevant** or **Not relevant**.
      - Search history with ability to view past searches and results.
      - Toast notifications for search results and errors.
      - Graceful handling of non-furniture images with clear feedback and rejection reasons.
      - Loading states with skeleton placeholders.
    - **Admin page**:
      - Internal configuration for:
        - Vision model provider and model selection (OpenAI, Anthropic, Google).
        - Embedding model provider and model selection (OpenAI, Google; Anthropic not supported).
        - `maxCandidates`, `topK`, `minScore`
        - `imageWeight`, `textWeight`, `priceProximityWeight` (with normalization to 100%).
        - `priceRangeEnabled`, `priceRangeMin`, `priceRangeMax`
        - `backendUrl`
      - Real-time weight normalization with validation and auto-normalization button.
      - Provider-specific model lists.
      - Clear indicators for provider limitations (e.g., Anthropic doesn't support embeddings).
      - Helps tune recall vs. latency and the balance of image vs. text signals without code changes.
    - **Evaluation page**:
      - Three-tab interface: Overview, Details, Insights.
      - **Overview tab**:
        - Key metrics: Total evaluated, Relevant, Not relevant, Overall precision.
        - Precision@K metrics (Precision@1, Precision@3, Precision@5, Precision@10).
        - Score analysis: Average scores for relevant vs. not relevant products.
        - Category breakdown: Performance by furniture category with visual progress bars.
      - **Details tab**:
        - Complete table of all relevance judgments with product IDs, scores, ranks, and timestamps.
        - Deduplication by product ID (keeps latest judgment).
      - **Insights tab**:
        - Automated recommendations based on evaluation data.
        - Alerts for low precision, score ranking issues, and top result quality.
        - Actionable suggestions for improving search quality.
      - Aggregates manual relevance labels into precision metrics.
    - **State management**:
      - `SearchConfigContext`: Manages search configuration across tabs.
      - `EvaluationContext`: Stores relevance judgments in memory.
      - `SearchHistoryContext`: Maintains search history with results and metadata.
      - `ApiKeysContext`: Manages API keys in memory (never persisted).
    - Modern UI components:
      - Reusable UI component library (buttons, cards, inputs, sliders, switches, tabs, badges, etc.).
      - Toast notification system.
      - Responsive design with mobile support.
      - Gradient backgrounds and modern styling.

### Changed

- **Code optimization and cleanup**:
  - Removed outdated code comments and fixed TypeScript type issues.
  - Improved API key handling in search route with better validation.
  - Enhanced embedding API key fallback logic for multi-provider scenarios.
  - Cleaned up embedding cache implementation.

- **Documentation**:
  - Updated README.md with comprehensive implementation details.
  - Documented multi-provider support, scoring algorithm, and evaluation strategy.
  - Added detailed architecture explanations and design choices.

### Notes on Prompts and Instructions

- The implementation was driven by the original assignment prompt:
  - Focus on **relevance quality** of matches over just "returning some results".
  - Use a **frontier model provider** (OpenAI, Anthropic, or Google) with the **user's API key** supplied at runtime.
  - Keep the MongoDB catalog **read-only** and respect existing indexes.
  - Expose an **admin configuration surface** for retrieval and ranking meta-parameters.
  - Include a **lightweight evaluation mechanism** and document the approach.
- Additional internal prompts (to the coding agent) emphasized:
  - Clean, modular project structure (separation of concerns between API, services, and UI).
  - KISS and DRY: one main search pipeline with shared utilities for embeddings and scoring.
  - A simple, high-signal UI focusing on the search and tuning workflows rather than visual gimmicks.
  - Multi-provider support with abstracted interfaces for flexibility.

### Technical Decisions

- **Furniture Detection**: Two-stage vision analysis - first determines if image is furniture, then extracts structured attributes. This prevents wasting API calls on non-furniture images and provides clear feedback to users.

- **Scoring Strategy**: Multi-signal approach combining:
  - **Semantic similarity via embeddings** (configurable weight, typically 50-60%) - primary signal for robust matching
  - **Type/category matching** (25% weight) - ensures basic relevance and handles synonyms
  - **Lexical overlap** (configurable weight, typically 25-30%) - cheap, transparent textual signal
  - **Price proximity** (optional, configurable weight, typically 15-20%) - helps match user budget preferences
  - Weights are normalized to sum to 100% to ensure consistent scoring.

- **Multi-Provider Architecture**:
  - Abstracted `AIProviderClient` interface allows switching providers without changing core logic.
  - Provider-specific implementations handle API differences (e.g., Anthropic's message format vs OpenAI's chat format).
  - Automatic fallback to OpenAI embeddings when using Anthropic for vision.
  - Support for separate embedding providers (e.g., use Google for vision, OpenAI for embeddings).

- **Caching Strategy**: In-memory embedding cache per server instance. Tradeoff: cache is lost on restart but keeps database read-only and avoids schema changes. Future enhancement: persistent cache (Redis, file system).

- **Error Resilience**: All AI API calls wrapped in try-catch with specific error messages for common failure modes:
  - Invalid API keys
  - Rate limit errors
  - Invalid image formats
  - Network failures
  - Provider-specific error handling

- **Evaluation Approach**: Lightweight in-browser evaluation with:
  - Binary relevance labels (relevant/not relevant)
  - Precision@K metrics for ranking quality assessment
  - Score distribution analysis to understand ranking effectiveness
  - Category-level performance breakdown
  - Automated insights and recommendations

### Search Functionality Implementation Details

The search functionality is the core of the system and implements a sophisticated multi-stage pipeline:

1. **Image Analysis**: Uses vision models to extract structured furniture information (category, type, description) and validate that the image is actually furniture.

2. **Query Construction**: Combines vision-extracted information with optional user text to create a rich query for semantic matching.

3. **Embedding Generation**: 
   - Generates embeddings for the query text.
   - Caches product embeddings in memory to avoid redundant API calls.
   - Batches embedding requests (100 products per batch) for efficiency.

4. **Scoring Algorithm**:
   - **Semantic Score**: Cosine similarity between query and product embeddings (primary signal).
   - **Type/Category Score**: Exact and partial matching with synonym handling (boost signal).
   - **Lexical Score**: Token overlap between query and product text (secondary signal).
   - **Price Score**: Proximity to target price or average price (optional signal).
   - Weighted combination with configurable weights.

5. **Ranking and Filtering**:
   - Filters results below `minScore` threshold.
   - Sorts by final weighted score (descending).
   - Returns top `topK` results.

The implementation prioritizes **match quality** over quantity, using multiple signals to ensure relevant results are ranked highly.
