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
  return typeof RTCPeerConnection !== 'undefined' && typeof navigator !== 'undefined';
}

interface PeerEntry {
  connection: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  analyser: AnalyserNode | null;
  pendingCandidates: RTCIceCandidateInit[];
  playbackBlocked: boolean;
}

export interface VoiceDiagnosticEvent {
  at: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  peerId?: string;
}

export interface VoiceCallCallbacks {
  onParticipantsChanged: (playerIds: string[]) => void;
  onSpeakingChanged: (playerId: string, speaking: boolean) => void;
  onError: (message: string) => void;
  onDiagnosticsChanged?: (events: VoiceDiagnosticEvent[]) => void;
  onPlaybackBlockedChanged?: (playerIds: string[]) => void;
  onSessionEnded?: () => void;
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
  private diagnostics: VoiceDiagnosticEvent[] = [];

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

  async join(mode: 'LISTEN_ONLY' | 'CONVERSATION' = 'CONVERSATION'): Promise<void> {
    if (this.joined) return;
    if (!isVoiceCallSupported()) {
      this.callbacks.onError('Voice calling is not supported in this browser.');
      return;
    }
    if (mode === 'CONVERSATION') {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.log('error', 'This browser cannot request microphone access.');
        this.callbacks.onError('Microphone access is not supported in this browser.');
        return;
      }
      try {
        this.log('info', 'Requesting microphone permission.');
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.log('info', `Microphone ready (${this.localStream.getAudioTracks().length} audio track).`);
      } catch (error) {
        this.log('error', `Microphone request failed: ${errorMessage(error)}.`);
        this.callbacks.onError('Could not access your microphone. Check your browser permission and try again.');
        return;
      }
    } else {
      this.log('info', 'Joining in listen-only mode; microphone was not requested.');
    }

    // Request short-lived TURN credentials only after the user has actually
    // granted microphone access. If the relay service is unavailable, direct
    // STUN voice is still attempted instead of blocking the call entirely.
    this.iceServers = await this.requestIceServers();

    this.socket.on('voice:participants', this.handleParticipants);
    this.socket.on('voice:peerJoined', this.handlePeerJoined);
    this.socket.on('voice:peerLeft', this.handlePeerLeft);
    this.socket.on('voice:signal', this.handleSignal);
    this.socket.on('voice:accessRevoked', this.handleAccessRevoked);

    this.joined = true;
    this.log('info', 'Joining the room voice mesh.');
    this.socket.emit('voice:join', { mode });
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
    this.socket.off('voice:accessRevoked', this.handleAccessRevoked);

