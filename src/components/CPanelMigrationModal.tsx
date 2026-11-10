import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  Server,
  Database,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  RefreshCw,
  X,
  Copy,
  Check,
  Globe,
  HardDrive,
  FileCode,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface CPanelMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY_CPANEL_URL = 'SIPADES_CPANEL_ENDPOINT';
const STORAGE_KEY_USE_CPANEL = 'SIPADES_USE_CPANEL_PRIMARY';

export const CPanelMigrationModal: React.FC<CPanelMigrationModalProps> = ({ isOpen, onClose }) => {
  const { asets, desas, users, verifikasiList, pengesahanList, kecamatanProfile, refreshServerData } = useApp();

  const [cpanelUrl, setCpanelUrl] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_CPANEL_URL) || 'https://sipadessirombu.my.id/cpanel-api.php';
  });
  const [useCpanelPrimary, setUseCpanelPrimary] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_USE_CPANEL) === 'true';
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  const [uploadingToCpanel, setUploadingToCpanel] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (cpanelUrl) {
      localStorage.setItem(STORAGE_KEY_CPANEL_URL, cpanelUrl.trim());
    }
  }, [cpanelUrl]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_USE_CPANEL, String(useCpanelPrimary));
  }, [useCpanelPrimary]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!cpanelUrl.trim()) {
      setTestResult({
        success: false,
        message: 'Masukkan URL endpoint cPanel terlebih dahulu (contoh: https://namadomain.com/cpanel-api.php)',
      });
      return;
    }

    setTestingConnection(true);
    setTestResult(null);

    try {
      const proxyRes = await fetch('/api/cpanel/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cpanelUrl.trim() }),
      });
      const data = await proxyRes.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: data.message || 'Koneksi ke cPanel Hosting Berhasil!',
          count: data.totalAset ?? 0,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Gagal tersambung: ${err.message || 'Pastikan file cpanel-api.php sudah diupload ke public_html dan URL dapat diakses'}`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleUploadAllToCpanel = async () => {
    if (!cpanelUrl.trim()) {
      alert('Masukkan URL endpoint cPanel terlebih dahulu!');
      return;
    }

    setUploadingToCpanel(true);
    setUploadResult(null);

    try {
      const payload = {
        asets,
        desas,
        users,
        verifikasiList,
        pengesahanList,
        kecamatanProfile,
        selectedYear: new Date().getFullYear(),
      };

      const proxyRes = await fetch('/api/cpanel/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cpanelUrl.trim(), payload: { data: payload } }),
      });

      const data = await proxyRes.json();
      if (data.status === 'success' || data.success) {
        setUploadResult({
          success: true,
          message: `Sukses! Seluruh ${data.totalAset || asets.length} unit aset berhasil dipindahkan dan tersimpan di hosting cPanel Anda.`,
        });
        setUseCpanelPrimary(true);
      } else {
        setUploadResult({
          success: false,
          message: data.message || 'Gagal upload ke cPanel.',
        });
      }
    } catch (err: any) {
      setUploadResult({
        success: false,
        message: `Gagal upload ke cPanel: ${err.message || 'Periksa koneksi jaringan atau izin tulis file di cPanel.'}`,
      });
    } finally {
      setUploadingToCpanel(false);
    }
  };

  const handleDownloadFile = (fileName: string) => {
    const link = document.createElement('a');
    link.href = `/${fileName}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-[#0E1526] border border-blue-500/30 rounded-2xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl relative max-h-[92vh] overflow-y-auto text-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Migrasi Penyimpanan ke Hosting cPanel Pribadi
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                  Unlimited Storage
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bebas dari batasan kuota harian Firebase (Spark Plan). Seluruh {asets.length} unit aset tersimpan mandiri di hosting Anda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Perbandingan Penyimpanan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
              <AlertTriangle className="w-4 h-4" />
              Penyimpanan Firebase (Spark Free)
            </div>
            <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
              <li>Maksimal 50.000 bacaan dokumen / hari</li>
              <li>Sering mencapai kuota saat banyak perangkat aktif</li>
              <li>Data sementara dibatasi saat kuota habis</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
              <ShieldCheck className="w-4 h-4" />
              Hosting cPanel (shodns.in)
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
              <li><strong className="text-emerald-300">Tanpa batasan kuota</strong> baca/tulis harian</li>
              <li>Seluruh 315 data aset tersimpan aman di server Anda</li>
              <li>Akses cepat dan kendali penuh database Anda</li>
            </ul>
          </div>
        </div>

        {/* 3 Langkah Mudah Pemasangan di cPanel */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            3 Langkah Mudah Memasang di cPanel Anda
          </h3>

          <div className="space-y-2.5 text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400 text-blue-300 text-[11px] flex items-center justify-center font-bold shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong>Unduh 2 file jembatan cPanel di bawah ini:</strong>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => handleDownloadFile('cpanel-api.php')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition-colors cursor-pointer shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh cpanel-api.php
                  </button>
                  <button
                    onClick={() => handleDownloadFile('sipades_database.json')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors cursor-pointer shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Unduh sipades_database.json ({asets.length} Aset)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400 text-blue-300 text-[11px] flex items-center justify-center font-bold shrink-0 mt-0.5">
                2
              </span>
              <div>
                Buka cPanel Anda (
                <a
                  href="https://cpanel.shodns.in/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  cpanel.shodns.in <ExternalLink className="w-3 h-3" />
                </a>
                ) &rarr; Masuk ke <strong>File Manager</strong> &rarr; buka folder <strong>public_html</strong>, lalu klik <strong>Upload</strong> kedua file tadi.
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400 text-blue-300 text-[11px] flex items-center justify-center font-bold shrink-0 mt-0.5">
                3
              </span>
              <div>
                Masukkan alamat domain web hosting Anda pada kolom di bawah ini, lalu klik <strong>Tes Sambungan</strong> & <strong>Kirim Data ke cPanel</strong>.
              </div>
            </div>
          </div>
        </div>

        {/* Form URL Domain cPanel */}
        <div className="space-y-3 p-4 rounded-xl bg-slate-900 border border-blue-500/30">
          <label className="block text-xs font-bold text-white">
            URL cPanel Bridge API (di domain Anda):
          </label>
          <div className="flex gap-2 flex-col sm:flex-row">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="url"
                value={cpanelUrl}
                onChange={(e) => setCpanelUrl(e.target.value)}
                placeholder="https://namadomain-anda.com/cpanel-api.php"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-blue-400"
              />
            </div>
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              {testingConnection ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memeriksa...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" /> Tes Sambungan
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border border-red-500/40 text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <div>
                <p className="font-semibold">{testResult.message}</p>
                {testResult.count !== undefined && (
                  <p className="text-[11px] text-emerald-400/90 mt-0.5">
                    Jumlah aset yang sudah tercatat di cPanel: <strong>{testResult.count} unit</strong>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tombol Push Data Langsung ke cPanel */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useCpanelPrimary"
                checked={useCpanelPrimary}
                onChange={(e) => setUseCpanelPrimary(e.target.checked)}
                className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
              <label htmlFor="useCpanelPrimary" className="text-xs text-slate-300 cursor-pointer select-none">
                Prioritaskan cPanel sebagai penyimpanan utama (menggantikan kuota Firebase)
              </label>
            </div>

            <button
              onClick={handleUploadAllToCpanel}
              disabled={uploadingToCpanel || !cpanelUrl.trim()}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow"
            >
              {uploadingToCpanel ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengunggah ke cPanel...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" /> Kirim Seluruh {asets.length} Aset ke cPanel
                </>
              )}
            </button>
          </div>

          {uploadResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                uploadResult.success
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border border-red-500/40 text-red-300'
              }`}
            >
              {uploadResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              )}
              <p className="font-semibold">{uploadResult.message}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Database Lokal & cPanel Siap: Seluruh {asets.length} Unit Aset Tetap Terjaga
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
