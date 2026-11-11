import { Aset, Desa, KecamatanProfile, PengesahanLaporan, PermohonanVerifikasi, User } from '../types';

export const STORAGE_KEY_CPANEL_ENDPOINT = 'SIPADES_CPANEL_ENDPOINT';

export function getCpanelEndpoint(): string {
  if (typeof window !== 'undefined') {
    // If running on domain sipadessirombu.my.id (production on cPanel)
    if (window.location.hostname.includes('sipadessirombu')) {
      return '/cpanel-api.php';
    }
    const saved = localStorage.getItem(STORAGE_KEY_CPANEL_ENDPOINT);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  }
  return 'https://sipadessirombu.my.id/cpanel-api.php';
}

export interface CpanelDatabase {
  asets: Aset[];
  desas?: Desa[];
  users?: User[];
  verifikasiList?: PermohonanVerifikasi[];
  pengesahanList?: PengesahanLaporan[];
  kecamatanProfile?: KecamatanProfile;
  updatedAt?: string;
}

export async function pingCpanel(): Promise<{ success: boolean; message: string; totalAset?: number }> {
  try {
    const ep = getCpanelEndpoint();
    const res = await fetch(`${ep}?action=ping`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      success: data.status === 'success',
      message: data.message || 'Koneksi cPanel berhasil',
      totalAset: data.totalAset,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal tersambung ke cPanel: ${err.message || 'Periksa jaringan'}`,
    };
  }
}

export async function fetchCpanelData(): Promise<CpanelDatabase | null> {
  // 1. Direct from cPanel endpoint
  try {
    const ep = getCpanelEndpoint();
    const res = await fetch(`${ep}?action=data`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.asets)) {
        return data as CpanelDatabase;
      }
    }
  } catch (err) {
    console.warn('[cPanel Service] Direct fetch note:', err);
  }

  // 2. Fallback via local Express proxy if available (during AI Studio preview)
  try {
    const localRes = await fetch('/api/data', { cache: 'no-store' });
    if (localRes.ok) {
      const cType = localRes.headers.get('content-type');
      if (cType && cType.includes('application/json')) {
        const localData = await localRes.json();
        if (localData && Array.isArray(localData.asets)) {
          return localData as CpanelDatabase;
        }
      }
    }
  } catch (err) {
    console.warn('[cPanel Service] Local proxy note:', err);
  }

  return null;
}

export async function saveAsetToCpanel(aset: Aset): Promise<boolean> {
  try {
    const ep = getCpanelEndpoint();
    const res = await fetch(`${ep}?action=save_aset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aset),
    });
    return res.ok;
  } catch (err) {
    console.warn('[cPanel Service] saveAsetToCpanel error:', err);
    return false;
  }
}

export async function deleteAsetFromCpanel(id: string): Promise<boolean> {
  try {
    const ep = getCpanelEndpoint();
    const res = await fetch(`${ep}?action=delete_aset&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[cPanel Service] deleteAsetFromCpanel error:', err);
    return false;
  }
}

export async function saveAllToCpanel(payload: Partial<CpanelDatabase>): Promise<{ success: boolean; message: string; totalAset?: number }> {
  try {
    const ep = getCpanelEndpoint();
    const res = await fetch(`${ep}?action=upload_all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payload }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      success: data.status === 'success',
      message: data.message || 'Data berhasil disimpan ke cPanel',
      totalAset: data.totalAset,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal upload ke cPanel: ${err.message || 'Periksa koneksi'}`,
    };
  }
}

export async function saveDesasToCpanel(desas: Desa[]): Promise<boolean> {
  const res = await saveAllToCpanel({ desas });
  return res.success;
}

export async function saveUsersToCpanel(users: User[]): Promise<boolean> {
  const res = await saveAllToCpanel({ users });
  return res.success;
}

export async function saveVerifikasiToCpanel(verifikasiList: PermohonanVerifikasi[]): Promise<boolean> {
  const res = await saveAllToCpanel({ verifikasiList });
  return res.success;
}

export async function savePengesahanToCpanel(pengesahanList: PengesahanLaporan[]): Promise<boolean> {
  const res = await saveAllToCpanel({ pengesahanList });
  return res.success;
}

export async function saveKecamatanToCpanel(kecamatanProfile: KecamatanProfile): Promise<boolean> {
  const res = await saveAllToCpanel({ kecamatanProfile });
  return res.success;
}

