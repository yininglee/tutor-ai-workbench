#!/usr/bin/env node
/**
 * 家教老师 AI 工作台 —— 本地服务
 * 零依赖，只用 Node 内置模块。职责：
 *  1) 托管静态页面
 *  2) 读写 data/workbench.json（数据唯一真相，方便打包 / 被外部 AI 读取写入）
 *  3) 代理大模型请求（避免浏览器 CORS，Key 只存在本机 data/secrets.json）
 *  4) 保存上传的原始 PDF 文件
 */
import http from 'node:http';
import fsp from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const STATE_FILE = path.join(DATA_DIR, 'workbench.json');
const SECRET_FILE = path.join(DATA_DIR, 'secrets.json');
const START_PORT = Number(process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
};

await fsp.mkdir(FILES_DIR, { recursive: true });

/* ---------- 小工具 ---------- */
const json = (res, code, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
};

async function readJSON(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJSON(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

function readBody(req, limit = 60 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJSONBody(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new Error('BAD_JSON');
  }
}

/* ---------- 状态读写 ---------- */
async function loadStateFile() {
  const d = await readJSON(STATE_FILE, null);
  if (!d || typeof d !== 'object' || !('rev' in d)) {
    return { rev: 0, updatedAt: null, state: null };
  }
  return d;
}

async function aiMeta() {
  const s = await readJSON(SECRET_FILE, {});
  return {
    hasKey: Boolean(s.apiKey),
    baseUrl: s.baseUrl || 'https://api.deepseek.com/v1',
    model: s.model || 'deepseek-chat',
    keyHint: s.apiKey ? `••••${String(s.apiKey).slice(-4)}` : '',
  };
}

/* ---------- 静态资源 ---------- */
async function serveStatic(res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const abs = path.join(ROOT, decodeURIComponent(rel));
  if (!abs.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const st = await fsp.stat(abs);
    if (st.isDirectory()) return serveStatic(res, path.posix.join(rel, 'index.html'));
    const ext = path.extname(abs).toLowerCase();
    // vendor 里的第三方库不常变，长缓存；自己写的页面与脚本一律不缓存，改完刷新即生效
    const isVendor = abs.includes(`${path.sep}vendor${path.sep}`);
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': isVendor ? 'public, max-age=604800, immutable' : 'no-store, no-cache, must-revalidate',
      pragma: isVendor ? 'public' : 'no-cache',
    });
    createReadStream(abs).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404 Not Found');
  }
}

async function serveDataFile(res, name) {
  const abs = path.join(FILES_DIR, path.basename(name));
  try {
    const st = await fsp.stat(abs);
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'public, max-age=600',
      'content-disposition': `inline; filename="${encodeURIComponent(path.basename(abs))}"`,
    });
    createReadStream(abs).pipe(res);
  } catch {
    res.writeHead(404).end('404');
  }
}

