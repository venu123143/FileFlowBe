
import { App } from "@/server";
import config from "@/config/config";

// Create your app instance
const app = new App();
const socketEngine = app.getSocketEngine();
const port = config.PORT || 3000;

// Start Bun server99o
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
  // Conditionally add HTTP2 support
  ...(config.HTTP2.ENABLED && { http2: true }),
  // Conditionally add TLS configuration for HTTP2
  ...(config.HTTP2.SSL.ENABLED && config.HTTP2.SSL.CERT_PATH && config.HTTP2.SSL.KEY_PATH
    ? {
      tls: {
        cert: Bun.file(config.HTTP2.SSL.CERT_PATH),
        key: Bun.file(config.HTTP2.SSL.KEY_PATH),
      },
    }
    : {}),
});

console.log(`🚀 Server running on http${config.HTTP2.SSL.ENABLED ? "s" : ""}://localhost:${port}`);
