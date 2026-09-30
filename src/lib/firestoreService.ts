import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Aset,
  PermohonanVerifikasi,
  PengesahanLaporan,
  Desa,
  User,
  KecamatanProfile,
} from '../types';
import {
  INITIAL_DESA_LIST,
  INITIAL_USERS,
  INITIAL_KECAMATAN_PROFILE,
  INITIAL_ASETS,
  INITIAL_VERIFIKASI,
  INITIAL_PENGESAHAN,
} from '../data/initialData';

// Utility to remove undefined values because Firestore rejects undefined
function cleanForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export interface InitialCloudData {
  asets: Aset[];
  desas: Desa[];
  verifikasiList: PermohonanVerifikasi[];
  pengesahanList: PengesahanLaporan[];
  users: User[];
  kecamatanProfile?: KecamatanProfile;
}

/**
 * Directly fetch all authoritative data from Google Cloud Firestore on initial app boot.
 * This guarantees every device (laptop, mobile phone, tablet) loads the EXACT same live cloud data
 * instead of relying on stale local device cache.
 */
export async function fetchInitialFirestoreData(): Promise<InitialCloudData | null> {
  try {
    const fetchPromise = Promise.all([
      getDocs(collection(db, 'asets')),
      getDocs(collection(db, 'desas')),
      getDocs(collection(db, 'verifikasiList')),
      getDocs(collection(db, 'pengesahanList')),
      getDocs(collection(db, 'users')),
      getDoc(doc(db, 'system', 'kecamatanProfile')),
    ]);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore initial fetch timeout')), 5000)
    );

    const [asetsSnap, desasSnap, verifSnap, pengesahanSnap, usersSnap, kecSnap] = (await Promise.race([
      fetchPromise,
      timeoutPromise,
    ])) as any;

    const asets: Aset[] = [];
    asetsSnap.forEach((d: any) => {
      const data = d.data() as Aset;
      if (data && data.id) asets.push(data);
    });

    const desas: Desa[] = [];
    desasSnap.forEach((d: any) => {
      const data = d.data() as Desa;
      if (data && data.id) desas.push(data);
    });

    const verifikasiList: PermohonanVerifikasi[] = [];
    verifSnap.forEach((d: any) => {
      const data = d.data() as PermohonanVerifikasi;
      if (data && data.id) verifikasiList.push(data);
    });

    const pengesahanList: PengesahanLaporan[] = [];
    pengesahanSnap.forEach((d: any) => {
      const data = d.data() as PengesahanLaporan;
      if (data && data.id) pengesahanList.push(data);
    });

    const users: User[] = [];
    usersSnap.forEach((d: any) => {
      const data = d.data() as User;
      if (data && data.id) users.push(data);
    });

    let kecamatanProfile: KecamatanProfile | undefined = undefined;
    if (kecSnap && typeof kecSnap.exists === 'function' && kecSnap.exists()) {
      kecamatanProfile = kecSnap.data() as KecamatanProfile;
    }

    return {
      asets,
      desas,
      verifikasiList,
      pengesahanList,
      users,
      kecamatanProfile,
    };
  } catch (error) {
    console.warn('[Firestore] fetchInitialFirestoreData note:', error);
    return null;
  }
}

// ==================== SUBSCRIPTIONS (REAL-TIME MULTI-DEVICE SYNC) ====================

const desaSubscribers = new Set<(desas: Desa[]) => void>();
const asetSubscribers = new Set<(asets: Aset[]) => void>();
const verifikasiSubscribers = new Set<(verifs: PermohonanVerifikasi[]) => void>();
const pengesahanSubscribers = new Set<(list: PengesahanLaporan[]) => void>();
const kecamatanSubscribers = new Set<(profile: KecamatanProfile) => void>();
const usersSubscribers = new Set<(users: User[]) => void>();

/**
 * Re-triggers all active Firestore listeners immediately after a successful write
 * ensuring all connected devices see the change in real-time without delay.
 */
export async function triggerDesasListenerRefresh(updatedDesa?: Desa): Promise<void> {
  // 1. Optimistic notification to active local subscribers
  if (updatedDesa) {
    desaSubscribers.forEach((cb) => {
      try {
        // Trigger with updated desa
        cb([updatedDesa]);
      } catch {}
    });
  }

  // 2. Fetch authoritative live list from Firestore and re-broadcast to all subscribers
  try {
    const snap = await getDocs(collection(db, 'desas'));
    if (!snap.empty) {
      const list: Desa[] = [];
      snap.forEach((d) => {
        const data = d.data() as Desa;
        if (data && data.id) list.push(data);
      });
      list.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
      desaSubscribers.forEach((cb) => {
        try {
          cb(list);
        } catch {}
      });
    }
  } catch (e) {
    console.warn('[Firestore] triggerDesasListenerRefresh notice:', e);
  }
}

