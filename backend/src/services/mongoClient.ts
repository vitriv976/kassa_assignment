import { MongoClient } from "mongodb";
import { config } from "../config/env";
import type { Product } from "../types";

let client: MongoClient | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (client && (client as any).topology?.isConnected()) {
    return client;
  }

  client = new MongoClient(config.mongoUri);
  await client.connect();
  return client;
}

export async function fetchAllProducts(): Promise<Product[]> {
  const mongo = await getMongoClient();
  const docs = await mongo
    .db("catalog")
    .collection("products")
    .find({})
    .toArray();

  return docs.map((doc: any) => ({
    _id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    category: doc.category,
    type: doc.type,
    price: doc.price,
    width: doc.width,
    height: doc.height,
    depth: doc.depth,
  }));
}

