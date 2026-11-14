import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  User,
  Desa,
  Aset,
  KlasAset,
  PermohonanVerifikasi,
  PengesahanLaporan,
  TipeVerifikasi,
  KecamatanProfile,
} from '../types';
import {
  INITIAL_DESA_LIST,
  INITIAL_USERS,
  INITIAL_ASETS,
  INITIAL_VERIFIKASI,
  INITIAL_PENGESAHAN,
  INITIAL_KECAMATAN_PROFILE,
} from '../data/initialData';
import {
  formatTanggalIndonesia,
  generateSequentialKodeAset,
  normalizeAsetRegisters,
  distributeTotalPrice,
  ensureUniqueRegistersForNewAsets,
  ensureUniqueRegisterOnUpdate,
  findDuplicateRegisters,
} from '../utils/reportGenerator';
import {
  safeLocalStorageSetItem,
  saveAsetsToIndexedDB,
  loadAsetsFromIndexedDB,
} from '../utils/safeStorage';
import { syncManager, FullSyncPayload } from '../utils/cloudSyncService';
import {
  fetchCpanelData,
  saveAsetToCpanel,
  saveBatchToCpanel,
  deleteAsetFromCpanel,
  saveAllToCpanel,
  saveDesasToCpanel,
  saveUsersToCpanel,
  saveVerifikasiToCpanel,
  savePengesahanToCpanel,
  saveKecamatanToCpanel,
  pingCpanel,
} from '../lib/cpanelService';
import {
  FirestoreQuotaStatus,
} from '../lib/firestoreService';
import { SystemAnnouncement } from '../types';

export interface AuthSession {
  user: User;
  loginTime: number;
  expiresAt: number; // 24 hours timestamp
}

interface AppContextType {
  currentUser: User | null;
  users: User[];
  desas: Desa[];
  asets: Aset[];
  verifikasiList: PermohonanVerifikasi[];
  pengesahanList: PengesahanLaporan[];
  kecamatanProfile: KecamatanProfile;
  updateKecamatanProfile: (data: Partial<KecamatanProfile>) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedDesaFilter: string; // 'all' or desaId
  setSelectedDesaFilter: (desaId: string) => void;
  isServerConnected: boolean;
  lastSyncTime: Date;
  refreshServerData: (force?: boolean) => Promise<void>;
  firestoreQuotaStatus: FirestoreQuotaStatus;
  firestoreQuotaDetail: string;
  checkFirestoreQuotaStatus: () => Promise<{ status: FirestoreQuotaStatus; detail: string; timestamp: Date }>;
  announcements: SystemAnnouncement[];
  sendAnnouncement: (title: string, message: string, priority?: 'normal' | 'urgent' | 'warning') => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  markAnnouncementAsRead: (id: string) => void;
  unreadAnnouncementCount: number;
  saveAllToCloudFirebase: (overrides?: {
    desas?: Desa[];
    kecamatanProfile?: KecamatanProfile;
    users?: User[];
    asets?: Aset[];
  }) => Promise<{ success: boolean; message: string }>;
  saveMasterToSourceCode: (overrides?: {
    desas?: Desa[];
    kecamatanProfile?: KecamatanProfile;
    users?: User[];
    asets?: Aset[];
  }) => Promise<{ success: boolean; message: string }>;
  
  // Auth
  login: (email: string, pass: string) => { success: boolean; message?: string };
  logout: () => void;
  switchUser: (user: User) => void;
  
  // Users (Super Admin)
  addUser: (data: Omit<User, 'id' | 'createdAt'>) => { success: boolean; message?: string };
  updateUser: (id: string, data: Partial<User>) => { success: boolean; message?: string };
  deleteUser: (id: string) => { success: boolean; message?: string };
  
  // Assets
  addAset: (data: Omit<Aset, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  addAsetBatch: (items: Omit<Aset, 'id' | 'createdAt' | 'updatedAt' | 'status'>[]) => Promise<{ success: boolean; count: number }>;
  updateAset: (id: string, data: Partial<Aset>) => void;
  deleteAset: (id: string) => { success: boolean; message?: string };
  perbaikiSemuaNomorRegister: () => Promise<{ fixedCount: number; message: string }>;
  
  // Verifikasi Aset Baru (Admin / Super Admin)
  verifikasiAset: (asetId: string, catatan?: string, nomorSK?: string) => Promise<{ success: boolean; message: string }>;
  verifikasiSemuaAsetPending: () => Promise<{ success: boolean; count: number; message: string }>;
  verifikasiAsetBatch: (asetIds: string[], catatan?: string, nomorSK?: string) => Promise<{ success: boolean; count: number; message: string }>;
  tolakVerifikasiAset: (asetId: string, catatanPerbaikan: string) => Promise<{ success: boolean; message: string }>;
  batalkanVerifikasiAset: (asetId: string) => Promise<{ success: boolean; message: string }>;
  batalkanVerifikasiAsetBatch: (asetIds: string[]) => Promise<{ success: boolean; count: number; message: string }>;
  pendingVerificationCount: number;
  pendingAsetVerificationCount: number;

  // Verifikasi Mutasi & Penghapusan (Kecamatan Control)
  ajukanMutasi: (
    asetId: string,
    alasan: string,
    nomorSuratDesa: string,
    dokumenPendukung: string,
    tujuanMutasi: string
  ) => void;
  ajukanPenghapusan: (
    asetId: string,
    alasan: string,
    nomorSuratDesa: string,
    dokumenPendukung: string
  ) => void;
  prosesVerifikasi: (
    verifikasiId: string,
    status: 'disetujui' | 'ditolak',
    catatanKecamatan: string,
    nomorSKKecamatan?: string
  ) => void;
  
  // Approval Laporan Tahunan
  ajukanPengesahan: (desaId: string, tahun: number) => void;
  prosesPengesahan: (
    desaId: string,
    tahun: number,
    status: 'disetujui' | 'perlu_perbaikan',
    catatan: string
  ) => void;

  // Revisi mutasi yang ditolak oleh desa
  revisiMutasi: (
    verifikasiId: string,
    data: {
      alasan: string;
      nomorSuratDesa: string;
      dokumenPendukung: string;
      tujuanMutasi?: string;
    }
  ) => { success: boolean; message?: string };

  // Hapus permohonan mutasi oleh admin/super admin
  deleteVerifikasi: (verifikasiId: string) => { success: boolean; message?: string };

  // Backup & Restore
  getBackupData: (desaId?: string) => any;
  restoreBackupData: (backupJson: any, targetDesaId?: string) => {
    success: boolean;
    message?: string;
    stats?: { asets: number; verifikasi: number; desas: number; users: number };
  };

  // Desa Information Update
  updateDesa: (id: string, data: Partial<Desa>) => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string };

  // Multi-Device Cloud & P2P Sync
  importSyncPayload: (payload: FullSyncPayload) => void;
  broadcastCurrentState: () => void;

  // Reset
  resetToDefault: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  AUTH_SESSION: 'sipades_sirombu_session_24h',
  USERS: 'sipad_users_v4',
  DESAS: 'sipad_desas_v7_light',
  ASETS: 'sipad_asets_v7_light',
  DELETED_ASETS: 'sipad_deleted_asets_v2',
  VERIFIKASI: 'sipad_verifikasi_v2',
  PENGESAHAN: 'sipad_pengesahan_v2',
  KECAMATAN_PROFILE: 'sipad_kecamatan_profile_v2',
  YEAR: 'sipad_year_v2',
};

/**
 * Deduplicate assets strictly by unique asset ID (`a.id`)
 * and filter out permanently deleted IDs and dummy sample assets.
 * Never drops distinct asset IDs even if their kodeAset/nomorRegister temporarily collide
 * (those are safely repaired downstream by normalizeAsetRegisters).
 */
