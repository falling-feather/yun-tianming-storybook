import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const portIndex = process.argv.indexOf('--port');
const requestedPort = portIndex < 0 ? 0 : Number(process.argv[portIndex + 1]);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  throw new Error('--port 需要 0—65535 的整数');
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
  }
  let route;
  try { route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (route === '/') route = '/index.html';
  const allowed = ['/index.html', '/styles.css', '/app.mjs', '/model.mjs', '/art.mjs', '/motion.mjs', '/painting.mjs', '/rig.mjs'].includes(route)
    || route.startsWith('/assets/');
  const target = path.resolve(root, '.' + route);
  if (!allowed || !target.startsWith(root + path.sep)) {
    response.writeHead(404).end('Not found'); return;
  }
  try {
    const file = await stat(target);
    if (!file.isFile()) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream',
      'Content-Length': file.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end();
    else createReadStream(target).pipe(response);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') response.writeHead(404).end('Not found');
    else { console.error(error.message); response.writeHead(500).end('Read failed'); }
  }
});
server.listen(requestedPort, '127.0.0.1', () => {
  console.log(`Local: http://127.0.0.1:${server.address().port}`);
});
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
