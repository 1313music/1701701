import { afterEach, describe, expect, it } from 'vitest';
import { getUmamiTrackerConfig, installUmamiTracker } from './umamiTracker.js';

describe('umamiTracker', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('uses the production Umami Cloud website id by default', () => {
    const tracker = installUmamiTracker(document, {});

    expect(getUmamiTrackerConfig({}).websiteId).toBe('51ff5826-49f4-459e-b5b3-2557bc898922');
    expect(tracker.dataset.websiteId).toBe('51ff5826-49f4-459e-b5b3-2557bc898922');
  });

  it('installs the Umami Cloud tracker with default options', () => {
    const tracker = installUmamiTracker(document, {
      VITE_UMAMI_WEBSITE_ID: 'site-id'
    });

    expect(tracker).not.toBeNull();
    expect(tracker.src).toBe('https://cloud.umami.is/script.js');
    expect(tracker.dataset.websiteId).toBe('site-id');
    expect(tracker.dataset.domains).toBe('1701701.xyz');
    expect(tracker.dataset.hostUrl).toBeUndefined();
  });

  it('uses optional tracker overrides', () => {
    const tracker = installUmamiTracker(document, {
      VITE_UMAMI_WEBSITE_ID: 'site-id',
      VITE_UMAMI_SCRIPT_URL: 'https://analytics.example.com/script.js',
      VITE_UMAMI_DOMAINS: 'example.com,www.example.com',
      VITE_UMAMI_HOST_URL: 'https://analytics.example.com'
    });

    expect(tracker.src).toBe('https://analytics.example.com/script.js');
    expect(tracker.dataset.domains).toBe('example.com,www.example.com');
    expect(tracker.dataset.hostUrl).toBe('https://analytics.example.com');
  });

  it('does not install duplicate trackers', () => {
    const env = { VITE_UMAMI_WEBSITE_ID: 'site-id' };

    const firstTracker = installUmamiTracker(document, env);
    const secondTracker = installUmamiTracker(document, env);

    expect(secondTracker).toBe(firstTracker);
    expect(document.querySelectorAll('script[data-app-umami-tracker]').length).toBe(1);
  });
});
