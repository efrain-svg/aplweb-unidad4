import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { once } from 'node:events';
import { createApp } from '../backend/app.js';
import { encryptBackup, decryptBackup } from '../scripts/backup-crypto.js';
import { randomBytes } from 'node:crypto';
let mongo, client, db, server, base;
const origin = 'https://frontend.example';
const logs = [];
async function serve(app) { const s=app.listen(0,'127.0.0.1'); await once(s,'listening'); return s; }
async function close(s) { s.closeAllConnections(); await new Promise(r=>s.close(r)); }
async function request(path, method='GET', body, extra={}) {
 return fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...extra},body:body === undefined? undefined:JSON.stringify(body)});
}
before(async()=>{
 mongo=await MongoMemoryServer.create({binary:{version:'7.0.24'},instance:{dbName:'unidad4_test'}});
 client=await new MongoClient(mongo.getUri()).connect(); db=client.db('unidad4_test');
 await db.collection('tasks').createIndex({createdAt:-1,_id:-1});
 server=await serve(createApp({db,origin,logger:s=>logs.push(JSON.parse(s)),limit:10000}));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{if(server)await close(server);if(client)await client.close();if(mongo)await mongo.stop();});
test('01 health comprueba MongoDB y cabeceras de seguridad',async()=>{
 const r=await request('/health');assert.equal(r.status,200);assert.equal((await r.json()).status,'ok');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('cache-control'),'no-store');
});
test('02 CRUD y persistencia tras reiniciar la API',async()=>{
 let r=await request('/api/tasks','POST',{title:'  Evidencia de persistencia  '});assert.equal(r.status,201);const item=await r.json();assert.equal(item.title,'Evidencia de persistencia');
 await close(server);server=await serve(createApp({db,origin,logger:s=>logs.push(JSON.parse(s)),limit:10000}));base=`http://127.0.0.1:${server.address().port}`;
 r=await request('/api/tasks');assert.ok((await r.json()).items.some(t=>t._id===item._id));
 r=await request('/api/tasks/'+item._id,'PATCH',{completed:true});assert.equal((await r.json()).completed,true);
 r=await request('/api/tasks/'+item._id,'DELETE');assert.equal(r.status,204);
 r=await request('/api/tasks/'+item._id,'DELETE');assert.equal(r.status,404);
});
test('03 rechaza títulos inválidos e identificadores mal formados',async()=>{
 for(const title of ['', ' '.repeat(3),'a'.repeat(121),{$ne:null}]) assert.equal((await request('/api/tasks','POST',{title})).status,400);
 assert.equal((await request('/api/tasks/incorrecto','DELETE')).status,400);
});
test('04 CORS autoriza origen exacto y rechaza el ajeno',async()=>{
 const r=await request('/api/tasks','OPTIONS',undefined,{'Access-Control-Request-Method':'POST'});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
 const bad=await request('/api/tasks','GET',undefined,{Origin:'https://otro.example'});assert.equal(bad.status,403);assert.equal(bad.headers.get('access-control-allow-origin'),null);
});
test('05 JSON incorrecto y cuerpo mayor de 8 KB',async()=>{
 const r=await fetch(base+'/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(r.status,400);
 assert.equal((await request('/api/tasks','POST',{title:'a'.repeat(9000)})).status,413);
});
test('06 rechaza operadores e intentos de asignación masiva',async()=>{
 const item=await (await request('/api/tasks','POST',{title:'Seguro',completed:true})).json();assert.equal(item.completed,false);
 assert.equal((await request('/api/tasks/'+item._id,'PATCH',{completed:true,$set:{title:'otro'}})).status,400);
 await request('/api/tasks/'+item._id,'DELETE');
});
test('07 limita consultas a 100 documentos y usa el índice',async()=>{
 await db.collection('tasks').insertMany(Array.from({length:110},(_,i)=>({title:`Tarea ${i}`,completed:false,createdAt:new Date()})));
 const data=await (await request('/api/tasks')).json();assert.equal(data.items.length,100);
 const plan=await db.collection('tasks').find().sort({createdAt:-1,_id:-1}).limit(100).explain('executionStats');
 assert.ok(JSON.stringify(plan.queryPlanner.winningPlan).includes('IXSCAN'));await db.collection('tasks').deleteMany({});
});
test('08 health devuelve 503 si la base no está disponible',async()=>{
 const s=await serve(createApp({db:{collection:()=>({}),command:async()=>{throw new Error('secret');}},origin,logger:()=>{}}));
 try{const r=await fetch(`http://127.0.0.1:${s.address().port}/health`);assert.equal(r.status,503);assert.equal((await r.json()).status,'unavailable');}finally{await close(s);}
});
test('09 limita solicitudes con respuesta 429',async()=>{
 const s=await serve(createApp({db,origin,limit:2,logger:()=>{}}));
 try{const url=`http://127.0.0.1:${s.address().port}/api/tasks`;assert.equal((await fetch(url)).status,200);assert.equal((await fetch(url)).status,200);assert.equal((await fetch(url)).status,429);}finally{await close(s);}
});
test('10 logs contienen duración y estado sin cuerpos ni credenciales',()=>{
 assert.ok(logs.length>0);for(const l of logs.filter(l=>l.event==='http')){assert.equal(typeof l.durationMs,'number');assert.ok(l.status>=200);assert.equal(l.body,undefined);assert.equal(l.headers,undefined);assert.equal(l.uri,undefined);}
});
test('11 respaldo cifrado restaura BSON y detecta manipulación',async()=>{
 const source=client.db('backup_source').collection('tasks'),target=client.db('restore_test').collection('tasks');
 await source.insertOne({title:'Respaldo verificable',completed:false,createdAt:new Date()});
 const original=await source.find().toArray(),key=randomBytes(32).toString('hex'),encrypted=encryptBackup(original,key);
 assert.ok(!encrypted.includes('Respaldo verificable'));
 await target.insertMany(decryptBackup(encrypted,key));const restored=await target.find().toArray();
 assert.equal(restored[0]._id.toString(),original[0]._id.toString());assert.equal(restored[0].createdAt.getTime(),original[0].createdAt.getTime());assert.equal(restored[0].title,original[0].title);
 const tampered=JSON.parse(encrypted);tampered.tag='0'.repeat(32);assert.throws(()=>decryptBackup(JSON.stringify(tampered),key));
});
