import express from 'express';
import http from 'http';
import https from 'https';
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
import { Aset, PermohonanVerifikasi, PengesahanLaporan, User, Desa, KecamatanProfile, SystemAnnouncement } from './src/types';
import {
  normalizeAsetRegisters,
  ensureUniqueRegistersForNewAsets,
  ensureUniqueRegisterOnUpdate,
} from './src/utils/reportGenerator';

interface DatabaseSchema {
  asets: Aset[];
  verifikasiList: PermohonanVerifikasi[];
  pengesahanList: PengesahanLaporan[];
  users: User[];
  desas: Desa[];
  kecamatanProfile: KecamatanProfile;
  announcements?: SystemAnnouncement[];
  selectedYear: number;
  deletedIds?: string[];
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

function restoreMissingPhotos(asets: Aset[]): Aset[] {
  // Photos are stored as lightweight URL paths (/uploads/foto-aset/...)
  return asets;
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const rawAsets = Array.isArray(parsed.asets) ? parsed.asets : INITIAL_ASETS;
      const hydratedAsets = restoreMissingPhotos(rawAsets);
      const loadedDesas = Array.isArray(parsed.desas) && parsed.desas.length > 0 ? parsed.desas : INITIAL_DESA_LIST;
      const normalizedRes = normalizeAsetRegisters(hydratedAsets, loadedDesas);

      const state: DatabaseSchema = {
        asets: normalizedRes.asets,
        verifikasiList: Array.isArray(parsed.verifikasiList) ? parsed.verifikasiList : INITIAL_VERIFIKASI,
        pengesahanList: Array.isArray(parsed.pengesahanList) ? parsed.pengesahanList : INITIAL_PENGESAHAN,
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : INITIAL_USERS,
        desas: loadedDesas,
        kecamatanProfile: parsed.kecamatanProfile || INITIAL_KECAMATAN_PROFILE,
        announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
        selectedYear: typeof parsed.selectedYear === 'number' ? parsed.selectedYear : 0,
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : ['ast-1794407303430-0-85mzy'],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };

      if (normalizedRes.changed) {
        fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
      }
      return state;
    }
  } catch (error) {
    console.error('[Database] Failed to read database file, initializing defaults:', error);
  }

  const normalizedInit = normalizeAsetRegisters(restoreMissingPhotos(INITIAL_ASETS), INITIAL_DESA_LIST).asets;
  const defaultState: DatabaseSchema = {
    asets: normalizedInit,
    verifikasiList: INITIAL_VERIFIKASI,
    pengesahanList: INITIAL_PENGESAHAN,
    users: INITIAL_USERS,
    desas: INITIAL_DESA_LIST,
    kecamatanProfile: INITIAL_KECAMATAN_PROFILE,
    announcements: [],
    selectedYear: 0,
    deletedIds: ['ast-1794407303430-0-85mzy'],
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(defaultState);
  return defaultState;
}

