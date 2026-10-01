import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
  Send,
  Trash2,
  Megaphone,
  Radio,
  Server,
  Zap,
} from 'lucide-react';

interface FirestoreQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirestoreQuotaModal: React.FC<FirestoreQuotaModalProps> = ({ isOpen, onClose }) => {
  const {
    firestoreQuotaStatus,
    firestoreQuotaDetail,
    checkFirestoreQuotaStatus,
    announcements,
    sendAnnouncement,
    deleteAnnouncement,
  } = useApp();

  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<{ status: string; detail: string; time: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Form State for Announcement
  const [annTitle, setAnnTitle] = useState('Pemberitahuan Batas Kuota Harian Firebase');
  const [annMessage, setAnnMessage] = useState(
    'Diberitahukan kepada seluruh Admin Desa & Operator Aset: Kuota sinkronisasi Google Cloud Firestore hari ini telah mencapai batas harian. Mohon menunda sementara penginputan data aset baru. Sistem akan otomatis aktif kembali normal pada pukul 14:00 WIB. Seluruh data yang tersimpan sebelumnya tetap aman.'
  );
  const [annPriority, setAnnPriority] = useState<'normal' | 'urgent' | 'warning'>('warning');

  if (!isOpen) return null;

  const isExhausted = firestoreQuotaStatus === 'EXHAUSTED';

  const handleRunCheck = async () => {
    setIsChecking(true);
    const res = await checkFirestoreQuotaStatus();
    setIsChecking(false);
    setLastCheckResult({
      status: res.status,
      detail: res.detail,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB',
    });
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annMessage.trim()) return;
    setIsSending(true);
    await sendAnnouncement(annTitle, annMessage, annPriority);
    setIsSending(false);
    setSendSuccess(true);
    setTimeout(() => setSendSuccess(false), 3500);
  };

  const handleSetQuotaTemplate = () => {
    setAnnTitle('Pemberitahuan Batas Kuota Harian Firebase (Reset 14:00 WIB)');
    setAnnMessage(
      'Diberitahukan kepada seluruh Admin Desa & Operator Aset: Kuota sinkronisasi Google Cloud Firestore hari ini telah mencapai batas harian. Mohon menunda sementara penginputan data aset baru. Sistem akan otomatis aktif kembali normal pada pukul 14:00 WIB. Seluruh data yang tersimpan sebelumnya tetap aman.'
    );
    setAnnPriority('warning');
  };

  const handleSetResumedTemplate = () => {
    setAnnTitle('Sistem Aktif Normal Kembali (Sinkronisasi Tersambung)');
    setAnnMessage(
      'Pemberitahuan: Kuota Google Cloud Firestore telah direset dan sistem sinkronisasi cloud telah aktif normal kembali. Seluruh Admin Desa dan Operator Aset dapat melanjutkan pekerjaan pencatatan aset seperti biasa.'
    );
    setAnnPriority('normal');
  };

  const announcementTemplate = `📢 *PEMBERITAHUAN SIPADES KECAMATAN SIROMBU*
Kepada Yth. Bapak/Ibu Kepala Desa & Operator/Kaur Aset se-Kecamatan Sirombu:

Diberitahukan bahwa kuota sinkronisasi basis data cloud harian saat ini telah mencapai batas harian.
Mohon untuk *menunda sementara* penginputan data aset baru atau pengajuan mutasi hari ini.

Sistem akan otomatis tereset dan aktif kembali normal pada pukul *14:00 WIB*.
Semua data aset yang telah tersimpan sebelumnya tetap aman dan utuh di sistem. Terima kasih atas pengertiannya.

— *Super Admin SIPADES Sirombu*`;

