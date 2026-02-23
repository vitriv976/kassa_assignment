export interface Product {
  _id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  price: number;
  width: number;
  height: number;
  depth: number;
}

export interface SearchConfig {
  maxCandidates: number | undefined;
  topK: number | undefined;
  minScore?: number | undefined;
  imageWeight: number | undefined;
  textWeight: number | undefined;
  priceProximityWeight?: number | undefined;
  priceRangeEnabled?: boolean | undefined;
  priceRangeMin?: number | undefined;
  priceRangeMax?: number | undefined;
  aiProvider?: string | undefined;
  aiModel?: string | undefined;
  embeddingProvider?: string | undefined;
  embeddingModel?: string | undefined;
}

export interface SearchRequestBody {
  imageBase64: string;
  queryText?: string;
  config?: Partial<SearchConfig>;
}

export interface ScoredProduct {
  product: Product;
  score: number;
  explanation?: string;
}
