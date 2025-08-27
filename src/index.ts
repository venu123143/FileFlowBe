// src/index.ts
import { serve } from "bun";
import { App } from "@/server";
import config from "@/config/config";

const port = config.PORT
const app = new App();

serve({
  fetch: app.getHandler(),
  port,
});

console.log(`🚀 Hono server is running on http://localhost:${port}`);