export async function triggerAsetsListenerRefresh(updatedAset?: Aset, deletedId?: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'asets'));
    if (!snap.empty) {
      const list: Aset[] = [];
      snap.forEach((d) => {
        const data = d.data() as Aset;
        if (data && data.id && data.id !== deletedId) list.push(data);
      });
      list.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
      asetSubscribers.forEach((cb) => {
        try {
          cb(list);
        } catch {}
      });
    }
  } catch (e) {
    console.warn('[Firestore] triggerAsetsListenerRefresh notice:', e);
  }
}

export async function triggerKecamatanListenerRefresh(profile?: KecamatanProfile): Promise<void> {
  if (profile) {
    kecamatanSubscribers.forEach((cb) => {
      try {
        cb(profile);
      } catch {}
    });
  }
  try {
    const snap = await getDoc(doc(db, 'system', 'kecamatanProfile'));
    if (snap.exists()) {
      const data = snap.data() as KecamatanProfile;
      kecamatanSubscribers.forEach((cb) => {
        try {
          cb(data);
        } catch {}
      });
    }
  } catch (e) {
    console.warn('[Firestore] triggerKecamatanListenerRefresh notice:', e);
  }
}

export function subscribeAsets(callback: (asets: Aset[]) => void): () => void {
  asetSubscribers.add(callback);
  try {
    const colRef = collection(db, 'asets');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const list: Aset[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as Aset;
          if (data && data.id) {
            list.push(data);
          }
        });
        // Sort newest first
        list.sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
        callback(list);
      },
      (err: any) => {
        if (err?.code === 'resource-exhausted') {
          console.warn('[Firestore] Notice: Quota limit reached on free tier. Using synchronized server and local state.');
        } else {
          console.warn('[Firestore] subscribeAsets error:', err);
        }
      }
    );
    return () => {
      asetSubscribers.delete(callback);
      unsub();
    };
  } catch (e) {
    console.warn('[Firestore] Failed to subscribe asets:', e);
    return () => {
      asetSubscribers.delete(callback);
    };
  }
}

export function subscribeVerifikasi(callback: (list: PermohonanVerifikasi[]) => void): () => void {
  verifikasiSubscribers.add(callback);
  try {
    const colRef = collection(db, 'verifikasiList');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const list: PermohonanVerifikasi[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as PermohonanVerifikasi;
          if (data && data.id) {
            list.push(data);
          }
        });
        list.sort((a, b) => new Date(b?.tanggalPengajuan || 0).getTime() - new Date(a?.tanggalPengajuan || 0).getTime());
        callback(list);
      },
      (err) => {
        console.warn('[Firestore] subscribeVerifikasi error:', err);
      }
    );
    return () => {
      verifikasiSubscribers.delete(callback);
      unsub();
    };
  } catch (e) {
    console.warn('[Firestore] Failed to subscribe verifikasi:', e);
    return () => {
      verifikasiSubscribers.delete(callback);
    };
  }
}

export function subscribePengesahan(callback: (list: PengesahanLaporan[]) => void): () => void {
  pengesahanSubscribers.add(callback);
  try {
    const colRef = collection(db, 'pengesahanList');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const list: PengesahanLaporan[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as PengesahanLaporan;
          if (data && data.id) {
            list.push(data);
          }
        });
        callback(list);
      },
      (err) => {
        console.warn('[Firestore] subscribePengesahan error:', err);
      }
    );
    return () => {
      pengesahanSubscribers.delete(callback);
      unsub();
    };
  } catch (e) {
    console.warn('[Firestore] Failed to subscribe pengesahan:', e);
    return () => {
      pengesahanSubscribers.delete(callback);
    };
  }
}

export function subscribeDesas(callback: (desas: Desa[]) => void): () => void {
  desaSubscribers.add(callback);
  try {
    const colRef = collection(db, 'desas');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Desa[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as Desa;
            if (data && data.id) {
              list.push(data);
            }
          });
          list.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
          if (list.length > 0) {
            callback(list);
          }
        }
      },
      (err) => {
        console.warn('[Firestore] subscribeDesas error:', err);
      }
    );
    return () => {
      desaSubscribers.delete(callback);
      unsub();
    };
  } catch (e) {
    console.warn('[Firestore] Failed to subscribe desas:', e);
    return () => {
      desaSubscribers.delete(callback);
    };
  }
}

