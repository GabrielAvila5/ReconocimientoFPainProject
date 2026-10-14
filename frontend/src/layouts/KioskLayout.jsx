import React from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

const KioskLayout = () => {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: '#000', overflowX: 'hidden' }}>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <Outlet />
      </main>
      <Toaster theme="dark" position="top-right" />
    </div>
  );
};

export default KioskLayout;
