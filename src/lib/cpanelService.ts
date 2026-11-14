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
  deletedIds?: string[];
  updatedAt?: string;
}

function sanitizeAsetForCpanel(aset: Aset): Record<string, any> {
  const cleanAset: Record<string, any> = { ...aset };
  if (Array.isArray(cleanAset.fotoAset)) {
    cleanAset.fotoAset = cleanAset.fotoAset.filter(
      (p: any) =>
        typeof p === 'string' &&
        (p.startsWith('/uploads/') || p.startsWith('http') || p.startsWith('data:image/'))
    );
  } else if (cleanAset.fotoAset === undefined || cleanAset.fotoAset === null) {
    cleanAset.fotoAset = [];
  }

  if (typeof cleanAset.fotoBast === 'string') {
    if (
      !cleanAset.fotoBast.startsWith('/uploads/') &&
      !cleanAset.fotoBast.startsWith('http') &&
      !cleanAset.fotoBast.startsWith('data:image/')
    ) {
      cleanAset.fotoBast = '';
    }
  } else {
    cleanAset.fotoBast = '';
  }

  return cleanAset;
}

export async function pingCpanel(customUrl?: string): Promise<{
  success: boolean;
  message: string;
  totalAset?: number;
  totalUnit?: number;
  activeAset?: number;
  pendingVerifikasi?: number;
  updatedAt?: string;
}> {
  const targetEndpoint = (customUrl && customUrl.trim()) || getCpanelEndpoint();
  const isProd = typeof window !== 'undefined' && window.location.hostname.includes('sipadessirombu');

  // If in dev preview, try server-to-server proxy first to bypass CORS/WAF
  if (!isProd) {
    try {
      const proxyRes = await fetch('/api/cpanel/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetEndpoint }),
        cache: 'no-store',
      });
      if (proxyRes.ok) {
        const pData = await proxyRes.json();
        if (pData && pData.success) {
          return {
            success: true,
            message: pData.message || 'Koneksi cPanel Web Hosting SIPADES Berhasil!',
            totalAset: pData.totalAset ?? pData.totalUnit ?? 0,
            totalUnit: pData.totalUnit ?? pData.totalAset ?? 0,
            activeAset: pData.activeAset ?? pData.totalAset ?? 0,
            pendingVerifikasi: pData.pendingVerifikasi,
            updatedAt: pData.updatedAt,
          };
        }
      }
    } catch {
      // fallback to direct fetch
    }
  }

  try {
    const sep = targetEndpoint.includes('?') ? '&' : '?';
    const res = await fetch(`${targetEndpoint}${sep}action=ping&_t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      success: data.status === 'success',
      message: data.message || 'Koneksi cPanel berhasil',
      totalAset: data.totalAset ?? data.totalUnit ?? 0,
      totalUnit: data.totalUnit ?? data.totalAset ?? 0,
      activeAset: data.activeAset ?? data.totalAset ?? 0,
      pendingVerifikasi: data.pendingVerifikasi,
      updatedAt: data.updatedAt,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal tersambung ke cPanel: ${err.message || 'Periksa jaringan'}`,
    };
  }
}

