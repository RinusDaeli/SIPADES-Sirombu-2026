import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
import { formatTanggalIndonesia } from '../utils/reportGenerator';
import {
  safeLocalStorageSetItem,
  saveAsetsToIndexedDB,
  loadAsetsFromIndexedDB,
} from '../utils/safeStorage';
import {
  subscribeAsets,
  subscribeVerifikasi,
  subscribePengesahan,
  subscribeDesas,
  subscribeKecamatanProfile,
  subscribeUsers,
  saveAsetToCloud,
  deleteAsetFromCloud,
  saveVerifikasiToCloud,
  deleteVerifikasiFromCloud,
  savePengesahanToCloud,
  saveDesaToCloud,
  saveKecamatanProfileToCloud,
  saveUserToCloud,
  deleteUserFromCloud,
  bootstrapFirestoreIfEmpty,
} from '../lib/firestoreService';

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
  updateKecamatanProfile: (data: Partial<KecamatanProfile>) => { success: boolean; message?: string };
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedDesaFilter: string; // 'all' or desaId
  setSelectedDesaFilter: (desaId: string) => void;
  isServerConnected: boolean;
  lastSyncTime: Date;
  refreshServerData: () => Promise<void>;
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
  getBackupData: () => any;
  restoreBackupData: (backupJson: any) => {
    success: boolean;
    message?: string;
    stats?: { asets: number; verifikasi: number; desas: number; users: number };
  };

  // Desa Information Update
  updateDesa: (id: string, data: Partial<Desa>) => { success: boolean; message?: string };

  // Reset
  resetToDefault: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  AUTH_SESSION: 'sipades_sirombu_session_24h',
  USERS: 'sipad_users_v2',
  DESAS: 'sipad_desas_v2',
  ASETS: 'sipad_asets_v2',
  VERIFIKASI: 'sipad_verifikasi_v2',
  PENGESAHAN: 'sipad_pengesahan_v2',
  KECAMATAN_PROFILE: 'sipad_kecamatan_profile_v2',
  YEAR: 'sipad_year_v2',
};

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

  const [asets, setAsets] = useState<Aset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ASETS);
      if (saved) {
        const parsed: Aset[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((a: any) => a && a.id).map((a) => ({
            ...a,
            klasifikasi: (a?.klasifikasi ? a.klasifikasi.replace(/^[I|V|X]+\.\s*/, '') : 'Tanah') as KlasAset,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_ASETS;
  });

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
      return saved ? parseInt(saved, 10) || 2026 : 2026;
    } catch {
      return 2026;
    }
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedDesaFilter, setSelectedDesaFilter] = useState<string>('all');
  const [isServerConnected, setIsServerConnected] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

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

  // Central Storage Helpers
  const persistAsetsSafely = useCallback((list: Aset[]) => {
    safeLocalStorageSetItem(STORAGE_KEYS.ASETS, JSON.stringify(list));
    saveAsetsToIndexedDB(list).catch(() => {});
  }, []);

  // Central Server Synchronization
  const refreshServerData = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const cType = res.headers.get('content-type');
        if (!cType || !cType.includes('application/json')) {
          // Response is not JSON (e.g. static host/Vercel SPA fallback to index.html)
          return;
        }
        const serverData = await res.json();
        setIsServerConnected(true);
        setLastSyncTime(new Date());

        if (serverData && typeof serverData === 'object') {
          if (Array.isArray(serverData.asets)) {
            setAsets((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(serverData.asets)) return prev;
              persistAsetsSafely(serverData.asets);
              return serverData.asets;
            });
          }
          if (Array.isArray(serverData.verifikasiList)) {
            setVerifikasiList((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(serverData.verifikasiList)) return prev;
              safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(serverData.verifikasiList));
              return serverData.verifikasiList;
            });
          }
          if (Array.isArray(serverData.users) && serverData.users.length > 0) {
            setUsers((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(serverData.users)) return prev;
              safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(serverData.users));
              return serverData.users;
            });
          }
          if (Array.isArray(serverData.desas) && serverData.desas.length > 0) {
            setDesas((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(serverData.desas)) return prev;
              safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(serverData.desas));
              return serverData.desas;
            });
          }
          if (serverData.kecamatanProfile && typeof serverData.kecamatanProfile === 'object') {
            setKecamatanProfile((prev) => {
              if (JSON.stringify(prev) === JSON.stringify(serverData.kecamatanProfile)) return prev;
              safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(serverData.kecamatanProfile));
              return serverData.kecamatanProfile;
            });
          }
          if (typeof serverData.selectedYear === 'number') {
            setSelectedYear((prev) => {
              if (prev === serverData.selectedYear) return prev;
              safeLocalStorageSetItem(STORAGE_KEYS.YEAR, serverData.selectedYear.toString());
              return serverData.selectedYear;
            });
          }
        }
      } else {
        setIsServerConnected(false);
      }
    } catch {
      // Offline fallback
      setIsServerConnected(false);
    }
  }, [persistAsetsSafely]);

  // Cloud Firestore Real-Time Multi-Device Synchronization
  useEffect(() => {
    bootstrapFirestoreIfEmpty();

    const unsubAsets = subscribeAsets((cloudAsets) => {
      if (cloudAsets) {
        setAsets((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(cloudAsets)) return prev;
          persistAsetsSafely(cloudAsets);
          return cloudAsets;
        });
        setIsServerConnected(true);
        setLastSyncTime(new Date());
      }
    });

    const unsubVerif = subscribeVerifikasi((cloudVerif) => {
      if (cloudVerif) {
        setVerifikasiList((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(cloudVerif)) return prev;
          safeLocalStorageSetItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(cloudVerif));
          return cloudVerif;
        });
      }
    });

    const unsubPengesahan = subscribePengesahan((cloudPengesahan) => {
      if (cloudPengesahan) {
        setPengesahanList((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(cloudPengesahan)) return prev;
          safeLocalStorageSetItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(cloudPengesahan));
          return cloudPengesahan;
        });
      }
    });

    const unsubDesas = subscribeDesas((cloudDesas) => {
      if (cloudDesas && cloudDesas.length > 0) {
        setDesas((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(cloudDesas)) return prev;
          safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(cloudDesas));
          return cloudDesas;
        });
      }
    });

    const unsubKecamatan = subscribeKecamatanProfile((cloudProfile) => {
      if (cloudProfile && cloudProfile.namaKecamatan) {
        setKecamatanProfile((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(cloudProfile)) return prev;
          safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(cloudProfile));
          return cloudProfile;
        });
      }
    });

    const unsubUsers = subscribeUsers((cloudUsers) => {
      if (cloudUsers && cloudUsers.length > 0) {
        setUsers((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(cloudUsers)) return prev;
          safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(cloudUsers));
          return cloudUsers;
        });
      }
    });

    return () => {
      unsubAsets();
      unsubVerif();
      unsubPengesahan();
      unsubDesas();
      unsubKecamatan();
      unsubUsers();
    };
  }, []);

  // Real-time Multi-Laptop Synchronization via SSE & Central Server
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/events');
        eventSource.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload && payload.type === 'DATA_CHANGED' && payload.data) {
              const serverData = payload.data;
              if (Array.isArray(serverData.asets)) {
                setAsets(serverData.asets);
                persistAsetsSafely(serverData.asets);
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
                setDesas(serverData.desas);
                safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(serverData.desas));
              }
              if (serverData.kecamatanProfile) {
                setKecamatanProfile(serverData.kecamatanProfile);
                safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(serverData.kecamatanProfile));
              }
              setIsServerConnected(true);
              setLastSyncTime(new Date());
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
  }, [persistAsetsSafely]);

  // Hydrate full photo assets from IndexedDB if offline or on fresh page load
  useEffect(() => {
    loadAsetsFromIndexedDB().then((idbAsets) => {
      if (Array.isArray(idbAsets) && idbAsets.length > 0) {
        setAsets((current) => {
          if (current.length === 0) return idbAsets;
          return current.map((c) => {
            const matched = idbAsets.find((item) => item && item.id === c.id);
            if (matched && (!c.fotoAset || c.fotoAset.length === 0) && matched.fotoAset && matched.fotoAset.length > 0) {
              return { ...c, fotoAset: matched.fotoAset, fotoBast: matched.fotoBast || c.fotoBast };
            }
            return c;
          });
        });
      }
    }).catch(() => {});
  }, []);

  // Initial load and fast periodic polling (every 4 seconds) to guarantee sync across all devices
  useEffect(() => {
    refreshServerData();
    const interval = setInterval(refreshServerData, 4000);
    const onFocus = () => refreshServerData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshServerData]);

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

    // Push to Google Cloud Firestore & local server
    saveUserToCloud(newUser).catch((e) => console.warn('[Cloud] User add failed:', e));
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
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? updatedUser : u))
    );

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

    // Push to Google Cloud Firestore & local server
    if (target) {
      saveUserToCloud(updatedUser).catch((e) => console.warn('[Cloud] User update failed:', e));
    }
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

    setUsers((prev) => prev.filter((u) => u.id !== id));

    deleteUserFromCloud(id).catch((e) => console.warn('[Cloud] User delete failed:', e));
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
    const newAsets: Aset[] = items.map((data, idx) => {
      const desa = desas.find((d) => d && d.id === data.desaId);
      return {
        ...data,
        id: `ast-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        desaName: desa?.name || 'Desa',
        status: 'aktif',
        createdAt: now,
        updatedAt: now,
      };
    });

    setAsets((prev) => [...newAsets, ...prev]);

    // Push all to Google Cloud Firestore in parallel
    Promise.all(newAsets.map((item) => saveAsetToCloud(item))).catch((err) =>
      console.warn('[Cloud] Batch aset save failed:', err)
    );

    // Sync to local server
    fetch('/api/asets/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asets: newAsets }),
    }).catch(() => {
      // Fallback single post if batch endpoint is not available
      newAsets.forEach((a) => {
        fetch('/api/asets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(a),
        }).catch(() => {});
      });
    });

    return { success: true, count: newAsets.length };
  };

  const addAset = (data: Omit<Aset, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    addAsetBatch([data]);
  };

  const updateAset = (id: string, data: Partial<Aset>) => {
    setAsets((prev) => {
      const updated = prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            ...data,
            updatedAt: new Date().toISOString(),
          };
        }
        return a;
      });
      const target = updated.find((a) => a.id === id);
      if (target) {
        saveAsetToCloud(target).catch((err) => console.warn('[Cloud] Aset update failed:', err));
        fetch(`/api/asets/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(target),
        }).catch((e) => console.warn('[Sync] Asset update failed:', e));
      }
      return updated;
    });
  };

  const deleteAset = (id: string) => {
    const target = asets.find((a) => a.id === id);
    if (!target) return { success: false, message: 'Aset tidak ditemukan!' };
    if (target.status === 'mutasi_diajukan' || target.status === 'terhapus_diajukan') {
      return {
        success: false,
        message: 'Aset sedang dalam proses permohonan verifikasi Kecamatan, tidak dapat dihapus langsung!',
      };
    }
    setAsets((prev) => prev.filter((a) => a.id !== id));

    deleteAsetFromCloud(id).catch((err) => console.warn('[Cloud] Aset delete failed:', err));
    fetch(`/api/asets/${id}`, {
      method: 'DELETE',
    }).catch((e) => console.warn('[Sync] Asset delete failed:', e));

    return { success: true };
  };

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

    setVerifikasiList((prev) => [newReq, ...prev]);
    updateAset(asetId, { status: 'mutasi_diajukan' });

    saveVerifikasiToCloud(newReq).catch((err) => console.warn('[Cloud] Verifikasi save failed:', err));
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

    setVerifikasiList((prev) => [newReq, ...prev]);
    updateAset(asetId, { status: 'terhapus_diajukan' });

    saveVerifikasiToCloud(newReq).catch((err) => console.warn('[Cloud] Verifikasi save failed:', err));
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

    setVerifikasiList((prev) =>
      prev.map((v) => (v.id === verifikasiId ? updatedVerif : v))
    );

    saveVerifikasiToCloud(updatedVerif).catch((err) => console.warn('[Cloud] Verifikasi update failed:', err));
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
    savePengesahanToCloud(targetPengesahan).catch((e) => console.warn('[Cloud] Pengesahan save failed:', e));
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
    savePengesahanToCloud(targetPengesahan).catch((e) => console.warn('[Cloud] Pengesahan save failed:', e));
  };

  const updateDesa = (id: string, data: Partial<Desa>) => {
    let finalDesas: Desa[] = [];
    setDesas((prev) => {
      finalDesas = prev.map((d) => (d.id === id ? { ...d, ...data } : d));
      safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(finalDesas));
      return finalDesas;
    });

    const target = desas.find((d) => d.id === id);
    const updated = target ? { ...target, ...data } : null;
    if (updated) {
      saveDesaToCloud(updated).catch((e) => console.warn('[Cloud] Desa save failed:', e));
      fetch('/api/desa/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((e) => console.warn('[Sync] Desa update failed:', e));
    }

    return { success: true };
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

    setVerifikasiList((prev) =>
      prev.map((v) => (v.id === verifikasiId ? updatedVerif : v))
    );

    const newStatus = target.tipe === 'mutasi' ? 'mutasi_diajukan' : 'terhapus_diajukan';
    updateAset(target.asetId, {
      status: newStatus,
      keterangan: `${target.asetSnapshot.keterangan || ''} (Revisi permohonan telah diajukan kembali ke Kecamatan Sirombu)`,
    });

    saveVerifikasiToCloud(updatedVerif).catch((e) => console.warn('[Cloud] Revisi verifikasi failed:', e));
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

    setVerifikasiList((prev) => prev.filter((v) => v.id !== verifikasiId));

    deleteVerifikasiFromCloud(verifikasiId).catch((e) => console.warn('[Cloud] Delete verifikasi failed:', e));
    fetch(`/api/verifikasi/${verifikasiId}`, {
      method: 'DELETE',
    }).catch((e) => console.warn('[Sync] Delete verifikasi failed:', e));

    return { success: true, message: 'Data permohonan mutasi berhasil dihapus!' };
  };

  const getBackupData = () => {
    return {
      appName: 'SIPADES SIROMBU - Nias Barat',
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      timestamp: Date.now(),
      data: {
        desas,
        users,
        asets,
        verifikasiList,
        pengesahanList,
        kecamatanProfile,
        selectedYear,
      },
    };
  };

  const restoreBackupData = (backupJson: any) => {
    try {
      if (!backupJson || typeof backupJson !== 'object') {
        return { success: false, message: 'Format berkas JSON cadangan tidak valid!' };
      }

      const payload = backupJson.data || backupJson;

      if (!Array.isArray(payload.asets) && !Array.isArray(payload.desas)) {
        return { success: false, message: 'Berkas tidak memuat struktur basis data SIPADES yang sesuai!' };
      }

      if (Array.isArray(payload.desas) && payload.desas.length > 0) {
        setDesas(payload.desas);
        safeLocalStorageSetItem(STORAGE_KEYS.DESAS, JSON.stringify(payload.desas));
      }
      if (Array.isArray(payload.users) && payload.users.length > 0) {
        setUsers(payload.users);
        safeLocalStorageSetItem(STORAGE_KEYS.USERS, JSON.stringify(payload.users));
      }
      if (Array.isArray(payload.asets)) {
        setAsets(payload.asets);
        persistAsetsSafely(payload.asets);
      }
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

      // Sync restored data to central server
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

      return {
        success: true,
        message: 'Data SIPADES berhasil dipulihkan dan disinkronkan ke server!',
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

  const updateKecamatanProfile = (data: Partial<KecamatanProfile>) => {
    let updated: KecamatanProfile = kecamatanProfile;
    setKecamatanProfile((prev) => {
      updated = { ...prev, ...data };
      safeLocalStorageSetItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(updated));
      return updated;
    });
    saveKecamatanProfileToCloud(updated).catch((e) => console.warn('[Cloud] Kecamatan save failed:', e));
    fetch('/api/kecamatan/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch((e) => console.warn('[Sync] Kecamatan update failed:', e));
    return { success: true, message: 'Data Camat & Kantor Kecamatan Sirombu berhasil diperbarui!' };
  };

  const saveMasterToSourceCode = async (overrides?: {
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

      const response = await fetch('/api/sync-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desas: payloadDesas,
          kecamatanProfile: payloadKecamatan,
          users: payloadUsers,
          asets: payloadAsets,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setIsServerConnected(true);
        setLastSyncTime(new Date());
        return {
          success: true,
          message: 'Semua data berhasil disimpan permanen ke Master Source Code (src/data/initialData.ts) dan Basis Data Server. Aman untuk di-share ke GitHub tanpa kembali ke setelan awal!',
        };
      }
      return { success: false, message: data.message || 'Gagal menyimpan ke master source code.' };
    } catch (err: any) {
      return { success: false, message: `Gagal menghubungkan ke server: ${err?.message || 'Koneksi terputus'}` };
    }
  };

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
    setSelectedYear(2026);
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
        setSelectedYear,
        activeTab,
        setActiveTab,
        selectedDesaFilter,
        setSelectedDesaFilter,
        isServerConnected,
        lastSyncTime,
        refreshServerData,
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
