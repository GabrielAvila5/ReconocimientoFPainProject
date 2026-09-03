import React from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

const KioskLayout = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Outlet />
      </main>
      <Toaster theme="dark" position="top-right" />
    </div>
  );
};

export default KioskLayout;
