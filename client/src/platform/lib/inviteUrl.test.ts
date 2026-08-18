import { describe, expect, it } from 'vitest';
import { buildInviteUrl } from './inviteUrl';

describe('shareable Card Room invite URL', () => {
  it('uses the current public web origin when no explicit app URL is configured', () => {
    expect(buildInviteUrl('hzr482', 'https://cardroom.example/play?old=1#x', ''))
      .toBe('https://cardroom.example/play?join=HZR482');
  });

  it('uses the configured public app URL for a native localhost WebView', () => {
    expect(buildInviteUrl('KIT321', 'https://localhost/', 'https://cardroom-staging.netlify.app'))
      .toBe('https://cardroom-staging.netlify.app/?join=KIT321');
  });

  it('never shares Capacitor or local-development localhost as a public invite', () => {
    expect(buildInviteUrl('HZR482', 'https://localhost/', '')).toBeNull();
    expect(buildInviteUrl('HZR482', 'http://127.0.0.1:5173/', '')).toBeNull();
  });
});
