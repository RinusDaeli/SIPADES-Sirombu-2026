import React from 'react';
import { useApp } from '../context/AppContext';
import { NiasBaratLogo } from './NiasBaratLogo';
import {
  LayoutDashboard,
  Boxes,
  ArrowRightLeft,
  Building,
  BarChart3,
  Users,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  onOpenQRScanner?: () => void;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenQRScanner, onClose }) => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    logout,
    verifikasiList,
  } = useApp();

  // Desa only sees badge for their own pending mutations
  const pendingVerifCount = verifikasiList.filter((v) => {
    if (currentUser?.role === 'admin_desa') {
      return v.desaId === currentUser.desaId && v.status === 'menunggu_verifikasi';
    }
    return v.status === 'menunggu_verifikasi';
  }).length;

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdminOrSuper = currentUser?.role === 'super_admin' || currentUser?.role === 'admin_kecamatan';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'DASHBOARD',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'aset',
      label: 'DATA ASET',
      icon: Boxes,
      badge: null,
    },
    {
      id: 'verifikasi',
      label: 'MUTASI ASET',
      icon: ArrowRightLeft,
      badge: pendingVerifCount > 0 ? pendingVerifCount : null,
    },
    {
      id: 'desa_info',
      label: 'PROFIL & KANTOR',
      icon: Building,
      badge: currentUser?.role === 'admin_desa' ? null : 'Camat/Desa',
    },
    {
      id: 'laporan',
      label: currentUser?.role === 'admin_desa' ? 'REKAP ASET DESA' : 'REKAP ANTAR DESA',
      icon: BarChart3,
      badge: null,
    },
    ...(isAdminOrSuper
      ? [
          {
            id: 'users',
            label: 'PENGGUNA',
            icon: Users,
            badge: isSuperAdmin ? 'Super' : 'Admin',
          },
        ]
      : []),
  ];

  const handleItemClick = (item: typeof menuItems[0]) => {
    setActiveTab(item.id);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      <aside className="w-64 lg:w-72 shrink-0 bg-[#153422] text-white flex flex-col justify-between p-4 h-full overflow-y-auto border-r border-[#1e4830] select-none relative shadow-2xl md:shadow-none">
        <div className="space-y-4">
          {/* Header Brand */}
          <div className="flex items-center gap-3 px-1 py-1">
            <NiasBaratLogo size={40} />
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold tracking-wider text-white uppercase leading-tight truncate">
                {currentUser?.role === 'admin_desa'
                  ? (currentUser.desaName || 'ADMIN DESA')
                  : currentUser?.role === 'super_admin'
                  ? 'SUPER ADMIN'
                  : 'ADMIN KECAMATAN'}
              </h1>
              <p className="text-[11px] text-emerald-200/70 font-medium truncate">
                Kec. Sirombu — Nias Barat
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-md font-bold'
                      : 'text-emerald-100/90 hover:bg-emerald-800/40 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-slate-900' : 'text-emerald-200/80'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : typeof item.badge === 'number'
                          ? 'bg-red-500 text-white'
                          : 'bg-emerald-800 text-emerald-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section - User Info */}
        <div className="pt-4 border-t border-[#1e4830]">
          <div className="px-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {currentUser?.name || 'Administrator Desa'}
              </div>
              <div className="text-[11px] text-emerald-300/70 font-medium capitalize truncate">
                {currentUser?.role === 'super_admin'
                  ? 'Super Admin'
                  : currentUser?.role === 'admin_kecamatan'
                  ? 'Admin Kecamatan'
                  : 'Admin Desa'}
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-emerald-300 hover:text-red-300 hover:bg-red-950/40 transition-colors cursor-pointer shrink-0"
              title="Keluar dari akun"
              aria-label="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
