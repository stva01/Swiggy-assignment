import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  const BACKEND_URL = (
    process.env.BACKEND_URL ||
    process.env.VITE_API_URL ||
    "https://post-offer-backend.onrender.com"
  ).replace(/\/$/, "");

  // Reverse proxy /api to FastAPI backend
  app.use("/api", async (req, res) => {
    try {
      const targetUrl = `${BACKEND_URL}/api${req.url}`;
      const headers: Record<string, string> = {};
      for (const [key, val] of Object.entries(req.headers)) {
        if (val && typeof val === "string" && key.toLowerCase() !== "host") {
          headers[key] = val;
        }
      }

      const options: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        }
        if (chunks.length > 0) {
          options.body = Buffer.concat(chunks);
        }
      }

      const backendResponse = await fetch(targetUrl, options);
      res.status(backendResponse.status);
      backendResponse.headers.forEach((value, name) => {
        res.setHeader(name, value);
      });

      const responseBuffer = Buffer.from(await backendResponse.arrayBuffer());
      res.send(responseBuffer);
    } catch (error) {
      console.error(`Proxy error forwarding ${req.method} ${req.url} to ${BACKEND_URL}:`, error);
      res.status(502).json({ code: "bad_gateway", message: "Failed to communicate with backend." });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all non-api routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/ (Proxying /api to ${BACKEND_URL})`);
  });
}

startServer().catch(console.error);
