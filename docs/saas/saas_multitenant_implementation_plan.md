# Plan Maestro de Implementación SaaS Multi-Tenant (v3.2)

> [!IMPORTANT]
> **Estado Actual:** Gate 3A completado y cerrado con éxito (aislamiento estricto, eliminación de `$base`, `prismaAdmin`, helpers estrechos, sanitización anidada y matriz de 910 aserciones). Listo para iniciar Lote 1 de Gate 3B.  
> **Rama Oficial:** `feature/saas-multitenancy` (la rama `main` no se toca; sin push a GitHub sin autorización de Gabriel).  
> **Política de Aislamiento:** Instancia única y base de datos compartida con aislamiento estricto por `companyId` y claves compuestas InnoDB con `ON DELETE RESTRICT`.  
> **Topología de Producción:** La base real del cliente piloto es `ReconocimientoFacialProd` alojada en Hostinger (puerto 3306); `reconocimiento_facial_db_pain` en puerto local 3307 es una réplica de desarrollo. Todas las pruebas corren bajo `saas_test_user` acotado exclusivamente a `reconocimiento_test_%`.

---

## 1. Arquitectura

```mermaid
flowchart TB
    subgraph Edge["Perímetro & Seguridad (Cloudflare / Nginx Reverse Proxy)"]
        WAF["WAF & Terminación TLS 1.3\nStrict CORS / Trust Proxy Hostinger / Rate Limit IP+Email"]
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
        PrismaExt["Prisma Client Extension ($extends)\n14 Operaciones ORM + Sanitización Anidada\n$queryRaw / $executeRaw Bloqueados"]
        PrismaAdmin["prismaAdmin.js (Cliente Administrativo Dedicado)\nExclusivo para Scripts y Purga ARCO"]
        AuthHelpers["authHelpers.js (Helpers de Ámbito Estrecho)\nLogin, Pairing Físico 2 Pasos y Descriptores"]
        FaceRAM["faceMath Cache (RAM - Proceso Único)\nMap<companyId, Float32Array[]>\nRecarga Selectiva por Empresa"]
        WSEngine["Socket.io Server\nSalas Estrictas: company_${companyId} & device_auth_${id}"]
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
    ALS --> AuthHelpers
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
| `prisma.js` | `backend/src/utils/prisma.js` | Modificar | Retirar `prisma.$base`; sanitizar nested writes (`create`, `connect`, `connectOrCreate`); bloquear raw queries. |
| `prismaAdmin.js` | `backend/src/utils/prismaAdmin.js` | Crear | Cliente Prisma administrativo dedicado para migraciones y scripts. |
| `authHelpers.js` | `backend/src/utils/authHelpers.js` | Crear | Helpers de ámbito estrecho `findAdminByEmailForLogin`, ciclo de vida de pairing físico y descriptores. |
| `adminEmployeeSync.js` | `backend/src/utils/adminEmployeeSync.js` | Modificar | Migrado a `prismaAdmin`; soporte para exclusión o flag según decisión de Gabriel. |
| `tenantContext.js` | `backend/src/middlewares/tenantContext.js` | Modificar | Manejar `companyId` en contexto, regla `SUPER_ADMIN` con `x-tenant-id`, rechazo 403 en empresa suspendida. |
| `requireApiKey.js` | `backend/src/middlewares/requireApiKey.js` | Modificar | Validar por `Device.tokenHash` (SHA-256); ventana de gracia con fecha ISO fija `KIOSK_GRACE_PERIOD_EXPIRES_AT`. |
| `auth.middleware.js` | `backend/src/modules/auth/auth.middleware.js` | Modificar | Eliminar `DISABLE_AUTH`; validación estricta de firma y estado activo de empresa. |
| `auth.controller.js` | `backend/src/modules/auth/auth.controller.js` | Modificar | Usar `findAdminByEmailForLogin`; cookies `SameSite=Strict`; rechazo 403 si suspendida. |
| `auth.router.js` | `backend/src/modules/auth/auth.router.js` | Modificar | Rate limit compuesto `ip + req.body.email`. |
| `employees.router.js` | `backend/src/modules/employees/employees.router.js` | Modificar | `/descriptors` con `getCompanyForDescriptors`, rate limit 120 req/h; validación de `maxEmployees` (403 PLAN_LIMIT_EXCEEDED). |
| `departments.router.js` | `backend/src/modules/departments/departments.router.js` | Modificar | Validar unicidad `companyId_name` y captura de error P2003 con HTTP 409. |
| `shifts.router.js` | `backend/src/modules/shifts/shifts.router.js` | Modificar | Validar `companyId_name` y desactivación lógica ante asistencias vinculadas. |
| `attendance.router.js` | `backend/src/modules/attendance/attendance.router.js` | Modificar | Registro con validación de dispositivo propio, captura de faltas y reportes acotados. |
| `devices.controller.js` | `backend/src/modules/devices/devices.controller.js` | Modificar | Validar `maxDevices` al aprobar; código físico obligatorio en aprobación; salas de socket acotadas. |
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
| `FaceRecognitionPage.jsx` | `frontend/src/pages/kiosk/FaceRecognitionPage.jsx` | Modificar | Interfaz principal de reconocimiento; enviar `x-device-token` y manejar HTTP 401 redirigiendo a `/kiosk/setup`. |
| `CameraScanner.jsx` | `frontend/src/components/FaceRecognition/CameraScanner.jsx` | Modificar | Componente de captura de video; optimización de captura y renderizado de canvas biométrico. |
| `DevicesPage.jsx` | `frontend/src/pages/dashboard/DevicesPage.jsx` | Modificar | Flujo de emparejamiento en 2 pasos (código físico); eliminar listado global de pendientes; indicador de tokens por migrar. |
| `SettingsPage.jsx` | `frontend/src/pages/dashboard/SettingsPage.jsx` | Modificar | Eliminar controles de `photoRetentionDays`. |
| `migrate_production.js` | `backend/scripts/migrate_production.js` | Modificar | Adaptar objetivo a `ReconocimientoFacialProd`, verificación de 25 FKs y cifrado AES-256-GCM. |
| `provision_db_users.js` | `backend/scripts/provision_db_users.js` | Crear | Generación segura de sentencias SQL para usuarios de prueba y producción leyendo contraseñas de variables de entorno. |
| `backup_database.sh` | `backend/scripts/backup_database.sh` | Crear | Respaldo diario gzip + GPG hacia almacenamiento externo con retención rodante de 30 días. |
| `rotate_encryption_key.js` | `backend/scripts/rotate_encryption_key.js` | Crear | Rotación transaccional de clave biométrica. |
| `post_restore_reconcile.js` | `backend/scripts/post_restore_reconcile.js` | Crear | Script manual con `--dry-run` para reconciliación ARCO contra libro mayor externo post-restauración. |
| `Dockerfile` | `backend/Dockerfile` | Crear | Empaquetado multi-stage de producción en Node.js 22 LTS Alpine. |
| `docker-compose.yml` | `docker-compose.yml` | Modificar | Configuración de servicios `backend`, `frontend` y `db` (aislada en red interna sin puerto público). |
| `deploy.yml` | `.github/workflows/deploy.yml` | Crear | Pipeline CI/CD con ejecución automatizada de pruebas y despliegue sobre VPS KVM. |
| `load_test_scenario.js` | `backend/tests/load/k6_load_test_scenario.js` | Crear | Script k6 para simulación de 45 RPS y rampa a saturación sobre 400 inquilinos. |
| `.env.example` | `backend/.env.example` | Modificar | Plantilla con variables sin valores reales, documentando formatos requeridos y longitud de claves. |

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
    Gate 3A: Endurecimiento Núcleo     :done, g3a, 2026-10-22, 1d
    Aprobación Gate 3A                 :milestone, after g3a, 0d
    Gate 3B Lote 1: Emp, Att, Dev      :active, g3b1, after g3a, 3d
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
- [x] 25 claves foráneas activas verificadas en InnoDB.
- [x] `prisma migrate diff --exit-code` arrojó 0 entre base generada y migrada.

---

### FASE 2 (Gate 2): Núcleo de Aislamiento Backend (Completada)
- [x] Matriz de 728 aserciones de Prisma en verde con 4 mutaciones demostradas.
- [x] Rechazo 400 a Super Admin sin tenant y 403 a empresas suspendidas demostrados.

---

### FASE 3: Módulos, Kioscos y Frontend (Gate 3)

#### Puerta 3A: Endurecimiento del Núcleo y Protección de Bases (CERRADA Y VERIFICADA)
- **Tareas Ejecutadas y Evidenciadas:**
  1. *Paso 3.0:* `saas_test_user` aprovisionado con `reconocimiento\_test\_%` sin acceso a base real (error 1044/1142 demostrado).
  2. `prismaAdmin.js` creado y aislado de `src/modules`.
  3. `prisma.$base` eliminado al 100% de la aplicación. Scanner `test_no_restricted_imports.test.js` en verde (0 violaciones en 18 archivos).
  4. `authHelpers.js` implementado con helpers estrechos y pairing endurecido.
  5. Escrituras anidadas sanitizadas en `prisma.js` (rechazo de `companyId` ajeno con `CROSS_TENANT_WRITE_DETECTED` y claves compuestas en MariaDB).
  6. Consultas raw `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe` bloqueadas con `USO_PROHIBIDO`.
  7. Matriz de pruebas ampliada a 910 aserciones (5 contextos) con determinismo estricto (`count = 7`).
  8. Higiene total de pruebas demostrada: delta = 0 en las 14 tablas de la base de datos tras dos ejecuciones completas consecutivas.

#### Puerta 3B: Módulos de Negocio (Pruebas HTTP Primero)
- **Objetivo:** Adaptar cada módulo asegurando aislamiento cross-tenant con pruebas HTTP previas.
- **Tareas:**
  1. *Lote 1 (Críticos):*
     - `employees`: Prueba HTTP de aislamiento antes del cambio -> Limitar consultas a `companyId` -> Validar `maxEmployees` (HTTP 403 `PLAN_LIMIT_EXCEEDED`) -> Confirmar prueba en verde.
     - `attendance`: Prueba HTTP antes del cambio -> Validar que el dispositivo pertenezca a la empresa -> Reportes y consultas de asistencia acotadas -> Confirmar prueba en verde.
     - `devices`: Prueba HTTP antes del cambio -> Validar `maxDevices` al aprobar -> Vinculación mediante código físico -> Confirmar prueba en verde.
     - *Punto de Revisión:* Gabriel revisa y aprueba el Lote 1 antes de tocar el resto de módulos.
  2. *Lote 2 (Módulos Restantes):*
     - `departments`: Unicidad `companyId_name` y error P2003 -> HTTP 409.
     - `shifts`: Desactivación lógica ante asistencias vinculadas.
     - `notifications` y `events`: Aislamiento por inquilino y validación de `registeredById`.
     - `admins`: Aislamiento por inquilino y validación de `createdBy`.
     - `reports`: Exportaciones CSV estrictamente acotadas al inquilino.
     - `settings`: Configuración por inquilino; retirar `photoRetentionDays`.
- **Criterios de Aceptación:**
  - [ ] Para cada módulo: prueba HTTP escrita y fallando/validando ANTES de modificar el código.
  - [ ] Para cada módulo: prueba HTTP en verde tras el cambio demostrando que ningún inquilino ve datos de otro.
  - [ ] Límite de plan: HTTP 403 con `{ error: "PLAN_LIMIT_EXCEEDED", message }` ante exceso de empleados o dispositivos.

#### Puerta 3C: Kioscos, Ventana de Gracia, Sockets y Frontend
- **Objetivo:** Blindar el flujo del kiosco, migrar WebSockets a salas por empresa y actualizar la UI.
- **Tareas:**
  1. Kiosco: `requireApiKey.js` validando `tokenHash` (SHA-256). Ventana de gracia fija configurable `KIOSK_GRACE_PERIOD_EXPIRES_AT`.
  2. Endpoint `/descriptors`: validar `x-device-token` permanente, rate limit 120 req/h, auditoría y alertas >30 req/5min.
  3. WebSockets: aislar salas a `company_${companyId}`, desconexión forzada si la empresa es suspendida.
  4. Frontend:
     - `KioskSetupPage.jsx`: guardar `requestId` y `pairingCode` en `sessionStorage`.
     - `FaceRecognitionPage.jsx` y `CameraScanner.jsx`: enviar `x-device-token`, capturar 401 y redirigir a setup.
     - `DevicesPage.jsx`: eliminar listado global de pendientes; flujo de aprobación en 2 pasos con código físico e indicador de tokens pendientes de migrar.
- **Criterios de Aceptación:**
  - [ ] Kiosco opera con `x-device-token` permanente.
  - [ ] Prueba de Socket.io sobre `app.js` real confirma que eventos de Alpha no llegan a Beta.
  - [ ] KioskSetupPage no genera solicitudes duplicadas al recargar la página.

---

## 4. Migración, Despliegue, Rollback y Punto de No Retorno

### Análisis de Topología Actual en Hostinger
- **Evidencia del Código:**
  - En `server.js` (raíz): los logs se redirigen a `hostinger-error.log`. Esto responde al patrón de arranque de aplicaciones Node.js bajo **Passenger / CloudLinux (hPanel Node.js Application Manager)** de Hostinger.
  - En `.env.production`: `DATABASE_URL="mysql://root:admin123@localhost:3306/ReconocimientoFacialProd"` confirma que la base productiva real corre en el MySQL de Hostinger en el puerto estándar 3306.
  - En `backend/src/app.js`: `app.set('trust proxy', 1);` confirma que corre detrás del proxy inverso de Hostinger.
  - En `package.json`: el script `build` ejecuta `npx prisma db push --accept-data-loss`, lo cual es extremadamente peligroso para producción.
  - En el servidor actual **no se está usando Docker** para la aplicación en vivo (arranca como proceso gestionado por Passenger).

### Comparativa de Estrategias de Salida a Producción

| Dimensión | Estrategia A: Migrar en Servidor Actual Hostinger | Estrategia B: Servidor Nuevo VPS/KVM con Docker Compose (RECOMENDADA) |
| :--- | :--- | :--- |
| **Arquitectura** | Proceso Node.js directo vía Passenger + MySQL 3306 local. | Contenedores Docker (`backend`, `frontend`, `db`) en red interna aislada. |
| **Riesgo Operativo** | **ALTO**. Modifica la base `ReconocimientoFacialProd` directamente en el servidor activo del cliente piloto. | **MÍNIMO**. El servidor actual de Hostinger permanece 100% intacto y operativo durante todo el montaje. |
| **Ensayos Previos** | Imposible ensayar con datos reales en el mismo servidor sin alterar la base activa. | Se restaura un volcado de `ReconocimientoFacialProd` en el nuevo KVM y se ensaya la migración al 100%. |
| **Procedimiento de Rollback** | Complejo y lento: requiere restaurar dump manual de contingencia sobre MySQL activo. | **Inmediato**: solo se revierte el cambio de DNS hacia la IP del servidor Hostinger viejo. |
| **Ventana de Mantenimiento** | Downtime de 30 a 60 minutos con la base detenida. | Cutover rápido (10-15 min) para sincronizar el delta final de asistencias y cambiar el DNS. |
| **Seguridad de Red** | Puerto 3306 abierto localmente; secretos en filesystem compartido. | MariaDB sin puerto expuesto hacia Internet; secretos inyectados por entorno Docker. |

> [!TIP]
> **Recomendación Técnica:** Se recomienda firmemente la **Estrategia B**. Montar la nueva infraestructura sobre el VPS KVM con Docker Compose, ensayar la migración con copia fiel de `ReconocimientoFacialProd`, y realizar el cutover mediante DNS. Si surge cualquier problema imprevisto, el rollback consiste en revertir el DNS en Cloudflare en segundos, garantizando cero riesgo de pérdida de servicio para el cliente piloto.

### Procedimiento de Despliegue (Estrategia B - KVM con Docker)
1. **Montaje Previo (Sin Afectar Producción):**
   - Levantar stack Docker en el nuevo servidor KVM con `docker-compose.yml`.
   - Crear usuarios de BD: `saas_app_user` (DML) y `saas_migrator` (DDL).
2. **Ventana de Mantenimiento y Sincronización:**
   - Detener temporalmente el acceso de nuevos registros en el servidor viejo.
   - Extraer volcado final de `ReconocimientoFacialProd` desde Hostinger:
     `mysqldump -u root -p --single-transaction --quick ReconocimientoFacialProd > dump_final_hostinger.sql`
   - Restaurar el volcado en el MariaDB del KVM.
3. **Ejecución de la Migración:**
   - Ejecutar en el KVM:
     `node backend/scripts/migrate_production.js --confirm --expected-db=ReconocimientoFacialProd`
   - Validar 25/25 claves foráneas activas y descifrado de vectores biométricos.
4. **Cutover de Tráfico:**
   - Actualizar el registro DNS de la API y el Kiosco hacia la IP del nuevo servidor KVM.
   - Verificar recepción de peticiones con `x-device-token` de gracia en el nuevo stack.

### Punto de No Retorno
- **Definición:** Se alcanza cuando se cambia el DNS y el primer kiosco registra una checada real en la base migrada del nuevo servidor.
- **Antes del Punto de No Retorno:** Si la migración falla en el KVM, se cancela el cambio de DNS y el servidor Hostinger original sigue atendiendo sin interrupción.
- **Después del Punto de No Retorno:** Queda prohibido restaurar volcados antiguos. Toda incidencia se atiende mediante Hotfix hacia adelante.

---

## 5. Pruebas de Carga (k6)

### Escenario de Saturación y Métricas
- **Siembra:** 400 empresas, 14,000 empleados con vectores válidos y 3,000,000 de asistencias.
- **Tráfico:** 70% checadas biométricas, 15% consultas hoy, 10% Socket.io, 5% exportaciones CSV.
- **Línea Base:** 45 RPS sostenidos durante 10 minutos (latencia p95 < 500 ms, error rate < 0.1%).
- **Rampa al Límite:** Identificación empírica del límite de saturación de CPU y memoria.

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación Implementada |
| :--- | :---: | :---: | :--- |
| **Filtración cross-tenant en consultas directas** | Baja | Crítico | Extensión de Prisma intercepta 100% de operaciones en 13 modelos; bloqueo de raw queries. |
| **Inyección cross-tenant en escrituras anidadas** | Baja | Crítico | `sanitizeNestedWrites` rechaza `companyId` ajeno con `CROSS_TENANT_WRITE_DETECTED` y MariaDB valida FKs compuestas. |
| **Secuestro de kiosco por conocimiento de UUID** | Baja | Alto | Aprobación exige obligatoriamente el `pairingCode` físico de 8 caracteres; socket broadcast a dashboard eliminado. |
| **Fuga de datos por token de dispositivo reutilizado** | Baja | Alto | Tokens migrados a hashes SHA-256 (`tokenHash`); ventana de gracia fija en `.env`. |
| **Corrupción de base productiva durante migración** | Baja | Crítico | Estrategia B: migración en servidor KVM nuevo con servidor Hostinger intacto como rollback. |
| **Contraseñas expuestas en historial de Git** | Media | Alto | Scanner exhaustivo ejecutado; propuesta de saneamiento con `git-filter-repo` y rotación total de claves. |

---

## 7. Checklist de Salida a Producción

- [ ] Todas las 25 claves foráneas compuestas activas y validadas en MariaDB.
- [ ] `prismaAdmin` con 0 importaciones en `src/modules/` (verificado con scanner automatizado).
- [ ] Bloqueo de `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, `$executeRawUnsafe` en verde.
- [ ] Pruebas HTTP Supertest para cada módulo de negocio pasando con 0 violaciones de inquilino.
- [ ] Dispositivos operando con hash SHA-256 (`tokenHash`) y ventana de gracia configurada con fecha fija.
- [ ] Base de datos sin puertos expuestos públicamente en red Docker.
- [ ] Respaldo diario en frío con cifrado GPG y retención de 30 días documentado y probado.
- [ ] Saneamiento de historial de Git completado y credenciales rotadas.
- [ ] Aprobación formal de Gabriel en cada una de las puertas Gate 3A, 3B, 3C, 4, 5 y 6.

