-- AlterTable
ALTER TABLE `company` MODIFY `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'MENSUAL',
    MODIFY `billingPhone` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `eventrequest` MODIFY `type` ENUM('OVERTIME', 'EARLY_EXIT', 'JUSTIFIED_ABSENCE', 'VACATION', 'LATE_ARRIVAL', 'DISABILITY', 'REST_DAY_OVERRIDE') NOT NULL;

-- AlterTable
ALTER TABLE `shift` ADD COLUMN `scheduleByDay` JSON NULL;

-- CreateTable
CREATE TABLE `AttendanceDayStatus` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('PRESENTE', 'RETARDO', 'FALTA', 'DESCANSO', 'DESCANSO_TRABAJADO', 'FESTIVO', 'FESTIVO_TRABAJADO', 'PERMISO_JUSTIFICADO', 'VACACIONES', 'INCAPACIDAD', 'INCOMPLETO') NOT NULL,
    `shiftId` INTEGER NULL,
    `shiftName` VARCHAR(191) NULL,
    `expectedStartTime` VARCHAR(191) NULL,
    `expectedEndTime` VARCHAR(191) NULL,
    `appliedToleranceMin` INTEGER NULL,
    `isWorkDay` BOOLEAN NOT NULL DEFAULT true,
    `lateMinutes` INTEGER NULL DEFAULT 0,
    `overtimeMinutes` INTEGER NULL DEFAULT 0,
    `earlyExitMinutes` INTEGER NULL DEFAULT 0,
    `notes` TEXT NULL,
    `attendanceRecordId` VARCHAR(191) NULL,
    `evaluatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isLocked` BOOLEAN NOT NULL DEFAULT true,
    `lastModifiedById` VARCHAR(191) NULL,
    `lastModifiedReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceDayStatus_companyId_date_status_idx`(`companyId`, `date`, `status`),
    INDEX `AttendanceDayStatus_employeeId_date_idx`(`employeeId`, `date`),
    UNIQUE INDEX `AttendanceDayStatus_companyId_employeeId_date_key`(`companyId`, `employeeId`, `date`),
    UNIQUE INDEX `AttendanceDayStatus_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyHoliday` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `isMandatory` BOOLEAN NOT NULL DEFAULT true,
    `departmentIds` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompanyHoliday_companyId_date_idx`(`companyId`, `date`),
    UNIQUE INDEX `CompanyHoliday_companyId_date_key`(`companyId`, `date`),
    UNIQUE INDEX `CompanyHoliday_id_companyId_key`(`id`, `companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AttendanceDayStatus` ADD CONSTRAINT `AttendanceDayStatus_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceDayStatus` ADD CONSTRAINT `AttendanceDayStatus_employeeId_companyId_fkey` FOREIGN KEY (`employeeId`, `companyId`) REFERENCES `Employee`(`id`, `companyId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyHoliday` ADD CONSTRAINT `CompanyHoliday_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
