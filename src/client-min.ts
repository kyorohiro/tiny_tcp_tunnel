// client-undici.ts
import { WebSocket } from 'undici';

const SERVER = process.env.SERVER ?? 'ws://localhost:8080';
const TOKEN  = process.env.TOKEN  ?? 'supersecret';

const url = `${SERVER.replace(/\/$/,'')}/control?token=${encodeURIComponent(TOKEN)}`;

const ws = new WebSocket(url, {
  // 仕様準拠のため permessage-deflate のON/OFF指定は不要。サーバ側が返さなければ無効。
});

ws.addEventListener('open', () => {
  console.log('control connected (undici)');
});

ws.addEventListener('message', (ev) => {
  console.log('control msg:', typeof ev.data === 'string' ? ev.data : '(binary)');
});

ws.addEventListener('error', (ev) => {
  console.error('[control] error (undici):', ev.error ?? ev);
});

ws.addEventListener('close', (ev) => {
  console.log('control closed', ev.code, ev.reason);
});
