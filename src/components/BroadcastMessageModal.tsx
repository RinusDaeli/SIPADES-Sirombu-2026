import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  Send,
  Megaphone,
  X,
  AlertTriangle,
  Info,
  ShieldAlert,
  Trash2,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Eye,
} from 'lucide-react';

interface BroadcastMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BroadcastMessageModal: React.FC<BroadcastMessageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { announcements, sendAnnouncement, deleteAnnouncement, currentUser, desas } = useApp();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'warning' | 'urgent'>('warning');
  const [targetAudience, setTargetAudience] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
  const isAdminOrSuper = currentUser?.role === 'super_admin' || currentUser?.role === 'admin_kecamatan';

  if (!isOpen || !isAdminOrSuper) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrSuper || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const fullTitle = title.trim() || 'Pemberitahuan Penting SIPADES';
      const targetLabel =
        targetAudience === 'all'
          ? 'Semua Pengguna (25 Desa & Kecamatan)'
          : targetAudience === 'desa_all'
          ? 'Seluruh Admin Desa (25 Desa)'
          : targetAudience === 'kecamatan'
          ? 'Admin Kecamatan'
          : `Khusus ${desas.find((d) => d.id === targetAudience)?.name || 'Desa'}`;

      const finalMessage = `${message.trim()}\n\n[Ditujukan untuk: ${targetLabel}]`;

      await sendAnnouncement(fullTitle, finalMessage, priority);

      setTitle('');
      setMessage('');
      setSuccessToast(`Pesan siaran berhasil dikirimkan ke ${targetLabel}!`);
      setTimeout(() => setSuccessToast(null), 6000);
      setActiveTab('history');
    } catch (err: any) {
      console.error('Failed to send announcement:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id);
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div
        style={{ width: 'min(94vw, 950px)' }}
        className="relative w-full bg-[#0B132B] border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-4 border-b border-slate-800 bg-[#070D1F] shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Pusat Pengiriman Pesan & Pengumuman ke Semua User
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Broadcast Realtime
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kirim pesan langsung ke layar seluruh Admin Desa dan Operator Kecamatan Sirombu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Tutup Jendela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 sm:px-8 pt-3 border-b border-slate-800/80 bg-[#080E23]">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'compose'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Tulis Pesan Baru</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Riwayat Pesan Aktif ({announcements.length})</span>
          </button>
        </div>

        {/* Success Alert Banner */}
        {successToast && (
          <div className="mx-6 sm:mx-8 mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-center gap-2.5 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'compose' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Target Audience & Priority Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Target Penerima Pesan</span>
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="all">🌐 Semua Pengguna (25 Desa + Kecamatan)</option>
                    <option value="desa_all">🏛️ Seluruh Admin Desa (25 Desa)</option>
                    <option value="kecamatan">🏢 Khusus Operator Kecamatan</option>
                    <optgroup label="Khusus Desa Tertentu:">
                      {desas.map((d) => (
                        <option key={d.id} value={d.id}>
                          Desa {d.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tingkat Kepentingan (Prioritas)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPriority('normal')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        priority === 'normal'
                          ? 'bg-blue-600/30 text-blue-300 border-blue-500 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Info</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('warning')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        priority === 'warning'
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Penting</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('urgent')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        priority === 'urgent'
                          ? 'bg-red-600/30 text-red-300 border-red-500 shadow-sm animate-pulse'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Darurat</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Judul Pesan / Perihal
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Imbauan Batas Akhir Pemeriksaan Fisik Aset Desa Tahun 2026"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Message Content Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Isi Pesan Lengkap <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ketikkan pesan, instruksi, arahan, atau pemberitahuan yang ingin disampaikan kepada seluruh pengguna SIPADES..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm focus:border-emerald-500 focus:outline-none resize-none leading-relaxed"
                  required
                />
              </div>

              {/* Sender Identity Preview */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Pengirim: <strong className="text-white">{currentUser?.name || 'Super Admin'}</strong> ({currentUser?.role === 'super_admin' ? 'Super Admin' : 'Admin Kecamatan'})
                </span>
                <span className="text-emerald-400 font-medium">Lonceng notifikasi akan berkedip pada semua layar user</span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Mengirim Siaran...' : 'Kirim Pesan ke Semua User'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Daftar Pesan yang Sedang Tayang di Layar Pengguna
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveTab('compose')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tulis Pesan Baru</span>
                </button>
              </div>

              {announcements.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
                  <Megaphone className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-slate-400">Belum ada pesan siaran aktif</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Gunakan tab "Tulis Pesan Baru" untuk mengirim pengumuman pertama Anda.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => {
                    const isUrgent = ann.priority === 'urgent';
                    const isWarning = ann.priority === 'warning';

                    return (
                      <div
                        key={ann.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          isUrgent
                            ? 'bg-red-950/20 border-red-800/40'
                            : isWarning
                            ? 'bg-amber-950/20 border-amber-800/40'
                            : 'bg-slate-900/70 border-slate-800'
                        }`}
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isUrgent
                                  ? 'bg-red-900/60 text-red-300'
                                  : isWarning
                                  ? 'bg-amber-900/60 text-amber-300'
                                  : 'bg-blue-900/60 text-blue-300'
                              }`}
                            >
                              {isUrgent ? 'Darurat' : isWarning ? 'Penting' : 'Info'}
                            </span>
                            <h5 className="text-sm font-bold text-white truncate">{ann.title}</h5>
                          </div>
                          <p className="text-xs text-slate-300 whitespace-pre-line line-clamp-2">
                            {ann.message}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                            <span>Pengirim: {ann.senderName}</span>
                            <span>•</span>
                            <span>
                              {new Date(ann.createdAt).toLocaleString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(ann.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 hover:text-white border border-red-800/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          title="Hapus / Cabut pesan siaran ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Cabut Pesan</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-3.5 border-t border-slate-800 bg-[#070D1F] shrink-0 text-xs text-slate-400">
          <span>
            Pesan yang dikirim akan langsung memunculkan pemberitahuan pada seluruh pengguna SIPADES Sirombu.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