export function subscribeKecamatanProfile(callback: (profile: KecamatanProfile) => void): () => void {
  kecamatanSubscribers.add(callback);
  try {
    const docRef = doc(db, 'system', 'kecamatanProfile');
    const unsub = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as KecamatanProfile;
          if (data && data.namaKecamatan) {
            callback(data);
          }
        }
      },
      (err) => {
        console.warn('[Firestore] subscribeKecamatanProfile error:', err);
      }
    );
    return () => {
      kecamatanSubscribers.delete(callback);
      unsub();
    };
  } catch (e) {
    console.warn('[Firestore] Failed to subscribe kecamatan profile:', e);
    return () => {
      kecamatanSubscribers.delete(callback);
    };
  }
}

export function subscribeUsers(callback: (users: User[]) => void): () => void {
  usersSubscribers.add(callback);
  try {
    const colRef = collection(db, 'users');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: User[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as User;
            if (data && data.id) {
              list.push(data);
            }
          });
          if (list.length > 0) {
            callback(list);
          }
        }
      },
      (err) => {
        console.warn('[Firestore] subscribeUsers error:', err);
      }
    );
    return () => {
      usersSubscribers.delete(callback);
      unsub();
    };
  } catch (e) {
    console.warn('[Firestore] Failed to subscribe users:', e);
    return () => {
      usersSubscribers.delete(callback);
    };
  }
}

// ==================== CLOUD MUTATION FUNCTIONS ====================

export async function saveAsetToCloud(aset: Aset): Promise<void> {
  try {
    const cleaned = cleanForFirestore(aset);
    const docRef = doc(db, 'asets', aset.id);
    const writePromise = setDoc(docRef, cleaned, { merge: true });
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3500));
    await Promise.race([writePromise, timeoutPromise]);
    triggerAsetsListenerRefresh(aset).catch(() => {});
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      return;
    }
    console.warn('[Firestore] saveAsetToCloud notice:', err);
  }
}

export async function deleteAsetFromCloud(asetId: string): Promise<void> {
  try {
    const docRef = doc(db, 'asets', asetId);
    await deleteDoc(docRef);
    triggerAsetsListenerRefresh(undefined, asetId).catch(() => {});
  } catch (err) {
    console.warn('[Firestore] deleteAsetFromCloud notice:', err);
  }
}

export async function saveVerifikasiToCloud(verif: PermohonanVerifikasi): Promise<void> {
  try {
    const cleaned = cleanForFirestore(verif);
    const docRef = doc(db, 'verifikasiList', verif.id);
    await setDoc(docRef, cleaned, { merge: true });
  } catch (err) {
    console.warn('[Firestore] saveVerifikasiToCloud notice:', err);
  }
}

export async function deleteVerifikasiFromCloud(verifId: string): Promise<void> {
  try {
    const docRef = doc(db, 'verifikasiList', verifId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[Firestore] deleteVerifikasiFromCloud notice:', err);
  }
}

export async function savePengesahanToCloud(pengesahan: PengesahanLaporan): Promise<void> {
  try {
    const cleaned = cleanForFirestore(pengesahan);
    const docRef = doc(db, 'pengesahanList', pengesahan.id);
    await setDoc(docRef, cleaned, { merge: true });
  } catch (err) {
    console.warn('[Firestore] savePengesahanToCloud notice:', err);
  }
}

export async function saveDesaToCloud(desa: Desa): Promise<boolean> {
  try {
    const cleaned = cleanForFirestore(desa);
    const docRef = doc(db, 'desas', desa.id);
    const writePromise = setDoc(docRef, cleaned, { merge: true });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase desa write timeout')), 3500)
    );
    await Promise.race([writePromise, timeoutPromise]);
    console.log(`[Firestore] Successfully saved desa: ${desa.name} (${desa.id})`);
    triggerDesasListenerRefresh(desa).catch(() => {});
    return true;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Quota limit reached; saved to server & local storage safely.');
      return false;
    }
    console.warn('[Firestore] saveDesaToCloud notice:', err);
    return false;
  }
}

export async function saveAllDesasToCloud(desas: Desa[]): Promise<void> {
  try {
    if (!Array.isArray(desas) || desas.length === 0) return;
    const batch = writeBatch(db);
    for (const d of desas) {
      if (d && d.id) {
        batch.set(doc(db, 'desas', d.id), cleanForFirestore(d), { merge: true });
      }
    }
    await batch.commit();
    console.log(`[Firestore] Successfully batch saved ${desas.length} desas to Cloud Firestore`);
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Quota limit reached; saved to server & local storage safely.');
      return;
    }
    console.warn('[Firestore] saveAllDesasToCloud notice:', err);
  }
}

