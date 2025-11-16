// src/server.ts
import http, { IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';

const PORT  = Number(process.env.PORT) || 8080;
const TOKEN = process.env.TOKEN || 'supersecret';

type HeartbeatWS = WebSocket & { isAlive?: boolean };
type ControlMessage =
  | { type:'close'; id:string }
  | { type:'open'; id:string; method:string; path:string;
      headers:Record<string, string | string[] | undefined>; body:string };
type DataMessage =
  | { type:'response'; status?:number; headers?:Record<string, string | string[] | undefined>; body?:string };

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200).end('ok'); return; }
  // それ以外のHTTPには応答しない（HTTP混入防止）
});

function auth(url?: string) {
  if (!url) return false;
  const u = new URL(url, 'http://x');
  return u.searchParams.get('token') === TOKEN;
}

// noServer で /control /data を手動upgrade
const wssControl = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 64*1024*1024 });
const wssData    = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 64*1024*1024 });

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  // console.log('[upgrade]', url, req.headers['sec-websocket-extensions'] || '(none)');
  if (url.startsWith('/control')) {
    if (!auth(url)) return socket.destroy();
    wssControl.handleUpgrade(req, socket, head, (ws) => wssControl.emit('connection', ws, req));
    return;
  }
  if (url.startsWith('/data')) {
    if (!auth(url)) return socket.destroy();
    wssData.handleUpgrade(req, socket, head, (ws) => wssData.emit('connection', ws, req));
    return;
  }
  socket.destroy();
});

// コントロール接続を 1本保持
let controlWS: WebSocket | null = null;

// /data 到着待ちを id ごとに待ち合わせ
const pendingData = new Map<string, (ws: WebSocket) => void>();

// 心拍
function hb(ws: HeartbeatWS) {
  ws.isAlive = true; ws.on('pong', () => (ws.isAlive = true));
}
setInterval(() => {
  for (const ws of wssControl.clients) {
    const x = ws as HeartbeatWS; if (x.isAlive === false) x.terminate(); x.isAlive = false; x.ping();
  }
  for (const ws of wssData.clients) {
    const x = ws as HeartbeatWS; if (x.isAlive === false) x.terminate(); x.isAlive = false; x.ping();
  }
}, 25_000);

wssControl.on('connection', (ws, req) => {
  console.log('[control] connected');
  hb(ws as HeartbeatWS);
  controlWS = ws;
  ws.on('close', () => { if (controlWS === ws) controlWS = null; console.log('[control] closed'); });
  ws.on('error', (e) => console.error('[control] error', e));
  ws.on('message', (buf) => {
    try {
      const m = JSON.parse(buf.toString()) as ControlMessage;
      if (m.type === 'close') {
        const resolve = pendingData.get(m.id);
        if (resolve) pendingData.delete(m.id);
      }
    } catch {}
  });
});

wssData.on('connection', (ws, req) => {
  hb(ws as HeartbeatWS);
  const u = new URL(req.url || '/', 'http://x');
  const id = u.searchParams.get('id') || '';
  const resolve = pendingData.get(id);
  if (!resolve) { ws.close(); return; }
  pendingData.delete(id);
  resolve(ws);
});

// 公開HTTP → control に “open” を投げ、対応する /data が来たら応答を書き戻す
server.on('request', (req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health') return;
  if (!controlWS || controlWS.readyState !== WebSocket.OPEN) {
    res.writeHead(502).end('no client'); return;
  }
  const id = crypto.randomUUID();

  let body = Buffer.alloc(0);
  req.on('data', (c: Buffer) => { body = Buffer.concat([body, c]); });
  req.on('end', () => {
    const headers = Object.fromEntries(Object.entries(req.headers));
    const msg: ControlMessage = {
      type: 'open',
      id,
      method: req.method || 'GET',
      path: req.url || '/',
      headers,
      body: body.toString('base64'),
    };
    controlWS!.send(JSON.stringify(msg));
  });

  // このHTTPに対応する /data を待つ
  const timeout = setTimeout(() => {
    pendingData.delete(id);
    res.writeHead(504).end('timeout');
  }, 30_000);

  pendingData.set(id, (dws: WebSocket) => {
    clearTimeout(timeout);
    dws.on('message', (buf: Buffer) => {
      try {
        const m = JSON.parse(buf.toString()) as DataMessage;
        if (m.type === 'response') {
          res.writeHead(m.status ?? 200, m.headers ?? {});
          if (m.body) res.write(Buffer.from(m.body, 'base64'));
          res.end();
          dws.close();
        }
      } catch {}
    });
    dws.on('close', () => void 0);
    dws.on('error', () => { try { res.writeHead(502).end('bad gateway'); } catch {} });
  });
});

server.listen(PORT, () => console.log('listening on :' + PORT));
