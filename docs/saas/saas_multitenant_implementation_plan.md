# Plan Maestro de Implementación SaaS Multi-Tenant (v3.1)

> [!IMPORTANT]
> **Estado Actual:** Gate 2 aceptado como "núcleo de aislamiento". Autorizado el inicio del Gate 3A.  
> **Rama Oficial:** `feature/saas-multitenancy` (la rama `main` no se toca; sin push sin autorización de Gabriel).  
> **Política de Aislamiento:** Instancia única y base de datos compartida con aislamiento estricto por `companyId` y claves compuestas InnoDB con `ON DELETE RESTRICT`.  
> **Protección de Datos:** La base real `reconocimiento_facial_db_pain` queda intocable; todas las pruebas corren bajo el usuario `saas_test_user` acotado exclusivamente a bases `reconocimiento_test_%`.

---

## 1. Arquitectura

```mermaid
flowchart TB
    subgraph Edge["Perímetro & Seguridad (Cloudflare / Nginx Reverse Proxy)"]
        WAF["WAF & Terminación TLS 1.3\nStrict CORS / Trust Proxy / Rate Limit IP+Email"]
    end

    subgraph Clientes["Clientes & Dispositivos"]
        K1["Kiosco Empresa Alpha\n(x-device-token SHA-256)"]
        K2["Kiosco Empresa Beta\n(x-device-token SHA-256)"]
        A1["Admin Empresa Alpha\n(JWT: companyId=Alpha)"]
        A2["Admin Empresa Beta\n(JWT: companyId=Beta)"]
        SA["Super Admin SaaS\n(JWT: SUPER_ADMIN + x-tenant-id en rutas operativas)"]
    end

    subgraph AppServer["Node.js Application Server (Puerto 4000)"]
        ALS["tenantContext.js (AsyncLocalStorage)\n{ companyId, isSuperAdmin, isImpersonating }"]
        PrismaExt["Prisma Client Extension ($extends)\n14 Operaciones ORM + Nested Writes\n$queryRaw / $executeRaw Bloqueados"]
        PrismaAdmin["prismaAdmin.js (Cliente Administrativo Dedicado)\nExclusivo para Scripts y Purga ARCO"]
        FaceRAM["faceMath Cache (RAM - Proceso Único)\nMap<companyId, Float32Array[]>\nRecarga Selectiva por Empresa"]
        WSEngine["Socket.io Server\nSalas Estrictas: company_${companyId}"]
        CronEngine["Multi-Tenant Cron Engine\nIdempotente por timezone & lastAbsenceDateRun"]
    end

    subgraph Storage["MariaDB 10.11 (Red Docker Interna - Sin Puerto Público)"]
        T_Company[("Company\n(plan, timezone, descriptorsVersion, lastAbsenceDateRun)")]
        T_Emp[("Employee\n(@@unique[id, companyId], @@unique[companyId, identifier]\nfaceDescriptor cifrado AES-256-GCM)")]
        T_Att[("AttendanceRecord\n(@@index[companyId, date], FK Restrict compuesta)")]
        T_Dev[("Device\n(tokenHash SHA-256 @unique, companyId)")]
        T_Shifts[("Shift & Department\n(@@unique[id, companyId], @@unique[companyId, name])")]
    end

    subgraph ExternalLedger["Almacenamiento Fuera de Base Respaldada"]
        LedgerFile[("RevokedCompanyPurgeLedger\n(Libro mayor inmutable para reconciliación post-restauración)")]
    end

    Clientes --> WAF --> Edge --> ALS
    ALS --> PrismaExt --> Storage
    PrismaAdmin -.->|Exclusivo Scripts / DDL| Storage
    PrismaAdmin -.->|Reconciliación| LedgerFile
    ALS --> FaceRAM
    ALS --> WSEngine
```

---

## 2. Matriz de Archivos Afectados

