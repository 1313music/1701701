const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSY_ENV_VALUES = new Set(['0', 'false', 'no', 'off']);

const readEnvValue = (key) => (
  import.meta.env?.[key]
  ?? globalThis.process?.env?.[key]
  ?? ''
);

const normalizeEnvValue = (value) => String(value || '').trim().toLowerCase();

export const isTruthyEnvValue = (value) => (
  TRUTHY_ENV_VALUES.has(normalizeEnvValue(value))
);

export const readBooleanEnvSwitch = (key, defaultValue = false) => {
  const value = normalizeEnvValue(readEnvValue(key));
  if (!value) return defaultValue;
  if (TRUTHY_ENV_VALUES.has(value)) return true;
  if (FALSY_ENV_VALUES.has(value)) return false;
  return defaultValue;
};

export const SHOW_DOWNLOAD_PAGE = readBooleanEnvSwitch('VITE_SHOW_DOWNLOAD_PAGE', false);
export const SHOW_RESOURCES_PAGE = readBooleanEnvSwitch('VITE_SHOW_RESOURCES_PAGE', true);
export const SHOW_MINI_PROGRAM_QR = readBooleanEnvSwitch('VITE_SHOW_MINI_PROGRAM_QR', true);
