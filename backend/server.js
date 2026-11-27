import { MongoClient } from 'mongodb';
import { createApp } from './app.js';
import { isIP } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
const { MONGODB_URI, FRONTEND_URL, DB_NAME = 'unidad4', PORT = '3000', NODE_ENV } = process.env;
if (!MONGODB_URI || !FRONTEND_URL) throw new Error('Configura MONGODB_URI y FRONTEND_URL');
if (NODE_ENV === 'production' && !FRONTEND_URL.startsWith('https://')) throw new Error('Producción requiere un origen HTTPS');
const port = Number(PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido');
const client = new MongoClient(MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 5000 });
const db = client.db(DB_NAME);
const app = createApp({ db, origin: FRONTEND_URL });
const server = app.listen(port, '::', () => console.log(JSON.stringify({ event:'listening', port, version:'1.0.1' })));
let stopping = false;
async function shutdown() {
  stopping = true;
  const timer = setTimeout(() => process.exit(1), 10000); timer.unref();
  server.close(async () => { await client.close(); clearTimeout(timer); process.exit(0); });
}
process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
// Diagnóstico opcional: solo registra la IP pública del servidor, nunca credenciales.
if (process.env.LOG_EGRESS_IP === 'true') {
  try {
    const ip = (await (await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(5000) })).text()).trim();
    if (isIP(ip) === 4) console.log(JSON.stringify({ event:'egress_ip', ip }));
  } catch { console.warn(JSON.stringify({ event:'egress_ip_unavailable' })); }
}
// /health mantiene 503 mientras MongoDB no responde; el proceso puede recuperarse.
while (!stopping) {
  try {
    await client.connect();
    await db.command({ ping: 1 });
    console.log(JSON.stringify({ event:'database_ready' }));
    break;
  } catch (error) {
    console.error(JSON.stringify({ event:'database_wait', type: error.name, code:'CHECK_CONFIGURATION_AND_DATABASE' }));
    await delay(10000);
  }
}
