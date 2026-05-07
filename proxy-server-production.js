/**
 * PROXY-SERVER-PRODUCTION.JS
 * Professional production proxy for HRMS.
 */
const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

const PORT = 3401;
const ADMIN_DIST = path.join(__dirname, '..', 'public', 'admin');
const EMP_DIST = path.join(__dirname, '..', 'public', 'employee');
const FACE_DIST = path.join(__dirname, '..', 'public', 'face');
const TARGETS = { api: 'http://localhost:8401' };

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

function serveStatic(req, res, url, dist) {
  let file = url;
  if (url.startsWith('/admin')) file = url.replace('/admin', '');
  else if (url.startsWith('/employee')) file = url.replace('/employee', '');
  else if (url.startsWith('/face')) file = url.replace('/face', '');

  if (file === '/' || file === '' || file.endsWith('/')) {
    file = '/index.html';
  }

  let full = path.join(dist, file);
  
  // SPA Fallback: If file doesn't exist, serve index.html
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    full = path.join(dist, 'index.html');
  }

  const ext = path.extname(full);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  fs.createReadStream(full).pipe(res);
}

const proxy = httpProxy.createProxyServer({ changeOrigin: true });

// Handle proxy errors (e.g. backend down)
proxy.on('error', (err, req, res) => {
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Backend is starting or unavailable. Please refresh in a moment.');
  }
});

const server = http.createServer((req, res) => {
  // Landing Page at Root (Handles ?query params too)
  const pathname = req.url.split('?')[0];
  if (pathname === '/' || pathname === '/index.html') {
    const landingPath = path.join(__dirname, 'landing.html');
    if (fs.existsSync(landingPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return fs.createReadStream(landingPath).pipe(res);
    }
  }

  // Redirects
  if (req.url === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (req.url === '/employee') { res.writeHead(301, { Location: '/employee/' }); return res.end(); }
  if (req.url === '/face') { res.writeHead(301, { Location: '/face/' }); return res.end(); }

  // Static files
  if (req.url.startsWith('/admin/')) return serveStatic(req, res, req.url, ADMIN_DIST);
  if (req.url.startsWith('/employee/')) return serveStatic(req, res, req.url, EMP_DIST);
  if (req.url.startsWith('/face/')) return serveStatic(req, res, req.url, FACE_DIST);

  // API Proxy
  if (req.url.startsWith('/api/') || req.url === '/health') {
    return proxy.web(req, res, { target: TARGETS.api });
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('✅ HRMS Professional Web Server running on http://localhost:' + PORT);
});
