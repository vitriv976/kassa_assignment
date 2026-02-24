const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error(
    "MONGODB_URI or MONGO_URI environment variable is required. Please set it in your .env file."
  );
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri,
};