| Archivo | Ruta | Acción | Descripción del Cambio |
| :--- | :--- | :---: | :--- |
| `schema.prisma` | `backend/prisma/schema.prisma` | Modificar | Eliminar `photoRetentionDays`; mantener índices y claves compuestas InnoDB. |
| `secrets.js` | `backend/src/config/secrets.js` | Modificar | Validar `JWT_SECRET` (>=32B) y `ENCRYPTION_KEY` (32B decodificados de hex/base64 sin fallback). |
| `prisma.js` | `backend/src/utils/prisma.js` | Modificar | Retirar `prisma.$base`; sanitizar nested writes (`connect`, `connectOrCreate`); eliminar excepciones genéricas. |
| `prismaAdmin.js` | `backend/src/utils/prismaAdmin.js` | Crear | Cliente Prisma administrativo dedicado para migraciones y scripts. |
| `authHelpers.js` | `backend/src/utils/authHelpers.js` | Crear | Helpers de ámbito estrecho `findAdminByEmailForLogin` y `createPairingRequest`. |
| `tenantContext.js` | `backend/src/middlewares/tenantContext.js` | Modificar | Manejar `companyId` en contexto, regla `SUPER_ADMIN` con `x-tenant-id`, rechazo 403 en empresa suspendida. |
| `requireApiKey.js` | `backend/src/middlewares/requireApiKey.js` | Modificar | Validar por `Device.tokenHash` (SHA-256); ventana de gracia 72 h configurable por variable con `x-migrated-device-token`. |
| `auth.middleware.js` | `backend/src/modules/auth/auth.middleware.js` | Modificar | Eliminar `DISABLE_AUTH`; validación estricta de firma y estado activo de empresa. |
| `auth.controller.js` | `backend/src/modules/auth/auth.controller.js` | Modificar | Usar `findAdminByEmailForLogin`; cookies `SameSite=Strict`; rechazo 403 si suspendida. |
| `auth.router.js` | `backend/src/modules/auth/auth.router.js` | Modificar | Rate limit compuesto `ip + req.body.email`. |
| `employees.router.js` | `backend/src/modules/employees/employees.router.js` | Modificar | `/descriptors` con `x-device-token`, rate limit 120 req/h, auditoría y alerta >30/5min; validación de `maxEmployees`. |
| `departments.router.js` | `backend/src/modules/departments/departments.router.js` | Modificar | Validar unicidad `companyId_name` y captura de error P2003 con HTTP 409. |
| `shifts.router.js` | `backend/src/modules/shifts/shifts.router.js` | Modificar | Validar `companyId_name` y desactivación lógica ante asistencias vinculadas. |
| `attendance.router.js` | `backend/src/modules/attendance/attendance.router.js` | Modificar | Registro con validación de dispositivo propio, captura de faltas y reportes acotados. |
| `devices.controller.js` | `backend/src/modules/devices/devices.controller.js` | Modificar | Validar `maxDevices` al aprobar; usar `createPairingRequest`; registrar auditoría. |
| `devices.router.js` | `backend/src/modules/devices/devices.router.js` | Modificar | Rutas `/auth-requests/lookup` y `/auth-requests/:id/approve` acotadas con auditoría. |
| `reports.router.js` | `backend/src/modules/reports/reports.router.js` | Modificar | Exportaciones de reportes acotadas exclusivamente al tenant activo. |
| `notification.router.js` | `backend/src/modules/notifications/notification.router.js` | Modificar | Notificaciones acotadas al tenant activo. |
| `events.router.js` | `backend/src/modules/events/events.router.js` | Modificar | Eventos acotados al tenant activo; validación de `registeredById` contra la empresa. |
| `admins.router.js` | `backend/src/modules/admins/admins.router.js` | Modificar | Gestión de administradores acotada al tenant activo; validación de `createdBy`. |
| `settings.router.js` | `backend/src/modules/settings/settings.router.js` | Modificar | Retirar `photoRetentionDays`; configuración acotada por inquilino. |
| `faceMath.js` | `backend/src/utils/faceMath.js` | Modificar | Recarga selectiva por empresa (`reloadCompanyFaceCache`); documentar proceso único. |
| `attendanceCron.js` | `backend/src/jobs/attendanceCron.js` | Modificar | Idempotencia en `processAbsences` conectando `Company.lastAbsenceDateRun`. |
| `app.js` | `backend/src/app.js` | Modificar | CORS restrictivo (sin `origin:true`); migrar `io.to('dashboard')` a salas por inquilino; desconexión forzada en suspensión. |
| `KioskSetupPage.jsx` | `frontend/src/pages/kiosk/KioskSetupPage.jsx` | Modificar | Guardar `requestId` y `pairingCode` en `sessionStorage` para evitar re-emisiones al recargar. |
| `KioskPage.jsx` | `frontend/src/pages/kiosk/KioskPage.jsx` | Modificar | Enviar `x-device-token` y manejar HTTP 401 redirigiendo a `/kiosk/setup`. |
| `SettingsPage.jsx` | `frontend/src/pages/dashboard/SettingsPage.jsx` | Modificar | Eliminar controles de `photoRetentionDays`. |
| `migrate_production.js` | `backend/scripts/migrate_production.js` | Mantener | Migración con `--confirm`, `--expected-db` y auditoría de 25 FKs. |
| `backup_database.sh` | `backend/scripts/backup_database.sh` | Crear | Respaldo diario gzip + GPG hacia almacenamiento externo con retención rodante de 30 días. |
| `rotate_encryption_key.js` | `backend/scripts/rotate_encryption_key.js` | Crear | Rotación transaccional de clave biométrica. |
| `post_restore_reconcile.js` | `backend/scripts/post_restore_reconcile.js` | Crear | Script manual con `--dry-run` para reconciliación ARCO contra libro mayor externo post-restauración. |

---

## 3. Fases Paso a Paso y Cronograma

### Diagrama Gantt de Ejecución por Puertas

