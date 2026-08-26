import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import api from './utils/api';

// Providers
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import KioskLayout from './layouts/KioskLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages - Kiosk
import FaceRecognitionPage from './pages/kiosk/FaceRecognitionPage';
import EnrollmentPage from './pages/kiosk/EnrollmentPage';

// Pages - Dashboard
import DashboardOverview from './pages/dashboard/DashboardOverview';
import EmployeesPage from './pages/dashboard/EmployeesPage';
import AttendancePage from './pages/dashboard/AttendancePage';
import CalendarPage from './pages/dashboard/CalendarPage';
import ReportsPage from './pages/dashboard/ReportsPage';
import EventsPage from './pages/dashboard/EventsPage';
import DevicesPage from './pages/dashboard/DevicesPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import SettingsPage from './pages/dashboard/SettingsPage';

// Pages - Auth
import LoginPage from './pages/auth/LoginPage';
import SetupPage from './pages/auth/SetupPage';

// Rutas protegidas
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Enrutador inteligente para la raíz
const SmartRoot = () => {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await api.get('/auth/setup-status');
        if (res.data.needsSetup) {
          setNeedsSetup(true);
        } else if (isAuthenticated) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('Error checking setup status', error);
        navigate('/login', { replace: true }); // Fallback
      } finally {
        setLoading(false);
      }
    };
    checkSetup();
  }, [isAuthenticated, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-white">Cargando...</div>;
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />;
  }

  return null;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
        <Routes>
          {/* KIOSK MODULE (Tablet) */}
          <Route path="/kiosk" element={<KioskLayout />}>
            <Route index element={<FaceRecognitionPage />} />
          </Route>
          
          {/* KIOSK ENROLLMENT (Tablet) */}
          <Route path="/kiosk/enroll/:employeeId" element={<EnrollmentPage />} />

          {/* DASHBOARD MODULE (Admin) */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardOverview />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* LOGIN & SETUP */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          
          {/* ROOT & FALLBACK */}
          <Route path="/" element={<SmartRoot />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
