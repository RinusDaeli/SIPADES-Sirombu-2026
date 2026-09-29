import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  Desa,
  Aset,
  KlasAset,
  PermohonanVerifikasi,
  PengesahanLaporan,
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
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { cleanObject } from '../utils/firestoreHelper';

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline';

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
  
  // Cloud Sync
  cloudSyncStatus: CloudSyncStatus;
  isCloudSynced: boolean;
  
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
  updateAset: (id: string, data: Partial<Aset>) => void;
  deleteAset: (id: string) => { success: boolean; message?: string };
  clearAllAsetsDanMutasi: () => Promise<{ success: boolean; message?: string }>;
  
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
  restoreBackupData: (backupJson: any) => Promise<{
    success: boolean;
    message?: string;
    stats?: { asets: number; verifikasi: number; desas: number; users: number };
  }>;

  // Desa Information Update
  updateDesa: (id: string, data: Partial<Desa>) => { success: boolean; message?: string };

  // Reset
  resetToDefault: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CURRENT_USER: 'sipad_current_user_v2',
  USERS: 'sipad_users_v2',
  DESAS: 'sipad_desas_v3',
  ASETS: 'sipad_clean_asets_v3',
  VERIFIKASI: 'sipad_clean_verifikasi_v3',
  PENGESAHAN: 'sipad_clean_pengesahan_v3',
  KECAMATAN_PROFILE: 'sipad_kecamatan_profile_v2',
  YEAR: 'sipad_year_v2',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('syncing');

  const [desas, setDesas] = useState<Desa[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DESAS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_DESA_LIST;
  });
  
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_USERS[0];
  });

  // Assets default to empty array (clean slate for fresh 1-by-1 entry)
  const [asets, setAsets] = useState<Aset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ASETS);
    if (saved) {
      try {
        const parsed: Aset[] = JSON.parse(saved);
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_ASETS;
  });

  // Mutations default to empty array
  const [verifikasiList, setVerifikasiList] = useState<PermohonanVerifikasi[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VERIFIKASI);
    if (saved) {
      try {
        const parsed: PermohonanVerifikasi[] = JSON.parse(saved);
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_VERIFIKASI;
  });

  const [pengesahanList, setPengesahanList] = useState<PengesahanLaporan[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PENGESAHAN);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_PENGESAHAN;
  });

  const [kecamatanProfile, setKecamatanProfile] = useState<KecamatanProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.KECAMATAN_PROFILE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_KECAMATAN_PROFILE, ...parsed };
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_KECAMATAN_PROFILE;
  });

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.YEAR);
    return saved ? parseInt(saved, 10) : 2024;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedDesaFilter, setSelectedDesaFilter] = useState<string>('all');

  // Persistence to localStorage for offline cache
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ASETS, JSON.stringify(asets));
  }, [asets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DESAS, JSON.stringify(desas));
  }, [desas]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VERIFIKASI, JSON.stringify(verifikasiList));
  }, [verifikasiList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PENGESAHAN, JSON.stringify(pengesahanList));
  }, [pengesahanList]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.KECAMATAN_PROFILE, JSON.stringify(kecamatanProfile));
  }, [kecamatanProfile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.YEAR, selectedYear.toString());
  }, [selectedYear]);

  // ============================================================
  // REAL-TIME FIRESTORE SYNCHRONIZATION ACROSS LAPTOPS / DEVICES
  // ============================================================
  useEffect(() => {
    let unsubAsets: (() => void) | undefined;
    let unsubVerifikasi: (() => void) | undefined;
    let unsubPengesahan: (() => void) | undefined;
    let unsubDesas: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubProfile: (() => void) | undefined;

    try {
      // 1. Subscribe to Aset Collection
      const asetsCol = collection(db, 'asets');
      unsubAsets = onSnapshot(
        asetsCol,
        (snapshot) => {
          const list: Aset[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Aset;
            list.push({ ...data, id: docSnap.id });
          });
          // Sort newest updated or created first
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setAsets(list);
          setCloudSyncStatus('connected');
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'asets');
          setCloudSyncStatus('offline');
        }
      );

      // 2. Subscribe to Verifikasi (Mutasi & Penghapusan) Collection
      const verifikasiCol = collection(db, 'verifikasi');
      unsubVerifikasi = onSnapshot(
        verifikasiCol,
        (snapshot) => {
          const list: PermohonanVerifikasi[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as PermohonanVerifikasi;
            list.push({ ...data, id: docSnap.id });
          });
          list.sort((a, b) => (b.tanggalPengajuan || '').localeCompare(a.tanggalPengajuan || ''));
          setVerifikasiList(list);
          setCloudSyncStatus('connected');
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'verifikasi');
        }
      );

      // 3. Subscribe to Pengesahan Laporan Collection
      const pengesahanCol = collection(db, 'pengesahan');
      unsubPengesahan = onSnapshot(
        pengesahanCol,
        (snapshot) => {
          const list: PengesahanLaporan[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as PengesahanLaporan;
            list.push({ ...data, id: docSnap.id });
          });
          setPengesahanList(list);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'pengesahan');
        }
      );

      // 4. Subscribe to Desas Collection
      const desasCol = collection(db, 'desas');
      unsubDesas = onSnapshot(
        desasCol,
        async (snapshot) => {
          if (snapshot.empty) {
            // Seed initial desa list to Firestore
            try {
              const batch = writeBatch(db);
              INITIAL_DESA_LIST.forEach((d) => {
                batch.set(doc(db, 'desas', d.id), cleanObject(d));
              });
              await batch.commit();
            } catch (err) {
              console.error('Failed to seed initial desas to Firestore:', err);
            }
          } else {
            const list: Desa[] = [];
            snapshot.forEach((docSnap) => {
              list.push(docSnap.data() as Desa);
            });
            // Keep numerical or code order
            list.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
            setDesas(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'desas');
        }
      );

      // 5. Subscribe to Users Collection
      const usersCol = collection(db, 'users');
      unsubUsers = onSnapshot(
        usersCol,
        async (snapshot) => {
          if (snapshot.empty) {
            // Seed initial users to Firestore
            try {
              const batch = writeBatch(db);
              INITIAL_USERS.forEach((u) => {
                batch.set(doc(db, 'users', u.id), cleanObject(u));
              });
              await batch.commit();
            } catch (err) {
              console.error('Failed to seed initial users to Firestore:', err);
            }
          } else {
            const list: User[] = [];
            snapshot.forEach((docSnap) => {
              list.push(docSnap.data() as User);
            });
            setUsers(list);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'users');
        }
      );

      // 6. Subscribe to Kecamatan Profile Document
      const profileDocRef = doc(db, 'system', 'kecamatan_profile');
      unsubProfile = onSnapshot(
        profileDocRef,
        async (docSnap) => {
          if (!docSnap.exists()) {
            try {
              await setDoc(profileDocRef, cleanObject(INITIAL_KECAMATAN_PROFILE));
            } catch (err) {
              console.error('Failed to seed kecamatan profile:', err);
            }
          } else {
            setKecamatanProfile(docSnap.data() as KecamatanProfile);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, 'system/kecamatan_profile');
        }
      );

    } catch (err) {
      console.error('Error establishing Firestore listeners:', err);
      setCloudSyncStatus('offline');
    }

    return () => {
      if (unsubAsets) unsubAsets();
      if (unsubVerifikasi) unsubVerifikasi();
      if (unsubPengesahan) unsubPengesahan();
      if (unsubDesas) unsubDesas();
      if (unsubUsers) unsubUsers();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // Auth Handlers
  const login = (email: string, pass: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === pass.trim()
    );
    if (user) {
      setCurrentUser(user);
      return { success: true };
    }
    return { success: false, message: 'Email atau kata sandi tidak cocok. Silakan periksa kembali!' };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchUser = (user: User) => {
    setCurrentUser(user);
  };

  // User Management with Firestore Sync
  const addUser = (data: Omit<User, 'id' | 'createdAt'>) => {
    if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, message: 'Email / ID pengguna sudah terdaftar!' };
    }
    const newUser: User = {
      ...data,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [newUser, ...prev]);

    // Save to Firestore
    setDoc(doc(db, 'users', newUser.id), cleanObject(newUser)).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `users/${newUser.id}`);
    });

    return { success: true };
  };

  const updateUser = (id: string, data: Partial<User>) => {
    if (data.email && users.some((u) => u.id !== id && u.email.toLowerCase() === data.email?.toLowerCase())) {
      return { success: false, message: 'Email / ID pengguna sudah digunakan akun lain!' };
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...data } : u))
    );
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...data } : null));
    }

    // Update in Firestore
    setDoc(doc(db, 'users', id), cleanObject(data), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    });

    return { success: true };
  };

  const deleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'User tidak ditemukan' };
    if (target.email === 'udniat.01@gmail.com') {
      return { success: false, message: 'Super Admin utama tidak dapat dihapus!' };
    }
    if (currentUser?.id === id) {
      return { success: false, message: 'Tidak dapat menghapus akun yang sedang aktif digunakan!' };
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));

    // Delete in Firestore
    deleteDoc(doc(db, 'users', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
    });

    return { success: true };
  };

  // Asset Handlers with Firestore Sync
  const addAset = (data: Omit<Aset, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const newAset: Aset = {
      ...data,
      id: `ast-${Date.now()}`,
      status: 'aktif',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAsets((prev) => [newAset, ...prev]);

    // Save to Firestore
    setDoc(doc(db, 'asets', newAset.id), cleanObject(newAset)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, `asets/${newAset.id}`);
    });
  };

  const updateAset = (id: string, data: Partial<Aset>) => {
    const updatePayload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    setAsets((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, ...updatePayload } : a
      )
    );

    // Save to Firestore
    setDoc(doc(db, 'asets', id), cleanObject(updatePayload), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.UPDATE, `asets/${id}`);
    });
  };

  const deleteAset = (id: string) => {
    const target = asets.find((a) => a.id === id);
    if (!target) return { success: false, message: 'Aset tidak ditemukan' };
    if (target.status === 'mutasi_diajukan' || target.status === 'terhapus_diajukan') {
      return {
        success: false,
        message: 'Aset sedang dalam proses permohonan verifikasi Kecamatan, tidak dapat dihapus langsung!',
      };
    }
    setAsets((prev) => prev.filter((a) => a.id !== id));

    // Delete in Firestore
    deleteDoc(doc(db, 'asets', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `asets/${id}`);
    });

    return { success: true };
  };

  // Kosongkan semua data aset & mutasi (untuk mulai input bersih dari awal)
  const clearAllAsetsDanMutasi = async () => {
    try {
      setAsets([]);
      setVerifikasiList([]);
      setPengesahanList([]);
      localStorage.removeItem(STORAGE_KEYS.ASETS);
      localStorage.removeItem(STORAGE_KEYS.VERIFIKASI);
      localStorage.removeItem(STORAGE_KEYS.PENGESAHAN);

      // Clean Firestore collections in batch
      const asetsSnap = await getDocs(collection(db, 'asets'));
      const verifSnap = await getDocs(collection(db, 'verifikasi'));
      const pengesahanSnap = await getDocs(collection(db, 'pengesahan'));

      const batch = writeBatch(db);
      asetsSnap.forEach((d) => batch.delete(d.ref));
      verifSnap.forEach((d) => batch.delete(d.ref));
      pengesahanSnap.forEach((d) => batch.delete(d.ref));

      await batch.commit();

      return { success: true, message: 'Seluruh data aset dan mutasi percobaan telah berhasil dikosongkan. Anda dapat mulai menginput data baru dari awal 1 per satu!' };
    } catch (err: any) {
      console.error('Error clearing data:', err);
      return { success: false, message: `Gagal mengosongkan data di server: ${err?.message || 'Error'}` };
    }
  };

  // Mutasi & Penghapusan Verifikasi with Firestore Sync
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

    // Save to Firestore
    setDoc(doc(db, 'verifikasi', newReq.id), cleanObject(newReq)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, `verifikasi/${newReq.id}`);
    });
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

    // Save to Firestore
    setDoc(doc(db, 'verifikasi', newReq.id), cleanObject(newReq)).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, `verifikasi/${newReq.id}`);
    });
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

    const updatedVerif: Partial<PermohonanVerifikasi> = {
      status,
      tanggalDiproses: now,
      diverifikasiOleh: verifierName,
      catatanKecamatan,
      nomorSKKecamatan: finalSK,
    };

    setVerifikasiList((prev) =>
      prev.map((v) =>
        v.id === verifikasiId ? { ...v, ...updatedVerif } : v
      )
    );

    // Save verifikasi update to Firestore
    setDoc(doc(db, 'verifikasi', verifikasiId), cleanObject(updatedVerif), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.UPDATE, `verifikasi/${verifikasiId}`);
    });

    // Update the asset status accordingly
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

        // Check if destination is a village in Sirombu
        const targetDesa = desas.find((d) => {
          const dNameClean = d.name.toLowerCase().replace(/^desa\s+/i, '').trim();
          const tClean = tujuanClean.toLowerCase().replace(/^desa\s+/i, '').trim();
          return (
            d.id.toLowerCase() === tujuanClean.toLowerCase() ||
            d.name.toLowerCase() === destinationClean(tClean) ||
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
        keterangan: `${verif.asetSnapshot?.keterangan || ''} (Pengajuan ${verif.tipe} ditolak Kecamatan: ${catatanKecamatan})`,
      });
    }
  };

  const destinationClean = (name: string) => name.toLowerCase().replace(/^desa\s+/i, '').trim();

  // Approval Laporan Tahunan with Firestore Sync
  const ajukanPengesahan = (desaId: string, tahun: number) => {
    const desa = desas.find((d) => d.id === desaId);
    const desaName = desa ? desa.name : 'DESA';
    const existing = pengesahanList.find((p) => p.desaId === desaId && p.tahun === tahun);
    const pengesahanId = existing ? existing.id : `png-${desaId}-${tahun}`;

    const newObj: PengesahanLaporan = {
      id: pengesahanId,
      desaId,
      desaName,
      tahun,
      status: 'diajukan',
      diajukanPada: new Date().toISOString(),
      catatanKecamatan: existing?.catatanKecamatan,
    };

    setPengesahanList((prev) => {
      const idx = prev.findIndex((p) => p.id === pengesahanId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newObj;
        return copy;
      }
      return [newObj, ...prev];
    });

    setDoc(doc(db, 'pengesahan', pengesahanId), cleanObject(newObj), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `pengesahan/${pengesahanId}`);
    });
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
    const pengesahanId = existing ? existing.id : `png-${desaId}-${tahun}`;
    const desa = desas.find((d) => d.id === desaId);

    const updatePayload: PengesahanLaporan = {
      id: pengesahanId,
      desaId,
      desaName: desa?.name || 'DESA',
      tahun,
      status,
      catatanKecamatan: catatan,
      diajukanPada: existing?.diajukanPada || now,
      disetujuiPada: status === 'disetujui' ? now : undefined,
      disetujuiOleh: status === 'disetujui' ? verifierName : undefined,
    };

    setPengesahanList((prev) => {
      const idx = prev.findIndex((p) => p.id === pengesahanId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatePayload;
        return copy;
      }
      return [updatePayload, ...prev];
    });

    setDoc(doc(db, 'pengesahan', pengesahanId), cleanObject(updatePayload), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `pengesahan/${pengesahanId}`);
    });
  };

  const updateDesa = (id: string, data: Partial<Desa>) => {
    setDesas((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...data } : d))
    );

    setDoc(doc(db, 'desas', id), cleanObject(data), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.UPDATE, `desas/${id}`);
    });

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
    const updatedData: Partial<PermohonanVerifikasi> = {
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
      prev.map((v) => (v.id === verifikasiId ? { ...v, ...updatedData } : v))
    );

    const newStatus = target.tipe === 'mutasi' ? 'mutasi_diajukan' : 'terhapus_diajukan';
    updateAset(target.asetId, {
      status: newStatus,
      keterangan: `${target.asetSnapshot?.keterangan || ''} (Revisi permohonan telah diajukan kembali ke Kecamatan Sirombu)`,
    });

    setDoc(doc(db, 'verifikasi', verifikasiId), cleanObject(updatedData), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.UPDATE, `verifikasi/${verifikasiId}`);
    });

    return { success: true, message: 'Permohonan berhasil direvisi dan diajukan ulang!' };
  };

  const deleteVerifikasi = (verifikasiId: string) => {
    const target = verifikasiList.find((v) => v.id === verifikasiId);
    if (!target) return { success: false, message: 'Data permohonan tidak ditemukan!' };

    const relatedAset = asets.find((a) => a.id === target.asetId);
    if (relatedAset && (relatedAset.status === 'mutasi_diajukan' || relatedAset.status === 'terhapus_diajukan')) {
      updateAset(target.asetId, { status: 'aktif' });
    }

    setVerifikasiList((prev) => prev.filter((v) => v.id !== verifikasiId));

    deleteDoc(doc(db, 'verifikasi', verifikasiId)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `verifikasi/${verifikasiId}`);
    });

    return { success: true, message: 'Data permohonan mutasi berhasil dihapus!' };
  };

  // Backup & Restore with Firestore Sync
  const getBackupData = () => {
    return {
      appName: 'SIPADES SIROMBU - Nias Barat',
      version: '2.0.0 (Cloud Synced)',
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

  const restoreBackupData = async (backupJson: any) => {
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
      }
      if (Array.isArray(payload.users) && payload.users.length > 0) {
        setUsers(payload.users);
      }
      if (Array.isArray(payload.asets)) {
        setAsets(payload.asets);
      }
      if (Array.isArray(payload.verifikasiList)) {
        setVerifikasiList(payload.verifikasiList);
      }
      if (Array.isArray(payload.pengesahanList)) {
        setPengesahanList(payload.pengesahanList);
      }
      if (payload.kecamatanProfile) {
        setKecamatanProfile(payload.kecamatanProfile);
      }
      if (payload.selectedYear) {
        setSelectedYear(payload.selectedYear);
      }

      // Sync restore data to Firestore so other laptops get it immediately
      const batch = writeBatch(db);
      if (Array.isArray(payload.asets)) {
        payload.asets.forEach((a: Aset) => {
          if (a.id) batch.set(doc(db, 'asets', a.id), cleanObject(a));
        });
      }
      if (Array.isArray(payload.verifikasiList)) {
        payload.verifikasiList.forEach((v: PermohonanVerifikasi) => {
          if (v.id) batch.set(doc(db, 'verifikasi', v.id), cleanObject(v));
        });
      }
      if (payload.kecamatanProfile) {
        batch.set(doc(db, 'system', 'kecamatan_profile'), cleanObject(payload.kecamatanProfile));
      }
      await batch.commit();

      return {
        success: true,
        message: 'Data SIPADES berhasil dipulihkan secara menyeluruh dan disinkronkan ke seluruh laptop!',
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
    setKecamatanProfile((prev) => ({ ...prev, ...data }));
    setDoc(doc(db, 'system', 'kecamatan_profile'), cleanObject(data), { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.UPDATE, 'system/kecamatan_profile');
    });
    return { success: true, message: 'Data Camat & Kantor Kecamatan Sirombu berhasil diperbarui dan tersinkronkan!' };
  };

  const resetToDefault = () => {
    localStorage.clear();
    setDesas(INITIAL_DESA_LIST);
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setAsets([]);
    setVerifikasiList([]);
    setPengesahanList([]);
    setKecamatanProfile(INITIAL_KECAMATAN_PROFILE);
    setSelectedYear(2024);
    setSelectedDesaFilter('all');
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
        cloudSyncStatus,
        isCloudSynced: cloudSyncStatus === 'connected',
        login,
        logout,
        switchUser,
        addUser,
        updateUser,
        deleteUser,
        addAset,
        updateAset,
        deleteAset,
        clearAllAsetsDanMutasi,
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
        resetToDefault,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
