import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Aset, KlasAset } from '../types';
import { formatRupiah, formatTanggalIndonesia } from '../utils/reportGenerator';
import { getAsetVerificationStatus, AsetVerificationBadge } from '../utils/verificationHelper';
import { AsetDetailModal } from './AsetDetailModal';
import { NiasBaratLogo } from './NiasBaratLogo';
import { getPhotoUrl, handlePhotoError } from '../utils/photoUrl';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Check,
  X,
  FileCheck2,
  Building2,
  Camera,
  RotateCcw,
  Printer,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  FileText,
  Boxes,
  Eye,
  AlertCircle,
} from 'lucide-react';

export const VerifikasiAsetView: React.FC = () => {
  const {
    asets,
    desas,
    currentUser,
    kecamatanProfile,
    verifikasiList,
    pengesahanList,
    verifikasiAset,
    verifikasiAsetBatch,
    verifikasiSemuaAsetPending,
    tolakVerifikasiAset,
    batalkanVerifikasiAset,
  } = useApp();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdminKecamatan = currentUser?.role === 'admin_kecamatan';
  const canVerify = isSuperAdmin || isAdminKecamatan;

  // Filters & Search
  const [statusTab, setStatusTab] = useState<'all' | 'menunggu' | 'sudah' | 'perbaikan'>('menunggu');
  const [filterDesa, setFilterDesa] = useState<string>('all');
  const [filterKlasifikasi, setFilterKlasifikasi] = useState<string>('all');
  const [filterTahun, setFilterTahun] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Selection for bulk actions
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  // Modals state
  const [detailAset, setDetailAset] = useState<Aset | null>(null);
  const [verifyModalAset, setVerifyModalAset] = useState<Aset | null>(null);
  const [verifyNomorSK, setVerifyNomorSK] = useState<string>('');
  const [verifyCatatan, setVerifyCatatan] = useState<string>('');
  const [isSubmittingVerify, setIsSubmittingVerify] = useState<boolean>(false);

  // Bulk Verify Modal
  const [showBulkVerifyModal, setShowBulkVerifyModal] = useState<boolean>(false);
  const [bulkNomorSK, setBulkNomorSK] = useState<string>('');
  const [bulkCatatan, setBulkCatatan] = useState<string>('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState<boolean>(false);

  // Reject / Revision Modal
  const [revisiModalAset, setRevisiModalAset] = useState<Aset | null>(null);
  const [revisiCatatan, setRevisiCatatan] = useState<string>('');
  const [isSubmittingRevisi, setIsSubmittingRevisi] = useState<boolean>(false);

  // Print Sheet Modal
  const [printModalAset, setPrintModalAset] = useState<Aset | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Active non-deleted assets
  const activeAsets = useMemo(() => {
    return asets.filter((a) => a && a.status !== 'terhapus');
  }, [asets]);

  // Available Years
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    activeAsets.forEach((a) => {
      if (a.tahunPerolehan) set.add(a.tahunPerolehan);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [activeAsets]);

  // Overall Statistics
  const stats = useMemo(() => {
    let pendingCount = 0;
    let pendingNilai = 0;
    let verifiedCount = 0;
    let verifiedNilai = 0;
    let perluPerbaikanCount = 0;
    let perluPerbaikanNilai = 0;
    let totalNilai = 0;

    activeAsets.forEach((a) => {
      const val = Number(a.nilaiPerolehan || 0);
      totalNilai += val;

      const isPending =
        a.statusVerifikasi === 'sedang_diproses' ||
        a.statusVerifikasi === 'belum_diverifikasi' ||
        a.status === 'mutasi_diajukan' ||
        a.status === 'terhapus_diajukan';

      if (a.statusVerifikasi === 'perlu_perbaikan') {
        perluPerbaikanCount++;
        perluPerbaikanNilai += val;
      } else if (a.statusVerifikasi === 'sudah_diverifikasi') {
        verifiedCount++;
        verifiedNilai += val;
      } else if (isPending) {
        pendingCount++;
        pendingNilai += val;
      } else {
        // default baseline
        verifiedCount++;
        verifiedNilai += val;
      }
    });

    return {
      totalCount: activeAsets.length,
      totalNilai,
      pendingCount,
      pendingNilai,
      verifiedCount,
      verifiedNilai,
      perluPerbaikanCount,
      perluPerbaikanNilai,
    };
  }, [activeAsets]);

  // Filtered Assets
  const filteredAsets = useMemo(() => {
    return activeAsets.filter((item) => {
      // 1. Status Filter
      if (statusTab === 'menunggu') {
        const isMenunggu =
          item.statusVerifikasi === 'sedang_diproses' ||
          item.statusVerifikasi === 'belum_diverifikasi' ||
          item.status === 'mutasi_diajukan' ||
          item.status === 'terhapus_diajukan';
        if (!isMenunggu) return false;
      } else if (statusTab === 'sudah') {
        const isSudah =
          item.statusVerifikasi === 'sudah_diverifikasi' ||
          (!item.statusVerifikasi && item.status === 'aktif');
        if (!isSudah) return false;
      } else if (statusTab === 'perbaikan') {
        if (item.statusVerifikasi !== 'perlu_perbaikan') return false;
      }

      // 2. Desa Filter
      if (filterDesa !== 'all' && item.desaId !== filterDesa) {
        return false;
      }

      // 3. Klasifikasi Filter
      if (filterKlasifikasi !== 'all' && item.klasifikasi !== filterKlasifikasi) {
        return false;
      }

      // 4. Tahun Filter
      if (filterTahun !== 'all' && String(item.tahunPerolehan) !== filterTahun) {
        return false;
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.namaAset?.toLowerCase().includes(q);
        const matchKode = item.kodeAset?.toLowerCase().includes(q);
        const matchReg = item.nomorRegister?.toLowerCase().includes(q);
        const matchDesa = item.desaName?.toLowerCase().includes(q);
        const matchKet = item.keterangan?.toLowerCase().includes(q);
        const matchBukti = item.bukti?.nomor?.toLowerCase().includes(q);
        if (!matchName && !matchKode && !matchReg && !matchDesa && !matchKet && !matchBukti) {
          return false;
        }
      }

      return true;
    });
  }, [activeAsets, statusTab, filterDesa, filterKlasifikasi, filterTahun, searchQuery]);

  // Paginated Assets
  const totalPages = Math.ceil(filteredAsets.length / itemsPerPage) || 1;
  const paginatedAsets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAsets.slice(start, start + itemsPerPage);
  }, [filteredAsets, currentPage]);

  // Select all on current page
  const isAllCurrentPageSelected =
    paginatedAsets.length > 0 &&
    paginatedAsets.every((item) => selectedAssetIds.includes(item.id));

  const handleToggleSelectAllCurrentPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = new Set(paginatedAsets.map((a) => a.id));
      setSelectedAssetIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const next = new Set(selectedAssetIds);
      paginatedAsets.forEach((a) => next.add(a.id));
      setSelectedAssetIds(Array.from(next));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open Single Verification Modal
  const handleOpenVerifyModal = (aset: Aset) => {
    setVerifyModalAset(aset);
    const year = new Date().getFullYear();
    const reg = aset.nomorRegister || aset.id.slice(-4);
    setVerifyNomorSK(`BA-VERIF-KEC/${year}/${reg}`);
    setVerifyCatatan(
      aset.catatanVerifikasi ||
        `Telah dilakukan verifikasi fisik dan keabsahan dokumen bukti perolehan oleh Tim Monitoring Kecamatan Sirombu. Dinyatakan sah.`
    );
  };

  const handleConfirmSingleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyModalAset) return;

    setIsSubmittingVerify(true);
    try {
      const res = await verifikasiAset(verifyModalAset.id, verifyCatatan, verifyNomorSK);
      if (res.success) {
        showToast(res.message);
        setVerifyModalAset(null);
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  // Open Bulk Verify Modal
  const handleOpenBulkVerifyModal = () => {
    if (selectedAssetIds.length === 0) return;
    const year = new Date().getFullYear();
    setBulkNomorSK(`BA-VERIF-MASAL/${year}/KEC-SRB`);
    setBulkCatatan(
      `Telah diverifikasi serentak dan disahkan kelengkapan fisik serta berkasnya oleh Tim Monitoring Kecamatan Sirombu.`
    );
    setShowBulkVerifyModal(true);
  };

  const handleConfirmBulkVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssetIds.length === 0) return;

    setIsSubmittingBulk(true);
    try {
      const res = await verifikasiAsetBatch(selectedAssetIds, bulkCatatan, bulkNomorSK);
      if (res.success) {
        showToast(res.message);
        setShowBulkVerifyModal(false);
        setSelectedAssetIds([]);
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Open Revision / Reject Modal
  const handleOpenRevisiModal = (aset: Aset) => {
    setRevisiModalAset(aset);
    setRevisiCatatan(
      aset.catatanVerifikasi ||
        'Mohon lengkapi foto fisik aset yang jelas dari berbagai sudut dan unggah bukti kuitansi/BAST perolehan.'
    );
  };

  const handleConfirmRevisi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisiModalAset) return;

    setIsSubmittingRevisi(true);
    try {
      const res = await tolakVerifikasiAset(revisiModalAset.id, revisiCatatan);
      if (res.success) {
        showToast(res.message, 'info');
        setRevisiModalAset(null);
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSubmittingRevisi(false);
    }
  };

  // Revert Verification
  const handleBatalkanVerifikasi = async (aset: Aset) => {
    if (!window.confirm(`Batalkan pengesahan verifikasi untuk aset "${aset.namaAset}" dan kembalikan ke status belum diverifikasi?`)) {
      return;
    }
    const res = await batalkanVerifikasiAset(aset.id);
    if (res.success) {
      showToast(res.message, 'info');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Quick Verify All Pending
  const handleVerifyAllPending = async () => {
    if (stats.pendingCount === 0) {
      showToast('Tidak ada aset yang sedang menunggu verifikasi.', 'info');
      return;
    }
    if (!window.confirm(`Apakah Anda yakin ingin memverifikasi dan mengesahkan seluruh ${stats.pendingCount} aset yang sedang menunggu verifikasi sekaligus?`)) {
      return;
    }
    const res = await verifikasiSemuaAsetPending();
    if (res.success) {
      showToast(res.message);
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce ${
            toastMessage.type === 'error'
              ? 'bg-rose-600'
              : toastMessage.type === 'info'
              ? 'bg-amber-600'
              : 'bg-emerald-600'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-white" />
          ) : toastMessage.type === 'info' ? (
            <Info className="w-4 h-4 shrink-0 text-white" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Modul Verifikasi Aset Masuk
            </span>
            <span className="text-xs text-slate-400">
              Kecamatan Sirombu • Kabupaten Nias Barat
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>Verifikasi Aset yang Sudah Diinput Desa</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Pemeriksaan fisik, keabsahan bukti kepemilikan (BAST / Kuitansi / Sertifikat), nomor registrasi urut, serta pengesahan inventaris desa sebelum dicatat ke dalam Buku Inventaris Aset Desa sesuai Permendagri No. 20 Tahun 2018.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
          {stats.pendingCount > 0 && (
            <button
              type="button"
              onClick={handleVerifyAllPending}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              title="Sahkan & Verifikasi Seluruh Aset yang Menunggu Verifikasi"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sahkan Semua Pending ({stats.pendingCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Menunggu Verifikasi */}
        <button
          type="button"
          onClick={() => {
            setStatusTab('menunggu');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            statusTab === 'menunggu'
              ? 'bg-amber-950/70 border-amber-500 text-amber-200 shadow-lg shadow-amber-500/10'
              : 'bg-[#0E1526] border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Menunggu Verifikasi</span>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400">
            {stats.pendingCount} <span className="text-xs font-semibold text-slate-400">Aset</span>
          </div>
          <div className="text-[11px] font-mono font-bold text-amber-200/80 mt-1 truncate">
            {formatRupiah(stats.pendingNilai)}
          </div>
          {stats.pendingCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          )}
        </button>

        {/* Card 2: Sudah Diverifikasi */}
        <button
          type="button"
          onClick={() => {
            setStatusTab('sudah');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer overflow-hidden ${
            statusTab === 'sudah'
              ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/10'
              : 'bg-[#0E1526] border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Telah Disahkan Sah</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {stats.verifiedCount} <span className="text-xs font-semibold text-slate-400">Aset</span>
          </div>
          <div className="text-[11px] font-mono font-bold text-emerald-300/80 mt-1 truncate">
            {formatRupiah(stats.verifiedNilai)}
          </div>
        </button>

        {/* Card 3: Perlu Perbaikan */}
        <button
          type="button"
          onClick={() => {
            setStatusTab('perbaikan');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer overflow-hidden ${
            statusTab === 'perbaikan'
              ? 'bg-rose-950/70 border-rose-500 text-rose-200 shadow-lg shadow-rose-500/10'
              : 'bg-[#0E1526] border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Perlu Perbaikan</span>
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400">
            {stats.perluPerbaikanCount} <span className="text-xs font-semibold text-slate-400">Aset</span>
          </div>
          <div className="text-[11px] font-mono font-bold text-rose-300/80 mt-1 truncate">
            {formatRupiah(stats.perluPerbaikanNilai)}
          </div>
        </button>

        {/* Card 4: Total Seluruh Aset */}
        <button
          type="button"
          onClick={() => {
            setStatusTab('all');
            setCurrentPage(1);
          }}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer overflow-hidden ${
            statusTab === 'all'
              ? 'bg-slate-800 border-blue-500 text-white shadow-lg'
              : 'bg-[#0E1526] border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Semua Aset Terdata</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">
            {stats.totalCount} <span className="text-xs font-semibold text-slate-400">Unit</span>
          </div>
          <div className="text-[11px] font-mono font-bold text-blue-300/80 mt-1 truncate">
            {formatRupiah(stats.totalNilai)}
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tabs Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setStatusTab('menunggu');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusTab === 'menunggu'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Menunggu ({stats.pendingCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('sudah');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusTab === 'sudah'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sudah Diverifikasi ({stats.verifiedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('perbaikan');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusTab === 'perbaikan'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Perlu Perbaikan ({stats.perluPerbaikanCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusTab('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusTab === 'all'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua ({stats.totalCount})
            </button>
          </div>

          {/* Quick Count Badge */}
          <div className="text-xs text-slate-400">
            Menampilkan <strong className="text-white">{filteredAsets.length}</strong> dari{' '}
            <strong className="text-slate-300">{activeAsets.length}</strong> aset
          </div>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 text-xs">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Cari nama, kode, register aset..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
            />
          </div>

          {/* Desa Filter */}
          <div>
            <select
              value={filterDesa}
              onChange={(e) => {
                setFilterDesa(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs truncate"
            >
              <option value="all">Semua 25 Desa di Sirombu</option>
              {desas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Klasifikasi Filter */}
          <div>
            <select
              value={filterKlasifikasi}
              onChange={(e) => {
                setFilterKlasifikasi(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs truncate"
            >
              <option value="all">Semua Klasifikasi Aset</option>
              <option value="Tanah">Tanah</option>
              <option value="Peralatan, Mesin, dan Alat Berat">Peralatan, Mesin, dan Alat Berat</option>
              <option value="Kendaraan">Kendaraan</option>
              <option value="Gedung dan Bangunan">Gedung dan Bangunan</option>
              <option value="Jalan">Jalan</option>
              <option value="Jembatan">Jembatan</option>
              <option value="Irigasi/Embung/Air Sungai/Drainase">Irigasi/Embung/Drainase</option>
              <option value="Jaringan/Instalasi">Jaringan/Instalasi</option>
              <option value="Aset Tetap Lainnya">Aset Tetap Lainnya</option>
            </select>
          </div>

          {/* Tahun Filter */}
          <div>
            <select
              value={filterTahun}
              onChange={(e) => {
                setFilterTahun(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
            >
              <option value="all">Semua Tahun Perolehan</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  Tahun Anggaran {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Toolbar if items selected */}
        {selectedAssetIds.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 animate-fade-in text-xs">
            <div className="flex items-center gap-2 text-amber-200 font-bold">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span>{selectedAssetIds.length} aset dipilih untuk diproses bersama</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedAssetIds([])}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Batal Pilihan
              </button>
              <button
                type="button"
                onClick={handleOpenBulkVerifyModal}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verifikasi Masal ({selectedAssetIds.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Asset Table / List */}
      <div className="bg-[#0E1526] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {filteredAsets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <ShieldCheck className="w-12 h-12 mx-auto text-slate-600" />
            <h3 className="text-base font-bold text-slate-300">
              Tidak Ada Aset yang Sesuai Kriteria Filter
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {statusTab === 'menunggu'
                ? 'Seluruh aset yang diinput telah diverifikasi dan disahkan oleh Kecamatan Sirombu.'
                : 'Coba ubah kriteria pencarian atau pilih tab status lain di atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllCurrentPage}
                      className="cursor-pointer text-slate-400 hover:text-white"
                      title={isAllCurrentPageSelected ? 'Batalkan semua' : 'Pilih semua di halaman ini'}
                    >
                      {isAllCurrentPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3">Objek Aset & Register</th>
                  <th className="py-3 px-3">Desa & Klasifikasi</th>
                  <th className="py-3 px-3">Nilai & Tahun</th>
                  <th className="py-3 px-3">Bukti Kepemilikan</th>
                  <th className="py-3 px-3 text-center">Foto Fisik</th>
                  <th className="py-3 px-3">Status & Verifikator</th>
                  <th className="py-3 px-3 text-center">Aksi Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {paginatedAsets.map((item) => {
                  const isSelected = selectedAssetIds.includes(item.id);
                  const verifStatus = getAsetVerificationStatus(item, verifikasiList, pengesahanList);
                  const isPending =
                    item.statusVerifikasi === 'sedang_diproses' ||
                    item.statusVerifikasi === 'belum_diverifikasi' ||
                    item.status === 'mutasi_diajukan' ||
                    item.status === 'terhapus_diajukan';
                  const isVerified = item.statusVerifikasi === 'sudah_diverifikasi';
                  const isPerluPerbaikan = item.statusVerifikasi === 'perlu_perbaikan';
                  const hasPhoto = item.fotoAset && item.fotoAset.length > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isSelected ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(item.id)}
                          className="cursor-pointer text-slate-500 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-700" />
                          )}
                        </button>
                      </td>

                      {/* Objek Aset & Register */}
                      <td className="py-3 px-3 min-w-[200px]">
                        <div className="font-bold text-white text-sm hover:text-emerald-400 transition-colors cursor-pointer" onClick={() => setDetailAset(item)}>
                          {item.namaAset}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono">
                          <span className="text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            Reg: {item.nomorRegister || '0001'}
                          </span>
                          <span className="text-slate-400 truncate max-w-[130px]" title={item.kodeAset}>
                            {item.kodeAset}
                          </span>
                        </div>
                        {item.volume && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Volume: <span className="text-slate-200">{item.volume}</span>
                          </div>
                        )}
                      </td>

                      {/* Desa & Klasifikasi */}
                      <td className="py-3 px-3 min-w-[170px]">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold text-[11px] border border-slate-700 truncate max-w-[180px]">
                          {item.desaName}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-1 line-clamp-1" title={item.klasifikasi}>
                          {item.klasifikasi}
                        </div>
                      </td>

                      {/* Nilai & Tahun */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-emerald-400 font-mono text-xs">
                          {formatRupiah(item.nilaiPerolehan)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Tahun {item.tahunPerolehan}{' '}
                          <span className="text-slate-500">({item.sumberDana})</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Kondisi:{' '}
                          <span
                            className={
                              item.kondisi === 'Baik'
                                ? 'text-emerald-400'
                                : item.kondisi === 'Rusak Ringan'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }
                          >
                            {item.kondisi}
                          </span>
                        </div>
                      </td>

                      {/* Bukti Kepemilikan */}
                      <td className="py-3 px-3 min-w-[150px]">
                        <div className="text-[11px] font-semibold text-slate-200 truncate">
                          {item.bukti?.jenis || 'Kwitansi / BAST'}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[160px]" title={item.bukti?.nomor}>
                          No: {item.bukti?.nomor || '-'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Tgl: {item.bukti?.tanggal || '-'}
                        </div>
                      </td>

                      {/* Foto Fisik */}
                      <td className="py-3 px-3 text-center">
                        {hasPhoto ? (
                          <div
                            onClick={() => setDetailAset(item)}
                            className="relative inline-block cursor-pointer group"
                            title="Klik untuk melihat foto fisik aset"
                          >
                            <img
                              src={getPhotoUrl(item.fotoAset![0])}
                              alt={item.namaAset}
                              onError={handlePhotoError}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-700 group-hover:border-emerald-400 transition-all shadow"
                            />
                            {item.fotoAset!.length > 1 && (
                              <span className="absolute -top-1 -right-1 px-1 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                                +{item.fotoAset!.length - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic block">
                            Tanpa Foto
                          </span>
                        )}
                      </td>

                      {/* Status & Verifikator */}
                      <td className="py-3 px-3 min-w-[180px]">
                        <AsetVerificationBadge statusInfo={verifStatus} size="sm" />
                        {item.diverifikasiOleh && (
                          <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                            Oleh: <span className="text-slate-200 font-semibold">{item.diverifikasiOleh}</span>
                          </div>
                        )}
                        {item.tanggalVerifikasi && (
                          <div className="text-[9px] text-slate-500">
                            {formatTanggalIndonesia(item.tanggalVerifikasi)}
                          </div>
                        )}
                        {item.catatanVerifikasi && (
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 italic" title={item.catatanVerifikasi}>
                            "{item.catatanVerifikasi}"
                          </div>
                        )}
                      </td>

                      {/* Aksi Verifikasi */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Approve / Verify button */}
                          {(!isVerified || isPerluPerbaikan || isPending) && (
                            <button
                              type="button"
                              onClick={() => handleOpenVerifyModal(item)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                              title="Sahkan & Verifikasi Aset Ini"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Sahkan</span>
                            </button>
                          )}

                          {/* Tolak / Minta Perbaikan button */}
                          {!isPerluPerbaikan && (
                            <button
                              type="button"
                              onClick={() => handleOpenRevisiModal(item)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title="Catat Kekurangan / Minta Desa Perbaiki Data"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Perbaikan</span>
                            </button>
                          )}

                          {/* Revert if already verified */}
                          {isVerified && (
                            <button
                              type="button"
                              onClick={() => handleBatalkanVerifikasi(item)}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Batalkan Pengesahan Verifikasi (Kembalikan ke antrean)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View Detail Button */}
                          <button
                            type="button"
                            onClick={() => setDetailAset(item)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Lihat Detail Lengkap Aset & Foto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Print Lembar Verifikasi */}
                          <button
                            type="button"
                            onClick={() => setPrintModalAset(item)}
                            className="p-1 rounded-lg bg-blue-950/40 hover:bg-blue-900 border border-blue-500/30 text-blue-300 hover:text-white transition-colors cursor-pointer"
                            title="Cetak Berita Acara / Lembar Verifikasi Aset"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-400">
              Halaman <strong className="text-white">{currentPage}</strong> dari{' '}
              <strong className="text-white">{totalPages}</strong> ({filteredAsets.length} total aset)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer disabled:cursor-not-allowed font-semibold"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer disabled:cursor-not-allowed font-semibold"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Single Asset Verification Modal */}
      {verifyModalAset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0E1526] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setVerifyModalAset(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Pengesahan & Verifikasi Aset Desa
                </h3>
                <p className="text-xs text-slate-400">
                  {verifyModalAset.desaName} • {verifyModalAset.namaAset}
                </p>
              </div>
            </div>

            {/* Quick summary of the asset */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Kode Aset:</span>
                <span className="font-mono text-slate-200">{verifyModalAset.kodeAset}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Nomor Register:</span>
                <span className="font-mono text-amber-300 font-bold">{verifyModalAset.nomorRegister || '-'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Nilai Perolehan:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatRupiah(verifyModalAset.nilaiPerolehan)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Bukti Perolehan:</span>
                <span className="text-slate-200">{verifyModalAset.bukti?.jenis || '-'} No. {verifyModalAset.bukti?.nomor || '-'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Foto Fisik:</span>
                <span className="text-slate-200">
                  {verifyModalAset.fotoAset?.length ? `${verifyModalAset.fotoAset.length} Foto Terlampir` : 'Belum Ada Foto'}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSingleVerify} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Nomor Berita Acara / SK Pengesahan Verifikasi *
                </label>
                <input
                  type="text"
                  required
                  value={verifyNomorSK}
                  onChange={(e) => setVerifyNomorSK(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Catatan Verifikasi & Rekomendasi Tim Monitoring *
                </label>
                <textarea
                  required
                  rows={3}
                  value={verifyCatatan}
                  onChange={(e) => setVerifyCatatan(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setVerifyModalAset(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVerify}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingVerify ? 'Menyimpan...' : 'Sahkan & Terbitkan Status'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Bulk Verification Modal */}
      {showBulkVerifyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0E1526] border border-emerald-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowBulkVerifyModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Verifikasi Masal {selectedAssetIds.length} Aset Terpilih
                </h3>
                <p className="text-xs text-emerald-300/80">
                  Pemeriksaan serentak inventaris aset desa se-Kecamatan Sirombu
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Seluruh <strong>{selectedAssetIds.length} aset terpilih</strong> akan dinyatakan sah, berstatus <em>Sudah Diverifikasi</em>, dan tercatat resmi atas nama verifikator <strong>{currentUser?.name || 'Admin Kecamatan'}</strong>.
            </p>

            <form onSubmit={handleConfirmBulkVerify} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Nomor Berita Acara Verifikasi Masal *
                </label>
                <input
                  type="text"
                  required
                  value={bulkNomorSK}
                  onChange={(e) => setBulkNomorSK(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Catatan Pengesahan Serentak *
                </label>
                <textarea
                  required
                  rows={3}
                  value={bulkCatatan}
                  onChange={(e) => setBulkCatatan(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBulkVerifyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBulk}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingBulk ? 'Memproses...' : `Sahkan ${selectedAssetIds.length} Aset Sekaligus`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reject / Need Revision Modal */}
      {revisiModalAset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0E1526] border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setRevisiModalAset(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Permintaan Perbaikan Data Aset Desa
                </h3>
                <p className="text-xs text-amber-300/80">
                  {revisiModalAset.desaName} • {revisiModalAset.namaAset}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Aset akan ditandai berstatus <strong className="text-rose-400">Perlu Perbaikan</strong>. Catatan ini akan terbaca langsung oleh pihak desa saat memeriksa menu Data Aset mereka.
            </p>

            <form onSubmit={handleConfirmRevisi} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Catatan Kekurangan & Instruksi Perbaikan untuk Desa *
                </label>
                <textarea
                  required
                  rows={4}
                  value={revisiCatatan}
                  onChange={(e) => setRevisiCatatan(e.target.value)}
                  placeholder="Contoh: Mohon unggah bukti fisik kuitansi pembelian asli, lengkapi foto aset fisik dari sisi depan dan samping..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs leading-relaxed focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRevisiModalAset(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRevisi}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-slate-950" />
                  <span>{isSubmittingRevisi ? 'Mengirim...' : 'Kirim Catatan Perbaikan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Printable Official Lembar Berita Acara Verifikasi */}
      {printModalAset && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Action Bar */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-700" />
                <span className="font-bold text-sm text-slate-800">
                  Lembar Berita Acara Hasil Verifikasi Lapangan
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Dokumen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalAset(null)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="space-y-4 text-xs font-serif leading-relaxed" id="printable-verif-sheet">
              {/* Kop Surat */}
              <div className="text-center border-b-2 border-black pb-3">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <NiasBaratLogo size={48} />
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider">
                      PEMERINTAH KABUPATEN NIAS BARAT
                    </h2>
                    <h3 className="text-base font-black uppercase tracking-tight">
                      KECAMATAN SIROMBU
                    </h3>
                    <p className="text-[10px] font-sans text-slate-600">
                      {kecamatanProfile?.alamatKantor || 'Jl. Sirombu - Lahomi'} • Pos: {kecamatanProfile?.kodePos || '22863'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Judul Dokumen */}
              <div className="text-center pt-2">
                <h4 className="text-sm font-bold underline uppercase">
                  BERITA ACARA VERIFIKASI FISIK & DOKUMEN ASET TETAP DESA
                </h4>
                <p className="text-[11px] font-mono text-slate-700 mt-0.5">
                  Nomor: {printModalAset.nomorSKVerifikasi || `BA-VERIF-KEC/${new Date().getFullYear()}/${printModalAset.nomorRegister || '0001'}`}
                </p>
              </div>

              <p className="text-justify font-sans text-xs">
                Pada hari ini, bertempat di Kantor Kecamatan Sirombu, Tim Monitoring dan Evaluasi Inventaris Aset Desa Kecamatan Sirombu telah melaksanakan pemeriksaan fisik lapangan dan validasi dokumen kepemilikan atas aset desa sebagai berikut:
              </p>

              {/* Data Table */}
              <table className="w-full border-collapse border border-slate-300 font-sans text-xs">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold w-40 bg-slate-100">Nama Desa</td>
                    <td className="p-2 font-bold">{printModalAset.desaName}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-100">Nama Objek Aset</td>
                    <td className="p-2 font-bold text-emerald-800">{printModalAset.namaAset}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-100">Kode & Nomor Register</td>
                    <td className="p-2 font-mono">
                      {printModalAset.kodeAset} / Reg: <strong>{printModalAset.nomorRegister || '-'}</strong>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-100">Klasifikasi Aset</td>
                    <td className="p-2">{printModalAset.klasifikasi}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-100">Tahun & Nilai Perolehan</td>
                    <td className="p-2 font-bold">
                      Tahun {printModalAset.tahunPerolehan} — {formatRupiah(printModalAset.nilaiPerolehan)} ({printModalAset.sumberDana})
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-100">Bukti Kepemilikan</td>
                    <td className="p-2">
                      {printModalAset.bukti?.jenis || 'Kwitansi / BAST'} No. {printModalAset.bukti?.nomor || '-'} (Tgl: {printModalAset.bukti?.tanggal || '-'})
                    </td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-100">Kondisi Fisik Saat Ini</td>
                    <td className="p-2 font-bold">{printModalAset.kondisi}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold bg-slate-100">Catatan & Kesimpulan</td>
                    <td className="p-2 italic">
                      {printModalAset.catatanVerifikasi ||
                        'Objek aset ada, berkas perolehan sah dan lengkap, serta nomor register sesuai urutan Permendagri No. 20/2018.'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Photo Preview if available */}
              {printModalAset.fotoAset && printModalAset.fotoAset.length > 0 && (
                <div className="pt-2">
                  <div className="font-bold text-[11px] mb-1 font-sans text-slate-700">Lampiran Bukti Fisik Aset:</div>
                  <div className="flex gap-2">
                    {printModalAset.fotoAset.slice(0, 2).map((img, idx) => (
                      <img
                        key={idx}
                        src={getPhotoUrl(img)}
                        alt="Foto aset"
                        onError={handlePhotoError}
                        className="w-32 h-24 object-cover rounded border border-slate-300"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tanda Tangan */}
              <div className="pt-8 grid grid-cols-2 text-center font-sans text-xs">
                <div>
                  <p className="text-slate-600">Mengetahui,</p>
                  <p className="font-bold">Kepala Desa {printModalAset.desaName.replace(/DESA\s*/i, '')}</p>
                  <div className="h-16" />
                  <p className="font-bold underline">
                    {desas.find((d) => d.id === printModalAset.desaId)?.kepalaDesa || 'KEPALA DESA'}
                  </p>
                </div>

                <div>
                  <p className="text-slate-600">
                    Sirombu, {formatTanggalIndonesia(printModalAset.tanggalVerifikasi || new Date().toISOString())}
                  </p>
                  <p className="font-bold">Tim Verifikator Kecamatan Sirombu</p>
                  <div className="h-16" />
                  <p className="font-bold underline">
                    {printModalAset.diverifikasiOleh || currentUser?.name || kecamatanProfile?.namaCamat || 'TIM VERIFIKASI'}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    NIP. {kecamatanProfile?.nipCamat || '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Aset Detail Modal Integration */}
      {detailAset && (
        <AsetDetailModal
          aset={detailAset}
          isOpen={Boolean(detailAset)}
          onClose={() => setDetailAset(null)}
          onOpenBarcode={() => {}}
        />
      )}
    </div>
  );
};
