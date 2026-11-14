import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Aset, Desa, KlasAset } from '../types';
import { getNiasBaratLogoDataUrl } from './logoHelper';

export const KLASIFIKASI_LIST: KlasAset[] = [
  'Tanah',
  'Peralatan, Mesin, dan Alat Berat',
  'Kendaraan',
  'Gedung dan Bangunan',
  'Jalan',
  'Jembatan',
  'Irigasi/Embung/Air Sungai/Drainase',
  'Jaringan/Instalasi',
  'Aset Tetap Lainnya',
  'Konstruksi dalam Pengerjaan',
];

export const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(num);
};

export const formatTanggalIndonesia = (dateInput?: string | Date): string => {
  if (!dateInput) return '31 Desember 2026';

  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split('-').map(Number);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${d} ${months[m - 1]} ${y}`;
  }

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return String(dateInput);
  }
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatTanggalWaktuIndonesia = (
  dateInput?: string | Date,
  compact: boolean = false
): string => {
  if (!dateInput) return '-';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return String(dateInput);
  }

  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthsFull = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  // Format in Asia/Jakarta (WIB) consistently so server & client align clearly
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const dayNum = parseInt(get('day'), 10);
    const monthIdx = Math.max(0, Math.min(11, parseInt(get('month'), 10) - 1));
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');

    if (compact) {
      return `${dayNum} ${monthsShort[monthIdx]} ${year} • ${hour}:${minute}`;
    }
    return `${dayNum} ${monthsFull[monthIdx]} ${year}, Pukul ${hour}:${minute} WIB`;
  } catch {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return compact
      ? `${d} ${monthsShort[m]} ${y} • ${hh}:${mm}`
      : `${d} ${monthsFull[m]} ${y}, Pukul ${hh}:${mm}`;
  }
};

/**
 * Format nama desa ke bentuk Title Case yang rapi (contoh: "DESA LAHAWA" -> "Lahawa")
 */
export function formatNamaDesaTitleCase(name?: string): string {
  if (!name) return 'Desa';
  const clean = name.replace(/^DESA\s+/i, '').trim();
  if (!clean) return 'Desa';
  return clean
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Menggabungkan Merk, Type, Nomor Seri ke dalam kolom Keterangan saat cetak aset
 * Sesuai instruksi: gabungkan hasil entriannya di kolom Keterangan saat cetak aset
 */
export function formatKeteranganWithSpecs(item: {
  keterangan?: string;
  merk?: string;
  tipe?: string;
  nomorSeri?: string;
  lokasi?: string;
  sumberDana?: string;
}): string {
  const specs: string[] = [];
  if (item.merk && item.merk.trim()) specs.push(`Merk: ${item.merk.trim()}`);
  if (item.tipe && item.tipe.trim()) specs.push(`Type: ${item.tipe.trim()}`);
  if (item.nomorSeri && item.nomorSeri.trim()) specs.push(`No. Seri: ${item.nomorSeri.trim()}`);

  const specText = specs.join(', ');
  const mainKet = item.keterangan ? item.keterangan.trim() : '';

  let mergedKet = '';
  if (specText && mainKet) {
    mergedKet = `${specText} - ${mainKet}`;
  } else if (specText) {
    mergedKet = specText;
  } else {
    mergedKet = mainKet;
  }

  const lokasiPart = item.lokasi && item.lokasi.trim() ? `${item.lokasi.trim()}. ` : '';
  const danaPart = item.sumberDana ? ` [${item.sumberDana}]` : '';

  return `${lokasiPart}${mergedKet || '-'}${danaPart}`;
}

export interface RomanKlasifikasi {
  roman: string;
  title: string;
  key: KlasAset;
}

export const ROMAN_KLASIFIKASI: RomanKlasifikasi[] = [
  { roman: 'I', title: 'TANAH', key: 'Tanah' },
  { roman: 'II', title: 'PERALATAN, MESIN, DAN ALAT BERAT', key: 'Peralatan, Mesin, dan Alat Berat' },
  { roman: 'III', title: 'KENDARAAN', key: 'Kendaraan' },
  { roman: 'IV', title: 'GEDUNG DAN BANGUNAN', key: 'Gedung dan Bangunan' },
  { roman: 'V', title: 'JALAN', key: 'Jalan' },
  { roman: 'VI', title: 'JEMBATAN', key: 'Jembatan' },
  { roman: 'VII', title: 'IRIGASI/EMBUNG/AIR SUNGAI/DRAINASE', key: 'Irigasi/Embung/Air Sungai/Drainase' },
  { roman: 'VIII', title: 'JARINGAN/INSTALASI', key: 'Jaringan/Instalasi' },
  { roman: 'IX', title: 'ASET TETAP LAINNYA', key: 'Aset Tetap Lainnya' },
  { roman: 'X', title: 'KONSTRUKSI DALAM PENGERJAAN', key: 'Konstruksi dalam Pengerjaan' },
];

export const KLASIFIKASI_KODE_PREFIX: Record<KlasAset, string> = {
  'Tanah': '01.01.01',
  'Peralatan, Mesin, dan Alat Berat': '02.01.01',
  'Kendaraan': '02.02.01',
  'Gedung dan Bangunan': '03.01.01',
  'Jalan': '04.01.01',
  'Jembatan': '04.02.01',
  'Irigasi/Embung/Air Sungai/Drainase': '04.03.01',
  'Jaringan/Instalasi': '04.04.01',
  'Aset Tetap Lainnya': '05.01.01',
  'Konstruksi dalam Pengerjaan': '06.01.01',
};

/**
 * Generate standard Permendagri No. 1/2016 Asset Code / Register Number automatically
 * Format: [Golongan.Bidang.Kelompok].[KodeDesa].[TahunPerolehan].[NomorRegister]
 * Example: 01.01.01.21.2025.0001 (Tanah pertama di Desa Sirombu tahun pengadaan 2025)
 */
export interface GeneratedKodeAsetInfo {
  kodeAset: string;
  nomorRegister: string;
  sequenceNumber: number;
}

/**
 * Generate sequential Permendagri No. 20/2018 & Permendagri No. 1/2016 Asset Codes / Register Numbers for 1 or more units
 * Format: [Golongan.Bidang.Kelompok].[KodeDesa].[TahunPerolehan].[NomorRegister]
 * Example: 02.01.01.22.2026.0001 s/d 02.01.01.22.2026.0005 (jika membeli 5 unit di Desa Togideu tahun 2026)
 *
 * Penomoran nomor register terisolasi per tahun pengadaan (perolehan):
 * - Tahun 2025 tersusun dari 0001 sampai selesai
 * - Tahun 2026 tersusun dari 0001 sampai selesai
 * Sehingga jika desa menginput tahun 2026 terlebih dahulu lalu menginput tahun 2025,
 * nomor register tahun 2025 tetap mulai dari 0001 dan tidak terusan dari tahun lain.
 */
export function getDesaCodeNumber(desaId: string, desasList: Desa[] = []): string {
  const matchedDesa = desasList.find((d) => d && d.id === desaId);
  if (matchedDesa && matchedDesa.code) {
    const parts = matchedDesa.code.split('.');
    const last = parts[parts.length - 1];
    return last.length >= 2 ? last.slice(-2) : last.padStart(2, '0');
  }
  if (desaId && desaId.startsWith('desa-')) {
    return desaId.replace('desa-', '').padStart(2, '0');
  }
  return '01';
}

export function buildKodeAset(
  klasifikasi: KlasAset,
  desaId: string,
  tahunPerolehan: number,
  nomorRegister: string,
  desasList: Desa[] = []
): string {
  const prefix = KLASIFIKASI_KODE_PREFIX[klasifikasi] || '01.01.01';
  const desaCodeNumber = getDesaCodeNumber(desaId, desasList);
  const regPadded = String(parseInt(nomorRegister || '1', 10) || 1).padStart(4, '0');
  return `${prefix}.${desaCodeNumber}.${tahunPerolehan}.${regPadded}`;
}

export const generateSequentialKodeAset = (
  desaId: string,
  klasifikasi: KlasAset,
  count: number = 1,
  existingAsets: Aset[] = [],
  desasList: Desa[] = [],
  customStartSeq?: number,
  tahunPerolehan?: number
): GeneratedKodeAsetInfo[] => {
  const prefix = KLASIFIKASI_KODE_PREFIX[klasifikasi] || '01.01.01';
  const desaCodeNumber = getDesaCodeNumber(desaId, desasList);

  const effectiveYear =
    tahunPerolehan && Number(tahunPerolehan) >= 1970
      ? Number(tahunPerolehan)
      : new Date().getFullYear();

  const basePattern = `${prefix}.${desaCodeNumber}.${effectiveYear}.`;

  const usedSeqs = new Set<number>();
  let maxSeq = 0;

  for (const a of existingAsets) {
    if (a && a.desaId === desaId && a.status !== 'terhapus') {
      const aYear = a.tahunPerolehan ? Number(a.tahunPerolehan) : null;
      // Scoping nomor register strictly per tahun pengadaan / perolehan
      if (aYear === effectiveYear) {
        if (a.nomorRegister) {
          const regNum = parseInt(a.nomorRegister, 10);
          if (!isNaN(regNum) && regNum > 0) {
            usedSeqs.add(regNum);
            if (regNum > maxSeq) maxSeq = regNum;
          }
        }
        if (a.kodeAset) {
          const trimmed = a.kodeAset.trim();
          if (trimmed.startsWith(basePattern)) {
            const parts = trimmed.split('.');
            const lastPart = parts[parts.length - 1];
            const num = parseInt(lastPart, 10);
            if (!isNaN(num) && num > 0) {
              usedSeqs.add(num);
              if (num > maxSeq) maxSeq = num;
            }
          } else {
            // If code ends with .XXXX (3-5 digits)
            const match = trimmed.match(/\.(\d{3,5})$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num) && num > 0) {
                usedSeqs.add(num);
                if (num > maxSeq) maxSeq = num;
              }
            }
          }
        }
      }
    }
  }

  const validCount = Math.max(1, Math.min(count, 500));
  const results: GeneratedKodeAsetInfo[] = [];

  let candidateSeq =
    typeof customStartSeq === 'number' && customStartSeq > 0
      ? Math.max(1, Math.floor(customStartSeq))
      : maxSeq + 1;

  for (let i = 0; i < validCount; i++) {
    // KUNCI ANTI-DUPLIKAT: selalu lewati nomor register yang sudah terpakai
    while (usedSeqs.has(candidateSeq)) {
      candidateSeq++;
    }
    usedSeqs.add(candidateSeq);
    const registerStr = String(candidateSeq).padStart(4, '0');
    results.push({
      kodeAset: `${basePattern}${registerStr}`,
      nomorRegister: registerStr,
      sequenceNumber: candidateSeq,
    });
    candidateSeq++;
  }

  return results;
};

export interface PriceDistributionSummary {
  prices: number[];
  basePrice: number;
  adjustedPrice: number;
  baseCount: number;
  adjustedCount: number;
  remainder: number;
  totalRounded: number;
}

/**
 * Membagi total harga perolehan secara merata ke N unit aset.
 * Jika pembagian menghasilkan angka di belakang koma (sisa pembagian > 0),
 * selisihnya ditambahkan (+Rp 1 per unit) pada unit-unit aset terakhir
 * sehingga total seluruh unit tetap sama persis dengan total harga pembelian.
 *
 * Contoh: Total 48 unit dengan total harga Rp 2.500.000:
 * - basePrice = Math.floor(2500000 / 48) = 52.083
 * - remainder = 2500000 % 48 = 16
 * - 32 unit pertama bernilai Rp 52.083
 * - 16 unit terakhir bernilai Rp 52.084
 * - Total = (32 × 52.083) + (16 × 52.084) = 1.666.656 + 833.344 = 2.500.000
 */
export const distributeTotalPrice = (
  totalNilai: number,
  count: number
): PriceDistributionSummary => {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const totalRounded = Math.max(0, Math.round(Number(totalNilai) || 0));

  if (safeCount === 1) {
    return {
      prices: [totalRounded],
      basePrice: totalRounded,
      adjustedPrice: totalRounded,
      baseCount: 1,
      adjustedCount: 0,
      remainder: 0,
      totalRounded,
    };
  }

  const basePrice = Math.floor(totalRounded / safeCount);
  const remainder = totalRounded - basePrice * safeCount;
  const baseCount = safeCount - remainder;
  const adjustedCount = remainder;
  const adjustedPrice = remainder > 0 ? basePrice + 1 : basePrice;

  const prices = Array.from({ length: safeCount }, (_, idx) =>
    idx < baseCount ? basePrice : adjustedPrice
  );

  return {
    prices,
    basePrice,
    adjustedPrice,
    baseCount,
    adjustedCount,
    remainder,
    totalRounded,
  };
};

export const generateAutoKodeAset = (
  desaId: string,
  klasifikasi: KlasAset,
  existingAsets: Aset[] = [],
  desasList: Desa[] = [],
  customStartSeq?: number,
  tahunPerolehan?: number
): string => {
  const list = generateSequentialKodeAset(
    desaId,
    klasifikasi,
    1,
    existingAsets,
    desasList,
    customStartSeq,
    tahunPerolehan
  );
  const targetYear =
    tahunPerolehan && Number(tahunPerolehan) >= 1970
      ? Number(tahunPerolehan)
      : new Date().getFullYear();
  return list[0]?.kodeAset || `${KLASIFIKASI_KODE_PREFIX[klasifikasi] || '01.01.01'}.01.${targetYear}.0001`;
};

/**
 * Normalizes asset registration numbers and codes without shifting existing valid unique registers:
 * 1. Within each active (desaId, tahunPerolehan) group, keeps the earliest asset for each valid positive nomorRegister.
 * 2. Only assets with missing/invalid (<= 0) or colliding duplicate nomorRegister are assigned the next free sequential number (maxSeq + 1, ...).
 * 3. Ensures each asset's kodeAset matches [Golongan.Bidang.Kelompok].[KodeDesa].[TahunPerolehan].[NomorRegister].
 */
export function normalizeAsetRegisters(
  list: Aset[],
  desasList: Desa[] = []
): { asets: Aset[]; changed: boolean; changedIds: string[]; fixedCount: number } {
  if (!Array.isArray(list)) return { asets: [], changed: false, changedIds: [], fixedCount: 0 };
  let hasChanged = false;
  const changedIds: string[] = [];

  // Group active assets by desaId, then by tahunPerolehan
  const byDesaYear = new Map<string, Aset[]>();
  list.forEach((item) => {
    if (!item || item.status === 'terhapus') return;
    const dId = item.desaId || 'unknown';
    const yr = Number(item.tahunPerolehan) || new Date().getFullYear();
    const key = `${dId}_${yr}`;
    if (!byDesaYear.has(key)) byDesaYear.set(key, []);
    byDesaYear.get(key)!.push(item);
  });

  const updatedMap = new Map<string, Aset>();

  byDesaYear.forEach((groupItems) => {
    // Deterministic sort by existing nomorRegister -> createdAt -> id
    const sorted = [...groupItems].sort((a, b) => {
      const regA = parseInt(a.nomorRegister || '0', 10) || 0;
      const regB = parseInt(b.nomorRegister || '0', 10) || 0;
      if (regA !== regB) return regA - regB;
      const cmpCreated = (a.createdAt || '').localeCompare(b.createdAt || '');
      if (cmpCreated !== 0) return cmpCreated;
      return (a.id || '').localeCompare(b.id || '');
    });

    const usedRegs = new Set<number>();
    let maxReg = 0;

    // First pass: find max valid register in group
    for (const item of sorted) {
      const regNum = parseInt(item.nomorRegister || '0', 10);
      if (!isNaN(regNum) && regNum > maxReg) {
        maxReg = regNum;
      }
    }

    // Second pass: keep first valid owner for each register, reassign only invalid (<= 0) or colliding duplicates
    sorted.forEach((item) => {
      let targetSeq = parseInt(item.nomorRegister || '0', 10);
      if (isNaN(targetSeq) || targetSeq <= 0 || usedRegs.has(targetSeq)) {
        targetSeq = maxReg + 1;
        while (usedRegs.has(targetSeq)) {
          targetSeq++;
        }
      }
      usedRegs.add(targetSeq);
      if (targetSeq > maxReg) maxReg = targetSeq;

      const targetRegStr = String(targetSeq).padStart(4, '0');
      const targetYear = Number(item.tahunPerolehan) || new Date().getFullYear();
      const targetKode = buildKodeAset(item.klasifikasi, item.desaId, targetYear, targetRegStr, desasList);

      const regMatches = item.nomorRegister === targetRegStr;
      const kodeMatches = item.kodeAset === targetKode;

      if (!regMatches || !kodeMatches) {
        hasChanged = true;
        changedIds.push(item.id);
        updatedMap.set(item.id, {
          ...item,
          nomorRegister: targetRegStr,
          kodeAset: targetKode,
        });
      } else {
        updatedMap.set(item.id, item);
      }
    });
  });

  const result = list.map((item) => (item ? updatedMap.get(item.id) || item : item));
  return { asets: result, changed: hasChanged, changedIds, fixedCount: changedIds.length };
}

/**
 * Enforce unique nomorRegister & synchronized kodeAset for newly added assets
 * against existing assets in the same (desaId, tahunPerolehan) as well as sibling items in the batch.
 */
export function ensureUniqueRegistersForNewAsets(
  newItems: Aset[],
  existingAsets: Aset[],
  desasList: Desa[] = []
): Aset[] {
  const usedByGroup = new Map<string, Set<number>>();
  const maxByGroup = new Map<string, number>();

  for (const a of existingAsets) {
    if (!a || a.status === 'terhapus') continue;
    const yr = Number(a.tahunPerolehan) || new Date().getFullYear();
    const key = `${a.desaId || 'unknown'}_${yr}`;
    if (!usedByGroup.has(key)) usedByGroup.set(key, new Set<number>());
    const set = usedByGroup.get(key)!;
    const regNum = parseInt(a.nomorRegister || '0', 10);
    if (!isNaN(regNum) && regNum > 0) {
      set.add(regNum);
      if (regNum > (maxByGroup.get(key) || 0)) maxByGroup.set(key, regNum);
    }
    const codeMatch = (a.kodeAset || '').trim().match(/\.(\d{3,5})$/);
    if (codeMatch) {
      const codeNum = parseInt(codeMatch[1], 10);
      if (!isNaN(codeNum) && codeNum > 0) {
        set.add(codeNum);
        if (codeNum > (maxByGroup.get(key) || 0)) maxByGroup.set(key, codeNum);
      }
    }
  }

  return newItems.map((item) => {
    const yr = Number(item.tahunPerolehan) || new Date().getFullYear();
    const key = `${item.desaId || 'unknown'}_${yr}`;
    if (!usedByGroup.has(key)) usedByGroup.set(key, new Set<number>());
    const usedSet = usedByGroup.get(key)!;
    let curMax = maxByGroup.get(key) || 0;

    let reqSeq = parseInt(item.nomorRegister || '0', 10);
    if (isNaN(reqSeq) || reqSeq <= 0 || usedSet.has(reqSeq)) {
      reqSeq = curMax + 1;
      while (usedSet.has(reqSeq)) {
        reqSeq++;
      }
    }
    usedSet.add(reqSeq);
    if (reqSeq > curMax) maxByGroup.set(key, reqSeq);

    const regStr = String(reqSeq).padStart(4, '0');
    const kodeAset = buildKodeAset(item.klasifikasi, item.desaId, yr, regStr, desasList);
    return {
      ...item,
      nomorRegister: regStr,
      kodeAset,
    };
  });
}

/**
 * Enforce unique nomorRegister & synchronized kodeAset when updating an existing asset
 * (prevents collisions when changing tahunPerolehan, desaId, klasifikasi, or kodeAset).
 */
export function ensureUniqueRegisterOnUpdate(
  updatedItem: Aset,
  allAsets: Aset[],
  desasList: Desa[] = []
): Aset {
  if (updatedItem.status === 'terhapus') return updatedItem;

  const yr = Number(updatedItem.tahunPerolehan) || new Date().getFullYear();
  const usedSet = new Set<number>();
  let maxSeq = 0;

  for (const a of allAsets) {
    if (!a || a.id === updatedItem.id || a.status === 'terhapus') continue;
    if (a.desaId !== updatedItem.desaId) continue;
    const aYr = Number(a.tahunPerolehan) || new Date().getFullYear();
    if (aYr !== yr) continue;

    const regNum = parseInt(a.nomorRegister || '0', 10);
    if (!isNaN(regNum) && regNum > 0) {
      usedSet.add(regNum);
      if (regNum > maxSeq) maxSeq = regNum;
    }
    const codeMatch = (a.kodeAset || '').trim().match(/\.(\d{3,5})$/);
    if (codeMatch) {
      const codeNum = parseInt(codeMatch[1], 10);
      if (!isNaN(codeNum) && codeNum > 0) {
        usedSet.add(codeNum);
        if (codeNum > maxSeq) maxSeq = codeNum;
      }
    }
  }

  let targetSeq = parseInt(updatedItem.nomorRegister || '0', 10);
  if (isNaN(targetSeq) || targetSeq <= 0) {
    const codeMatch = (updatedItem.kodeAset || '').trim().match(/\.(\d{3,5})$/);
    if (codeMatch) {
      targetSeq = parseInt(codeMatch[1], 10) || 0;
    }
  }

  if (isNaN(targetSeq) || targetSeq <= 0 || usedSet.has(targetSeq)) {
    targetSeq = maxSeq + 1;
    while (usedSet.has(targetSeq)) {
      targetSeq++;
    }
  }

  const regStr = String(targetSeq).padStart(4, '0');
  const kodeAset = buildKodeAset(updatedItem.klasifikasi, updatedItem.desaId, yr, regStr, desasList);
  return {
    ...updatedItem,
    nomorRegister: regStr,
    kodeAset,
  };
}

export interface DuplicateRegisterGroup {
  key: string;
  desaId: string;
  tahun: number;
  nomorRegister: string;
  items: Aset[];
}

export function findDuplicateRegisters(list: Aset[]): DuplicateRegisterGroup[] {
  const byKey = new Map<string, Aset[]>();
  for (const item of list) {
    if (!item || item.status === 'terhapus') continue;
    const yr = Number(item.tahunPerolehan) || new Date().getFullYear();
    const reg = String(parseInt(item.nomorRegister || '0', 10) || 0).padStart(4, '0');
    const key = `${item.desaId || 'unknown'}_${yr}_${reg}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(item);
  }

  const duplicates: DuplicateRegisterGroup[] = [];
  byKey.forEach((items, key) => {
    const first = items[0];
    const yr = Number(first.tahunPerolehan) || new Date().getFullYear();
    const reg = String(parseInt(first.nomorRegister || '0', 10) || 0).padStart(4, '0');
    if (items.length > 1 || reg === '0000') {
      duplicates.push({
        key,
        desaId: first.desaId,
        tahun: yr,
        nomorRegister: reg,
        items,
      });
    }
  });
  return duplicates;
}