/* ---------- API ---------- */
async function handleApi(req, res, url) {
  const p = url.pathname;

  // 读取状态
  if (p === '/api/state' && req.method === 'GET') {
    const f = await loadStateFile();
    return json(res, 200, {
      rev: f.rev,
      updatedAt: f.updatedAt,
      state: f.state,
      ai: await aiMeta(),
    });
  }

  // 保存状态（乐观锁：rev 不一致返回 409）
  if (p === '/api/state' && req.method === 'PUT') {
    const body = await readJSONBody(req);
    const f = await loadStateFile();
    if (Number(body.rev) !== f.rev) {
      return json(res, 409, { conflict: true, rev: f.rev, updatedAt: f.updatedAt, state: f.state });
    }
    const next = {
      rev: f.rev + 1,
      updatedAt: new Date().toISOString(),
      state: body.state,
    };
    await writeJSON(STATE_FILE, next);
    return json(res, 200, { rev: next.rev, updatedAt: next.updatedAt });
  }

  // 保存 AI 配置
  if (p === '/api/ai/config' && req.method === 'POST') {
    const body = await readJSONBody(req);
    const s = await readJSON(SECRET_FILE, {});
    if (typeof body.baseUrl === 'string' && body.baseUrl.trim()) s.baseUrl = body.baseUrl.trim();
    if (typeof body.model === 'string' && body.model.trim()) s.model = body.model.trim();
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) s.apiKey = body.apiKey.trim();
    if (body.clearKey) delete s.apiKey;
    await writeJSON(SECRET_FILE, s);
    return json(res, 200, { ok: true, ai: await aiMeta() });
  }

  // 大模型代理
  if (p === '/api/ai/chat' && req.method === 'POST') {
    const body = await readJSONBody(req);
    const s = await readJSON(SECRET_FILE, {});
    const baseUrl = String(body.baseUrl || s.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    const key = s.apiKey || '';
    if (!key) return json(res, 400, { error: 'NO_KEY', message: '尚未在本机配置 API Key' });
    try {
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: body.model || s.model || 'deepseek-chat',
          messages: body.messages,
          temperature: typeof body.temperature === 'number' ? body.temperature : 0.6,
          stream: false,
        }),
        signal: AbortSignal.timeout(300000),
      });
      const text = await r.text();
      if (!r.ok) {
        return json(res, 502, { error: 'UPSTREAM', status: r.status, message: text.slice(0, 800) });
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return json(res, 502, { error: 'UPSTREAM_PARSE', message: text.slice(0, 500) });
      }
      const content = data?.choices?.[0]?.message?.content ?? '';
      return json(res, 200, { content, usage: data?.usage || null, model: data?.model || body.model });
    } catch (e) {
      return json(res, 502, { error: 'NETWORK', message: String(e?.message || e) });
    }
  }

  // 上传原始文件
  if (p === '/api/file' && req.method === 'POST') {
    const name = url.searchParams.get('name') || 'file';
    const buf = await readBody(req, 200 * 1024 * 1024);
    const safe = name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_').slice(-120);
    const fn = `${crypto.randomBytes(5).toString('hex')}-${safe}`;
    await fsp.writeFile(path.join(FILES_DIR, fn), buf);
    return json(res, 200, { file: fn, url: `/files/${fn}`, size: buf.length });
  }

  // 删除原始文件
  if (p.startsWith('/api/file/') && req.method === 'DELETE') {
    const name = path.basename(p.slice('/api/file/'.length));
    try {
      await fsp.unlink(path.join(FILES_DIR, name));
    } catch {}
    return json(res, 200, { ok: true });
  }

  // 在访达中打开数据目录
  if (p === '/api/open-data' && req.method === 'POST') {
    if (process.platform === 'darwin') spawn('open', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'win32') spawn('explorer', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [DATA_DIR], { detached: true, stdio: 'ignore' }).unref();
    return json(res, 200, { ok: true, dir: DATA_DIR });
  }

  // 健康检查
  if (p === '/api/ping') return json(res, 200, { ok: true, root: ROOT });

  return json(res, 404, { error: 'NOT_FOUND' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (url.pathname.startsWith('/files/')) return await serveDataFile(res, url.pathname);
    return await serveStatic(res, url.pathname);
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: 'SERVER', message: String(e?.message || e) });
    else res.end();
  }
});

/* ---------- 启动（端口占用自动顺延） ---------- */
function listen(port, tries = 0) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries < 12) return listen(port + 1, tries + 1);
    console.error('启动失败：', e.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log('');
    console.log('  \x1b[32m▍家教老师 AI 工作台\x1b[0m  已启动');
    console.log(`  地址：${url}`);
    console.log(`  数据：${DATA_DIR}`);
    console.log('  关闭本窗口即停止服务（数据已实时保存）');
    console.log('');
    if (!process.env.NO_OPEN && process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  });
}
listen(START_PORT);
