import { MongoClient } from 'mongodb';
import { createApp } from './app.js';
const { MONGODB_URI, FRONTEND_URL, DB_NAME = 'unidad4', PORT = '3000', NODE_ENV } = process.env;
if (!MONGODB_URI || !FRONTEND_URL) throw new Error('Configura MONGODB_URI y FRONTEND_URL');
if (NODE_ENV === 'production' && !FRONTEND_URL.startsWith('https://')) throw new Error('Producción requiere un origen HTTPS');
const port = Number(PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido');
const client = new MongoClient(MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000, timeoutMS: 5000 });
try {
  await client.connect();
  const db = client.db(DB_NAME);
  await db.command({ ping: 1 });
  const app = createApp({ db, origin:FRONTEND_URL });
  const server = app.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event:'ready', port, version:'1.0.0' })));
  async function shutdown() {
    const timer = setTimeout(() => process.exit(1), 10000); timer.unref();
    server.close(async () => { await client.close(); clearTimeout(timer); process.exit(0); });
  }
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
} catch { console.error(JSON.stringify({ event:'startup_failed', code:'CHECK_CONFIGURATION_AND_DATABASE' })); await client.close(); process.exit(1); }
