/**
 * Generador de script SQL puro para phpMyAdmin en Hostinger
 */
const fs = require('fs');
const path = require('path');

const sql = `-- ====================================================================
-- SCRIPT DE MIGRACIÓN SAAS MULTI-TENANCY PARA HOSTINGER (phpMyAdmin)
-- Base de datos: u493510526_reconfpain_db
-- ====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- 0. Desvincular claves foráneas antiguas de la arquitectura previa
-- -------------------------------------------------------------
ALTER TABLE \`DepartmentShift\` DROP FOREIGN KEY IF EXISTS \`DepartmentShift_departmentId_fkey\`;
ALTER TABLE \`DepartmentShift\` DROP FOREIGN KEY IF EXISTS \`DepartmentShift_shiftId_fkey\`;
ALTER TABLE \`EmployeeShift\` DROP FOREIGN KEY IF EXISTS \`EmployeeShift_employeeId_fkey\`;
ALTER TABLE \`EmployeeShift\` DROP FOREIGN KEY IF EXISTS \`EmployeeShift_shiftId_fkey\`;
ALTER TABLE \`AttendanceRecord\` DROP FOREIGN KEY IF EXISTS \`AttendanceRecord_employeeId_fkey\`;
ALTER TABLE \`AttendanceRecord\` DROP FOREIGN KEY IF EXISTS \`AttendanceRecord_shiftId_fkey\`;
ALTER TABLE \`AttendanceRecord\` DROP FOREIGN KEY IF EXISTS \`AttendanceRecord_deviceId_fkey\`;
ALTER TABLE \`Employee\` DROP FOREIGN KEY IF EXISTS \`Employee_departmentId_fkey\`;
ALTER TABLE \`Notification\` DROP FOREIGN KEY IF EXISTS \`Notification_employeeId_fkey\`;
ALTER TABLE \`EventRequest\` DROP FOREIGN KEY IF EXISTS \`EventRequest_employeeId_fkey\`;
ALTER TABLE \`EventRequest\` DROP FOREIGN KEY IF EXISTS \`EventRequest_registeredById_fkey\`;
ALTER TABLE \`AdminUser\` DROP FOREIGN KEY IF EXISTS \`AdminUser_createdBy_fkey\`;

-- -------------------------------------------------------------
-- 1. Crear tabla Company si no existe
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`Company\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NOT NULL,
  \`slug\` VARCHAR(191) NOT NULL,
  \`customDomain\` VARCHAR(191) NULL,
  \`plan\` VARCHAR(191) NOT NULL DEFAULT 'STARTER',
  \`isActive\` BOOLEAN NOT NULL DEFAULT TRUE,
  \`suspendedAt\` DATETIME(3) NULL,
  \`suspensionReason\` VARCHAR(191) NULL,
  \`suspendedById\` VARCHAR(191) NULL,
  \`suspendedByName\` VARCHAR(191) NULL,
  \`suspensionGraceDays\` INT NULL DEFAULT 30,
  \`suspensionExpiresAt\` DATETIME(3) NULL,
  \`deletionAlertSent\` BOOLEAN NOT NULL DEFAULT FALSE,
  \`deletionAlertAt\` DATETIME(3) NULL,
  \`maxEmployees\` INT NOT NULL DEFAULT 50,
  \`maxDevices\` INT NOT NULL DEFAULT 3,
  \`timezone\` VARCHAR(191) NOT NULL DEFAULT 'America/Mexico_City',
  \`lastAbsenceDateRun\` DATE NULL,
  \`descriptorsVersion\` INT NOT NULL DEFAULT 1,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`Company_slug_key\` (\`slug\`),
  UNIQUE KEY \`Company_customDomain_key\` (\`customDomain\`),
  INDEX \`Company_isActive_idx\` (\`isActive\`),
  INDEX \`Company_slug_idx\` (\`slug\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2. Insertar Empresa Piloto predeterminada (PAIN)
-- -------------------------------------------------------------
INSERT INTO \`Company\` (\`id\`, \`name\`, \`slug\`, \`plan\`, \`isActive\`, \`maxEmployees\`, \`maxDevices\`, \`timezone\`)
VALUES ('default-company-pain', 'PAIN - Empresa Piloto', 'pain', 'ENTERPRISE', TRUE, 1000, 50, 'America/Mexico_City')
ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`updatedAt\` = NOW(3);

-- -------------------------------------------------------------
-- 3. Asegurar columnas companyId en las 13 tablas dependientes
-- -------------------------------------------------------------
ALTER TABLE \`Department\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`Employee\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`AttendanceRecord\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`Shift\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`DepartmentShift\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`EmployeeShift\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`Device\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`Device\` ADD COLUMN IF NOT EXISTS \`tokenHash\` VARCHAR(191) NULL;
ALTER TABLE \`EventRequest\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`Notification\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`SystemSettings\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`AdminUser\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`AdminAuditLog\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;
ALTER TABLE \`DeviceAuthRequest\` ADD COLUMN IF NOT EXISTS \`companyId\` VARCHAR(191) NULL;

-- -------------------------------------------------------------
-- 4. Asignar datos existentes a la Empresa Piloto
-- -------------------------------------------------------------
UPDATE \`Department\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`Employee\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`AttendanceRecord\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`Shift\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`DepartmentShift\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`EmployeeShift\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`Device\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`EventRequest\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`Notification\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`SystemSettings\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`AdminUser\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`AdminAuditLog\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;
UPDATE \`DeviceAuthRequest\` SET \`companyId\` = 'default-company-pain' WHERE \`companyId\` IS NULL;

-- Hashear tokens existentes de dispositivos a SHA-256
UPDATE \`Device\` SET \`tokenHash\` = SHA2(\`token\`, 256) WHERE \`token\` IS NOT NULL AND (\`tokenHash\` IS NULL OR \`tokenHash\` = '');

-- -------------------------------------------------------------
-- 5. Restricción NOT NULL en tablas requeridas
-- -------------------------------------------------------------
ALTER TABLE \`Department\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`Employee\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`AttendanceRecord\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`Shift\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`DepartmentShift\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`EmployeeShift\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`Device\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`EventRequest\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`Notification\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;
ALTER TABLE \`SystemSettings\` MODIFY \`companyId\` VARCHAR(191) NOT NULL;

-- -------------------------------------------------------------
-- 6. Limpieza de índices obsoletos de arquitectura previa
-- -------------------------------------------------------------
ALTER TABLE \`Department\` DROP INDEX IF EXISTS \`Department_name_key\`;
ALTER TABLE \`Shift\` DROP INDEX IF EXISTS \`Shift_name_key\`;
ALTER TABLE \`Employee\` DROP INDEX IF EXISTS \`Employee_identifier_key\`;
ALTER TABLE \`Employee\` DROP INDEX IF EXISTS \`Employee_email_key\`;

-- -------------------------------------------------------------
-- 7. Claves Únicas Compuestas e Índices de Rendimiento Multi-Tenant
-- -------------------------------------------------------------
ALTER TABLE \`Department\` ADD UNIQUE KEY IF NOT EXISTS \`Department_id_companyId_key\` (\`id\`, \`companyId\`);
ALTER TABLE \`Employee\` ADD UNIQUE KEY IF NOT EXISTS \`Employee_id_companyId_key\` (\`id\`, \`companyId\`);
ALTER TABLE \`Shift\` ADD UNIQUE KEY IF NOT EXISTS \`Shift_id_companyId_key\` (\`id\`, \`companyId\`);
ALTER TABLE \`AttendanceRecord\` ADD UNIQUE KEY IF NOT EXISTS \`AttendanceRecord_id_companyId_key\` (\`id\`, \`companyId\`);
ALTER TABLE \`Device\` ADD UNIQUE KEY IF NOT EXISTS \`Device_id_companyId_key\` (\`id\`, \`companyId\`);
ALTER TABLE \`AdminUser\` ADD UNIQUE KEY IF NOT EXISTS \`AdminUser_id_companyId_key\` (\`id\`, \`companyId\`);
ALTER TABLE \`Notification\` ADD UNIQUE KEY IF NOT EXISTS \`Notification_id_companyId_key\` (\`id\`, \`companyId\`);
ALTER TABLE \`EventRequest\` ADD UNIQUE KEY IF NOT EXISTS \`EventRequest_id_companyId_key\` (\`id\`, \`companyId\`);

ALTER TABLE \`Department\` ADD UNIQUE KEY IF NOT EXISTS \`Department_companyId_name_key\` (\`companyId\`, \`name\`);
ALTER TABLE \`Shift\` ADD UNIQUE KEY IF NOT EXISTS \`Shift_companyId_name_key\` (\`companyId\`, \`name\`);
ALTER TABLE \`Employee\` ADD UNIQUE KEY IF NOT EXISTS \`Employee_companyId_identifier_key\` (\`companyId\`, \`identifier\`);
ALTER TABLE \`Employee\` ADD UNIQUE KEY IF NOT EXISTS \`Employee_companyId_email_key\` (\`companyId\`, \`email\`);
ALTER TABLE \`SystemSettings\` ADD UNIQUE KEY IF NOT EXISTS \`SystemSettings_companyId_key\` (\`companyId\`);
ALTER TABLE \`Device\` ADD UNIQUE KEY IF NOT EXISTS \`Device_tokenHash_key\` (\`tokenHash\`);

ALTER TABLE \`DepartmentShift\` ADD UNIQUE KEY IF NOT EXISTS \`DepartmentShift_departmentId_shiftId_key\` (\`departmentId\`, \`shiftId\`);
ALTER TABLE \`EmployeeShift\` ADD UNIQUE KEY IF NOT EXISTS \`EmployeeShift_employeeId_shiftId_key\` (\`employeeId\`, \`shiftId\`);

ALTER TABLE \`Department\` ADD INDEX IF NOT EXISTS \`Department_companyId_idx\` (\`companyId\`);
ALTER TABLE \`Shift\` ADD INDEX IF NOT EXISTS \`Shift_companyId_idx\` (\`companyId\`);
ALTER TABLE \`AdminUser\` ADD INDEX IF NOT EXISTS \`AdminUser_companyId_idx\` (\`companyId\`);
ALTER TABLE \`AdminAuditLog\` ADD INDEX IF NOT EXISTS \`AdminAuditLog_companyId_timestamp_idx\` (\`companyId\`, \`timestamp\`);
ALTER TABLE \`AttendanceRecord\` ADD INDEX IF NOT EXISTS \`AttendanceRecord_companyId_date_idx\` (\`companyId\`, \`date\`);
ALTER TABLE \`AttendanceRecord\` ADD INDEX IF NOT EXISTS \`AttendanceRecord_companyId_employeeId_date_idx\` (\`companyId\`, \`employeeId\`, \`date\`);
ALTER TABLE \`AttendanceRecord\` ADD INDEX IF NOT EXISTS \`AttendanceRecord_companyId_deviceId_idx\` (\`companyId\`, \`deviceId\`);
ALTER TABLE \`Employee\` ADD INDEX IF NOT EXISTS \`Employee_companyId_isActive_idx\` (\`companyId\`, \`isActive\`);
ALTER TABLE \`Employee\` ADD INDEX IF NOT EXISTS \`Employee_companyId_departmentId_idx\` (\`companyId\`, \`departmentId\`);
ALTER TABLE \`EventRequest\` ADD INDEX IF NOT EXISTS \`EventRequest_companyId_employeeId_date_type_idx\` (\`companyId\`, \`employeeId\`, \`date\`, \`type\`);
ALTER TABLE \`EventRequest\` ADD INDEX IF NOT EXISTS \`EventRequest_companyId_date_status_idx\` (\`companyId\`, \`date\`, \`status\`);
ALTER TABLE \`Notification\` ADD INDEX IF NOT EXISTS \`Notification_companyId_isRead_createdAt_idx\` (\`companyId\`, \`isRead\`, \`createdAt\`);
ALTER TABLE \`Notification\` ADD INDEX IF NOT EXISTS \`Notification_employeeId_companyId_idx\` (\`employeeId\`, \`companyId\`);
ALTER TABLE \`DepartmentShift\` ADD INDEX IF NOT EXISTS \`DepartmentShift_companyId_idx\` (\`companyId\`);
ALTER TABLE \`EmployeeShift\` ADD INDEX IF NOT EXISTS \`EmployeeShift_companyId_idx\` (\`companyId\`);
ALTER TABLE \`Device\` ADD INDEX IF NOT EXISTS \`Device_companyId_status_idx\` (\`companyId\`, \`status\`);
ALTER TABLE \`Device\` ADD INDEX IF NOT EXISTS \`Device_tokenHash_idx\` (\`tokenHash\`);
ALTER TABLE \`DeviceAuthRequest\` ADD INDEX IF NOT EXISTS \`DeviceAuthRequest_companyId_status_idx\` (\`companyId\`, \`status\`);

-- -------------------------------------------------------------
-- 8. Claves Foráneas con ON DELETE RESTRICT hacia Company
-- -------------------------------------------------------------
ALTER TABLE \`Department\` ADD CONSTRAINT \`Department_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`Employee\` ADD CONSTRAINT \`Employee_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`AttendanceRecord\` ADD CONSTRAINT \`AttendanceRecord_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`Shift\` ADD CONSTRAINT \`Shift_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`DepartmentShift\` ADD CONSTRAINT \`DepartmentShift_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`EmployeeShift\` ADD CONSTRAINT \`EmployeeShift_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`Device\` ADD CONSTRAINT \`Device_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`EventRequest\` ADD CONSTRAINT \`EventRequest_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`Notification\` ADD CONSTRAINT \`Notification_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`SystemSettings\` ADD CONSTRAINT \`SystemSettings_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`AdminUser\` ADD CONSTRAINT \`AdminUser_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`AdminAuditLog\` ADD CONSTRAINT \`AdminAuditLog_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`DeviceAuthRequest\` ADD CONSTRAINT \`DeviceAuthRequest_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`companyId\`) REFERENCES \`Company\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Claves foráneas compuestas estrictas intra-inquilino
ALTER TABLE \`Employee\` ADD CONSTRAINT \`Employee_departmentId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`departmentId\`, \`companyId\`) REFERENCES \`Department\`(\`id\`, \`companyId\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`AttendanceRecord\` ADD CONSTRAINT \`AttendanceRecord_employeeId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`employeeId\`, \`companyId\`) REFERENCES \`Employee\`(\`id\`, \`companyId\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`AttendanceRecord\` ADD CONSTRAINT \`AttendanceRecord_shiftId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`shiftId\`, \`companyId\`) REFERENCES \`Shift\`(\`id\`, \`companyId\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`AttendanceRecord\` ADD CONSTRAINT \`AttendanceRecord_deviceId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`deviceId\`, \`companyId\`) REFERENCES \`Device\`(\`id\`, \`companyId\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`DepartmentShift\` ADD CONSTRAINT \`DepartmentShift_departmentId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`departmentId\`, \`companyId\`) REFERENCES \`Department\`(\`id\`, \`companyId\`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \`DepartmentShift\` ADD CONSTRAINT \`DepartmentShift_shiftId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`shiftId\`, \`companyId\`) REFERENCES \`Shift\`(\`id\`, \`companyId\`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \`EmployeeShift\` ADD CONSTRAINT \`EmployeeShift_employeeId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`employeeId\`, \`companyId\`) REFERENCES \`Employee\`(\`id\`, \`companyId\`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \`EmployeeShift\` ADD CONSTRAINT \`EmployeeShift_shiftId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`shiftId\`, \`companyId\`) REFERENCES \`Shift\`(\`id\`, \`companyId\`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \`EventRequest\` ADD CONSTRAINT \`EventRequest_employeeId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`employeeId\`, \`companyId\`) REFERENCES \`Employee\`(\`id\`, \`companyId\`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE \`Notification\` ADD CONSTRAINT \`Notification_employeeId_companyId_fkey\` FOREIGN KEY IF NOT EXISTS (\`employeeId\`, \`companyId\`) REFERENCES \`Employee\`(\`id\`, \`companyId\`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE \`AdminUser\` ADD CONSTRAINT \`AdminUser_createdBy_fkey\` FOREIGN KEY IF NOT EXISTS (\`createdBy\`) REFERENCES \`AdminUser\`(\`id\`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE \`EventRequest\` ADD CONSTRAINT \`EventRequest_registeredById_fkey\` FOREIGN KEY IF NOT EXISTS (\`registeredById\`) REFERENCES \`AdminUser\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- FIN DE LA MIGRACIÓN
-- ====================================================================
`;

fs.writeFileSync(path.join(__dirname, 'hostinger_production_migration.sql'), sql, 'utf8');
console.log('Script SQL generado exitosamente en backend/scripts/hostinger_production_migration.sql');
