import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppPage from './AppPage.jsx';
import { clearAppPackageManifestCache } from '../data/appPackageManifest.js';

const buildManifestResponse = (manifest) => ({
  ok: true,
  json: async () => manifest
});

const buildProbeResponse = () => ({
  ok: true,
  headers: {
    get: () => 'application/octet-stream'
  }
});

describe('AppPage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAppPackageManifestCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('marks cross-origin packages as unverified instead of ready when probing fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('cors blocked'));

    render(<AppPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: '打开下载链接' })).toHaveLength(3);
    });

    const openLinks = screen.getAllByRole('link', { name: '打开下载链接' });
    expect(openLinks[0]).toHaveAttribute(
      'data-umami-event',
      'app_download_click'
    );
    expect(openLinks[0]).toHaveAttribute(
      'data-umami-event-action',
      'open_link'
    );
    expect(screen.queryByRole('link', { name: '立即下载' })).not.toBeInTheDocument();
    expect(screen.getAllByText('无法自动校验，已提供直链')).toHaveLength(3);
  });

  it('shows the ready state when a package probe succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(buildProbeResponse());

    render(<AppPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: '立即下载' })).toHaveLength(3);
    });

    const downloadLinks = screen.getAllByRole('link', { name: '立即下载' });
    expect(downloadLinks[0]).toHaveAttribute('data-umami-event', 'app_download_click');
    expect(downloadLinks[0]).toHaveAttribute('data-umami-event-platform', 'mac');
    expect(downloadLinks[0]).toHaveAttribute('data-umami-event-filename', '1701701.dmg');
    expect(downloadLinks[0]).toHaveAttribute('data-umami-event-action', 'download');
  });

  it('renders packages published on the remote manifest instead of the bundled defaults', async () => {
    const manifest = {
      schemaVersion: 1,
      baseUrl: 'https://cdn.example.com/apps',
      packages: [
        {
          key: 'linux',
          title: 'Linux 版',
          detail: 'AppImage',
          filename: '1701701.AppImage',
          url: '1701701.AppImage',
          icon: 'linux',
          sortOrder: 10
        }
      ]
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => (
      options?.method === 'HEAD' ? buildProbeResponse() : buildManifestResponse(manifest)
    ));

    render(<AppPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '立即下载' })).toBeInTheDocument();
    });

    const card = screen.getByRole('link', { name: '立即下载' });
    expect(card).toHaveAttribute('href', 'https://cdn.example.com/apps/1701701.AppImage');
    expect(card).toHaveAttribute('download', '1701701.AppImage');
    expect(screen.getByText('Linux 版')).toBeInTheDocument();
    expect(screen.queryByText('macOS 版')).not.toBeInTheDocument();
  });

  it('honours sortOrder, keeps absolute urls and drops disabled entries', async () => {
    const manifest = {
      schemaVersion: 1,
      baseUrl: 'https://cdn.example.com/apps',
      packages: [
        {
          key: 'android',
          title: 'Android APK',
          filename: '1701701-android-twa.apk',
          url: '1701701-android-twa.apk',
          icon: 'android',
          sortOrder: 30
        },
        {
          key: 'win',
          title: 'Windows 版',
          filename: '1701701-win-x64.exe',
          url: 'https://mirror.example.com/1701701-win-x64.exe',
          icon: 'win',
          sortOrder: 20
        },
        {
          key: 'mac',
          title: 'macOS 版',
          filename: '1701701.dmg',
          url: '1701701.dmg',
          icon: 'mac',
          sortOrder: 10,
          enabled: false
        }
      ]
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => (
      options?.method === 'HEAD' ? buildProbeResponse() : buildManifestResponse(manifest)
    ));

    render(<AppPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: '立即下载' })).toHaveLength(2);
    });

    const links = screen.getAllByRole('link', { name: '立即下载' });
    expect(links[0]).toHaveAttribute('href', 'https://mirror.example.com/1701701-win-x64.exe');
    expect(links[1]).toHaveAttribute('href', 'https://cdn.example.com/apps/1701701-android-twa.apk');
    expect(screen.queryByText('macOS 版')).not.toBeInTheDocument();
  });

  it('falls back to the bundled snapshot when the remote manifest is unreachable', async () => {
    const snapshot = {
      schemaVersion: 1,
      baseUrl: 'https://cdn.example.com/apps',
      packages: [
        {
          key: 'win',
          title: 'Windows 版',
          filename: '1701701-win-x64.exe',
          url: '1701701-win-x64.exe',
          icon: 'win',
          sortOrder: 10
        }
      ]
    };

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options?.method === 'HEAD') return buildProbeResponse();
      if (String(url).includes('r2.1701701.xyz')) throw new Error('offline');
      return buildManifestResponse(snapshot);
    });

    render(<AppPage />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '立即下载' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: '立即下载' }))
      .toHaveAttribute('href', 'https://cdn.example.com/apps/1701701-win-x64.exe');
    expect(screen.queryByText('macOS 版')).not.toBeInTheDocument();
  });
});
