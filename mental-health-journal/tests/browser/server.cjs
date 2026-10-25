const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
http
  .createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    fs.readFile(file, (error, content) => {
      response.writeHead(error ? 404 : 200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      });
      response.end(error ? 'Not found' : content);
    });
  })
  .listen(4173, '127.0.0.1');
