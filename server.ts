import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_DESA_LIST,
  INITIAL_USERS,
  INITIAL_ASETS,
  INITIAL_VERIFIKASI,
  INITIAL_PENGESAHAN,
  INITIAL_KECAMATAN_PROFILE,
} from './src/data/initialData';
import { Aset, PermohonanVerifikasi, PengesahanLaporan, User, Desa, KecamatanProfile } from './src/types';

interface DatabaseSchema {
  asets: Aset[];
  verifikasiList: PermohonanVerifikasi[];
  pengesahanList: PengesahanLaporan[];
  users: User[];
  desas: Desa[];
  kecamatanProfile: KecamatanProfile;
  selectedYear: number;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache synced with disk
let dbState: DatabaseSchema = loadDatabase();

// Real-time Server-Sent Events client pool for instant cross-laptop synchronization
const sseClients: express.Response[] = [];

function broadcastEvent(type: string, data: any) {
  const payload = `data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        asets: Array.isArray(parsed.asets) ? parsed.asets : INITIAL_ASETS,
        verifikasiList: Array.isArray(parsed.verifikasiList) ? parsed.verifikasiList : INITIAL_VERIFIKASI,
        pengesahanList: Array.isArray(parsed.pengesahanList) ? parsed.pengesahanList : INITIAL_PENGESAHAN,
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : INITIAL_USERS,
        desas: Array.isArray(parsed.desas) && parsed.desas.length > 0 ? parsed.desas : INITIAL_DESA_LIST,
        kecamatanProfile: parsed.kecamatanProfile || INITIAL_KECAMATAN_PROFILE,
        selectedYear: typeof parsed.selectedYear === 'number' ? parsed.selectedYear : 0,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (error) {
    console.error('[Database] Failed to read database file, initializing defaults:', error);
  }

  const defaultState: DatabaseSchema = {
    asets: INITIAL_ASETS,
    verifikasiList: INITIAL_VERIFIKASI,
    pengesahanList: INITIAL_PENGESAHAN,
    users: INITIAL_USERS,
    desas: INITIAL_DESA_LIST,
    kecamatanProfile: INITIAL_KECAMATAN_PROFILE,
    selectedYear: 0,
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(defaultState);
  return defaultState;
}

function syncDesasToInitialData(desas: Desa[]) {
  try {
    const initFile = path.join(__dirname, 'src/data/initialData.ts');
    if (fs.existsSync(initFile)) {
      let content = fs.readFileSync(initFile, 'utf-8');
      const desasJson = JSON.stringify(desas, null, 2);
      const regex = /export const INITIAL_DESA_LIST: Desa\[\] = (\[[\s\S]*?\]);\n\nexport const INITIAL_USERS/;
      if (regex.test(content)) {
        content = content.replace(regex, 'export const INITIAL_DESA_LIST: Desa[] = ' + desasJson + ';\n\nexport const INITIAL_USERS');
        fs.writeFileSync(initFile, content, 'utf-8');
      }
    }
  } catch (e) {
    console.warn('[Sync] syncDesasToInitialData notice:', e);
  }
}

function saveDatabase(state: DatabaseSchema) {
  try {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    syncDesasToInitialData(state.desas);
    broadcastEvent('DATA_CHANGED', state);
  } catch (error) {
    console.error('[Database] Failed to save database file:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Universal CORS for cross-device access (Vercel, local network, custom domains)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // JSON Body Parser with 50mb limit for asset photos & document scans
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ==================== REST API ENDPOINTS ====================

  // Real-time Event Stream for instant multi-laptop synchronization
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', data: dbState, timestamp: new Date().toISOString() })}\n\n`);
    sseClients.push(res);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      asetCount: dbState.asets.length,
      verifikasiCount: dbState.verifikasiList.length,
      userCount: dbState.users.length,
    });
  });

  // Get full current dataset
  app.get('/api/data', (req, res) => {
    res.json(dbState);
  });

  // Sync / batch update from client (Non-destructive merge so devices never overwrite each other)
  app.post('/api/sync', (req, res) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload tidak valid' });
    }

    if (Array.isArray(payload.asets)) {
      const map = new Map<string, Aset>(dbState.asets.map((a) => [a.id, a]));
      payload.asets.forEach((a: Aset) => {
        if (a && a.id) map.set(a.id, a);
      });
      dbState.asets = Array.from(map.values());
    }
    if (Array.isArray(payload.verifikasiList)) {
      const map = new Map<string, PermohonanVerifikasi>(dbState.verifikasiList.map((v) => [v.id, v]));
      payload.verifikasiList.forEach((v: PermohonanVerifikasi) => {
        if (v && v.id) map.set(v.id, v);
      });
      dbState.verifikasiList = Array.from(map.values());
    }
    if (Array.isArray(payload.users)) {
      const map = new Map<string, User>(dbState.users.map((u) => [u.id, u]));
      payload.users.forEach((u: User) => {
        if (u && u.id) map.set(u.id, u);
      });
      dbState.users = Array.from(map.values());
    }
    if (Array.isArray(payload.desas)) {
      const map = new Map<string, Desa>(dbState.desas.map((d) => [d.id, d]));
      payload.desas.forEach((d: Desa) => {
        if (d && d.id) {
          const exist = map.get(d.id);
          map.set(d.id, exist ? { ...exist, ...d } : d);
        }
      });
      dbState.desas = Array.from(map.values());
    }
    if (payload.kecamatanProfile) {
      dbState.kecamatanProfile = { ...dbState.kecamatanProfile, ...payload.kecamatanProfile };
    }
    if (typeof payload.selectedYear === 'number') {
      dbState.selectedYear = payload.selectedYear;
    }

    saveDatabase(dbState);
    res.json({ success: true, updatedAt: dbState.updatedAt });
  });

  // Assets endpoints
  app.post('/api/asets/batch', (req, res) => {
    const { asets } = req.body;
    if (!Array.isArray(asets) || asets.length === 0) {
      return res.status(400).json({ error: 'Daftar aset tidak valid' });
    }

    for (const a of asets) {
      if (a && a.id) {
        const idx = dbState.asets.findIndex((item) => item.id === a.id);
        if (idx >= 0) {
          dbState.asets[idx] = a;
        } else {
          dbState.asets.unshift(a);
        }
      }
    }

    saveDatabase(dbState);
    res.json({ success: true, count: asets.length, total: dbState.asets.length });
  });

  app.post('/api/asets', (req, res) => {
    if (Array.isArray(req.body)) {
      for (const a of req.body) {
        if (a && a.id) {
          const idx = dbState.asets.findIndex((item) => item.id === a.id);
          if (idx >= 0) {
            dbState.asets[idx] = a;
          } else {
            dbState.asets.unshift(a);
          }
        }
      }
      saveDatabase(dbState);
      return res.json({ success: true, count: req.body.length, total: dbState.asets.length });
    }

    const newAset: Aset = req.body;
    if (!newAset || !newAset.id || !newAset.namaAset) {
      return res.status(400).json({ error: 'Data aset tidak lengkap' });
    }

    // Check if asset already exists, replace or append
    const idx = dbState.asets.findIndex((a) => a.id === newAset.id);
    if (idx >= 0) {
      dbState.asets[idx] = newAset;
    } else {
      dbState.asets.unshift(newAset);
    }

    saveDatabase(dbState);
    res.json({ success: true, aset: newAset, total: dbState.asets.length });
  });

  app.put('/api/asets/:id', (req, res) => {
    const { id } = req.params;
    const updated = req.body;
    const idx = dbState.asets.findIndex((a) => a.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Aset tidak ditemukan' });
    }

    dbState.asets[idx] = { ...dbState.asets[idx], ...updated };
    saveDatabase(dbState);
    res.json({ success: true, aset: dbState.asets[idx] });
  });

  app.delete('/api/asets/:id', (req, res) => {
    const { id } = req.params;
    dbState.asets = dbState.asets.filter((a) => a.id !== id);
    saveDatabase(dbState);
    res.json({ success: true, total: dbState.asets.length });
  });

  // Verifikasi (Mutasi & Penghapusan) endpoints
  app.post('/api/verifikasi', (req, res) => {
    const newVerif: PermohonanVerifikasi = req.body;
    if (!newVerif || !newVerif.id) {
      return res.status(400).json({ error: 'Data permohonan tidak valid' });
    }

    const idx = dbState.verifikasiList.findIndex((v) => v.id === newVerif.id);
    if (idx >= 0) {
      dbState.verifikasiList[idx] = newVerif;
    } else {
      dbState.verifikasiList.push(newVerif);
    }

    saveDatabase(dbState);
    res.json({ success: true, verifikasi: newVerif });
  });

  app.put('/api/verifikasi/:id', (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const idx = dbState.verifikasiList.findIndex((v) => v.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Permohonan tidak ditemukan' });
    }

    dbState.verifikasiList[idx] = { ...dbState.verifikasiList[idx], ...updateData };
    saveDatabase(dbState);
    res.json({ success: true, verifikasi: dbState.verifikasiList[idx] });
  });

  // Users endpoints with security rules
  app.post('/api/users', (req, res) => {
    const { user, requestRole } = req.body;
    if (!user || !user.id || !user.email) {
      return res.status(400).json({ error: 'Data pengguna tidak lengkap' });
    }

    if (user.role === 'super_admin' && requestRole !== 'super_admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang berhak membuat akun Super Admin' });
    }

    const idx = dbState.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      dbState.users[idx] = user;
    } else {
      dbState.users.push(user);
    }

    saveDatabase(dbState);
    res.json({ success: true, user });
  });

  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { data, requestRole } = req.body;
    const idx = dbState.users.findIndex((u) => u.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    const targetUser = dbState.users[idx];
    if (targetUser.role === 'super_admin' && requestRole !== 'super_admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang berhak mengubah akun Super Admin' });
    }

    dbState.users[idx] = { ...targetUser, ...data };
    saveDatabase(dbState);
    res.json({ success: true, user: dbState.users[idx] });
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { requestRole } = req.body;
    const target = dbState.users.find((u) => u.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }

    if (requestRole !== 'super_admin') {
      return res.status(403).json({ error: 'Hanya Super Admin yang berhak menghapus akun pengguna' });
    }

    if (target.email === 'udniat.01@gmail.com') {
      return res.status(403).json({ error: 'Akun Super Admin Utama tidak dapat dihapus' });
    }

    dbState.users = dbState.users.filter((u) => u.id !== id);
    saveDatabase(dbState);
    res.json({ success: true });
  });

  // Desa and Kecamatan Profile updates
  app.post('/api/desa/update', (req, res) => {
    const updatedDesa: Desa = req.body;
    if (!updatedDesa || !updatedDesa.id) {
      return res.status(400).json({ error: 'Data desa tidak lengkap' });
    }

    const idx = dbState.desas.findIndex((d) => d.id === updatedDesa.id);
    if (idx >= 0) {
      dbState.desas[idx] = { ...dbState.desas[idx], ...updatedDesa };
      saveDatabase(dbState);
    }
    res.json({ success: true, desa: dbState.desas[idx] });
  });

  app.post('/api/kecamatan/update', (req, res) => {
    const profile: KecamatanProfile = req.body;
    if (profile) {
      dbState.kecamatanProfile = profile;
      saveDatabase(dbState);
    }
    res.json({ success: true, profile: dbState.kecamatanProfile });
  });

  // Explicit sync master to write directly to src/data/initialData.ts (GitHub ready)
  app.post('/api/sync-master', (req, res) => {
    const { desas, kecamatanProfile, users, asets } = req.body || {};
    if (Array.isArray(desas) && desas.length > 0) {
      dbState.desas = desas;
    }
    if (kecamatanProfile) {
      dbState.kecamatanProfile = kecamatanProfile;
    }
    if (Array.isArray(users) && users.length > 0) {
      dbState.users = users;
    }
    if (Array.isArray(asets)) {
      dbState.asets = asets;
    }
    saveDatabase(dbState);
    res.json({
      success: true,
      message: 'Semua data berhasil disimpan permanen ke Basis Data Server dan disinkronkan ke Firebase.',
      updatedAt: dbState.updatedAt,
    });
  });

  // Reset database to initial factory defaults
  app.post('/api/reset', (req, res) => {
    dbState = {
      asets: INITIAL_ASETS,
      verifikasiList: INITIAL_VERIFIKASI,
      pengesahanList: INITIAL_PENGESAHAN,
      users: INITIAL_USERS,
      desas: INITIAL_DESA_LIST,
      kecamatanProfile: INITIAL_KECAMATAN_PROFILE,
      selectedYear: 0,
      updatedAt: new Date().toISOString(),
    };
    saveDatabase(dbState);
    res.json({ success: true, message: 'Data berhasil direset ke pengaturan awal' });
  });

  // ==================== VITE MIDDLEWARE / SPA SERVING ====================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SIPADES Server] Berjalan pada http://0.0.0.0:${PORT}`);
  });
}

startServer();
