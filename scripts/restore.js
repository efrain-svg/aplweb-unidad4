import { MongoClient } from 'mongodb';
import { readFile } from 'node:fs/promises';
import { decryptBackup } from './backup-crypto.js';
const target=process.env.RESTORE_DB;
if(!target || target===(process.env.DB_NAME||'unidad4') || !target.startsWith('restore_')) throw new Error('RESTORE_DB debe comenzar con restore_ y ser distinta de producción');
const docs=decryptBackup(await readFile(process.argv[2],'utf8'),process.env.BACKUP_KEY);
const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
try{
 await client.connect();const db=client.db(target);
 if((await db.listCollections({name:'tasks'}).toArray()).length)throw new Error('El destino ya contiene tasks; usa una base de restauración nueva');
 if(docs.length)await db.collection('tasks').insertMany(docs);
 await db.collection('tasks').createIndex({createdAt:-1,_id:-1});
 console.log(JSON.stringify({event:'restore_completed',documents:await db.collection('tasks').countDocuments()}));
}finally{await client.close();}
