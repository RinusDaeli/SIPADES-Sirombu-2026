import { Peer, DataConnection } from 'peerjs';
import { Aset, PermohonanVerifikasi, PengesahanLaporan, Desa, User, KecamatanProfile } from '../types';

export interface FullSyncPayload {
  version: number;
  timestamp: string;
  senderId: string;
  senderName?: string;
  asets?: Aset[];
  verifikasiList?: PermohonanVerifikasi[];
  pengesahanList?: PengesahanLaporan[];
  desas?: Desa[];
  users?: User[];
  kecamatanProfile?: KecamatanProfile;
  deletedId?: string;
  deletedAssetIds?: string[];
  updatedDesa?: Desa;
  updatedAset?: Aset;
}

export type SyncCallback = (payload: FullSyncPayload) => void;

const SIGNAL_TOPIC = 'sipades_sirombu_p2p_signals_2026';
const SIGNAL_URL = `https://ntfy.sh/${SIGNAL_TOPIC}`;
const SSE_URL = `https://ntfy.sh/${SIGNAL_TOPIC}/sse`;

class CloudSyncManager {
  private peer: Peer | null = null;
  private peerId: string = '';
  private connections: Map<string, DataConnection> = new Map();
  private syncCallbacks: Set<SyncCallback> = new Set();
  private eventSource: EventSource | null = null;
  private getStateFn: (() => FullSyncPayload) | null = null;
  private isInitialized: boolean = false;
  private connectedPeerCount: number = 0;
  private peerCountListeners: Set<(count: number) => void> = new Set();

  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.peerId = `sipades-${Math.random().toString(36).substring(2, 9)}`;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('sipades_sirombu_optimistic_bus');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.payload && event.data.senderId !== this.peerId) {
            this.notifySync(event.data.payload);
          }
        };
      } catch (e) {
        console.warn('[Sync] BroadcastChannel init warning:', e);
      }
    }
  }

  public registerStateGetter(fn: () => FullSyncPayload) {
    this.getStateFn = fn;
  }

  public onSync(cb: SyncCallback): () => void {
    this.syncCallbacks.add(cb);
    return () => this.syncCallbacks.delete(cb);
  }

  public onPeerCountChange(cb: (count: number) => void): () => void {
    this.peerCountListeners.add(cb);
    cb(this.connectedPeerCount);
    return () => this.peerCountListeners.delete(cb);
  }

  private updatePeerCount() {
    this.connectedPeerCount = this.connections.size;
    this.peerCountListeners.forEach((cb) => cb(this.connectedPeerCount));
  }

  public init(getState: () => FullSyncPayload) {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    this.getStateFn = getState;

    this.initPeerJS();
    this.initSignalListener();
  }

  private initPeerJS() {
    try {
      this.peer = new Peer(this.peerId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        debug: 0,
      });

      this.peer.on('open', (id) => {
        this.peerId = id;
        // Announce presence via cloud signaling
        this.broadcastSignal({
          type: 'ANNOUNCE',
          peerId: this.peerId,
        });
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('[P2P] PeerJS warning:', err);
      });
    } catch (e) {
      console.warn('[P2P] PeerJS init error:', e);
    }
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.updatePeerCount();

      // Whenever a connection opens, share state if we have data
      if (this.getStateFn) {
        const state = this.getStateFn();
        conn.send({
          type: 'SYNC_STATE',
          payload: state,
        });
      }
    });

    conn.on('data', (data: any) => {
      if (data && (data.type === 'SYNC_STATE' || data.type === 'DELETE_ASET') && data.payload) {
        this.notifySync(data.payload);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.updatePeerCount();
    });

    conn.on('error', () => {
      this.connections.delete(conn.peer);
      this.updatePeerCount();
    });
  }

  private connectToPeer(remotePeerId: string) {
    if (!this.peer || remotePeerId === this.peerId || this.connections.has(remotePeerId)) {
      return;
    }
    try {
      const conn = this.peer.connect(remotePeerId, { reliable: true });
      this.setupConnection(conn);
    } catch (e) {
      console.warn('[P2P] Failed to connect to peer:', remotePeerId, e);
    }
  }

  private initSignalListener() {
    try {
      this.eventSource = new EventSource(SSE_URL);
      this.eventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (!raw.message) return;
          const msg = typeof raw.message === 'string' ? JSON.parse(raw.message) : raw.message;

          if (msg && msg.peerId && msg.peerId !== this.peerId) {
            if (msg.type === 'ANNOUNCE') {
              // Connect to the newly announced peer
              this.connectToPeer(msg.peerId);
            } else if (
              (msg.type === 'BROADCAST_STATE' ||
                msg.type === 'DESA_UPDATE' ||
                msg.type === 'ASET_UPDATE' ||
                msg.type === 'DELETE_ASET' ||
                msg.type === 'KECAMATAN_UPDATE') &&
              msg.payload
            ) {
              this.notifySync(msg.payload);
            }
          }
        } catch {
          // ignore heartbeat / invalid format
        }
      };

      this.eventSource.onerror = () => {
        // SSE will auto-reconnect
      };
    } catch {
      // ignore
    }
  }

  private async broadcastSignal(data: any) {
    try {
      await fetch(SIGNAL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: SIGNAL_TOPIC,
          message: JSON.stringify(data),
        }),
      });
    } catch {
      // ignore offline
    }
  }

  private notifySync(payload: FullSyncPayload) {
    if (payload.senderId === this.peerId) return;
    this.syncCallbacks.forEach((cb) => cb(payload));
  }

  public broadcastDesaUpdate(desa: Desa) {
    const payload: FullSyncPayload = {
      version: 2,
      timestamp: new Date().toISOString(),
      senderId: this.peerId,
      updatedDesa: desa,
      desas: [desa],
    };

    // 1. BroadcastChannel (local 0ms)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'DESA_UPDATE',
          senderId: this.peerId,
          payload,
        });
      } catch {}
    }

    // 2. WebRTC P2P
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({ type: 'DESA_UPDATE', payload });
        } catch {}
      }
    });

    // 3. Cloud SSE Relay (ntfy.sh) - very fast < 300 bytes
    this.broadcastSignal({
      type: 'DESA_UPDATE',
      peerId: this.peerId,
      payload,
    });
  }

  public broadcastAsetUpdate(aset: Aset) {
    const payload: FullSyncPayload = {
      version: 2,
      timestamp: new Date().toISOString(),
      senderId: this.peerId,
      updatedAset: aset,
      asets: [{ ...aset, fotoAset: [], fotoBast: undefined }],
    };

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'ASET_UPDATE',
          senderId: this.peerId,
          payload,
        });
      } catch {}
    }

    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({ type: 'ASET_UPDATE', payload });
        } catch {}
      }
    });

    this.broadcastSignal({
      type: 'ASET_UPDATE',
      peerId: this.peerId,
      payload,
    });
  }

  public broadcastChange(payload: FullSyncPayload) {
    // 1. Send via local BroadcastChannel for instant cross-tab / iframe sync
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'SYNC_STATE',
          senderId: this.peerId,
          payload: { ...payload, senderId: this.peerId },
        });
      } catch {}
    }

    // 2. Send to all directly connected P2P WebRTC peers
    const message = {
      type: 'SYNC_STATE',
      payload: { ...payload, senderId: this.peerId },
    };

    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(message);
        } catch {
          // ignore
        }
      }
    });

    // 3. Broadcast via cloud signaling channel for immediate discovery
    // Only send lightweight metadata if payload is very large
    const lightweightPayload: FullSyncPayload = {
      ...payload,
      senderId: this.peerId,
      asets: payload.asets ? payload.asets.map((a) => ({ ...a, fotoAset: [], fotoBast: undefined })) : [],
    };

    this.broadcastSignal({
      type: 'BROADCAST_STATE',
      peerId: this.peerId,
      payload: lightweightPayload,
    });
  }

  public broadcastDelete(assetId: string, remainingAsets: Aset[]) {
    const payload: FullSyncPayload = {
      version: 2,
      timestamp: new Date().toISOString(),
      senderId: this.peerId,
      deletedId: assetId,
      deletedAssetIds: [assetId],
      asets: remainingAsets,
    };

    // 0. Send via local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'DELETE_ASET',
          senderId: this.peerId,
          payload,
        });
      } catch {}
    }

    // 1. Send via active P2P connections
    this.connections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({ type: 'DELETE_ASET', payload });
        } catch {
          // ignore
        }
      }
    });

    // 2. Broadcast via cloud signaling
    this.broadcastSignal({
      type: 'DELETE_ASET',
      peerId: this.peerId,
      payload,
    });
  }

  public requestFullSync() {
    this.broadcastSignal({
      type: 'ANNOUNCE',
      peerId: this.peerId,
    });
  }

  public getConnectedCount(): number {
    return this.connectedPeerCount;
  }
}

export const syncManager = new CloudSyncManager();

// ==================== MANUAL TRANSFER UTILITIES ====================

export function generateSyncCode(data: FullSyncPayload): string {
  try {
    const jsonStr = JSON.stringify(data);
    return btoa(encodeURIComponent(jsonStr));
  } catch {
    return '';
  }
}

export function parseSyncCode(code: string): FullSyncPayload | null {
  try {
    const decoded = decodeURIComponent(atob(code.trim()));
    const parsed = JSON.parse(decoded);
    if (parsed && (Array.isArray(parsed.asets) || Array.isArray(parsed.desas))) {
      return parsed as FullSyncPayload;
    }
    return null;
  } catch {
    return null;
  }
}