```mermaid
gantt
    title Cronograma de Ejecución SaaS por Puertas de Aprobación
    dateFormat  YYYY-MM-DD
    section Semana 1: Datos & Núcleo
    Gate 1: DB & Esquema Paridad       :done, g1, 2026-10-21, 1d
    Gate 2: Núcleo de Aislamiento      :done, g2, 2026-10-22, 1d
    section Semana 2: Gate 3A y 3B
    Gate 3A: Endurecimiento Núcleo     :active, g3a, 2026-10-22, 2d
    Aprobación Gate 3A                 :milestone, after g3a, 0d
    Gate 3B Lote 1: Emp, Att, Dev      :g3b1, after g3a, 3d
    Aprobación Gate 3B Lote 1          :milestone, after g3b1, 0d
    Gate 3B Lote 2: Resto Módulos      :g3b2, after g3b1, 3d
    section Semana 3: Gate 3C y 4
    Gate 3C: Kioscos, Sockets & UI     :g3c, after g3b2, 3d
    Aprobación Gate 3 (Features Ready) :milestone, after g3c, 0d
    Gate 4: Seguridad & Operación      :g4, after g3c, 4d
    Aprobación Gate 4 (Hardening Ready):milestone, after g4, 0d
    section Semana 4: Gate 5 Carga & Despliegue
    Gate 5: k6, Ensayo Dump & CI/CD    :g5, after g4, 5d
    Aprobación Gate 5 (Pre-Release)    :milestone, after g5, 0d
    section Semana 5 a 7: Gate 6 Soft Launch
    Gate 6: Piloto PAIN + 2 Betas      :g6, after g5, 15d
    Aprobación Gate 6 (General Release):milestone, after g6, 0d
```

*Aclaración de Cronograma:* Las fechas del diagrama Gantt representan una proyección estimada a partir del 22 de octubre de 2026. **Las puertas de aprobación dictan los tiempos reales**: ninguna fase avanza sin la aprobación explícita de Gabriel. Si una puerta requiere ajustes, las fechas se recorren automáticamente.

---

### FASE 1 (Gate 1): Esquema de BD, Migración y Paridad (Completada)
- **Objetivo:** Establecer la estructura multi-tenant en MariaDB InnoDB con 25 claves foráneas compuestas con `ON DELETE RESTRICT`.
- **Tareas:**
  1. Definición de `schema.prisma` con `Company` y claves compuestas `[id, companyId]`.
  2. Creación y prueba de `migrate_production.js` con Paso 0 (desvincular FKs) y auditoría 25/25 FKs.
  3. Ejecución de `prisma migrate resolve --applied 20261022000000_saas_multitenancy`.
- **Criterios de Aceptación:**
  - [x] `prisma migrate diff --exit-code` arroja 0 entre base generada y migrada.
  - [x] 25 claves foráneas activas verificadas en InnoDB.

---

### FASE 2 (Gate 2): Núcleo de Aislamiento Backend (Aceptado)
- **Objetivo:** Proteger el acceso de datos en el ORM, autenticación por empresa y salas de sockets.
- **Tareas:**
  1. `secrets.js` con validación estricta de 32 bytes para `JWT_SECRET` y `ENCRYPTION_KEY`.
  2. Extensión `$extends` en 13 modelos x 14 operaciones bloqueando `$queryRaw` y `$executeRaw`.
  3. `tenantContext.js` (`AsyncLocalStorage`), regla `SUPER_ADMIN` con `x-tenant-id` (400 si falta).
  4. Handshake de Socket.io por salas `company_${companyId}` y ETag/304 en `/descriptors`.
- **Criterios de Aceptación:**
  - [x] Matriz de 728 aserciones de Prisma en verde con 4 mutaciones demostradas.
  - [x] Rechazo 400 a Super Admin sin tenant y 403 a empresas suspendidas demostrados con salida real.

---

### FASE 3: Módulos, Kioscos y Frontend (Gate 3)

