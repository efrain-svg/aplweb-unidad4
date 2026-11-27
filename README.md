# Aplicaciones Web Unidad 4

Aplicación académica de tareas con Vue 3, Express y MongoDB. La implementación es propia; la selección de arquitectura corresponde al material de la Universidad Politécnica Salesiana, Unidad 4, páginas 173–205. Los repositorios del curso se consultaron como referencia y no son repositorios personales del estudiante.

## Estado de la entrega

Código preparado para Netlify, Railway y MongoDB Atlas. Las evidencias locales se guardan en `evidence`. Repositorio propio: https://github.com/efrain-svg/aplweb-unidad4 (privado). Los proyectos de Netlify, Railway y Atlas ya están creados; la publicación y sus verificaciones siguen en preparación. Los identificadores y ajustes no secretos están en deployment/platforms.json. No se presenta la ejecución local como despliegue en Internet.

## Ejecutar y verificar

Requiere Node 24 y npm. Desde la raíz:

```sh
npm ci
npm test
npm run build
npm run benchmark
```

La primera prueba descarga MongoDB 7.0.24 mediante mongodb-memory-server. Ejecuta un servidor MongoDB real y temporal, accesible solo en la máquina local. No usa la base de producción ni credenciales de Atlas. El benchmark carga 1000 documentos locales, realiza 10 solicitudes de calentamiento por escenario y mide 50 lecturas por escenario. Sus resultados no predicen la latencia de Internet.

Para desarrollo, copiar `.env.example` como `.env`, apuntar `MONGODB_URI` a una instancia local y mantener las variables sin versionar. Ejecutar `npm start` y `npm run dev` en dos terminales. No introducir credenciales en variables `VITE_`, ya que se incorporan al JavaScript público.

## Publicar de forma reproducible

1. Crear un repositorio personal y subir el proyecto sin `.env`, `node_modules`, `backups`, `.mongo` ni credenciales. Conservar `package-lock.json`. Registrar el SHA del commit de entrega. Configurar el acceso del docente al repositorio.
2. En Atlas, crear un clúster y la base `unidad4` con la colección `tasks`. Usar un usuario de mantenimiento para crear el índice `{createdAt:-1,_id:-1}` con `scripts/create-index.js`. La aplicación no crea índices al iniciar.
3. Crear un rol de aplicación con acciones `find`, `insert`, `update` y `remove` únicamente sobre `unidad4.tasks`; asignarlo a un usuario exclusivo. No conceder `atlasAdmin`, `dbAdmin` ni permisos globales. Si el plan impide roles personalizados, `readWrite` solo sobre `unidad4` es una alternativa más amplia que debe declararse y revisarse. No utilizar el usuario administrativo en Railway.
4. Configurar Network Access de Atlas con la IP de salida del backend o el mecanismo privado admitido por el plan. Obtener y verificar esa IP antes de restringir el acceso. No publicar con `0.0.0.0/0` como configuración permanente. Si el plan no ofrece salida estable, resolver la conectividad antes de afirmar que la restricción por IP está aplicada.
5. Crear un sitio en Netlify para obtener su origen HTTPS. Conectar el repositorio; comando `npm run build`, carpeta `dist`, Node 24. Mantener el primer despliegue como preparación hasta disponer de la API real.
6. En Railway conectar el mismo repositorio. `Dockerfile` instala dependencias de producción con `npm ci --omit=dev`. Definir `NODE_ENV=production`, `DB_NAME=unidad4`, `MONGODB_URI` como secreto y `FRONTEND_URL` igual al origen HTTPS de Netlify, sin barra final. Railway proporciona `PORT`; el servidor escucha en `0.0.0.0`. Configurar `/health`, tiempo de espera de 120 segundos, Dockerfile y reinicio ON_FAILURE con 3 reintentos; generar el dominio público HTTPS. Los ajustes aplicados se documentan en deployment/platforms.json. La configuración se gestiona directamente en Railway; no se utiliza el antiguo railway.json.
7. En Netlify establecer `VITE_API_URL` con el dominio HTTPS real de Railway terminado en `/api`; reconstruir. Esta variable es pública. Un cambio exige un nuevo build. Comprobar que el origen final coincide exactamente con `FRONTEND_URL`.
8. Ejecutar CI antes de promover cada versión. Mantener desactivado el despliegue automático sin control de pruebas si la plataforma no permite esperar el resultado de CI. La promoción manual del commit aprobado es válida y reproducible: registrar SHA, ID de despliegue y fecha de cada servicio.
9. Ejecutar las pruebas de aceptación siguientes y completar las evidencias. Comprobar el acceso desde una sesión sin autenticación de desarrollador. No compartir cuentas ni claves con el docente.

## Pruebas de aceptación en producción

