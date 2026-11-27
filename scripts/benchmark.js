import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { once } from 'node:events';
import { writeFile, mkdir } from 'node:fs/promises';
import { createApp } from '../backend/app.js';
// Solo ejecuta lecturas si se proporciona BENCHMARK_BASE_URL. No toca datos remotos.
let mongo,client,server,base=process.env.BENCHMARK_BASE_URL;
const local=!base;
try {
 if(local){
  mongo=await MongoMemoryServer.create({binary:{version:'7.0.24'}});client=await new MongoClient(mongo.getUri()).connect();const db=client.db('benchmark');
  await db.collection('tasks').insertMany(Array.from({length:1000},(_,i)=>({title:`Tarea de prueba ${i}`,completed:i%2===0,createdAt:new Date(Date.now()-i*1000)})));
  await db.collection('tasks').createIndex({createdAt:-1,_id:-1});
  server=createApp({db,origin:'http://localhost:5173',logger:()=>{},limit:10000}).listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
 }
 const reports=[];
 for(const [path,concurrency] of [['/health',1],['/api/tasks',5]]) {
  for(let i=0;i<10;i++)await (await fetch(base+path)).arrayBuffer();
  const times=[],statuses={};let index=0,errors=0;const start=performance.now();
  await Promise.all(Array.from({length:concurrency},async()=>{while(index++<50){const t=performance.now();try{const r=await fetch(base+path,{signal:AbortSignal.timeout(10000)});await r.arrayBuffer();statuses[r.status]=(statuses[r.status]||0)+1;if(!r.ok)errors++;}catch{errors++;}times.push(performance.now()-t);}}));
  const seconds=(performance.now()-start)/1000;times.sort((a,b)=>a-b);
  reports.push({path,concurrency,requests:times.length,p50Ms:+times[Math.ceil(times.length*.50)-1].toFixed(2),p95Ms:+times[Math.ceil(times.length*.95)-1].toFixed(2),requestsPerSecond:+(times.length/seconds).toFixed(2),errors,statuses});
 }
 const data={date:new Date().toISOString(),environment:local?'local Windows; MongoDB 7.0.24; sin TLS ni red pública':'remoto',base,seedDocuments:local?1000:undefined,warmup:10,results:reports};
 await mkdir('evidence',{recursive:true});await writeFile('evidence/benchmark.json',JSON.stringify(data,null,2));console.log(JSON.stringify(data,null,2));
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(client)await client.close();if(mongo)await mongo.stop();}