export async function fetchCpanelData(light: boolean = false): Promise<CpanelDatabase | null> {
  const lightParam = light ? '&light=1' : '';
  const isProd = typeof window !== 'undefined' && window.location.hostname.includes('sipadessirombu');

  // On production domain, direct same-origin cpanel-api.php is authoritative
  if (isProd) {
    try {
      const ep = getCpanelEndpoint();
      const res = await fetch(`${ep}?action=data${lightParam}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.asets) && data.asets.length > 0) {
          return data as CpanelDatabase;
        }
      }
    } catch (err) {
      console.warn('[cPanel Service] Direct prod fetch note:', err);
    }
  }

  // In dev preview (or fallback): server-to-server proxy (bypasses browser CORS & LiteSpeed WAF)
  try {
    const proxyRes = await fetch(`/api/cpanel/data?_t=${Date.now()}`, { cache: 'no-store' });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && Array.isArray(data.asets) && data.asets.length > 0) {
        return data as CpanelDatabase;
      }
    }
  } catch (err) {
    console.warn('[cPanel Service] Server cPanel proxy note:', err);
  }

  // Direct cross-origin fetch fallback
  if (!isProd) {
    try {
      const ep = getCpanelEndpoint();
      const res = await fetch(`${ep}?action=data${lightParam}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.asets) && data.asets.length > 0) {
          return data as CpanelDatabase;
        }
      }
    } catch (err) {
      console.warn('[cPanel Service] Direct fetch note:', err);
    }
  }

  // Fallback to local server database
  try {
    const localRes = await fetch('/api/data', { cache: 'no-store' });
    if (localRes.ok) {
      const cType = localRes.headers.get('content-type');
      if (cType && cType.includes('application/json')) {
        const localData = await localRes.json();
        if (localData && Array.isArray(localData.asets) && localData.asets.length > 0) {
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
  const cleanAset = sanitizeAsetForCpanel(aset);

  // 1. Direct browser fetch if on production domain
  try {
    const isProd = typeof window !== 'undefined' && window.location.hostname.includes('sipadessirombu');
    if (isProd) {
      const ep = getCpanelEndpoint();
      const res = await fetch(`${ep}?action=save_aset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanAset),
      });
      if (res.ok) return true;
    }
  } catch (err) {
    console.warn('[cPanel Service] Direct save notice:', err);
  }

  // 2. Server proxy fallback (bypasses browser CORS & ModSecurity)
  try {
    const proxyRes = await fetch('/api/cpanel/save_aset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanAset),
    });
    if (proxyRes.ok) return true;
  } catch (proxyErr) {
    console.warn('[cPanel Service] Proxy save notice:', proxyErr);
  }

  return false;
}

export async function saveBatchToCpanel(
  asets: Aset[],
  extra?: Partial<CpanelDatabase>
): Promise<{ success: boolean; totalAset?: number; message?: string }> {
  if ((!asets || asets.length === 0) && !extra) {
    return { success: true };
  }

  const cleanAsets = (asets || []).map(sanitizeAsetForCpanel);
  const bodyPayload: Record<string, any> = {
    ...(extra || {}),
    asets: cleanAsets,
  };

  const isProd = typeof window !== 'undefined' && window.location.hostname.includes('sipadessirombu');

  // 1. On production domain, post a single atomic batch_sync directly to cpanel-api.php
  if (isProd) {
    try {
      const ep = getCpanelEndpoint();
      const res = await fetch(`${ep}?action=batch_sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: bodyPayload }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: data?.status === 'success',
          totalAset: data?.totalAset,
          message: data?.message,
        };
      }
    } catch (err) {
      console.warn('[cPanel Service] Direct batch_sync notice:', err);
    }
  }

  // 2. In dev (or fallback), post via local server proxy /api/cpanel/batch_sync
  try {
    const proxyRes = await fetch('/api/cpanel/batch_sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: bodyPayload }),
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && (data.status === 'success' || data.success)) {
        return {
          success: true,
          totalAset: data.totalAset,
          message: data.message,
        };
      }
    }
  } catch (proxyErr) {
    console.warn('[cPanel Service] Proxy batch_sync notice:', proxyErr);
  }

  // 3. Fallback direct batch_sync if proxy unavailable
  if (!isProd) {
    try {
      const ep = getCpanelEndpoint();
      const res = await fetch(`${ep}?action=batch_sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: bodyPayload }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: data?.status === 'success',
          totalAset: data?.totalAset,
          message: data?.message,
        };
      }
    } catch {}
  }

  return { success: false, message: 'Gagal sinkronisasi batch ke cPanel' };
}

export async function deleteAsetFromCpanel(id: string): Promise<boolean> {
  // 1. Direct browser fetch if on production domain
  try {
    const isProd = typeof window !== 'undefined' && window.location.hostname.includes('sipadessirombu');
    if (isProd) {
      const ep = getCpanelEndpoint();
      const res = await fetch(`${ep}?action=delete_aset&id=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) return true;
    }
  } catch (err) {
    console.warn('[cPanel Service] Direct delete notice:', err);
  }

  // 2. Server proxy fallback
  try {
    const proxyRes = await fetch('/api/cpanel/delete_aset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (proxyRes.ok) return true;
  } catch (proxyErr) {
    console.warn('[cPanel Service] Proxy delete notice:', proxyErr);
  }

  return false;
}

export async function saveAllToCpanel(
  payload: Partial<CpanelDatabase>,
  customUrl?: string
): Promise<{ success: boolean; message: string; totalAset?: number }> {
  const cleanPayload: Partial<CpanelDatabase> = { ...payload };
  if (Array.isArray(cleanPayload.asets)) {
    cleanPayload.asets = cleanPayload.asets.map(sanitizeAsetForCpanel) as Aset[];
  }

  const isProd = typeof window !== 'undefined' && window.location.hostname.includes('sipadessirombu');
  const ep = (customUrl && customUrl.trim()) || getCpanelEndpoint();

  if (isProd) {
    try {
      const res = await fetch(`${ep}?action=upload_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: cleanPayload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        success: data.status === 'success',
        message: data.message || 'Data berhasil disimpan ke cPanel',
        totalAset: data.totalAset,
      };
    } catch (err: any) {
      console.warn('[cPanel Service] Prod upload_all notice:', err);
    }
  }

  // Dev preview / fallback: use server proxy first so CORS/WAF never blocks
  try {
    const proxyRes = await fetch('/api/cpanel/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: ep, payload: { data: cleanPayload } }),
    });
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && (data.status === 'success' || data.success)) {
        return {
          success: true,
          message: data.message || 'Data berhasil disimpan ke cPanel',
          totalAset: data.totalAset,
        };
      }
    }
  } catch (proxyErr) {
    console.warn('[cPanel Service] Proxy upload_all notice:', proxyErr);
  }

  try {
    const res = await fetch(`${ep}?action=upload_all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: cleanPayload }),
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
