// Vite outputs the framework request handler; Bun serves it and the static client assets.
import { resolve, sep } from 'node:path';

const clientRoot = resolve('dist/client');
const serverModule = resolve('dist/server/server.js');
const { default: handler } = await import(serverModule);
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.PORT || 3000),
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const path = resolve(clientRoot, `.${pathname}`);
    if (path.startsWith(clientRoot + sep)) {
      const file = Bun.file(path);
      if (await file.exists()) return new Response(file);
    }
    return handler.fetch(request);
  },
});
console.log(`Life OS: ${server.url}`);
