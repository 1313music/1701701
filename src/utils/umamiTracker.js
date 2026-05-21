const DEFAULT_SCRIPT_URL = 'https://cloud.umami.is/script.js';
const DEFAULT_DOMAINS = '1701701.xyz';
const DEFAULT_WEBSITE_ID = '51ff5826-49f4-459e-b5b3-2557bc898922';
const TRACKER_MARKER = 'data-app-umami-tracker';

const cleanEnvValue = (value) => String(value || '').trim();

export const getUmamiTrackerConfig = (env = import.meta.env) => {
  const websiteId = cleanEnvValue(env.VITE_UMAMI_WEBSITE_ID) || DEFAULT_WEBSITE_ID;

  if (!websiteId) {
    return null;
  }

  return {
    websiteId,
    scriptUrl: cleanEnvValue(env.VITE_UMAMI_SCRIPT_URL) || DEFAULT_SCRIPT_URL,
    domains: cleanEnvValue(env.VITE_UMAMI_DOMAINS) || DEFAULT_DOMAINS,
    hostUrl: cleanEnvValue(env.VITE_UMAMI_HOST_URL)
  };
};

export const installUmamiTracker = (doc = document, env = import.meta.env) => {
  const config = getUmamiTrackerConfig(env);

  if (!config || !doc?.head) {
    return null;
  }

  const existingTracker = doc.querySelector(`script[${TRACKER_MARKER}]`);
  if (existingTracker) {
    return existingTracker;
  }

  const tracker = doc.createElement('script');
  tracker.defer = true;
  tracker.src = config.scriptUrl;
  tracker.dataset.websiteId = config.websiteId;
  tracker.setAttribute(TRACKER_MARKER, 'true');

  if (config.domains) {
    tracker.dataset.domains = config.domains;
  }

  if (config.hostUrl) {
    tracker.dataset.hostUrl = config.hostUrl;
  }

  doc.head.appendChild(tracker);
  return tracker;
};