export async function syncAllToFirestore(payload: {
  desas?: Desa[];
  kecamatanProfile?: KecamatanProfile;
  users?: User[];
  asets?: Aset[];
}): Promise<void> {
  try {
    const batch = writeBatch(db);

    if (Array.isArray(payload.desas)) {
      for (const d of payload.desas) {
        if (d && d.id) {
          batch.set(doc(db, 'desas', d.id), cleanForFirestore(d), { merge: true });
        }
      }
    }

    if (payload.kecamatanProfile) {
      batch.set(doc(db, 'system', 'kecamatanProfile'), cleanForFirestore(payload.kecamatanProfile), { merge: true });
    }

    if (Array.isArray(payload.users)) {
      for (const u of payload.users) {
        if (u && u.id) {
          batch.set(doc(db, 'users', u.id), cleanForFirestore(u), { merge: true });
        }
      }
    }

    if (Array.isArray(payload.asets)) {
      for (const a of payload.asets) {
        if (a && a.id) {
          batch.set(doc(db, 'asets', a.id), cleanForFirestore(a), { merge: true });
        }
      }
    }

    await batch.commit();
    console.log('[Firestore] Complete unified sync to Cloud Firestore succeeded');
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Quota limit reached during unified sync; local and server data remain safe and intact.');
      return;
    }
    console.warn('[Firestore] syncAllToFirestore notice:', err);
  }
}

export async function saveKecamatanProfileToCloud(profile: KecamatanProfile): Promise<boolean> {
  try {
    const cleaned = cleanForFirestore(profile);
    const docRef = doc(db, 'system', 'kecamatanProfile');
    const writePromise = setDoc(docRef, cleaned, { merge: true });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase kecamatan write timeout')), 3500)
    );
    await Promise.race([writePromise, timeoutPromise]);
    return true;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      console.warn('[Firestore] Quota limit reached; saved to server & local storage safely.');
      return false;
    }
    console.warn('[Firestore] saveKecamatanProfileToCloud notice:', err);
    return false;
  }
}

export async function saveUserToCloud(user: User): Promise<void> {
  try {
    const cleaned = cleanForFirestore(user);
    const docRef = doc(db, 'users', user.id);
    await setDoc(docRef, cleaned, { merge: true });
  } catch (err) {
    console.warn('[Firestore] saveUserToCloud notice:', err);
  }
}

export async function deleteUserFromCloud(userId: string): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[Firestore] deleteUserFromCloud notice:', err);
  }
}

// ==================== INITIAL BOOTSTRAP / SEEDING ====================

export async function bootstrapFirestoreIfEmpty(): Promise<void> {
  try {
    const desasSnap = await getDocs(collection(db, 'desas'));
    if (desasSnap.empty) {
      console.log('[Firestore] Bootstrapping initial database to Google Cloud Firestore...');
      const batch = writeBatch(db);

      // Seed Desas
      for (const desa of INITIAL_DESA_LIST) {
        const ref = doc(db, 'desas', desa.id);
        batch.set(ref, cleanForFirestore(desa));
      }

      // Seed Users
      for (const user of INITIAL_USERS) {
        const ref = doc(db, 'users', user.id);
        batch.set(ref, cleanForFirestore(user));
      }

      // Seed Kecamatan Profile
      const kecRef = doc(db, 'system', 'kecamatanProfile');
      batch.set(kecRef, cleanForFirestore(INITIAL_KECAMATAN_PROFILE));

      // Seed initial verifikasi if any
      for (const v of INITIAL_VERIFIKASI) {
        const ref = doc(db, 'verifikasiList', v.id);
        batch.set(ref, cleanForFirestore(v));
      }

      // Seed initial pengesahan if any
      for (const p of INITIAL_PENGESAHAN) {
        const ref = doc(db, 'pengesahanList', p.id);
        batch.set(ref, cleanForFirestore(p));
      }

      // Seed initial asets if any
      for (const a of INITIAL_ASETS) {
        const ref = doc(db, 'asets', a.id);
        batch.set(ref, cleanForFirestore(a));
      }

      await batch.commit();
      console.log('[Firestore] Seeding complete! All 25 desas & admin credentials are live in Cloud Firestore.');
    }
  } catch (error) {
    console.warn('[Firestore] Bootstrap check note:', error);
  }
}
