import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { BSON } from 'mongodb';
export function encryptBackup(documents, keyHex) {
 if(!/^[0-9a-f]{64}$/i.test(keyHex || ''))throw new Error('BACKUP_KEY debe tener 64 caracteres hexadecimales');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);
 const ciphertext=Buffer.concat([cipher.update(BSON.EJSON.stringify(documents,{relaxed:false}),'utf8'),cipher.final()]);
 return JSON.stringify({format:1,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),data:ciphertext.toString('base64')});
}
export function decryptBackup(text,keyHex){
 if(!/^[0-9a-f]{64}$/i.test(keyHex || ''))throw new Error('Clave inválida');
 const data=JSON.parse(text);if(data.format!==1)throw new Error('Formato no soportado');
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),Buffer.from(data.iv,'hex'));decipher.setAuthTag(Buffer.from(data.tag,'hex'));
 return BSON.EJSON.parse(Buffer.concat([decipher.update(Buffer.from(data.data,'base64')),decipher.final()]).toString('utf8'),{relaxed:false});
}
