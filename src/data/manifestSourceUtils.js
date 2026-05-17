export const toAbsoluteUrl = (value, fallbackBase = '') => {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    return new URL(input).toString();
  } catch {
    if (!fallbackBase) return '';
    try {
      return new URL(input, fallbackBase).toString();
    } catch {
      return '';
    }
  }
};

const fetchJson = async (url, requestLabel) => {
  const response = await fetch(url, { cache: 'default' });
  if (!response.ok) {
    throw new Error(`${requestLabel}（HTTP ${response.status}）`);
  }
  return await response.json();
};

export const fetchJsonWithBundledFallback = async ({
  primaryUrl,
  fallbackPath = '',
  requestLabel
}) => {
  try {
    return {
      payload: await fetchJson(primaryUrl, requestLabel),
      resolvedUrl: primaryUrl,
      usedFallback: false
    };
  } catch (primaryError) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fallbackUrl = toAbsoluteUrl(fallbackPath, origin) || fallbackPath;
    if (!fallbackUrl || fallbackUrl === primaryUrl) {
      throw primaryError;
    }

    try {
      return {
        payload: await fetchJson(fallbackUrl, requestLabel),
        resolvedUrl: fallbackUrl,
        usedFallback: true
      };
    } catch {
      throw primaryError;
    }
  }
};
