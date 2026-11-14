import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatRupiah, formatTanggalWaktuIndonesia } from '../utils/reportGenerator';
import { ThreeDColumnChart, ColumnChartItem } from './ThreeDColumnChart';
import { ThreeDPieChart, PieChartItem } from './ThreeDPieChart';
import { AnnouncementReaderModal } from './AnnouncementReaderModal';
import { BroadcastMessageModal } from './BroadcastMessageModal';
import { AsetDetailModal } from './AsetDetailModal';
import { BarcodeModal } from './BarcodeModal';
import { CPanelMigrationModal } from './CPanelMigrationModal';
import { Aset } from '../types';
import {
  getAsetVerificationStatus,
  AsetVerificationBadge,
  VerificationStatusType,
} from '../utils/verificationHelper';
import { getPhotoUrl, handlePhotoError } from '../utils/photoUrl';
import {
  Boxes,
  Layers,
  Coins,
  Building,
  Filter,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  QrCode,
  Eye,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Camera,
  X,
  Server,
  Megaphone,
  Send,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    asets,
    verifikasiList,
    pengesahanList,
    desas,
    selectedDesaFilter,
    setSelectedDesaFilter,
    currentUser,
    setActiveTab,
    announcements,
    unreadAnnouncementCount,
    verifikasiAset,
    verifikasiSemuaAsetPending,
    pendingVerificationCount,
  } = useApp();

  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showCPanelModal, setShowCPanelModal] = useState(false);
  const [verifFeedback, setVerifFeedback] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState<boolean>(false);

  // Asset list filters & modals in Dashboard
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatusType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const [selectedDetailAset, setSelectedDetailAset] = useState<Aset | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedBarcodeAset, setSelectedBarcodeAset] = useState<Aset | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState<boolean>(false);

  // Active village filter
  const isDesaUser = currentUser?.role === 'admin_desa';
  const effectiveDesaId = isDesaUser ? currentUser.desaId || 'desa-21' : selectedDesaFilter;

  const currentDesa = desas.find((d) => d.id === effectiveDesaId);

  // Filtered assets based on village
  const activeAsets = useMemo(() => {
    return asets.filter((a) => {
      if (a.status === 'terhapus') return false;
      if (effectiveDesaId !== 'all') {
        return a.desaId === effectiveDesaId;
      }
      return true;
    });
  }, [asets, effectiveDesaId]);

  // Map assets with verification status details
  const asetsWithStatus = useMemo(() => {
    return activeAsets.map((item) => ({
      aset: item,
      verifInfo: getAsetVerificationStatus(item, verifikasiList, pengesahanList),
    }));
  }, [activeAsets, verifikasiList, pengesahanList]);

  // Status counters
  const countSudahDiverifikasi = useMemo(() => {
    return asetsWithStatus.filter((i) => i.verifInfo.status === 'sudah_diverifikasi').length;
  }, [asetsWithStatus]);

  const countSedangDiproses = useMemo(() => {
    return asetsWithStatus.filter((i) => i.verifInfo.status === 'sedang_diproses').length;
  }, [asetsWithStatus]);

  const countBelumDiverifikasi = useMemo(() => {
    return asetsWithStatus.filter((i) => i.verifInfo.status === 'belum_diverifikasi').length;
  }, [asetsWithStatus]);

  // Filtered items based on status, category, and search query
  const filteredAssetItems = useMemo(() => {
    return asetsWithStatus.filter(({ aset, verifInfo }) => {
      if (statusFilter !== 'all' && verifInfo.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'all') {
        const cleanCat = (aset.klasifikasi || '').replace(/^[I|V|X]+\.\s*/, '');
        if (cleanCat !== categoryFilter && aset.klasifikasi !== categoryFilter) {
          return false;
        }
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = (aset.namaAset || '').toLowerCase().includes(q);
        const matchesKode = (aset.kodeAset || '').toLowerCase().includes(q);
        const matchesReg = (aset.nomorRegister || '').toLowerCase().includes(q);
        const matchesDesa = (aset.desaName || '').toLowerCase().includes(q);
        const matchesLokasi = (aset.lokasi || '').toLowerCase().includes(q);
        const matchesMerk = (aset.merk || '').toLowerCase().includes(q);
        return matchesName || matchesKode || matchesReg || matchesDesa || matchesLokasi || matchesMerk;
      }
      return true;
    });
  }, [asetsWithStatus, statusFilter, categoryFilter, searchTerm]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, searchTerm, effectiveDesaId]);

  const totalPages = Math.ceil(filteredAssetItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAssetItems.slice(start, start + itemsPerPage);
  }, [filteredAssetItems, currentPage]);

  const handleOpenDetail = (aset: Aset) => {
    setSelectedDetailAset(aset);
    setShowDetailModal(true);
  };

  const handleOpenBarcode = (aset: Aset) => {
    setSelectedBarcodeAset(aset);
    setShowBarcodeModal(true);
  };

  const isAdminOrSuper = currentUser?.role === 'super_admin' || currentUser?.role === 'admin_kecamatan';

  const handleVerifySingle = async (asetId: string, namaAset: string) => {
    if (!isAdminOrSuper) return;
    setVerifyingId(asetId);
    try {
      const res = await verifikasiAset(
        asetId,
        `Diverifikasi langsung via Dashboard oleh ${currentUser?.name || 'Admin Kecamatan'}`
      );
      if (res.success) {
        setVerifFeedback(`Aset "${namaAset}" berhasil diverifikasi dan disahkan.`);
        setTimeout(() => setVerifFeedback(null), 4000);
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!isAdminOrSuper || pendingVerificationCount === 0) return;
    setIsVerifyingAll(true);
    try {
      const res = await verifikasiSemuaAsetPending();
      if (res.success) {
        setVerifFeedback(`Berhasil memverifikasi ${res.count} aset desa sekaligus.`);
        setTimeout(() => setVerifFeedback(null), 5000);
      }
    } finally {
      setIsVerifyingAll(false);
    }
  };

  // Calculate metrics
  const distinctCategories = new Set(activeAsets.map((a) => a.klasifikasi)).size;
  const totalUnit = activeAsets.length;
  const totalNilai = activeAsets.reduce((sum, item) => sum + (item.nilaiPerolehan || 0), 0);

  // 1. Data Total Aset Per Desa (Untuk Admin / Super Admin)
  const totalAsetPerDesaData: ColumnChartItem[] = useMemo(() => {
    return (desas || []).map((d) => {
      const desaAsets = asets.filter((a) => a.desaId === d.id && a.status !== 'terhapus');
      const valSum = desaAsets.reduce((sum, a) => sum + (a.nilaiPerolehan || 0), 0);
      const rawName = d?.name || 'Desa';
      return {
        id: d.id,
        label: rawName.replace(/^DESA\s+/i, ''),
        subLabel: rawName,
        value: desaAsets.length,
        secondaryValue: valSum,
        badge: `${desaAsets.length} Unit`,
      };
    });
  }, [desas, asets]);

  // 2. Data Aset Per Kategori (Untuk Pie Chart Admin & Column Chart Desa)
  const asetPerKategoriData: ColumnChartItem[] = useMemo(() => {
    const map: Record<string, { count: number; totalNilai: number }> = {};
    activeAsets.forEach((a) => {
      const cat = (a.klasifikasi || 'Lainnya').replace(/^[I|V|X]+\.\s*/, '');
      if (!map[cat]) {
        map[cat] = { count: 0, totalNilai: 0 };
      }
      map[cat].count += 1;
      map[cat].totalNilai += a.nilaiPerolehan || 0;
    });

    return Object.entries(map).map(([kategori, val], idx) => ({
      id: `cat-${idx}`,
      label: kategori,
      value: val.count,
      secondaryValue: val.totalNilai,
      badge: `${val.count} Unit`,
    }));
  }, [activeAsets]);

  // Data Pie Chart Kategori
  const pieKategoriData: PieChartItem[] = useMemo(() => {
    return asetPerKategoriData.map((d) => ({
      id: d.id,
      label: d.label,
      value: d.value,
      secondaryValue: d.secondaryValue,
    }));
  }, [asetPerKategoriData]);

  // 3. Data Kondisi Barang (Untuk Pie Chart Desa & Admin)
  const countBaik = useMemo(() => activeAsets.filter((a) => a.kondisi === 'Baik').length, [activeAsets]);
  const countRingan = useMemo(() => activeAsets.filter((a) => a.kondisi === 'Rusak Ringan').length, [activeAsets]);
  const countBerat = useMemo(() => activeAsets.filter((a) => a.kondisi === 'Rusak Berat').length, [activeAsets]);

  const pieKondisiData: PieChartItem[] = useMemo(() => {
    const baik = activeAsets.filter((a) => a.kondisi === 'Baik');
    const ringan = activeAsets.filter((a) => a.kondisi === 'Rusak Ringan');
    const berat = activeAsets.filter((a) => a.kondisi === 'Rusak Berat');

    return [
      {
        id: 'kondisi-baik',
        label: 'Baik',
        value: baik.length,
        secondaryValue: baik.reduce((s, a) => s + (a.nilaiPerolehan || 0), 0),
        color: '#059669',
        description: 'Siap pakai dan terpelihara',
      },
      {
        id: 'kondisi-ringan',
        label: 'Rusak Ringan',
        value: ringan.length,
        secondaryValue: ringan.reduce((s, a) => s + (a.nilaiPerolehan || 0), 0),
        color: '#d97706',
        description: 'Perlu servis & pemeliharaan ringan',
      },
      {
        id: 'kondisi-berat',
        label: 'Rusak Berat',
        value: berat.length,
        secondaryValue: berat.reduce((s, a) => s + (a.nilaiPerolehan || 0), 0),
        color: '#e11d48',
        description: 'Dapat diajukan mutasi/penghapusan',
      },
    ].filter((k) => k.value > 0 || totalUnit === 0);
  }, [activeAsets, totalUnit]);

  const keteranganKondisi = `Baik ${countBaik} Unit, Rusak Ringan ${countRingan} Unit, Rusak Berat ${countBerat} Unit`;

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase mb-1">
            DASHBOARD INVENTARIS
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            {effectiveDesaId === 'all'
              ? 'Kecamatan Sirombu'
              : currentDesa?.name || 'Kecamatan Sirombu'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Halo {currentUser?.name || 'Administrator'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap justify-end">
          {/* Tombol Notifikasi Verifikasi Aset Baru (Khusus Admin / Super Admin) */}
          {isAdminOrSuper && pendingVerificationCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('verifikasi_aset')}
              className="p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer shadow-md bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/70 text-amber-300 shadow-amber-500/20"
              title={`Ada ${pendingVerificationCount} aset desa menunggu verifikasi admin. Klik untuk buka Menu Verifikasi Aset.`}
            >
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[9px] font-black text-slate-950 items-center justify-center">
                    {pendingVerificationCount}
                  </span>
                </span>
              </div>
              <span className="text-xs font-bold hidden sm:inline">
                {pendingVerificationCount} Perlu Verifikasi
              </span>
            </button>
          )}

          {/* Tombol Lonceng Pesan Berkedip (Isi pesan tersembunyi sampai diklik) */}
          {announcements.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAnnounceModal(true)}
              className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                unreadAnnouncementCount > 0
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/60 text-amber-300 shadow-amber-500/20'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title="Klik gambar lonceng untuk membuka pesan pengumuman"
            >
              <div className="relative">
                <Bell className={`w-4 h-4 ${unreadAnnouncementCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
                {unreadAnnouncementCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[9px] font-black text-white items-center justify-center">
                      {unreadAnnouncementCount}
                    </span>
                  </span>
                )}
              </div>
              <span className="text-xs font-bold hidden sm:inline">
                {unreadAnnouncementCount > 0 ? `${unreadAnnouncementCount} Pesan Baru` : 'Pengumuman'}
              </span>
            </button>
          )}

          {/* Filter Wilayah (Desa Selector for Kecamatan / Super Admin) */}
          {!isDesaUser && (
            <div className="flex items-center gap-2 bg-[#0E1526] border border-slate-800 shadow-lg rounded-xl px-3.5 py-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400 font-medium">Filter Wilayah:</span>
              <select
                value={selectedDesaFilter}
                onChange={(e) => setSelectedDesaFilter(e.target.value)}
                className="bg-transparent font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">Semua Desa (25 Desa)</option>
                {desas.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tombol Hosting cPanel */}
          {isAdminOrSuper && (
            <button
              type="button"
              onClick={() => setShowCPanelModal(true)}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-indigo-500/60 bg-gradient-to-r from-indigo-950 via-purple-950/90 to-slate-900 hover:from-indigo-900 hover:to-purple-900 text-white flex items-center gap-2 text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-950/40"
              title="Pengaturan Migrasi & Sinkronisasi Database ke Hosting cPanel (shodns.in)"
            >
              <Server className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Hosting cPanel</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/50 font-bold hidden md:inline">
                Bebas Kuota
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Pemberitahuan Verifikasi Aset untuk Akun Admin / Super Admin */}
      {isAdminOrSuper && pendingVerificationCount > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-emerald-950/80 border-2 border-amber-500/60 p-5 shadow-2xl shadow-amber-950/50">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
                    Pemberitahuan Verifikasi
                  </span>
                  <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    {pendingVerificationCount} Aset Menunggu Verifikasi
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-white mt-1">
                  Terdapat {pendingVerificationCount} Aset Desa Baru Berstatus &quot;Sedang Diproses&quot;
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Pemerintah desa baru saja menginput data aset inventaris. Sesuai wewenang{' '}
                  <strong className="text-amber-300 font-bold">
                    {currentUser?.role === 'super_admin' ? 'Super Admin' : 'Admin Kecamatan'}
                  </strong>
                  , silakan lakukan pemeriksaan dan verifikasi data fisik agar aset sah tercatat dalam Buku Inventaris.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              <button
                type="button"
                onClick={() => setActiveTab('verifikasi_aset')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer"
                title="Buka Menu Verifikasi Aset Masuk"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Buka Menu Verifikasi ({pendingVerificationCount})
              </button>

              <button
                type="button"
                onClick={handleVerifyAll}
                disabled={isVerifyingAll}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isVerifyingAll ? 'Memverifikasi...' : `Verifikasi Semua (${pendingVerificationCount})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Jenis Aset */}
        <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Boxes className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            JENIS ASET
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            {distinctCategories}
          </div>
        </div>

        {/* Card 2: Total Unit */}
        <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            TOTAL UNIT
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            {totalUnit}
          </div>
        </div>

        {/* Card 3: Nilai Perolehan */}
        <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            NILAI PEROLEHAN
          </div>
          <div className="text-2xl lg:text-3xl font-black text-amber-300 tracking-tight truncate font-mono">
            {formatRupiah(totalNilai)}
          </div>
        </div>

        {/* Card 4: Wilayah */}
        <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            WILAYAH
          </div>
          <div className="text-xl lg:text-2xl font-black text-white tracking-tight truncate">
            {effectiveDesaId === 'all'
              ? 'Kec. Sirombu'
              : (currentDesa?.name || '').replace('DESA ', '') || 'Kec. Sirombu'}
          </div>
        </div>
      </div>

      {/* DASHBOARD CHARTS SECTION */}
      {!isDesaUser ? (
        /* ================= ADMIN / SUPER ADMIN VIEW ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sisi Kiri: Total Aset semua desa menurut Kategori */}
          <div className="lg:col-span-7 bg-[#0E1526] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Total Aset Menurut Kategori</span>
                </h2>
              </div>

              <ThreeDColumnChart
                data={asetPerKategoriData}
                isDesaComparison={false}
                valueLabel="Total Unit Aset"
                secondaryValueLabel="Total Nilai Aset"
                height={340}
              />
            </div>
          </div>

          {/* Sisi Kanan: Rekap Total Aset Sesuai Kondisi */}
          <div className="lg:col-span-5 bg-[#0E1526] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="mb-3">
                <h2 className="text-base font-bold text-white">
                  Rekap Total Aset Sesuai Kondisi
                </h2>
              </div>

              <ThreeDPieChart
                data={pieKondisiData}
                unitLabel="Unit"
                emptyMessage="Belum ada data kondisi aset"
                footerNote={
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 font-bold">Keterangan:</span>
                    <div className="flex flex-wrap items-center gap-3 font-semibold">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Baik {countBaik} Unit
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Rusak Ringan {countRingan} Unit
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-rose-400">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Rusak Berat {countBerat} Unit
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      ) : (
        /* ================= DESA VIEW ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sisi Kiri: Aset Per Kategori dalam Grafik 3-D Column */}
          <div className="lg:col-span-7 bg-[#0E1526] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Aset Per Kategori</span>
                  <span className="text-xs font-normal text-emerald-400 font-bold">
                    • {currentDesa?.name || 'Desa'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Grafik 3-D Column rincian aset berdasarkan jenis klasifikasi barang desa.
                </p>
              </div>

              <ThreeDColumnChart
                data={asetPerKategoriData}
                isDesaComparison={false}
                valueLabel="Jumlah Unit"
                secondaryValueLabel="Nilai Perolehan"
                height={340}
                emptyMessage="Belum ada data aset untuk desa ini"
              />
            </div>
          </div>

          {/* Sisi Kanan: Kondisi Barang dalam Grafik 3-D Pie */}
          <div className="lg:col-span-5 bg-[#0E1526] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="mb-3">
                <h2 className="text-base font-bold text-white">
                  Kondisi Barang
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Grafik 3-D Pie persentase kondisi fisik aset desa (Baik, Rusak Ringan, Rusak Berat).
                </p>
              </div>

              <ThreeDPieChart
                data={pieKondisiData}
                unitLabel="Unit"
                emptyMessage="Belum ada data kondisi aset"
                footerNote={
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 font-bold">Keterangan:</span>
                    <div className="flex flex-wrap items-center gap-3 font-semibold">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Baik {countBaik} Unit
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Rusak Ringan {countRingan} Unit
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-rose-400">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Rusak Berat {countBerat} Unit
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ================= DAFTAR ASET & STATUS VERIFIKASI (VISUAL BADGE) ================= */}
      <div id="daftar-aset-section" className="bg-[#0E1526] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
                STATUS VERIFIKASI INVENTARIS DESA
              </span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Daftar Aset & Indikator Status Verifikasi</span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {filteredAssetItems.length} Unit
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Indikator visual warna resmi untuk membedakan aset yang <span className="text-emerald-400 font-semibold">Sudah Diverifikasi</span>, <span className="text-amber-300 font-semibold">Sedang Diproses</span>, dan <span className="text-rose-400 font-semibold">Belum Diverifikasi</span> oleh Tim Monitoring Kecamatan Sirombu.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('aset')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <span>Kelola di Modul Aset</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3 Status Summary Interactive Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* 1. Sudah Diverifikasi */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'sudah_diverifikasi' ? 'all' : 'sudah_diverifikasi')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              statusFilter === 'sudah_diverifikasi'
                ? 'bg-emerald-950/70 border-emerald-500 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-500/40'
                : 'bg-emerald-950/20 hover:bg-emerald-950/40 border-emerald-500/30 hover:border-emerald-500/60'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {totalUnit > 0 ? Math.round((countSudahDiverifikasi / totalUnit) * 100) : 0}%
              </span>
            </div>
            <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Sudah Diverifikasi
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {countSudahDiverifikasi} <span className="text-xs font-sans font-normal text-slate-400">Unit</span>
            </div>
            <div className="text-[11px] text-emerald-200/70 mt-1 truncate">
              Dokumen BAST & cek fisik disahkan
            </div>
          </button>

          {/* 2. Sedang Diproses */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'sedang_diproses' ? 'all' : 'sedang_diproses')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              statusFilter === 'sedang_diproses'
                ? 'bg-amber-950/70 border-amber-500 shadow-lg shadow-amber-950/60 ring-2 ring-amber-500/40'
                : 'bg-amber-950/20 hover:bg-amber-950/40 border-amber-500/30 hover:border-amber-500/60'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {totalUnit > 0 ? Math.round((countSedangDiproses / totalUnit) * 100) : 0}%
              </span>
            </div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Sedang Diproses
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {countSedangDiproses} <span className="text-xs font-sans font-normal text-slate-400">Unit</span>
            </div>
            <div className="text-[11px] text-amber-200/70 mt-1 truncate">
              Antrean verifikasi / mutasi diajukan
            </div>
          </button>

          {/* 3. Belum Diverifikasi */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'belum_diverifikasi' ? 'all' : 'belum_diverifikasi')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              statusFilter === 'belum_diverifikasi'
                ? 'bg-rose-950/70 border-rose-500 shadow-lg shadow-rose-950/60 ring-2 ring-rose-500/40'
                : 'bg-rose-950/15 hover:bg-rose-950/30 border-rose-500/25 hover:border-rose-500/50'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {totalUnit > 0 ? Math.round((countBelumDiverifikasi / totalUnit) * 100) : 0}%
              </span>
            </div>
            <div className="text-xs font-bold text-rose-300 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Belum Diverifikasi
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {countBelumDiverifikasi} <span className="text-xs font-sans font-normal text-slate-400">Unit</span>
            </div>
            <div className="text-[11px] text-rose-200/70 mt-1 truncate">
              Aset baru diinput desa / tunggu periksa
            </div>
          </button>
        </div>

        {/* Filter Toolbar & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              Semua ({totalUnit})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sudah_diverifikasi')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'sudah_diverifikasi'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Sudah Diverifikasi ({countSudahDiverifikasi})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sedang_diproses')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'sedang_diproses'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Sedang Diproses ({countSedangDiproses})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('belum_diverifikasi')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === 'belum_diverifikasi'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-rose-300 border border-rose-500/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Belum Diverifikasi ({countBelumDiverifikasi})
            </button>
          </div>

          {/* Search Box and Category Dropdown */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama, kode, register aset..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Kategori</option>
              {Array.from(new Set(activeAsets.map((a) => (a.klasifikasi || '').replace(/^[I|V|X]+\.\s*/, '')))).map(
                (cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* Asset Table with Visual Color Badges */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0B0F19]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3 min-w-[240px]">Foto & Nama Aset</th>
                {effectiveDesaId === 'all' && (
                  <th className="py-3 px-3 min-w-[130px]">Wilayah Desa</th>
                )}
                <th className="py-3 px-3 min-w-[160px]">Kode & No. Register</th>
                <th className="py-3 px-3 text-right min-w-[130px]">Nilai Perolehan</th>
                <th className="py-3 px-3 text-center min-w-[90px]">Kondisi</th>
                <th className="py-3 px-3 text-center min-w-[170px]">
                  <span className="flex items-center justify-center gap-1 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Status Verifikasi
                  </span>
                </th>
                <th className="py-3 px-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={effectiveDesaId === 'all' ? 8 : 7}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-500" />
                      <p className="font-semibold text-slate-300">
                        Tidak ada aset yang sesuai kriteria pencarian atau filter status.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('all');
                          setCategoryFilter('all');
                          setSearchTerm('');
                        }}
                        className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
                      >
                        Reset semua filter
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(({ aset, verifInfo }, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr
                      key={aset.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* 1. No */}
                      <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">
                        {rowNumber}
                      </td>

                      {/* 2. Foto & Nama Aset */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(aset)}
                            className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center relative group-hover:border-emerald-500 transition-all cursor-pointer shadow-sm"
                            title="Klik untuk melihat foto fisik & rincian aset"
                          >
                            {aset.fotoAset && aset.fotoAset.length > 0 && aset.fotoAset[0] ? (
                              <>
                                <img
                                  src={getPhotoUrl(aset.fotoAset[0])}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  onError={handlePhotoError}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                {aset.fotoAset.length > 1 && (
                                  <span className="absolute bottom-0 right-0 bg-black/85 text-[8px] font-bold text-amber-300 px-1 rounded-tl">
                                    +{aset.fotoAset.length - 1}
                                  </span>
                                )}
                              </>
                            ) : (
                              <Camera className="w-4 h-4 text-slate-500 group-hover:text-emerald-400" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-semibold text-amber-400 block truncate">
                              {aset.klasifikasi}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(aset)}
                              className="font-bold text-white text-left hover:text-emerald-300 transition-colors block cursor-pointer truncate max-w-[220px]"
                              title={aset.namaAset}
                            >
                              {aset.namaAset}
                            </button>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 flex-wrap">
                              {aset.lokasi && (
                                <span className="truncate max-w-[130px]">
                                  Lok: {aset.lokasi}
                                </span>
                              )}
                              {aset.merk && (
                                <span className="text-emerald-300 font-mono">
                                  Merk: {aset.merk}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Wilayah Desa (if all) */}
                      {effectiveDesaId === 'all' && (
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-300 font-semibold text-[10px] block truncate max-w-[130px]">
                            {(aset.desaName || 'Desa').replace('DESA ', '')}
                          </span>
                        </td>
                      )}

                      {/* 4. Kode & Register */}
                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-emerald-400 text-[11px] tracking-wide">
                          {aset.kodeAset}
                        </div>
                        {aset.nomorRegister && (
                          <div className="text-[10px] text-amber-300 flex items-center gap-1 mt-0.5">
                            <span className="text-slate-500 font-sans">Reg:</span>
                            <span className="px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 font-bold">
                              {aset.nomorRegister}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 5. Nilai Perolehan */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-emerald-400 text-[11px]">
                          {formatRupiah(aset.nilaiPerolehan)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Thn {aset.tahunPerolehan}
                        </div>
                      </td>

                      {/* 6. Kondisi Fisik */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            aset.kondisi === 'Baik'
                              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                              : aset.kondisi === 'Rusak Ringan'
                              ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                              : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {aset.kondisi}
                        </span>
                      </td>

                      {/* 7. STATUS VERIFIKASI & WAKTU ENTRI/UPDATE */}
                      <td className="py-3 px-3 text-center">
                        <AsetVerificationBadge
                          statusInfo={verifInfo}
                          size="md"
                          className="shadow-sm"
                        />
                        <div className="mt-1 space-y-0.5 text-[9px] font-mono leading-tight text-slate-400">
                          <div title={`Waktu Entri: ${formatTanggalWaktuIndonesia(aset.createdAt)}`}>
                            <span className="text-slate-500">Entri:</span>{' '}
                            <span className="text-slate-300">{formatTanggalWaktuIndonesia(aset.createdAt, true)}</span>
                          </div>
                          {aset.updatedAt && (
                            <div title={`Terakhir Update: ${formatTanggalWaktuIndonesia(aset.updatedAt)}`}>
                              <span className="text-slate-500">Upd:</span>{' '}
                              <span className="text-cyan-300">{formatTanggalWaktuIndonesia(aset.updatedAt, true)}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 8. Action buttons */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isAdminOrSuper && verifInfo.status === 'sedang_diproses' && (
                            <button
                              type="button"
                              onClick={() => handleVerifySingle(aset.id, aset.namaAset)}
                              disabled={verifyingId === aset.id}
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 shadow-md hover:shadow-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
                              title="Verifikasi & Sahkan Aset Ini Sekarang (Wewenang Admin/Super Admin)"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{verifyingId === aset.id ? '...' : 'Verifikasi'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(aset)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 transition-all cursor-pointer"
                            title="Lihat Detail & Foto Fisik Aset"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenBarcode(aset)}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 transition-all cursor-pointer"
                            title="Cetak Barcode Label Aset"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Counter Bar */}
        {filteredAssetItems.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
            <div>
              Menampilkan{' '}
              <span className="font-bold text-white">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{' '}
              -{' '}
              <span className="font-bold text-white">
                {Math.min(currentPage * itemsPerPage, filteredAssetItems.length)}
              </span>{' '}
              dari <span className="font-bold text-emerald-400">{filteredAssetItems.length}</span> aset
              {statusFilter !== 'all' && (
                <span className="ml-2 px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 font-medium">
                  Difilter: {statusFilter.replace('_', ' ')}
                </span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Detail Aset */}
      <AsetDetailModal
        isOpen={showDetailModal}
        aset={selectedDetailAset}
        onClose={() => setShowDetailModal(false)}
        onOpenBarcode={handleOpenBarcode}
      />

      {/* Modal Cetak Barcode */}
      <BarcodeModal
        isOpen={showBarcodeModal}
        aset={selectedBarcodeAset}
        onClose={() => setShowBarcodeModal(false)}
      />

      {/* Toast Notifikasi Berhasil Verifikasi */}
      {verifFeedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 border-2 border-emerald-500 text-white shadow-2xl shadow-emerald-950/80 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs font-semibold">{verifFeedback}</div>
          <button
            type="button"
            onClick={() => setVerifFeedback(null)}
            className="ml-2 text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Modal Hosting cPanel */}
      <CPanelMigrationModal
        isOpen={showCPanelModal}
        onClose={() => setShowCPanelModal(false)}
      />

      {/* Modal Pembaca Pengumuman Resmi */}
      <AnnouncementReaderModal
        isOpen={showAnnounceModal}
        onClose={() => setShowAnnounceModal(false)}
        onOpenBroadcast={() => setShowBroadcastModal(true)}
      />

      {/* Modal Pusat Pesan Siaran ke Semua User */}
      <BroadcastMessageModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
      />
    </div>
  );
};
