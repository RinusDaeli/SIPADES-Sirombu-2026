import React from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  Megaphone,
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  Info,
  ShieldAlert,
  User,
} from 'lucide-react';

interface AnnouncementReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnnouncementReaderModal: React.FC<AnnouncementReaderModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { announcements, markAnnouncementAsRead } = useApp();

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      {/* Modal Box Diperlebar Penuh: min(94vw, 1100px) sehingga pesan sangat lega dan mudah dibaca */}
      <div
        style={{ width: 'min(94vw, 1100px)' }}
        className="relative w-full bg-[#0B132B] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-800 bg-[#070D1F] shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Pemberitahuan & Pengumuman Resmi SIPADES
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Kecamatan Sirombu
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Pesan dan imbauan penting untuk seluruh Operator Desa & Admin Kecamatan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Tutup pesan (ciutkan ke gambar lonceng)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* List of announcements */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
          {announcements.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-dashed border-slate-800 space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="text-base font-bold text-slate-200">Tidak ada pengumuman baru</p>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Seluruh sistem, database, dan sinkronisasi data aset beroperasi normal tanpa kendala kuota.
              </p>
            </div>
          ) : (
            announcements.map((ann) => {
              const isUrgent = ann.priority === 'urgent';
              const isWarning = ann.priority === 'warning';

              return (
                <div
                  key={ann.id}
                  className={`p-6 sm:p-7 rounded-2xl border space-y-4 transition-all shadow-xl ${
                    isUrgent
                      ? 'bg-red-950/30 border-red-500/60 text-red-100 shadow-red-950/20'
                      : isWarning
                      ? 'bg-amber-950/30 border-amber-500/60 text-amber-100 shadow-amber-950/20'
                      : 'bg-slate-900/90 border-slate-700/80 text-slate-200 shadow-slate-950/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isUrgent ? (
                          <ShieldAlert className="w-6 h-6 text-red-400 animate-pulse" />
                        ) : isWarning ? (
                          <AlertTriangle className="w-6 h-6 text-amber-400" />
                        ) : (
                          <Info className="w-6 h-6 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-base sm:text-lg font-black text-white leading-snug">
                          {ann.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(ann.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}{' '}
                            •{' '}
                            {new Date(ann.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            WIB
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-300">
                            <User className="w-3.5 h-3.5 text-amber-400" />
                            {ann.senderName || 'Super Admin'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-black px-3 py-1 rounded-full shrink-0 shadow ${
                        isUrgent
                          ? 'bg-red-500 text-white animate-pulse'
                          : isWarning
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      {isUrgent ? 'MENDESAK' : isWarning ? 'PERINGATAN' : 'INFORMASI'}
                    </span>
                  </div>

                  {/* Isi Pesan dengan font besar dan nyaman dibaca */}
                  <div className="p-4 sm:p-5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <p className="text-sm sm:text-base leading-relaxed text-slate-100 whitespace-pre-wrap font-normal">
                      {ann.message}
                    </p>
                  </div>

                  {/* Tombol Saya Mengerti */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 flex-wrap gap-3">
                    <span className="text-xs text-slate-400">
                      Klik <strong>Saya Mengerti</strong> untuk menandai pesan telah dibaca dan menciutkan jendela kembali ke lonceng.
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        markAnnouncementAsRead(ann.id);
                        onClose();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/30"
                      title="Tandai telah membaca dan ciutkan kembali ke gambar lonceng"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Saya Mengerti</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-slate-800 bg-[#070D1F] shrink-0">
          <span className="text-xs text-slate-400">
            Total {announcements.length} pengumuman aktif dari Super Admin
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Tutup Jendela
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
