import type { Product } from "../types";
import { createAIProviderClient, type AIProvider } from "./aiProvider";

type EmbeddingVector = number[];

const productEmbeddingCache = new Map<string, EmbeddingVector>();

export async function getProductEmbeddings(
  products: Product[],
  provider: AIProvider,
  apiKey: string,
  model?: string
): Promise<Map<string, EmbeddingVector>> {
  const client = createAIProviderClient({
    provider,
    apiKey,
    ...(model ? { embeddingModel: model } : {}),
  });

  const missingProducts = products.filter(
    (p) => !productEmbeddingCache.has(p._id)
  );

  if (missingProducts.length > 0) {
    // Batch embeddings requests - OpenAI supports up to 2048 items per request
    // Process in batches of 100 to be safe and avoid rate limits
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < missingProducts.length; i += BATCH_SIZE) {
      const batch = missingProducts.slice(i, i + BATCH_SIZE);
      
      const texts = batch.map((p) =>
        [
          p.title,
          p.category,
          p.type,
          p.description,
        ]
          .filter(Boolean)
          .join(" | ")
      );

      // Filter out empty strings to avoid API errors
      const validTexts: string[] = [];
      const validIndices: number[] = [];
      texts.forEach((text, idx) => {
        if (text.trim().length > 0) {
          validTexts.push(text);
          validIndices.push(idx);
        }
      });

      if (validTexts.length === 0) continue;

      let embeddings;
      try {
        embeddings = await client.createEmbeddings(validTexts, model);
      } catch (err: any) {
        if (err.message?.includes("Invalid") && err.message?.includes("API key")) {
          throw new Error(`Invalid ${provider} API key. Please check your API key and try again.`);
        }
        if (err.message?.includes("rate limit")) {
          throw new Error(`${provider} API rate limit exceeded. Please wait a moment and try again.`);
        }
        throw err;
      }

      // Map responses back to products
      embeddings.forEach((item, responseIdx) => {
        const batchIdx = validIndices[responseIdx];
        if (batchIdx === undefined) return;
        const product = batch[batchIdx];
        if (product && item.embedding) {
          productEmbeddingCache.set(
            product._id,
            item.embedding as EmbeddingVector
          );
        }
      });
    }
  }

  return productEmbeddingCache;
}

export async function createQueryEmbedding(
  queryText: string,
  provider: AIProvider,
  apiKey: string,
  model?: string
): Promise<EmbeddingVector> {
  const client = createAIProviderClient(
    model
      ? { provider, apiKey, embeddingModel: model }
      : { provider, apiKey }
  );
  let embeddings;
  try {
    embeddings = await client.createEmbeddings([queryText], model);
  } catch (err: any) {
    if (err.message?.includes("Invalid") && err.message?.includes("API key")) {
      throw new Error(`Invalid ${provider} API key. Please check your API key and try again.`);
    }
    if (err.message?.includes("rate limit")) {
      throw new Error(`${provider} API rate limit exceeded. Please wait a moment and try again.`);
    }
    throw err;
  }
  const first = embeddings[0];
  if (!first || !first.embedding) {
    return [];
  }
  return first.embedding as EmbeddingVector;
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const lenA = a?.length ?? 0;
  const lenB = b?.length ?? 0;
  const minLength = Math.min(lenA, lenB);
  if (minLength === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < minLength; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

