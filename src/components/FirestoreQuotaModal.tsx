import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldAlert,
  Clock,
  ExternalLink,
  RefreshCw,
  X,
  CheckCircle2,
  Copy,
  Check,
  Database,
  Info,
} from 'lucide-react';

interface FirestoreQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirestoreQuotaModal: React.FC<FirestoreQuotaModalProps> = ({ isOpen, onClose }) => {
  const { firestoreQuotaStatus, firestoreQuotaDetail, checkFirestoreQuotaStatus } = useApp();
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isExhausted = firestoreQuotaStatus === 'EXHAUSTED';

  const handleRunCheck = async () => {
    setIsChecking(true);
    await checkFirestoreQuotaStatus();
    setIsChecking(false);
  };

  const announcementTemplate = `📢 *PEMBERITAHUAN SIPADES KECAMATAN SIROMBU*
Kepada Yth. Bapak/Ibu Kepala Desa & Operator/Kaur Aset se-Kecamatan Sirombu:

Diberitahukan bahwa kuota sinkronisasi basis data cloud harian saat ini telah mencapai batas harian.
Mohon untuk *menunda sementara* penginputan data aset baru atau pengajuan mutasi hari ini.

Sistem akan otomatis tereset dan aktif kembali normal besok pada pukul *14:00 WIB*.
Semua data aset yang telah tersimpan sebelumnya tetap aman dan utuh di sistem. Terima kasih atas pengertiannya.

— *Super Admin SIPADES Sirombu*`;

  const handleCopyAnnouncement = () => {
    navigator.clipboard.writeText(announcementTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const firebaseConsoleUrl =
    'https://console.firebase.google.com/project/gen-lang-client-0767503923/firestore/databases/ai-studio-remixremixsipade-83a59eb6-9df9-4788-9e76-3a2529f6be2d/usage';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isExhausted ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Status Kuota Google Cloud Firestore</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-500/40">
                  Khusus Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">Monitoring limit harian & jadwal reset otomatis sistem</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Main Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 ${
              isExhausted
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
            }`}
          >
            {isExhausted ? (
              <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-white">
                {isExhausted ? 'Kuota Harian Firebase Habis (Quota Exceeded)' : 'Kuota Firebase Beroperasi Normal'}
              </h4>
              <p className="text-xs leading-relaxed text-slate-300">
                {firestoreQuotaDetail ||
                  (isExhausted
                    ? 'Batas pemakaian harian gratis Firebase telah tercapai. Operasi cloud dijeda sementara hingga waktu reset.'
                    : 'Koneksi pembacaan dan penulisan ke Google Cloud Firestore berjalan normal dan aman.')}
              </p>
            </div>
          </div>

          {/* Reset Time Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Jadwal Reset Kuota Harian</span>
              </div>
              <div className="text-xl font-black text-amber-300">
                Pukul 14:00 WIB
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Google Cloud mereset kuota harian setiap pukul <strong>00:00:00 Midnight Pacific Time (PT)</strong>, setara dengan <strong>14:00 WIB (Siang)</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Info className="w-4 h-4 text-blue-400" />
                <span>Batas Paket Gratis (Spark Plan)</span>
              </div>
              <div className="space-y-1 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Penulisan (Writes):</span>
                  <span className="font-mono font-semibold text-white">20.000 / hari</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pembacaan (Reads):</span>
                  <span className="font-mono font-semibold text-white">50.000 / hari</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Penghapusan (Deletes):</span>
                  <span className="font-mono font-semibold text-white">20.000 / hari</span>
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp Announcement Copy Card for Super Admin */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Format Pengumuman untuk Pengguna / Operator Desa</span>
              </div>
              <button
                type="button"
                onClick={handleCopyAnnouncement}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Pesan WA'}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {announcementTemplate}
            </div>
            <p className="text-[11px] text-slate-400">
              Gunakan tombol salin di atas untuk menginformasikan operator desa bila kuota harian telah habis agar pekerjaan dapat dilanjutkan setelah pukul 14:00 WIB.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button
            type="button"
            onClick={handleRunCheck}
            disabled={isChecking}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>{isChecking ? 'Memeriksa...' : 'Cek Kuota Langsung'}</span>
          </button>

          <div className="flex items-center gap-2">
            <a
              href={firebaseConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow cursor-pointer"
            >
              <span>Buka Grafik Firebase Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
