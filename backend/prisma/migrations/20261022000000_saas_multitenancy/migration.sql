-- DropForeignKey
ALTER TABLE `adminuser` DROP FOREIGN KEY `AdminUser_createdBy_fkey`;

-- DropForeignKey
ALTER TABLE `attendancerecord` DROP FOREIGN KEY `AttendanceRecord_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `attendancerecord` DROP FOREIGN KEY `AttendanceRecord_shiftId_fkey`;

-- DropForeignKey
ALTER TABLE `departmentshift` DROP FOREIGN KEY `DepartmentShift_departmentId_fkey`;

-- DropForeignKey
ALTER TABLE `departmentshift` DROP FOREIGN KEY `DepartmentShift_shiftId_fkey`;

-- DropForeignKey
ALTER TABLE `employee` DROP FOREIGN KEY `Employee_departmentId_fkey`;

-- DropForeignKey
ALTER TABLE `employeeshift` DROP FOREIGN KEY `EmployeeShift_employeeId_fkey`;

-- DropForeignKey
ALTER TABLE `employeeshift` DROP FOREIGN KEY `EmployeeShift_shiftId_fkey`;

-- DropTable
DROP TABLE `adminauditlog`;

-- DropTable
DROP TABLE `adminuser`;

-- DropTable
DROP TABLE `attendancerecord`;

-- DropTable
DROP TABLE `department`;

-- DropTable
DROP TABLE `departmentshift`;

-- DropTable
DROP TABLE `employee`;

-- DropTable
DROP TABLE `employeeshift`;

-- DropTable
DROP TABLE `notification`;

-- DropTable
DROP TABLE `shift`;

-- DropTable
DROP TABLE `systemsettings`;

-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `customDomain` VARCHAR(191) NULL,
    `plan` VARCHAR(191) NOT NULL DEFAULT 'STARTER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `maxEmployees` INTEGER NOT NULL DEFAULT 50,
    `maxDevices` INTEGER NOT NULL DEFAULT 3,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Mexico_City',
    `lastAbsenceDateRun` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Company_slug_key`(`slug`),
    UNIQUE INDEX `Company_customDomain_key`(`customDomain`),
    INDEX `Company_isActive_idx`(`isActive`),
    INDEX `Company_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Department_companyId_idx`(`companyId`),
    UNIQUE INDEX `Department_companyId_name_key`(`companyId`, `name`),
    UNIQUE INDEX `Department_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `departmentId` INTEGER NULL,
    `faceDescriptor` TEXT NULL,
    `enrolledAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Employee_companyId_isActive_idx`(`companyId`, `isActive`),
    INDEX `Employee_companyId_departmentId_idx`(`companyId`, `departmentId`),
    INDEX `Employee_identifier_idx`(`identifier`),
    UNIQUE INDEX `Employee_companyId_identifier_key`(`companyId`, `identifier`),
    UNIQUE INDEX `Employee_companyId_email_key`(`companyId`, `email`),
    UNIQUE INDEX `Employee_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `entrada` DATETIME(3) NULL,
    `recesoInicio` DATETIME(3) NULL,
    `recesoFin` DATETIME(3) NULL,
    `salida` DATETIME(3) NULL,
    `shiftId` INTEGER NULL,
    `earlyExit` BOOLEAN NOT NULL DEFAULT false,
    `earlyExitReason` TEXT NULL,
    `overtimeMinutes` INTEGER NULL,
    `isLate` BOOLEAN NOT NULL DEFAULT false,
    `lateMinutes` INTEGER NULL,
    `isAutoClosed` BOOLEAN NOT NULL DEFAULT false,
    `deviceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceRecord_companyId_date_idx`(`companyId`, `date`),
    INDEX `AttendanceRecord_companyId_employeeId_date_idx`(`companyId`, `employeeId`, `date`),
    INDEX `AttendanceRecord_companyId_deviceId_idx`(`companyId`, `deviceId`),
    INDEX `AttendanceRecord_employeeId_date_idx`(`employeeId`, `date`),
    INDEX `AttendanceRecord_date_idx`(`date`),
    INDEX `AttendanceRecord_deviceId_idx`(`deviceId`),
    UNIQUE INDEX `AttendanceRecord_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shift` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `tolerance` INTEGER NULL,
    `breakStartTime` VARCHAR(191) NULL,
    `breakEndTime` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Shift_companyId_idx`(`companyId`),
    UNIQUE INDEX `Shift_companyId_name_key`(`companyId`, `name`),
    UNIQUE INDEX `Shift_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DepartmentShift` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` VARCHAR(191) NOT NULL,
    `departmentId` INTEGER NOT NULL,
    `shiftId` INTEGER NOT NULL,

    INDEX `DepartmentShift_companyId_idx`(`companyId`),
    UNIQUE INDEX `DepartmentShift_departmentId_shiftId_key`(`departmentId`, `shiftId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeShift` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `shiftId` INTEGER NOT NULL,

    INDEX `EmployeeShift_companyId_idx`(`companyId`),
    UNIQUE INDEX `EmployeeShift_employeeId_shiftId_key`(`employeeId`, `shiftId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'VIEWER') NOT NULL DEFAULT 'ADMIN',
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_email_key`(`email`),
    INDEX `AdminUser_companyId_idx`(`companyId`),
    UNIQUE INDEX `AdminUser_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `performedById` VARCHAR(191) NOT NULL,
    `performedByName` VARCHAR(191) NOT NULL,
    `targetName` VARCHAR(191) NOT NULL,
    `targetEmail` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_companyId_timestamp_idx`(`companyId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` ENUM('INFO', 'WARNING', 'ERROR', 'SUCCESS') NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `employeeId` VARCHAR(191) NULL,

    INDEX `Notification_companyId_isRead_createdAt_idx`(`companyId`, `isRead`, `createdAt`),
    INDEX `Notification_employeeId_companyId_idx`(`employeeId`, `companyId`),
    UNIQUE INDEX `Notification_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventRequest` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `type` ENUM('OVERTIME', 'EARLY_EXIT', 'JUSTIFIED_ABSENCE', 'VACATION', 'LATE_ARRIVAL') NOT NULL,
    `status` ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `date` DATE NOT NULL,
    `dateTo` DATE NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `minutes` INTEGER NULL,
    `reason` TEXT NOT NULL,
    `batchId` VARCHAR(50) NULL,
    `registeredById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EventRequest_companyId_date_status_idx`(`companyId`, `date`, `status`),
    INDEX `EventRequest_companyId_employeeId_date_type_idx`(`companyId`, `employeeId`, `date`, `type`),
    INDEX `EventRequest_batchId_idx`(`batchId`),
    UNIQUE INDEX `EventRequest_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSettings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL DEFAULT 'PAIN',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/Mexico_City',
    `workdayStartHour` INTEGER NOT NULL DEFAULT 8,
    `workdayStartMinute` INTEGER NOT NULL DEFAULT 0,
    `latenessToleranceMin` INTEGER NOT NULL DEFAULT 15,
    `workdayEndHour` INTEGER NOT NULL DEFAULT 17,
    `workdayEndMinute` INTEGER NOT NULL DEFAULT 0,
    `breakStartTime` VARCHAR(191) NOT NULL DEFAULT '13:00',
    `breakEndTime` VARCHAR(191) NOT NULL DEFAULT '14:00',
    `faceConfidenceThreshold` DOUBLE NOT NULL DEFAULT 0.85,
    `captureMode` VARCHAR(191) NOT NULL DEFAULT 'AUTO',
    `enableQualityValidation` BOOLEAN NOT NULL DEFAULT true,
    `minFaceLuminance` INTEGER NOT NULL DEFAULT 40,
    `maxPoseDeviation` DOUBLE NOT NULL DEFAULT 0.2,
    `alertEmail` VARCHAR(191) NOT NULL DEFAULT '',
    `notifyOnDeviceOffline` BOOLEAN NOT NULL DEFAULT true,
    `notifyOnUnknownFace` BOOLEAN NOT NULL DEFAULT true,
    `notifyOnLatenessMin` INTEGER NOT NULL DEFAULT 30,
    `photoRetentionDays` INTEGER NOT NULL DEFAULT 30,
    `showConsentOnKiosk` BOOLEAN NOT NULL DEFAULT true,
    `maintenanceMode` BOOLEAN NOT NULL DEFAULT false,
    `defaultExportFormat` VARCHAR(191) NOT NULL DEFAULT 'CSV',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemSettings_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Device` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('KIOSK', 'CAMERA', 'TURNSTILE') NOT NULL DEFAULT 'KIOSK',
    `status` ENUM('ONLINE', 'OFFLINE', 'UNSTABLE') NOT NULL DEFAULT 'ONLINE',
    `token` VARCHAR(191) NULL,
    `tokenHash` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `blockedAt` DATETIME(3) NULL,
    `blockedReason` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deactivatedAt` DATETIME(3) NULL,
    `deactivatedReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Device_token_key`(`token`),
    UNIQUE INDEX `Device_tokenHash_key`(`tokenHash`),
    INDEX `Device_companyId_status_idx`(`companyId`, `status`),
    INDEX `Device_token_idx`(`token`),
    INDEX `Device_tokenHash_idx`(`tokenHash`),
    UNIQUE INDEX `Device_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceAuthRequest` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `deviceId` VARCHAR(191) NULL,
    `pairingCode` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `userAgent` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeviceAuthRequest_pairingCode_key`(`pairingCode`),
    INDEX `DeviceAuthRequest_pairingCode_idx`(`pairingCode`),
    INDEX `DeviceAuthRequest_deviceId_idx`(`deviceId`),
    INDEX `DeviceAuthRequest_companyId_status_idx`(`companyId`, `status`),
    INDEX `DeviceAuthRequest_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_departmentId_companyId_fkey` FOREIGN KEY (`departmentId`, `companyId`) REFERENCES `Department`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_deviceId_companyId_fkey` FOREIGN KEY (`deviceId`, `companyId`) REFERENCES `Device`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shift` ADD CONSTRAINT `Shift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_departmentId_companyId_fkey` FOREIGN KEY (`departmentId`, `companyId`) REFERENCES `Department`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartmentShift` ADD CONSTRAINT `DepartmentShift_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeShift` ADD CONSTRAINT `EmployeeShift_shiftId_companyId_fkey` FOREIGN KEY (`shiftId`, `companyId`) REFERENCES `Shift`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminUser` ADD CONSTRAINT `AdminUser_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminUser` ADD CONSTRAINT `AdminUser_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventRequest` ADD CONSTRAINT `EventRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventRequest` ADD CONSTRAINT `EventRequest_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventRequest` ADD CONSTRAINT `EventRequest_registeredById_fkey` FOREIGN KEY (`registeredById`) REFERENCES `AdminUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemSettings` ADD CONSTRAINT `SystemSettings_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceAuthRequest` ADD CONSTRAINT `DeviceAuthRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
