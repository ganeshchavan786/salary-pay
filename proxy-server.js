/**
 * proxy-server.js
 * Node.js reverse proxy for zrok deployment.
 *
 * Routing rules:
 *   /api/*    → http://localhost:8551  (FastAPI backend)
 *   /docs     → http://localhost:8551  (FastAPI Swagger UI)
 *   /redoc    → http://localhost:8551  (FastAPI ReDoc)
 *   /openapi* → http://localhost:8551  (FastAPI OpenAPI schema)
 *   /health   → http://localhost:8551  (Health check)
 *   /admin/*  → static dist/admin-panel (built files)
 *   /*        → http://localhost:5173  (PWA Vite dev server)
 */

const http = require('http')
const https = require('https')
const httpProxy = require('http-proxy')
const fs = require('fs')
const path = require('path')

const PORT = 8080
const ADMIN_DIST = path.join(__dirname, 'admin-panel', 'dist')
const PWA_DIST = path.join(__dirname, 'pwa-app', 'dist')

const TARGETS = {
  api:   'http://localhost:8551',
  pwa:   'http://localhost:5173',
  admin: 'http://localhost:3551',
}

// MIME types for static files
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
}

function serveStatic(req, res, urlPath, distPath) {
  // Strip prefix to get file path within dist
  let filePath = urlPath
  if (urlPath.startsWith('/admin')) {
    filePath = urlPath.replace(/^\/admin/, '') || '/'
  }
  if (urlPath.startsWith('/face')) {
    filePath = urlPath.replace(/^\/face/, '') || '/'
  }
  if (filePath === '/' || filePath === '') filePath = '/index.html'

  // For SPA: if file not found, serve index.html
  let fullPath = path.join(distPath, filePath)
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    fullPath = path.join(distPath, 'index.html')
  }

  const ext = path.extname(fullPath)
  const contentType = MIME[ext] || 'application/octet-stream'

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
}

function resolveTarget(reqUrl) {
  if (reqUrl.startsWith('/api/') || reqUrl === '/api') return TARGETS.api
  if (reqUrl === '/docs' || reqUrl.startsWith('/docs/') ||
      reqUrl === '/redoc' || reqUrl.startsWith('/redoc/') ||
      reqUrl.startsWith('/openapi') || reqUrl === '/health') return TARGETS.api
  return TARGETS.pwa
}

function resolveHost(target) {
  if (target === TARGETS.api)   return 'localhost:8551'
  if (target === TARGETS.admin) return 'localhost:3551'
  return 'localhost:5173'
}

const proxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true })

proxy.on('error', (err, req, res) => {
  console.error(`[proxy] Error: ${req.method} ${req.url} — ${err.message}`)
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'upstream unavailable' }))
  }
})

// No-cache headers for /api/* — prevents Service Worker from caching API responses
proxy.on('proxyRes', (proxyRes, req) => {
  if (req.url && (req.url.startsWith('/api/') || req.url === '/api')) {
    proxyRes.headers['cache-control'] = 'no-store, no-cache, must-revalidate'
    proxyRes.headers['pragma'] = 'no-cache'
    proxyRes.headers['expires'] = '0'
  }
})

const server = http.createServer((req, res) => {
  const reqUrl = req.url || '/'

  // /admin → /admin/ redirect
  if (reqUrl === '/admin') {
    res.writeHead(301, { Location: '/admin/' })
    res.end()
    return
  }

  // /face → /face/ redirect
  if (reqUrl === '/face') {
    res.writeHead(301, { Location: '/face/' })
    res.end()
    return
  }

  // Root URL / -> Serve landing.html
  if (reqUrl === '/') {
    const landingPath = path.join(__dirname, 'landing.html')
    if (fs.existsSync(landingPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(fs.readFileSync(landingPath))
      return
    }
  }

  // /admin/* → proxy to admin dev server (port 3551) if dist not built, else serve static
  if (reqUrl.startsWith('/admin/') || reqUrl === '/admin/') {
    if (fs.existsSync(ADMIN_DIST)) {
      serveStatic(req, res, reqUrl, ADMIN_DIST)
    } else {
      // Dev mode: proxy to Vite dev server (keep /admin/ prefix, Vite base is /admin/)
      req.headers['x-forwarded-for'] = req.socket.remoteAddress || 'unknown'
      req.headers['host'] = 'localhost:3551'
      proxy.web(req, res, { target: TARGETS.admin })
    }
    return
  }

  // API / docs / health → ALWAYS proxy to backend (production & dev mode dono madhe)
  if (reqUrl.startsWith('/api/') || reqUrl === '/api' ||
      reqUrl === '/docs' || reqUrl.startsWith('/docs/') ||
      reqUrl === '/redoc' || reqUrl.startsWith('/redoc/') ||
      reqUrl.startsWith('/openapi') || reqUrl === '/health') {
    req.headers['x-forwarded-for'] = req.socket.remoteAddress || 'unknown'
    req.headers['host'] = 'localhost:8551'
    proxy.web(req, res, { target: TARGETS.api })
    return
  }

  // PWA routes (/face/*) → serve static if built, else proxy to dev server
  if (reqUrl.startsWith('/face/') || reqUrl === '/face/') {
    if (fs.existsSync(PWA_DIST)) {
      serveStatic(req, res, reqUrl, PWA_DIST)
    } else {
      // Dev mode: proxy to Vite dev server
      req.headers['x-forwarded-for'] = req.socket.remoteAddress || 'unknown'
      req.headers['host'] = 'localhost:5173'
      proxy.web(req, res, { target: TARGETS.pwa })
    }
    return
  }

  // Fallback for any other unmatched routes
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not Found')
})

server.on('upgrade', (req, socket, head) => {
  const reqUrl = req.url || '/'
  if (reqUrl.startsWith('/admin/') || reqUrl === '/admin/') {
    req.headers['host'] = 'localhost:3551'
    proxy.ws(req, socket, head, { target: TARGETS.admin }, (err) => {
      if (err) { console.error('[proxy] WS error (admin):', err.message); socket.destroy() }
    })
    return
  }
  const target = resolveTarget(reqUrl)
  req.headers['host'] = resolveHost(target)
  proxy.ws(req, socket, head, { target }, (err) => {
    if (err) { console.error('[proxy] WS error:', err.message); socket.destroy() }
  })
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[proxy] Port ${PORT} already in use.`)
    process.exit(1)
  }
  throw err
})

server.listen(PORT, () => {
  console.log(`\n✅ Proxy running on http://localhost:${PORT}`)
  console.log(`   /api/*   → ${TARGETS.api}`)
  if (fs.existsSync(ADMIN_DIST)) {
    console.log(`   /admin/* → ${ADMIN_DIST} (static build)`)
  } else {
    console.log(`   /admin/* → ${TARGETS.admin} (dev server proxy)`)
  }
  if (fs.existsSync(PWA_DIST)) {
    console.log(`   /*       → ${PWA_DIST} (static build)`)
  } else {
    console.log(`   /*       → ${TARGETS.pwa} (dev server proxy)`)
  }
  console.log(`\n   PWA dist exists: ${fs.existsSync(PWA_DIST)}`)
  console.log(`   Admin dist exists: ${fs.existsSync(ADMIN_DIST)}`)
})

module.exports = { resolveTarget }
