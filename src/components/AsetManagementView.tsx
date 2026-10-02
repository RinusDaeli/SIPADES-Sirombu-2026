import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Aset, KlasAset, KondisiAset, SumberDana } from '../types';
import {
  KLASIFIKASI_LIST,
  formatRupiah,
  formatNumber,
  formatTanggalIndonesia,
  generateAutoKodeAset,
  generateSequentialKodeAset,
} from '../utils/reportGenerator';
import { BarcodeModal } from './BarcodeModal';
import { AsetDetailModal } from './AsetDetailModal';
import { SyncDevicesModal } from './SyncDevicesModal';
import { BackupRestoreModal } from './BackupRestoreModal';
import { FirestoreQuotaModal } from './FirestoreQuotaModal';
import { AnnouncementReaderModal } from './AnnouncementReaderModal';
import { IndonesianDatePicker } from './IndonesianDatePicker';
import { syncManager } from '../utils/cloudSyncService';
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
  FileCheck2,
  RefreshCw,
  Sparkles,
  Hash,
  Info,
  ChevronDown,
  ChevronUp,
  Tag,
  Calendar,
  Database,
  Bell,
} from 'lucide-react';

export const AsetManagementView: React.FC = () => {
  const {
    asets,
    desas,
    currentUser,
    addAset,
    addAsetBatch,
    updateAset,
    deleteAset,
    ajukanMutasi,
    ajukanPenghapusan,
    selectedYear,
    isServerConnected,
    refreshServerData,
    firestoreQuotaStatus,
    announcements,
    unreadAnnouncementCount,
  } = useApp();

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [peerCount, setPeerCount] = useState<number>(() => syncManager.getConnectedCount());

  useEffect(() => {
    return syncManager.onPeerCountChange((count) => {
      setPeerCount(count);
    });
  }, []);

  const isDesaUser = currentUser?.role === 'admin_desa';
  const isAdminOrSuper = currentUser?.role === 'super_admin' || currentUser?.role === 'admin_kecamatan';
  const defaultDesaId = isDesaUser ? currentUser.desaId || 'desa-21' : 'all';

  // Filters
  const [filterDesa, setFilterDesa] = useState<string>(defaultDesaId);
  const [filterKlasifikasi, setFilterKlasifikasi] = useState<string>('all');
  const [filterSumberDana, setFilterSumberDana] = useState<string>('all');
  const [filterKondisi, setFilterKondisi] = useState<string>('all');
  const [filterTahun, setFilterTahun] = useState<number | 'all'>('all');
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
    buktiTanggal: formatTanggalIndonesia(new Date()),
    tahunPerolehan: new Date().getFullYear(),
    nilaiPerolehan: 0,
    kondisi: 'Baik' as KondisiAset,
    sumberDana: 'DDS' as SumberDana,
    volume: '',
    lokasi: '',
    merk: '',
    tipe: '',
    nomorSeri: '',
    keterangan: '',
    fotoAset: ['', '', '', '', ''] as string[],
    fotoBast: '' as string,
  });
  const [photoError, setPhotoError] = useState<string>('');

  // Multi-unit purchase and auto sequential registration state
  const [jumlahUnit, setJumlahUnit] = useState<number>(1);
  const [tipeHarga, setTipeHarga] = useState<'satuan' | 'total'>('satuan');
  const [showPreviewRegister, setShowPreviewRegister] = useState<boolean>(true);
  const [customStartSeq, setCustomStartSeq] = useState<number | ''>('');
  const [showCustomSeq, setShowCustomSeq] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Accordion state for admin grouped villages (collapsed by default)
  const [expandedAdminDesas, setExpandedAdminDesas] = useState<Record<string, boolean>>({});

  const toggleAdminDesa = (desaId: string) => {
    setExpandedAdminDesas((prev) => ({
      ...prev,
      [desaId]: !prev[desaId],
    }));
  };

  const expandAllAdminDesas = () => {
    const allExp: Record<string, boolean> = {};
    desas.forEach((d) => {
      allExp[d.id] = true;
    });
    setExpandedAdminDesas(allExp);
  };

  const collapseAllAdminDesas = () => {
    setExpandedAdminDesas({});
  };

  const openedDesasCount = useMemo(
    () => Object.values(expandedAdminDesas).filter(Boolean).length,
    [expandedAdminDesas]
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 6000);
  };

  // Compute real-time sequential codes for the current selection and quantity
  const sequentialCodes = useMemo(() => {
    const count = Math.max(1, jumlahUnit);
    const startSeq = typeof customStartSeq === 'number' && customStartSeq > 0 ? customStartSeq : undefined;
    const year = Number(formData.tahunPerolehan) || new Date().getFullYear();
    return generateSequentialKodeAset(
      formData.desaId,
      formData.klasifikasi,
      count,
      asets,
      desas,
      startSeq,
      year
    );
  }, [formData.desaId, formData.klasifikasi, formData.tahunPerolehan, jumlahUnit, asets, desas, customStartSeq]);

  const autoKodeAwal = sequentialCodes[0]?.kodeAset || '';
  const autoKodeAkhir = sequentialCodes[sequentialCodes.length - 1]?.kodeAset || '';

  // Value calculation for multi-unit
  const inputNilai = Number(formData.nilaiPerolehan) || 0;
  const hargaPerUnit = useMemo(() => {
    if (jumlahUnit <= 1) return inputNilai;
    if (tipeHarga === 'satuan') return inputNilai;
    return jumlahUnit > 0 ? Math.round(inputNilai / jumlahUnit) : 0;
  }, [inputNilai, jumlahUnit, tipeHarga]);

  const hargaTotal = useMemo(() => {
    if (jumlahUnit <= 1) return inputNilai;
    if (tipeHarga === 'total') return inputNilai;
    return inputNilai * jumlahUnit;
  }, [inputNilai, jumlahUnit, tipeHarga]);

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
      const matchTahun = filterTahun === 'all' ? true : item.tahunPerolehan === filterTahun;

      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        item.namaAset.toLowerCase().includes(query) ||
        item.kodeAset.toLowerCase().includes(query) ||
        item.desaName.toLowerCase().includes(query) ||
        (item.bukti?.nomor && item.bukti.nomor.toLowerCase().includes(query)) ||
        (item.merk && item.merk.toLowerCase().includes(query)) ||
        (item.tipe && item.tipe.toLowerCase().includes(query)) ||
        (item.nomorSeri && item.nomorSeri.toLowerCase().includes(query)) ||
        (item.keterangan && item.keterangan.toLowerCase().includes(query));

      return matchDesa && matchKlas && matchDana && matchKondisi && matchTahun && matchSearch;
    });
  }, [asets, isDesaUser, currentUser, filterDesa, filterKlasifikasi, filterSumberDana, filterKondisi, filterTahun, searchQuery]);

  // PENGELOMPOKKAN SESUAI PERMINTAAN USER:
  // 1. Akun Desa: Kelompokkan data aset sesuai tahun baru (descending) kemudian sesuai nomor registrasi aset
  const groupedDesaAsets = useMemo(() => {
    if (!isDesaUser) return [];
    const yearsMap = new Map<number, Aset[]>();
    filteredList.forEach((item) => {
      const yr = item.tahunPerolehan || 0;
      if (!yearsMap.has(yr)) yearsMap.set(yr, []);
      yearsMap.get(yr)!.push(item);
    });

    const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => b - a);

    return sortedYears.map((yr) => {
      const rawItems = yearsMap.get(yr)!;
      const sortedItems = [...rawItems].sort((a, b) => {
        const regA = parseInt(a.nomorRegister || '0', 10) || 0;
        const regB = parseInt(b.nomorRegister || '0', 10) || 0;
        if (regA !== regB) return regA - regB;
        return (a.kodeAset || '').localeCompare(b.kodeAset || '');
      });
      const totalNilai = sortedItems.reduce((sum, it) => sum + (it.nilaiPerolehan || 0), 0);
      return {
        year: yr,
        items: sortedItems,
        totalNilai,
      };
    });
  }, [filteredList, isDesaUser]);

  // 2. Akun Admin / Super Admin: Kelompokkan data aset per desa, sesuai tahun kemudian sesuai nomor registrasi aset
  const groupedAdminAsets = useMemo(() => {
    if (isDesaUser) return [];
    const desaMap = new Map<string, Aset[]>();
    filteredList.forEach((item) => {
      const dId = item.desaId || 'unknown';
      if (!desaMap.has(dId)) desaMap.set(dId, []);
      desaMap.get(dId)!.push(item);
    });

    const sortedDesaIds = Array.from(desaMap.keys()).sort((a, b) => {
      const desaA = desas.find((d) => d.id === a);
      const desaB = desas.find((d) => d.id === b);
      return (desaA?.name || a).localeCompare(desaB?.name || b);
    });

    return sortedDesaIds.map((dId) => {
      const dItems = desaMap.get(dId)!;
      const desaObj = desas.find((d) => d.id === dId);

      const yearMap = new Map<number, Aset[]>();
      dItems.forEach((item) => {
        const yr = item.tahunPerolehan || 0;
        if (!yearMap.has(yr)) yearMap.set(yr, []);
        yearMap.get(yr)!.push(item);
      });

      const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);

      const yearGroups = sortedYears.map((yr) => {
        const rawItems = yearMap.get(yr)!;
        const sortedItems = [...rawItems].sort((a, b) => {
          const regA = parseInt(a.nomorRegister || '0', 10) || 0;
          const regB = parseInt(b.nomorRegister || '0', 10) || 0;
          if (regA !== regB) return regA - regB;
          return (a.kodeAset || '').localeCompare(b.kodeAset || '');
        });
        const totalNilai = sortedItems.reduce((sum, it) => sum + (it.nilaiPerolehan || 0), 0);
        return {
          year: yr,
          items: sortedItems,
          totalNilai,
        };
      });

      const totalNilai = dItems.reduce((sum, it) => sum + (it.nilaiPerolehan || 0), 0);

      return {
        desaId: dId,
        desaName: desaObj?.name || dItems[0]?.desaName || 'DESA',
        desaCode: desaObj?.code || '',
        yearGroups,
        totalNilai,
        totalItems: dItems.length,
      };
    });
  }, [filteredList, isDesaUser, desas]);

  // Open add modal
  const handleOpenAdd = () => {
    setPhotoError('');
    setJumlahUnit(1);
    setTipeHarga('satuan');
    setCustomStartSeq('');
    setShowCustomSeq(false);
    setShowPreviewRegister(true);

    const targetDesaId = isDesaUser ? currentUser.desaId || 'desa-21' : desas[0]?.id || 'desa-01';
    const targetKlas: KlasAset = 'Peralatan, Mesin, dan Alat Berat';
    const currentYear = new Date().getFullYear();
    const initialCodes = generateSequentialKodeAset(targetDesaId, targetKlas, 1, asets, desas, undefined, currentYear);
    const autoKode = initialCodes[0]?.kodeAset || '';

    setFormData({
      desaId: targetDesaId,
      klasifikasi: targetKlas,
      namaAset: '',
      kodeAset: autoKode,
      buktiJenis: 'Kwitansi / BAST',
      buktiNomor: '',
      buktiTanggal: formatTanggalIndonesia(new Date()),
      tahunPerolehan: currentYear,
      nilaiPerolehan: 0,
      kondisi: 'Baik',
      sumberDana: 'DDS',
      volume: '1 Unit',
      lokasi: '',
      merk: '',
      tipe: '',
      nomorSeri: '',
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
      buktiJenis: item.bukti?.jenis || 'Kwitansi / BAST',
      buktiNomor: item.bukti?.nomor || '',
      buktiTanggal: item.bukti?.tanggal || '',
      tahunPerolehan: item.tahunPerolehan,
      nilaiPerolehan: item.nilaiPerolehan,
      kondisi: item.kondisi,
      sumberDana: item.sumberDana,
      volume: item.volume || '',
      lokasi: item.lokasi || '',
      merk: item.merk || '',
      tipe: item.tipe || '',
      nomorSeri: item.nomorSeri || '',
      keterangan: item.keterangan || '',
      fotoAset: existingPhotos.slice(0, 5),
      fotoBast: item.fotoBast || '',
    });
    setShowEditModal(true);
  };

  // Handle submit add
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const validPhotos = formData.fotoAset.filter((p) => p && p.trim().length > 0);
    if (validPhotos.length === 0) {
      setPhotoError('Wajib mengunggah minimal 1 Foto Fisik Aset!');
      return;
    }

    if (!formData.merk || !formData.merk.trim()) {
      showToast('Merk barang wajib diisi!');
      return;
    }
    if (!formData.tipe || !formData.tipe.trim()) {
      showToast('Type / Model barang wajib diisi!');
      return;
    }
    if (!formData.nomorSeri || !formData.nomorSeri.trim()) {
      showToast('Nomor Seri / Pabrik / Rangka wajib diisi!');
      return;
    }

    const desa = desas.find((d) => d && d.id === formData.desaId);
    let count = Math.max(1, jumlahUnit);
    // Jika aset yang diisi lebih dari 1 (melalui stepper atau kolom volume), langsung gandakan otomatis
    if (count === 1 && formData.volume) {
      const volNumMatch = formData.volume.trim().match(/^(\d+)/);
      if (volNumMatch) {
        const parsed = parseInt(volNumMatch[1], 10);
        if (parsed > 1 && parsed <= 500) {
          count = parsed;
        }
      }
    }

    const startSeq = typeof customStartSeq === 'number' && customStartSeq > 0 ? customStartSeq : undefined;
    const targetYear = Number(formData.tahunPerolehan) || new Date().getFullYear();

    // Compute fresh sequential codes for all units
    const freshCodes = generateSequentialKodeAset(
      formData.desaId,
      formData.klasifikasi,
      count,
      asets,
      desas,
      startSeq,
      targetYear
    );

    if (count === 1) {
      const singleCode = freshCodes[0];
      addAset({
        desaId: formData.desaId,
        desaName: desa?.name || 'DESA',
        klasifikasi: formData.klasifikasi,
        namaAset: formData.namaAset,
        kodeAset: singleCode.kodeAset,
        nomorRegister: singleCode.nomorRegister,
        bukti: {
          jenis: formData.buktiJenis,
          nomor: formData.buktiNomor,
          tanggal: formData.buktiTanggal,
        },
        tahunPerolehan: Number(formData.tahunPerolehan),
        nilaiPerolehan: Number(formData.nilaiPerolehan),
        kondisi: formData.kondisi,
        sumberDana: formData.sumberDana,
        volume: formData.volume || '1 Unit',
        lokasi: formData.lokasi,
        merk: formData.merk?.trim() || undefined,
        tipe: formData.tipe?.trim() || undefined,
        nomorSeri: formData.nomorSeri?.trim() || undefined,
        keterangan: formData.keterangan,
        fotoAset: validPhotos,
        fotoBast: formData.fotoBast || undefined,
      });
      showToast(`Berhasil menambahkan 1 unit aset: ${formData.namaAset} (${singleCode.kodeAset} • No. Reg: ${singleCode.nomorRegister})`);
    } else {
      // Multiple units purchase: ciptakan data barang yang sama persis, cuma kode asetnya yang berbeda (otomatis)
      const batchItems = freshCodes.map((codeInfo) => {
        return {
          desaId: formData.desaId,
          desaName: desa?.name || 'DESA',
          klasifikasi: formData.klasifikasi,
          namaAset: formData.namaAset, // Data barang sama persis
          kodeAset: codeInfo.kodeAset, // Cuma kode aset yang berbeda (otomatis)
          nomorRegister: codeInfo.nomorRegister, // Nomor urut register berurutan
          bukti: {
            jenis: formData.buktiJenis,
            nomor: formData.buktiNomor,
            tanggal: formData.buktiTanggal,
          },
          tahunPerolehan: Number(formData.tahunPerolehan),
          nilaiPerolehan: Number(hargaPerUnit),
          kondisi: formData.kondisi,
          sumberDana: formData.sumberDana,
          volume: formData.volume || '1 Unit',
          lokasi: formData.lokasi,
          merk: formData.merk?.trim() || undefined,
          tipe: formData.tipe?.trim() || undefined,
          nomorSeri: formData.nomorSeri?.trim() || undefined,
          keterangan: formData.keterangan,
          fotoAset: validPhotos,
          fotoBast: formData.fotoBast || undefined,
        };
      });

      await addAsetBatch(batchItems);
      showToast(
        `Berhasil mendaftarkan ${count} unit barang "${formData.namaAset}" dengan data sama & kode aset urut otomatis: ${freshCodes[0].kodeAset} s/d ${freshCodes[count - 1].kodeAset}`
      );
    }

    setShowAddModal(false);
  };

  // Handle submit edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAset) return;

    if (!formData.merk || !formData.merk.trim()) {
      showToast('Merk barang wajib diisi!');
      return;
    }
    if (!formData.tipe || !formData.tipe.trim()) {
      showToast('Type / Model barang wajib diisi!');
      return;
    }
    if (!formData.nomorSeri || !formData.nomorSeri.trim()) {
      showToast('Nomor Seri / Pabrik / Rangka wajib diisi!');
      return;
    }

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
      merk: formData.merk?.trim() || undefined,
      tipe: formData.tipe?.trim() || undefined,
      nomorSeri: formData.nomorSeri?.trim() || undefined,
      keterangan: formData.keterangan,
      fotoAset: validPhotos.length > 0 ? validPhotos : selectedAset.fotoAset,
      fotoBast: formData.fotoBast || selectedAset.fotoBast,
    });
    setShowEditModal(false);
  };

  // Handle open Mutasi Modal
  const handleOpenMutasi = (item: Aset) => {
    setSelectedAset(item);
    const cleanDesa = (item.desaName || '').replace('DESA ', '') || 'DESA';
    setMutasiForm({
      alasan: '',
      nomorSuratDesa: `141/${Math.floor(Math.random() * 900 + 100)}/DS-${cleanDesa}/2024`,
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
    const cleanDesa = (item.desaName || '').replace('DESA ', '') || 'DESA';
    setHapusForm({
      alasan: item.kondisi === 'Rusak Berat' ? 'Aset mengalami kerusakan berat dan biaya perbaikan melebihi nilai ekonomis.' : '',
      nomorSuratDesa: `141/${Math.floor(Math.random() * 900 + 100)}/DS-${cleanDesa}/2024`,
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
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3 text-emerald-200 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 hover:text-white p-1 rounded-lg hover:bg-emerald-900/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Panel Status Sinkronisasi Real-Time Multi-Perangkat (Hanya untuk Admin / Super Admin) */}
          {isAdminOrSuper && (
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer text-left group"
              title="Klik untuk melihat status sinkronisasi antar perangkat & kode transfer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${peerCount > 0 || isServerConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-[11px] leading-tight truncate group-hover:text-emerald-300 transition-colors">
                    {peerCount > 0 ? `Terhubung (${peerCount} Online)` : isServerConnected ? 'Terhubung Antar Laptop' : 'Mode Offline / Terputus'}
                  </span>
                  <span className="text-[10px] text-emerald-400/90 truncate font-mono">
                    P2P & Cloud Relay Aktif
                  </span>
                </div>
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  refreshServerData();
                }}
                className="p-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-800 text-emerald-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Sinkronkan data sekarang"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </div>
            </button>
          )}

          {/* Panel Backup & Restore Data (Dipindahkan ke bilah atas DATA ASET) */}
          {isAdminOrSuper && (
            <button
              type="button"
              onClick={() => setShowBackupModal(true)}
              className="p-2 sm:px-3 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
              title="Backup & Restore data aset (JSON / Cloud)"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Backup & Restore</span>
            </button>
          )}

          {/* Tombol Lonceng Pesan Berkedip (Isi pesan tersembunyi sampai diklik) */}
          {announcements.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAnnounceModal(true)}
              className={`p-2 sm:px-3 sm:py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0 ${
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
              <span className="hidden sm:inline">
                {unreadAnnouncementCount > 0 ? `${unreadAnnouncementCount} Pesan Baru` : 'Pemberitahuan'}
              </span>
            </button>
          )}

          {/* Tombol Cek Kuota Langsung Firebase (Khusus Super Admin) */}
          {currentUser?.role === 'super_admin' && (
            <button
              type="button"
              onClick={() => setShowQuotaModal(true)}
              className={`p-2 sm:px-3 sm:py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0 ${
                firestoreQuotaStatus === 'EXHAUSTED'
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-200 animate-pulse hover:bg-amber-900/80'
                  : 'bg-slate-900/90 hover:bg-slate-800 border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white'
              }`}
              title="Cek Kuota Langsung Google Cloud Firestore & Jadwal Reset (Khusus Super Admin)"
            >
              <Database className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">
                {firestoreQuotaStatus === 'EXHAUSTED' ? '⚠️ Kuota Habis (Reset 14:00)' : 'Cek Kuota Firebase'}
              </span>
              <span className="sm:hidden">
                {firestoreQuotaStatus === 'EXHAUSTED' ? '⚠️ Kuota' : 'Kuota'}
              </span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Aset Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0E1526] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search box */}
          <div className="relative sm:col-span-2 lg:col-span-2">
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
          {!isDesaUser ? (
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
          ) : (
            <div className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-semibold text-emerald-400 flex items-center gap-1.5 truncate">
              <Building className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{desas.find((d) => d.id === currentUser?.desaId)?.name || 'Desa'}</span>
            </div>
          )}

          {/* Tahun Anggaran Filter */}
          <div>
            <select
              value={filterTahun}
              onChange={(e) => setFilterTahun(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
            >
              <option value="all">Semua Tahun Anggaran</option>
              <option value={2026}>Tahun Anggaran 2026</option>
              <option value={2025}>Tahun Anggaran 2025</option>
              <option value={2024}>Tahun Anggaran 2024</option>
              <option value={2023}>Tahun Anggaran 2023</option>
              <option value={2022}>Tahun Anggaran 2022</option>
              <option value={2021}>Tahun Anggaran 2021</option>
              <option value={2020}>Tahun Anggaran 2020</option>
            </select>
          </div>

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
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800 gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Tahun:</span>
              {(['all', 2026, 2025, 2024, 2023] as const).map((yr) => (
                <button
                  key={yr}
                  onClick={() => setFilterTahun(yr)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                    filterTahun === yr
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {yr === 'all' ? 'Semua Tahun' : yr}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Kondisi:</span>
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
                  {k === 'all' ? 'Semua' : k}
                </button>
              ))}
            </div>
          </div>

          <div className="font-semibold text-slate-300">
            Menampilkan <span className="text-amber-400 font-bold">{filteredList.length}</span> item aset
          </div>
        </div>
      </div>

      {/* Accordion Toolbar untuk Tampilan Banyak Desa */}
      {!isDesaUser && filterDesa === 'all' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="p-1 rounded-lg bg-blue-500/20 text-blue-400">
              <Layers className="w-4 h-4" />
            </span>
            <span className="leading-relaxed">
              Daftar aset 25 desa disembunyikan secara default. Klik nama desa untuk memunculkan semua data asetnya.
              <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono text-[10px] font-bold border border-slate-700">
                {openedDesasCount} dari {desas.length} desa terbuka
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={expandAllAdminDesas}
              className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white font-semibold text-xs border border-blue-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Bentangkan dan munculkan semua data aset dari seluruh 25 desa"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Bentangkan Semua Desa
            </button>
            <button
              type="button"
              onClick={collapseAllAdminDesas}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Sembunyikan dan ciutkan semua desa (kembali ke default)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              Ciutkan Semua (Default)
            </button>
          </div>
        </div>
      )}

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
                  <td colSpan={11} className="py-16 text-center text-slate-500">
                    <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-60" />
                    <p className="font-semibold text-slate-400">Belum ada data aset tercatat.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Klik tombol <strong className="text-amber-400">"Tambah Aset Baru"</strong> di atas untuk mengentri data aset secara manual.
                    </p>
                  </td>
                </tr>
              ) : isDesaUser ? (
                // MODE AKUN DESA: Kelompokkan data aset sesuai tahun baru (descending) kemudian sesuai nomor registrasi aset
                groupedDesaAsets.map((yearGroup) => (
                  <React.Fragment key={`desa-year-${yearGroup.year}`}>
                    {/* Header Grup Tahun Anggaran */}
                    <tr className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-950 border-t-2 border-b border-amber-500/40">
                      <td colSpan={11} className="py-2.5 px-4 font-bold text-amber-300">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-400" />
                            <span className="text-xs uppercase tracking-wide">
                              TAHUN ANGGARAN {yearGroup.year}
                            </span>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {yearGroup.items.length} Unit Aset
                            </span>
                          </div>
                          <div className="font-mono text-xs text-emerald-400">
                            Subtotal Tahun {yearGroup.year}: {formatRupiah(yearGroup.totalNilai)}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Daftar Aset dalam Tahun ini terurut berdasarkan Nomor Registrasi */}
                    {yearGroup.items.map((item, idx) => {
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
                                {(item.merk || item.tipe || item.nomorSeri) && (
                                  <div className="mt-0.5 text-[10px] text-emerald-300 font-mono flex items-center gap-1 flex-wrap">
                                    {item.merk && <span className="bg-emerald-950/70 border border-emerald-500/30 px-1 py-0.2 rounded">Merk: {item.merk}</span>}
                                    {item.tipe && <span className="bg-emerald-950/70 border border-emerald-500/30 px-1 py-0.2 rounded">Type: {item.tipe}</span>}
                                    {item.nomorSeri && <span className="bg-slate-900 border border-slate-700 px-1 py-0.2 rounded text-slate-300">SN: {item.nomorSeri}</span>}
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
                              {(item.desaName || 'Desa').replace('DESA ', '')}
                            </span>
                          </td>
                          <td className="py-3 px-3 max-w-[180px]">
                            <div className="font-semibold text-slate-200 text-[11px]">
                              {item.bukti?.jenis || '-'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              No: {item.bukti?.nomor || '-'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Tgl: {item.bukti?.tanggal || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px]">
                            <div className="font-bold text-emerald-400 tracking-wide">
                              {item.kodeAset}
                            </div>
                            {item.nomorRegister && (
                              <div className="text-[10px] text-amber-300 font-mono flex items-center gap-1 mt-0.5">
                                <span className="text-slate-500 font-sans">No. Reg:</span>
                                <span className="px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 font-bold">
                                  {item.nomorRegister}
                                </span>
                              </div>
                            )}
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
                    })}
                  </React.Fragment>
                ))
              ) : (
                // MODE AKUN ADMIN / SUPER ADMIN: Kelompokkan data aset per desa, sesuai tahun kemudian sesuai nomor registrasi aset
                groupedAdminAsets.map((desaGroup, dIdx) => {
                  const isExpanded =
                    filterDesa !== 'all'
                      ? expandedAdminDesas[desaGroup.desaId] !== false
                      : Boolean(expandedAdminDesas[desaGroup.desaId]);

                  return (
                    <React.Fragment key={`admin-desa-${desaGroup.desaId}`}>
                      {/* Level 1: Header Grup Desa */}
                      <tr
                        onClick={() => toggleAdminDesa(desaGroup.desaId)}
                        className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-950 border-t-2 border-b border-blue-600/80 cursor-pointer hover:from-blue-900/90 hover:via-slate-800 hover:to-slate-900 transition-all select-none group"
                        title={`Klik untuk ${isExpanded ? 'menyembunyikan' : 'memunculkan semua'} data aset Desa ${desaGroup.desaName}`}
                      >
                        <td colSpan={11} className="py-3 px-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center font-bold text-xs">
                                {dIdx + 1}
                              </span>
                              <span className="p-1 rounded-md bg-blue-500/20 text-blue-300 group-hover:bg-blue-500/40 group-hover:text-white transition-colors">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </span>
                              <Building className="w-4 h-4 text-blue-400" />
                              <span className="text-xs font-black text-white uppercase tracking-wide group-hover:text-amber-300 transition-colors">
                                DESA {desaGroup.desaName.toUpperCase().replace(/^DESA\s+/i, '')}
                              </span>
                              <span className="text-[11px] text-blue-300 font-mono">
                                (Kode: {desaGroup.desaCode || '-'})
                              </span>
                              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                                {desaGroup.totalItems} Unit Aset
                              </span>
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1 transition-colors ${
                                  isExpanded
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-blue-600/30 text-blue-200 border border-blue-400/40 group-hover:bg-blue-600/60'
                                }`}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-3 h-3" /> Sembunyikan Aset
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-3 h-3" /> Klik untuk Buka ({desaGroup.totalItems} Aset)
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="font-mono text-xs font-bold text-emerald-400">
                                Total Nilai Aset Desa: {formatRupiah(desaGroup.totalNilai)}
                              </div>
                              <span className="text-[11px] text-slate-400 group-hover:text-amber-300 font-medium hidden sm:inline">
                                {isExpanded ? 'Tutup ▴' : 'Buka Rincian ▾'}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Level 2: Header Grup Tahun dalam Desa ini & Baris Aset (Hanya dirender jika isExpanded) */}
                      {isExpanded && (
                        desaGroup.totalItems === 0 ? (
                          <tr>
                            <td colSpan={11} className="py-5 px-6 text-center text-slate-500 italic bg-slate-900/30">
                              Belum ada data aset tercatat untuk {desaGroup.desaName}.
                            </td>
                          </tr>
                        ) : (
                          desaGroup.yearGroups.map((yearGroup) => (
                            <React.Fragment key={`admin-desa-${desaGroup.desaId}-year-${yearGroup.year}`}>
                              <tr className="bg-slate-900/90 border-b border-slate-800">
                                <td colSpan={11} className="py-2 px-6 font-bold text-amber-300">
                                  <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500 font-mono">↳</span>
                                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Tahun Anggaran {yearGroup.year}</span>
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400">
                                        {yearGroup.items.length} Unit
                                      </span>
                                    </div>
                                    <div className="font-mono text-[11px] text-emerald-400">
                                      Subtotal TA {yearGroup.year}: {formatRupiah(yearGroup.totalNilai)}
                                    </div>
                                  </div>
                                </td>
                              </tr>

                              {/* Baris-baris aset dalam tahun ini terurut sesuai nomor registrasi */}
                              {yearGroup.items.map((item, idx) => {
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
                                          {(item.merk || item.tipe || item.nomorSeri) && (
                                            <div className="mt-0.5 text-[10px] text-emerald-300 font-mono flex items-center gap-1 flex-wrap">
                                              {item.merk && <span className="bg-emerald-950/70 border border-emerald-500/30 px-1 py-0.2 rounded">Merk: {item.merk}</span>}
                                              {item.tipe && <span className="bg-emerald-950/70 border border-emerald-500/30 px-1 py-0.2 rounded">Type: {item.tipe}</span>}
                                              {item.nomorSeri && <span className="bg-slate-900 border border-slate-700 px-1 py-0.2 rounded text-slate-300">SN: {item.nomorSeri}</span>}
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
                                        {(item.desaName || 'Desa').replace('DESA ', '')}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 max-w-[180px]">
                                      <div className="font-semibold text-slate-200 text-[11px]">
                                        {item.bukti?.jenis || '-'}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono truncate">
                                        No: {item.bukti?.nomor || '-'}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        Tgl: {item.bukti?.tanggal || '-'}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 font-mono text-[11px]">
                                      <div className="font-bold text-emerald-400 tracking-wide">
                                        {item.kodeAset}
                                      </div>
                                      {item.nomorRegister && (
                                        <div className="text-[10px] text-amber-300 font-mono flex items-center gap-1 mt-0.5">
                                          <span className="text-slate-500 font-sans">No. Reg:</span>
                                          <span className="px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 font-bold">
                                            {item.nomorRegister}
                                          </span>
                                        </div>
                                      )}
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
                              })}
                            </React.Fragment>
                          ))
                        )
                      )}
                    </React.Fragment>
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
                    onChange={(e) => {
                      const newDesaId = e.target.value;
                      const targetYear = Number(formData.tahunPerolehan) || new Date().getFullYear();
                      const autoKode = generateAutoKodeAset(newDesaId, formData.klasifikasi, asets, desas, undefined, targetYear);
                      setFormData({ ...formData, desaId: newDesaId, kodeAset: autoKode });
                    }}
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
                    onChange={(e) => {
                      const newKlas = e.target.value as KlasAset;
                      const targetYear = Number(formData.tahunPerolehan) || new Date().getFullYear();
                      const autoKode = generateAutoKodeAset(formData.desaId, newKlas, asets, desas, undefined, targetYear);
                      setFormData({ ...formData, klasifikasi: newKlas, kodeAset: autoKode });
                    }}
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
                  placeholder="Contoh: Laptop Asus Core i7 / Meja Rapat Kantor Desa / Genset Silent 5000W"
                  value={formData.namaAset}
                  onChange={(e) => setFormData({ ...formData, namaAset: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* PENGATURAN JUMLAH UNIT & PENOMORAN URUT OTOMATIS */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-amber-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Boxes className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Jumlah Unit Barang yang Dibeli *
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {jumlahUnit > 1
                          ? `Pengadaan ${jumlahUnit} unit sekaligus • Masing-masing unit mendapat nomor register sendiri`
                          : 'Pengadaan 1 unit tunggal'}
                      </span>
                    </div>
                  </div>

                  {/* Stepper Quantity Control */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      disabled={jumlahUnit <= 1}
                      onClick={() => setJumlahUnit((prev) => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                      title="Kurangi 1 unit"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={jumlahUnit}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setJumlahUnit(isNaN(val) || val < 1 ? 1 : Math.min(200, val));
                      }}
                      className="w-16 bg-slate-950 border border-amber-500/50 rounded-lg px-2 py-1 text-center font-mono font-bold text-sm text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setJumlahUnit((prev) => Math.min(200, prev + 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                      title="Tambah 1 unit"
                    >
                      +
                    </button>
                    <span className="text-xs text-slate-300 font-semibold ml-1">Unit</span>
                  </div>
                </div>

                {/* Quick Unit Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Pilihan Cepat:</span>
                  {[1, 2, 3, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setJumlahUnit(num)}
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        jumlahUnit === num
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {num} Unit
                    </button>
                  ))}
                </div>

                {/* Panel Multi-Unit (Jika > 1 Unit) */}
                {jumlahUnit > 1 && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
                    {/* Mode Penginputan Harga */}
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-300">
                        Perhitungan Harga Belanja ({jumlahUnit} Unit):
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="tipeHargaAdd"
                            checked={tipeHarga === 'satuan'}
                            onChange={() => setTipeHarga('satuan')}
                            className="accent-amber-400 cursor-pointer"
                          />
                          <span>Harga Satuan / Unit</span>
                        </label>
                        <span className="text-slate-600">|</span>
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                          <input
                            type="radio"
                            name="tipeHargaAdd"
                            checked={tipeHarga === 'total'}
                            onChange={() => setTipeHarga('total')}
                            className="accent-amber-400 cursor-pointer"
                          />
                          <span>Total Belanja Semua Unit</span>
                        </label>
                      </div>
                    </div>

                    {/* Ringkasan Konversi Nilai */}
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Harga Per Unit</span>
                        <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                          {formatRupiah(hargaPerUnit)}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">
                          Total Belanja ({jumlahUnit} Unit)
                        </span>
                        <span className="font-mono font-bold text-amber-400 text-xs sm:text-sm">
                          {formatRupiah(hargaTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Highlight Penomoran Urut Otomatis */}
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-bold text-emerald-300 text-xs">
                            {jumlahUnit} Nomor Register & Kode Aset Dibuat Otomatis Berurutan:
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPreviewRegister((prev) => !prev)}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          {showPreviewRegister ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Tutup Rincian
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> Lihat Rincian Unit
                            </>
                          )}
                        </button>
                      </div>

                      <div className="font-mono text-xs text-white font-bold bg-slate-950/80 px-3 py-1.5 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                        <span>{autoKodeAwal}</span>
                        <span className="text-emerald-400 text-[11px] font-sans font-normal">s/d</span>
                        <span>{autoKodeAkhir}</span>
                      </div>

                      {/* Tabel / List Pratinjau Seluruh Unit */}
                      {showPreviewRegister && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-2 space-y-1.5">
                          <div className="text-[10px] font-bold text-slate-400 px-1 pb-1 border-b border-slate-800 flex justify-between">
                            <span>Unit Barang</span>
                            <span>No. Register & Kode Aset Tetap</span>
                          </div>
                          {sequentialCodes.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 hover:bg-slate-900 text-[11px]"
                            >
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                                  Unit {idx + 1}
                                </span>
                                <span className="text-slate-300 truncate max-w-[140px] sm:max-w-[200px]">
                                  {formData.namaAset || 'Aset Tetap'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-400 text-[11px]">
                                  {item.kodeAset}
                                </span>
                                <span className="px-1 py-0.2 rounded bg-slate-800 text-[10px] text-amber-300 font-mono">
                                  Reg: {item.nomorRegister}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-[10px] text-emerald-300/80">
                        ✓ Setiap unit akan didaftarkan sebagai baris aset tersendiri di inventaris desa, masing-masing dengan barcode inventaris dan nomor register Permendagri No. 20/2018.
                      </p>
                    </div>
                  </div>
                )}
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
                    <label className="block text-slate-400 mb-1 flex items-center justify-between">
                      <span>Tanggal Bukti</span>
                      <span className="text-[10px] text-amber-400/90 font-medium">MIN • SEN • SEL • RAB • KAM • JUM • SAB</span>
                    </label>
                    <IndonesianDatePicker
                      value={formData.buktiTanggal}
                      onChange={(val) => setFormData({ ...formData, buktiTanggal: val })}
                      placeholder="Pilih tanggal bukti..."
                      align="right"
                    />
                  </div>
                </div>
              </div>

              {/* Kode Aset & Tahun Perolehan & Nilai Perolehan */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-300 text-xs">
                      {jumlahUnit > 1 ? 'Rentang Kode Aset Tetap' : 'Kode Aset Tetap / ID Register'}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-medium flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                        Otomatis
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomStartSeq('');
                        }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline cursor-pointer"
                        title="Buat ulang nomor register urut otomatis"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        Reset
                      </button>
                    </div>
                  </div>

                  {jumlahUnit > 1 ? (
                    <div className="w-full bg-slate-900 border border-emerald-500/50 rounded-xl px-3 py-2 text-emerald-400 font-mono text-xs font-semibold tracking-wider">
                      {autoKodeAwal} s/d {autoKodeAkhir}
                    </div>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      placeholder="Contoh: 01.01.01.21.0001"
                      value={autoKodeAwal}
                      className="w-full bg-slate-900 border border-emerald-500/50 rounded-xl px-3 py-2 text-emerald-400 font-mono text-sm font-semibold tracking-wider focus:outline-none"
                    />
                  )}

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-slate-400">
                      Format: <span className="font-mono text-slate-300">Klasifikasi.Desa.Urut</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCustomSeq((prev) => !prev)}
                      className="text-[10px] text-slate-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      {showCustomSeq ? 'Tutup Atur Urut' : 'Atur No. Urut Awal'}
                    </button>
                  </div>

                  {showCustomSeq && (
                    <div className="mt-1.5 p-2 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                      <label className="text-[10px] text-slate-300 block font-semibold">
                        Nomor Register Urut Awal (Opsional):
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Contoh: 1, 15, 100"
                        value={customStartSeq}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                          setCustomStartSeq(val);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                      <span className="text-[9px] text-slate-400 block">
                        Kosongkan untuk otomatis melanjutkan nomor urut terakhir di database.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-300 text-xs">
                      Tahun Perolehan *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const curYear = new Date().getFullYear();
                        const autoKode = generateAutoKodeAset(formData.desaId, formData.klasifikasi, asets, desas, undefined, curYear);
                        setFormData({ ...formData, tahunPerolehan: curYear, kodeAset: autoKode });
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold hover:underline cursor-pointer flex items-center gap-1"
                      title="Set ke tahun sekarang"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Tahun Ini ({new Date().getFullYear()})</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    required
                    min="1970"
                    max="2035"
                    value={formData.tahunPerolehan}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const targetYear = isNaN(val) ? ('' as any) : val;
                      const autoKode = !isNaN(val) && val >= 1970
                        ? generateAutoKodeAset(formData.desaId, formData.klasifikasi, asets, desas, undefined, val)
                        : formData.kodeAset;
                      setFormData({ ...formData, tahunPerolehan: targetYear, kodeAset: autoKode });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
                    placeholder={`Contoh: ${new Date().getFullYear()}`}
                  />
                  <span className="text-[9px] text-slate-400 block mt-1">
                    Default tahun sekarang (dapat diedit)
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {jumlahUnit > 1
                      ? tipeHarga === 'satuan'
                        ? 'Harga Satuan per Unit (Rp) *'
                        : `Total Belanja ${jumlahUnit} Unit (Rp) *`
                      : 'Nilai Perolehan (Rp) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.nilaiPerolehan}
                    onChange={(e) => setFormData({ ...formData, nilaiPerolehan: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                  <div className="text-[10px] mt-1 space-y-0.5">
                    <span className="text-emerald-400 block font-mono font-semibold">
                      {formatRupiah(formData.nilaiPerolehan)}
                    </span>
                    {jumlahUnit > 1 && (
                      <span className="text-amber-300 text-[9px] block">
                        {tipeHarga === 'satuan'
                          ? `Total ${jumlahUnit} unit: ${formatRupiah(hargaTotal)}`
                          : `Harga per unit: ${formatRupiah(hargaPerUnit)}`}
                      </span>
                    )}
                  </div>
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
                    placeholder="Contoh: 1 Unit, 5 Unit, 2200 m²"
                    value={formData.volume}
                    onChange={(e) => {
                      const newVol = e.target.value;
                      setFormData({ ...formData, volume: newVol });
                      const numMatch = newVol.match(/^(\d+)\s*(unit|buah|set|paket|item|pcs|meja|kursi|laptop|titik)?/i);
                      if (numMatch) {
                        const parsed = parseInt(numMatch[1], 10);
                        if (parsed >= 1 && parsed <= 200 && parsed !== jumlahUnit) {
                          setJumlahUnit(parsed);
                        }
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                  {jumlahUnit > 1 && (
                    <span className="text-[10px] text-amber-400 font-semibold block mt-1">
                      ⚡ Terdeteksi {jumlahUnit} unit: Aset otomatis digandakan menjadi {jumlahUnit} nomor registrasi berbeda.
                    </span>
                  )}
                </div>
              </div>

              {/* Spesifikasi Barang / Aset: Merk, Type, Nomor Seri */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                    Spesifikasi Barang / Aset (Wajib Diisi)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    *Otomatis digabung ke kolom Keterangan saat cetak aset
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold text-xs">
                      Merk <span className="text-red-400 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Honda, Epson, Asus, dll"
                      value={formData.merk}
                      onChange={(e) => setFormData({ ...formData, merk: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold text-xs">
                      Type / Model <span className="text-red-400 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Vario 125, L3210, dll"
                      value={formData.tipe}
                      onChange={(e) => setFormData({ ...formData, tipe: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold text-xs">
                      Nomor Seri / Pabrik / Rangka <span className="text-red-400 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="No. Seri / Rangka / Mesin"
                      value={formData.nomorSeri}
                      onChange={(e) => setFormData({ ...formData, nomorSeri: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
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
                    <label className="block text-slate-400 mb-1 flex items-center justify-between">
                      <span>Tanggal Bukti</span>
                      <span className="text-[10px] text-amber-400/90 font-medium">MIN • SEN • SEL • RAB • KAM • JUM • SAB</span>
                    </label>
                    <IndonesianDatePicker
                      value={formData.buktiTanggal}
                      onChange={(val) => setFormData({ ...formData, buktiTanggal: val })}
                      placeholder="Pilih tanggal bukti..."
                      align="right"
                    />
                  </div>
                </div>
              </div>

              {/* Kode Aset & Nilai */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-300 text-xs">
                      Kode Aset Tetap
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const yr = Number(formData.tahunPerolehan) || new Date().getFullYear();
                        const freshKode = generateAutoKodeAset(formData.desaId, formData.klasifikasi, asets, desas, undefined, yr);
                        setFormData((prev) => ({ ...prev, kodeAset: freshKode }));
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 hover:underline cursor-pointer"
                      title="Hitung kode register otomatis"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      Set Otomatis
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.kodeAset}
                    onChange={(e) => setFormData({ ...formData, kodeAset: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-300 text-xs">
                      Tahun Perolehan
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const curYear = new Date().getFullYear();
                        const freshKode = generateAutoKodeAset(formData.desaId, formData.klasifikasi, asets, desas, undefined, curYear);
                        setFormData({ ...formData, tahunPerolehan: curYear, kodeAset: freshKode });
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold hover:underline cursor-pointer"
                      title="Set ke tahun sekarang"
                    >
                      Tahun Ini ({new Date().getFullYear()})
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1970"
                    max="2035"
                    value={formData.tahunPerolehan}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      const targetYear = isNaN(val) ? ('' as any) : val;
                      const autoKode = !isNaN(val) && val >= 1970
                        ? generateAutoKodeAset(formData.desaId, formData.klasifikasi, asets, desas, undefined, val)
                        : formData.kodeAset;
                      setFormData({ ...formData, tahunPerolehan: targetYear, kodeAset: autoKode });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-400"
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

              {/* Spesifikasi Barang / Aset: Merk, Type, Nomor Seri */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                    Spesifikasi Barang / Aset (Wajib Diisi)
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    *Otomatis digabung ke kolom Keterangan saat cetak aset
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold text-xs">
                      Merk <span className="text-red-400 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Honda, Epson, Asus, dll"
                      value={formData.merk}
                      onChange={(e) => setFormData({ ...formData, merk: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold text-xs">
                      Type / Model <span className="text-red-400 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Vario 125, L3210, dll"
                      value={formData.tipe}
                      onChange={(e) => setFormData({ ...formData, tipe: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold text-xs">
                      Nomor Seri / Pabrik / Rangka <span className="text-red-400 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="No. Seri / Rangka / Mesin"
                      value={formData.nomorSeri}
                      onChange={(e) => setFormData({ ...formData, nomorSeri: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
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

      {/* MODAL: Sinkronisasi Antar Perangkat Real-Time */}
      <SyncDevicesModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />

      {/* MODAL: Backup & Restore Data (Dipindahkan ke bilah atas DATA ASET) */}
      {isAdminOrSuper && (
        <BackupRestoreModal
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
        />
      )}

      {/* MODAL: Status & Cek Kuota Langsung Firestore (Khusus Super Admin) */}
      {currentUser?.role === 'super_admin' && (
        <FirestoreQuotaModal
          isOpen={showQuotaModal}
          onClose={() => setShowQuotaModal(false)}
        />
      )}

      {/* Modal Pembaca Pesan (Terbuka dari Lonceng & Menciut Kembali Saat Klik Saya Mengerti) */}
      <AnnouncementReaderModal
        isOpen={showAnnounceModal}
        onClose={() => setShowAnnounceModal(false)}
      />
    </div>
  );
};