---

## 8. Dudas Resueltas y Alineadas con Gabriel

1. **Usuario de pruebas:** Implementado `saas_test_user` acotado exclusivamente a `reconocimiento\_test\_%`.
2. **Tokens de kiosco:** Permanentes con `lastSeenAt`, revocación en 1 clic y auditoría; sin rotación por ahora.
3. **Límites de plan:** HTTP 403 con `{ error: "PLAN_LIMIT_EXCEEDED", message }` exclusivo para creación de nuevos empleados o dispositivos; checadas de empleados existentes nunca se interrumpen.
4. **Validación legal y titularidad:** Confirmada titularidad del código y revisión contractual para el piloto.
5. **Topología de producción:** Confirmado que la base real es `ReconocimientoFacialProd` en Hostinger (puerto 3306), sin Docker actualmente.
6. **Estrategia de despliegue:** Propuesta de migración en servidor nuevo KVM (Estrategia B) a la espera de la decisión final de Gabriel.

---

## Anexo: Estado de los 28 Requisitos de Implementación

| Requisito | Estado | Evidencia Real |
| :--- | :---: | :--- |
| **A1. $extends de Prisma con 14 operaciones** | **CUMPLIDO** | Matriz de 910 aserciones en verde (`test_prisma_comprehensive_matrix.test.js`). |
| **A2. Prohibición estricta de imports de prismaAdmin** | **CUMPLIDO** | Scanner `test_no_restricted_imports.test.js` en verde (0 violaciones en 18 archivos de `src/modules`). |
| **A3. Helpers estrechos y explícitos para auth** | **CUMPLIDO** | `authHelpers.js` implementado y consumido en `auth.controller` y `devices.controller`. |
| **A4. Relaciones sin FK compuesta justificadas** | **EN PROCESO** | Mapeadas en Gate 3A; se blindan en lógica de servicio en Gate 3B. |
| **A5. Desconexión forzada de sockets en suspensión** | **EN PROCESO** | Sala por empresa lista en `app.js`; desconexión forzada programada para Gate 3C. |
| **A6. Validación de CORS, cookies y rate limits** | **EN PROCESO** | Programado para Gate 3C y Gate 4. |
| **A7. Límites de plan maxEmployees y maxDevices** | **EN PROCESO** | Especificado formato 403; asignado a Gate 3B en `employees` y `devices`. |
| **B1. Ventana de gracia con fecha ISO fija** | **EN PROCESO** | Especificada variable `KIOSK_GRACE_PERIOD_EXPIRES_AT`; programada para Gate 3C. |
| **B2. sessionStorage en KioskSetupPage** | **EN PROCESO** | Programado para Gate 3C. |
| **B3. /descriptors con x-device-token y rate limit** | **EN PROCESO** | Migrado a `getCompanyForDescriptors`; rate limit y token asignados a Gate 3C. |
| **B4. FaceRecognitionPage y CameraScanner** | **EN PROCESO** | Nombres reales verificados; adaptación asignada a Gate 3C. |
| **B5. Sockets Kiosco sin salas globales** | **CUMPLIDO** | Broadcast a `dashboard` eliminado; eventos acotados a `device_auth_${id}` y `company_${id}`. |
| **C1. Migración con desvinculación previa de FKs** | **CUMPLIDO** | `migrate_production.js` probado en Gate 1; se adaptará a `ReconocimientoFacialProd`. |
| **C2. Paridad tras cada cambio de esquema** | **CUMPLIDO** | `prisma migrate diff --exit-code` arrojó 0 en Gate 1; se repite ante cada cambio. |
| **C3. Ensayo fiel con volcado real** | **PARCIAL** | Ensayado sobre réplica de base local; ensayo con dump de `ReconocimientoFacialProd` en Gate 5. |
| **D1. Cifrado AES-256-GCM de descriptores** | **CUMPLIDO** | Probado en `migrate_production.js` con vectores válidos de 128 floats en Gate 1. |
| **D2. Rotación de clave biométrica** | **PENDIENTE** | Script `rotate_encryption_key.js` programado para Gate 4. |
| **D3. Cero retención de fotos** | **PENDIENTE** | Retiro de `photoRetentionDays` programado para Gate 3B (`settings`). |
| **D4. Purga ARCO y libro mayor inmutable** | **PENDIENTE** | Script `post_restore_reconcile.js` programado para Gate 4. |
| **E1. Respaldo diario gzip+GPG con 30 días** | **PENDIENTE** | Script `backup_database.sh` programado para Gate 4. |
| **E2. Idempotencia en cron de inasistencias** | **EN PROCESO** | Campo `lastAbsenceDateRun` en esquema; lógica de cron asignada a Gate 3B. |
| **E3. Recarga selectiva de memoria de rostros** | **EN PROCESO** | Función `reloadCompanyFaceCache` documentada; asignada a Gate 3B. |
| **F1. Pruebas HTTP de aislamiento antes de programar** | **EN PROCESO** | Regla adoptada para Lote 1 de Gate 3B (`employees`, `attendance`, `devices`). |
| **F2. Matriz de Prisma con 5 contextos y mutaciones** | **CUMPLIDO** | 910 aserciones en verde con 5 contextos reales y 4 mutaciones demostradas. |
| **F3. Pruebas exclusivamente sobre test y con limpieza** | **CUMPLIDO** | Verificado con `verify_table_counts_determinism.js`: delta = 0 en las 14 tablas en 2 ejecuciones. |
| **G1. Docker, GitHub Actions, sin puerto público** | **PENDIENTE** | Tareas de contenedorización e infraestructura programadas para Gate 5. |
| **G2. Migración no compatible y punto de no retorno** | **PARCIAL** | Documentado en Sección 4; ensayo del simulacro programado para Gate 5. |
| **G3. Procedimiento de refresco de kioscos del piloto** | **PENDIENTE** | Procedimiento operativo programado para Gate 5. |
| **G4. Soft launch con piloto y betas (2-3 semanas)** | **PENDIENTE** | Criterios de salida y monitoreo programados para Gate 6. |

---

```
FIN DEL PLAN v3.2 - GATE 3A CERRADO Y VERIFICADO - LISTO PARA GATE 3B LOTE 1
```
