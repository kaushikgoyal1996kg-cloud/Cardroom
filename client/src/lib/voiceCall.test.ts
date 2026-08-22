import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceCallManager } from './voiceCall';

class FakeSocket {
  connected = true;
  handlers = new Map<string, (...args: any[]) => void>();
  emitted: Array<{ event: string; args: any[] }> = [];

  on(event: string, handler: (...args: any[]) => void) { this.handlers.set(event, handler); return this; }
  off(event: string) { this.handlers.delete(event); return this; }
  emit(event: string, ...args: any[]) {
    this.emitted.push({ event, args });
    if (event === 'voice:getIceServers') {
      args[0]({ ok: true, relayAvailable: true, iceServers: [{ urls: 'turn:test.example' }] });
    }
    return this;
  }
  receive(event: string, payload: any) { return this.handlers.get(event)?.(payload); }
}

class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  connectionState: RTCPeerConnectionState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  iceGatheringState: RTCIceGatheringState = 'new';
  onicecandidate: RTCPeerConnection['onicecandidate'] = null;
  onicecandidateerror: RTCPeerConnection['onicecandidateerror'] = null;
  onicegatheringstatechange: RTCPeerConnection['onicegatheringstatechange'] = null;
  oniceconnectionstatechange: RTCPeerConnection['oniceconnectionstatechange'] = null;
  ontrack: RTCPeerConnection['ontrack'] = null;
  onconnectionstatechange: RTCPeerConnection['onconnectionstatechange'] = null;
  addIceCandidate = vi.fn(async () => undefined);
  addTrack = vi.fn();
  close = vi.fn();
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' } as RTCSessionDescriptionInit));
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' } as RTCSessionDescriptionInit));
  setLocalDescription = vi.fn(async (value: RTCSessionDescriptionInit) => { this.localDescription = value; });
  setRemoteDescription = vi.fn(async (value: RTCSessionDescriptionInit) => { this.remoteDescription = value; });

  constructor(public config: RTCConfiguration) { FakePeerConnection.instances.push(this); }
}

const audioInstances: Array<{ play: ReturnType<typeof vi.fn>; srcObject: MediaProvider | null }> = [];

describe('VoiceCallManager', () => {
  beforeEach(() => {
    FakePeerConnection.instances = [];
    audioInstances.length = 0;
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    vi.stubGlobal('Audio', class {
      autoplay = false;
      playsInline = false;
      srcObject: MediaProvider | null = null;
      setAttribute = vi.fn();
      play = vi.fn(async () => undefined);
      constructor() { audioInstances.push(this); }
    });
    vi.stubGlobal('AudioContext', class {});
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => fakeStream()) },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses server-provided TURN configuration and attaches the local mic track', async () => {
    const socket = new FakeSocket();
    const manager = managerFor(socket);
    await manager.join();
    await socket.receive('voice:peerJoined', { playerId: 'p2' });

    expect(FakePeerConnection.instances[0].config.iceServers).toEqual([{ urls: 'turn:test.example' }]);
    expect(FakePeerConnection.instances[0].addTrack).toHaveBeenCalledTimes(1);
    expect(socket.emitted.some((entry) => entry.event === 'voice:signal' && entry.args[0].data.type === 'offer')).toBe(true);
  });

  it('joins spectator listen-only voice without requesting a microphone', async () => {
    const socket = new FakeSocket();
    const manager = managerFor(socket);
    await manager.join('LISTEN_ONLY');

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(socket.emitted).toContainEqual({ event: 'voice:join', args: [{ mode: 'LISTEN_ONLY' }] });
  });

  it('queues early ICE candidates and applies them after the remote offer', async () => {
    const socket = new FakeSocket();
    const manager = managerFor(socket);
    await manager.join();

    await socket.receive('voice:signal', { fromPlayerId: 'p2', data: { type: 'ice-candidate', candidate: { candidate: 'candidate:1 typ relay' } } });
    const peer = FakePeerConnection.instances[0];
    expect(peer.addIceCandidate).not.toHaveBeenCalled();

    await socket.receive('voice:signal', { fromPlayerId: 'p2', data: { type: 'offer', sdp: 'remote-offer' } });
    expect(peer.addIceCandidate).toHaveBeenCalledWith({ candidate: 'candidate:1 typ relay' });
  });

  it('surfaces autoplay blocking and retries after a user gesture', async () => {
    const socket = new FakeSocket();
    const blocked: string[][] = [];
    const manager = managerFor(socket, { onPlaybackBlockedChanged: (ids: string[]) => blocked.push(ids) });
    await manager.join();
    await socket.receive('voice:peerJoined', { playerId: 'p2' });
    audioInstances[0].play.mockRejectedValueOnce(new DOMException('gesture required', 'NotAllowedError'));
    (FakePeerConnection.instances[0].ontrack as any)?.({ streams: [fakeStream()] });
    await vi.waitFor(() => expect(blocked.at(-1)).toEqual(['p2']));

    await manager.retryBlockedAudio();
    expect(audioInstances[0].play).toHaveBeenCalledTimes(2);
    expect(blocked.at(-1)).toEqual([]);
  });

  it('mutes the local audio track and notifies the room', async () => {
    const socket = new FakeSocket();
    const stream = fakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(stream);
    const manager = managerFor(socket);
    await manager.join();
    manager.setMuted(true);

    expect(stream.getAudioTracks()[0].enabled).toBe(false);
    expect(socket.emitted).toContainEqual({ event: 'voice:mute', args: [{ muted: true }] });
  });

  it('cleans up tracks, peer connections and listeners on leave', async () => {
    const socket = new FakeSocket();
    const stream = fakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(stream);
    const manager = managerFor(socket);
    await manager.join();
    await socket.receive('voice:peerJoined', { playerId: 'p2' });
    manager.leave();

    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
    expect(FakePeerConnection.instances[0].close).toHaveBeenCalled();
    expect(socket.handlers.size).toBe(0);
  });

  it('immediately tears down spectator audio when the host revokes voice access', async () => {
    const socket = new FakeSocket();
    const stream = fakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValueOnce(stream);
    const ended = vi.fn();
    const error = vi.fn();
    const manager = managerFor(socket, { onSessionEnded: ended, onError: error });
    await manager.join();

    socket.receive('voice:accessRevoked', { reason: 'The host disabled spectator voice.' });
    expect(manager.isJoined).toBe(false);
    expect(stream.getTracks()[0].stop).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('The host disabled spectator voice.');
    expect(ended).toHaveBeenCalledOnce();
  });
});

function managerFor(socket: FakeSocket, overrides: Record<string, unknown> = {}) {
  return new VoiceCallManager(socket as any, 'p1', {
    onParticipantsChanged: vi.fn(),
    onSpeakingChanged: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  });
}

function fakeStream(): MediaStream {
  const track = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}