- HTTPS: frontend, API y `/health` sin avisos de certificado; verificar redirección de HTTP a HTTPS y ausencia de contenido mixto.
- Integración: crear una tarea de prueba, actualizar el navegador, comprobarla desde otra sesión y tras reiniciar el backend, completarla y eliminarla. Guardar capturas y estados HTTP.
- CORS: OPTIONS con origen de Netlify devuelve 204 y el origen exacto; un origen ajeno recibe 403 sin cabecera de autorización. CORS no sustituye autenticación: la demo tiene datos compartidos y solo admite información ficticia.
- Validación: título vacío, más de 120 caracteres e ID inválido devuelven 400; cuerpo mayor de 8 KB devuelve 413; documento inexistente devuelve 404.
- Salud: `/health` hace ping a MongoDB, devuelve 200 si responde y 503 si falla. Railway usa este endpoint durante el despliegue; configurar aparte una sonda periódica externa para disponibilidad continua.
- Logs: confirmar estado HTTP, duración y requestId. No registrar cuerpos, Authorization, cookies ni la cadena de conexión. Capturar únicamente líneas anonimizadas.
- Rendimiento: definir `BENCHMARK_BASE_URL` con el origen de Railway, sin `/api`, y ejecutar `npm run benchmark` sobre un entorno autorizado y sin usuarios concurrentes. Solo realiza lecturas. No ejecutar otros benchmarks al mismo tiempo; el límite es 120 solicitudes/minuto/IP. Registrar p95, solicitudes/segundo y porcentaje de errores; conservar la salida original.
- Criterios propuestos para repetir en nube: p95 inferior a 500 ms y errores inferiores al 1 %, tras calentamiento. Son metas, no resultados medidos de producción. Investigar primero errores 5xx, consultas sin índice, región de base de datos y arranques en frío.

## Respaldo y restauración

El respaldo lógico incluido exporta únicamente `tasks` en Extended JSON con tipos BSON y lo cifra con AES-256-GCM. Es adecuado para el volumen pequeño de esta demo; realizarlo en una ventana sin escrituras. No es una instantánea transaccional del clúster ni sustituye una estrategia profesional de backups.

Usar un usuario de backup con `find` solo sobre `unidad4.tasks`. Proporcionar `MONGODB_URI`, `DB_NAME` y `BACKUP_KEY` desde un gestor de secretos o variables protegidas del proceso. `BACKUP_KEY` debe ser una clave aleatoria de 32 bytes codificada en 64 caracteres hexadecimales, custodiada aparte del archivo; no ponerla en la línea de comandos, Git ni capturas.

```sh
node scripts/backup.js
```

Guardar el archivo cifrado fuera del servicio de Railway, en almacenamiento privado con permisos restringidos. Política propuesta: una copia diaria, retención de 7 días, RPO máximo de 24 h y RTO objetivo de 60 min. Programar y verificar la ejecución; estos objetivos no se dan por alcanzados antes de una prueba cronometrada.

Restaurar con un usuario distinto autorizado solamente sobre una base de prueba nueva cuyo nombre comience con `restore_`. Definir `RESTORE_DB`, `BACKUP_KEY` y su URI segura; ejecutar:

```sh
node scripts/restore.js backups/archivo.json.enc
```

El script rechaza producción y una colección destino existente. Comparar cantidad, `_id`, título, estado y fecha; comprobar el índice. Documentar la duración y custodiar el hash SHA-256 impreso por el backup. No borrar la base original. Para recuperación real, verificar primero la copia y decidir una migración separada.

## Reversión

Registrar previamente una versión aprobada de cada servicio, sus variables no secretas, el SHA y un respaldo verificado. Ante fallo de build, no promover. Ante errores 5xx o fallo de integración, detener promociones y restaurar en Railway el despliegue correcto; revisar también las variables porque pueden variar entre versiones. En Netlify revertir el commit defectuoso y construir una nueva publicación desde la versión aprobada. Un build fallido no sustituye al despliegue que ya estaba publicado. Si no se conserva el artefacto anterior, reconstruir el SHA aprobado con su lockfile. Después comprobar `/health`, CORS y CRUD desde el frontend. Revertir código no restaura datos: una recuperación de datos necesita una copia verificada y un procedimiento independiente. Esta versión no incorpora migraciones destructivas.

## Evidencias que faltan para cerrar la publicación

URL del repositorio propio, URL de Netlify, URL de Railway y `/health`; SHA y versiones; variables con valores sensibles ocultos; rol y alcance de permisos; acceso de red; evidencia HTTPS; CRUD persistente en nube; logs; benchmark remoto; respaldo real y ensayo de restauración. No reemplazar estos datos con las URL de ejemplo del libro.

## Referencias

- Universidad Politécnica Salesiana. (s. f.). *Aplicaciones Web* [Material didáctico], Unidad 4, pp. 173–205.
- Railway. (s. f.). *Healthchecks*. https://docs.railway.com/deployments/healthchecks
- Railway. (s. f.). *Deployment actions*. https://docs.railway.com/deployments/deployment-actions
- Netlify. (s. f.). *Build environment variables*. https://docs.netlify.com/build/configure-builds/environment-variables/
- Vite. (s. f.). *Env variables and modes*. https://vite.dev/guide/env-and-mode
- MongoDB. (s. f.). *Back up, restore, and archive data*. https://www.mongodb.com/docs/atlas/backup-restore-cluster/