#### Puerta 3A: Endurecimiento del Núcleo y Protección de Bases
- **Objetivo:** Blindar la base real con usuarios dedicados, desacoplar el cliente administrativo y sanitizar escrituras anidadas.
- **Tareas:**
  1. *Paso 3.0:* Crear usuario `saas_test_user` acotado exclusivamente a `reconocimiento\_test\_%`.* (sin acceso a la base real). Actualizar `backend/.env` para usarlo. Demostrar error 1044/1142 al intentar leer o modificar la base real.
  2. Crear `backend/src/utils/prismaAdmin.js` para uso exclusivo de scripts y mantenimiento.
  3. Retirar `prisma.$base` de [backend/src/utils/prisma.js](file:///c:/Users/gabri/OneDrive/Escritorio/Portafolio/ReconocimentoFacialPainProject/backend/src/utils/prisma.js). Crear prueba automatizada que falle si algo en `src/modules` importa `prismaAdmin.js`.
  4. Crear `backend/src/utils/authHelpers.js` con `findAdminByEmailForLogin` y `createPairingRequest`. Eliminar las excepciones abiertas de `prisma.js`.
  5. Interceptar escrituras anidadas (`connect`, `connectOrCreate`, `create`, `update`) en la extensión de Prisma.
  6. Bloquear explícitamente `$queryRawUnsafe` y `$executeRawUnsafe`.
  7. Formalizar el 5º contexto (`companyId: undefined`) en la matriz de pruebas y asegurar limpieza de residuos (`teardown`).
  8. Justificar relaciones sin FK compuesta (`AdminUser.createdBy`, `EventRequest.registeredById`, `AdminAuditLog.performedById`, `DeviceAuthRequest.deviceId`) y respaldarlas con validaciones de servicio y pruebas.
- **Archivos:** `backend/.env`, `prisma.js`, `prismaAdmin.js`, `authHelpers.js`, tests de unidad.
- **Criterios de Aceptación:**
  - [ ] `saas_test_user` verificado sin acceso a la base real con salida de terminal.
  - [ ] `prisma.$base` retirado del runtime; prueba de importación prohibida en verde.
  - [ ] Excepciones genéricas eliminadas de `prisma.js`.
  - [ ] Escrituras anidadas sanitizadas con inyección de `companyId`.
  - [ ] Dos ejecuciones consecutivas de la matriz dan exactamente el mismo conteo.
  - *Punto de Revisión:* Gabriel revisa y aprueba formalmente el Gate 3A.

#### Puerta 3B: Módulos de Negocio (Pruebas HTTP Primero)
- **Objetivo:** Adaptar cada módulo asegurando aislamiento cross-tenant con pruebas HTTP previas.
- **Tareas:**
  1. *Lote 1 (Críticos):*
     - `employees`: Escribir prueba HTTP (`supertest`) de aislamiento y límite de plan. Adaptar router: listado, creación, validación `companyId_identifier`, bloqueo 403 `PLAN_LIMIT_EXCEEDED` al superar `maxEmployees`.
     - `attendance`: Prueba HTTP previa. Adaptar router: registro de checadas (`/register`), validación de dispositivo propio y reportes acotados.
     - `devices`: Prueba HTTP previa. Adaptar controlador: bloqueo 403 `PLAN_LIMIT_EXCEEDED` al superar `maxDevices`, registro de `lastSeenAt` y revocación con un clic.
     - *Punto de Revisión:* Gabriel revisa y aprueba el cierre del Lote 1 de 3B.
  2. *Lote 2 (Resto de Módulos):*
     - `departments` y `shifts`: Pruebas HTTP previas. Validar unicidad `companyId_name`, captura de error P2003 con HTTP 409 y desactivación lógica ante asistencias vinculadas.
     - `reports`, `settings`, `admins`, `events`, `notifications`: Pruebas HTTP previas. Scoping estricto por `companyId`, validación de `registeredById` en eventos y auditoría de cada acceso de `SUPER_ADMIN` a un inquilino.
- **Archivos:** Routers y controladores de los 11 módulos, pruebas en `backend/tests/integration/`.
- **Criterios de Aceptación:**
  - [ ] Pruebas HTTP escritas y confirmadas antes de modificar cada router.
  - [ ] Intentos de lectura o modificación cruzada responden HTTP 404 (no 403).
  - [ ] Intentos de superar `maxEmployees` o `maxDevices` devuelven HTTP 403 `PLAN_LIMIT_EXCEEDED` sin bloquear checadas existentes.
  - [ ] Suite HTTP de los 11 módulos en verde demostrada con salida de terminal.

#### Puerta 3C: Kioscos, Sockets y Frontend
- **Objetivo:** Migrar dispositivos físicos, optimizar sincronización biométrica y adaptar la interfaz.
- **Tareas:**
  1. Eliminar `KIOSK_API_KEY` y `DISABLE_AUTH`.
  2. Implementar autenticación por `Device.tokenHash` (SHA-256) en `requireApiKey.js`.
  3. Implementar ventana de gracia de 72 horas para kioscos del piloto: variable de entorno `KIOSK_GRACE_EXPIRATION_DATE` (si petición trae clave legacy y no ha vencido la fecha, asociar a `default-company-pain` y responder `x-migrated-device-token`). Anular `Device.token` plano en BD.
  4. Endurecer `/descriptors`: exigir `x-device-token`, rate limit 120 req/h por dispositivo, registrar auditoría por descarga y alertar en `AdminAuditLog` si hay >30 descargas completas en 5 min.
  5. Incrementar `Company.descriptorsVersion` ante altas, bajas, enrolamientos o revocaciones biométricas.
  6. Socket.io: eliminar `io.to('dashboard')` en `app.js` y migrar a `io.to('dashboard_' + companyId)`. Implementar desconexión forzada en tiempo real ante suspensión de empresa. Probar Socket.io sobre la instancia real de `app.js`.
  7. Frontend:
     - `KioskSetupPage.jsx`: almacenar `requestId` y `pairingCode` en `sessionStorage` para evitar re-emisiones al recargar.
     - `KioskPage.jsx`: enviar `x-device-token`, almacenar token migrado y redirigir a `/kiosk/setup` ante HTTP 401.
     - `SettingsPage.jsx`: eliminar controles de `photoRetentionDays`.
     - Dashboard: mostrar tenant activo y permitir al Super Admin operar empresas con auditoría.
- **Archivos:** `requireApiKey.js`, `employees.router.js`, `app.js`, vistas de frontend.
- **Criterios de Aceptación:**
  - [ ] Ventana de 72 h funcional y configurable por variable de entorno.
  - [ ] `/descriptors` protegido con rate limit, auditoría y alertas demostradas.
  - [ ] Cero emisiones globales en Socket.io sobre `app.js` real.
  - [ ] Frontend de kiosco gestiona tokens y sesiones sin duplicación.
  - *Punto de Revisión:* Gabriel revisa y aprueba formalmente el Gate 3 completo.

---

### FASE 4 (Gate 4): Seguridad, Operación y Resiliencia (Hardening)
- **Objetivo:** Asegurar las sesiones web, garantizar idempotencia en procesos de fondo y formalizar la protección legal ARCO.
- **Tareas:**
  1. Rate limit en login por clave compuesta `ip + req.body.email` (5 intentos / 15 min).
  2. Cookies con `SameSite=Strict; Secure; HttpOnly` y protección CSRF con cabecera personalizada.
  3. CORS restrictivo con lista blanca de dominios de producción (sin `origin: true`).
  4. Idempotencia en cron: conectar `Company.lastAbsenceDateRun` en `attendanceCron.js` y demostrar que dos ejecuciones sucesivas dan 0 faltas duplicadas.
  5. Invalidación selectiva de face cache en RAM (`reloadCompanyFaceCache`) y documentar proceso único de Node.js.
  6. Eliminar `photoRetentionDays` del esquema Prisma (`schema.prisma`) y generar migración con paridad `diff --exit-code = 0`.
  7. Crear archivo de libro mayor `RevokedCompanyPurgeLedger` FUERA de la base respaldada y codificar el script manual de reconciliación post-restauración `post_restore_reconcile.js` con modo `--dry-run`.
  8. Desarrollar script diario de volcado `backup_database.sh` (compresión gzip, cifrado GPG asimétrico, retención rodante de 30 días y envío a almacenamiento externo S3/B2).
  9. Desarrollar y probar script de rotación transaccional `rotate_encryption_key.js`.
  10. Aprovisionar usuario MariaDB `saas_app_user` (solo DML: `SELECT, INSERT, UPDATE, DELETE`) y configurar `connection_limit` en `DATABASE_URL`.
- **Criterios de Aceptación:**
  - [ ] Rate limit compuesto y cookies `Strict` verificados.
  - [ ] Idempotencia de cron demostrada con salida de terminal: segunda corrida = 0 faltas.
  - [ ] `photoRetentionDays` totalmente eliminado de esquema y BD.
  - [ ] Script de rotación de claves probado sobre un clon.
  - [ ] Respaldo diario GPG y script de reconciliación post-restauración probados con éxito.
  - [ ] `saas_app_user` creado y verificado que el motor bloquea sentencias DDL.
  - *Punto de Revisión:* Gabriel revisa y aprueba formalmente el Gate 4.

---

### FASE 5 (Gate 5): Pruebas de Carga y Simulacro de Despliegue
- **Objetivo:** Demostrar el rendimiento a escala y validar el protocolo de contingencia y rollback.
- **Tareas:**
  1. Siembra sintética de carga realista: 400 empresas, 14,000 empleados con vectores y 3,000,000 de asistencias.
  2. Prueba de carga k6: línea base de 45 RPS durante 10 min, rampa a saturación y tráfico mixto. Reportar CPU, RAM, p95 y p99. Ajustar `innodb_buffer_pool_size` y pool de Prisma según resultados.
  3. Ensayo fiel con volcado real del cliente: migración con `migrate_production.js --confirm`, doble ejecución y descifrado de 128 floats verificado.
  4. Dockerización: `Dockerfile` multi-stage, `docker-compose.yml` (sin puertos públicos para MariaDB) y workflow de GitHub Actions.
  5. Simulacro de despliegue y rollback previo al punto de no retorno en menos de 30 segundos.
  6. Documentar procedimiento para refrescar los kioscos del piloto tras el despliegue.
- **Criterios de Aceptación:**
  - [ ] Latencia p95 < 500 ms a 45 RPS demostrada bajo carga masiva.
  - [ ] Ensayo con volcado real completado con paridad e integridad al 100%.
  - [ ] Restauración de contingencia en frío ejecutada en menos de 30 segundos.
  - [ ] Entorno listo para despliegue con Docker Compose.
  - *Punto de Revisión:* Gabriel revisa y aprueba formalmente el Gate 5.

---

### FASE 6 (Gate 6): Soft Launch y Salida a Producción General
- **Objetivo:** Ejecutar la migración en ventana de mantenimiento y operar el piloto con clientes beta.
- **Tareas:**
  1. Ventana de mantenimiento formal con la aplicación detenida (`docker compose down`).
  2. Respaldo en frío de la base real.
  3. Ejecución de `migrate_production.js --confirm --expected-db=reconocimiento_facial_db_pain`.
  4. Arranque de contenedores con imagen versionada y verificación de 25 FKs activas.
  5. Operación de kioscos del piloto consumiendo la ventana de gracia de 72 h.
  6. Soft launch de **2 a 3 semanas** con la empresa piloto `default-company-pain` y 1 a 2 clientes beta reales.
  7. Monitoreo diario de: latencia de checadas en kiosco, uso de CPU/RAM, eventos en `AdminAuditLog` y memoria del face cache.
- **Criterios de Aceptación:**
  - [ ] 2 a 3 semanas de soft launch concluidas sin colisiones cross-tenant ni caídas de servicio.
  - [ ] 100% de los dispositivos del piloto operando con `x-device-token` permanente.
  - [ ] Retiro formal del soporte para claves de gracia.
  - *Punto de Revisión:* Gabriel autoriza el paso a Producción General (General Release).

---

## 4. Migración, Despliegue, Rollback y Punto de No Retorno

### Procedimiento Operativo de Despliegue (Docker Compose)
1. **Detención de Servicios:**
   - Detener los contenedores de la aplicación: `docker compose down`. No debe haber tráfico HTTP ni procesos escribiendo en la base de datos.
2. **Respaldo de Seguridad Previo:**
   - Generar volcado físico en frío de la base real:
     `mariadb-dump -u saas_clone_user -p --single-transaction --quick reconocimiento_facial_db_pain > pre_migration_backup.sql`
   - Generar suma de comprobación SHA-256 del archivo de respaldo.
3. **Ejecución de la Migración:**
   - Ejecutar el script productivo:
     `node backend/scripts/migrate_production.js --confirm --expected-db=reconocimiento_facial_db_pain`
   - El script desvincula temporalmente las FKs (Paso 0), actualiza tipos a `VARCHAR(191)`, asigna registros a la empresa piloto, cifra los descriptores con AES-256-GCM y aplica las 25 FKs compuestas con `ON DELETE RESTRICT`.
   - Si la auditoría final no contabiliza exactamente 25 claves foráneas activas, el script aborta con error crítico.
4. **Arranque de la Nueva Versión:**
   - Levantar la versión SaaS: `docker compose up -d`.

### Punto de No Retorno
- **Definición:** Se alcanza en el instante exacto en que la versión multi-tenant entra en producción y un kiosco registra la primera checada real de un empleado bajo el nuevo esquema.
- **Antes del Punto de No Retorno:** Si la migración falla o se detectan errores en el arranque, se ejecuta rollback inmediato restaurando el respaldo en menos de 30 segundos:
  `mysql -u root -p reconocimiento_facial_db_pain < pre_migration_backup.sql`
- **Después del Punto de No Retorno:** Queda estrictamente prohibido restaurar respaldos antiguos completos (provocaría pérdida irreversible de asistencias y horas laborales devengadas). Cualquier contingencia se resuelve mediante corrección hacia adelante (*Hotfix*) o script compensatorio de datos.
- **Futuras Migraciones:** Una vez que el sistema ya opere como SaaS, todas las migraciones posteriores utilizarán el patrón *Expand and Contract*.

---

## 5. Pruebas de Carga (k6)

### Escenario de Saturación y Límites
- **Volumen Sembrado:**
  - 400 empresas configuradas.
  - 14,000 empleados con vectores biométricos válidos de 128 floats.
  - 3,000,000 de registros históricos de asistencia.
- **Perfil de Tráfico Mixto:**
  - 70% Registro de checadas biométricas (`POST /api/v1/attendance/register`).
  - 15% Consultas de monitoreo en tiempo real desde dashboard (`GET /api/v1/attendance/today`).
  - 10% Conexiones Socket.io con eventos de presencia y heartbeat.
  - 5% Generación de reportes de asistencia en CSV (`GET /api/v1/reports/attendance`).
- **Fases de Ejecución:**
  - *Fase 1 (Línea Base):* 45 RPS sostenidos durante 10 minutos (simulación de pico laboral estándar). Criterio: latencia p95 < 500 ms, error rate < 0.1%.
  - *Fase 2 (Rampa al Límite):* Incremento de 10 RPS cada 2 minutos hasta identificar el punto de quiebre (CPU > 85% o p95 > 500 ms).
- **Métricas a Reportar Obligatoriamente:** Uso de CPU del contenedor Node.js, uso de CPU de MariaDB, consumo de memoria RAM del face cache, latencias p95 y p99. Prohibido prometer capacidades sin estos resultados empíricos.

---

## 6. Riesgos y Mitigaciones

| Riesgo Técnico / Operativo | Impacto | Probabilidad | Estrategia de Mitigación |
| :--- | :---: | :---: | :--- |
| **Acceso accidental de scripts a la base real** | Crítico | Baja | `saas_test_user` sin permisos sobre bases de producción (defensa principal de motor). Guarda fail-fast en scripts como segunda capa. |
| **Fuga de datos por consultas raw** | Crítico | Baja | Bloqueo absoluto de `$queryRaw`, `$queryRawUnsafe`, `$executeRaw` y `$executeRawUnsafe` en la extensión. Retiro de `prisma.$base` del runtime. |
| **Desconexión de kioscos del piloto tras el corte** | Alto | Media | Ventana de gracia de 72 h configurable por variable de entorno, emitiendo el nuevo token permanente en la cabecera `x-migrated-device-token`. |
| **Resurrección de datos personales tras restaurar respaldo** | Alto | Baja | Retención máxima de 30 días en respaldos; registro inmutable en `RevokedCompanyPurgeLedger` fuera de la base y script manual obligatorio de reconciliación post-restauración. |
| **Saturación de memoria RAM por faceMath** | Medio | Media | 14,000 vectores requieren menos de 15 MB de RAM. Proceso único de Node.js documentado y validado en prueba de carga k6. |
| **Pérdida de integridad referencial durante migración** | Crítico | Baja | Auditoría obligatoria de 25/25 FKs al finalizar `migrate_production.js` con detención de emergencia si falta alguna. |

---

## 7. Checklist de Salida a Producción

- [ ] Puertas Gate 1 a Gate 5 aprobadas formal y explícitamente por Gabriel.
- [ ] Base real `reconocimiento_facial_db_pain` respaldada en frío y comprobada legible.
- [ ] Escaneo de secretos en todo el historial de Git sin coincidencias (`gitleaks` y `git grep`).
- [ ] Variables `JWT_SECRET` y `ENCRYPTION_KEY` de 32 bytes configuradas en el entorno productivo con permisos de archivo estrictos.
- [ ] Usuario MariaDB `saas_app_user` aprovisionado con permisos exclusivos DML (`SELECT, INSERT, UPDATE, DELETE`).
- [ ] Suite HTTP parametrizada de 11 módulos pasando al 100% sobre base de prueba.
- [ ] Ensayo con volcado real del cliente completado exitosamente con 100% de descriptores válidos (128 floats).
- [ ] Contenedores Docker listos sin mapeo de puertos públicos para la base de datos.
- [ ] Notificación formal de inicio de ventana de mantenimiento al cliente piloto.

---

## 8. Dudas Técnicas para Gabriel

1. **Fecha de Vencimiento de Gracia del Piloto:**  
   Para la variable `KIOSK_GRACE_EXPIRATION_DATE`, ¿deseas que se calcule automáticamente como `FECHA_DESPLIEGUE + 72h` o que se defina como una fecha ISO fija en el archivo `.env` de producción?
2. **Infraestructura Actual del Piloto:**  
   ¿Confirmas si la base `reconocimiento_facial_db_pain` en el puerto local 3307 es un volcado de desarrollo y si la base productiva del piloto corre actualmente en el VPS de Hostinger bajo el puerto 3306?

---

## Anexo: Estado Compacto de los 28 Requisitos

| Requisito | Estado | Evidencia Real en Código / Prueba |
| :--- | :---: | :--- |
| **A1. Prisma 14 ops, nested writes, raw bloqueado** | **PARCIAL** | 14 ops y bloqueo raw probados en `prisma.js:42-177`. Falta sanitizar nested writes (`connect`). |
| **A2. Eliminar prisma.$base del runtime y aislar prismaAdmin** | **PENDIENTE** | `prisma.$base` aún expuesto en `prisma.js:180`. Falta `prismaAdmin.js` y regla de importación. |
| **A3. Reemplazar excepciones por helpers estrechos** | **PENDIENTE** | Excepciones abiertas en `prisma.js:70-84`. Faltan `findAdminByEmailForLogin` y `createPairingRequest`. |
| **A4. Justificar y proteger relaciones sin FK compuesta** | **PENDIENTE** | Relaciones `AdminUser.createdBy`, etc. identificadas en `schema.prisma`. Falta validación y pruebas. |
| **A5. Empresa suspendida: 403 en JWT, kiosco y sockets** | **PARCIAL** | 403 activo en JWT y `/descriptors`. Falta middleware de kiosco y desconexión forzada de sockets. |
| **A6. Socket.io acotado a company_${id} sin salas globales** | **PARCIAL** | Handshake y salas de tenant probados. Faltan llamadas a `io.to('dashboard')` en `app.js:137`. |
| **A7. maxEmployees, maxDevices y acotamiento adminEmployeeSync** | **PARCIAL** | Scoping probado en `test_item6_adminsync.js`. Falta validar límites de plan en creación. |
| **B1. Eliminar claves estáticas, ventana 72 h y tokenHash** | **PENDIENTE** | `requireApiKey.js:3` usa clave estática. Faltan ventana de 72 h y anulación de `Device.token` plano. |
| **B2. Emparejamiento 2 pasos, sessionStorage y cron** | **PARCIAL** | 2 pasos y cron activos en backend. Falta guardar en `sessionStorage` en `KioskSetupPage.jsx`. |
| **B3. /descriptors con token, 120 req/h, ETag y auditoría** | **PARCIAL** | ETag/304 activo en `employees.router.js:8`. Faltan rate limit 120 req/h, auditoría y alertas. |
| **B4. Frontend de kiosco con x-device-token y manejo 401** | **PENDIENTE** | Kiosco en frontend sigue usando cabecera legacy `x-api-key`. |
| **B5. Login IP+email, cookies Strict, CSRF, JWT 32B, CORS** | **PARCIAL** | `trust proxy` y JWT de 32B activos. Faltan rate limit IP+email, cookies `Strict` y CORS restrictivo. |
| **C1. migrate_production.js: app detenida, --confirm, 25 FKs** | **HECHO** | Validado en `migrate_production.js`: `--confirm`, `--expected-db`, Paso 0 y 25/25 FKs auditadas. |
| **C2. Paridad tras cada cambio de esquema** | **PARCIAL** | Paridad verificada en Gate 1 (`diff --exit-code = 0`). Debe repetirse tras cada cambio de esquema. |
| **C3. Ensayo con volcado fiel del cliente y 128 floats** | **PARCIAL** | Probado en copia local (`test_item1_faithful_clone.js`). Falta ensayo con mysqldump del cliente real. |
| **C4. Usuarios MariaDB separados (DDL vs saas_app_user DML)** | **PENDIENTE** | `saas_app_user` no creado aún en el motor de producción. |
| **C5. Secretos estrictos, .env.example y script rotación** | **PARCIAL** | `secrets.js` valida 32B en arranque. Falta script de rotación de `ENCRYPTION_KEY`. |
| **C6. Eliminar photoRetentionDays de esquema y UI** | **PENDIENTE** | Campo `photoRetentionDays` aún presente en `schema.prisma:345` y vistas de settings. |
| **D1. Respaldos diarios GPG a S3, retención 30 días** | **PENDIENTE** | Script automatizado de respaldo diario GPG hacia S3 pendiente de desarrollo. |
| **D2. Purga ARCO topológica en 8 fases probada en clon** | **HECHO** | Demostrado en `verify_item2_company_purge.js` con 13 tablas dependientes y 0 errores de FK. |
| **D3. RevokedCompanyPurgeLedger fuera de BD y script** | **PENDIENTE** | Libro mayor fuera de la base respaldada y script de reconciliación pendientes de codificación. |
| **D4. Terminología legal: biometría sensible, Responsable/Encargado** | **HECHO** | Textos saneados en el plan: "irreversible" eliminado para biometría; aviso legal incluido. |
| **E1. Cron multiempresa por timezone e idempotencia** | **PARCIAL** | Timezone activo en `attendanceCron.js`. Falta conectar `Company.lastAbsenceDateRun`. |
| **E2. syncFaceCache con invalidación selectiva y proceso único** | **PARCIAL** | RAM particionada por empresa. Falta función de recarga selectiva `reloadCompanyFaceCache`. |
| **E3. Prueba de carga masiva k6 (400 empresas, 14k emp, 3M asist)** | **PENDIENTE** | Escenario documentado; siembra y ejecución de k6 pendientes para Gate 5. |
| **F1. Suite HTTP parametrizada de 11 módulos + Super Admin** | **PARCIAL** | Validados departamentos y turnos en `test_routers_http_real.js`. Matriz completa pendiente. |
| **F2. Matriz de Prisma con 5 contextos y mutaciones** | **PARCIAL** | 4 contextos y 4 mutaciones probadas en `test_prisma_comprehensive_matrix.test.js`. Falta 5º contexto. |
| **F3. Pruebas exclusivamente sobre test y con limpieza** | **PARCIAL** | Pruebas corren en bases test. Limpieza sistemática en teardown en proceso de estandarización. |
| **G1. Docker, GitHub Actions, Cloudflare, Nginx, sin puerto público** | **PENDIENTE** | Tareas de contenedorización e infraestructura programadas para Gate 5. |
| **G2. Migración no compatible con ventana y punto de no retorno** | **PARCIAL** | Procedimiento documentado en `migrate_production.js`. Falta ensayar el simulacro de contingencia. |
| **G3. Procedimiento de refresco de kioscos del piloto** | **PENDIENTE** | Procedimiento operativo programado para Gate 5. |
| **G4. Soft launch con piloto y 1-2 betas durante 2-3 semanas** | **PENDIENTE** | Criterios de salida y monitoreo programados para Gate 6. |

---

```
FIN DEL PLAN v3.1 - DETENIDO A LA ESPERA DE TU APROBACIÓN PARA INICIAR GATE 3A
```
