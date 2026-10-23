import http from 'node:http';
import httpProxy from 'http-proxy';

const PORT = Number(process.env.GATEWAY_PORT || 5201);
const MIDDLE = 'http://127.0.0.1:5202';
const AGENT = 'http://127.0.0.1:5203';
const OCTOP_API = 'http://127.0.0.1:8088';
const CONSOLE_API = 'http://127.0.0.1:3100';

const proxy = httpProxy.createProxyServer({ ws: true, xfwd: true });

function pathOf(url) {
  return (url || '/').split('?')[0];
}

function targetOf(url) {
  const path = pathOf(url);
  if (path.startsWith('/middle/api/') || path === '/middle/api') {
    return { target: CONSOLE_API, name: 'dev:api :3100', rewrite: (u) => u.replace(/^\/middle\/api/, '/api') };
  }
  if (path.startsWith('/agent')) return { target: AGENT, name: 'dev:agent :5203' };
  if (path.startsWith('/api') || path.startsWith('/socket.io')) {
    return { target: OCTOP_API, name: 'dev:octop :8088' };
  }
  return { target: MIDDLE, name: 'dev:web :5202' };
}

proxy.on('error', (err, req, res) => {
  const url = req?.url || '';
  const hit = targetOf(url);
  const where = hit?.name || 'unknown';
  console.error(`[gateway] ${url} → ${where}  ${err.message}`);
  if (res && !res.headersSent && 'writeHead' in res) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`502  ${where} 没起来或挂了\n${err.message}\n`);
  }
});

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const path = pathOf(url);
  if (path === '/') {
    res.writeHead(302, { Location: '/agent/chat' });
    res.end();
    return;
  }
  if (path === '/middle/login' || path.startsWith('/middle/login/')) {
    const qs = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    res.writeHead(302, { Location: `/login${qs}` });
    res.end();
    return;
  }
  const hit = targetOf(url);
  if (hit.rewrite) req.url = hit.rewrite(url);
  proxy.web(req, res, { target: hit.target });
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/';
  const hit = targetOf(url);
  if (hit.rewrite) req.url = hit.rewrite(url);
  proxy.ws(req, socket, head, { target: hit.target });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway  http://127.0.0.1:${PORT}   ← 浏览器只开这个`);
  console.log(`  /login  → 统一登录`);
  console.log(`  /middle → 中台`);
  console.log(`  /agent  → 智能体`);
});
