/**
 * AI Provider abstraction for multi-provider support
 * Supports OpenAI, Anthropic (Claude), and Google (Gemini)
 */

export type AIProvider = "openai" | "anthropic" | "google";

export interface VisionResponse {
  content: string;
}

export interface EmbeddingResponse {
  embedding: number[];
}

export interface AIProviderClient {
  /**
   * Analyze an image and return text description
   */
  analyzeImage(
    imageBase64: string,
    prompt: string,
    systemPrompt?: string,
    model?: string
  ): Promise<VisionResponse>;

  /**
   * Create embeddings for text(s)
   */
  createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse[]>;
}

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  visionModel?: string;
  embeddingModel?: string;
}

/**
 * Factory function to create an AI provider client
 */
export function createAIProviderClient(config: ProviderConfig): AIProviderClient {
  switch (config.provider) {
    case "openai":
      return createOpenAIProvider(config);
    case "anthropic":
      return createAnthropicProvider(config);
    case "google":
      return createGoogleProvider(config);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// OpenAI Provider Implementation
function createOpenAIProvider(config: ProviderConfig): AIProviderClient {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey: config.apiKey });

  return {
    async analyzeImage(
      imageBase64: string,
      prompt: string,
      systemPrompt?: string,
      model?: string
    ): Promise<VisionResponse> {
      const messages: any[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageBase64 },
          },
        ],
      });

      try {
        const response = await client.chat.completions.create({
          model: model || config.visionModel || "gpt-4o",
          messages,
          max_tokens: 500,
          temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content || "";
        return { content };
      } catch (err: any) {
        if (err.status === 401 || err.message?.includes("Invalid API key")) {
          throw new Error("Invalid OpenAI API key. Please check your API key and try again.");
        }
        if (err.status === 429 || err.message?.includes("rate limit")) {
          throw new Error("OpenAI API rate limit exceeded. Please wait a moment and try again.");
        }
        throw new Error(`OpenAI API error: ${err.message || "Unknown error"}`);
      }
    },

    async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse[]> {
      try {
        const response = await client.embeddings.create({
          model: model || config.embeddingModel || "text-embedding-3-small",
          input: texts,
        });

        return response.data.map((item: any) => ({
          embedding: item.embedding,
        }));
      } catch (err: any) {
        if (err.status === 401 || err.message?.includes("Invalid API key")) {
          throw new Error("Invalid OpenAI API key. Please check your API key and try again.");
        }
        if (err.status === 429 || err.message?.includes("rate limit")) {
          throw new Error("OpenAI API rate limit exceeded. Please wait a moment and try again.");
        }
        throw new Error(`OpenAI embeddings API error: ${err.message || "Unknown error"}`);
      }
    },
  };
}

// Anthropic Provider Implementation
function createAnthropicProvider(config: ProviderConfig): AIProviderClient {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: config.apiKey });

  return {
    async analyzeImage(
      imageBase64: string,
      prompt: string,
      systemPrompt?: string,
      model?: string
    ): Promise<VisionResponse> {
      // Extract base64 data (remove data:image/...;base64, prefix if present)
      const base64Data = imageBase64.includes(",") 
        ? imageBase64.split(",")[1] 
        : imageBase64;

      // Determine image type from data URL
      let mediaType = "image/jpeg";
      if (imageBase64.startsWith("data:image/png")) mediaType = "image/png";
      else if (imageBase64.startsWith("data:image/webp")) mediaType = "image/webp";
      else if (imageBase64.startsWith("data:image/gif")) mediaType = "image/gif";

      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\n${prompt}`
        : prompt;

      try {
        const response = await client.messages.create({
          model: model || config.visionModel || "claude-3-5-sonnet-20241022",
          max_tokens: 500,
          system: systemPrompt || "You are an expert furniture analyst.",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Data,
                  },
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
        });

        const content = response.content
          .filter((block: any) => block.type === "text")
          .map((block: any) => block.text)
          .join("\n");

        return { content };
      } catch (err: any) {
        if (err.status === 401 || err.message?.includes("invalid_api_key")) {
          throw new Error("Invalid Anthropic API key. Please check your API key and try again.");
        }
        if (err.status === 429 || err.message?.includes("rate_limit")) {
          throw new Error("Anthropic API rate limit exceeded. Please wait a moment and try again.");
        }
        throw new Error(`Anthropic API error: ${err.message || "Unknown error"}`);
      }
    },

    async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse[]> {
      // Anthropic doesn't have a native embeddings API, so we'll use their messages API
      // as a workaround, but this is not ideal. For production, consider using a separate
      // embeddings service or OpenAI for embeddings even when using Anthropic for vision.
      throw new Error(
        "Anthropic does not provide a native embeddings API. Please use OpenAI for embeddings or configure a different provider for embeddings."
      );
    },
  };
}

// Google Provider Implementation
function createGoogleProvider(config: ProviderConfig): AIProviderClient {
  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(config.apiKey);

  return {
    async analyzeImage(
      imageBase64: string,
      prompt: string,
      systemPrompt?: string,
      model?: string
    ): Promise<VisionResponse> {
      // Extract base64 data
      const base64Data = imageBase64.includes(",") 
        ? imageBase64.split(",")[1] 
        : imageBase64;

      // Determine image type
      let mimeType = "image/jpeg";
      if (imageBase64.startsWith("data:image/png")) mimeType = "image/png";
      else if (imageBase64.startsWith("data:image/webp")) mimeType = "image/webp";

      const fullPrompt = systemPrompt 
        ? `${systemPrompt}\n\n${prompt}`
        : prompt;

      try {
        const genModel = genAI.getGenerativeModel({ 
          model: model || config.visionModel || "gemini-1.5-pro" 
        });

        const result = await genModel.generateContent([
          fullPrompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ]);

        const response = await result.response;
        const content = response.text();

        return { content };
      } catch (err: any) {
        if (err.message?.includes("API_KEY_INVALID") || err.message?.includes("401")) {
          throw new Error("Invalid Google API key. Please check your API key and try again.");
        }
        if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
          throw new Error("Google API rate limit exceeded. Please wait a moment and try again.");
        }
        throw new Error(`Google API error: ${err.message || "Unknown error"}`);
      }
    },

    async createEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse[]> {
      try {
        const genModel = genAI.getGenerativeModel({ 
          model: model || config.embeddingModel || "text-embedding-004" 
        });

        // Google's embedding API works differently - we need to call it per text
        const embeddings: EmbeddingResponse[] = [];
        for (const text of texts) {
          const result = await genModel.embedContent(text);
          const embedding = result.embedding.values;
          embeddings.push({ embedding });
        }

        return embeddings;
      } catch (err: any) {
        if (err.message?.includes("API_KEY_INVALID") || err.message?.includes("401")) {
          throw new Error("Invalid Google API key. Please check your API key and try again.");
        }
        if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
          throw new Error("Google API rate limit exceeded. Please wait a moment and try again.");
        }
        throw new Error(`Google embeddings API error: ${err.message || "Unknown error"}`);
      }
    },
  };
}
