import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { initDB } from "./server/db";
import apiRouter from "./server/routes";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize SQLite database
  try {
    initDB();
  } catch (err) {
    console.error("Database initialization failed:", err);
  }

  // Parse JSON payloads
  app.use(express.json());

  // API Routes
  app.use("/api", apiRouter);

  // Serve static assets & client routes
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development server with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting production server with static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mastering Studio AI is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
