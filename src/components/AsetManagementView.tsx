import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Aset, KlasAset, KondisiAset, SumberDana } from '../types';
import { KLASIFIKASI_LIST, formatRupiah, formatNumber } from '../utils/reportGenerator';
import { BarcodeModal } from './BarcodeModal';
import { AsetDetailModal } from './AsetDetailModal';
import { fileToCompressedDataUrl } from '../utils/imageCompressor';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ArrowRightLeft,
  FileMinus,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  FileText,
  X,
  Building,
  HelpCircle,
  Download,
  Boxes,
  Camera,
  Eye,
  QrCode,
  FileCheck2
} from 'lucide-react';

export const AsetManagementView: React.FC = () => {
  const {
    asets,
    desas,
    currentUser,
    addAset,
    updateAset,
    deleteAset,
    ajukanMutasi,
    ajukanPenghapusan,
    selectedYear,
  } = useApp();

  const isDesaUser = currentUser?.role === 'admin_desa';
  const defaultDesaId = isDesaUser ? currentUser.desaId || 'desa-21' : 'all';

  // Filters
  const [filterDesa, setFilterDesa] = useState<string>(defaultDesaId);
  const [filterKlasifikasi, setFilterKlasifikasi] = useState<string>('all');
  const [filterSumberDana, setFilterSumberDana] = useState<string>('all');
  const [filterKondisi, setFilterKondisi] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showMutasiModal, setShowMutasiModal] = useState<boolean>(false);
  const [showHapusModal, setShowHapusModal] = useState<boolean>(false);
  const [selectedAset, setSelectedAset] = useState<Aset | null>(null);

  // Detail & Barcode Modals
  const [detailAset, setDetailAset] = useState<Aset | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [barcodeAset, setBarcodeAset] = useState<Aset | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState<boolean>(false);

  // Form states
  const [formData, setFormData] = useState({
    desaId: isDesaUser ? currentUser.desaId || 'desa-21' : 'desa-21',
    klasifikasi: 'Tanah' as KlasAset,
    namaAset: '',
    kodeAset: '',
    buktiJenis: 'Kwitansi / BAST',
    buktiNomor: '',
    buktiTanggal: '',
    tahunPerolehan: selectedYear,
    nilaiPerolehan: 0,
    kondisi: 'Baik' as KondisiAset,
    sumberDana: 'DDS' as SumberDana,
    volume: '',
    lokasi: '',
    keterangan: '',
    fotoAset: ['', '', '', '', ''] as string[],
    fotoBast: '' as string,
  });
  const [photoError, setPhotoError] = useState<string>('');

  // Photo handlers
  const handlePhotoUpload = async (index: number, file: File) => {
    try {
      const compressed = await fileToCompressedDataUrl(file);
      setFormData((prev) => {
        const updated = [...prev.fotoAset];
        updated[index] = compressed;
        return { ...prev, fotoAset: updated };
      });
      setPhotoError('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setFormData((prev) => {
      const updated = [...prev.fotoAset];
      updated[index] = '';
      return { ...prev, fotoAset: updated };
    });
  };

  const handleBastUpload = async (file: File) => {
    try {
      const compressed = await fileToCompressedDataUrl(file);
      setFormData((prev) => ({ ...prev, fotoBast: compressed }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveBast = () => {
    setFormData((prev) => ({ ...prev, fotoBast: '' }));
  };

  const handleOpenDetail = (item: Aset) => {
    setDetailAset(item);
    setShowDetailModal(true);
  };

  const handleOpenBarcode = (item: Aset) => {
    setBarcodeAset(item);
    setShowBarcodeModal(true);
  };

  // Mutasi / Penghapusan form states
  const [mutasiForm, setMutasiForm] = useState({
    alasan: '',
    nomorSuratDesa: '',
    dokumenPendukung: '',
    tujuanMutasi: '',
  });

  const [hapusForm, setHapusForm] = useState({
    alasan: '',
    nomorSuratDesa: '',
    dokumenPendukung: '',
  });

  // Filtered dataset
  const filteredList = useMemo(() => {
    return asets.filter((item) => {
      const matchDesa = isDesaUser
        ? item.desaId === currentUser.desaId
        : filterDesa === 'all'
        ? true
        : item.desaId === filterDesa;

      const matchKlas =
        filterKlasifikasi === 'all'
          ? true
          : (item.klasifikasi || '').replace(/^[I|V|X]+\.\s*/, '') === filterKlasifikasi;
      const matchDana = filterSumberDana === 'all' ? true : item.sumberDana === filterSumberDana;
      const matchKondisi = filterKondisi === 'all' ? true : item.kondisi === filterKondisi;

      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        item.namaAset.toLowerCase().includes(query) ||
        item.kodeAset.toLowerCase().includes(query) ||
        item.desaName.toLowerCase().includes(query) ||
        (item.bukti?.nomor && item.bukti.nomor.toLowerCase().includes(query)) ||
        (item.keterangan && item.keterangan.toLowerCase().includes(query));

      return matchDesa && matchKlas && matchDana && matchKondisi && matchSearch;
    });
  }, [asets, isDesaUser, currentUser, filterDesa, filterKlasifikasi, filterSumberDana, filterKondisi, searchQuery]);

  // Open add modal
  const handleOpenAdd = () => {
    setPhotoError('');
    setFormData({
      desaId: isDesaUser ? currentUser.desaId || 'desa-21' : desas[0]?.id || 'desa-01',
      klasifikasi: 'Tanah',
      namaAset: '',
      kodeAset: '',
      buktiJenis: 'Kwitansi / BAST',
      buktiNomor: '',
      buktiTanggal: new Date().toLocaleDateString('id-ID'),
      tahunPerolehan: selectedYear,
      nilaiPerolehan: 0,
      kondisi: 'Baik',
      sumberDana: 'DDS',
      volume: '',
      lokasi: '',
      keterangan: '',
      fotoAset: ['', '', '', '', ''],
      fotoBast: '',
    });
    setShowAddModal(true);
  };

  // Open edit modal
  const handleOpenEdit = (item: Aset) => {
    setSelectedAset(item);
    setPhotoError('');
    const existingPhotos = item.fotoAset ? [...item.fotoAset] : [];
    while (existingPhotos.length < 5) {
      existingPhotos.push('');
    }
    setFormData({
      desaId: item.desaId,
      klasifikasi: item.klasifikasi,
      namaAset: item.namaAset,
      kodeAset: item.kodeAset,
      buktiJenis: item.bukti.jenis,
      buktiNomor: item.bukti.nomor,
      buktiTanggal: item.bukti.tanggal,
      tahunPerolehan: item.tahunPerolehan,
      nilaiPerolehan: item.nilaiPerolehan,
      kondisi: item.kondisi,
      sumberDana: item.sumberDana,
      volume: item.volume || '',
      lokasi: item.lokasi || '',
      keterangan: item.keterangan || '',
      fotoAset: existingPhotos.slice(0, 5),
      fotoBast: item.fotoBast || '',
    });
    setShowEditModal(true);
  };

  // Handle submit add
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const validPhotos = formData.fotoAset.filter((p) => p && p.trim().length > 0);
    if (validPhotos.length === 0) {
      setPhotoError('Wajib mengunggah minimal 1 Foto Fisik Aset!');
      return;
    }

    const desa = desas.find((d) => d.id === formData.desaId);
    addAset({
      desaId: formData.desaId,
      desaName: desa?.name || 'DESA',
      klasifikasi: formData.klasifikasi,
      namaAset: formData.namaAset,
      kodeAset: formData.kodeAset || `0${KLASIFIKASI_LIST.indexOf(formData.klasifikasi) + 1}.01.${Date.now().toString().slice(-4)}`,
      bukti: {
        jenis: formData.buktiJenis,
        nomor: formData.buktiNomor,
        tanggal: formData.buktiTanggal,
      },
      tahunPerolehan: Number(formData.tahunPerolehan),
      nilaiPerolehan: Number(formData.nilaiPerolehan),
      kondisi: formData.kondisi,
      sumberDana: formData.sumberDana,
      volume: formData.volume,
      lokasi: formData.lokasi,
      keterangan: formData.keterangan,
      fotoAset: validPhotos,
      fotoBast: formData.fotoBast || undefined,
    });
    setShowAddModal(false);
  };

  // Handle submit edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAset) return;
    const validPhotos = formData.fotoAset.filter((p) => p && p.trim().length > 0);
    const desa = desas.find((d) => d.id === formData.desaId);
    updateAset(selectedAset.id, {
      desaId: formData.desaId,
      desaName: desa?.name || selectedAset.desaName,
      klasifikasi: formData.klasifikasi,
      namaAset: formData.namaAset,
      kodeAset: formData.kodeAset,
      bukti: {
        jenis: formData.buktiJenis,
        nomor: formData.buktiNomor,
        tanggal: formData.buktiTanggal,
      },
      tahunPerolehan: Number(formData.tahunPerolehan),
      nilaiPerolehan: Number(formData.nilaiPerolehan),
      kondisi: formData.kondisi,
      sumberDana: formData.sumberDana,
      volume: formData.volume,
      lokasi: formData.lokasi,
      keterangan: formData.keterangan,
      fotoAset: validPhotos.length > 0 ? validPhotos : selectedAset.fotoAset,
      fotoBast: formData.fotoBast || selectedAset.fotoBast,
    });
    setShowEditModal(false);
  };

  // Handle open Mutasi Modal
  const handleOpenMutasi = (item: Aset) => {
    setSelectedAset(item);
    setMutasiForm({
      alasan: '',
      nomorSuratDesa: `141/${Math.floor(Math.random() * 900 + 100)}/DS-${item.desaName.replace('DESA ', '')}/2024`,
      dokumenPendukung: 'Berita Acara Musyawarah Desa & SK Pemindahtanganan',
      tujuanMutasi: 'BUMDes / Pemerintah Kabupaten Nias Barat',
    });
    setShowMutasiModal(true);
  };

  // Submit Mutasi
  const handleSaveMutasi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAset) return;
    ajukanMutasi(
      selectedAset.id,
      mutasiForm.alasan,
      mutasiForm.nomorSuratDesa,
      mutasiForm.dokumenPendukung,
      mutasiForm.tujuanMutasi
    );
    setShowMutasiModal(false);
  };

  // Handle open Penghapusan Modal
  const handleOpenHapus = (item: Aset) => {
    setSelectedAset(item);
    setHapusForm({
      alasan: item.kondisi === 'Rusak Berat' ? 'Aset mengalami kerusakan berat dan biaya perbaikan melebihi nilai ekonomis.' : '',
      nomorSuratDesa: `141/${Math.floor(Math.random() * 900 + 100)}/DS-${item.desaName.replace('DESA ', '')}/2024`,
      dokumenPendukung: 'Berita Acara Musyawarah Desa Tentang Penghapusan Aset',
    });
    setShowHapusModal(true);
  };

  // Submit Penghapusan
  const handleSaveHapus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAset) return;
    ajukanPenghapusan(
      selectedAset.id,
      hapusForm.alasan,
      hapusForm.nomorSuratDesa,
      hapusForm.dokumenPendukung
    );
    setShowHapusModal(false);
  };

  // Handle delete directly
  const handleDeleteDirect = (id: string, name: string) => {
    if (window.confirm(`Yakin ingin menghapus item aset "${name}"?`)) {
      const res = deleteAset(id);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Modul Inventarisasi
            </span>
            <span className="text-xs text-slate-400">
              Kecamatan Sirombu • Nias Barat
            </span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            {isDesaUser ? `Inventaris Aset ${currentUser.desaName}` : 'Data Seluruh Aset Desa se-Kecamatan'}
          </h2>
          <p className="text-xs text-slate-400">
            Pencatatan rincian aset tetap desa menurut bukti kepemilikan, perolehan, kondisi, dan sumber dana.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Aset Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search box */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari nama aset, kode, bukti, lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Desa Filter (if not locked to desa) */}
          {!isDesaUser && (
            <div>
              <select
                value={filterDesa}
                onChange={(e) => setFilterDesa(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">Semua Desa (25 Desa)</option>
                {desas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Klasifikasi Filter */}
          <div>
            <select
              value={filterKlasifikasi}
              onChange={(e) => setFilterKlasifikasi(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">Semua Klasifikasi</option>
              {KLASIFIKASI_LIST.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          {/* Sumber Dana Filter */}
          <div>
            <select
              value={filterSumberDana}
              onChange={(e) => setFilterSumberDana(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="all">Semua Sumber Dana</option>
              <option value="DDS">Dana Desa (DDS)</option>
              <option value="ADD">Alokasi Dana Desa (ADD)</option>
              <option value="PBH">Bagi Hasil (PBH)</option>
              <option value="DLL">Pendapatan Lain-lain (DLL)</option>
            </select>
          </div>
        </div>

        {/* Second row tags */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <span>Filter Kondisi:</span>
            {['all', 'Baik', 'Rusak Ringan', 'Rusak Berat'].map((k) => (
              <button
                key={k}
                onClick={() => setFilterKondisi(k)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                  filterKondisi === k
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {k === 'all' ? 'Semua Kondisi' : k}
              </button>
            ))}
          </div>

          <div className="font-semibold text-slate-300">
            Menampilkan <span className="text-amber-400 font-bold">{filteredList.length}</span> item aset
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-[#0E1526] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 text-[11px] font-bold uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">No</th>
                <th className="py-3 px-3">Klasifikasi & Nama Aset Tetap</th>
                <th className="py-3 px-3">Desa</th>
                <th className="py-3 px-3">Bukti Kepemilikan</th>
                <th className="py-3 px-3">Kode Aset</th>
                <th className="py-3 px-3 text-center">Tahun</th>
                <th className="py-3 px-3 text-right">Nilai Perolehan</th>
                <th className="py-3 px-3 text-center">Kondisi</th>
                <th className="py-3 px-3 text-center">Dana</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Aksi / Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    Belum ada data aset yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const isMutasiDiajukan = item.status === 'mutasi_diajukan';
                  const isHapusDiajukan = item.status === 'terhapus_diajukan';
                  const isTerhapus = item.status === 'terhapus';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isTerhapus ? 'opacity-50 line-through bg-slate-950/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 min-w-[260px]">
                        <div className="flex items-start gap-2.5">
                          {/* Photo Thumbnail / Badge */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            className="shrink-0 w-11 h-11 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center relative group hover:border-amber-400 transition-all cursor-pointer shadow-sm"
                            title="Klik untuk Lihat Foto & Detail Aset"
                          >
                            {item.fotoAset && item.fotoAset.length > 0 && item.fotoAset[0] ? (
                              <>
                                <img
                                  src={item.fotoAset[0]}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                {item.fotoAset.length > 1 && (
                                  <span className="absolute bottom-0 right-0 bg-black/85 text-[8px] font-bold text-amber-300 px-1 rounded-tl">
                                    +{item.fotoAset.length - 1}
                                  </span>
                                )}
                              </>
                            ) : (
                              <Camera className="w-4 h-4 text-slate-500 group-hover:text-amber-400" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-semibold text-amber-400 block truncate">
                              {item.klasifikasi}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(item)}
                              className="font-bold text-white leading-tight text-left hover:text-amber-300 transition-colors block cursor-pointer"
                            >
                              {item.namaAset}
                            </button>
                            {item.volume && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Volume: {item.volume}
                              </div>
                            )}
                            {item.lokasi && (
                              <div className="text-[10px] text-slate-400 truncate">
                                Lokasi: {item.lokasi}
                              </div>
                            )}
                            {item.keterangan && (
                              <div
                                className="mt-1 text-[10px] text-amber-200/90 bg-amber-950/40 border border-amber-500/30 rounded px-1.5 py-0.5 max-w-[280px] break-words"
                                title={item.keterangan}
                              >
                                <span className="font-bold text-amber-400">Ket:</span> {item.keterangan}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-semibold text-[10px] block truncate max-w-[120px]">
                          {item.desaName.replace('DESA ', '')}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[180px]">
                        <div className="font-semibold text-slate-200 text-[11px]">
                          {item.bukti.jenis}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          No: {item.bukti.nomor || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tgl: {item.bukti.tanggal || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300 text-[11px]">
                        {item.kodeAset}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-200">
                        {item.tahunPerolehan}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatRupiah(item.nilaiPerolehan)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.kondisi === 'Baik'
                              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                              : item.kondisi === 'Rusak Ringan'
                              ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                              : 'bg-red-950/80 border-red-500/40 text-red-300'
                          }`}
                        >
                          {item.kondisi}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono text-[10px] font-bold">
                          {item.sumberDana}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isMutasiDiajukan ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px] font-bold flex items-center gap-1 justify-center">
                            <Clock className="w-3 h-3" /> Mutasi
                          </span>
                        ) : isHapusDiajukan ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-[10px] font-bold flex items-center gap-1 justify-center">
                            <Clock className="w-3 h-3" /> Hapus
                          </span>
                        ) : isTerhapus ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold">
                            Terhapus
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Cetak Barcode button */}
                          <button
                            onClick={() => handleOpenBarcode(item)}
                            className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-400 border border-amber-500/40 text-amber-300 hover:text-slate-950 transition-colors cursor-pointer"
                            title="Cetak Barcode & Label Inventaris Aset"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {/* Lihat Foto & Detail button */}
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white transition-colors cursor-pointer"
                            title="Lihat Foto Fisik & BAST Aset"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {!isTerhapus && (
                            <>
                              {/* Edit button */}
                              <button
                                onClick={() => handleOpenEdit(item)}
                                disabled={isMutasiDiajukan || isHapusDiajukan}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Edit Data Aset"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Mutasi button */}
                              <button
                                onClick={() => handleOpenMutasi(item)}
                                disabled={isMutasiDiajukan || isHapusDiajukan}
                                className="p-1.5 rounded-lg bg-blue-950/60 hover:bg-blue-900 border border-blue-500/30 text-blue-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Ajukan Mutasi Aset ke Kecamatan"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>

                              {/* Penghapusan button */}
                              <button
                                onClick={() => handleOpenHapus(item)}
                                disabled={isMutasiDiajukan || isHapusDiajukan}
                                className="p-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-500/30 text-amber-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Ajukan Penghapusan Aset ke Kecamatan"
                              >
                                <FileMinus className="w-3.5 h-3.5" />
                              </button>

                              {/* Direct delete (if active & draft) */}
                              <button
                                onClick={() => handleDeleteDirect(item.id, item.namaAset)}
                                disabled={isMutasiDiajukan || isHapusDiajukan}
                                className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Hapus Data Aset Langsung"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Tambah Aset Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0E1526] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                <Plus className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  Tambah Data Aset Tetap Desa
                </h3>
                <p className="text-xs text-slate-400">
                  Format isian sesuai Permendagri Nomor 20 Tahun 2018
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Desa */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Pemerintah Desa
                  </label>
                  <select
                    disabled={isDesaUser}
                    value={formData.desaId}
                    onChange={(e) => setFormData({ ...formData, desaId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    {desas.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Klasifikasi I-X */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Klasifikasi Aset (Permendagri 20/2018)
                  </label>
                  <select
                    value={formData.klasifikasi}
                    onChange={(e) => setFormData({ ...formData, klasifikasi: e.target.value as KlasAset })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    {KLASIFIKASI_LIST.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nama Aset */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Nama / Identitas Aset Tetap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Tanah Lapangan Pemuda / Genset Silent 5000W / Sepeda Motor Dinas"
                  value={formData.namaAset}
                  onChange={(e) => setFormData({ ...formData, namaAset: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Bukti Kepemilikan */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  Bukti Kepemilikan (Sesuai Kolom Permendagri 20/2018)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Jenis Bukti</label>
                    <input
                      type="text"
                      placeholder="HGB, BPKB, IMB, Kwitansi/BAST"
                      value={formData.buktiJenis}
                      onChange={(e) => setFormData({ ...formData, buktiJenis: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Nomor Bukti</label>
                    <input
                      type="text"
                      placeholder="Nomor Sertifikat/Kwitansi"
                      value={formData.buktiNomor}
                      onChange={(e) => setFormData({ ...formData, buktiNomor: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Tanggal Bukti</label>
                    <input
                      type="text"
                      placeholder="Contoh: 12 Juli 2021"
                      value={formData.buktiTanggal}
                      onChange={(e) => setFormData({ ...formData, buktiTanggal: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Kode Aset & Tahun Perolehan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Kode Aset Tetap
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 01.01.01.04.001"
                    value={formData.kodeAset}
                    onChange={(e) => setFormData({ ...formData, kodeAset: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Tahun Perolehan *
                  </label>
                  <input
                    type="number"
                    required
                    min="1970"
                    max="2030"
                    value={formData.tahunPerolehan}
                    onChange={(e) => setFormData({ ...formData, tahunPerolehan: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Nilai Perolehan (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.nilaiPerolehan}
                    onChange={(e) => setFormData({ ...formData, nilaiPerolehan: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                  <span className="text-[10px] text-emerald-400 mt-1 block">
                    {formatRupiah(formData.nilaiPerolehan)}
                  </span>
                </div>
              </div>

              {/* Kondisi, Sumber Dana, Volume */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Kondisi Aset Tetap
                  </label>
                  <select
                    value={formData.kondisi}
                    onChange={(e) => setFormData({ ...formData, kondisi: e.target.value as KondisiAset })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Baik">Baik (B)</option>
                    <option value="Rusak Ringan">Rusak Ringan (RR)</option>
                    <option value="Rusak Berat">Rusak Berat (RB)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Sumber Dana
                  </label>
                  <select
                    value={formData.sumberDana}
                    onChange={(e) => setFormData({ ...formData, sumberDana: e.target.value as SumberDana })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-amber-300"
                  >
                    <option value="DDS">Dana Desa (DDS)</option>
                    <option value="ADD">Alokasi Dana Desa (ADD)</option>
                    <option value="PBH">Pendapatan Bagi Hasil (PBH)</option>
                    <option value="DLL">Pendapatan Lain-lain (DLL)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Volume / Ukuran
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 2200 m², 1 Unit, 800m"
                    value={formData.volume}
                    onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Lokasi & Keterangan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Lokasi Aset
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Dusun I Desa Sirombu"
                    value={formData.lokasi}
                    onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Keterangan
                  </label>
                  <input
                    type="text"
                    placeholder="Keterangan pendukung peruntukan aset"
                    value={formData.keterangan}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Foto Fisik Aset: Sediakan 5 foto, minimal 1 wajib diisi */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>Foto Fisik Aset * (Sediakan 5 Slot, Minimal 1 Wajib Diisi)</span>
                  </label>
                  <span className="text-[11px] text-amber-300/90 font-medium">
                    Terisi: {formData.fotoAset.filter((p) => p && p.trim().length > 0).length} dari 5 Foto
                  </span>
                </div>

                {photoError && (
                  <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/80 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{photoError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[0, 1, 2, 3, 4].map((slotIdx) => {
                    const isRequired = slotIdx === 0;
                    const photoUrl = formData.fotoAset[slotIdx];

                    return (
                      <div
                        key={slotIdx}
                        className={`relative rounded-xl border-2 border-dashed p-2 flex flex-col items-center justify-center min-h-[110px] text-center transition-all ${
                          photoUrl
                            ? 'border-emerald-500/80 bg-slate-950'
                            : isRequired
                            ? 'border-amber-500/60 bg-slate-950/50 hover:bg-slate-950'
                            : 'border-slate-700/80 bg-slate-950/30 hover:bg-slate-950/60'
                        }`}
                      >
                        {photoUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center">
                            <img
                              src={photoUrl}
                              alt={`Foto ${slotIdx + 1}`}
                              className="w-full h-16 object-cover rounded-lg mb-1 border border-slate-800"
                            />
                            <span className="text-[10px] font-bold text-emerald-400">
                              Foto {slotIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(slotIdx)}
                              className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full shadow cursor-pointer transition-colors"
                              title="Hapus Foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-1">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(slotIdx, file);
                              }}
                            />
                            <Camera
                              className={`w-5 h-5 mb-1 ${
                                isRequired ? 'text-amber-400' : 'text-slate-500'
                              }`}
                            />
                            <span
                              className={`text-[10px] font-bold ${
                                isRequired ? 'text-amber-300' : 'text-slate-400'
                              }`}
                            >
                              Foto {slotIdx + 1}
                            </span>
                            <span className="text-[9px] text-slate-500">
                              {isRequired ? '(Wajib)' : '(Opsional)'}
                            </span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400">
                  Format gambar didukung: JPG, PNG, WebP. Gambar dikompresi otomatis untuk efisiensi penyimpanan.
                </p>
              </div>

              {/* Foto BAST Aset Kepada Pengguna */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-white text-xs flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <span>Foto BAST Aset Kepada Pengguna (Berita Acara Serah Terima)</span>
                  </label>
                  {formData.fotoBast && (
                    <span className="text-[11px] text-emerald-400 font-semibold">Tersimpan</span>
                  )}
                </div>

                {formData.fotoBast ? (
                  <div className="relative w-full p-2.5 bg-slate-950 rounded-xl border border-emerald-500/60 flex items-center gap-3">
                    <img
                      src={formData.fotoBast}
                      alt="Foto BAST"
                      className="w-20 h-16 object-cover rounded-lg border border-slate-700 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-emerald-300">
                        Foto Dokumen / Penyerahan BAST Siap
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Dapat dilihat langsung oleh Admin Desa dan Admin Kecamatan
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveBast}
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Hapus BAST
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-slate-950/70 rounded-xl p-3 flex items-center justify-center gap-3 cursor-pointer transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBastUpload(file);
                      }}
                    />
                    <FileCheck2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-200">
                        Unggah Foto BAST Aset kepada Pengguna
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Foto dokumen Berita Acara Serah Terima atau dokumentasi penyerahan fisik kepada pengguna
                      </div>
                    </div>
                  </label>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                >
                  Simpan Aset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Aset */}
      {showEditModal && selectedAset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0E1526] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-xl bg-blue-500/20 text-blue-300">
                <Edit2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  Edit Data Aset Tetap Desa
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  ID: {selectedAset.id} • {selectedAset.desaName}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Klasifikasi Aset
                  </label>
                  <select
                    value={formData.klasifikasi}
                    onChange={(e) => setFormData({ ...formData, klasifikasi: e.target.value as KlasAset })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {KLASIFIKASI_LIST.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Nama / Identitas Aset Tetap *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.namaAset}
                    onChange={(e) => setFormData({ ...formData, namaAset: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Bukti */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  Bukti Kepemilikan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Jenis Bukti</label>
                    <input
                      type="text"
                      value={formData.buktiJenis}
                      onChange={(e) => setFormData({ ...formData, buktiJenis: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Nomor Bukti</label>
                    <input
                      type="text"
                      value={formData.buktiNomor}
                      onChange={(e) => setFormData({ ...formData, buktiNomor: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Tanggal Bukti</label>
                    <input
                      type="text"
                      value={formData.buktiTanggal}
                      onChange={(e) => setFormData({ ...formData, buktiTanggal: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Kode Aset & Nilai */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Kode Aset Tetap
                  </label>
                  <input
                    type="text"
                    value={formData.kodeAset}
                    onChange={(e) => setFormData({ ...formData, kodeAset: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Tahun Perolehan
                  </label>
                  <input
                    type="number"
                    value={formData.tahunPerolehan}
                    onChange={(e) => setFormData({ ...formData, tahunPerolehan: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Nilai Perolehan (Rp)
                  </label>
                  <input
                    type="number"
                    value={formData.nilaiPerolehan}
                    onChange={(e) => setFormData({ ...formData, nilaiPerolehan: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                  <span className="text-[10px] text-emerald-400 mt-1 block">
                    {formatRupiah(formData.nilaiPerolehan)}
                  </span>
                </div>
              </div>

              {/* Kondisi & Sumber Dana */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Kondisi Aset Tetap
                  </label>
                  <select
                    value={formData.kondisi}
                    onChange={(e) => setFormData({ ...formData, kondisi: e.target.value as KondisiAset })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Baik">Baik (B)</option>
                    <option value="Rusak Ringan">Rusak Ringan (RR)</option>
                    <option value="Rusak Berat">Rusak Berat (RB)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Sumber Dana
                  </label>
                  <select
                    value={formData.sumberDana}
                    onChange={(e) => setFormData({ ...formData, sumberDana: e.target.value as SumberDana })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-amber-300"
                  >
                    <option value="DDS">Dana Desa (DDS)</option>
                    <option value="ADD">Alokasi Dana Desa (ADD)</option>
                    <option value="PBH">Pendapatan Bagi Hasil (PBH)</option>
                    <option value="DLL">Pendapatan Lain-lain (DLL)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Volume
                  </label>
                  <input
                    type="text"
                    value={formData.volume}
                    onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Lokasi & Keterangan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Lokasi Aset
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Dusun I Desa Sirombu"
                    value={formData.lokasi}
                    onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Keterangan
                  </label>
                  <input
                    type="text"
                    placeholder="Keterangan peruntukan aset"
                    value={formData.keterangan}
                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Foto Fisik Aset: Sediakan 5 foto */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>Foto Fisik Aset (Sediakan 5 Slot)</span>
                  </label>
                  <span className="text-[11px] text-amber-300/90 font-medium">
                    Terisi: {formData.fotoAset.filter((p) => p && p.trim().length > 0).length} dari 5 Foto
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {[0, 1, 2, 3, 4].map((slotIdx) => {
                    const photoUrl = formData.fotoAset[slotIdx];

                    return (
                      <div
                        key={slotIdx}
                        className={`relative rounded-xl border-2 border-dashed p-2 flex flex-col items-center justify-center min-h-[110px] text-center transition-all ${
                          photoUrl
                            ? 'border-emerald-500/80 bg-slate-950'
                            : 'border-slate-700/80 bg-slate-950/30 hover:bg-slate-950/60'
                        }`}
                      >
                        {photoUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center">
                            <img
                              src={photoUrl}
                              alt={`Foto ${slotIdx + 1}`}
                              className="w-full h-16 object-cover rounded-lg mb-1 border border-slate-800"
                            />
                            <span className="text-[10px] font-bold text-emerald-400">
                              Foto {slotIdx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(slotIdx)}
                              className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full shadow cursor-pointer transition-colors"
                              title="Hapus Foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-1">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(slotIdx, file);
                              }}
                            />
                            <Camera className="w-5 h-5 mb-1 text-slate-500" />
                            <span className="text-[10px] font-bold text-slate-400">
                              Foto {slotIdx + 1}
                            </span>
                            <span className="text-[9px] text-slate-500">
                              (Slot {slotIdx + 1})
                            </span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400">
                  Perbarui atau lengkapi foto fisik aset. Foto akan otomatis dikompresi.
                </p>
              </div>

              {/* Foto BAST Aset Kepada Pengguna */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-white text-xs flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <span>Foto BAST Aset Kepada Pengguna (Berita Acara Serah Terima)</span>
                  </label>
                  {formData.fotoBast && (
                    <span className="text-[11px] text-emerald-400 font-semibold">Tersimpan</span>
                  )}
                </div>

                {formData.fotoBast ? (
                  <div className="relative w-full p-2.5 bg-slate-950 rounded-xl border border-emerald-500/60 flex items-center gap-3">
                    <img
                      src={formData.fotoBast}
                      alt="Foto BAST"
                      className="w-20 h-16 object-cover rounded-lg border border-slate-700 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-emerald-300">
                        Foto Dokumen / Penyerahan BAST Siap
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Dapat dilihat langsung oleh Admin Desa dan Admin Kecamatan
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveBast}
                      className="px-2.5 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Hapus BAST
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-slate-950/70 rounded-xl p-3 flex items-center justify-center gap-3 cursor-pointer transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBastUpload(file);
                      }}
                    />
                    <FileCheck2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-200">
                        Unggah Foto BAST Aset kepada Pengguna
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Foto dokumen Berita Acara Serah Terima atau dokumentasi penyerahan fisik kepada pengguna
                      </div>
                    </div>
                  </label>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20"
                >
                  Perbarui Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Permohonan Mutasi Aset */}
      {showMutasiModal && selectedAset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0E1526] border border-blue-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowMutasiModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-blue-500/20 text-blue-300">
                <ArrowRightLeft className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  Permohonan Mutasi / Pemindahtanganan Aset
                </h3>
                <p className="text-xs text-slate-400">
                  Diajukan ke Admin Kecamatan Sirombu untuk diverifikasi
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 mb-4 text-xs space-y-1">
              <div className="text-slate-400 font-medium">Aset yang dimutasikan:</div>
              <div className="font-bold text-white text-sm">{selectedAset.namaAset}</div>
              <div className="text-slate-400 font-mono text-[11px]">
                {selectedAset.desaName} • Nilai: {formatRupiah(selectedAset.nilaiPerolehan)}
              </div>
            </div>

            <form onSubmit={handleSaveMutasi} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Pihak / Instansi Penerima Mutasi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: BUMDes Sirombu Mandiri / Dinas Kesehatan Nias Barat"
                  value={mutasiForm.tujuanMutasi}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, tujuanMutasi: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Alasan Pemindahtanganan / Mutasi *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Jelaskan dasar pertimbangan mutasi aset desa..."
                  value={mutasiForm.alasan}
                  onChange={(e) => setMutasiForm({ ...mutasiForm, alasan: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Nomor Surat Permohonan Desa
                  </label>
                  <input
                    type="text"
                    required
                    value={mutasiForm.nomorSuratDesa}
                    onChange={(e) => setMutasiForm({ ...mutasiForm, nomorSuratDesa: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Dokumen Pendukung
                  </label>
                  <input
                    type="text"
                    required
                    value={mutasiForm.dokumenPendukung}
                    onChange={(e) => setMutasiForm({ ...mutasiForm, dokumenPendukung: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMutasiModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/20"
                >
                  Kirim Permohonan Mutasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Permohonan Penghapusan Aset */}
      {showHapusModal && selectedAset && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0E1526] border border-red-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowHapusModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-red-500/20 text-red-300">
                <FileMinus className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">
                  Permohonan Penghapusan Aset Tetap Desa
                </h3>
                <p className="text-xs text-slate-400">
                  Modul verifikasi pra-persetujuan Kecamatan Sirombu
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 mb-4 text-xs space-y-1">
              <div className="text-slate-400 font-medium">Aset yang diajukan penghapusan:</div>
              <div className="font-bold text-white text-sm">{selectedAset.namaAset}</div>
              <div className="text-slate-400 font-mono text-[11px]">
                {selectedAset.desaName} • Kondisi: <span className="text-red-400 font-bold">{selectedAset.kondisi}</span> • Nilai: {formatRupiah(selectedAset.nilaiPerolehan)}
              </div>
            </div>

            <form onSubmit={handleSaveHapus} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Sebab & Alasan Penghapusan Aset *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Misal: Rusak berat/tidak dapat diperbaiki, hilang akibat musibah, atau telah dijual berdasarkan Keputusan Musdes..."
                  value={hapusForm.alasan}
                  onChange={(e) => setHapusForm({ ...hapusForm, alasan: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Nomor Surat Pengantar Kades
                  </label>
                  <input
                    type="text"
                    required
                    value={hapusForm.nomorSuratDesa}
                    onChange={(e) => setHapusForm({ ...hapusForm, nomorSuratDesa: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Dasar Dokumen Pendukung
                  </label>
                  <input
                    type="text"
                    required
                    value={hapusForm.dokumenPendukung}
                    onChange={(e) => setHapusForm({ ...hapusForm, dokumenPendukung: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-[11px]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowHapusModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-600/20"
                >
                  Ajukan Penghapusan ke Kecamatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detail Aset & Foto */}
      {showDetailModal && detailAset && (
        <AsetDetailModal
          aset={detailAset}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          onOpenBarcode={(aset) => {
            setShowDetailModal(false);
            handleOpenBarcode(aset);
          }}
        />
      )}

      {/* MODAL: Cetak Barcode & Label Aset */}
      {showBarcodeModal && barcodeAset && (
        <BarcodeModal
          aset={barcodeAset}
          isOpen={showBarcodeModal}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}
    </div>
  );
};
