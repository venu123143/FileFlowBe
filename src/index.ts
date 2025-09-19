
import { App } from "@/server";
import config from "@/config/config";

// Create your app instance
const app = new App();
const socketEngine = app.getSocketEngine();
const port = config.PORT || 3000;

// Start Bun server
Bun.serve({
  port,
  idleTimeout: 30,
  websocket: socketEngine.handler().websocket, // <-- attach WebSocket handler
  async fetch(req, server) {
    const url = new URL(req.url);

    // Route Socket.IO traffic
    if (url.pathname.startsWith("/socket.io/")) {
      return socketEngine.handleRequest(req, server);
    }

    // Route normal HTTP traffic to Hono
    return app.getHandler()(req, server);
  },
});

console.log(`🚀 Server running on http://localhost:${port}`);
