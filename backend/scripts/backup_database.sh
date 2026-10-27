#!/bin/bash
# ==============================================================================
# SCRIPT DE RESPALDO AUTOMATIZADO, COMPRESIÓN Y CIFRADO ASIMÉTRICO (GATE 4)
# ==============================================================================
# Utiliza mysqldump con lectura transaccional consistente, compresión gzip,
# cifrado asimétrico GPG y rotación automática rodante de 30 días.
# ==============================================================================

set -euo pipefail

# Configuración desde variables de entorno con valores seguros
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-u493510526_reconfpain_db}"
DB_USER="${SAAS_BACKUP_USER:-saas_app_user}"
DB_PASSWORD="${SAAS_BACKUP_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/saas_db}"
GPG_RECIPIENT="${GPG_RECIPIENT:-saas-backup@painproject.internal}"
RETENTION_DAYS=30

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEMP_DUMP="${BACKUP_DIR}/dump_${DB_NAME}_${TIMESTAMP}.sql"
FINAL_BACKUP="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz.gpg"

echo "=============================================================================="
echo ">>> INICIANDO RESPALDO CIFRADO DE BASE DE DATOS: ${DB_NAME}"
echo "=============================================================================="

# 1. Validaciones previas de herramientas obligatorias
command -v mysqldump >/dev/null 2>&1 || { echo "❌ ERROR: mysqldump no está instalado."; exit 1; }
command -v gzip >/dev/null 2>&1 || { echo "❌ ERROR: gzip no está instalado."; exit 1; }
command -v gpg >/dev/null 2>&1 || { echo "❌ ERROR: gpg no está instalado."; exit 1; }

# 2. Validación de contraseña
if [ -z "${DB_PASSWORD}" ]; then
  echo "❌ ERROR: La variable SAAS_BACKUP_PASSWORD no está definida."
  exit 1
fi

# 3. Validación de destinatario y llave pública GPG
if ! gpg --list-keys "${GPG_RECIPIENT}" >/dev/null 2>&1; then
  echo "❌ ERROR CRÍTICO: La llave pública GPG para '${GPG_RECIPIENT}' no existe en el keyring."
  echo "Operación abortada por seguridad: no se generarán respaldos sin cifrar."
  exit 1
fi

# 4. Crear directorio de respaldos si no existe con permisos restringidos
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

echo "1. Ejecutando volcado consistente con mysqldump..."
# mysqldump con --single-transaction garantiza consistencia InnoDB sin bloquear lecturas
if ! mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASSWORD}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "${DB_NAME}" > "${TEMP_DUMP}"; then
  echo "❌ ERROR: Falló el volcado con mysqldump. Abortando respaldo."
  rm -f "${TEMP_DUMP}"
  exit 1
fi

echo "2. Comprimiendo con gzip y cifrando con GPG (${GPG_RECIPIENT})..."
if ! gzip -c "${TEMP_DUMP}" | gpg --encrypt --recipient "${GPG_RECIPIENT}" --output "${FINAL_BACKUP}"; then
  echo "❌ ERROR: Falló la compresión o el cifrado GPG. Abortando."
  rm -f "${TEMP_DUMP}" "${FINAL_BACKUP}"
  exit 1
fi

# Eliminar archivo SQL sin cifrar de forma segura
rm -f "${TEMP_DUMP}"
chmod 600 "${FINAL_BACKUP}"

BACKUP_SIZE=$(ls -lh "${FINAL_BACKUP}" | awk '{print $5}')
echo "✓ Respaldo generado y cifrado exitosamente: ${FINAL_BACKUP} (${BACKUP_SIZE})"

# 5. Rotación rodante de respaldos antiguos (> 30 días)
echo "3. Aplicando rotación rodante de 30 días..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -type f -name "backup_${DB_NAME}_*.sql.gz.gpg" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "✓ Archivos de respaldo rotados/purgados (> ${RETENTION_DAYS} días): ${DELETED_COUNT}"

echo "=============================================================================="
echo "✓ PROCESO DE RESPALDO COMPLETADO EXITOSAMENTE"
echo "=============================================================================="
exit 0