  const handleCopyAnnouncement = () => {
    navigator.clipboard.writeText(announcementTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const firebaseConsoleUrl =
    'https://console.firebase.google.com/project/gen-lang-client-0767503923/firestore/databases/ai-studio-remixremixsipade-83a59eb6-9df9-4788-9e76-3a2529f6be2d/usage';

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity cursor-pointer animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex justify-end">
        {/* Slide-over Right Panel (DIPERLEBAR SECARA PENUH: min(94vw, 1560px) sehingga menutupi grafik total aset menurut kategori) */}
        <div
          style={{ width: 'min(94vw, 1560px)' }}
          className="w-full max-w-full bg-[#0B132B] border-l border-slate-700/80 text-slate-100 shadow-2xl flex flex-col h-full overflow-hidden transform transition-all duration-300 ease-in-out"
        >
          
          {/* Header Panel */}
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-800 bg-[#070D1F] shrink-0">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-2xl ${
                  isExhausted
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                }`}
              >
                <Database className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-black text-white tracking-tight">
                    Pusat Kontrol & Monitoring Kuota Cloud Firestore
                  </h3>
                  <span className="text-[11px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-red-950/90 text-red-300 border border-red-500/40 shadow">
                    SUPER ADMIN
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Tutup Panel"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Panel Scrollable Content with 2-Column Wide Layout & No Horizontal Scrollbars */}
          <div className="flex-1 p-6 sm:p-8 overflow-y-auto overflow-x-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              
              {/* KOLOM KIRI (5 Kolom): Status Kuota, Uji Kuota Langsung, Limit & Jadwal Reset */}
              <div className="lg:col-span-5 min-w-0 space-y-6">
                
                {/* Status Card & Direct Check Button */}
                <div
                  className={`p-6 rounded-2xl border transition-all ${
                    isExhausted
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-100 shadow-xl shadow-amber-950/30'
                      : 'bg-emerald-950/30 border-emerald-500/50 text-emerald-100 shadow-xl shadow-emerald-950/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {isExhausted ? (
                      <ShieldAlert className="w-8 h-8 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                    ) : (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-black text-white">
                          {isExhausted
                            ? 'Batas Kuota Harian Firebase Tercapai'
                            : 'Koneksi Kuota Firebase Beroperasi Normal'}
                        </h4>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            isExhausted
                              ? 'bg-amber-500 text-slate-950 animate-pulse'
                              : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {isExhausted ? 'LIMIT TERCAPAI' : 'AKTIF & AMAN'}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">
                        {firestoreQuotaDetail ||
                          (isExhausted
                            ? 'Batas kuota harian Firebase Spark Plan telah habis. Operasi cloud dijeda sementara hingga reset otomatis.'
                            : 'Operasi pembacaan dan penulisan ke Google Cloud Firestore berjalan normal dan aman.')}
                      </p>
                    </div>
                  </div>

                  {/* Tombol Cek Kuota Langsung Besar */}
                  <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Uji Coba Respon Cloud:</span>
                      {lastCheckResult && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Terakhir diuji: {lastCheckResult.time}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleRunCheck}
                      disabled={isChecking}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all border border-emerald-400/40 flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                      title="Kirim sinyal uji baca dan tulis langsung ke database Firestore"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${
                          isChecking ? 'animate-spin text-white' : 'text-white'
                        }`}
                      />
                      <span>{isChecking ? 'Memeriksa ke Cloud...' : 'Cek Kuota Langsung'}</span>
                    </button>
                  </div>
                </div>

                {/* Reset Time Info Card */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Jadwal Reset Kuota Harian</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-white tracking-tight">
                      Pukul 14:00 WIB
                    </span>
                    <span className="text-xs text-amber-400 font-bold">
                      (Siang Hari)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Google Cloud Firestore mereset kuota harian setiap pukul <strong>00:00:00 Midnight Pacific Time (PT)</strong>. Karena perbedaan zona waktu UTC-7 dan WIB (UTC+7), waktu reset jatuh tepat pukul <strong>14:00 WIB</strong> di Indonesia Barat.
                  </p>
                </div>

                {/* Free Tier Spark Plan Limits */}
                <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-300">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-400" />
                      <span>Kapasitas Paket Gratis (Spark Plan)</span>
                    </div>
                    <a
                      href={firebaseConsoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                    >
                      <span>Lihat Grafik Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-300 font-medium">Penulisan (Writes):</span>
                      <span className="font-mono font-bold text-emerald-400">20.000 / hari</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-300 font-medium">Pembacaan (Reads):</span>
                      <span className="font-mono font-bold text-blue-400">50.000 / hari</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-300 font-medium">Penghapusan (Deletes):</span>
                      <span className="font-mono font-bold text-amber-400">20.000 / hari</span>
                    </div>
                  </div>
                </div>

                {/* Format WhatsApp Imbauan */}
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Format WhatsApp Siap Kirim</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAnnouncement}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Tersalin!' : 'Salin Pesan WA'}</span>
                    </button>
                  </div>
                  <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {announcementTemplate}
                  </div>
                </div>

              </div>

              {/* KOLOM KANAN (7 Kolom): Formulir Kirim Pengumuman & Daftar Pengumuman Aktif */}
              <div className="lg:col-span-7 min-w-0 space-y-6">
                
                {/* SEND BROADCAST ANNOUNCEMENT TO USERS */}
                <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-[#0F1B38] to-[#0A1226] border border-amber-500/30 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow">
                        <Megaphone className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">
                          Siarkan Pesan Pengumuman ke Seluruh User & Desa
                        </h4>
                        <p className="text-xs text-slate-400">
                          Pesan tidak langsung membuka secara paksa, melainkan tersimpan di gambar lonceng yang berkedip sampai user mengkliknya
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Template quick-pick buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-semibold text-slate-400">Pilih Template Cepat:</span>
                    <button
                      type="button"
                      onClick={handleSetQuotaTemplate}
                      className="px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                    >
                      ⚠️ Kuota Habis (Reset 14:00)
                    </button>
                    <button
                      type="button"
                      onClick={handleSetResumedTemplate}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                    >
                      ✅ Sistem Kembali Normal
                    </button>
                  </div>

                  <form onSubmit={handleSendBroadcast} className="space-y-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Judul Pengumuman
                      </label>
                      <input
                        type="text"
                        value={annTitle}
                        onChange={(e) => setAnnTitle(e.target.value)}
                        required
                        placeholder="Contoh: Pemberitahuan Kuota Harian Firebase"
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Isi Pesan Pengumuman
                      </label>
                      <textarea
                        rows={5}
                        value={annMessage}
                        onChange={(e) => setAnnMessage(e.target.value)}
                        required
                        placeholder="Tuliskan pesan atau imbauan resmi kepada operator/kepala desa..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-colors resize-none leading-relaxed shadow-inner"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-slate-400 font-semibold">Tingkat Urgensi:</span>
                        <label className="inline-flex items-center gap-1.5 text-xs text-amber-300 cursor-pointer">
                          <input
                            type="radio"
                            name="priority"
                            value="warning"
                            checked={annPriority === 'warning'}
                            onChange={() => setAnnPriority('warning')}
                            className="accent-amber-500"
                          />
                          <span>Peringatan</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs text-red-300 cursor-pointer">
                          <input
                            type="radio"
                            name="priority"
                            value="urgent"
                            checked={annPriority === 'urgent'}
                            onChange={() => setAnnPriority('urgent')}
                            className="accent-red-500"
                          />
                          <span>Mendesak (Lonceng Berkedip Merah)</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs text-blue-300 cursor-pointer">
                          <input
                            type="radio"
                            name="priority"
                            value="normal"
                            checked={annPriority === 'normal'}
                            onChange={() => setAnnPriority('normal')}
                            className="accent-blue-500"
                          />
                          <span>Info Biasa</span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={isSending}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <Send className={`w-4 h-4 ${isSending ? 'animate-pulse' : ''}`} />
                        <span>{isSending ? 'Mengirim...' : 'Kirim Pengumuman Sekarang'}</span>
                      </button>
                    </div>

                    {sendSuccess && (
                      <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in shadow">
                        <Check className="w-5 h-5 text-emerald-400" />
                        <span>Pengumuman berhasil dikirim! Simbol lonceng di semua akun desa sekarang berkedip.</span>
                      </div>
                    )}
                  </form>
                </div>

                {/* ACTIVE ANNOUNCEMENTS LIST WITH PULL/DELETE CAPABILITY */}
                <div className="p-6 sm:p-7 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                      <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span>Riwayat Pengumuman Aktif di Sistem ({announcements.length})</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Super Admin berhak menarik pesan kapan saja
                    </span>
                  </div>

                  {announcements.length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-1.5">
                      <p className="text-xs text-slate-400 font-medium">Belum ada pengumuman aktif saat ini.</p>
                      <p className="text-[11px] text-slate-500">
                        Gunakan formulir di atas untuk mengirim pengumuman kepada seluruh operator desa.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((ann) => (
                        <div
                          key={ann.id}
                          className={`p-4.5 rounded-xl border flex items-start justify-between gap-4 transition-all shadow ${
                            ann.priority === 'urgent'
                              ? 'bg-red-950/30 border-red-500/40 text-red-100'
                              : ann.priority === 'warning'
                              ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                              : 'bg-slate-950/60 border-slate-800 text-slate-200'
                          }`}
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  ann.priority === 'urgent'
                                    ? 'bg-red-500 text-white animate-pulse'
                                    : ann.priority === 'warning'
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-blue-500 text-white'
                                }`}
                              >
                                {ann.priority === 'urgent'
                                  ? 'MENDESAK'
                                  : ann.priority === 'warning'
                                  ? 'PERINGATAN'
                                  : 'INFORMASI'}
                              </span>
                              <h5 className="text-xs font-bold text-white truncate">{ann.title}</h5>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(ann.createdAt).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                WIB
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {ann.message}
                            </p>
                            <div className="text-[11px] text-slate-400 font-medium pt-1">
                              Pengirim: <span className="text-amber-300 font-semibold">{ann.senderName}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => deleteAnnouncement(ann.id)}
                            className="px-3 py-2 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-500/50 text-red-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow"
                            title="Tarik / Hapus pengumuman ini secara permanen dari beranda seluruh desa"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Tarik Pesan</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-t border-slate-800 bg-[#070D1F] shrink-0">
            <a
              href={firebaseConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300"
            >
              <Server className="w-4 h-4" />
              <span>Buka Grafik Pemakaian di Google Firebase Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer shadow"
            >
              Tutup Panel
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};
