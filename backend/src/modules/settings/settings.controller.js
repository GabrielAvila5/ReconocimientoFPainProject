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
  photoRetentionDays: 30,
  showConsentOnKiosk: true,
  maintenanceMode: false,
  defaultExportFormat: "CSV",
  breakStartTime: "13:00",
  breakEndTime: "14:00"
};

const getSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 1 }
    });
    
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
      photoRetentionDays,
      showConsentOnKiosk,
      maintenanceMode,
      defaultExportFormat,
      breakStartTime,
      breakEndTime
    } = req.body;

    // Validaciones
    if (latenessToleranceMin < 0 || latenessToleranceMin > 60) return res.status(400).json({ error: 'latenessToleranceMin debe estar entre 0 y 60' });
    if (faceConfidenceThreshold < 0.5 || faceConfidenceThreshold > 1.0) return res.status(400).json({ error: 'faceConfidenceThreshold debe estar entre 0.5 y 1.0' });
    if (workdayStartHour < 0 || workdayStartHour > 23) return res.status(400).json({ error: 'workdayStartHour debe estar entre 0 y 23' });
    if (workdayStartMinute < 0 || workdayStartMinute > 59) return res.status(400).json({ error: 'workdayStartMinute debe estar entre 0 y 59' });
    if (workdayEndHour < 0 || workdayEndHour > 23) return res.status(400).json({ error: 'workdayEndHour debe estar entre 0 y 23' });
    if (workdayEndMinute < 0 || workdayEndMinute > 59) return res.status(400).json({ error: 'workdayEndMinute debe estar entre 0 y 59' });
    if (photoRetentionDays < 0 || photoRetentionDays > 365) return res.status(400).json({ error: 'photoRetentionDays debe estar entre 0 y 365' });
    if (notifyOnLatenessMin < 0 || notifyOnLatenessMin > 480) return res.status(400).json({ error: 'notifyOnLatenessMin debe estar entre 0 y 480' });
    if (captureMode !== 'AUTO' && captureMode !== 'MANUAL') return res.status(400).json({ error: 'captureMode debe ser AUTO o MANUAL' });
    if (defaultExportFormat !== 'CSV' && defaultExportFormat !== 'PDF') return res.status(400).json({ error: 'defaultExportFormat debe ser CSV o PDF' });

    const settings = await prisma.systemSettings.upsert({
      where: { id: 1 },
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
        photoRetentionDays,
        showConsentOnKiosk,
        maintenanceMode,
        defaultExportFormat,
        breakStartTime,
        breakEndTime
      },
      create: {
        id: 1,
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
        photoRetentionDays,
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
    let settings = await prisma.systemSettings.findUnique({
      where: { id: 1 }
    });

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
