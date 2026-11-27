// Vista previa local con base temporal y datos ficticios; no se utiliza en producción.
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { createApp } from '../backend/app.js';
const mongo=await MongoMemoryServer.create({binary:{version:'7.0.24'}});
const client=await new MongoClient(mongo.getUri()).connect();
const db=client.db('preview');
await db.collection('tasks').insertMany([
 {title:'Configurar las variables de entorno',completed:true,createdAt:new Date()},
 {title:'Verificar el respaldo de la base de datos',completed:false,createdAt:new Date()},
 {title:'Registrar las evidencias del despliegue',completed:false,createdAt:new Date()}
]);
await db.collection('tasks').createIndex({createdAt:-1,_id:-1});
const app=express();app.use(express.static('dist'));app.use(createApp({db,origin:'http://localhost:3000'}));
const server=app.listen(3000,'127.0.0.1',()=>console.log('Local: http://localhost:3000'));
async function stop(){server.closeAllConnections();await new Promise(r=>server.close(r));await client.close();await mongo.stop();process.exit(0);}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
