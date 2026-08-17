import type { HaazariSocket } from './socket';

/**
 * Safe direct-connect fallback. TURN credentials are requested from the
 * authoritative Card Room backend at call-join time; the Metered account
 * Secret Key never enters the browser/APK bundle.
 */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
];

export function isVoiceCallSupported(): boolean {
  return typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

interface PeerEntry {
  connection: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  analyser: AnalyserNode | null;
}

export interface VoiceCallCallbacks {
  onParticipantsChanged: (playerIds: string[]) => void;
  onSpeakingChanged: (playerId: string, speaking: boolean) => void;
  onError: (message: string) => void;
}

/**
 * Manages the local mic + a mesh of RTCPeerConnections, one per other
 * participant. The first native release tops out at Kitti's 5 players (up to
 * 4 simultaneous peer connections per person), which remains small enough
 * for a pure mesh without needing a
 * media-routing server (an SFU) - the server here only ever relays small
 * signaling messages, never audio itself.
 */
export class VoiceCallManager {
  private socket: HaazariSocket;
  private myPlayerId: string;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, PeerEntry>();
  private muted = false;
  private audioCtx: AudioContext | null = null;
  private speakingCheckTimer: ReturnType<typeof setInterval> | null = null;
  private callbacks: VoiceCallCallbacks;
  private joined = false;
  private iceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS;

  constructor(socket: HaazariSocket, myPlayerId: string, callbacks: VoiceCallCallbacks) {
    this.socket = socket;
    this.myPlayerId = myPlayerId;
    this.callbacks = callbacks;
  }

  get isJoined(): boolean {
    return this.joined;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get participantIds(): string[] {
    return [...this.peers.keys()];
  }

  async join(): Promise<void> {
    if (this.joined) return;
    if (!isVoiceCallSupported()) {
      this.callbacks.onError('Voice calling is not supported in this browser.');
      return;
    }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.callbacks.onError('Could not access your microphone. Check your browser permission and try again.');
      return;
    }

    // Request short-lived TURN credentials only after the user has actually
    // granted microphone access. If the relay service is unavailable, direct
    // STUN voice is still attempted instead of blocking the call entirely.
    this.iceServers = await this.requestIceServers();

    this.socket.on('voice:participants', this.handleParticipants);
    this.socket.on('voice:peerJoined', this.handlePeerJoined);
    this.socket.on('voice:peerLeft', this.handlePeerLeft);
    this.socket.on('voice:signal', this.handleSignal);

    this.joined = true;
    this.socket.emit('voice:join');
  }

  leave(notifyServer = true): void {
    if (!this.joined) return;
    this.joined = false;
    // Socket.IO buffers emits while disconnected. A voice:leave queued during
    // transport loss can replay on the next connection before room:reconnect
    // has rebound the socket, producing a stale room error and fighting the
    // intended restore flow. The server already removes call membership on
    // disconnect/room leave, so callers can tear down locally without sending.
    if (notifyServer && this.socket.connected) this.socket.emit('voice:leave');
    this.socket.off('voice:participants', this.handleParticipants);
    this.socket.off('voice:peerJoined', this.handlePeerJoined);
    this.socket.off('voice:peerLeft', this.handlePeerLeft);
    this.socket.off('voice:signal', this.handleSignal);

    for (const id of [...this.peers.keys()]) this.teardownPeer(id);
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    if (this.speakingCheckTimer) clearInterval(this.speakingCheckTimer);
    this.speakingCheckTimer = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.callbacks.onParticipantsChanged([]);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    if (this.joined) this.socket.emit('voice:mute', { muted });
  }

  private handleParticipants = ({ playerIds }: { playerIds: string[] }) => {
    this.callbacks.onParticipantsChanged([...this.peers.keys(), ...playerIds]);
  };

  private handlePeerJoined = async ({ playerId }: { playerId: string }) => {
    if (playerId === this.myPlayerId || this.peers.has(playerId)) return;
    const conn = this.createPeerConnection(playerId);
    try {
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      this.socket.emit('voice:signal', { toPlayerId: playerId, data: { type: 'offer', sdp: offer.sdp } });
    } catch {
      this.callbacks.onError('Could not connect to another player in the call.');
    }
  };

  private handlePeerLeft = ({ playerId }: { playerId: string }) => {
    this.teardownPeer(playerId);
    this.callbacks.onParticipantsChanged([...this.peers.keys()]);
  };

  private handleSignal = async ({ fromPlayerId, data }: { fromPlayerId: string; data: any }) => {
    let entry = this.peers.get(fromPlayerId);
    if (!entry) {
      entry = { connection: this.createPeerConnection(fromPlayerId), audioEl: new Audio(), analyser: null };
    }
    const conn = entry.connection;

    try {
      if (data.type === 'offer') {
        await conn.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        this.socket.emit('voice:signal', { toPlayerId: fromPlayerId, data: { type: 'answer', sdp: answer.sdp } });
      } else if (data.type === 'answer') {
        await conn.setRemoteDescription({ type: 'answer', sdp: data.sdp });
      } else if (data.type === 'ice-candidate' && data.candidate) {
        await conn.addIceCandidate(data.candidate).catch(() => {});
      }
    } catch {
      this.callbacks.onError('A connection problem occurred with another player in the call.');
    }
  };

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const conn = new RTCPeerConnection({ iceServers: this.iceServers });
    const audioEl = new Audio();
    audioEl.autoplay = true;
    this.peers.set(peerId, { connection: conn, audioEl, analyser: null });

    this.localStream?.getTracks().forEach((track) => conn.addTrack(track, this.localStream!));

    conn.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit('voice:signal', {
          toPlayerId: peerId,
          data: { type: 'ice-candidate', candidate: e.candidate.toJSON() },
        });
      }
    };

    conn.ontrack = (e) => {
      const [stream] = e.streams;
      const entry = this.peers.get(peerId);
      if (!entry) return;
      entry.audioEl.srcObject = stream;
      entry.audioEl.play().catch(() => {});
      this.setupSpeakingDetection(peerId, stream);
      this.callbacks.onParticipantsChanged([...this.peers.keys()]);
    };

    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'failed' || conn.connectionState === 'closed') {
        this.teardownPeer(peerId);
        this.callbacks.onParticipantsChanged([...this.peers.keys()]);
      }
    };

    return conn;
  }

  private requestIceServers(): Promise<RTCIceServer[]> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (servers: RTCIceServer[]) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(servers.length ? servers : FALLBACK_ICE_SERVERS);
      };
      const timeout = setTimeout(() => finish(FALLBACK_ICE_SERVERS), 5_000);
      this.socket.emit('voice:getIceServers', (res) => {
        const safe = Array.isArray(res?.iceServers) ? res.iceServers : [];
        finish(safe);
      });
    });
  }

  private setupSpeakingDetection(peerId: string, stream: MediaStream): void {
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      const source = this.audioCtx.createMediaStreamSource(stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const entry = this.peers.get(peerId);
      if (entry) entry.analyser = analyser;

      if (!this.speakingCheckTimer) {
        const data = new Uint8Array(128);
        this.speakingCheckTimer = setInterval(() => {
          for (const [id, e] of this.peers) {
            if (!e.analyser) continue;
            e.analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            this.callbacks.onSpeakingChanged(id, avg > 12);
          }
        }, 300);
      }
    } catch {
      // Speaking-level detection is a nice-to-have - failing silently here
      // still leaves the actual audio connection working fine.
    }
  }

  private teardownPeer(peerId: string): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    entry.connection.close();
    entry.audioEl.srcObject = null;
    this.peers.delete(peerId);
    // A peer may disappear while the last analyser sample still marked them
    // as speaking. Clear it explicitly so the seat never keeps a stale voice
    // ring after leave/disconnect/ICE failure.
    this.callbacks.onSpeakingChanged(peerId, false);
  }
}
