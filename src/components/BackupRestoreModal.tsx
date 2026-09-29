import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Layers,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ isOpen, onClose }) => {
  const {
    asets,
    verifikasiList,
    desas,
    users,
    selectedYear,
    getBackupData,
    restoreBackupData,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'backup' | 'restore'>('backup');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    setIsProcessing(true);
    try {
      const data = getBackupData();
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `BACKUP-SIPADES-KEC-SIROMBU-${dateStr}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Gagal membuat berkas backup: ' + (err?.message || 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setRestoreFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const payload = parsed.data || parsed;

        if (!Array.isArray(payload.asets) && !Array.isArray(payload.desas)) {
          setErrorMessage('Berkas tidak memuat struktur basis data SIPADES yang sah!');
          setPreviewData(null);
          return;
        }

        setPreviewData({
          exportDate: parsed.exportDate || parsed.timestamp ? new Date(parsed.exportDate || parsed.timestamp).toLocaleString('id-ID') : 'Tidak diketahui',
          totalAset: Array.isArray(payload.asets) ? payload.asets.length : 0,
          totalVerifikasi: Array.isArray(payload.verifikasiList) ? payload.verifikasiList.length : 0,
          totalDesa: Array.isArray(payload.desas) ? payload.desas.length : 0,
          totalUsers: Array.isArray(payload.users) ? payload.users.length : 0,
          appName: parsed.appName || 'SIPADES Sirombu',
          raw: parsed,
        });
      } catch (err) {
        setErrorMessage('Berkas bukan format JSON yang valid!');
        setPreviewData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = () => {
    if (!previewData?.raw) {
      setErrorMessage('Pilih berkas cadangan JSON yang valid terlebih dahulu.');
      return;
    }

    if (!window.confirm('PERINGATAN: Pemulihan data akan memperbarui database sistem dengan isi berkas ini. Lanjutkan pemulihan?')) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const result = restoreBackupData(previewData.raw);
    setIsProcessing(false);

    if (result.success) {
      setSuccessMessage(
        `Pemulihan data berhasil! Memulihkan ${result.stats?.asets ?? 0} aset, ${result.stats?.verifikasi ?? 0} mutasi, dan ${result.stats?.desas ?? 0} data desa.`
      );
      setPreviewData(null);
      setRestoreFile(null);
      setTimeout(() => {
        onClose();
      }, 2500);
    } else {
      setErrorMessage(result.message || 'Gagal memulihkan cadangan data.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0E1526] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <span className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Database className="w-6 h-6" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Backup & Restore Basis Data
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                Admin / Super Admin
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Cadangkan seluruh inventaris aset desa, permohonan mutasi, dan akun pengguna ke berkas lokal atau pulihkan data sebelumnya
            </p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 mb-6">
          <button
            onClick={() => {
              setActiveSubTab('backup');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'backup'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            Cadangkan Data (Backup)
          </button>
          <button
            onClick={() => {
              setActiveSubTab('restore');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'restore'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            Pulihkan Data (Restore)
          </button>
        </div>

        {/* Messages */}
        {errorMessage && (
          <div className="p-3.5 mb-4 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 mb-4 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Backup Tab Content */}
        {activeSubTab === 'backup' && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Ringkasan Data Saat Ini (Kecamatan Sirombu):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-xl font-black text-emerald-400">{asets.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Item Aset Aktif</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-xl font-black text-amber-400">{verifikasiList.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Permohonan Mutasi</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-xl font-black text-blue-400">{desas.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Profil Desa</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-xl font-black text-purple-400">{users.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Pengguna & Akses</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200/90 leading-relaxed">
              <p className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Format Cadangan Standar SIPADES:
              </p>
              Cadangan disimpan dalam format berkas terstruktur <strong>.JSON</strong> yang mencakup seluruh buku inventaris desa se-Kecamatan Sirombu, rekam jejak mutasi aset, status pengesahan tahun anggaran {selectedYear}, dan konfigurasi sistem.
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all disabled:opacity-50"
              >
                {downloadSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    Cadangan Terunduh!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Unduh Berkas Cadangan (.JSON)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Restore Tab Content */}
        {activeSubTab === 'restore' && (
          <div className="space-y-5">
            {/* File drop area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/60 hover:bg-slate-900/60 rounded-xl p-6 text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-white mb-1">
                {restoreFile ? restoreFile.name : 'Klik atau Tarik Berkas Cadangan (.JSON) ke Sini'}
              </div>
              <p className="text-[11px] text-slate-400">
                Pilih berkas backup SIPADES Sirombu yang sebelumnya telah diunduh
              </p>
            </div>

            {/* Preview of selected backup file */}
            {previewData && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Informasi Berkas Cadangan
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Waktu Backup: {previewData.exportDate}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800">
                    <div className="font-bold text-emerald-400 text-base">{previewData.totalAset}</div>
                    <div className="text-[10px] text-slate-400">Aset Tetap</div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800">
                    <div className="font-bold text-amber-400 text-base">{previewData.totalVerifikasi}</div>
                    <div className="text-[10px] text-slate-400">Mutasi / Hapus</div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800">
                    <div className="font-bold text-blue-400 text-base">{previewData.totalDesa}</div>
                    <div className="text-[10px] text-slate-400">Data Desa</div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800">
                    <div className="font-bold text-purple-400 text-base">{previewData.totalUsers}</div>
                    <div className="text-[10px] text-slate-400">Akun Pengguna</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Perhatian: Melakukan pemulihan akan menimpa data inventaris saat ini dengan data di dalam berkas cadangan ini.
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={!previewData || isProcessing}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                Mulai Pulihkan Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
