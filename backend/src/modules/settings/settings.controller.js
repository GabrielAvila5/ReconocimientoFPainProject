const prisma = require('../../utils/prisma');

// Valores por defecto definidos en el modelo de Prisma
const DEFAULT_SETTINGS = {
  id: 1,
  companyName: "PAIN",
  timezone: "America/Mexico_City",
  workdayStartHour: 8,
  workdayStartMinute: 0,
  latenessToleranceMin: 15,
  workdayEndHour: 17,
  workdayEndMinute: 0,
  faceConfidenceThreshold: 0.85,
  captureMode: "AUTO",
  alertEmail: "",
  notifyOnDeviceOffline: true,
  notifyOnUnknownFace: true,
  notifyOnLatenessMin: 30,
  showConsentOnKiosk: true,
  maintenanceMode: false,
  defaultExportFormat: "CSV",
  breakStartTime: "13:00",
  breakEndTime: "14:00"
};

const getSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      return res.status(200).json(DEFAULT_SETTINGS);
    }
    
    res.status(200).json(settings);
  } catch (error) {
    console.error('Error in getSettings:', error);
    res.status(500).json({ error: 'Error al obtener la configuración' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const {
      companyName,
      timezone,
      workdayStartHour,
      workdayStartMinute,
      latenessToleranceMin,
      workdayEndHour,
      workdayEndMinute,
      faceConfidenceThreshold,
      captureMode,
      alertEmail,
      notifyOnDeviceOffline,
      notifyOnUnknownFace,
      notifyOnLatenessMin,
      showConsentOnKiosk,
      maintenanceMode,
      defaultExportFormat,
      breakStartTime,
      breakEndTime
    } = req.body;

    // Validaciones
    if (latenessToleranceMin !== undefined && (latenessToleranceMin < 0 || latenessToleranceMin > 60)) return res.status(400).json({ error: 'latenessToleranceMin debe estar entre 0 y 60' });
    if (faceConfidenceThreshold !== undefined && (faceConfidenceThreshold < 0.5 || faceConfidenceThreshold > 1.0)) return res.status(400).json({ error: 'faceConfidenceThreshold debe estar entre 0.5 y 1.0' });
    if (workdayStartHour !== undefined && (workdayStartHour < 0 || workdayStartHour > 23)) return res.status(400).json({ error: 'workdayStartHour debe estar entre 0 y 23' });
    if (workdayStartMinute !== undefined && (workdayStartMinute < 0 || workdayStartMinute > 59)) return res.status(400).json({ error: 'workdayStartMinute debe estar entre 0 y 59' });
    if (workdayEndHour !== undefined && (workdayEndHour < 0 || workdayEndHour > 23)) return res.status(400).json({ error: 'workdayEndHour debe estar entre 0 y 23' });
    if (workdayEndMinute !== undefined && (workdayEndMinute < 0 || workdayEndMinute > 59)) return res.status(400).json({ error: 'workdayEndMinute debe estar entre 0 y 59' });
    if (notifyOnLatenessMin !== undefined && (notifyOnLatenessMin < 0 || notifyOnLatenessMin > 480)) return res.status(400).json({ error: 'notifyOnLatenessMin debe estar entre 0 y 480' });
    if (captureMode !== undefined && captureMode !== 'AUTO' && captureMode !== 'MANUAL') return res.status(400).json({ error: 'captureMode debe ser AUTO o MANUAL' });
    if (defaultExportFormat !== undefined && defaultExportFormat !== 'CSV' && defaultExportFormat !== 'PDF') return res.status(400).json({ error: 'defaultExportFormat debe ser CSV o PDF' });

    const companyId = req.user?.companyId;

    const settings = await prisma.systemSettings.upsert({
      where: { companyId },
      update: {
        companyName,
        timezone,
        workdayStartHour,
        workdayStartMinute,
        latenessToleranceMin,
        workdayEndHour,
        workdayEndMinute,
        faceConfidenceThreshold,
        captureMode,
        alertEmail,
        notifyOnDeviceOffline,
        notifyOnUnknownFace,
        notifyOnLatenessMin,
        showConsentOnKiosk,
        maintenanceMode,
        defaultExportFormat,
        breakStartTime,
        breakEndTime
      },
      create: {
        companyName,
        timezone,
        workdayStartHour,
        workdayStartMinute,
        latenessToleranceMin,
        workdayEndHour,
        workdayEndMinute,
        faceConfidenceThreshold,
        captureMode,
        alertEmail,
        notifyOnDeviceOffline,
        notifyOnUnknownFace,
        notifyOnLatenessMin,
        showConsentOnKiosk,
        maintenanceMode,
        defaultExportFormat,
        breakStartTime,
        breakEndTime
      }
    });

    res.status(200).json(settings);
  } catch (error) {
    console.error('Error in updateSettings:', error);
    res.status(500).json({ error: 'Error al actualizar la configuración' });
  }
};

const getPublicSettings = async (req, res) => {
  try {
    const device = req.device;
    let settings = null;
    if (device && device.companyId) {
      try {
        settings = await prisma.systemSettings.findUnique({
          where: { companyId: device.companyId }
        });
      } catch {
        settings = DEFAULT_SETTINGS;
      }
    } else {
      settings = DEFAULT_SETTINGS;
    }

    if (!settings) {
      settings = DEFAULT_SETTINGS;
    }

    res.status(200).json({
      workdayStartHour: settings.workdayStartHour,
      workdayStartMinute: settings.workdayStartMinute,
      latenessToleranceMin: settings.latenessToleranceMin,
      workdayEndHour: settings.workdayEndHour,
      workdayEndMinute: settings.workdayEndMinute,
      faceConfidenceThreshold: settings.faceConfidenceThreshold,
      captureMode: settings.captureMode,
      maintenanceMode: settings.maintenanceMode,
      showConsentOnKiosk: settings.showConsentOnKiosk,
      breakStartTime: settings.breakStartTime,
      breakEndTime: settings.breakEndTime
    });
  } catch (error) {
    console.error('Error in getPublicSettings:', error);
    res.status(500).json({ error: 'Error al obtener la configuración pública' });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getPublicSettings
};
