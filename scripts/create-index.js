// Ejecutar una vez con un usuario de mantenimiento; nunca usarlo en la aplicación.
import { MongoClient } from 'mongodb';
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS:5000 });
try { await client.connect(); await client.db(process.env.DB_NAME || 'unidad4').collection('tasks').createIndex({createdAt:-1,_id:-1}); console.log('Índice creado'); } finally { await client.close(); }