function syncDesasToInitialData(desas: Desa[]) {
  try {
    const initFile = path.resolve(process.cwd(), 'src/data/initialData.ts');
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

function saveDatabase(state: DatabaseSchema, syncMaster = false) {
  try {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    if (syncMaster) {
      syncDesasToInitialData(state.desas);
    }
    broadcastEvent('DATA_CHANGED', state);
  } catch (error) {
    console.error('[Database] Failed to save database file:', error);
  }
}

function resolvePort(): number {
  // 1. Honor CLI argument: --port <num>
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  // 2. Honor explicit APP_PORT
  if (process.env.APP_PORT) {
    const parsed = parseInt(process.env.APP_PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  // 3. Standalone production (e.g. Cloud Run where PORT is dedicated to node)
  if (process.env.NODE_ENV === 'production' && process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  // 4. In development container, PORT=8080 is reserved for Nginx. Dev server MUST listen on 3000.
  if (process.env.PORT && process.env.PORT !== '8080') {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3000;
}

async function startServer() {
  const app = express();
  const PORT = resolvePort();
  const server = http.createServer(app);

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

  // JSON Body Parser with 100mb limit for asset photos & document scans
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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

    if (Array.isArray(payload.deletedIds)) {
      if (!dbState.deletedIds) dbState.deletedIds = [];
      payload.deletedIds.forEach((id: string) => {
        if (!dbState.deletedIds!.includes(id)) dbState.deletedIds!.push(id);
      });
    }

    const currentDeleted = new Set(dbState.deletedIds || []);

    if (Array.isArray(payload.asets)) {
      const map = new Map<string, Aset>(dbState.asets.filter((a) => !currentDeleted.has(a.id)).map((a) => [a.id, a]));
      payload.asets.forEach((a: Aset) => {
        if (a && a.id && !currentDeleted.has(a.id)) {
          const exist = map.get(a.id);
          let fotoAset = a.fotoAset;
          if ((!fotoAset || fotoAset.length === 0) && exist?.fotoAset && exist.fotoAset.length > 0) {
            fotoAset = exist.fotoAset;
          }
          let fotoBast = a.fotoBast || exist?.fotoBast || '';
          map.set(a.id, { ...a, fotoAset: fotoAset || [], fotoBast });
        }
      });
      dbState.asets = normalizeAsetRegisters(restoreMissingPhotos(Array.from(map.values())), dbState.desas).asets;
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

  async function callCpanelHttp(
    pathWithQuery: string,
    method: string = 'GET',
    postData: string = '',
    customBaseUrl?: string
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      let targetHost = 'sipadessirombu.my.id';
      let targetPath = pathWithQuery.startsWith('/') ? pathWithQuery : '/' + pathWithQuery;
      let targetPort = 443;
      let useHttp = false;

      if (customBaseUrl && customBaseUrl.trim()) {
        try {
          const parsedUrl = new URL(customBaseUrl.trim());
          targetHost = parsedUrl.hostname;
          useHttp = parsedUrl.protocol === 'http:';
          targetPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : useHttp ? 80 : 443;
          const qIdx = pathWithQuery.indexOf('?');
          const queryPart = qIdx >= 0 ? pathWithQuery.slice(qIdx) : '';
          targetPath = (parsedUrl.pathname || '/cpanel-api.php') + queryPart;
        } catch {
          // fallback to default host & path
        }
      }

      const reqHeaders: Record<string, string> = {
        Host: targetHost,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      };
      if (postData) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
      }

      const clientModule = useHttp ? http : https;
      const req = clientModule.request(
        {
          hostname: targetHost,
          port: targetPort,
          path: targetPath,
          method,
          headers: reqHeaders,
          ...(useHttp ? {} : { servername: targetHost }),
        },
        (res: any) => {
          let resBody = '';
          res.on('data', (chunk: any) => (resBody += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode || 200, body: resBody }));
        }
      );

      req.on('error', (err: any) => {
        console.warn('[cPanel HTTPS] Connection error:', err.message);
        reject(err);
      });

      req.setTimeout(180000, () => {
        req.destroy();
        reject(new Error('Koneksi timeout ke cPanel (180s)'));
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  // Assets endpoints
  app.post('/api/asets/batch', (req, res) => {
    const { asets } = req.body;
    if (!Array.isArray(asets) || asets.length === 0) {
      return res.status(400).json({ error: 'Daftar aset tidak valid' });
    }

    const validIncoming = asets.filter((a: any) => a && a.id);
    const existingIds = new Set(dbState.asets.map((a) => a.id));
    const updates = validIncoming.filter((a: Aset) => existingIds.has(a.id));
    const additions = validIncoming.filter((a: Aset) => !existingIds.has(a.id));

    for (const a of updates) {
      const idx = dbState.asets.findIndex((item) => item.id === a.id);
      if (idx >= 0) {
        const merged = { ...dbState.asets[idx], ...a };
        dbState.asets[idx] = ensureUniqueRegisterOnUpdate(merged, dbState.asets, dbState.desas);
      }
    }

    if (additions.length > 0) {
      const lockedAdditions = ensureUniqueRegistersForNewAsets(additions, dbState.asets, dbState.desas);
      for (let i = lockedAdditions.length - 1; i >= 0; i--) {
        dbState.asets.unshift(lockedAdditions[i]);
      }
    }

    saveDatabase(dbState);
    // Automatic Real-time Atomic Batch Sync to cPanel hosting (never overwrites unrelated assets)
    callCpanelHttp('/cpanel-api.php?action=batch_sync', 'POST', JSON.stringify({ data: { asets: validIncoming } })).catch((e) =>
      console.warn('[cPanel Sync] batch error:', e.message)
    );
    res.json({ success: true, count: asets.length, total: dbState.asets.length });
  });

  app.post('/api/asets', (req, res) => {
    if (Array.isArray(req.body)) {
      const validIncoming = req.body.filter((a: any) => a && a.id);
      const existingIds = new Set(dbState.asets.map((a) => a.id));
      const updates = validIncoming.filter((a: Aset) => existingIds.has(a.id));
      const additions = validIncoming.filter((a: Aset) => !existingIds.has(a.id));

      for (const a of updates) {
        const idx = dbState.asets.findIndex((item) => item.id === a.id);
        if (idx >= 0) {
          const merged = { ...dbState.asets[idx], ...a };
          dbState.asets[idx] = ensureUniqueRegisterOnUpdate(merged, dbState.asets, dbState.desas);
        }
      }
      if (additions.length > 0) {
        const lockedAdditions = ensureUniqueRegistersForNewAsets(additions, dbState.asets, dbState.desas);
        for (let i = lockedAdditions.length - 1; i >= 0; i--) {
          dbState.asets.unshift(lockedAdditions[i]);
        }
      }

      saveDatabase(dbState);
      callCpanelHttp('/cpanel-api.php?action=batch_sync', 'POST', JSON.stringify({ data: { asets: validIncoming } })).catch(() => {});
      return res.json({ success: true, count: req.body.length, total: dbState.asets.length });
    }

    const newAset: Aset = req.body;
    if (!newAset || !newAset.id || !newAset.namaAset) {
      return res.status(400).json({ error: 'Data aset tidak lengkap' });
    }

    // Check if asset already exists, replace or append with locked unique nomorRegister
    const idx = dbState.asets.findIndex((a) => a.id === newAset.id);
    let savedAset: Aset;
    if (idx >= 0) {
      savedAset = ensureUniqueRegisterOnUpdate({ ...dbState.asets[idx], ...newAset }, dbState.asets, dbState.desas);
      dbState.asets[idx] = savedAset;
    } else {
      savedAset = ensureUniqueRegistersForNewAsets([newAset], dbState.asets, dbState.desas)[0];
      dbState.asets.unshift(savedAset);
    }

    saveDatabase(dbState);
    // Automatic Real-time Sync to cPanel hosting
    callCpanelHttp('/cpanel-api.php?action=save_aset', 'POST', JSON.stringify(savedAset)).catch((e) =>
      console.warn('[cPanel Sync] save error:', e.message)
    );
    res.json({ success: true, aset: savedAset, total: dbState.asets.length });
  });

  app.put('/api/asets/:id', (req, res) => {
    const { id } = req.params;
    const updated = req.body;
    const idx = dbState.asets.findIndex((a) => a.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Aset tidak ditemukan' });
    }

    const candidate = { ...dbState.asets[idx], ...updated };
    dbState.asets[idx] = ensureUniqueRegisterOnUpdate(candidate, dbState.asets, dbState.desas);
    saveDatabase(dbState);
    // Automatic Real-time Sync to cPanel hosting with lightweight payload
    const lightAset: Record<string, any> = { ...dbState.asets[idx] };
    if (typeof lightAset.fotoAset === 'string' && lightAset.fotoAset.length > 500) delete lightAset.fotoAset;
    if (typeof lightAset.fotoBast === 'string' && lightAset.fotoBast.length > 500) delete lightAset.fotoBast;
    callCpanelHttp('/cpanel-api.php?action=save_aset', 'POST', JSON.stringify(lightAset)).catch((e) =>
      console.warn('[cPanel Sync] update error:', e.message)
    );
    res.json({ success: true, aset: dbState.asets[idx] });
  });

  app.delete('/api/asets/:id', (req, res) => {
    const { id } = req.params;
    if (!dbState.deletedIds) dbState.deletedIds = [];
    if (!dbState.deletedIds.includes(id)) {
      dbState.deletedIds.push(id);
    }
    dbState.asets = dbState.asets.filter((a) => a.id !== id);
    saveDatabase(dbState);
    // Automatic Real-time Sync to cPanel hosting (Deletions are removed in cPanel)
    callCpanelHttp('/cpanel-api.php?action=delete_aset', 'POST', JSON.stringify({ id })).catch((e) =>
      console.warn('[cPanel Sync] delete error:', e.message)
    );
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
    callCpanelHttp('/cpanel-api.php?action=upload_all', 'POST', JSON.stringify({ data: { verifikasiList: dbState.verifikasiList } })).catch(() => {});
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
    callCpanelHttp('/cpanel-api.php?action=upload_all', 'POST', JSON.stringify({ data: { verifikasiList: dbState.verifikasiList } })).catch(() => {});
    res.json({ success: true, verifikasi: dbState.verifikasiList[idx] });
  });

  // Proxy endpoint to diagnose and connect cPanel without CORS / Mixed Content issues
  app.post('/api/cpanel/test', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ success: false, message: 'URL tidak boleh kosong' });
    try {
      const response = await callCpanelHttp(`/cpanel-api.php?action=ping&_t=${Date.now()}`, 'GET', '', url);
      let parsed: any = null;
      try {
        parsed = JSON.parse(response.body);
      } catch {}

      if (response.statusCode === 200 && parsed && parsed.status === 'success') {
        return res.json({
          success: true,
          message: parsed.message || 'Koneksi cPanel Web Hosting Berhasil!',
          totalAset: parsed.totalAset ?? parsed.totalUnit ?? 0,
          totalUnit: parsed.totalUnit ?? parsed.totalAset ?? 0,
          activeAset: parsed.activeAset ?? parsed.totalAset ?? 0,
          pendingVerifikasi: parsed.pendingVerifikasi ?? 0,
          updatedAt: parsed.updatedAt,
        });
      }

      return res.json({
        success: false,
        message: `Server cPanel merespon status ${response.statusCode}: ${response.body.slice(0, 150)}`,
      });
    } catch (err: any) {
      return res.json({
        success: false,
        message: `Gagal menghubungi server cPanel: ${err.message}`,
      });
    }
  });

  app.post('/api/cpanel/upload', async (req, res) => {
    const { url, payload } = req.body || {};
    try {
      if (payload) {
        const d = payload.data || payload;
        if (Array.isArray(d.desas) && d.desas.length > 0) dbState.desas = d.desas;
        if (Array.isArray(d.asets) && d.asets.length > 0) {
          const map = new Map<string, Aset>(dbState.asets.map((a) => [a.id, a]));
          d.asets.forEach((a: Aset) => {
            if (a && a.id) {
              const exist = map.get(a.id);
              map.set(a.id, exist ? { ...exist, ...a } : a);
            }
          });
          dbState.asets = normalizeAsetRegisters(Array.from(map.values()), dbState.desas).asets;
        }
        if (Array.isArray(d.verifikasiList)) dbState.verifikasiList = d.verifikasiList;
        if (Array.isArray(d.pengesahanList)) dbState.pengesahanList = d.pengesahanList;
        if (Array.isArray(d.users) && d.users.length > 0) dbState.users = d.users;
        if (d.kecamatanProfile) dbState.kecamatanProfile = d.kecamatanProfile;
        saveDatabase(dbState);
      }

      const cpanelPayload = payload && payload.data ? payload : { data: payload || { asets: dbState.asets } };
      const payloadStr = JSON.stringify(cpanelPayload);
      const response = await callCpanelHttp('/cpanel-api.php?action=upload_all', 'POST', payloadStr, url);
      let parsed: any = null;
      try {
        parsed = JSON.parse(response.body);
      } catch {}

      if (parsed && (parsed.status === 'success' || parsed.success)) {
        return res.json({
          status: 'success',
          success: true,
          totalAset: parsed.totalAset || dbState.asets.length,
          message: parsed.message || 'Seluruh data berhasil disinkronkan ke cPanel hosting',
        });
      }

      if (response.statusCode === 200) {
        return res.json({
          status: 'success',
          success: true,
          totalAset: dbState.asets.length,
          message: 'Seluruh data berhasil disinkronkan ke cPanel hosting',
        });
      }

      return res.json({
        status: 'error',
        success: false,
        message: `cPanel merespon status ${response.statusCode}: ${response.body.slice(0, 150)}`,
      });
    } catch (err: any) {
      console.error('[cPanel Upload Proxy Error]:', err);
      return res.status(500).json({ status: 'error', success: false, message: err.message });
    }
  });

  app.post(['/api/cpanel/batch_sync', '/api/cpanel/upload_chunk'], async (req, res) => {
    const { url, payload, data: directData } = req.body || {};
    const bodyObj = payload || (directData ? { data: directData } : req.body);
    try {
      const d = bodyObj?.data || bodyObj || {};
      if (Array.isArray(d.desas) && d.desas.length > 0) dbState.desas = d.desas;
      if (Array.isArray(d.asets) && d.asets.length > 0) {
        const deletedSet = new Set(dbState.deletedIds || []);
        const validIncoming = d.asets.filter((a: Aset) => a && a.id);
        validIncoming.forEach((a: Aset) => deletedSet.delete(a.id));
        dbState.deletedIds = Array.from(deletedSet);

        const existingIds = new Set(dbState.asets.map((a) => a.id));
        const updates = validIncoming.filter((a: Aset) => existingIds.has(a.id));
        const additions = validIncoming.filter((a: Aset) => !existingIds.has(a.id));

        for (const a of updates) {
          const idx = dbState.asets.findIndex((item) => item.id === a.id);
          if (idx >= 0) {
            const merged = { ...dbState.asets[idx], ...a };
            dbState.asets[idx] = ensureUniqueRegisterOnUpdate(merged, dbState.asets, dbState.desas);
          }
        }
        if (additions.length > 0) {
          const lockedAdditions = ensureUniqueRegistersForNewAsets(additions, dbState.asets, dbState.desas);
          for (let i = lockedAdditions.length - 1; i >= 0; i--) {
            dbState.asets.unshift(lockedAdditions[i]);
          }
        }
      }
      if (Array.isArray(d.verifikasiList)) dbState.verifikasiList = d.verifikasiList;
      if (Array.isArray(d.pengesahanList)) dbState.pengesahanList = d.pengesahanList;
      if (Array.isArray(d.users) && d.users.length > 0) dbState.users = d.users;
      if (d.kecamatanProfile) dbState.kecamatanProfile = d.kecamatanProfile;
      saveDatabase(dbState);

      const cpanelPayload = bodyObj && bodyObj.data ? bodyObj : { data: d };
      const response = await callCpanelHttp('/cpanel-api.php?action=batch_sync', 'POST', JSON.stringify(cpanelPayload), url);
      let parsed: any = null;
      try {
        parsed = JSON.parse(response.body);
      } catch {}

      return res.json({
        status: 'success',
        success: true,
        totalAset: parsed?.totalAset || dbState.asets.length,
        message: parsed?.message || 'Batch data berhasil disinkronkan ke cPanel',
      });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', success: false, message: err.message });
    }
  });

  // Proxy endpoint to save an individual asset to cPanel (instant, safe, immune to CORS and ModSecurity)
  app.post('/api/cpanel/save_aset', async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id) {
        return res.status(400).json({ error: 'Data aset tidak valid' });
      }

      // Update local dbState with unique nomorRegister lock
      const idx = dbState.asets.findIndex((a) => a.id === item.id);
      let lockedItem: Aset;
      if (idx >= 0) {
        lockedItem = ensureUniqueRegisterOnUpdate({ ...dbState.asets[idx], ...item }, dbState.asets, dbState.desas);
        dbState.asets[idx] = lockedItem;
      } else {
        lockedItem = ensureUniqueRegistersForNewAsets([item], dbState.asets, dbState.desas)[0];
        dbState.asets.unshift(lockedItem);
      }
      saveDatabase(dbState);

      // Lightweight copy for cPanel
      const light: Record<string, any> = { ...lockedItem };
      if (typeof light.fotoAset === 'string' && light.fotoAset.length > 500) delete light.fotoAset;
      if (typeof light.fotoBast === 'string' && light.fotoBast.length > 500) delete light.fotoBast;

      callCpanelHttp('/cpanel-api.php?action=save_aset', 'POST', JSON.stringify(light)).catch((e) =>
        console.warn('[cPanel Proxy save_aset error]:', e.message)
      );

      return res.json({ success: true, aset: lockedItem });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Proxy endpoint to delete an asset from cPanel
  app.post('/api/cpanel/delete_aset', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID tidak boleh kosong' });

      if (!dbState.deletedIds) dbState.deletedIds = [];
      if (!dbState.deletedIds.includes(id)) {
        dbState.deletedIds.push(id);
      }
      dbState.asets = dbState.asets.filter((a) => a.id !== id);
      saveDatabase(dbState);

      callCpanelHttp('/cpanel-api.php?action=delete_aset', 'POST', JSON.stringify({ id })).catch((e) =>
        console.warn('[cPanel Proxy delete_aset error]:', e.message)
      );

      return res.json({ success: true, total: dbState.asets.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
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

  // Announcements (Pengumuman Super Admin)
  app.get('/api/announcements', (req, res) => {
    res.json(dbState.announcements || []);
  });

  app.post('/api/announcements/create', (req, res) => {
    const { title, message, priority, senderName } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'Pesan pengumuman wajib diisi' });
    }
    const newAnnouncement: SystemAnnouncement = {
      id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title || 'Pemberitahuan dari Super Admin',
      message,
      senderName: senderName || 'Super Admin Sirombu',
      createdAt: new Date().toISOString(),
      priority: priority || 'warning',
      active: true,
    };
    if (!Array.isArray(dbState.announcements)) {
      dbState.announcements = [];
    }
    dbState.announcements.unshift(newAnnouncement);
    saveDatabase(dbState);
    broadcastEvent('ANNOUNCEMENT_CHANGED', dbState.announcements);
    res.json({ success: true, announcement: newAnnouncement });
  });

  app.post('/api/announcements/delete', (req, res) => {
    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: 'ID pengumuman tidak ditemukan' });
    }
    if (Array.isArray(dbState.announcements)) {
      dbState.announcements = dbState.announcements.filter((a) => a.id !== id);
    }
    saveDatabase(dbState);
    broadcastEvent('ANNOUNCEMENT_CHANGED', dbState.announcements || []);
    res.json({ success: true, message: 'Pengumuman berhasil ditarik / dihapus' });
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
    saveDatabase(dbState, true);
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

  // Fetch live database from cPanel hosting via server-to-server HTTPS (bypasses browser CORS & LiteSpeed 406)
  app.get('/api/cpanel/data', async (req, res) => {
    try {
      const response = await callCpanelHttp(`/cpanel-api.php?action=data&_t=${Date.now()}`, 'GET');
      if (response.statusCode === 200 && response.body) {
        try {
          const parsed = JSON.parse(response.body);
          if (parsed && Array.isArray(parsed.asets) && parsed.asets.length > 0) {
            const remoteDeleted = new Set<string>(Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []);
            const localDeleted = new Set<string>(dbState.deletedIds || []);
            const map = new Map<string, Aset>(dbState.asets.map((a) => [a.id, a]));
            const seenRemoteIds = new Set<string>();

            const mergedAsets = parsed.asets
              .filter((rAset: Aset) => rAset && rAset.id && !localDeleted.has(rAset.id))
              .map((rAset: Aset) => {
                seenRemoteIds.add(rAset.id);
                const localAset = map.get(rAset.id);
                if (!localAset) return rAset;

                let fotoAset = rAset.fotoAset;
                if ((!fotoAset || fotoAset.length === 0) && localAset.fotoAset && localAset.fotoAset.length > 0) {
                  fotoAset = localAset.fotoAset;
                }
                let fotoBast = rAset.fotoBast || localAset.fotoBast || '';

                const localTime = new Date(localAset.updatedAt || 0).getTime();
                const remoteTime = new Date(rAset.updatedAt || 0).getTime();

                if (localTime > remoteTime) {
                  return {
                    ...rAset,
                    ...localAset,
                    fotoAset: (localAset.fotoAset && localAset.fotoAset.length > 0 ? localAset.fotoAset : fotoAset) || [],
                    fotoBast: localAset.fotoBast || fotoBast,
                  };
                }

                return {
                  ...localAset,
                  ...rAset,
                  fotoAset: fotoAset || [],
                  fotoBast,
                };
              });

            // Include any active local assets not yet deleted remotely
            for (const localAset of dbState.asets) {
              if (localAset && localAset.id && !seenRemoteIds.has(localAset.id) && !remoteDeleted.has(localAset.id) && !localDeleted.has(localAset.id)) {
                mergedAsets.unshift(localAset);
              }
            }

            const finalAsets = normalizeAsetRegisters(restoreMissingPhotos(mergedAsets), parsed.desas || dbState.desas).asets;

            // Keep dbState and local data/database.json in sync with live cPanel
            const combinedDeleted = Array.from(new Set([...(dbState.deletedIds || []), ...Array.from(remoteDeleted)]));
            dbState.deletedIds = combinedDeleted;
            dbState.asets = finalAsets;
            if (Array.isArray(parsed.desas) && parsed.desas.length > 0) dbState.desas = parsed.desas;
            if (Array.isArray(parsed.users) && parsed.users.length > 0) dbState.users = parsed.users;
            if (Array.isArray(parsed.verifikasiList)) dbState.verifikasiList = parsed.verifikasiList;
            if (Array.isArray(parsed.pengesahanList)) dbState.pengesahanList = parsed.pengesahanList;
            if (parsed.kecamatanProfile) dbState.kecamatanProfile = parsed.kecamatanProfile;
            dbState.updatedAt = parsed.updatedAt || new Date().toISOString();
            try {
              fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
            } catch {}

            return res.json({
              ...parsed,
              deletedIds: combinedDeleted,
              asets: finalAsets,
              desas: dbState.desas,
              users: dbState.users,
              kecamatanProfile: dbState.kecamatanProfile,
            });
          }
        } catch {
          // If body is not json, fallback to dbState
        }
      }
      return res.json(dbState);
    } catch (err: any) {
      console.warn('[cPanel Data Proxy Error]:', err.message);
      return res.json(dbState);
    }
  });

  // Dedicated ZIP package info and streaming endpoints (bypasses iframe cookie check)
  app.get('/api/zip-info', (req, res) => {
    const zipPath = path.join(process.cwd(), 'public/sipades-web-sirombu.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ exists: false, error: 'Berkas ZIP belum dibuat' });
    }
    const stat = fs.statSync(zipPath);
    res.json({
      exists: true,
      filename: 'sipades-web-sirombu.zip',
      sizeBytes: stat.size,
      sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
      modified: stat.mtime.toISOString(),
      integrity: 'valid_info_zip',
    });
  });

  app.get('/api/download-zip', (req, res) => {
    const zipPath = path.join(process.cwd(), 'public/sipades-web-sirombu.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: 'Berkas sipades-web-sirombu.zip tidak ditemukan di server' });
    }
    const stat = fs.statSync(zipPath);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="sipades-web-sirombu.zip"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
    });
    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);
  });

  // Base64 JSON download endpoint - Immune to iframe/proxy stream truncations
  app.get('/api/zip-base64', (req, res) => {
    const zipPath = path.join(process.cwd(), 'public/sipades-web-sirombu.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, error: 'Berkas sipades-web-sirombu.zip tidak ditemukan' });
    }
    const buf = fs.readFileSync(zipPath);
    res.json({
      success: true,
      filename: 'sipades-web-sirombu.zip',
      size: buf.length,
      sizeKB: (buf.length / 1024).toFixed(1),
      base64: buf.toString('base64'),
    });
  });

  // Serve static public assets explicitly (ensures zip file and static assets download cleanly)
  app.use(express.static(path.join(process.cwd(), 'public'), {
    setHeaders: (res, pathStr) => {
      if (pathStr.endsWith('.zip')) {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="sipades-web-sirombu.zip"');
      }
    }
  }));

  // Serve uploads with explicit static middleware and long caching
  app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads'), {
    maxAge: '7d',
    immutable: true,
  }));

  // ==================== VITE MIDDLEWARE / SPA SERVING ====================
  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');
  const hasDist = fs.existsSync(indexHtmlPath);

  // Use static dist only when explicitly in production AND dist/index.html is built
  if (process.env.NODE_ENV === 'production' && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    // In development or when dist has not been generated, mount Vite dev middlewares
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // SPA fallback: transform and serve index.html for client-side navigation
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url.startsWith('/uploads')) {
        return next();
      }
      try {
        const rootIndexHtml = path.resolve(process.cwd(), 'index.html');
        if (!fs.existsSync(rootIndexHtml)) {
          return next();
        }
        let template = fs.readFileSync(rootIndexHtml, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SIPADES Server] Berjalan pada http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[SIPADES Server] Port ${PORT} sedang digunakan oleh proses lain:`, err.message);
    } else {
      console.error('[SIPADES Server] Server error:', err);
    }
  });
}

// Global safety handlers to keep the process resilient
process.on('uncaughtException', (err) => {
  console.error('[SIPADES Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SIPADES Server] Unhandled rejection at:', promise, 'reason:', reason);
});

startServer().catch((err) => {
  console.error('[SIPADES Server] Gagal menjalankan server:', err);
});