export interface PermendagriPdfOptions {
  desa?: Desa;
  allDesas?: Desa[];
  isAllDesaMode?: boolean;
  year: number;
  asets: Aset[];
  isPrintedByAdmin?: boolean;
  tanggalCetak?: string | Date;
  camatName?: string;
  camatPangkat?: string;
  camatNip?: string;
  alamatKecamatan?: string;
  tempatSurat?: string;
  emailKecamatan?: string;
  kodePosKecamatan?: string;
}

export const generatePermendagriPDF = async (options: PermendagriPdfOptions): Promise<jsPDF> => {
  const {
    desa,
    allDesas = [],
    isAllDesaMode = false,
    year,
    asets,
    isPrintedByAdmin = false,
    tanggalCetak = '2026-12-31',
    camatName = 'MESRAWAN HAREFA, S.Pd., M.M.',
    camatPangkat = 'Pembina, IV/a',
    camatNip = '19780512 200501 1 008',
    alamatKecamatan = 'Alamat : Tetesua Desa Tegideu Kec. Sirombu Kabupaten Nias Barat',
    tempatSurat = 'Tetesua',
    kodePosKecamatan = '22863',
  } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const fontList = doc.getFontList();
  if (fontList && fontList.helvetica) {
    fontList.arial = fontList.helvetica;
    fontList.Arial = fontList.Helvetica;
  }

  // Retrieve Nias Barat Logo data URL
  const logoDataUrl = await getNiasBaratLogoDataUrl();

  const centerX = 154;
  let lineY = 25.5;

  if (isPrintedByAdmin) {
    // =========================================================================
    // KOP SURAT ADMIN / SUPER ADMIN (KECAMATAN SIROMBU)
    // =========================================================================
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 16, 5, 20, 20);
    } else {
      doc.setFillColor(238, 0, 0);
      doc.roundedRect(16, 5, 20, 20, 2, 2, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('PEMERINTAH KABUPATEN NIAS BARAT', centerX, 9.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('KECAMATAN SIROMBU', centerX, 15.5, { align: 'center' });

    if (isAllDesaMode) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text(`Alamat : ${alamatKecamatan} KP. ${kodePosKecamatan}`, centerX, 20.5, { align: 'center' });
      lineY = 24;
    } else {
      const namaDesaClean = desa?.name.toUpperCase().startsWith('DESA ')
        ? desa.name.toUpperCase()
        : `DESA ${desa?.name.toUpperCase() || ''}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(namaDesaClean, centerX, 20.5, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      const properDesaFallback = desa?.name
        ? `${desa.name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Kecamatan Sirombu Kabupaten Nias Barat`
        : 'Desa Sirombu Kecamatan Sirombu Kabupaten Nias Barat';
      const alamatDesaText = desa?.alamatDesa ? (desa.alamatDesa.startsWith('Alamat') ? desa.alamatDesa : `Alamat : ${desa.alamatDesa}`) : `Alamat : ${properDesaFallback}`;
      const emailDesaPart = desa?.emailDesa && desa.emailDesa.trim() ? `      Email : ${desa.emailDesa.trim()},` : '';
      doc.text(`${alamatDesaText}${emailDesaPart}      KP. ${desa?.kodePos || '22863'}`, centerX, 24.5, { align: 'center' });
      lineY = 27.5;
    }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.85);
    doc.line(14, lineY, 283, lineY);
    doc.setLineWidth(0.25);
    doc.line(14, lineY + 0.8, 283, lineY + 0.8);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const yearLabel = !year || year === 0 ? 'SELURUH TAHUN ANGGARAN' : `PER 31 DESEMBER ${year}`;
    const titleText = isAllDesaMode
      ? `REKAPITULASI ASET TETAP DESA SE-KECAMATAN SIROMBU ${yearLabel}`
      : `RINCIAN ASET TETAP DESA ${yearLabel}`;
    doc.text(titleText, 148.5, 33.5, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(
      '(Format Standar Berdasarkan Lampiran Permendagri Nomor 20 Tahun 2018 tentang Pengelolaan Keuangan & Aset Desa)',
      148.5,
      37.5,
      { align: 'center' }
    );
  } else {
    // =========================================================================
    // KOP SURAT AKUN DESA
    // =========================================================================
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 16, 5, 20, 20);
    } else {
      doc.setFillColor(238, 0, 0);
      doc.roundedRect(16, 5, 20, 20, 2, 2, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(0, 0, 0);
    doc.text('PEMERINTAH KABUPATEN NIAS BARAT', centerX, 9.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text('KECAMATAN SIROMBU', centerX, 15, { align: 'center' });

    const namaDesaClean = (desa?.name || '').toUpperCase().startsWith('DESA ')
      ? (desa?.name || '').toUpperCase()
      : `DESA ${(desa?.name || '').toUpperCase()}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(namaDesaClean, centerX, 20.5, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    const alamatDesaText = desa?.alamatDesa || `${namaDesaClean.toLowerCase().replace('desa ', 'Desa ')} Kecamatan Sirombu Kabupaten Nias Barat`;
    const emailDesaPart = desa?.emailDesa && desa.emailDesa.trim() ? `      Email : ${desa.emailDesa.trim()},` : '';
    const kodePosText = desa?.kodePos ? `KP. ${desa.kodePos}` : 'KP. 22863';

    doc.text(
      `Alamat : ${alamatDesaText}${emailDesaPart}      ${kodePosText}`,
      centerX,
      24.5,
      { align: 'center' }
    );

    // Double border line
    lineY = 27.5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.85);
    doc.line(14, lineY, 283, lineY);
    doc.setLineWidth(0.25);
    doc.line(14, lineY + 0.8, 283, lineY + 0.8);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    const yearLabelDesa = !year || year === 0 ? 'SELURUH TAHUN ANGGARAN' : `PER 31 DESEMBER ${year}`;
    doc.text(`RINCIAN ASET TETAP DESA ${yearLabelDesa}`, 148.5, 33.5, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(
      '(Format Standar Berdasarkan Lampiran Permendagri Nomor 20 Tahun 2018 tentang Pengelolaan Keuangan & Aset Desa)',
      148.5,
      37.5,
      { align: 'center' }
    );
  }

  // BUILD TABLE BODY
  const tableBody: any[] = [];
  let grandTotal = 0;

  if (isAllDesaMode && allDesas.length > 0) {
    // =========================================================================
    // MODE SEMUA DESA (ASET DIKELOMPOKKAN SESUAI DESA)
    // =========================================================================
    allDesas.forEach((d, dIdx) => {
      const activeDesaAsets = asets.filter(
        (a) => a.desaId === d.id && (!year || year === 0 ? true : a.tahunPerolehan === year) && a.status !== 'terhapus'
      );
      const desaTotal = activeDesaAsets.reduce((sum, a) => sum + (a.nilaiPerolehan || 0), 0);
      grandTotal += desaTotal;

      // Header Row for the Village
      tableBody.push([
        {
          content: `${dIdx + 1}. DESA ${d.name.toUpperCase().replace(/^DESA\s+/i, '')} (Kode: ${d.code}) - Kepala Desa: ${d.kepalaDesa || '-'}`,
          colSpan: 7,
          styles: { font: 'helvetica', fontStyle: 'bold', fillColor: [215, 228, 245], textColor: [15, 23, 42] },
        },
        {
          content: formatNumber(desaTotal),
          styles: { font: 'helvetica', fontStyle: 'bold', halign: 'right', fillColor: [215, 228, 245], textColor: [15, 23, 42] },
        },
        {
          content: '',
          colSpan: 2,
          styles: { fillColor: [215, 228, 245] },
        },
      ]);

      // If village has no assets
      if (activeDesaAsets.length === 0) {
        tableBody.push([
          { content: '-', styles: { halign: 'center', textColor: [140, 140, 140] } },
          { content: 'Belum ada aset tetap tercatat pada tahun anggaran ini', styles: { fontStyle: 'italic', textColor: [140, 140, 140] } },
          { content: '-', styles: { halign: 'center' } },
          { content: '-', styles: { halign: 'center' } },
          { content: '-', styles: { halign: 'center' } },
          { content: '-', styles: { halign: 'center' } },
          { content: '-', styles: { halign: 'center' } },
          { content: '0', styles: { halign: 'right' } },
          { content: '-', styles: { halign: 'center' } },
          { content: '-', styles: { halign: 'left' } },
        ]);
      } else {
        // Group by classification inside this village
        ROMAN_KLASIFIKASI.forEach((cat) => {
          const catAsets = activeDesaAsets.filter(
            (a) => (a.klasifikasi || '').replace(/^[I|V|X]+\.\s*/, '') === cat.key
          );
          if (catAsets.length > 0) {
            const catSubtotal = catAsets.reduce((sum, a) => sum + (a.nilaiPerolehan || 0), 0);
            tableBody.push([
              { content: cat.roman, styles: { font: 'helvetica', fontStyle: 'bold', halign: 'center', fillColor: [243, 244, 246] } },
              { content: cat.title, styles: { font: 'helvetica', fontStyle: 'bold', fillColor: [243, 244, 246] }, colSpan: 6 },
              { content: formatNumber(catSubtotal), styles: { font: 'helvetica', fontStyle: 'bold', halign: 'right', fillColor: [243, 244, 246] } },
              { content: '', styles: { fillColor: [243, 244, 246] }, colSpan: 2 },
            ]);

            catAsets.forEach((item, idx) => {
              tableBody.push([
                { content: '', styles: { halign: 'center' } },
                { content: `${idx + 1}. ${item.namaAset} ${item.volume ? `(${item.volume})` : ''}`, styles: { font: 'helvetica' } },
                { content: item.bukti?.jenis || '-', styles: { font: 'helvetica', halign: 'center' } },
                { content: item.bukti?.nomor || '-', styles: { font: 'helvetica', halign: 'center' } },
                { content: item.bukti?.tanggal || '-', styles: { font: 'helvetica', halign: 'center' } },
                { content: item.kodeAset || '-', styles: { font: 'helvetica', halign: 'center' } },
                { content: item.tahunPerolehan.toString(), styles: { halign: 'center' } },
                { content: formatNumber(item.nilaiPerolehan), styles: { halign: 'right' } },
                { content: item.kondisi, styles: { halign: 'center' } },
                { content: formatKeteranganWithSpecs(item), styles: { font: 'helvetica' } },
              ]);
            });
          }
        });
      }
    });
  } else {
    // =========================================================================
    // MODE DESA TUNGGAL (FORMAT 10 KOLOM RESMI - HANYA DATA YANG ADA TANPA DST)
    // =========================================================================
    const activeAsets = asets.filter(
      (a) => a.desaId === desa?.id && (!year || year === 0 ? true : a.tahunPerolehan === year) && a.status !== 'terhapus'
    );

    if (activeAsets.length === 0) {
      tableBody.push([
        { content: '-', styles: { halign: 'center', textColor: [140, 140, 140] } },
        {
          content: 'Belum ada data aset tetap yang tercatat pada tahun anggaran ini',
          colSpan: 6,
          styles: { fontStyle: 'italic', textColor: [140, 140, 140] },
        },
        { content: '0', styles: { halign: 'right' } },
        { content: '-', styles: { halign: 'center' } },
        { content: '-', styles: { halign: 'left' } },
      ]);
    } else {
      ROMAN_KLASIFIKASI.forEach((cat) => {
        const catAsets = activeAsets.filter(
          (a) => (a.klasifikasi || '').replace(/^[I|V|X]+\.\s*/, '') === cat.key
        );
        if (catAsets.length > 0) {
          const subtotal = catAsets.reduce((sum, a) => sum + (a.nilaiPerolehan || 0), 0);
          grandTotal += subtotal;

          // Header baris klasifikasi Romawi (misal: I. TANAH)
          tableBody.push([
            { content: cat.roman, styles: { font: 'helvetica', fontStyle: 'bold', halign: 'center', fillColor: [243, 244, 246] } },
            { content: cat.title, styles: { font: 'helvetica', fontStyle: 'bold', fillColor: [243, 244, 246] }, colSpan: 6 },
            { content: formatNumber(subtotal), styles: { font: 'helvetica', fontStyle: 'bold', halign: 'right', fillColor: [243, 244, 246] } },
            { content: '', styles: { fillColor: [243, 244, 246] }, colSpan: 2 },
          ]);

          // Masukkan seluruh aset di kelompok ini secara lengkap tanpa tulisan dst
          catAsets.forEach((item, index) => {
            tableBody.push([
              { content: '', styles: { halign: 'center' } },
              { content: `${index + 1}. ${item.namaAset} ${item.volume ? `(${item.volume})` : ''}`, styles: { font: 'helvetica' } },
              { content: item.bukti?.jenis || '-', styles: { font: 'helvetica', halign: 'center' } },
              { content: item.bukti?.nomor || '-', styles: { font: 'helvetica', halign: 'center' } },
              { content: item.bukti?.tanggal || '-', styles: { font: 'helvetica', halign: 'center' } },
              { content: item.kodeAset || '-', styles: { font: 'helvetica', halign: 'center' } },
              { content: item.tahunPerolehan.toString(), styles: { halign: 'center' } },
              { content: formatNumber(item.nilaiPerolehan), styles: { halign: 'right' } },
              { content: item.kondisi, styles: { halign: 'center' } },
              { content: formatKeteranganWithSpecs(item), styles: { font: 'helvetica' } },
            ]);
          });
        }
      });
    }
  }

  // Grand Total Row
  const totalLabel = isAllDesaMode
    ? `TOTAL KESELURUHAN ASET DESA SE-KECAMATAN SIROMBU (25 DESA) ${!year || year === 0 ? '(SELURUH TAHUN ANGGARAN)' : `PER 31 DESEMBER ${year}`}`
    : `Total Nilai Aset Tetap ${!year || year === 0 ? '(Seluruh Tahun Anggaran)' : `per 31 Desember ${year}`}`;

  tableBody.push([
    {
      content: totalLabel,
      colSpan: 7,
      styles: { font: 'helvetica', fontStyle: 'bold', halign: 'left', fillColor: [230, 238, 248], textColor: [0, 0, 0] },
    },
    {
      content: formatNumber(grandTotal),
      styles: { font: 'helvetica', fontStyle: 'bold', halign: 'right', fillColor: [230, 238, 248], textColor: [0, 0, 0] },
    },
    {
      content: '',
      colSpan: 2,
      styles: { fillColor: [230, 238, 248] },
    },
  ]);

  // 10 COLUMNS HEADER MATCHING TEMPLATE
  autoTable(doc, {
    startY: 42,
    head: [
      [
        { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Klas Aset dan Nama/Identitas Aset Tetap', rowSpan: 2, styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Bukti Kepemilikan', colSpan: 3, styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Kode Aset Tetap', rowSpan: 2, styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Tahun\nPerolehan', rowSpan: 2, styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Nilai\nPerolehan', rowSpan: 2, styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Kondisi\nAset', rowSpan: 2, styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Keterangan\n(Lokasi dan ...)', rowSpan: 2, styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
      ],
      [
        { content: 'Jenis', styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Nomor', styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
        { content: 'Tanggal', styles: { halign: 'center', valign: 'middle', font: 'helvetica' } },
      ],
    ],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: 1.2,
      textColor: [20, 20, 20],
      lineColor: [120, 120, 120],
      lineWidth: 0.15,
    },
    headStyles: {
      font: 'helvetica',
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7.5,
      lineWidth: 0.2,
      lineColor: [60, 60, 60],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 62 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 30, halign: 'right' },
      8: { cellWidth: 18, halign: 'center' },
      9: { cellWidth: 'auto' },
    },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(
        '*) Sesuai Lampiran Permendagri No. 20 Tahun 2018 tentang Pengelolaan Keuangan & Aset Desa',
        14,
        202
      );
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Halaman ${data.pageNumber}`,
        283,
        202,
        { align: 'right' }
      );
    },
  });

  // SIGNATURE BLOCK (SISI KANAN)
  const finalY = (doc as any).lastAutoTable?.finalY || 160;
  let signatureY = finalY + 8;
  if (signatureY > 165) {
    doc.addPage();
    signatureY = 25;
  }

  const tanggalCetakFormatted = formatTanggalIndonesia(tanggalCetak);
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);

  if (isPrintedByAdmin) {
    // Skenario Akun Admin / Super Admin: Ditandatangani oleh CAMAT SIROMBU di sisi kanan
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`${tempatSurat || 'Tetesua'}, ${tanggalCetakFormatted}`, 235, signatureY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text('CAMAT SIROMBU,', 235, signatureY + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(camatName, 235, signatureY + 25, { align: 'center' });
    const camatTextWidth = doc.getTextWidth(camatName);
    doc.setLineWidth(0.3);
    doc.line(235 - camatTextWidth / 2, signatureY + 26, 235 + camatTextWidth / 2, signatureY + 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(camatPangkat, 235, signatureY + 30, { align: 'center' });
    doc.text(`NIP. ${camatNip}`, 235, signatureY + 34, { align: 'center' });
  } else {
    // Skenario Akun Desa: Ditandatangani oleh KEPALA DESA / PJ. KEPALA DESA di sisi kanan
    const namaDesaTitleCase = formatNamaDesaTitleCase(desa?.name);
    const hasNip = Boolean(
      desa?.nipKepalaDesa &&
      desa.nipKepalaDesa.trim() !== '' &&
      desa.nipKepalaDesa.trim() !== '-' &&
      desa.nipKepalaDesa.trim() !== 'NIP. -'
    );
    const jabatanKades = hasNip ? `Pj. Kepala Desa ${namaDesaTitleCase}` : `Kepala Desa ${namaDesaTitleCase}`;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`${namaDesaTitleCase}, ${tanggalCetakFormatted}`, 235, signatureY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(jabatanKades, 235, signatureY + 4.5, { align: 'center' });

    const kadesName = desa?.kepalaDesa || '...........................................';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(kadesName, 235, signatureY + 25, { align: 'center' });
    const kadesTextWidth = doc.getTextWidth(kadesName);
    doc.setLineWidth(0.3);
    doc.line(235 - kadesTextWidth / 2, signatureY + 26, 235 + kadesTextWidth / 2, signatureY + 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const nipText = hasNip ? `NIP. ${desa!.nipKepalaDesa!.trim()}` : 'NIP. -';
    doc.text(nipText, 235, signatureY + 30, { align: 'center' });
  }

  return doc;
};

export const exportToPermendagriPDF = async (
  desaOrOptions: Desa | PermendagriPdfOptions,
  year?: number,
  asets?: Aset[],
  isPrintedByAdmin: boolean = false,
  camatName: string = 'MESRAWAN HAREFA, S.Pd., M.M.',
  camatNip: string = '19780512 200501 1 008',
  camatPangkat: string = 'Pembina, IV/a',
  tanggalCetak?: string | Date
) => {
  let options: PermendagriPdfOptions;
  if ('id' in (desaOrOptions as any) && 'name' in (desaOrOptions as any)) {
    options = {
      desa: desaOrOptions as Desa,
      year: typeof year === 'number' ? year : 0,
      asets: asets || [],
      isPrintedByAdmin,
      camatName,
      camatNip,
      camatPangkat,
      tanggalCetak: tanggalCetak || '2026-12-31',
    };
  } else {
    options = desaOrOptions as PermendagriPdfOptions;
  }

  const doc = await generatePermendagriPDF(options);
  const prefix = options.isAllDesaMode
    ? 'Laporan_Rekapitulasi_Aset_Semua_Desa_Sirombu'
    : `Laporan_Aset_${options.desa?.name?.replace(/\s+/g, '_') || 'Desa'}`;
  doc.save(`${prefix}_Permendagri_20_2018_${options.year}.pdf`);
};

export const exportToCSV = (desa: Desa, year: number, asets: Aset[]) => {
  const activeAsets = asets.filter(
    (a) => a.desaId === desa.id && (!year || year === 0 ? true : a.tahunPerolehan === year) && a.status !== 'terhapus'
  );

  const yearTitle = !year || year === 0 ? 'Seluruh Tahun Anggaran' : `per 31 Desember ${year}`;
  let csvContent = `PEMERINTAH ${desa.name}\n`;
  csvContent += `Kecamatan Sirombu, Kabupaten Nias Barat\n`;
  csvContent += `Rincian Aset Tetap Desa ${yearTitle}\n`;
  csvContent += `Sesuai Format Lampiran Permendagri Nomor 20 Tahun 2018\n\n`;
  csvContent += `No,Klasifikasi Aset,Nama / Identitas Aset,Bukti Kepemilikan Jenis,Nomor Bukti,Tanggal Bukti,Kode Aset Tetap,Tahun Perolehan,Nilai Perolehan (Rp),Kondisi,Sumber Dana,Lokasi/Volume,Keterangan\n`;

  let rowCounter = 1;
  KLASIFIKASI_LIST.forEach((klas) => {
    const items = activeAsets.filter(
      (a) => (a.klasifikasi || '').replace(/^[I|V|X]+\.\s*/, '') === klas
    );
    items.forEach((item) => {
      const cleanName = `"${(item.namaAset || '').replace(/"/g, '""')}"`;
      const cleanJenis = `"${(item.bukti?.jenis || '').replace(/"/g, '""')}"`;
      const cleanNo = `"${(item.bukti?.nomor || '').replace(/"/g, '""')}"`;
      const cleanTgl = `"${(item.bukti?.tanggal || '').replace(/"/g, '""')}"`;
      const cleanKet = `"${(formatKeteranganWithSpecs(item) || '').replace(/"/g, '""')}"`;
      const cleanLokasi = `"${(item.lokasi || item.volume || '').replace(/"/g, '""')}"`;

      csvContent += `${rowCounter},"${klas}",${cleanName},${cleanJenis},${cleanNo},${cleanTgl},"${item.kodeAset}",${item.tahunPerolehan},${item.nilaiPerolehan},"${item.kondisi}","${item.sumberDana}",${cleanLokasi},${cleanKet}\n`;
      rowCounter++;
    });
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanDesaName = (desa?.name || 'Desa').replace(/\s+/g, '_');
  link.setAttribute('download', `Rincian_Aset_${cleanDesaName}_${year}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
