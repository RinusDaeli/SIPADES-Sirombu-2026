/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { AsetManagementView } from './components/AsetManagementView';
import { VerifikasiView } from './components/VerifikasiView';
import { LaporanPermendagriView } from './components/LaporanPermendagriView';
import { UserManagementView } from './components/UserManagementView';
import { DesaInfoView } from './components/DesaInfoView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Menu, X, LogOut } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, activeTab, logout } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (!currentUser) {
    return <LoginView />;
  }

  const handleCloseSidebar = () => {
    setMobileSidebarOpen(false);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#070C18] text-slate-100 flex flex-col md:flex-row font-sans relative">
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-[#153422] text-white p-3 flex items-center justify-between border-b border-[#1e4830] shrink-0 z-40">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 rounded-lg bg-emerald-900/60 text-white cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <span className="font-extrabold text-xs tracking-wider block">SIPADES SIROMBU</span>
            <span className="text-[10px] text-emerald-200/70">Kecamatan Sirombu, Nias Barat</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mobileSidebarOpen ? (
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="text-[11px] font-bold text-amber-300 hover:text-white px-2 py-1 rounded bg-emerald-900/70 border border-emerald-600/40 cursor-pointer"
            >
              Tutup Bilah
            </button>
          ) : (
            <button
              onClick={logout}
              className="text-[11px] font-bold text-emerald-200/90 hover:text-white px-2 py-1 rounded bg-emerald-950/60 border border-emerald-700/40 flex items-center gap-1 cursor-pointer"
              title="Keluar dari akun"
            >
              <LogOut className="w-3.5 h-3.5 text-emerald-400" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar for Desktop & Mobile Drawer with slide transition */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-30 h-full transition-transform duration-300 ease-in-out ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } md:block md:shrink-0`}
      >
        <Sidebar onClose={handleCloseSidebar} />
      </div>

      {/* Main Workspace with independent scrolling (Dark Theme) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#070C18]">
        <main className="flex-1 p-3 sm:p-5 md:p-8 lg:p-10 max-w-7xl w-full mx-auto text-slate-100">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'aset' && <AsetManagementView />}
          {activeTab === 'verifikasi' && <VerifikasiView />}
          {activeTab === 'laporan' && <LaporanPermendagriView />}
          {activeTab === 'users' && (currentUser?.role === 'super_admin' || currentUser?.role === 'admin_kecamatan') && <UserManagementView />}
          {activeTab === 'desa_info' && <DesaInfoView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}