    for (const id of [...this.peers.keys()]) this.teardownPeer(id);
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    if (this.speakingCheckTimer) clearInterval(this.speakingCheckTimer);
    this.speakingCheckTimer = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.callbacks.onParticipantsChanged([]);
    this.diagnostics = [];
    this.callbacks.onDiagnosticsChanged?.([]);
    this.callbacks.onPlaybackBlockedChanged?.([]);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    if (this.joined) this.socket.emit('voice:mute', { muted });
  }

  private handleParticipants = ({ playerIds }: { playerIds: string[] }) => {
    this.log('info', `Voice participants received (${playerIds.length} other).`);
    this.callbacks.onParticipantsChanged(unique([...this.peers.keys(), ...playerIds]));
  };

  private handlePeerJoined = async ({ playerId }: { playerId: string }) => {
    if (playerId === this.myPlayerId || this.peers.has(playerId)) return;
    const conn = this.createPeerConnection(playerId);
    try {
      this.log('info', 'Creating offer.', playerId);
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      this.socket.emit('voice:signal', { toPlayerId: playerId, data: { type: 'offer', sdp: offer.sdp } });
    } catch (error) {
      this.log('error', `Offer failed: ${errorMessage(error)}.`, playerId);
      this.callbacks.onError('Could not connect to another player in the call.');
    }
  };

  private handlePeerLeft = ({ playerId }: { playerId: string }) => {
    this.teardownPeer(playerId);
    this.callbacks.onParticipantsChanged([...this.peers.keys()]);
  };

  private handleAccessRevoked = ({ reason }: { reason: string }) => {
    this.leave(false);
    this.callbacks.onError(reason);
    this.callbacks.onSessionEnded?.();
  };

  private handleSignal = async ({ fromPlayerId, data }: { fromPlayerId: string; data: any }) => {
    let entry = this.peers.get(fromPlayerId);
    if (!entry) {
      this.createPeerConnection(fromPlayerId);
      entry = this.peers.get(fromPlayerId)!;
    }
    const conn = entry.connection;

    try {
      if (data.type === 'offer') {
        this.log('info', 'Offer received.', fromPlayerId);
        await conn.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        await this.flushPendingCandidates(fromPlayerId);
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        this.socket.emit('voice:signal', { toPlayerId: fromPlayerId, data: { type: 'answer', sdp: answer.sdp } });
      } else if (data.type === 'answer') {
        this.log('info', 'Answer received.', fromPlayerId);
        await conn.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        await this.flushPendingCandidates(fromPlayerId);
      } else if (data.type === 'ice-candidate' && data.candidate) {
        if (!conn.remoteDescription) {
          entry.pendingCandidates.push(data.candidate);
          this.log('info', 'ICE candidate queued until remote description is ready.', fromPlayerId);
        } else {
          await conn.addIceCandidate(data.candidate);
        }
      }
    } catch (error) {
      this.log('error', `Signaling failed: ${errorMessage(error)}.`, fromPlayerId);
      this.callbacks.onError('A connection problem occurred with another player in the call.');
    }
  };

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const conn = new RTCPeerConnection({ iceServers: this.iceServers });
    const audioEl = new Audio();
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', '');
    this.peers.set(peerId, {
      connection: conn,
      audioEl,
      analyser: null,
      pendingCandidates: [],
      playbackBlocked: false,
    });
    this.log('info', `Peer connection created with ${this.iceServers.length} ICE server entr${this.iceServers.length === 1 ? 'y' : 'ies'}.`, peerId);

    this.localStream?.getTracks().forEach((track) => conn.addTrack(track, this.localStream!));

    conn.onicecandidate = (e) => {
      if (e.candidate) {
        const type = candidateType(e.candidate.candidate);
        this.log('info', `Local ICE candidate: ${type}.`, peerId);
        this.socket.emit('voice:signal', {
          toPlayerId: peerId,
          data: { type: 'ice-candidate', candidate: e.candidate.toJSON() },
        });
      }
    };

    conn.onicecandidateerror = (event) => {
      this.log('warning', `ICE candidate error${event.errorText ? `: ${event.errorText}` : ''}.`, peerId);
    };

    conn.onicegatheringstatechange = () => {
      this.log('info', `ICE gathering: ${conn.iceGatheringState}.`, peerId);
    };

    conn.oniceconnectionstatechange = () => {
      this.log(conn.iceConnectionState === 'failed' ? 'error' : 'info', `ICE connection: ${conn.iceConnectionState}.`, peerId);
    };

    conn.ontrack = (e) => {
      const [stream] = e.streams;
      const entry = this.peers.get(peerId);
      if (!entry) return;
      this.log('info', `Remote audio track received (${stream?.getAudioTracks().length ?? 0} audio track).`, peerId);
      entry.audioEl.srcObject = stream;
      void this.playRemoteAudio(peerId);
      this.setupSpeakingDetection(peerId, stream);
      this.callbacks.onParticipantsChanged([...this.peers.keys()]);
    };

    conn.onconnectionstatechange = () => {
      this.log(conn.connectionState === 'failed' ? 'error' : 'info', `Peer connection: ${conn.connectionState}.`, peerId);
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
      const timeout = setTimeout(() => {
        this.log('warning', 'TURN request timed out; using STUN-only fallback.');
        finish(FALLBACK_ICE_SERVERS);
      }, 5_000);
      this.socket.emit('voice:getIceServers', (res) => {
        const safe = Array.isArray(res?.iceServers) ? res.iceServers : [];
        if (res?.relayAvailable) this.log('info', 'TURN relay configuration received.');
        else this.log('warning', res?.error ?? 'TURN unavailable; attempting direct STUN voice.');
        finish(safe);
      });
    });
  }

  async retryBlockedAudio(): Promise<void> {
    const blocked = [...this.peers.entries()].filter(([, entry]) => entry.playbackBlocked);
    await Promise.all(blocked.map(([peerId]) => this.playRemoteAudio(peerId)));
  }

  private async playRemoteAudio(peerId: string): Promise<void> {
    const entry = this.peers.get(peerId);
    if (!entry?.audioEl.srcObject) return;
    try {
      await entry.audioEl.play();
      entry.playbackBlocked = false;
      this.log('info', 'Remote audio playback started.', peerId);
    } catch (error) {
      entry.playbackBlocked = true;
      this.log('warning', `Remote audio playback blocked: ${errorMessage(error)}.`, peerId);
    }
    this.emitPlaybackBlocked();
  }

  private async flushPendingCandidates(peerId: string): Promise<void> {
    const entry = this.peers.get(peerId);
    if (!entry || !entry.connection.remoteDescription || entry.pendingCandidates.length === 0) return;
    const pending = entry.pendingCandidates.splice(0);
    for (const candidate of pending) await entry.connection.addIceCandidate(candidate);
    this.log('info', `Applied ${pending.length} queued ICE candidate${pending.length === 1 ? '' : 's'}.`, peerId);
  }

  private emitPlaybackBlocked(): void {
    this.callbacks.onPlaybackBlockedChanged?.(
      [...this.peers.entries()].filter(([, entry]) => entry.playbackBlocked).map(([peerId]) => peerId)
    );
  }

  private log(level: VoiceDiagnosticEvent['level'], message: string, peerId?: string): void {
    const event: VoiceDiagnosticEvent = { at: Date.now(), level, message, ...(peerId ? { peerId } : {}) };
    this.diagnostics = [...this.diagnostics.slice(-49), event];
    this.callbacks.onDiagnosticsChanged?.([...this.diagnostics]);
    const method = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    method(`[voice]${peerId ? ` [${peerId}]` : ''} ${message}`);
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
    this.emitPlaybackBlocked();
    // A peer may disappear while the last analyser sample still marked them
    // as speaking. Clear it explicitly so the seat never keeps a stale voice
    // ring after leave/disconnect/ICE failure.
    this.callbacks.onSpeakingChanged(peerId, false);
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function candidateType(candidate: string): string {
  return candidate.match(/\btyp\s+(host|srflx|prflx|relay)\b/i)?.[1]?.toLowerCase() ?? 'unknown';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}
