import { afterEach, describe, expect, it, vi } from 'vitest';

describe('miniProgramAlbums', () => {
  afterEach(() => {
    delete globalThis.process?.env?.VITE_SHOW_MINI_PROGRAM_QR;
    vi.resetModules();
  });

  it('shows album mini-program codes by default', async () => {
    vi.resetModules();
    delete globalThis.process?.env?.VITE_SHOW_MINI_PROGRAM_QR;
    const { getAlbumMiniProgram } = await import('./miniProgramAlbums.js');

    expect(getAlbumMiniProgram('forbidden-games')).toMatchObject({
      codeUrl: '/img/mini-program/forbidden-games.webp'
    });
  });

  it('hides album mini-program codes when the switch is off', async () => {
    vi.resetModules();
    globalThis.process.env.VITE_SHOW_MINI_PROGRAM_QR = 'false';
    const { getAlbumMiniProgram, hasAlbumMiniProgram } = await import('./miniProgramAlbums.js');

    expect(getAlbumMiniProgram('forbidden-games')).toBeNull();
    expect(hasAlbumMiniProgram('forbidden-games')).toBe(false);
  });
});
