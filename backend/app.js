import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';

export function createApp({ db, origin, logger = console.log, limit = 120 }) {
  if (!origin || new URL(origin).origin !== origin) throw new Error('FRONTEND_URL debe ser un origen sin ruta ni barra final');
  const app = express(), collection = db.collection('tasks');
  app.disable('x-powered-by');
  // Railway termina TLS en el proxy; se confía únicamente en el salto inmediato.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.use((req, res, next) => {
    const start = performance.now(), requestId = randomUUID();
    res.set('X-Request-Id', requestId);
    res.on('finish', () => logger(JSON.stringify({ event: 'http', requestId, method: req.method, route: req.route?.path || 'unmatched', status: res.statusCode, durationMs: +(performance.now() - start).toFixed(2) })));
    next();
  });
  app.get('/health', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await db.command({ ping: 1 }, { timeoutMS: 3000 }); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });
  app.use((req, res, next) => {
    if (req.headers.origin && req.headers.origin !== origin) return res.status(403).json({ error: 'Origen no permitido' });
    next();
  });
  app.use(cors({ origin, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type'], maxAge: 600 }));
  app.use('/api', rateLimit({ windowMs: 60000, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas solicitudes. Reintenta en un minuto.' } }));
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', (_req, res, next) => { res.set('Cache-Control','no-store'); next(); });
  app.param('id', (req, res, next, id) => {
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'Identificador inválido' });
    req.taskId = new ObjectId(id); next();
  });
  app.get('/api/tasks', async (_req, res) => {
    const items = await collection.find({}, { projection: { title:1,completed:1,createdAt:1 } }).sort({ createdAt: -1, _id: -1 }).limit(100).toArray();
    res.json({ items });
  });
  app.post('/api/tasks', async (req, res) => {
    const title = req.body?.title;
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) return res.status(400).json({ error:'El título debe contener entre 1 y 120 caracteres.' });
    const item = { title: title.trim(), completed: false, createdAt: new Date() };
    const result = await collection.insertOne(item);
    res.status(201).json({ ...item, _id: result.insertedId });
  });
  app.patch('/api/tasks/:id', async (req, res) => {
    if (typeof req.body?.completed !== 'boolean' || Object.keys(req.body).some(k => k !== 'completed')) return res.status(400).json({ error: 'Solo se admite completed de tipo booleano.' });
    const item = await collection.findOneAndUpdate({ _id:req.taskId }, { $set:{ completed:req.body.completed } }, { returnDocument:'after' });
    if (!item) return res.status(404).json({ error:'Tarea no encontrada' });
    res.json(item);
  });
  app.delete('/api/tasks/:id', async (req, res) => {
    const result = await collection.deleteOne({ _id:req.taskId });
    if (!result.deletedCount) return res.status(404).json({ error:'Tarea no encontrada' });
    res.status(204).end();
  });
  app.use((_req,res) => res.status(404).json({ error:'Ruta no encontrada' }));
  app.use((err, _req, res, _next) => {
    const status = err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 500) logger(JSON.stringify({ event:'internal_error', code:'REQUEST_FAILED' }));
    res.status(status).json({ error:status === 413 ? 'Contenido demasiado grande' : status === 400 ? 'JSON inválido' : 'Servicio temporalmente no disponible' });
  });
  return app;
}
