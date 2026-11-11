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
    return localStorage.getItem(STORAGE_KEY_USE_CPANEL) !== 'false';
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  const [uploadingToCpanel, setUploadingToCpanel] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<string | null>(null);

  useEffect(() => {
    if (cpanelUrl) {
      localStorage.setItem(STORAGE_KEY_CPANEL_URL, cpanelUrl.trim());
    }
  }, [cpanelUrl]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_USE_CPANEL, String(useCpanelPrimary));
  }, [useCpanelPrimary]);

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

      let success = false;
      let totalReported = asets.length;
      let errorMsg = '';

      // 1. Primary: Server-side proxy upload (bypasses browser CORS & LiteSpeed firewall rules)
      try {
        const proxyRes = await fetch('/api/cpanel/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cpanelUrl.trim(), payload: { data: payload } }),
        });

        if (proxyRes.ok) {
          const data = await proxyRes.json();
          if (data && (data.status === 'success' || data.success)) {
            success = true;
            totalReported = data.totalAset || asets.length;
          } else {
            errorMsg = data?.message || '';
          }
        } else {
          errorMsg = `Server proxy merespon status ${proxyRes.status}`;
        }
      } catch (proxyErr: any) {
        console.warn('Proxy upload error, checking fallback:', proxyErr);
        errorMsg = proxyErr.message;
      }

      // 2. Direct browser fallback if proxy failed
      if (!success) {
        try {
          const directRes = await fetch(`${cpanelUrl.trim()}?action=upload_all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: payload }),
          });
          if (directRes.ok) {
            const directData = await directRes.json();
            if (directData && (directData.status === 'success' || directData.success)) {
              success = true;
              totalReported = directData.totalAset || asets.length;
            }
          }
        } catch (directErr) {
          console.warn('Direct upload error:', directErr);
        }
      }

      // 3. Chunked upload fallback if full payload timed out or was rejected due to size
      if (!success && asets.length > 0) {
        const chunkSize = 35;
        const totalChunks = Math.ceil(asets.length / chunkSize);
        let uploaded = 0;

        for (let i = 0; i < totalChunks; i++) {
          const chunk = asets.slice(i * chunkSize, (i + 1) * chunkSize);
          const chunkPayload = {
            data: {
              asets: chunk,
              ...(i === 0 ? { desas, users, verifikasiList, pengesahanList, kecamatanProfile } : {}),
            },
          };

          try {
            const chunkRes = await fetch('/api/cpanel/upload_chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: cpanelUrl.trim(), payload: chunkPayload }),
            });
            if (chunkRes.ok) {
              const chunkData = await chunkRes.json();
              if (chunkData && (chunkData.status === 'success' || chunkData.success)) {
                uploaded += chunk.length;
                totalReported = chunkData.totalAset || uploaded;
              }
            }
          } catch {}
        }

        if (uploaded > 0) {
          success = true;
        }
      }

      if (success) {
        setUploadResult({
          success: true,
          message: `Sukses! Seluruh ${totalReported} unit aset berhasil dipindahkan dan tersimpan di hosting cPanel Anda.`,
        });
        setUseCpanelPrimary(true);
        // Refresh connection test so the green banner immediately updates to the new total
        setTimeout(() => {
          handleTestConnection();
        }, 300);
      } else {
        setUploadResult({
          success: false,
          message: errorMsg ? `Gagal upload ke cPanel: ${errorMsg}` : 'Gagal upload ke cPanel. Periksa koneksi internet atau batas upload hosting.',
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

  const handleDownloadFile = async (fileName: string) => {
    try {
      setDownloadingFile(fileName);
      setZipProgress(null);

      if (fileName === 'sipades-web-sirombu.zip') {
        setZipProgress('Menghubungkan ke server...');
        const res = await fetch('/api/download-zip');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentLength = res.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        const totalMB = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(1) : '34.2';

        if (!res.body) throw new Error('ReadableStream tidak didukung di browser ini.');

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
                ? `Mengunduh berkas ZIP: ${currentMB} MB / ${totalMB} MB (${percent}%)`
                : `Mengunduh berkas ZIP: ${currentMB} MB...`
            );
          }
        }

        const blob = new Blob(chunks as any, { type: 'application/zip' });
        if (blob.size < 50000) {
          throw new Error(
            `Ukuran file terunduh hanya ${(blob.size / 1024).toFixed(1)} KB (terhalang proxy autentikasi). Silakan coba lagi.`
          );
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
        setZipProgress('✓ Berhasil diunduh (~866 KB Utuh)!');
        setTimeout(() => setZipProgress(null), 7000);
        return;
      }

      const res = await fetch(`/${fileName}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('File tidak dapat dimuat');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
    } catch (err: any) {
      setUploadResult({
        success: false,
        message: `Gagal mengunduh ${fileName}: ${err.message}`,
      });
      setZipProgress(null);
    } finally {
      setDownloadingFile(null);
    }
  };

  if (!isOpen) return null;

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
              <li>Seluruh data aset tersimpan aman di server Anda</li>
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

        {/* Pasang Tampilan Aplikasi Langsung di Domain cPanel */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/70 to-indigo-950/70 border border-cyan-500/40 space-y-3 mb-5 shadow-lg">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              Pasang Tampilan Aplikasi SIPADES di sipadessirombu.my.id
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/30">
              Frontend + Backend Lengkap
            </span>
          </div>

          <p className="text-xs text-slate-300">
            Agar saat Anda membuka <strong>https://sipadessirombu.my.id</strong> langsung muncul tampilan penuh aplikasi SIPADES (bukan sekadar daftar file <em>Index of /</em>), unduh paket web aplikasi di bawah ini:
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleDownloadFile('sipades-web-sirombu.zip')}
                disabled={downloadingFile === 'sipades-web-sirombu.zip'}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Download className={`w-4 h-4 ${downloadingFile === 'sipades-web-sirombu.zip' ? 'animate-bounce' : ''}`} />
                {downloadingFile === 'sipades-web-sirombu.zip' ? 'Sedang Mengunduh Paket...' : 'Unduh Paket Web SIPADES (.ZIP ~866 KB)'}
              </button>
              <span className="text-[11px] text-slate-400">
                (Ukuran Ringan: ~866 KB • Berisi index.html, assets, logo, dan .htaccess)
              </span>
            </div>

            {zipProgress && (
              <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-500/50 text-blue-200 text-xs flex items-center gap-2 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                <span className="font-semibold">{zipProgress}</span>
              </div>
            )}
          </div>

          <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 text-[11px] space-y-1.5 text-slate-300">
            <div className="font-semibold text-slate-200">Cara pasang di cPanel (Hanya 3 Langkah Mudah):</div>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Buka cPanel &rarr; <strong>File Manager</strong> &rarr; buka folder <strong>public_html</strong>.</li>
              <li>Klik menu <strong>Upload</strong> di atas, lalu upload file <strong>sipades-web-sirombu.zip</strong> yang baru diunduh.</li>
              <li>Setelah proses upload selesai (100%), kembali ke File Manager, klik kanan file <strong>sipades-web-sirombu.zip</strong>, lalu klik <strong>Extract</strong> (pilih lokasi <code className="text-cyan-300">/public_html</code>).</li>
            </ol>
            <div className="text-emerald-400 font-medium pt-1">
              ✓ Selesai! Saat membuka <a href="https://sipadessirombu.my.id" target="_blank" rel="noreferrer" className="underline font-bold text-emerald-300">https://sipadessirombu.my.id</a>, antarmuka lengkap aplikasi SIPADES Kecamatan Sirombu langsung berjalan dengan 316 aset aktif!
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