export function deduplicateAsets(list: Aset[], deletedIds?: Set<string>): Aset[] {
  if (!Array.isArray(list)) return [];
  const seenId = new Set<string>();
  const result: Aset[] = [];

  for (const a of list) {
    if (!a || !a.id) continue;
    if (a.id === 'ast-test-1') continue; // Never allow sample dummy asset
    if (deletedIds && deletedIds.has(a.id)) continue; // Never allow deleted assets to reappear
    if (seenId.has(a.id)) continue; // Avoid duplicate IDs only

    seenId.add(a.id);
    result.push(a);
  }

  return result;
}

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session Persistence with 24-hour expiration:
  // - If session exists and < 24 hours: remain logged in across page refreshes
  // - If user logs out or session > 24 hours: show login page
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (saved) {
        const session: AuthSession = JSON.parse(saved);
        const now = Date.now();
        if (session && session.user && typeof session.user === 'object' && session.user.id && session.expiresAt && now < session.expiresAt) {
          return session.user;
        }
        localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      }
    } catch (e) {
      console.error('[Auth] Failed to parse session:', e);
      try { localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION); } catch {}
    }
    return null;
  });

  // Track deleted asset IDs (Tombstones) - permanently suppresses deleted items like old Tenda 75 JT
  const [deletedAssetIds, setDeletedAssetIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DELETED_ASETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set<string>(['ast-1794407303430-0-85mzy', ...parsed]);
        }
      }
    } catch {}
    return new Set<string>(['ast-1794407303430-0-85mzy', 'ast-test-1']);
  });

  const [firestoreQuotaStatus] = useState<FirestoreQuotaStatus>('NORMAL');
  const [firestoreQuotaDetail, setFirestoreQuotaDetail] = useState<string>(
    'Hosting cPanel Beroperasi Normal — Bebas Kuota (Unlimited Storage).'
  );

  const checkFirestoreQuotaStatus = useCallback(async () => {
    const res = await pingCpanel();
    const detail = res.success
      ? `Hosting cPanel Server Aktif (${res.totalAset ?? 0} aset) — Bebas Batasan Kuota.`
      : res.message;
    setFirestoreQuotaDetail(detail);
    return {
      status: 'NORMAL' as FirestoreQuotaStatus,
      detail,
      timestamp: new Date(),
    };
  }, []);

  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>(() => {
    try {
      const saved = localStorage.getItem('SIPADES_ANNOUNCEMENTS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('SIPADES_READ_ANNOUNCEMENTS');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set();
  });

  const markAnnouncementAsRead = useCallback((id: string) => {
    setReadAnnouncementIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('SIPADES_READ_ANNOUNCEMENTS', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const unreadAnnouncementCount = useMemo(() => {
    return announcements.filter((a) => !readAnnouncementIds.has(a.id)).length;
  }, [announcements, readAnnouncementIds]);

  const sendAnnouncement = useCallback(async (title: string, message: string, priority: 'normal' | 'urgent' | 'warning' = 'warning') => {
    const isAllowed = currentUser?.role === 'super_admin' || currentUser?.role === 'admin_kecamatan';
    if (!isAllowed) {
      console.warn('Hanya Super Admin dan Admin Kecamatan yang berhak mengirim siaran/pengumuman!');
      return;
    }

    const newAnn: SystemAnnouncement = {
      id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title || 'Pemberitahuan dari Super Admin',
      message,
      senderName: currentUser?.name || 'Super Admin Sirombu',
      createdAt: new Date().toISOString(),
      priority,
      active: true,
    };

    setAnnouncements((prev) => {
      const next = [newAnn, ...prev.filter((a) => a.id !== newAnn.id)];
      try { localStorage.setItem('SIPADES_ANNOUNCEMENTS', JSON.stringify(next)); } catch {}
      return next;
    });

    try {
      await fetch('/api/announcements/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnn),
      });
    } catch {}
  }, [currentUser]);

  const deleteAnnouncement = useCallback(async (id: string) => {
    setAnnouncements((prev) => {
      const next = prev.filter((a) => a.id !== id);
      try { localStorage.setItem('SIPADES_ANNOUNCEMENTS', JSON.stringify(next)); } catch {}
      return next;
    });

    try {
      await fetch('/api/announcements/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {}
  }, []);

  const [desas, setDesas] = useState<Desa[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DESAS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return INITIAL_DESA_LIST.map((init) => {
            const found = parsed.find((p: Desa) => p && p.id === init.id);
            if (!found) return init;
            return {
              ...init,
              ...found,
              nomorHp: found.nomorHp || init.nomorHp || '',
              kontak: found.kontak || found.nomorHp || init.kontak || init.nomorHp || '',
              nipKepalaDesa:
                found.nipKepalaDesa && found.nipKepalaDesa !== '-' && found.nipKepalaDesa !== '198601172015031001'
                  ? found.nipKepalaDesa
                  : init.nipKepalaDesa,
            };
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_DESA_LIST;
  });
  
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((u: any) => u && u.id && u.email);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_USERS;
  });

  // Primary state: loads from authoritative localStorage cache cleanly, or falls back to INITIAL_ASETS
  const [asets, setAsets] = useState<Aset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ASETS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return normalizeAsetRegisters(deduplicateAsets(parsed, deletedAssetIds), INITIAL_DESA_LIST).asets;
        }
      }
    } catch {}
    return normalizeAsetRegisters(deduplicateAsets(INITIAL_ASETS, deletedAssetIds), INITIAL_DESA_LIST).asets;
  });

  const asetsRef = useRef<Aset[]>(asets);
  useEffect(() => {
    asetsRef.current = asets;
  }, [asets]);
  const registerRepairSyncedRef = useRef<boolean>(false);

  const [verifikasiList, setVerifikasiList] = useState<PermohonanVerifikasi[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VERIFIKASI);
      if (saved) {
        const parsed: PermohonanVerifikasi[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((v: any) => v && v.id).map((v) => ({
            ...v,
            asetSnapshot: v?.asetSnapshot
              ? {
                  ...v.asetSnapshot,
                  klasifikasi: (v.asetSnapshot.klasifikasi
                    ? v.asetSnapshot.klasifikasi.replace(/^[I|V|X]+\.\s*/, '')
                    : 'Tanah') as KlasAset,
                }
              : v?.asetSnapshot,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_VERIFIKASI;
  });

  const [pengesahanList, setPengesahanList] = useState<PengesahanLaporan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PENGESAHAN);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PENGESAHAN;
  });

  const [kecamatanProfile, setKecamatanProfile] = useState<KecamatanProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.KECAMATAN_PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...INITIAL_KECAMATAN_PROFILE, ...parsed };
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_KECAMATAN_PROFILE;
  });

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.YEAR);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0; // Default: Seluruh Tahun Anggaran (0)
    } catch {
      return 0;
    }
  });

  const handleSetSelectedYear = useCallback((year: number) => {
    setSelectedYear(year);
    safeLocalStorageSetItem(STORAGE_KEYS.YEAR, year.toString());
  }, []);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedDesaFilter, setSelectedDesaFilter] = useState<string>('all');
  const [isServerConnected, setIsServerConnected] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const cpanelBootLoadedRef = useRef(false);

  // Check 24-hour session expiry periodically
  useEffect(() => {
    const checkSession = () => {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (saved) {
        try {
          const session: AuthSession = JSON.parse(saved);
          if (session && session.expiresAt && Date.now() >= session.expiresAt) {
            localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            setCurrentUser(null);
            setActiveTab('dashboard');
          }
        } catch {
          localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
          setCurrentUser(null);
        }
      }
    };

    const interval = setInterval(checkSession, 60000); // check every 1 minute
    return () => clearInterval(interval);
  }, []);

  // Central Storage Helpers - Pure mirror of authoritative state without reviving deleted items
  const persistAsetsSafely = useCallback((list: Aset[]) => {
    safeLocalStorageSetItem(STORAGE_KEYS.ASETS, JSON.stringify(list));
    saveAsetsToIndexedDB(list).catch(() => {});
  }, []);

  const syncRepairedRegistersToServers = useCallback((repairedItems: Aset[]) => {
    if (!repairedItems || repairedItems.length === 0) return;
    saveBatchToCpanel(repairedItems).catch((err) =>
      console.warn('[cPanel] Auto-repair register sync notice:', err)
    );
  }, []);

  const mergeCpanelWithLocal = useCallback(
    (
      remoteAsets: Aset[],
      localAsets: Aset[],
      deletedSet: Set<string>,
      desaList: Desa[]
    ): { merged: Aset[]; unsyncedToPush: Aset[]; changed: boolean } => {
      const cleanRemote = deduplicateAsets(remoteAsets, deletedSet);
      const { asets: normalizedRemoteRaw, changedIds } = normalizeAsetRegisters(cleanRemote, desaList);
      const nowIso = new Date().toISOString();
      const changedSet = new Set(changedIds);
      const normalizedRemote =
        changedIds.length > 0
          ? normalizedRemoteRaw.map((item) => (changedSet.has(item.id) ? { ...item, updatedAt: nowIso } : item))
          : normalizedRemoteRaw;

      const localMap = new Map<string, Aset>(
        localAsets
          .filter((a) => a && a.id && a.id !== 'ast-test-1' && !deletedSet.has(a.id))
          .map((a) => [a.id, a])
      );
      const mergedMap = new Map<string, Aset>();
      const unsyncedToPush: Aset[] = [];

      for (const na of normalizedRemote) {
        if (!na || !na.id) continue;
        const current = localMap.get(na.id);
        if (!current) {
          mergedMap.set(na.id, na);
          if (changedSet.has(na.id)) {
            unsyncedToPush.push(na);
          }
        } else {
          const currTime = new Date(current.updatedAt || 0).getTime();
          const naTime = new Date(na.updatedAt || 0).getTime();
          const naFotos = Array.isArray(na.fotoAset) ? na.fotoAset.filter(Boolean) : [];
          const curFotos = Array.isArray(current.fotoAset) ? current.fotoAset.filter(Boolean) : [];
          const mergedPhotos =
            naFotos.length > curFotos.length
              ? naFotos
              : curFotos.length > naFotos.length
              ? curFotos
              : naFotos.length > 0
              ? naFotos
              : [];
          const mergedBast = na.fotoBast || current.fotoBast || '';

          if (currTime > naTime && !changedSet.has(na.id)) {
            const chosen: Aset = {
              ...na,
              ...current,
              fotoAset: curFotos.length >= naFotos.length && curFotos.length > 0 ? curFotos : mergedPhotos,
              fotoBast: current.fotoBast || mergedBast,
            };
            mergedMap.set(na.id, chosen);
            unsyncedToPush.push(chosen);
          } else if (naTime > currTime) {
            const chosen: Aset = {
              ...current,
              ...na,
              fotoAset: mergedPhotos,
              fotoBast: mergedBast,
            };
            if (na.statusVerifikasi === 'sedang_diproses') {
              delete chosen.diverifikasiOleh;
              delete chosen.tanggalVerifikasi;
              delete chosen.catatanVerifikasi;
              delete chosen.nomorSKVerifikasi;
            }
            mergedMap.set(na.id, chosen);
            if (changedSet.has(na.id)) {
              unsyncedToPush.push(chosen);
            }
          } else {
            const localVerifiedMore =
              current.statusVerifikasi === 'sudah_diverifikasi' && na.statusVerifikasi !== 'sudah_diverifikasi';
            const chosen: Aset = {
              ...current,
              ...na,
              fotoAset: mergedPhotos,
              fotoBast: mergedBast,
              ...(localVerifiedMore
                ? {
                    statusVerifikasi: 'sudah_diverifikasi' as const,
                    diverifikasiOleh: current.diverifikasiOleh || na.diverifikasiOleh,
                    tanggalVerifikasi: current.tanggalVerifikasi || na.tanggalVerifikasi,
                    catatanVerifikasi: current.catatanVerifikasi || na.catatanVerifikasi,
                    nomorSKVerifikasi: current.nomorSKVerifikasi || na.nomorSKVerifikasi,
                  }
                : {}),
            };
            mergedMap.set(na.id, chosen);
            if (localVerifiedMore || changedSet.has(na.id)) {
              unsyncedToPush.push(chosen);
            }
          }
        }
      }

      // Preserve any local-only active non-deleted assets (e.g. saved offline/failed sync) and push them to cPanel
      for (const pa of localAsets) {
        if (!pa || !pa.id || pa.id === 'ast-test-1' || deletedSet.has(pa.id)) continue;
        if (!mergedMap.has(pa.id)) {
          mergedMap.set(pa.id, pa);
          unsyncedToPush.push(pa);
        }
      }

      const finalNormalized = normalizeAsetRegisters(
        deduplicateAsets(Array.from(mergedMap.values()), deletedSet),
        desaList
      );
      const merged = finalNormalized.asets;
      if (finalNormalized.changedIds.length > 0) {
        const pushIds = new Set(unsyncedToPush.map((u) => u.id));
        finalNormalized.changedIds.forEach((cid) => {
          if (!pushIds.has(cid)) {
            const found = merged.find((m) => m.id === cid);
            if (found) unsyncedToPush.push(found);
          }
        });
      }

      let changed = merged.length !== localAsets.length;
      if (!changed) {
        for (let i = 0; i < localAsets.length; i++) {
          const a = localAsets[i];
          const b = merged[i];
          if (
            !a ||
            !b ||
            a.id !== b.id ||
            a.updatedAt !== b.updatedAt ||
            a.statusVerifikasi !== b.statusVerifikasi ||
            a.namaAset !== b.namaAset ||
            a.nomorSeri !== b.nomorSeri ||
            a.nomorRegister !== b.nomorRegister ||
            a.kodeAset !== b.kodeAset ||
            a.kondisi !== b.kondisi ||
            a.nilaiPerolehan !== b.nilaiPerolehan ||
            (a.fotoAset || []).length !== (b.fotoAset || []).length ||
            (a.fotoBast || '') !== (b.fotoBast || '')
          ) {
            changed = true;
            break;
          }
        }
      }

      return { merged, unsyncedToPush, changed };
    },
    []
  );

  const lastKnownCpanelCount = useRef<number>(asets.length);
  const lastKnownCpanelUpdated = useRef<string>('');
  const pausePulseUntil = useRef<number>(0);

  useEffect(() => {
    lastKnownCpanelCount.current = asets.length;
  }, [asets.length]);

  // Central cPanel Web Hosting Synchronization (100% cPanel Unlimited Storage)
  const refreshServerData = useCallback(
    async (_force = false) => {
      try {
        const cpData = await fetchCpanelData();
        if (cpData && Array.isArray(cpData.asets) && cpData.asets.length > 0) {
          const remoteDeleted = Array.isArray(cpData.deletedIds) ? cpData.deletedIds : [];
          const effectiveDeleted = new Set<string>(deletedAssetIds);
          let deletedUpdated = false;
          remoteDeleted.forEach((id) => {
            if (id && !effectiveDeleted.has(id)) {
              effectiveDeleted.add(id);
              deletedUpdated = true;
            }
          });
          if (deletedUpdated) {
            setDeletedAssetIds(effectiveDeleted);
            try {
              localStorage.setItem(STORAGE_KEYS.DELETED_ASETS, JSON.stringify(Array.from(effectiveDeleted)));
            } catch {}
          }

          const activeDesas = Array.isArray(cpData.desas) && cpData.desas.length > 0 ? cpData.desas : desas;
          const currentLocal = asetsRef.current;
          const { merged, unsyncedToPush, changed } = mergeCpanelWithLocal(
            cpData.asets,
            currentLocal,
            effectiveDeleted,
            activeDesas
          );

          if (changed) {
            asetsRef.current = merged;
            setAsets(merged);
            persistAsetsSafely(merged);
            saveAsetsToIndexedDB(merged).catch(() => {});
          }

          if (unsyncedToPush.length > 0 && !registerRepairSyncedRef.current) {
            registerRepairSyncedRef.current = true;
            pausePulseUntil.current = Date.now() + 15000;
            saveBatchToCpanel(unsyncedToPush)
              .catch((err) => console.warn('[cPanel] Auto-push unsynced assets notice:', err))
              .finally(() => {
                registerRepairSyncedRef.current = false;
              });
          }

          if (Array.isArray(cpData.verifikasiList)) {
            setVerifikasiList(cpData.verifikasiList);
            safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(cpData.verifikasiList));
          }
          if (Array.isArray(cpData.users) && cpData.users.length > 0) {
            setUsers(cpData.users);
            safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(cpData.users));
          }
          if (Array.isArray(cpData.desas) && cpData.desas.length > 0) {
            setDesas(cpData.desas);
            safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(cpData.desas));
          }
          if (Array.isArray(cpData.pengesahanList)) {
            setPengesahanList(cpData.pengesahanList);
            safeLocalStorageSetItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(cpData.pengesahanList));
          }
          if (cpData.kecamatanProfile) {
            setKecamatanProfile(cpData.kecamatanProfile);
            safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(cpData.kecamatanProfile));
          }

          setIsServerConnected(true);
          setLastSyncTime(new Date());
          lastKnownCpanelCount.current = merged.length;
          if (cpData.updatedAt) lastKnownCpanelUpdated.current = cpData.updatedAt;
        }
      } catch (e) {
        console.warn('[cPanel Sync] refreshServerData error:', e);
      }
    },
    [desas, persistAsetsSafely, deletedAssetIds, mergeCpanelWithLocal]
  );

  // Pure cPanel Central Database Synchronization (Disconnected from Firebase)
  useEffect(() => {
    if (cpanelBootLoadedRef.current) return;
    cpanelBootLoadedRef.current = true;

    const loadAuthoritativeCpanelData = async () => {
      try {
        const [cpData, idbAsets] = await Promise.all([
          fetchCpanelData(),
          loadAsetsFromIndexedDB().catch(() => [] as Aset[]),
        ]);

        // Unify localStorage & IndexedDB before comparing with cPanel so offline additions/verifications are preserved
        const baseLocalMap = new Map<string, Aset>(asetsRef.current.map((a) => [a.id, a]));
        if (Array.isArray(idbAsets)) {
          for (const item of idbAsets) {
            if (!item || !item.id || item.id === 'ast-test-1' || deletedAssetIds.has(item.id)) continue;
            const exist = baseLocalMap.get(item.id);
            if (!exist) {
              baseLocalMap.set(item.id, item);
            } else {
              const existTime = new Date(exist.updatedAt || 0).getTime();
              const itemTime = new Date(item.updatedAt || 0).getTime();
              if (itemTime > existTime) {
                baseLocalMap.set(item.id, {
                  ...exist,
                  ...item,
                  fotoAset: item.fotoAset && item.fotoAset.length > 0 ? item.fotoAset : exist.fotoAset,
                  fotoBast: item.fotoBast || exist.fotoBast,
                });
              } else if ((!exist.fotoAset || exist.fotoAset.length === 0) && item.fotoAset && item.fotoAset.length > 0) {
                baseLocalMap.set(item.id, { ...exist, fotoAset: item.fotoAset, fotoBast: item.fotoBast || exist.fotoBast });
              }
            }
          }
        }
        const unifiedLocal = Array.from(baseLocalMap.values());

        if (cpData && Array.isArray(cpData.asets) && cpData.asets.length > 0) {
          const remoteDeleted = Array.isArray(cpData.deletedIds) ? cpData.deletedIds : [];
          const effectiveDeleted = new Set<string>(deletedAssetIds);
          let deletedUpdated = false;
          remoteDeleted.forEach((id) => {
            if (id && !effectiveDeleted.has(id)) {
              effectiveDeleted.add(id);
              deletedUpdated = true;
            }
          });
          if (deletedUpdated) {
            setDeletedAssetIds(effectiveDeleted);
            try {
              localStorage.setItem(STORAGE_KEYS.DELETED_ASETS, JSON.stringify(Array.from(effectiveDeleted)));
            } catch {}
          }

          const activeDesas = Array.isArray(cpData.desas) && cpData.desas.length > 0 ? cpData.desas : desas;
          const { merged, unsyncedToPush, changed } = mergeCpanelWithLocal(
            cpData.asets,
            unifiedLocal,
            effectiveDeleted,
            activeDesas
          );

          if (changed) {
            asetsRef.current = merged;
            setAsets(merged);
            persistAsetsSafely(merged);
            saveAsetsToIndexedDB(merged).catch(() => {});
          }

          if (unsyncedToPush.length > 0) {
            pausePulseUntil.current = Date.now() + 15000;
            saveBatchToCpanel(unsyncedToPush).catch((err) =>
              console.warn('[cPanel Boot] Push unsynced local assets notice:', err)
            );
          }

          if (Array.isArray(cpData.desas) && cpData.desas.length > 0) {
            setDesas((prev) => {
              if (prev.length === cpData.desas!.length) return prev;
              const map = new Map<string, Desa>(prev.map((d) => [d.id, d]));
              cpData.desas!.forEach((cd) => {
                if (cd && cd.id) {
                  const exist = map.get(cd.id);
                  map.set(cd.id, exist ? { ...exist, ...cd } : cd);
                }
              });
              const mergedDesas = Array.from(map.values());
              safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(mergedDesas));
              return mergedDesas;
            });
          }

          if (Array.isArray(cpData.users) && cpData.users.length > 0) {
            setUsers((prev) => {
              if (prev.length === cpData.users!.length) return prev;
              const map = new Map<string, User>(prev.map((u) => [u.id, u]));
              cpData.users!.forEach((u) => {
                if (u && u.id) map.set(u.id, u);
              });
              const mergedUsers = Array.from(map.values());
              safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(mergedUsers));
              return mergedUsers;
            });
          }

          if (Array.isArray(cpData.verifikasiList)) {
            setVerifikasiList(cpData.verifikasiList);
            safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(cpData.verifikasiList));
          }

          if (Array.isArray(cpData.pengesahanList)) {
            setPengesahanList(cpData.pengesahanList);
            safeLocalStorageSetItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(cpData.pengesahanList));
          }

          if (cpData.kecamatanProfile && cpData.kecamatanProfile.namaKecamatan) {
            setKecamatanProfile(cpData.kecamatanProfile);
            safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(cpData.kecamatanProfile));
          }

          setIsServerConnected(true);
          setLastSyncTime(new Date());
        }
      } catch (err) {
        console.warn('[cPanel Boot] Load notice:', err);
      }
    };

    loadAuthoritativeCpanelData();
  }, [desas, deletedAssetIds, mergeCpanelWithLocal, persistAsetsSafely]);

  // Real-time Multi-Laptop Synchronization via SSE & Central Server
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let lastServerUpdatedAt = '';

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload && payload.type === 'DATA_CHANGED' && payload.data) {
              const serverData = payload.data;
              if (Array.isArray(serverData.asets)) {
                setAsets((prev) => {
                  const prevHasDup = findDuplicateRegisters(prev).length > 0;
                  if (
                    !prevHasDup &&
                    prev.length === serverData.asets.length &&
                    serverData.updatedAt &&
                    serverData.updatedAt === lastServerUpdatedAt
                  ) {
                    return prev; // Same object identity: avoids photo reload/flicker!
                  }
                  lastServerUpdatedAt = serverData.updatedAt || '';
                  const cleanSSE = normalizeAsetRegisters(deduplicateAsets(serverData.asets, deletedAssetIds), desas).asets;
                  persistAsetsSafely(cleanSSE);
                  return cleanSSE;
                });
              }
              if (Array.isArray(serverData.verifikasiList)) {
                setVerifikasiList(serverData.verifikasiList);
                safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(serverData.verifikasiList));
              }
              if (Array.isArray(serverData.users) && serverData.users.length > 0) {
                setUsers(serverData.users);
                safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(serverData.users));
              }
              if (Array.isArray(serverData.desas) && serverData.desas.length > 0) {
                setDesas((prev) => {
                  const map = new Map<string, Desa>(prev.map((d) => [d.id, d]));
                  serverData.desas.forEach((srv: Desa) => {
                    if (srv && srv.id) {
                      const exist = map.get(srv.id);
                      if (exist) {
                        map.set(srv.id, {
                          ...exist,
                          ...srv,
                          nomorHp: srv.nomorHp || exist.nomorHp || '',
                          kontak: srv.kontak || exist.kontak || srv.nomorHp || exist.nomorHp || '',
                          nipKepalaDesa: srv.nipKepalaDesa && srv.nipKepalaDesa !== '-' ? srv.nipKepalaDesa : exist.nipKepalaDesa,
                          kepalaDesa: srv.kepalaDesa || exist.kepalaDesa,
                          kaurAset: srv.kaurAset || exist.kaurAset || '',
                          alamatDesa: srv.alamatDesa || exist.alamatDesa || '',
                          kodePos: srv.kodePos || exist.kodePos || '22863',
                          emailDesa: srv.emailDesa || exist.emailDesa || '',
                        });
                      } else {
                        map.set(srv.id, srv);
                      }
                    }
                  });
                  const merged = Array.from(map.values());
                  safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(merged));
                  return merged;
                });
              }
              if (serverData.kecamatanProfile) {
                setKecamatanProfile(serverData.kecamatanProfile);
                safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(serverData.kecamatanProfile));
              }
              if (Array.isArray(serverData.announcements)) {
                setAnnouncements(serverData.announcements);
                try { localStorage.setItem('SIPADES_ANNOUNCEMENTS', JSON.stringify(serverData.announcements)); } catch {}
              }
              setIsServerConnected(true);
              setLastSyncTime(new Date());
            } else if (payload && payload.type === 'ANNOUNCEMENT_CHANGED' && Array.isArray(payload.data)) {
              setAnnouncements(payload.data);
              try { localStorage.setItem('SIPADES_ANNOUNCEMENTS', JSON.stringify(payload.data)); } catch {}
            }
          } catch (err) {
            console.warn('[SSE] Event parse notice:', err);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Retry connection after 5 seconds
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch {
        // SSE not supported or blocked, polling fallback will handle it
      }
    };

    connectSSE();

    return () => {
      clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [persistAsetsSafely, deletedAssetIds]);

  // Automatic Real-Time Pulse for cPanel Web Hosting (Always Realtime without manual pull)
  useEffect(() => {
    let isChecking = false;

    const checkCpanelPulse = async () => {
      if (isChecking) return;
      if (Date.now() < pausePulseUntil.current) return;
      isChecking = true;
      try {
        const ping = await pingCpanel();
        if (ping.success && typeof ping.totalAset === 'number') {
          // Detect changes in cPanel database (total assets or update timestamp)
          const isCpanelPartial = ping.totalAset < 50 && asetsRef.current.length > 300;
          const countDiffers = !isCpanelPartial && ping.totalAset !== lastKnownCpanelCount.current;
          const timeDiffers = Boolean(ping.updatedAt && lastKnownCpanelUpdated.current && ping.updatedAt !== lastKnownCpanelUpdated.current);

          if ((countDiffers || timeDiffers) && !isCpanelPartial) {
            lastKnownCpanelCount.current = ping.totalAset;
            if (ping.updatedAt) lastKnownCpanelUpdated.current = ping.updatedAt;
            await refreshServerData(true);
          } else if (ping.updatedAt && !lastKnownCpanelUpdated.current) {
            lastKnownCpanelUpdated.current = ping.updatedAt;
          }
        }
      } catch {
        // Silent fail on transient network error
      } finally {
        isChecking = false;
      }
    };

    // Gentle periodic heartbeat every 60 seconds (prevents Rate exceeded and respects hosting limits)
    const pulseInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkCpanelPulse();
      }
    }, 60000);

    return () => {
      clearInterval(pulseInterval);
    };
  }, [refreshServerData]);

  // Multi-Device Synchronization Engine (Cross-Browser, Cross-Laptop, Vercel & P2P)
  const importSyncPayload = useCallback((payload: FullSyncPayload) => {
    if (!payload) return;

    // 1. Process deletions first
    if (payload.deletedId || (payload.deletedAssetIds && payload.deletedAssetIds.length > 0)) {
      const idsToDelete = [
        ...(payload.deletedId ? [payload.deletedId] : []),
        ...(payload.deletedAssetIds || []),
      ];

      setDeletedAssetIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.add(id));
        try {
          localStorage.setItem(STORAGE_KEYS.DELETED_ASETS, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });

      setAsets((prev) => {
        const filtered = prev.filter((a) => !idsToDelete.includes(a.id));
        persistAsetsSafely(filtered);
        return filtered;
      });
    }

    // 2. Process single updated asset or full asset payload
    if (payload.deletedId) {
      setAsets((prev) => {
        const next = prev.filter((a) => a.id !== payload.deletedId);
        persistAsetsSafely(next);
        saveAsetsToIndexedDB(next).catch(() => {});
        return next;
      });
    } else if (payload.updatedAset) {
      const incoming = payload.updatedAset;
      setAsets((prev) => {
        const exists = prev.some((a) => a.id === incoming.id);
        const locked = exists
          ? ensureUniqueRegisterOnUpdate(
              { ...(prev.find((a) => a.id === incoming.id)!), ...incoming },
              prev,
              desas
            )
          : ensureUniqueRegistersForNewAsets([incoming], prev, desas)[0];
        const next = exists
          ? prev.map((a) => (a.id === incoming.id ? locked : a))
          : [locked, ...prev];
        persistAsetsSafely(next);
        return next;
      });
    } else if (Array.isArray(payload.asets) && payload.asets.length > 0) {
      setAsets((prev) => {
        const currentDeleted = new Set(deletedAssetIds);
        if (payload.deletedId) currentDeleted.add(payload.deletedId);
        payload.deletedAssetIds?.forEach((id) => currentDeleted.add(id));

        const existingMap = new Map<string, Aset>();
        payload.asets?.forEach((incoming) => {
          if (incoming && incoming.id && !currentDeleted.has(incoming.id) && incoming.id !== 'ast-test-1') {
            const prevItem = prev.find((p) => p.id === incoming.id);
            const fotoAset = incoming.fotoAset && incoming.fotoAset.length > 0 ? incoming.fotoAset : prevItem?.fotoAset || [];
            const fotoBast = incoming.fotoBast || prevItem?.fotoBast;
            existingMap.set(incoming.id, { ...incoming, fotoAset, fotoBast });
          }
        });
        const merged = normalizeAsetRegisters(deduplicateAsets(Array.from(existingMap.values()), currentDeleted), desas).asets;
        persistAsetsSafely(merged);
        return merged;
      });
    }
    if (Array.isArray(payload.verifikasiList) && payload.verifikasiList.length > 0) {
      setVerifikasiList((prev) => {
        const existingMap = new Map(prev.map((v) => [v.id, v]));
        payload.verifikasiList?.forEach((incoming) => {
          if (incoming && incoming.id) existingMap.set(incoming.id, incoming);
        });
        const merged = Array.from(existingMap.values());
        safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(merged));
        return merged;
      });
    }
    if (payload.updatedDesa) {
      const incomingDesa = payload.updatedDesa;
      setDesas((prev) => {
        const next = prev.map((d) => (d.id === incomingDesa.id ? { ...d, ...incomingDesa } : d));
        safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(next));
        return next;
      });
    } else if (Array.isArray(payload.desas) && payload.desas.length > 0) {
      setDesas((prev) => {
        const map = new Map(prev.map((d) => [d.id, d]));
        payload.desas?.forEach((d) => {
          if (d && d.id) {
            const existing = map.get(d.id);
            map.set(d.id, existing ? { ...existing, ...d } : d);
          }
        });
        const merged = Array.from(map.values());
        safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(merged));
        return merged;
      });
    }
    if (Array.isArray(payload.users) && payload.users.length > 0) {
      setUsers(payload.users);
      safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(payload.users));
    }
    if (payload.kecamatanProfile) {
      setKecamatanProfile(payload.kecamatanProfile);
      safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(payload.kecamatanProfile));
    }
    setIsServerConnected(true);
    setLastSyncTime(new Date());
  }, [persistAsetsSafely]);

  const broadcastCurrentState = useCallback(() => {
    syncManager.broadcastChange({
      version: 2,
      timestamp: new Date().toISOString(),
      senderId: 'manual',
      asets,
      verifikasiList,
      pengesahanList,
      desas,
      users,
      kecamatanProfile,
    });
  }, [asets, verifikasiList, pengesahanList, desas, users, kecamatanProfile]);

  // Connect to P2P and Cloud Sync Hub
  useEffect(() => {
    syncManager.init(() => ({
      version: 2,
      timestamp: new Date().toISOString(),
      senderId: 'client',
      asets,
      verifikasiList,
      pengesahanList,
      desas,
      users,
      kecamatanProfile,
    }));

    const unsub = syncManager.onSync((remotePayload) => {
      importSyncPayload(remotePayload);
    });

    return () => {
      unsub();
    };
  }, [asets, verifikasiList, pengesahanList, desas, users, kecamatanProfile, importSyncPayload]);

  // Hydrate full photo & offline assets from IndexedDB on fresh page load
  useEffect(() => {
    loadAsetsFromIndexedDB()
      .then((idbAsets) => {
        if (Array.isArray(idbAsets) && idbAsets.length > 0) {
          setAsets((current) => {
            if (current.length === 0) return deduplicateAsets(idbAsets, deletedAssetIds);
            const map = new Map<string, Aset>(current.map((c) => [c.id, c]));
            let didChange = false;
            for (const matched of idbAsets) {
              if (!matched || !matched.id || matched.id === 'ast-test-1' || deletedAssetIds.has(matched.id)) continue;
              const c = map.get(matched.id);
              if (!c) {
                map.set(matched.id, matched);
                didChange = true;
              } else {
                const cTime = new Date(c.updatedAt || 0).getTime();
                const mTime = new Date(matched.updatedAt || 0).getTime();
                if (mTime > cTime) {
                  map.set(matched.id, {
                    ...c,
                    ...matched,
                    fotoAset: matched.fotoAset && matched.fotoAset.length > 0 ? matched.fotoAset : c.fotoAset,
                    fotoBast: matched.fotoBast || c.fotoBast,
                  });
                  didChange = true;
                } else if ((!c.fotoAset || c.fotoAset.length === 0) && matched.fotoAset && matched.fotoAset.length > 0) {
                  map.set(matched.id, { ...c, fotoAset: matched.fotoAset, fotoBast: matched.fotoBast || c.fotoBast });
                  didChange = true;
                }
              }
            }
            return didChange ? normalizeAsetRegisters(Array.from(map.values()), desas).asets : current;
          });
        }
      })
      .catch(() => {});
  }, []);

  // One-time check for hybrid local server if present.
  // Real-time synchronization across devices is passively handled by Firestore onSnapshot & BroadcastChannel without polling.
  useEffect(() => {
    fetch('/api/data')
      .then((res) => {
        if (res.ok) {
          const cType = res.headers.get('content-type');
          if (cType && cType.includes('application/json')) {
            return res.json();
          }
        }
        return null;
      })
      .then((serverData) => {
        if (serverData && Array.isArray(serverData.asets) && serverData.asets.length > 0) {
          setAsets((current) => {
            const hasDups = findDuplicateRegisters(current).length > 0;
            // If current is incomplete or has duplicate registers, normalize cleanly
            if (current.length < serverData.asets.length || current.length <= 100) {
              const clean = deduplicateAsets(serverData.asets, deletedAssetIds);
              const { asets: normalized } = normalizeAsetRegisters(clean, desas);
              safeLocalStorageSetItem(STORAGE_KEYS.ASETS, JSON.stringify(normalized));
              saveAsetsToIndexedDB(normalized).catch(() => {});
              return normalized;
            }
            if (hasDups) {
              const { asets: normalized } = normalizeAsetRegisters(current, desas);
              safeLocalStorageSetItem(STORAGE_KEYS.ASETS, JSON.stringify(normalized));
              saveAsetsToIndexedDB(normalized).catch(() => {});
              return normalized;
            }
            return current;
          });
          setIsServerConnected(true);
          setLastSyncTime(new Date());
        }
      })
      .catch(() => {});
  }, [desas]);

  // Local storage persistence fallbacks with safe storage protection against QuotaExceededError
  useEffect(() => {
    safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    persistAsetsSafely(asets);
  }, [asets, persistAsetsSafely]);

  useEffect(() => {
    safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(desas));
  }, [desas]);

  useEffect(() => {
    safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(verifikasiList));
  }, [verifikasiList]);

  useEffect(() => {
    safeLocalStorageSetItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(pengesahanList));
  }, [pengesahanList]);

  useEffect(() => {
    safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(kecamatanProfile));
  }, [kecamatanProfile]);

  useEffect(() => {
    safeLocalStorageSetItem(STORAGE_KEYS.YEAR, selectedYear.toString());
  }, [selectedYear]);

  // Auth Handlers
  const login = (email: string, pass: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === pass.trim()
    );
    if (user) {
      const now = Date.now();
      const session: AuthSession = {
        user,
        loginTime: now,
        expiresAt: now + SESSION_DURATION_MS, // 24 hours
      };
      safeLocalStorageSetItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
      setCurrentUser(user);
      setActiveTab('dashboard');
      return { success: true };
    }
    return { success: false, message: 'Email atau kata sandi tidak cocok. Silakan periksa kembali!' };
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const switchUser = (user: User) => {
    const now = Date.now();
    const session: AuthSession = {
      user,
      loginTime: now,
      expiresAt: now + SESSION_DURATION_MS,
    };
    safeLocalStorageSetItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
    setCurrentUser(user);
  };

  // User Management
  const addUser = (data: Omit<User, 'id' | 'createdAt'>) => {
    if (data.role === 'super_admin' && currentUser?.role !== 'super_admin') {
      return { success: false, message: 'Hanya Super Admin yang berhak menambahkan akun Super Admin!' };
    }
    if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, message: 'Email / ID pengguna sudah terdaftar!' };
    }
    const newUser: User = {
      ...data,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [newUser, ...prev]);

    // Push to cPanel Hosting & local server
    saveUsersToCpanel([newUser, ...users]).catch((e) => console.warn('[cPanel] User add failed:', e));
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: newUser, requestRole: currentUser?.role }),
    }).catch((e) => console.warn('[Sync] User add failed:', e));

    return { success: true };
  };

  const updateUser = (id: string, data: Partial<User>) => {
    const target = users.find((u) => u.id === id);
    if (target?.role === 'super_admin' && currentUser?.role !== 'super_admin') {
      return { success: false, message: 'Hanya Super Admin yang berhak mengubah akun Super Admin!' };
    }
    if (data.role === 'super_admin' && currentUser?.role !== 'super_admin') {
      return { success: false, message: 'Hanya Super Admin yang dapat menetapkan peran Super Admin!' };
    }

    const updatedUser = { ...target, ...data } as User;
    const updatedUsersList = users.map((u) => (u.id === id ? updatedUser : u));
    setUsers(updatedUsersList);

    if (currentUser?.id === id) {
      const updatedSelf = { ...currentUser, ...data };
      setCurrentUser(updatedSelf);
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
      if (saved) {
        try {
          const sess: AuthSession = JSON.parse(saved);
          sess.user = updatedSelf;
          safeLocalStorageSetItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(sess));
        } catch {
          // ignore
        }
      }
    }

    // Push to cPanel Hosting & local server
    saveUsersToCpanel(updatedUsersList).catch((e) => console.warn('[cPanel] User update failed:', e));
    fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, requestRole: currentUser?.role }),
    }).catch((e) => console.warn('[Sync] User update failed:', e));

    return { success: true };
  };

  const deleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'Pengguna tidak ditemukan!' };

    if (target.email === 'udniat.01@gmail.com') {
      return { success: false, message: 'Akun Super Admin Utama tidak dapat dihapus!' };
    }

    if (currentUser?.role !== 'super_admin') {
      return { success: false, message: 'Hanya Super Admin yang berhak menghapus akun pengguna!' };
    }

    if (currentUser?.id === id) {
      return { success: false, message: 'Tidak dapat menghapus akun yang sedang aktif digunakan!' };
    }

    const filteredUsers = users.filter((u) => u.id !== id);
    setUsers(filteredUsers);

    saveUsersToCpanel(filteredUsers).catch((e) => console.warn('[cPanel] User delete failed:', e));
    fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestRole: currentUser?.role }),
    }).catch((e) => console.warn('[Sync] User delete failed:', e));

    return { success: true };
  };

  // Asset Management
  const addAsetBatch = async (items: Omit<Aset, 'id' | 'createdAt' | 'updatedAt' | 'status'>[]) => {
    if (!items || items.length === 0) return { success: false, count: 0 };
    const now = new Date().toISOString();
    pausePulseUntil.current = Date.now() + 15000;
    const rawNewAsets: Aset[] = items.map((data, idx) => {
      const desa = desas.find((d) => d && d.id === data.desaId);
      return {
        ...data,
        id: `ast-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        desaName: desa?.name || 'Desa',
        status: 'aktif',
        statusVerifikasi: 'sedang_diproses', // Baru diinput desa -> tampil sedang proses
        createdAt: now,
        updatedAt: now,
      };
    });

    // KUNCI ANTI-DUPLIKAT: Pastikan seluruh nomor register baru & kodeAset 100% unik terhadap seluruh aset desa/tahun di state
    const basePool = asetsRef.current.length > 0 ? asetsRef.current : asets;
    const newAsets = ensureUniqueRegistersForNewAsets(rawNewAsets, basePool, desas);
    const updatedSnapshot = [...newAsets, ...basePool];
    asetsRef.current = updatedSnapshot;

    setAsets((prev) => {
      const lockedForPrev = ensureUniqueRegistersForNewAsets(newAsets, prev, desas);
      const merged = [...lockedForPrev, ...prev];
      persistAsetsSafely(merged);
      return merged;
    });

    // Broadcast via WebRTC P2P and Cloud Relay for instant cross-laptop synchronization
    syncManager.broadcastChange({
      version: 2,
      timestamp: now,
      senderId: 'client',
      asets: updatedSnapshot,
      verifikasiList,
      pengesahanList,
      desas,
      users,
      kecamatanProfile,
    });

    // Atomic single-request batch sync to cPanel Hosting (avoids concurrent save_aset race conditions)
    await saveBatchToCpanel(newAsets).catch((err) =>
      console.warn('[cPanel] Batch aset save failed:', err)
    );

    return { success: true, count: newAsets.length };
  };

  const addAset = (data: Omit<Aset, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    // Jika aset yang diisi lebih dari 1 (misal volume: "5 Unit", "10 Buah", atau volume angka > 1),
    // langsung gandakan aset tersebut dengan nomor registrasi yang berbeda-beda secara otomatis
    let unitCount = 1;
    if (data.volume) {
      const match = data.volume.trim().match(/^(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > 1 && n <= 500) {
          unitCount = n;
        }
      }
    }

    const currentPool = asetsRef.current.length > 0 ? asetsRef.current : asets;
    if (unitCount > 1) {
      const totalNilai = Number(data.nilaiPerolehan || 0);
      const priceDist = distributeTotalPrice(totalNilai, unitCount);
      const targetYear = Number(data.tahunPerolehan) || new Date().getFullYear();
      const codes = generateSequentialKodeAset(data.desaId, data.klasifikasi, unitCount, currentPool, desas, undefined, targetYear);
      const batchItems = codes.map((codeInfo, idx) => ({
        ...data,
        kodeAset: codeInfo.kodeAset,
        nomorRegister: codeInfo.nomorRegister,
        nilaiPerolehan: priceDist.prices[idx],
        volume: '1 Unit',
      }));
      addAsetBatch(batchItems);
    } else {
      addAsetBatch([data]);
    }
  };

  const updateAset = (id: string, data: Partial<Aset>) => {
    const basePool = asetsRef.current.length > 0 ? asetsRef.current : asets;
    const existing = basePool.find((a) => a.id === id);
    const now = new Date().toISOString();
    pausePulseUntil.current = Date.now() + 15000;

    let lockedTarget: Aset | null = null;
    if (existing) {
      const candidate: Aset = {
        ...existing,
        ...data,
        updatedAt: now,
      };
      lockedTarget = ensureUniqueRegisterOnUpdate(candidate, basePool, desas);
      const nextSnapshot = basePool.map((a) => (a.id === id ? lockedTarget! : a));
      asetsRef.current = nextSnapshot;
    }

    setAsets((prev) => {
      const updated = prev.map((a) => {
        if (a.id === id) {
          const candidate: Aset = {
            ...a,
            ...data,
            updatedAt: now,
          };
          const locked = ensureUniqueRegisterOnUpdate(candidate, prev, desas);
          lockedTarget = locked;
          return locked;
        }
        return a;
      });

      // Persist immediately to localStorage and IndexedDB so updates are never lost on reload or background sync
      persistAsetsSafely(updated);
      saveAsetsToIndexedDB(updated).catch(() => {});

      const target = lockedTarget || updated.find((a) => a.id === id);
      if (target) {
        saveAsetToCpanel(target).catch((err) => console.warn('[cPanel] Aset update failed:', err));
        syncManager.broadcastAsetUpdate(target);
      }

      syncManager.broadcastChange({
        version: 2,
        timestamp: now,
        senderId: 'client',
        asets: updated,
        verifikasiList,
        pengesahanList,
        desas,
        users,
        kecamatanProfile,
      });

      return updated;
    });
  };

  const perbaikiSemuaNomorRegister = useCallback(async (): Promise<{ fixedCount: number; message: string }> => {
    const currentPool = asetsRef.current.length > 0 ? asetsRef.current : asets;
    const { asets: normalizedRaw, changedIds, fixedCount } = normalizeAsetRegisters(currentPool, desas);

    if (fixedCount === 0) {
      return {
        fixedCount: 0,
        message: 'Seluruh nomor register aset sudah unik dan berurutan rapi (tidak ada duplikat).',
      };
    }

    const now = new Date().toISOString();
    const changedSet = new Set(changedIds);
    const updatedList = normalizedRaw.map((item) =>
      changedSet.has(item.id) ? { ...item, updatedAt: now } : item
    );
    const repairedItems = updatedList.filter((item) => changedSet.has(item.id));

    pausePulseUntil.current = Date.now() + 15000;
    asetsRef.current = updatedList;
    setAsets(updatedList);
    persistAsetsSafely(updatedList);
    saveAsetsToIndexedDB(updatedList).catch(() => {});

    await saveBatchToCpanel(repairedItems).catch((err) =>
      console.warn('[cPanel] Auto-repair register sync notice:', err)
    );
    syncManager.broadcastChange({
      version: 2,
      timestamp: now,
      senderId: 'client',
      asets: updatedList,
      verifikasiList,
      pengesahanList,
      desas,
      users,
      kecamatanProfile,
    });

    return {
      fixedCount,
      message: `Berhasil memperbaiki dan mengunci ${fixedCount} aset agar seluruh nomor register unik dan berurutan.`,
    };
  }, [asets, desas, kecamatanProfile, pengesahanList, persistAsetsSafely, users, verifikasiList]);

  const deleteAset = (id: string) => {
    const target = asets.find((a) => a.id === id);
    if (!target) return { success: false, message: 'Aset tidak ditemukan!' };
    if (target.status === 'mutasi_diajukan' || target.status === 'terhapus_diajukan') {
      return {
        success: false,
        message: 'Aset sedang dalam proses permohonan verifikasi Kecamatan, tidak dapat dihapus langsung!',
      };
    }

    pausePulseUntil.current = Date.now() + 15000;

    // 1. Record ID in permanent tombstone set
    setDeletedAssetIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(STORAGE_KEYS.DELETED_ASETS, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    // 2. Remove from local state & storage immediately
    const filtered = asets.filter((a) => a.id !== id);
    asetsRef.current = filtered;
    setAsets(filtered);
    persistAsetsSafely(filtered);
    saveAsetsToIndexedDB(filtered).catch(() => {});

    // 3. Broadcast deletion event to all connected devices (P2P + Cloud)
    syncManager.broadcastDelete(id, filtered);

    // 4. Delete directly from cPanel Hosting & server database
    deleteAsetFromCpanel(id).catch((err) => console.warn('[cPanel] Aset delete failed:', err));

    return { success: true, message: 'Data aset berhasil dihapus permanen.' };
  };

  // Verifikasi Aset Baru (Khusus Admin / Super Admin)
  // Verifikasi Aset Baru (Khusus Admin / Super Admin)
  const pendingVerificationCount = useMemo(() => {
    return asets.filter((a) => {
      if (a.status === 'terhapus') return false;
      return (
        a.statusVerifikasi === 'sedang_diproses' ||
        a.statusVerifikasi === 'belum_diverifikasi' ||
        a.statusVerifikasi === 'perlu_perbaikan' ||
        a.status === 'mutasi_diajukan' ||
        a.status === 'terhapus_diajukan' ||
        verifikasiList.some((v) => v.asetId === a.id && v.status === 'menunggu_verifikasi')
      );
    }).length;
  }, [asets, verifikasiList]);

  // Khusus antrean verifikasi aset yang baru diinput atau perlu dicek
  const pendingAsetVerificationCount = useMemo(() => {
    return asets.filter((a) => {
      if (!a || a.status === 'terhapus') return false;
      return (
        a.statusVerifikasi === 'sedang_diproses' ||
        a.statusVerifikasi === 'belum_diverifikasi' ||
        a.statusVerifikasi === 'perlu_perbaikan'
      );
    }).length;
  }, [asets]);

  const verifikasiAset = useCallback(
    async (asetId: string, catatan?: string, nomorSK?: string) => {
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin_kecamatan')) {
        return {
          success: false,
          message: 'Hanya Admin Kecamatan atau Super Admin yang berhak memverifikasi aset.',
        };
      }

      const now = new Date().toISOString();
      const verifierName = currentUser.name || 'Admin Kecamatan Sirombu';
      pausePulseUntil.current = Date.now() + 15000;

      let verifiedAset: Aset | null = null;
      setAsets((prev) => {
        const next = prev.map((a) => {
          if (a.id === asetId) {
            verifiedAset = {
              ...a,
              statusVerifikasi: 'sudah_diverifikasi',
              diverifikasiOleh: verifierName,
              tanggalVerifikasi: now,
              catatanVerifikasi: catatan || a.catatanVerifikasi || 'Telah diverifikasi fisik & berkas sah oleh Admin Kecamatan Sirombu',
              nomorSKVerifikasi: nomorSK || a.nomorSKVerifikasi,
              updatedAt: now,
            };
            return verifiedAset;
          }
          return a;
        });
        persistAsetsSafely(next);
        return next;
      });

      if (verifiedAset) {
        await saveAsetToCpanel(verifiedAset).catch((err) => console.warn('[cPanel] Verifikasi save error:', err));
        syncManager.broadcastAsetUpdate(verifiedAset);
      }

      return {
        success: true,
        message: `Aset berhasil diverifikasi dan disahkan oleh ${verifierName}.`,
      };
    },
    [currentUser, persistAsetsSafely]
  );

  const tolakVerifikasiAset = useCallback(
    async (asetId: string, catatanPerbaikan: string) => {
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin_kecamatan')) {
        return {
          success: false,
          message: 'Hanya Admin Kecamatan atau Super Admin yang berhak memeriksa aset.',
        };
      }

      const now = new Date().toISOString();
      const verifierName = currentUser.name || 'Admin Kecamatan Sirombu';
      pausePulseUntil.current = Date.now() + 15000;

      let rejectedAset: Aset | null = null;
      setAsets((prev) => {
        const next = prev.map((a) => {
          if (a.id === asetId) {
            rejectedAset = {
              ...a,
              statusVerifikasi: 'perlu_perbaikan',
              diverifikasiOleh: verifierName,
              tanggalVerifikasi: now,
              catatanVerifikasi: catatanPerbaikan || 'Perlu perbaikan data / kelengkapan bukti dokumen fisik',
              updatedAt: now,
            };
            return rejectedAset;
          }
          return a;
        });
        asetsRef.current = next;
        persistAsetsSafely(next);
        return next;
      });

      if (rejectedAset) {
        await saveAsetToCpanel(rejectedAset).catch((err) => console.warn('[cPanel] Tolak verifikasi save error:', err));
        syncManager.broadcastAsetUpdate(rejectedAset);
      }

      return {
        success: true,
        message: `Catatan perbaikan berhasil dikirim ke Desa. Aset berstatus Perlu Perbaikan.`,
      };
    },
    [currentUser, persistAsetsSafely]
  );

  const batalkanVerifikasiAset = useCallback(
    async (asetId: string) => {
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin_kecamatan')) {
        return {
          success: false,
          message: 'Hanya Admin Kecamatan atau Super Admin yang berhak mengubah status verifikasi.',
        };
      }

      const now = new Date().toISOString();
      pausePulseUntil.current = Date.now() + 15000;
      let unverifiedAset: Aset | null = null;
      setAsets((prev) => {
        const next = prev.map((a) => {
          if (a.id === asetId) {
            unverifiedAset = {
              ...a,
              statusVerifikasi: 'sedang_diproses',
              diverifikasiOleh: undefined,
              tanggalVerifikasi: undefined,
              catatanVerifikasi: undefined,
              nomorSKVerifikasi: undefined,
              updatedAt: now,
            };
            return unverifiedAset;
          }
          return a;
        });
        asetsRef.current = next;
        persistAsetsSafely(next);
        return next;
      });

      if (unverifiedAset) {
        await saveAsetToCpanel(unverifiedAset).catch((err) => console.warn('[cPanel] Batalkan verifikasi error:', err));
        syncManager.broadcastAsetUpdate(unverifiedAset);
      }

      return {
        success: true,
        message: `Status verifikasi aset berhasil dibatalkan dan dikembalikan ke antrean pemeriksaan.`,
      };
    },
    [currentUser, persistAsetsSafely]
  );

  const batalkanVerifikasiAsetBatch = useCallback(
    async (asetIds: string[]) => {
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin_kecamatan')) {
        return {
          success: false,
          count: 0,
          message: 'Hanya Admin Kecamatan atau Super Admin yang berhak membatalkan pengesahan aset.',
        };
      }
      if (!asetIds || asetIds.length === 0) {
        return { success: false, count: 0, message: 'Tidak ada aset yang dipilih.' };
      }

      const now = new Date().toISOString();
      pausePulseUntil.current = Date.now() + 15000;
      const idSet = new Set(asetIds);
      const baseList = asetsRef.current.length > 0 ? asetsRef.current : asets;
      const updatedBatch: Aset[] = [];

      const updatedList = baseList.map((a) => {
        if (idSet.has(a.id)) {
          const item: Aset = {
            ...a,
            statusVerifikasi: 'sedang_diproses',
            diverifikasiOleh: undefined,
            tanggalVerifikasi: undefined,
            catatanVerifikasi: undefined,
            nomorSKVerifikasi: undefined,
            updatedAt: now,
          };
          updatedBatch.push(item);
          return item;
        }
        return a;
      });

      asetsRef.current = updatedList;
      setAsets(updatedList);
      persistAsetsSafely(updatedList);

      await saveBatchToCpanel(updatedBatch).catch((err) =>
        console.warn('[cPanel] Batch batalkan pengesahan failed:', err)
      );

      return {
        success: true,
        count: updatedBatch.length,
        message: `Berhasil membatalkan pengesahan ${updatedBatch.length} aset.`,
      };
    },
    [asets, currentUser, persistAsetsSafely]
  );

  const verifikasiAsetBatch = useCallback(
    async (asetIds: string[], catatan?: string, nomorSK?: string) => {
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin_kecamatan')) {
        return {
          success: false,
          count: 0,
          message: 'Hanya Admin Kecamatan atau Super Admin yang berhak memverifikasi aset.',
        };
      }

      if (!asetIds || asetIds.length === 0) {
        return { success: false, count: 0, message: 'Tidak ada aset yang dipilih.' };
      }

      const now = new Date().toISOString();
      const verifierName = currentUser.name || 'Admin Kecamatan Sirombu';
      pausePulseUntil.current = Date.now() + 15000;

      const baseList = asetsRef.current.length > 0 ? asetsRef.current : asets;
      const updatedBatch: Aset[] = [];
      const updatedList = baseList.map((a) => {
        if (asetIds.includes(a.id)) {
          const item: Aset = {
            ...a,
            statusVerifikasi: 'sudah_diverifikasi',
            diverifikasiOleh: verifierName,
            tanggalVerifikasi: now,
            catatanVerifikasi: catatan || a.catatanVerifikasi || 'Telah diverifikasi serentak oleh Tim Monitoring Kecamatan Sirombu',
            nomorSKVerifikasi: nomorSK || a.nomorSKVerifikasi,
            updatedAt: now,
          };
          updatedBatch.push(item);
          return item;
        }
        return a;
      });

      asetsRef.current = updatedList;
      setAsets(updatedList);
      persistAsetsSafely(updatedList);

      await saveBatchToCpanel(updatedBatch).catch((err) =>
        console.warn('[cPanel] Batch verifikasi failed:', err)
      );

      return {
        success: true,
        count: updatedBatch.length,
        message: `Berhasil memverifikasi ${updatedBatch.length} aset desa terpilih.`,
      };
    },
    [currentUser, asets, persistAsetsSafely]
  );

  const verifikasiSemuaAsetPending = useCallback(async () => {
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin_kecamatan')) {
      return {
        success: false,
        count: 0,
        message: 'Hanya Admin Kecamatan atau Super Admin yang berhak memverifikasi aset.',
      };
    }

    const now = new Date().toISOString();
    const verifierName = currentUser.name || 'Admin Kecamatan Sirombu';
    pausePulseUntil.current = Date.now() + 15000;

    const baseList = asetsRef.current.length > 0 ? asetsRef.current : asets;
    const pendingIds = baseList
      .filter(
        (a) =>
          a.status !== 'terhapus' &&
          (a.statusVerifikasi === 'sedang_diproses' ||
            a.statusVerifikasi === 'belum_diverifikasi' ||
            a.statusVerifikasi === 'perlu_perbaikan' ||
            a.status === 'mutasi_diajukan' ||
            a.status === 'terhapus_diajukan')
      )
      .map((a) => a.id);

    if (pendingIds.length === 0) {
      return {
        success: true,
        count: 0,
        message: 'Tidak ada aset yang sedang menunggu verifikasi.',
      };
    }

    const updatedList = baseList.map((a) => {
      if (pendingIds.includes(a.id)) {
        return {
          ...a,
          statusVerifikasi: 'sudah_diverifikasi' as const,
          status: 'aktif' as const,
          diverifikasiOleh: verifierName,
          tanggalVerifikasi: now,
          catatanVerifikasi: 'Diverifikasi sah serentak oleh Admin Kecamatan',
          updatedAt: now,
        };
      }
      return a;
    });

    asetsRef.current = updatedList;
    setAsets(updatedList);
    persistAsetsSafely(updatedList);

    const verifiedBatch = updatedList.filter((a) => pendingIds.includes(a.id));
    await saveBatchToCpanel(verifiedBatch).catch((err) =>
      console.warn('[cPanel] Verifikasi semua batch failed:', err)
    );

    return {
      success: true,
      count: pendingIds.length,
      message: `Semua ${pendingIds.length} aset desa berhasil diverifikasi sah oleh ${verifierName}.`,
    };
  }, [currentUser, asets, persistAsetsSafely]);

  // Mutasi & Penghapusan Verifikasi
  const ajukanMutasi = (
    asetId: string,
    alasan: string,
    nomorSuratDesa: string,
    dokumenPendukung: string,
    tujuanMutasi: string
  ) => {
    const target = asets.find((a) => a.id === asetId);
    if (!target) return;

    const newReq: PermohonanVerifikasi = {
      id: `vrf-${Date.now()}`,
      asetId,
      desaId: target.desaId,
      desaName: target.desaName,
      tipe: 'mutasi',
      asetSnapshot: { ...target },
      tanggalPengajuan: new Date().toISOString(),
      alasan,
      nomorSuratDesa,
      dokumenPendukung,
      tujuanMutasi,
      status: 'menunggu_verifikasi',
    };

    setVerifikasiList((prev) => {
      const nextList = [newReq, ...prev];
      saveVerifikasiToCpanel(nextList).catch((err) => console.warn('[cPanel] Verifikasi save failed:', err));
      return nextList;
    });
    updateAset(asetId, { status: 'mutasi_diajukan' });

    fetch('/api/verifikasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReq),
    }).catch((e) => console.warn('[Sync] Mutasi request failed:', e));
  };

  const ajukanPenghapusan = (
    asetId: string,
    alasan: string,
    nomorSuratDesa: string,
    dokumenPendukung: string
  ) => {
    const target = asets.find((a) => a.id === asetId);
    if (!target) return;

    const newReq: PermohonanVerifikasi = {
      id: `vrf-${Date.now()}`,
      asetId,
      desaId: target.desaId,
      desaName: target.desaName,
      tipe: 'penghapusan',
      asetSnapshot: { ...target },
      tanggalPengajuan: new Date().toISOString(),
      alasan,
      nomorSuratDesa,
      dokumenPendukung,
      status: 'menunggu_verifikasi',
    };

    setVerifikasiList((prev) => {
      const nextList = [newReq, ...prev];
      saveVerifikasiToCpanel(nextList).catch((err) => console.warn('[cPanel] Verifikasi save failed:', err));
      return nextList;
    });
    updateAset(asetId, { status: 'terhapus_diajukan' });

    fetch('/api/verifikasi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReq),
    }).catch((e) => console.warn('[Sync] Penghapusan request failed:', e));
  };

  const prosesVerifikasi = (
    verifikasiId: string,
    status: 'disetujui' | 'ditolak',
    catatanKecamatan: string,
    nomorSKKecamatan?: string
  ) => {
    const verif = verifikasiList.find((v) => v.id === verifikasiId);
    if (!verif) return;

    const verifierName = currentUser?.name || 'Admin Kecamatan Sirombu';
    const now = new Date().toISOString();
    const finalSK = nomorSKKecamatan || (status === 'disetujui' ? `SK-KEC-SRB/${new Date().getFullYear()}/${verif.id.slice(-4)}` : undefined);

    const updatedVerif: PermohonanVerifikasi = {
      ...verif,
      status,
      tanggalDiproses: now,
      diverifikasiOleh: verifierName,
      catatanKecamatan,
      nomorSKKecamatan: finalSK,
    };

    setVerifikasiList((prev) => {
      const nextList = prev.map((v) => (v.id === verifikasiId ? updatedVerif : v));
      saveVerifikasiToCpanel(nextList).catch((err) => console.warn('[cPanel] Verifikasi update failed:', err));
      return nextList;
    });
    fetch(`/api/verifikasi/${verifikasiId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        tanggalDiproses: now,
        diverifikasiOleh: verifierName,
        catatanKecamatan,
        nomorSKKecamatan: finalSK,
      }),
    }).catch((e) => console.warn('[Sync] Process verifikasi failed:', e));

    // Update asset status
    const targetAset = asets.find((a) => a.id === verif.asetId);
    const prevKeterangan = targetAset?.keterangan ? targetAset.keterangan.trim() : '';
    const prefixKet = prevKeterangan ? `${prevKeterangan} | ` : '';
    const tanggalFormatted = formatTanggalIndonesia(now);

    if (status === 'disetujui') {
      if (verif.tipe === 'penghapusan') {
        updateAset(verif.asetId, {
          status: 'terhapus',
          keterangan: `${prefixKet}Telah dihapus pada tanggal ${tanggalFormatted} (SK Kecamatan Sirombu No. ${finalSK || 'SK-KEC-SRB'}. Alasan: ${verif.alasan})`,
        });
      } else if (verif.tipe === 'mutasi') {
        const tujuanClean = (verif.tujuanMutasi || '').trim();
        const keteranganMutasi = `${prefixKet}Telah dilakukan mutasi dari ${verif.desaName} ke ${tujuanClean} pada tanggal ${tanggalFormatted} (SK Kecamatan Sirombu No. ${finalSK || 'SK-KEC-SRB'})`;

        const targetDesa = desas.find((d) => {
          const dNameClean = d.name.toLowerCase().replace(/^desa\s+/i, '').trim();
          const tClean = tujuanClean.toLowerCase().replace(/^desa\s+/i, '').trim();
          return (
            d.id.toLowerCase() === tujuanClean.toLowerCase() ||
            d.name.toLowerCase() === tujuanClean.toLowerCase() ||
            dNameClean === tClean ||
            tujuanClean.toLowerCase().includes(dNameClean)
          );
        });

        if (targetDesa && targetDesa.id !== verif.desaId) {
          updateAset(verif.asetId, {
            desaId: targetDesa.id,
            desaName: targetDesa.name,
            status: 'aktif',
            keterangan: keteranganMutasi,
          });
        } else {
          updateAset(verif.asetId, {
            status: 'terhapus',
            keterangan: keteranganMutasi,
          });
        }
      }
    } else {
      updateAset(verif.asetId, {
        status: 'aktif',
        keterangan: `${verif.asetSnapshot.keterangan || ''} (Pengajuan ${verif.tipe} ditolak Kecamatan: ${catatanKecamatan})`,
      });
    }
  };

  const ajukanPengesahan = (desaId: string, tahun: number) => {
    const desa = desas.find((d) => d.id === desaId);
    const desaName = desa ? desa.name : 'DESA';
    const existing = pengesahanList.find((p) => p.desaId === desaId && p.tahun === tahun);

    let targetPengesahan: PengesahanLaporan;
    if (existing) {
      targetPengesahan = { ...existing, status: 'diajukan', diajukanPada: new Date().toISOString() };
      setPengesahanList((prev) =>
        prev.map((p) => (p.id === existing.id ? targetPengesahan : p))
      );
    } else {
      targetPengesahan = {
        id: `png-${desaId}-${tahun}`,
        desaId,
        desaName,
        tahun,
        status: 'diajukan',
        diajukanPada: new Date().toISOString(),
      };
      setPengesahanList((prev) => [targetPengesahan, ...prev]);
    }
    savePengesahanToCpanel([targetPengesahan, ...pengesahanList]).catch((e) => console.warn('[cPanel] Pengesahan save failed:', e));
  };

  const prosesPengesahan = (
    desaId: string,
    tahun: number,
    status: 'disetujui' | 'perlu_perbaikan',
    catatan: string
  ) => {
    const existing = pengesahanList.find((p) => p.desaId === desaId && p.tahun === tahun);
    const verifierName = currentUser?.name || 'Dodi Tribuana (Admin Kecamatan Sirombu)';
    const now = new Date().toISOString();

    let targetPengesahan: PengesahanLaporan;
    if (existing) {
      targetPengesahan = {
        ...existing,
        status,
        catatanKecamatan: catatan,
        disetujuiPada: status === 'disetujui' ? now : undefined,
        disetujuiOleh: status === 'disetujui' ? verifierName : undefined,
      };
      setPengesahanList((prev) =>
        prev.map((p) => (p.id === existing.id ? targetPengesahan : p))
      );
    } else {
      const desa = desas.find((d) => d.id === desaId);
      targetPengesahan = {
        id: `png-${desaId}-${tahun}`,
        desaId,
        desaName: desa?.name || 'DESA',
        tahun,
        status,
        catatanKecamatan: catatan,
        disetujuiPada: status === 'disetujui' ? now : undefined,
        disetujuiOleh: status === 'disetujui' ? verifierName : undefined,
      };
      setPengesahanList((prev) => [targetPengesahan, ...prev]);
    }
    savePengesahanToCpanel([targetPengesahan, ...pengesahanList]).catch((e) => console.warn('[cPanel] Pengesahan save failed:', e));
  };

  const updateDesa = async (id: string, data: Partial<Desa>): Promise<{ success: boolean; message: string }> => {
    let updatedDesa: Desa | null = null;
    let finalDesas: Desa[] = [];

    setDesas((prev) => {
      finalDesas = prev.map((d) => {
        if (d.id === id) {
          updatedDesa = { ...d, ...data };
          return updatedDesa;
        }
        return d;
      });
      safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(finalDesas));
      return finalDesas;
    });

    if (!updatedDesa) {
      const target = desas.find((d) => d.id === id);
      if (target) {
        updatedDesa = { ...target, ...data };
      }
    }

    if (updatedDesa) {
      const targetName = (updatedDesa as Desa).name || 'Desa';
      // 1. Direct write to cPanel Hosting
      saveDesasToCpanel(finalDesas.length > 0 ? finalDesas : desas.map((d) => (d.id === id ? updatedDesa! : d))).catch((e) =>
        console.warn('[cPanel] Desa save error:', e)
      );

      // 2. Save to server
      fetch('/api/desa/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDesa),
      }).catch((e) => console.warn('[Sync] Desa update failed:', e));

      // 3. Instantly broadcast to all other open devices & tabs (granular & full)
      syncManager.broadcastDesaUpdate(updatedDesa);
      syncManager.broadcastChange({
        version: 2,
        timestamp: new Date().toISOString(),
        senderId: 'client',
        updatedDesa,
        asets,
        verifikasiList,
        pengesahanList,
        desas: finalDesas.length > 0 ? finalDesas : desas.map((d) => (d.id === id ? { ...d, ...data } : d)),
        users,
        kecamatanProfile,
      });

      return {
        success: true,
        message: `Data Perangkat ${targetName} berhasil disimpan permanen ke Hosting cPanel & tersinkronisasi!`,
      };
    }

    return { success: true, message: 'Data Perangkat Desa berhasil disimpan.' };
  };

  const revisiMutasi = (
    verifikasiId: string,
    data: {
      alasan: string;
      nomorSuratDesa: string;
      dokumenPendukung: string;
      tujuanMutasi?: string;
    }
  ) => {
    const target = verifikasiList.find((v) => v.id === verifikasiId);
    if (!target) return { success: false, message: 'Permohonan mutasi tidak ditemukan!' };

    const now = new Date().toISOString();
    const updatedVerif: PermohonanVerifikasi = {
      ...target,
      alasan: data.alasan,
      nomorSuratDesa: data.nomorSuratDesa,
      dokumenPendukung: data.dokumenPendukung,
      tujuanMutasi: data.tujuanMutasi ?? target.tujuanMutasi,
      status: 'menunggu_verifikasi',
      tanggalPengajuan: now,
      tanggalDiproses: undefined,
      diverifikasiOleh: undefined,
      nomorSKKecamatan: undefined,
    };

    setVerifikasiList((prev) => {
      const nextList = prev.map((v) => (v.id === verifikasiId ? updatedVerif : v));
      saveVerifikasiToCpanel(nextList).catch((e) => console.warn('[cPanel] Revisi verifikasi failed:', e));
      return nextList;
    });

    const newStatus = target.tipe === 'mutasi' ? 'mutasi_diajukan' : 'terhapus_diajukan';
    updateAset(target.asetId, {
      status: newStatus,
      keterangan: `${target.asetSnapshot.keterangan || ''} (Revisi permohonan telah diajukan kembali ke Kecamatan Sirombu)`,
    });

    fetch(`/api/verifikasi/${verifikasiId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alasan: data.alasan,
        nomorSuratDesa: data.nomorSuratDesa,
        dokumenPendukung: data.dokumenPendukung,
        tujuanMutasi: data.tujuanMutasi ?? target.tujuanMutasi,
        status: 'menunggu_verifikasi',
        tanggalPengajuan: now,
      }),
    }).catch((e) => console.warn('[Sync] Revisi mutasi failed:', e));

    return { success: true, message: 'Permohonan berhasil direvisi dan diajukan ulang!' };
  };

  const deleteVerifikasi = (verifikasiId: string) => {
    const target = verifikasiList.find((v) => v.id === verifikasiId);
    if (!target) return { success: false, message: 'Data permohonan tidak ditemukan!' };

    const relatedAset = asets.find((a) => a.id === target.asetId);
    if (relatedAset && (relatedAset.status === 'mutasi_diajukan' || relatedAset.status === 'terhapus_diajukan')) {
      updateAset(target.asetId, {
        status: 'aktif',
      });
    }

    setVerifikasiList((prev) => {
      const nextList = prev.filter((v) => v.id !== verifikasiId);
      saveVerifikasiToCpanel(nextList).catch((e) => console.warn('[cPanel] Delete verifikasi failed:', e));
      return nextList;
    });

    fetch(`/api/verifikasi/${verifikasiId}`, {
      method: 'DELETE',
    }).catch((e) => console.warn('[Sync] Delete verifikasi failed:', e));

    return { success: true, message: 'Data permohonan mutasi berhasil dihapus!' };
  };

  const getBackupData = (desaId?: string) => {
    const isPerDesa = Boolean(desaId && desaId !== 'all');
    const targetDesa = isPerDesa ? desas.find((d) => d.id === desaId) : null;

    const filteredAsets = isPerDesa ? asets.filter((a) => a.desaId === desaId) : asets;
    const filteredVerifikasi = isPerDesa ? verifikasiList.filter((v) => v.desaId === desaId) : verifikasiList;
    const filteredPengesahan = isPerDesa ? pengesahanList.filter((p) => p.desaId === desaId) : pengesahanList;
    const filteredUsers = isPerDesa ? users.filter((u) => u.desaId === desaId) : users;
    const filteredDesas = isPerDesa && targetDesa ? [targetDesa] : desas;

    return {
      appName: 'SIPADES SIROMBU - Nias Barat',
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      timestamp: Date.now(),
      scope: isPerDesa ? 'desa' : 'all',
      desaId: isPerDesa ? desaId : 'all',
      desaName: isPerDesa ? (targetDesa?.name || 'Desa') : 'Semua Desa se-Kecamatan Sirombu',
      data: {
        desas: filteredDesas,
        users: filteredUsers,
        asets: filteredAsets,
        verifikasiList: filteredVerifikasi,
        pengesahanList: filteredPengesahan,
        kecamatanProfile,
        selectedYear,
      },
    };
  };

  const restoreBackupData = (backupJson: any, targetDesaId?: string) => {
    try {
      if (!backupJson || typeof backupJson !== 'object') {
        return { success: false, message: 'Format berkas JSON cadangan tidak valid!' };
      }

      const payload = backupJson.data || backupJson;

      if (!Array.isArray(payload.asets) && !Array.isArray(payload.desas)) {
        return { success: false, message: 'Berkas tidak memuat struktur basis data SIPADES yang sesuai!' };
      }

      // Check if this is a per-desa restore
      // Target desa is explicitly chosen OR if the backup itself is marked with scope === 'desa'
      const effectiveDesaId = targetDesaId && targetDesaId !== 'all' 
        ? targetDesaId 
        : backupJson.scope === 'desa' && backupJson.desaId && backupJson.desaId !== 'all'
        ? backupJson.desaId
        : undefined;

      if (effectiveDesaId) {
        // PER-DESA RESTORE: Restore only for this village, keep other villages intact!
        const targetDesa = desas.find((d) => d.id === effectiveDesaId) || payload.desas?.[0];
        const targetDesaName = targetDesa?.name || 'Desa Terpilih';

        // 1. Assets: Replace/update only this village's assets, preserve other villages
        const incomingDesaAsets = (Array.isArray(payload.asets) ? payload.asets : [])
          .filter((a: Aset) => {
            if (backupJson.scope === 'desa') return true;
            if (Array.isArray(payload.desas) && payload.desas.length === 1) return true;
            if (a.desaId === effectiveDesaId) return true;
            if (
              a.desaName &&
              targetDesaName &&
              a.desaName.toLowerCase().replace(/^desa\s+/i, '').trim() ===
                targetDesaName.toLowerCase().replace(/^desa\s+/i, '').trim()
            ) {
              return true;
            }
            return false;
          })
          .map((a: Aset) => {
            const exist = asets.find((item) => item.id === a.id);
            let fotoAset = a.fotoAset;
            if ((!fotoAset || fotoAset.length === 0) && exist?.fotoAset && exist.fotoAset.length > 0) {
              fotoAset = exist.fotoAset;
            }
            let fotoBast = a.fotoBast || exist?.fotoBast || '';
            return {
              ...a,
              desaId: effectiveDesaId,
              desaName: targetDesaName,
              fotoAset: fotoAset || [],
              fotoBast,
            };
          });

        const otherAsets = asets.filter((a) => a.desaId !== effectiveDesaId);
        const updatedAsets = [...otherAsets, ...incomingDesaAsets];
        setAsets(updatedAsets);
        persistAsetsSafely(updatedAsets);
        saveAsetsToIndexedDB(updatedAsets);
        saveBatchToCpanel(incomingDesaAsets).catch(() => {});

        // 2. Verifikasi: Replace only this village's verifikasi
        const incomingVerifikasi = (Array.isArray(payload.verifikasiList) ? payload.verifikasiList : [])
          .filter((v: any) => {
            if (backupJson.scope === 'desa') return true;
            if (Array.isArray(payload.desas) && payload.desas.length === 1) return true;
            if (v.desaId === effectiveDesaId) return true;
            return false;
          })
          .map((v: any) => ({ ...v, desaId: effectiveDesaId, namaDesa: targetDesaName }));
        const otherVerifikasi = verifikasiList.filter((v) => v.desaId !== effectiveDesaId);
        const updatedVerifikasi = [...otherVerifikasi, ...incomingVerifikasi];
        setVerifikasiList(updatedVerifikasi);
        safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(updatedVerifikasi));

        // 3. Pengesahan:
        const incomingPengesahan = (Array.isArray(payload.pengesahanList) ? payload.pengesahanList : [])
          .filter((p: any) => !targetDesaId || targetDesaId === 'all' || p.desaId === targetDesaId || backupJson.scope === 'desa')
          .map((p: any) => ({ ...p, desaId: effectiveDesaId, namaDesa: targetDesaName }));
        const otherPengesahan = pengesahanList.filter((p) => p.desaId !== effectiveDesaId);
        const updatedPengesahan = [...otherPengesahan, ...incomingPengesahan];
        setPengesahanList(updatedPengesahan);
        safeLocalStorageSetItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(updatedPengesahan));

        // 4. Desa profile if provided in backup:
        let updatedDesas = desas;
        if (Array.isArray(payload.desas) && payload.desas.length > 0) {
          const incomingDesaProfile = payload.desas.find((d: Desa) => d.id === effectiveDesaId) || payload.desas[0];
          if (incomingDesaProfile) {
            updatedDesas = desas.map((d) => (d.id === effectiveDesaId ? { ...d, ...incomingDesaProfile, id: effectiveDesaId } : d));
            setDesas(updatedDesas);
            safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(updatedDesas));
            saveDesasToCpanel(updatedDesas).catch(() => {});
          }
        }

        // 5. Users if provided:
        let updatedUsers = users;
        if (Array.isArray(payload.users) && payload.users.length > 0) {
          const incomingUsers = payload.users.filter((u: User) => !targetDesaId || targetDesaId === 'all' || u.desaId === targetDesaId || backupJson.scope === 'desa').map((u: User) => ({ ...u, desaId: effectiveDesaId }));
          if (incomingUsers.length > 0) {
            const otherUsers = users.filter((u) => u.desaId !== effectiveDesaId);
            updatedUsers = [...otherUsers, ...incomingUsers];
            setUsers(updatedUsers);
            safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
          }
        }

        // Sync to central server
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            desas: updatedDesas,
            users: updatedUsers,
            asets: updatedAsets,
            verifikasiList: updatedVerifikasi,
            kecamatanProfile,
            selectedYear,
          }),
        }).catch((e) => console.warn('[Sync] Restore sync failed:', e));

        return {
          success: true,
          message: `Data untuk ${targetDesaName} berhasil dipulihkan! (${incomingDesaAsets.length} aset). Data 24 desa lainnya tetap aman dan tidak terhapus.`,
          stats: {
            asets: incomingDesaAsets.length,
            verifikasi: incomingVerifikasi.length,
            desas: 1,
            users: (Array.isArray(payload.users) ? payload.users : []).length,
          },
        };
      }

      // FULL RESTORE (Seluruh Desa)
      if (Array.isArray(payload.desas) && payload.desas.length > 0) {
        setDesas(payload.desas);
        safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(payload.desas));
      }
      if (Array.isArray(payload.users) && payload.users.length > 0) {
        setUsers(payload.users);
        safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(payload.users));
      }
      if (Array.isArray(payload.asets)) {
        const existingMap = new Map<string, Aset>(asets.map((a) => [a.id, a]));
        const rawMergedAsets = payload.asets.map((incoming: Aset) => {
          const exist = existingMap.get(incoming.id);
          let fotoAset = incoming.fotoAset;
          if ((!fotoAset || fotoAset.length === 0) && exist?.fotoAset && exist.fotoAset.length > 0) {
            fotoAset = exist.fotoAset;
          }
          let fotoBast = incoming.fotoBast || exist?.fotoBast || '';
          return {
            ...incoming,
            fotoAset: fotoAset || [],
            fotoBast,
          };
        });
        const mergedAsets = normalizeAsetRegisters(deduplicateAsets(rawMergedAsets, deletedAssetIds), desas).asets;

        setAsets(mergedAsets);
        persistAsetsSafely(mergedAsets);
        saveAsetsToIndexedDB(mergedAsets);
      }

      // Replicate all restored data immediately to cPanel Hosting in unified batch
      saveAllToCpanel({
        desas: payload.desas,
        users: payload.users,
        asets: payload.asets,
        verifikasiList: payload.verifikasiList,
        pengesahanList: payload.pengesahanList,
        kecamatanProfile: payload.kecamatanProfile,
      }).catch((err) => console.warn('[cPanel] Restore to cPanel notice:', err));

      if (Array.isArray(payload.verifikasiList)) {
        setVerifikasiList(payload.verifikasiList);
        safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(payload.verifikasiList));
      }
      if (Array.isArray(payload.pengesahanList)) {
        setPengesahanList(payload.pengesahanList);
        safeLocalStorageSetItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(payload.pengesahanList));
      }
      if (payload.kecamatanProfile) {
        setKecamatanProfile(payload.kecamatanProfile);
        safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(payload.kecamatanProfile));
      }
      if (payload.selectedYear) {
        setSelectedYear(payload.selectedYear);
      }

      // Sync restored data to central server and cPanel Hosting
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desas: payload.desas,
          users: payload.users,
          asets: payload.asets,
          verifikasiList: payload.verifikasiList,
          kecamatanProfile: payload.kecamatanProfile,
          selectedYear: payload.selectedYear,
        }),
      }).catch((e) => console.warn('[Sync] Restore sync failed:', e));

      fetch('/api/cpanel/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { data: payload } }),
      }).catch((e) => console.warn('[cPanel Restore] Upload failed:', e));

      return {
        success: true,
        message: 'Data SIPADES seluruh desa berhasil dipulihkan dan disinkronkan ke cPanel Hosting!',
        stats: {
          asets: Array.isArray(payload.asets) ? payload.asets.length : 0,
          verifikasi: Array.isArray(payload.verifikasiList) ? payload.verifikasiList.length : 0,
          desas: Array.isArray(payload.desas) ? payload.desas.length : 0,
          users: Array.isArray(payload.users) ? payload.users.length : 0,
        },
      };
    } catch (err: any) {
      return { success: false, message: `Gagal memulihkan cadangan: ${err?.message || 'Format tidak didukung'}` };
    }
  };

  const updateKecamatanProfile = async (data: Partial<KecamatanProfile>): Promise<{ success: boolean; message: string }> => {
    let updated: KecamatanProfile = kecamatanProfile;
    setKecamatanProfile((prev) => {
      updated = { ...prev, ...data };
      safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(updated));
      return updated;
    });

    saveKecamatanToCpanel(updated).catch((e) => console.warn('[cPanel] Kecamatan save failed:', e));

    fetch('/api/kecamatan/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch((e) => console.warn('[Sync] Kecamatan update failed:', e));

    syncManager.broadcastChange({
      version: 2,
      timestamp: new Date().toISOString(),
      senderId: 'client',
      asets,
      verifikasiList,
      pengesahanList,
      desas,
      users,
      kecamatanProfile: updated,
    });

    return {
      success: true,
      message: 'Data Camat & Kantor Kecamatan Sirombu berhasil disimpan permanen ke Hosting cPanel!',
    };
  };

  const saveAllToCloudFirebase = async (overrides?: {
    desas?: Desa[];
    kecamatanProfile?: KecamatanProfile;
    users?: User[];
    asets?: Aset[];
  }): Promise<{ success: boolean; message: string }> => {
    try {
      const payloadDesas = overrides?.desas || desas;
      const payloadKecamatan = overrides?.kecamatanProfile || kecamatanProfile;
      const payloadUsers = overrides?.users || users;
      const payloadAsets = overrides?.asets || asets;

      // 1. Authoritative write to cPanel Hosting
      await saveAllToCpanel({
        desas: payloadDesas,
        kecamatanProfile: payloadKecamatan,
        users: payloadUsers,
        asets: payloadAsets,
      });

      // 2. Also keep local server memory and JSON backup in sync
      fetch('/api/sync-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desas: payloadDesas,
          kecamatanProfile: payloadKecamatan,
          users: payloadUsers,
          asets: payloadAsets,
        }),
      }).catch(() => {});

      setIsServerConnected(true);
      setLastSyncTime(new Date());

      return {
        success: true,
        message: 'Seluruh data berhasil disimpan permanen ke Hosting cPanel Sirombu (Bebas Kuota)!',
      };
    } catch (err: any) {
      console.error('[cPanel] saveAllToCloudFirebase error:', err);
      return {
        success: false,
        message: `Gagal menyimpan ke cPanel: ${err?.message || 'Koneksi terputus'}`,
      };
    }
  };

  const saveMasterToSourceCode = saveAllToCloudFirebase;

  const resetToDefault = () => {
    localStorage.clear();
    fetch('/api/reset', { method: 'POST' }).catch(() => {});
    setDesas(INITIAL_DESA_LIST);
    setUsers(INITIAL_USERS);
    setCurrentUser(null);
    setAsets(INITIAL_ASETS);
    setVerifikasiList(INITIAL_VERIFIKASI);
    setPengesahanList(INITIAL_PENGESAHAN);
    setKecamatanProfile(INITIAL_KECAMATAN_PROFILE);
    setSelectedYear(0);
    setSelectedDesaFilter('all');
    setActiveTab('dashboard');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        desas,
        asets,
        verifikasiList,
        pengesahanList,
        kecamatanProfile,
        updateKecamatanProfile,
        selectedYear,
        setSelectedYear: handleSetSelectedYear,
        activeTab,
        setActiveTab,
        selectedDesaFilter,
        setSelectedDesaFilter,
        isServerConnected,
        lastSyncTime,
        refreshServerData,
        firestoreQuotaStatus,
        firestoreQuotaDetail,
        checkFirestoreQuotaStatus,
        announcements,
        sendAnnouncement,
        deleteAnnouncement,
        markAnnouncementAsRead,
        unreadAnnouncementCount,
        login,
        logout,
        switchUser,
        addUser,
        updateUser,
        deleteUser,
        addAset,
        addAsetBatch,
        updateAset,
        deleteAset,
        perbaikiSemuaNomorRegister,
        verifikasiAset,
        verifikasiSemuaAsetPending,
        verifikasiAsetBatch,
        tolakVerifikasiAset,
        batalkanVerifikasiAset,
        batalkanVerifikasiAsetBatch,
        pendingVerificationCount,
        pendingAsetVerificationCount,
        ajukanMutasi,
        ajukanPenghapusan,
        prosesVerifikasi,
        ajukanPengesahan,
        prosesPengesahan,
        revisiMutasi,
        deleteVerifikasi,
        getBackupData,
        restoreBackupData,
        updateDesa,
        importSyncPayload,
        broadcastCurrentState,
        saveAllToCloudFirebase,
        saveMasterToSourceCode,
        resetToDefault,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
