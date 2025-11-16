// server-noupgrade-mux.ts
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT  = Number(process.env.PORT) || 18080;
const TOKEN = process.env.TOKEN || 'supersecret';

const wssControl = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const wssData    = new WebSocketServer({ noServer: true, perMessageDeflate: false });

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200).end('ok'); return; }
  // それ以外のHTTPは応答しない（意図しないHTTP混入を防ぐ）
});

function auth(url?: string) {
  if (!url) return false;
  const u = new URL(url, 'http://x');
  return u.searchParams.get('token') === TOKEN;
}

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  // console.log('[upgrade]', url, req.headers['sec-websocket-extensions'] || '(none)');
  if (url.startsWith('/control')) {
    if (!auth(url)) { socket.destroy(); return; }
    wssControl.handleUpgrade(req, socket, head, (ws) => {
      wssControl.emit('connection', ws, req);
    });
    return;
  }
  if (url.startsWith('/data')) {
    if (!auth(url)) { socket.destroy(); return; }
    wssData.handleUpgrade(req, socket, head, (ws) => {
      wssData.emit('connection', ws, req);
    });
    return;
  }
  socket.destroy();
});

wssControl.on('connection', (ws, req) => {
  console.log('[control] connected');
  ws.on('close', (code, reason) => {
    console.log('[control] closed', code, reason.toString());
  });
  ws.on('error', (e) => console.error('[control] error', e));
});

wssData.on('connection', (ws, req) => {
  console.log('[data] connected');
  ws.on('close', (code, reason) => {
    console.log('[data] closed', code, reason.toString());
  });
  ws.on('error', (e) => console.error('[data] error', e));
});

server.listen(PORT, () => console.log('listening on :' + PORT));
