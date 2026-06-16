import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Providers
import { NotificationProvider } from './contexts/NotificationContext';

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
import DevicesPage from './pages/dashboard/DevicesPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import SettingsPage from './pages/dashboard/SettingsPage';

// Pages - Auth
import LoginPage from './pages/auth/LoginPage';

// Rutas protegidas
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = true; // TODO: Implement Auth context
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
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
            <Route path="devices" element={<DevicesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* LOGIN */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Redirect Root */}
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
