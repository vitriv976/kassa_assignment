import { Router } from "express";
import { z } from "zod";
import { performSearch } from "../services/searchService";

const searchSchema = z.object({
  imageBase64: z.string().min(1, "Image is required"),
  queryText: z.string().optional(),
  config: z
    .object({
      maxCandidates: z.number().int().min(10).max(500).optional(),
      topK: z.number().int().min(1).max(50).optional(),
      minScore: z.number().min(0).max(1).optional(),
      imageWeight: z.number().min(0).max(1).optional(),
      textWeight: z.number().min(0).max(1).optional(),
      priceProximityWeight: z.number().min(0).max(1).optional(),
      priceRangeEnabled: z.boolean().optional(),
      priceRangeMin: z.number().min(0).optional(),
      priceRangeMax: z.number().min(0).optional(),
      aiProvider: z.string().optional(),
      aiModel: z.string().optional(),
      embeddingProvider: z.string().optional(),
      embeddingModel: z.string().optional(),
    })
    .optional(),
});

export const searchRouter = Router();

searchRouter.post("/", async (req, res, next) => {
  try {
    const provider = (req.body.config?.aiProvider || "openai") as string;
    
    // Get API keys based on provider
    let visionApiKey: string | undefined;
    let embeddingApiKey: string | undefined;

    if (provider === "openai") {
      visionApiKey = req.header("x-openai-api-key");
      embeddingApiKey = req.header("x-embedding-api-key") || visionApiKey;
    } else if (provider === "anthropic") {
      visionApiKey = req.header("x-anthropic-api-key");
      // Anthropic doesn't have embeddings, so use OpenAI for embeddings
      embeddingApiKey = req.header("x-embedding-api-key") || req.header("x-openai-api-key");
    } else if (provider === "google") {
      visionApiKey = req.header("x-google-api-key");
      embeddingApiKey = req.header("x-embedding-api-key") || visionApiKey;
    }

    if (!visionApiKey) {
      return res.status(400).json({ 
        error: { 
          message: `Missing ${provider} API key. Please provide x-${provider}-api-key header.` 
        } 
      });
    }

    // If using Anthropic for vision, require OpenAI key for embeddings
    if (provider === "anthropic" && !embeddingApiKey) {
      return res.status(400).json({ 
        error: { 
          message: "Anthropic doesn't support embeddings. Please provide x-openai-api-key or x-embedding-api-key for embeddings." 
        } 
      });
    }

    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: "Invalid request", details: parsed.error.flatten() } });
    }

    const { imageBase64, queryText, config } = parsed.data;
    
    // Ensure embeddingApiKey is provided when needed
    if (!embeddingApiKey && provider !== "anthropic") {
      embeddingApiKey = visionApiKey; // Default to vision key for same provider
    }
    
    // At this point, embeddingApiKey should be defined (validated above)
    if (!embeddingApiKey) {
      return res.status(400).json({
        error: {
          message: "Missing embedding API key. Please provide x-embedding-api-key or x-openai-api-key header.",
        },
      });
    }
    
    const results = await performSearch({
      imageBase64,
      queryText: queryText ?? undefined,
      config: config ?? undefined,
      visionApiKey,
      embeddingApiKey,
    });

    res.json(results);
  } catch (err) {
    next(err);
  }
});
