import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadVideoAccessConfig } from '../data/videoAccessConfig.js';
import { useVideoAccess } from './useVideoAccess.js';

vi.mock('../data/videoAccessConfig.js', () => ({
  DEFAULT_VIDEO_ACCESS_CONFIG: {
    password: 'fallback-password',
    passwordVersion: 'build-time',
    updatedAt: ''
  },
  loadVideoAccessConfig: vi.fn()
}));

const Harness = ({ onGranted }) => {
  const {
    isVideoAccessOpen,
    videoPassword,
    setVideoPassword,
    videoPasswordError,
    setVideoPasswordError,
    requestVideoView,
    submitVideoAccess
  } = useVideoAccess();

  return (
    <div>
      <button type="button" onClick={() => requestVideoView(onGranted)}>request video</button>
      <span data-testid="modal-state">{isVideoAccessOpen ? 'open' : 'closed'}</span>
      {isVideoAccessOpen && (
        <input
          aria-label="video password"
          value={videoPassword}
          onChange={(event) => {
            setVideoPassword(event.target.value);
            setVideoPasswordError('');
          }}
        />
      )}
      <button type="button" onClick={() => submitVideoAccess()}>submit password</button>
      <span data-testid="password-error">{videoPasswordError}</span>
    </div>
  );
};

describe('useVideoAccess', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('stores the current password version after a successful unlock', async () => {
    loadVideoAccessConfig.mockResolvedValue({
      password: 'SongSharing',
      passwordVersion: 'v1',
      updatedAt: '2026-05-18T00:00:00.000Z'
    });
    const onGranted = vi.fn();

    render(<Harness onGranted={onGranted} />);

    fireEvent.click(screen.getByRole('button', { name: 'request video' }));
    await waitFor(() => {
      expect(screen.getByTestId('modal-state')).toHaveTextContent('open');
    });
    fireEvent.change(screen.getByLabelText('video password'), {
      target: { value: 'SongSharing' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'submit password' }));

    await waitFor(() => {
      expect(onGranted).toHaveBeenCalledTimes(1);
    });
    const stored = JSON.parse(window.localStorage.getItem('videoAccessGranted'));
    expect(stored).toMatchObject({
      granted: true,
      passwordVersion: 'v1'
    });
    expect(stored.expiresAt).toBeGreaterThan(Date.now());
  });

  it('invalidates a stored grant when the remote password version changes', async () => {
    window.localStorage.setItem('videoAccessGranted', JSON.stringify({
      granted: true,
      expiresAt: Date.now() + 60_000,
      passwordVersion: 'v1'
    }));
    loadVideoAccessConfig.mockResolvedValue({
      password: 'SongSharing2026',
      passwordVersion: 'v2',
      updatedAt: '2026-05-18T01:00:00.000Z'
    });
    const onGranted = vi.fn();

    render(<Harness onGranted={onGranted} />);

    fireEvent.click(screen.getByRole('button', { name: 'request video' }));

    await waitFor(() => {
      expect(screen.getByTestId('modal-state')).toHaveTextContent('open');
    });
    expect(onGranted).not.toHaveBeenCalled();
  });

  it('keeps a stored grant when the password version still matches', async () => {
    window.localStorage.setItem('videoAccessGranted', JSON.stringify({
      granted: true,
      expiresAt: Date.now() + 60_000,
      passwordVersion: 'v2'
    }));
    loadVideoAccessConfig.mockResolvedValue({
      password: 'SongSharing2026',
      passwordVersion: 'v2',
      updatedAt: '2026-05-18T01:00:00.000Z'
    });
    const onGranted = vi.fn();

    render(<Harness onGranted={onGranted} />);

    fireEvent.click(screen.getByRole('button', { name: 'request video' }));

    await waitFor(() => {
      expect(onGranted).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
  });
});
