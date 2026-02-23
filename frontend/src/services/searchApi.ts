import type { SearchConfig } from "../state/SearchConfigContext";
import type { ApiKeys } from "../state/ApiKeysContext";

interface SearchRequest {
  backendUrl: string;
  apiKeys: ApiKeys;
  imageBase64: string;
  queryText?: string;
  config: SearchConfig;
}

export const searchApi = {
  async search(req: SearchRequest): Promise<any> {
    const provider = req.config.aiProvider || "openai";
    
    // Build headers with appropriate API keys
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add provider-specific API key
    if (provider === "openai" && req.apiKeys.openai) {
      headers["x-openai-api-key"] = req.apiKeys.openai;
    } else if (provider === "anthropic" && req.apiKeys.anthropic) {
      headers["x-anthropic-api-key"] = req.apiKeys.anthropic;
    } else if (provider === "google" && req.apiKeys.google) {
      headers["x-google-api-key"] = req.apiKeys.google;
    }

    // Add embedding API key if provided (or use OpenAI key for Anthropic)
    if (req.apiKeys.embedding) {
      headers["x-embedding-api-key"] = req.apiKeys.embedding;
    } else if (provider === "anthropic" && req.apiKeys.openai) {
      headers["x-openai-api-key"] = req.apiKeys.openai; // Use OpenAI for embeddings when using Anthropic
    }

    const response = await fetch(`${req.backendUrl}/api/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageBase64: req.imageBase64,
        queryText: req.queryText,
        config: {
          maxCandidates: req.config.maxCandidates,
          topK: req.config.topK,
          minScore: req.config.minScore,
          imageWeight: req.config.imageWeight,
          textWeight: req.config.textWeight,
          priceProximityWeight: req.config.priceProximityWeight,
          priceRangeEnabled: req.config.priceRangeEnabled,
          priceRangeMin: req.config.priceRangeMin,
          priceRangeMax: req.config.priceRangeMax,
          aiProvider: req.config.aiProvider,
          aiModel: req.config.aiModel,
          embeddingProvider: req.config.embeddingProvider,
          embeddingModel: req.config.embeddingModel,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.error?.message ?? "Search request failed");
    }

    return response.json();
  },
};
