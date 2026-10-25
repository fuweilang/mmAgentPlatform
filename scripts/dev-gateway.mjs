import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import httpProxy from 'http-proxy';

const PORT = Number(process.env.GATEWAY_PORT || 5201);
const WEB = 'http://127.0.0.1:5202';
const AGENT = 'http://127.0.0.1:5203';
const OCTOP_API = 'http://127.0.0.1:8088';
const CONSOLE_API = 'http://127.0.0.1:3100';
const DOWNLOADS_DIR =
  process.env.MAMMOTH_DOWNLOADS_DIR ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../downloads');
const CLIENT_DOWNLOAD_REDIRECTS = {
  '/downloads/mammoth-agent.dmg': '/downloads/mammoth-agent-mac-arm64.dmg',
  '/downloads/mammoth-agent-x86_64.dmg': '/downloads/mammoth-agent-mac-x64.dmg',
  '/downloads/mammoth-agent.exe': '/downloads/mammoth-agent-win.exe',
};

const proxy = httpProxy.createProxyServer({ ws: true, xfwd: true });

function pathOf(url) {
  return (url || '/').split('?')[0];
}

function queryOf(url) {
  const i = (url || '').indexOf('?');
  return i >= 0 ? url.slice(i) : '';
}

function targetOf(url) {
  const path = pathOf(url);
  if (path === '/admin/api' || path.startsWith('/admin/api/')) {
    return {
      target: CONSOLE_API,
      name: 'dev:api :3100',
      rewrite: (u) => u.replace(/^\/admin\/api/, '/api/admin'),
    };
  }
  if (
    path.startsWith('/console/api/') ||
    path === '/console/api' ||
    path.startsWith('/middle/api/') ||
    path === '/middle/api'
  ) {
    const apiPrefix = path.startsWith('/middle') ? '/middle/api' : '/console/api';
    return {
      target: CONSOLE_API,
      name: 'dev:api :3100',
      apiPrefix,
      rewrite: (u) => u.replace(/^\/(console|middle)\/api/, '/api'),
    };
  }
  if (path.startsWith('/agent')) return { target: AGENT, name: 'dev:agent :5203' };
  if (path.startsWith('/api') || path.startsWith('/socket.io')) {
    return { target: OCTOP_API, name: 'dev:octop :8088' };
  }
  return { target: WEB, name: 'dev:web :5202' };
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

function serveClientDownload(res, pathname) {
  const redirect = CLIENT_DOWNLOAD_REDIRECTS[pathname];
  if (redirect) {
    res.writeHead(302, { Location: redirect });
    res.end();
    return true;
  }
  if (!pathname.startsWith('/downloads/mammoth-agent')) return false;
  const name = path.basename(pathname);
  if (!/^mammoth-agent[\w.-]+$/.test(name)) {
    res.writeHead(404);
    res.end();
    return true;
  }
  const file = path.join(DOWNLOADS_DIR, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404  没有安装包 ${name}\n把 Octop 桌面端放到 ${DOWNLOADS_DIR}/\n`);
    return true;
  }
  const stat = fs.statSync(file);
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${name}"`,
    'Content-Length': stat.size,
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

function applyProxy(req, hit) {
  if (hit.apiPrefix) {
    req.headers['x-mammoth-public-api'] = hit.apiPrefix;
  }
  if (hit.rewrite) req.url = hit.rewrite(req.url || '/');
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const path = pathOf(url);
  const qs = queryOf(url);
  if (path === '/') {
    res.writeHead(302, { Location: '/agent/chat' });
    res.end();
    return;
  }
  if (
    path === '/middle/login' ||
    path.startsWith('/middle/login/') ||
    path === '/console/login' ||
    path.startsWith('/console/login/')
  ) {
    res.writeHead(302, { Location: `/login${qs}` });
    res.end();
    return;
  }
  if (
    (path === '/middle' || path === '/middle/' || path.startsWith('/middle/')) &&
    !path.startsWith('/middle/api')
  ) {
    const rest = path === '/middle' || path === '/middle/' ? '/' : path.slice('/middle'.length);
    res.writeHead(302, { Location: `/console${rest}${qs}` });
    res.end();
    return;
  }
  if (serveClientDownload(res, path)) return;
  const hit = targetOf(url);
  applyProxy(req, hit);
  proxy.web(req, res, { target: hit.target });
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/';
  const hit = targetOf(url);
  applyProxy(req, hit);
  proxy.ws(req, socket, head, { target: hit.target });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway  http://127.0.0.1:${PORT}   ← 浏览器只开这个`);
  console.log(`  /login    → 统一登录`);
  console.log(`  /console  → 企业控制台`);
  console.log(`  /admin    → 猛犸总后台`);
  console.log(`  /agent    → 智能体`);
});
