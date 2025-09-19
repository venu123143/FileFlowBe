// src/index.ts
import { serve, type ServeOptions, type TLSServeOptions } from "bun";
import { App } from "@/server";
import config from "@/config/config";

const port = config.PORT;
const app = new App();


const serverOptions: ServeOptions | TLSServeOptions = {
  fetch: app.getHandler(),
  port,
  ...(config.HTTP2.ENABLED && { http2: true }),
  ...(config.HTTP2.SSL.ENABLED && config.HTTP2.SSL.CERT_PATH && config.HTTP2.SSL.KEY_PATH
    ? {
      tls: {
        cert: Bun.file(config.HTTP2.SSL.CERT_PATH),
        key: Bun.file(config.HTTP2.SSL.KEY_PATH),
      },
    }
    : {}),
};

serve(serverOptions);

const protocol = config.HTTP2.ENABLED ? (config.HTTP2.SSL.ENABLED ? 'https' : 'http') : 'http';
console.log(`🚀 Hono server is running on ${protocol}://localhost:${port}`);

// if (config.HTTP2.ENABLED) {
//   console.log(`📡 HTTP/2 is ${config.HTTP2.SSL.ENABLED ? 'enabled with SSL/TLS' : 'enabled'}`);
// }
