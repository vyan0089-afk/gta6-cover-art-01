// Neon Coast Cover Studio — tiny static server for local testing only.
// Serves app/ at http://localhost:8080 with the right content types.
// Not part of the app itself; the app is plain static files.

import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(join(fileURLToPath(import.meta.url), '..', 'app'));
const port = Number(process.env.PORT || 8080);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  const target = normalize(join(appDir, urlPath === '/' ? 'index.html' : urlPath));
  if (!target.startsWith(appDir)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  const stream = createReadStream(target);
  stream.on('open', () => {
    res.writeHead(200, { 'content-type': mimeTypes[extname(target)] || 'application/octet-stream' });
    stream.pipe(res);
  });
  stream.on('error', () => {
    res.writeHead(404);
    res.end('not found');
  });
});

server.listen(port, () => {
  console.log(`Neon Coast Cover Studio at http://localhost:${port}`);
});
