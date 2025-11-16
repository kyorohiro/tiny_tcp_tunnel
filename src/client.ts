// src/client.ts
import { WebSocket } from 'undici';
import http from 'node:http';
import https from 'node:https';

const SERVER = process.env.SERVER ?? 'ws://localhost:8080'; // ← ws:// or wss:// を渡す
const TOKEN  = process.env.TOKEN  ?? 'supersecret';
const TARGET = process.env.TARGET ?? 'http://127.0.0.1:5001';

type ControlOpenMessage = {
  type: 'open';
  id: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string; // base64
};

function pickHttp(url: URL) {
  return url.protocol === 'https:' ? https : http;
}
function backoff(attempt: number) {
  const base = Math.min(20_000, 500 * 2 ** attempt);
  return base * (0.5 + Math.random());
}

function start() {
  let attempt = 0;
  const controlUrl = `${SERVER.replace(/\/$/, '')}/control?token=${encodeURIComponent(TOKEN)}`;
  const ws = new WebSocket(controlUrl);

  const ping = setInterval(() => {
    // undiciは標準のpingが無いので、軽い“NOOP”メッセージ（必要なら）
    try { ws.readyState === ws.OPEN && ws.send('~'); } catch {}
  }, 25_000);

  ws.addEventListener('open', () => {
    attempt = 0;
    console.log('control connected (undici)');
  });

  ws.addEventListener('message', async (ev) => {
    if (typeof ev.data !== 'string') return;
    let msg: any;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type !== 'open') return;
    const { id, path, method, headers, body } = msg as ControlOpenMessage;

    // /data を開く（undici）
    const dataUrl = `${SERVER.replace(/\/$/, '')}/data?token=${encodeURIComponent(TOKEN)}&id=${encodeURIComponent(id)}`;
    const dws = new WebSocket(dataUrl);

    dws.addEventListener('open', () => {
      // ローカルHTTPへフォワード
      const t = new URL(TARGET + path);
      const client = pickHttp(t);
      const req = client.request(t, { method: method ?? 'GET', headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const payload = JSON.stringify({
            type: 'response',
            status: res.statusCode ?? 200,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('base64'),
          });
          dws.send(payload);
          dws.close();
        });
      });
      if (body) { try { req.write(Buffer.from(body, 'base64')); } catch {} }
      req.on('error', () => { try { dws.close(); } catch {} });
      req.end();
    });

    dws.addEventListener('error', () => { /* サーバ側で504に落とすので握り */ });
  });

  ws.addEventListener('error', (ev) => {
    console.error('[control] error (undici):', (ev as any).error ?? ev);
  });

  ws.addEventListener('close', () => {
    clearInterval(ping);
    const t = backoff(attempt++);
    setTimeout(start, t);
  });
}

start();
