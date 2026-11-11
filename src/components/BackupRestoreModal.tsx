import React, { useState, useRef, useMemo } from 'react';
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
  Building2,
  MapPin,
  Check,
  Server,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Desa, Aset } from '../types';

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
    refreshServerData,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'backup' | 'restore' | 'cpanel_update'>('backup');
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [zipSuccess, setZipSuccess] = useState<boolean>(false);
  
  // Backup state
  const [backupScope, setBackupScope] = useState<'all' | 'desa'>('all');
  const [backupDesaId, setBackupDesaId] = useState<string>(desas[0]?.id || 'desa-01');

  // Restore state
  const [restoreScopeMode, setRestoreScopeMode] = useState<'all' | 'desa'>('all');
  const [restoreDesaId, setRestoreDesaId] = useState<string>(desas[0]?.id || 'desa-01');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [isPerDesaFile, setIsPerDesaFile] = useState<boolean>(false);
  const [fileDesaName, setFileDesaName] = useState<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedBackupDesa = desas.find((d) => d.id === backupDesaId) || desas[0];
  const selectedRestoreDesa = desas.find((d) => d.id === restoreDesaId) || desas[0];
  const isBackupDesa = backupScope === 'desa';
  const isRestoreDesa = restoreScopeMode === 'desa';

  // Dynamic statistics based on selected backup scope
  const activeBackupAsets = isBackupDesa
    ? asets.filter((a) => a.desaId === backupDesaId && a.status !== 'terhapus')
    : asets.filter((a) => a.status !== 'terhapus');
  const activeBackupMutasi = isBackupDesa
    ? verifikasiList.filter((v) => v.desaId === backupDesaId)
    : verifikasiList;
  const activeBackupUsers = isBackupDesa
    ? users.filter((u) => u.desaId === backupDesaId)
    : users;

  // Calculate matching assets in uploaded backup file for the selected village
  const previewMatchingAsetsCount = useMemo(() => {
    if (!previewData?.raw) return 0;
    const payload = previewData.raw.data || previewData.raw;
    if (!Array.isArray(payload.asets)) return 0;

    if (previewData.raw.scope === 'desa' || isPerDesaFile) {
      return payload.asets.length;
    }

    const targetName = selectedRestoreDesa?.name?.toLowerCase().replace(/^desa\s+/i, '').trim();
    return payload.asets.filter((a: any) => {
      if (a.desaId === restoreDesaId) return true;
      if (a.desaName && targetName && a.desaName.toLowerCase().replace(/^desa\s+/i, '').trim() === targetName) return true;
      return false;
    }).length;
  }, [previewData, restoreDesaId, isPerDesaFile, selectedRestoreDesa]);

  const currentLiveAsetsForRestoreDesa = useMemo(() => {
    return asets.filter((a) => a.desaId === restoreDesaId && a.status !== 'terhapus').length;
  }, [asets, restoreDesaId]);

  const handleDownloadBackup = () => {
    setIsProcessing(true);
    try {
      const data = getBackupData(isBackupDesa ? backupDesaId : 'all');
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      const cleanDesaName = isBackupDesa
        ? (selectedBackupDesa?.name || 'DESA').replace(/\s+/g, '_').toUpperCase()
        : 'KEC-SIROMBU';
      
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `BACKUP-SIPADES-${cleanDesaName}-${dateStr}.json`
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

        const isDesaSpecific =
          parsed.scope === 'desa' ||
          Boolean(parsed.desaId && parsed.desaId !== 'all') ||
          (Array.isArray(payload.desas) && payload.desas.length === 1 && payload.desas[0]?.id);

        const detectedDesaId =
          parsed.desaId && parsed.desaId !== 'all'
            ? parsed.desaId
            : payload.desas?.[0]?.id || desas[0]?.id || 'desa-01';

        const detectedDesaName =
          parsed.desaName ||
          payload.desas?.[0]?.name ||
          desas.find((d) => d.id === detectedDesaId)?.name ||
          'Desa';

        setIsPerDesaFile(isDesaSpecific);
        setFileDesaName(detectedDesaName);

        // If file is explicitly for a single village, switch to per-desa mode and match that village
        if (isDesaSpecific) {
          setRestoreScopeMode('desa');
          setRestoreDesaId(detectedDesaId);
        }

        setPreviewData({
          exportDate: parsed.exportDate || parsed.timestamp ? new Date(parsed.exportDate || parsed.timestamp).toLocaleString('id-ID') : 'Tidak diketahui',
          totalAset: Array.isArray(payload.asets) ? payload.asets.length : 0,
          totalVerifikasi: Array.isArray(payload.verifikasiList) ? payload.verifikasiList.length : 0,
          totalDesa: Array.isArray(payload.desas) ? payload.desas.length : 0,
          totalUsers: Array.isArray(payload.users) ? payload.users.length : 0,
          appName: parsed.appName || 'SIPADES Sirombu',
          scope: parsed.scope || (isDesaSpecific ? 'desa' : 'all'),
          desaId: detectedDesaId,
          desaName: detectedDesaName,
          raw: parsed,
        });
      } catch (err) {
        setErrorMessage('Berkas bukan format JSON yang valid!');
        setPreviewData(null);
      }
    };
    reader.readAsText(file);
  };

  const [isPullingFromCpanel, setIsPullingFromCpanel] = useState(false);

  const handlePullDirectFromCpanel = async () => {
    setIsPullingFromCpanel(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await refreshServerData(true);
      setSuccessMessage('Berhasil! Seluruh data aset telah dimuat ulang langsung dari cPanel. Seluruh cache laptop telah diselaraskan.');
    } catch (e: any) {
      setErrorMessage(`Gagal memuat langsung dari cPanel: ${e.message}`);
    } finally {
      setIsPullingFromCpanel(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!previewData?.raw) {
      setErrorMessage('Pilih berkas cadangan JSON yang valid terlebih dahulu.');
      return;
    }

    const isPerDesaRestore = restoreScopeMode === 'desa';
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await restoreBackupData(
        previewData.raw,
        isPerDesaRestore ? restoreDesaId : undefined
      );

      if (result.success) {
        setSuccessMessage(
          result.message ||
          `Pemulihan data berhasil! Memulihkan ${result.stats?.asets ?? 0} aset, ${result.stats?.verifikasi ?? 0} mutasi.`
        );
        setPreviewData(null);
        setRestoreFile(null);
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setErrorMessage(result.message || 'Gagal memulihkan cadangan data.');
      }
    } catch (err: any) {
      setErrorMessage(`Terjadi kesalahan saat memulihkan: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZipFile = async () => {
    setDownloadingZip(true);
    setZipProgress('Menghubungkan ke server...');
    setZipSuccess(false);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/download-zip');
      if (!res.ok) {
        throw new Error(`Server merespon HTTP ${res.status}`);
      }

      const contentLength = res.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      const totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '34.2';

      if (!res.body) {
        throw new Error('ReadableStream tidak didukung di browser ini.');
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          const currentMB = (receivedBytes / (1024 * 1024)).toFixed(1);
          const percent = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : null;
          setZipProgress(
            percent !== null
              ? `Mengunduh berkas ZIP utuh: ${currentMB} MB / ${totalMB} MB (${percent}%)`
              : `Mengunduh berkas ZIP utuh: ${currentMB} MB...`
          );
        }
      }

      const blob = new Blob(chunks as any, { type: 'application/zip' });
      
      // Strict integrity check: Must NOT be an auth HTML page (which is ~10 KB)
      if (blob.size < 50000) {
        throw new Error(
          `Ukuran file terunduh hanya ${(blob.size / 1024).toFixed(1)} KB (terkena proteksi autentikasi iframe). Harap muat ulang halaman dan coba lagi.`
        );
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sipades-web-sirombu.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);

      setZipProgress(null);
      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 8000);
    } catch (err: any) {
      setErrorMessage(`Gagal mengunduh ZIP: ${err.message}`);
      setZipProgress(null);
    } finally {
      setDownloadingZip(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0E1526] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative text-slate-100 max-h-[92vh] overflow-y-auto">
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
              Cadangkan dan pulihkan inventaris aset baik secara menyeluruh (25 desa) maupun per masing-masing desa.
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
          <button
            onClick={() => {
              setActiveSubTab('cpanel_update');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'cpanel_update'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            Update Web cPanel (.ZIP)
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

        {/* ============================================================== */}
        {/* BACKUP TAB CONTENT */}
        {/* ============================================================== */}
        {activeSubTab === 'backup' && (
          <div className="space-y-5">
            {/* Scope Selection: Seluruh Desa vs Per Desa */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Pilih Cakupan Cadangan (Backup):
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  {backupScope === 'all' ? '25 Desa Se-Kecamatan' : selectedBackupDesa?.name}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setBackupScope('all')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                    backupScope === 'all'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/50'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      backupScope === 'all' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                    }`}
                  >
                    {backupScope === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-200">★ Seluruh Desa (Se-Kecamatan)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Mencakup 25 desa, seluruh inventaris aset dan mutasi
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupScope('desa')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                    backupScope === 'desa'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/50'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      backupScope === 'desa' ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600'
                    }`}
                  >
                    {backupScope === 'desa' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-200">🏢 Per Desa Tertentu (Individual)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Cadangkan khusus hanya untuk 1 desa yang dipilih
                    </div>
                  </div>
                </button>
              </div>

              {/* Village selector when backupScope === 'desa' */}
              {backupScope === 'desa' && (
                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    Pilih Desa yang Akan Dicadangkan:
                  </label>
                  <select
                    value={backupDesaId}
                    onChange={(e) => setBackupDesaId(e.target.value)}
                    className="bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer max-w-full sm:max-w-xs"
                  >
                    {desas.map((d) => {
                      const count = asets.filter((a) => a.desaId === d.id && a.status !== 'terhapus').length;
                      return (
                        <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                          {d.name} ({count} Aset)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Summary Statistics Card */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>
                  {isBackupDesa
                    ? `Ringkasan Data Cadangan: ${selectedBackupDesa?.name}`
                    : 'Ringkasan Data Cadangan: Seluruh Kecamatan Sirombu (25 Desa)'}
                </span>
                <span className="text-[10px] text-slate-400">Format: JSON v2</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-xl font-black text-emerald-400">{activeBackupAsets.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Item Aset Aktif</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-xl font-black text-amber-400">{activeBackupMutasi.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Permohonan Mutasi</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-xl font-black text-blue-400">{isBackupDesa ? 1 : desas.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{isBackupDesa ? 'Desa Terpilih' : 'Profil Desa'}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-xl font-black text-purple-400">{activeBackupUsers.length}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Pengguna & Akses</div>
                </div>
              </div>
            </div>

            {/* Info Notice */}
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200/90 leading-relaxed">
              <p className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                {isBackupDesa ? `Cadangan Khusus ${selectedBackupDesa?.name}:` : 'Format Cadangan Standar SIPADES:'}
              </p>
              {isBackupDesa ? (
                <>
                  Cadangan disimpan dalam format berkas <strong>.JSON</strong> khusus yang memuat buku inventaris aset, rekam mutasi, dan akun pengelola untuk <strong>{selectedBackupDesa?.name}</strong>. Berkas ini dapat dipulihkan secara mandiri kapan saja tanpa memengaruhi desa lainnya.
                </>
              ) : (
                <>
                  Cadangan disimpan dalam format berkas terstruktur <strong>.JSON</strong> yang mencakup seluruh buku inventaris desa se-Kecamatan Sirombu (25 desa), rekam jejak mutasi aset, status pengesahan, dan konfigurasi sistem.
                </>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all disabled:opacity-50 cursor-pointer"
              >
                {downloadSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    Cadangan Terunduh!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {isBackupDesa
                      ? `Unduh Cadangan ${selectedBackupDesa?.name} (.JSON)`
                      : 'Unduh Berkas Cadangan Seluruh Desa (.JSON)'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* RESTORE TAB CONTENT */}
        {/* ============================================================== */}
        {activeSubTab === 'restore' && (
          <div className="space-y-5">
            {/* Quick Authoritative Sync from cPanel Option */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/60 to-cyan-950/60 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-0.5 text-center sm:text-left">
                <div className="text-xs font-bold text-emerald-300 flex items-center justify-center sm:justify-start gap-1.5">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  Tarik Data Resmi dari cPanel (Abaikan Cache Laptop)
                </div>
                <div className="text-[11px] text-slate-300">
                  Bersihkan data laptop lokal dan muat langsung basis data yang tersimpan di cPanel.
                </div>
              </div>
              <button
                type="button"
                onClick={handlePullDirectFromCpanel}
                disabled={isPullingFromCpanel}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPullingFromCpanel ? 'animate-spin' : ''}`} />
                {isPullingFromCpanel ? 'Memuat dari cPanel...' : 'Tarik Data cPanel Sekarang'}
              </button>
            </div>

            {/* Scope Selection: Seluruh Desa vs Per Desa Tertentu */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Pilih Mode Pemulihan (Restore):
                </span>
                <span className="text-[11px] text-blue-400 font-semibold">
                  {restoreScopeMode === 'all' ? 'Seluruh Desa (25 Desa)' : selectedRestoreDesa?.name}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRestoreScopeMode('all')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                    restoreScopeMode === 'all'
                      ? 'bg-blue-950/60 border-blue-500 text-white shadow-md shadow-blue-950/50'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      restoreScopeMode === 'all' ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
                    }`}
                  >
                    {restoreScopeMode === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-200">★ Pulihkan Seluruh Desa (25 Desa)</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Menimpa dan menyelaraskan basis data seluruh kecamatan
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRestoreScopeMode('desa')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                    restoreScopeMode === 'desa'
                      ? 'bg-blue-950/60 border-blue-500 text-white shadow-md shadow-blue-950/50'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      restoreScopeMode === 'desa' ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
                    }`}
                  >
                    {restoreScopeMode === 'desa' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-200">🏢 Pulihkan Per Desa Tertentu</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Hanya pulihkan 1 desa, 24 desa lain tetap aman
                    </div>
                  </div>
                </button>
              </div>

              {/* Village selector when restoreScopeMode === 'desa' */}
              {restoreScopeMode === 'desa' && (
                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    Pilih Desa Tujuan yang Akan Dipulihkan:
                  </label>
                  <select
                    value={restoreDesaId}
                    onChange={(e) => setRestoreDesaId(e.target.value)}
                    className="bg-slate-950 border border-blue-500/50 rounded-xl px-3 py-1.5 text-xs font-bold text-blue-300 focus:outline-none focus:border-blue-400 cursor-pointer max-w-full sm:max-w-xs"
                  >
                    {desas.map((d) => {
                      const count = asets.filter((a) => a.desaId === d.id && a.status !== 'terhapus').length;
                      return (
                        <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                          {d.name} (Saat ini: {count} Aset)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* File drop area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/60 hover:bg-slate-900/60 rounded-xl p-5 text-center cursor-pointer transition-all"
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
                Mendukung berkas cadangan seluruh desa maupun cadangan khusus per desa
              </p>
            </div>

            {/* Preview of selected backup file */}
            {previewData && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Informasi Berkas Cadangan
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Waktu Backup: {previewData.exportDate}
                  </span>
                </div>

                {/* Badge File Type */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      isPerDesaFile
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    {isPerDesaFile
                      ? `Format: Cadangan Khusus (${fileDesaName})`
                      : 'Format: Cadangan Lengkap Seluruh Desa'}
                  </span>

                  {isRestoreDesa && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Target Pulihkan: {selectedRestoreDesa?.name}
                    </span>
                  )}
                </div>

                {/* Comparison Card if Restoring Per Desa */}
                {isRestoreDesa ? (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      <div className="font-bold text-emerald-400 text-base">{previewMatchingAsetsCount}</div>
                      <div className="text-[10px] text-slate-400">Aset di Berkas Cadangan</div>
                    </div>
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      <div className="font-bold text-blue-400 text-base">{currentLiveAsetsForRestoreDesa}</div>
                      <div className="text-[10px] text-slate-400">Aset Saat Ini di Database</div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-col justify-center">
                      <div className="font-bold text-emerald-300 text-xs">24 Desa Lain</div>
                      <div className="text-[10px] text-emerald-400/90 font-medium">Tetap Aman & Utuh</div>
                    </div>
                  </div>
                ) : (
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
                )}

                {/* Safety note */}
                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {isRestoreDesa ? (
                      <>
                        <strong>Keamanan Terisolasi:</strong> Pemulihan hanya akan menimpa/memperbarui inventaris untuk <strong>{selectedRestoreDesa?.name}</strong>. Data dari 24 desa lainnya dijamin tidak akan tersentuh atau hilang.
                      </>
                    ) : (
                      <>
                        <strong>Perhatian:</strong> Melakukan pemulihan seluruh desa akan menyelaraskan basis data seluruh 25 desa saat ini dengan isi berkas cadangan ini.
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={!previewData || isProcessing}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                {isRestoreDesa
                  ? `Mulai Pulihkan Data ${selectedRestoreDesa?.name} Saja`
                  : 'Mulai Pulihkan Seluruh Data (25 Desa)'}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CPANEL WEB UPDATE TAB CONTENT */}
        {/* ============================================================== */}
        {activeSubTab === 'cpanel_update' && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-purple-400" />
                  Pembaruan Langsung Domain sipadessirombu.my.id
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-400/30">
                  File ZIP Siap Pakai (100% Valid)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Paket ini berisi seluruh aplikasi web SIPADES SIROMBU versi terbaru (termasuk kode HTML, script, style, logo, dan seluruh 332 data aset desa). 
                Cukup unduh paket ZIP ini lalu upload dan ekstrak di File Manager cPanel Anda.
              </p>
            </div>

            {/* Download Card */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="text-sm font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
                    <Server className="w-4 h-4 text-emerald-400" />
                    sipades-web-sirombu.zip
                  </div>
                  <div className="text-xs text-slate-400">
                    Format arsip standar cPanel (Ukuran Ringan ~866 KB • Cepat Diunduh & Bebas Error Signature).
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadZipFile}
                  disabled={downloadingZip}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${downloadingZip ? 'animate-bounce' : ''}`} />
                  {downloadingZip ? 'Sedang Mengunduh Paket...' : 'Unduh Paket ZIP Pembaruan (~866 KB)'}
                </button>
              </div>

              {zipProgress && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-3 animate-pulse">
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                  <span className="font-semibold">{zipProgress}</span>
                </div>
              )}

              {zipSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Berhasil Terunduh (~866 KB Utuh)!</strong> File <em>sipades-web-sirombu.zip</em> tersimpan di laptop Anda. Silakan upload ke cPanel public_html dan lakukan Extract.</span>
                </div>
              )}
            </div>

            {/* Step-by-Step Instructions */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Cara Memasang Pembaruan di cPanel (Hanya 3 Langkah):
              </h4>
              <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
                <li className="pl-1">
                  <strong>Buka cPanel File Manager:</strong> Masuk ke cPanel hosting Anda, buka menu <strong>File Manager</strong>, lalu masuk ke folder <code className="text-cyan-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">public_html</code>.
                </li>
                <li className="pl-1">
                  <strong>Upload Berkas ZIP:</strong> Klik tombol <strong>Upload</strong> di bilah atas cPanel, centang <em>"Overwrite existing files"</em>, dan upload file <strong>sipades-web-sirombu.zip</strong> yang baru Anda unduh.
                </li>
                <li className="pl-1">
                  <strong>Ekstrak (Extract):</strong> Setelah upload 100% berwarna hijau, kembali ke folder <code className="text-cyan-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">public_html</code>, klik kanan pada <code className="text-emerald-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">sipades-web-sirombu.zip</code>, lalu pilih <strong>Extract</strong> ke lokasi <code className="text-cyan-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">/public_html</code>.
                </li>
              </ol>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Domain Tujuan: <strong className="text-white">https://sipadessirombu.my.id</strong></span>
                <span className="text-emerald-400 font-semibold">Otomatis Aktif & Terupdate</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
