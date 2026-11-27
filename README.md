# Aplicaciones Web — Unidad 4

Aplicación académica CRUD de tareas: Vue 3/Vite, Express 5/Node 24 y MongoDB Atlas.

- Demo pública: https://potes-freddy-aplweb-u4.netlify.app
- Salud de API: https://tareas-api-production-113b32c3.up.railway.app/health
- Repositorio: https://github.com/efrain-svg/aplweb-unidad4
- Versión funcional desplegada: `8e41130e5c84dfdb84c6aa471721b7a277c1852d`.

## Reproducir
1. Instalar Node 24. Ejecutar `npm ci`.
2. Copiar `.env.example` a `.env`; configurar una base de desarrollo.
3. Ejecutar `npm test` (MongoDB temporal; primera ejecución puede descargar el binario oficial).
4. Ejecutar `npm run build`. `npm run verify` agrupa pruebas y build.
5. Desarrollo: `npm start` para API y `npm run dev` para interfaz, en terminales separadas.

## Desplegar
Netlify: rama main, comando `npm run build`, salida `dist`, Node 24.
`VITE_API_URL=https://tareas-api-production-113b32c3.up.railway.app/api`.
Las variables VITE son públicas y se incorporan durante el build.

Railway: Dockerfile; `NODE_ENV=production`, `DB_NAME=unidad4`, `FRONTEND_URL=https://potes-freddy-aplweb-u4.netlify.app` y `MONGODB_URI` secreta.
El servidor escucha en `::` y usa PORT dinámico. Health `/health`, espera de despliegue 600 s, ON_FAILURE hasta 3 reintentos.
`LOG_EGRESS_IP=true` registra la IP de salida del servidor. No registra credenciales.
Atlas: usuario `unidad4_app` con readWrite solo en unidad4, limitado al clúster del proyecto; índice `{createdAt:-1,_id:-1}`.
La red permite la IP observada 152.55.181.5/32. **Es dinámica**: después de un redeploy o reinicio comprobar logs, autorizar la nueva /32, verificar /health y retirar la regla antigua.
La configuración no secreta está en `deployment/platforms.json`.

## Pruebas y evidencias
- 11 pruebas locales aprobadas, con MongoDB real temporal.
- 10 comprobaciones remotas aprobadas en `evidence/cloud-checks.json`. Repetir: `node scripts/check-cloud.js`; crea y elimina únicamente su tarea temporal.
- Rendimiento remoto: p95 145,38 ms (/health) y 276,22 ms (/api/tasks); 8,79 y 40,08 solicitudes/s; 0 errores/100 solicitudes.
- Benchmark: definir `BENCHMARK_BASE_URL` como origen de API y ejecutar `npm run benchmark`. Sin esa variable, usa MongoDB local temporal. Guarda el resultado en evidence/benchmark.json; conservar el anterior si se desea comparar.
- 10 calentamientos y 50 solicitudes por escenario; concurrencia 1 y 5. Muestra remota de 1 documento. No es prueba de carga sostenida.
- La prueba de reinicio de API es local; en nube se verificaron CRUD y persistencia tras recargar la interfaz.

## Respaldo
Se exportó un documento real con el conector administrativo autorizado, se cifró con AES-256-GCM y se restauró en `restore_unidad4_20261127.tasks`. Igualdad y tipos BSON verificados. Ensayo completo: 143 s. Evidencia pública sin datos privados: `evidence/backup-cloud.json`.
El archivo cifrado y su clave protegida por Windows DPAPI están fuera del repositorio/ZIP, en la carpeta de entrega privada.
Alternativa por scripts desde una IP autorizada: configurar credencial de operador en MONGODB_URI, DB_NAME y BACKUP_KEY (64 caracteres hexadecimales).
- `node scripts/backup.js` genera backups/tasks-<fecha>.json.enc.
- Definir RESTORE_DB con nombre nuevo que empiece por restore_; `node scripts/restore.js <archivo-cifrado>`.
El destino no puede ser producción ni contener tasks. La cuenta de aplicación no debe administrar restauraciones.
Propuesta pendiente de automatizar: copias diarias, retención 7 días, custodia externa y pruebas periódicas. RPO 24 h / RTO 60 min son objetivos.

## Rollback
Identificar commit y despliegues aprobados. Republicar la versión anterior en Netlify y Railway, o revertir el commit y desplegar ambos. Revisar variables (se gestionan fuera del artefacto), IP de salida, health, CORS y CRUD.
Una reversión de código no revierte datos. Restaurar datos en una base distinta, verificar contenido y cambiar DB_NAME únicamente después de validarla. No se ensayó una reversión destructiva en producción.

## Seguridad y límites
Demo pública compartida: **solo datos ficticios**. CORS no autentica usuarios. Antes de admitir datos reales añadir autenticación y autorización por propietario. readWrite está acotado a una base; puede estrecharse a acciones CRUD específicas.
Validación, límite de cuerpo 8 KB, 120 peticiones/minuto/IP, Helmet, logs JSON sin cuerpos y listado máximo de 100 registros.
Railway usa modalidad de prueba con crédito y vencimiento; mantener un plan vigente para conservar la demo. No se ha contratado un plan de pago. Las alertas y copias programadas son mejoras pendientes.
