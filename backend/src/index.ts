import express from "express";
import cors from "cors";
import { json } from "express";
import { searchRouter } from "./routes/search";
import { config } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/search", searchRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

