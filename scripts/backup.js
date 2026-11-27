import { MongoClient } from 'mongodb';
import { mkdir,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { encryptBackup } from './backup-crypto.js';
if(!process.env.MONGODB_URI || !process.env.BACKUP_KEY)throw new Error('Faltan variables de respaldo');
const client=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
try{
 await client.connect();const docs=await client.db(process.env.DB_NAME||'unidad4').collection('tasks').find().toArray();
 const data=encryptBackup(docs,process.env.BACKUP_KEY),stamp=new Date().toISOString().replace(/[:.]/g,'-');
 await mkdir('backups',{recursive:true});await writeFile(`backups/tasks-${stamp}.json.enc`,data,{mode:0o600,flag:'wx'});
 console.log(JSON.stringify({event:'backup_created',documents:docs.length,sha256:createHash('sha256').update(data).digest('hex')}));
}finally{await client.close();}
