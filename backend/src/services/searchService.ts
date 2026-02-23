import type { SearchConfig, SearchRequestBody, ScoredProduct } from "../types";
import { fetchAllProducts } from "./mongoClient";
import { createAIProviderClient, type AIProvider } from "./aiProvider";
import {
  cosineSimilarity,
  createQueryEmbedding,
  getProductEmbeddings,
} from "./embeddingCache";

const defaultConfig: SearchConfig = {
  maxCandidates: 200,
  topK: 20,
  minScore: 0.35, // Lowered to be more permissive for general furniture matching
  imageWeight: 0.5,
  textWeight: 0.3,
  priceProximityWeight: 0.2,
};

export interface PerformSearchInput {
  visionApiKey: string;
  embeddingApiKey?: string;
  imageBase64: string;
  queryText: string | undefined;
  config: Partial<SearchConfig> | undefined;
}

interface FurnitureAnalysis {
  isFurniture: boolean;
  category?: string;
  type?: string;
  description: string;
}

export async function performSearch(
  input: PerformSearchInput
): Promise<{ results: ScoredProduct[]; debug: any; isFurniture: boolean }> {
  const { imageBase64, queryText, config: userConfig, visionApiKey, embeddingApiKey } = input;
  const config: SearchConfig = { ...defaultConfig, ...userConfig };

  const provider = (config.aiProvider || "openai") as AIProvider;
  const visionModel = config.aiModel || (provider === "openai" ? "gpt-4o" : provider === "anthropic" ? "claude-3-5-sonnet-20241022" : "gemini-1.5-pro");

  // Use embedding provider if specified, otherwise use vision provider
  let embeddingProvider = (config.embeddingProvider || provider) as AIProvider;
  let embeddingModel = config.embeddingModel || (embeddingProvider === "openai" ? "text-embedding-3-small" : embeddingProvider === "google" ? "text-embedding-004" : "text-embedding-3-small");

  // For embeddings, default to OpenAI if Anthropic is used for vision (Anthropic doesn't have embeddings)
  if (embeddingProvider === "anthropic") {
    embeddingProvider = "openai";
    embeddingModel = embeddingModel || "text-embedding-3-small";
  }
  
  // Determine embedding API key: use provided embedding key, or fallback to vision key for same provider
  let finalEmbeddingApiKey = embeddingApiKey;
  if (!finalEmbeddingApiKey) {
    if (embeddingProvider === provider) {
      finalEmbeddingApiKey = visionApiKey;
    } else if (embeddingProvider === "openai" && provider === "anthropic") {
      // Anthropic doesn't support embeddings, use OpenAI key if available
      finalEmbeddingApiKey = visionApiKey; // This should be OpenAI key when provider is anthropic
    }
  }
  
  if (!finalEmbeddingApiKey) {
    throw new Error(`Missing API key for embedding provider: ${embeddingProvider}. Please provide an embedding API key.`);
  }

  let visionClient;
  try {
    visionClient = createAIProviderClient({
      provider,
      apiKey: visionApiKey,
      visionModel,
    });
  } catch (err: any) {
    throw new Error(`Failed to initialize ${provider} client: ${err.message}`);
  }

  // Enhanced furniture analysis with structured output
  const analysisPrompt = `Analyze this image and provide a structured analysis.

First, determine if this is furniture (chairs, tables, sofas, desks, cabinets, shelves, beds, benches, stools, etc.).

If it IS furniture, respond in this EXACT format:
FURNITURE
Category: [seating/tables/storage/beds/lighting/etc]
Type: [specific type like bench, chair, sofa, desk, table, cabinet, etc]
Description: [detailed description of materials, color, style, dimensions]

If it is NOT furniture, respond:
NOT_FURNITURE: [brief reason]

Be precise with category and type - these are critical for matching.`;

  let analysisResponse;
  try {
    analysisResponse = await visionClient.analyzeImage(
      imageBase64,
      analysisPrompt,
      undefined,
      visionModel
    );
  } catch (err: any) {
    if (err.message?.includes("Invalid") && err.message?.includes("API key")) {
      throw new Error(`Invalid ${provider} API key. Please check your API key and try again.`);
    }
    if (err.message?.includes("rate limit")) {
      throw new Error(`${provider} API rate limit exceeded. Please wait a moment and try again.`);
    }
    if (err.message?.includes("image")) {
      throw new Error("Invalid image format. Please upload a valid image file.");
    }
    throw err;
  }

  const analysisContent = analysisResponse.content.trim();
  const isFurniture = analysisContent.startsWith("FURNITURE");
  
  if (!isFurniture) {
    return {
      results: [],
      debug: {
        visionDescription: analysisContent,
        combinedQueryText: analysisContent,
        config,
        totalProducts: 0,
        considered: 0,
        priceFiltered: config.priceRangeEnabled,
        isFurniture: false,
        rejectionReason: analysisContent.replace("NOT_FURNITURE:", "").trim(),
      },
      isFurniture: false,
    };
  }

  // Parse the structured analysis
  const analysis: FurnitureAnalysis = {
    isFurniture: true,
    description: analysisContent,
  };

  const categoryMatch = analysisContent.match(/Category:\s*([^\n]+)/i);
  const typeMatch = analysisContent.match(/Type:\s*([^\n]+)/i);
  const descMatch = analysisContent.match(/Description:\s*([\s\S]+)/i);

  if (categoryMatch && categoryMatch[1]) {
    analysis.category = categoryMatch[1].trim().toLowerCase();
  }
  if (typeMatch && typeMatch[1]) {
    analysis.type = typeMatch[1].trim().toLowerCase();
  }
  if (descMatch && descMatch[1]) {
    analysis.description = descMatch[1].trim();
  }

  // Get detailed vision description for embeddings
  const systemMessage =
    "You are an expert furniture analyst. Describe furniture items with extreme precision for product matching. " +
    "Focus on: exact category, specific type, materials, color, style, shape, dimensions, and usage context. " +
    "Be very specific - distinguish between similar types (e.g., bench vs chair vs stool, sofa).";

  const userTextForVision =
    `Provide a detailed description of this furniture item for precise product matching. Include: category, exact type, materials, color, style, approximate dimensions, and any distinctive features.` +
    (queryText ? ` Additional user requirements: "${queryText}".` : "");

  let visionResponse;
  try {
    visionResponse = await visionClient.analyzeImage(
      imageBase64,
      userTextForVision,
      systemMessage,
      visionModel
    );
  } catch (err: any) {
    if (err.message?.includes("Invalid") && err.message?.includes("API key")) {
      throw new Error(`Invalid ${provider} API key. Please check your API key and try again.`);
    }
    if (err.message?.includes("rate limit")) {
      throw new Error(`${provider} API rate limit exceeded. Please wait a moment and try again.`);
    }
    throw err;
  }

  const visionDescription = visionResponse.content;

  // Build enhanced query text with explicit type/category
  const queryParts: string[] = [];
  if (analysis.type) queryParts.push(`furniture type: ${analysis.type}`);
  if (analysis.category) queryParts.push(`category: ${analysis.category}`);
  if (visionDescription) queryParts.push(visionDescription);
  if (queryText) queryParts.push(`user preferences: ${queryText}`);

  const combinedQueryText = queryParts.join(". ");

  let products = await fetchAllProducts();
  
  // Apply price range filter if enabled
  if (config.priceRangeEnabled && config.priceRangeMin !== undefined && config.priceRangeMax !== undefined) {
    products = products.filter(
      (p) => p.price >= config.priceRangeMin! && p.price <= config.priceRangeMax!
    );
  }

  const candidates = products.slice(0, config.maxCandidates);
  
  // Fetch embeddings
  const [queryEmbedding, productEmbeddings] = await Promise.all([
    createQueryEmbedding(combinedQueryText, embeddingProvider, finalEmbeddingApiKey, embeddingModel),
    getProductEmbeddings(candidates, embeddingProvider, finalEmbeddingApiKey, embeddingModel),
  ]);

  // Extract price from query if available
  const priceMatch = queryText?.match(/\$(\d+)/i) || queryText?.match(/(\d+)\s*dollars?/i);
  const targetPrice = priceMatch && priceMatch[1] ? parseFloat(priceMatch[1]) : null;

  const scored: ScoredProduct[] = candidates.map((product) => {
    const embedding = productEmbeddings.get(product._id);
    const semanticScore = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;

    // Enhanced lexical matching with type/category priority
    const productText = [product.title, product.category, product.type, product.description].join(" ").toLowerCase();
    const queryTextLower = combinedQueryText.toLowerCase();
    
    // Type match score (boost score but don't reject if no match)
    let typeMatchScore = 0;
    if (analysis.type) {
      const queryType = analysis.type.toLowerCase().trim();
      // Remove plural forms for matching
      const queryTypeSingular = queryType.replace(/s$/, "");
      
      // Check product type field
      const productType = product.type.toLowerCase().trim();
      const productTypeSingular = productType.replace(/s$/, "");
      
      // Check product title and description too (more flexible)
      const productTitle = product.title.toLowerCase();
      const productDesc = product.description.toLowerCase();
      
      // Exact match in type field
      if (productType === queryType || productTypeSingular === queryType || productType === queryTypeSingular) {
        typeMatchScore = 1.0;
      } 
      // Partial match in type field
      else if (productType.includes(queryType) || queryType.includes(productType) ||
               productType.includes(queryTypeSingular) || queryTypeSingular.includes(productType)) {
        typeMatchScore = 0.8;
      }
      // Check in title or description
      else if (productTitle.includes(queryType) || productTitle.includes(queryTypeSingular) ||
               productDesc.includes(queryType) || productDesc.includes(queryTypeSingular)) {
        typeMatchScore = 0.6;
      }
      // Check for similar/synonym types
      else {
        const similarTypes: Record<string, string[]> = {
          bench: ["bench", "stool", "seat", "ottoman"],
          chair: ["chair", "seat", "stool", "armchair", "recliner"],
          sofa: ["sofa", "couch", "loveseat", "settee", "divan"],
          desk: ["desk", "table", "workstation", "writing desk"],
          table: ["table", "desk", "counter", "dining table", "coffee table", "side table"],
          cabinet: ["cabinet", "cupboard", "wardrobe", "armoire"],
          shelf: ["shelf", "shelving", "bookcase", "bookshelf"],
          bed: ["bed", "mattress", "headboard"],
          dresser: ["dresser", "chest", "bureau", "drawer"],
          lamp: ["lamp", "light", "lighting"],
        };
        const similar = similarTypes[queryType] || similarTypes[queryTypeSingular] || [];
        if (similar.some(t => {
          const tSingular = t.replace(/s$/, "");
          return productType.includes(t) || productType.includes(tSingular) ||
                 productTitle.includes(t) || productTitle.includes(tSingular) ||
                 productDesc.includes(t) || productDesc.includes(tSingular);
        })) {
          typeMatchScore = 0.4;
        }
      }
    }

    // Category match score
    let categoryMatchScore = 0;
    if (analysis.category) {
      const productCategory = product.category.toLowerCase();
      const queryCategory = analysis.category.toLowerCase();
      
      if (productCategory === queryCategory) {
        categoryMatchScore = 1.0;
      } else if (productCategory.includes(queryCategory) || queryCategory.includes(productCategory)) {
        categoryMatchScore = 0.7;
      }
    }

    // Lexical overlap score
    const lexicalScore = computeLexicalScore(queryTextLower, productText);

    // Price proximity score
    let priceScore = 0;
    if (config.priceProximityWeight && config.priceProximityWeight > 0) {
      if (targetPrice !== null) {
        const priceDiff = Math.abs(product.price - targetPrice);
        const maxPrice = Math.max(product.price, targetPrice);
        priceScore = maxPrice > 0 ? 1 - Math.min(priceDiff / maxPrice, 1) : 0;
      } else {
        const avgPrice = products.reduce((sum, p) => sum + p.price, 0) / products.length;
        const priceDiff = Math.abs(product.price - avgPrice);
        priceScore = avgPrice > 0 ? 1 - Math.min(priceDiff / avgPrice, 0.5) : 0.5;
      }
    }

    // Weighted scoring - prioritize semantic similarity (primary signal)
    const imageWeight = config.imageWeight ?? defaultConfig.imageWeight!;
    const textWeight = config.textWeight ?? defaultConfig.textWeight!;
    const priceWeight = config.priceProximityWeight ?? (defaultConfig.priceProximityWeight ?? 0);
    
    // Type and category matches provide boost but don't dominate
    // Reduced weight to 25% to allow semantic similarity to be primary
    const typeCategoryWeight = 0.25;
    const typeCategoryScore = (typeMatchScore * 0.6 + categoryMatchScore * 0.4);
    
    // Final score: semantic similarity is primary, type/category provides boost, lexical and price are secondary
    const score = 
      imageWeight * semanticScore +
      typeCategoryWeight * typeCategoryScore +
      textWeight * lexicalScore +
      priceWeight * priceScore;

    const explanationParts = [
      `typeMatch=${typeMatchScore.toFixed(2)}`,
      `categoryMatch=${categoryMatchScore.toFixed(2)}`,
      `semantic=${semanticScore.toFixed(3)}`,
      `lexical=${lexicalScore.toFixed(3)}`,
    ];
    if (priceWeight > 0) {
      explanationParts.push(`price=${priceScore.toFixed(3)}`);
    }

    return {
      product,
      score,
      explanation: explanationParts.join(", "),
    };
  });

  // Filter and sort
  const filtered = scored
    .filter((s) => s.score >= (config.minScore ?? 0.35))
    .sort((a, b) => b.score - a.score);

  // Return all results that pass the minScore threshold
  // The minScore is the primary quality gate - no additional strict filtering
  const finalResults = filtered.slice(0, config.topK);
  const topResult = finalResults[0];

  return {
    results: finalResults,
    debug: {
      visionDescription,
      analysis,
      combinedQueryText,
      config,
      totalProducts: products.length,
      considered: candidates.length,
      priceFiltered: config.priceRangeEnabled,
      isFurniture: true,
      topScore: topResult?.score ?? 0,
      resultsCount: finalResults.length,
    },
    isFurniture: true,
  };
}

function computeLexicalScore(query: string, text: string): number {
  const qTokens = tokenize(query);
  const tTokens = new Set(tokenize(text));
  if (qTokens.length === 0 || tTokens.size === 0) return 0;
  let overlap = 0;
  for (const t of qTokens) {
    if (tTokens.has(t)) overlap++;
  }
  return overlap / qTokens.length;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
