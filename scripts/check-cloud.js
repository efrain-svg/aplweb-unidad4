import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='https://tareas-api-production-113b32c3.up.railway.app';
const origin='https://potes-freddy-aplweb-u4.netlify.app';
const checks=[];
async function check(name,url,expected,options={}) {
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
 checks.push({name,status:r.status,expected,passed:r.status===expected});
 assert.equal(r.status,expected,name);return r;
}
const front=await check('Frontend sin sesión',origin,200);
assert.match(await front.text(),/Mis tareas|id="app"/);
await check('Health con Atlas',base+'/health',200);
await check('Preflight autorizado',base+'/api/tasks',204,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'}});
await check('Origen ajeno rechazado',base+'/api/tasks',403,{headers:{Origin:'https://example.invalid'}});
await check('Título vacío',base+'/api/tasks',400,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({title:''})});
const headers={'Content-Type':'application/json',Origin:origin};
const item=await (await check('Crear registro de prueba',base+'/api/tasks',201,{method:'POST',headers,body:JSON.stringify({title:'Prueba temporal de aceptación U4'})})).json();
try {
 const updated=await (await check('Completar registro',base+'/api/tasks/'+item._id,200,{method:'PATCH',headers,body:JSON.stringify({completed:true})})).json();
 assert.equal(updated.completed,true);
 const list=await (await check('Leer persistencia',base+'/api/tasks',200,{headers})).json();
 assert.equal(list.items.find(x=>x._id===item._id)?.completed,true);
} finally {await check('Eliminar solo registro temporal',base+'/api/tasks/'+item._id,204,{method:'DELETE',headers});}
const final=await (await fetch(base+'/api/tasks')).json();
assert.equal(final.items.some(x=>x._id===item._id),false);
checks.push({name:'Registro temporal eliminado',passed:true});
await writeFile('evidence/cloud-checks.json',JSON.stringify({date:new Date().toISOString(),base,origin,checks,allPassed:true,remainingDocuments:final.items.length},null,2)+'\n');
console.log(JSON.stringify({allPassed:true,checks:checks.length,remainingDocuments:final.items.length}));
