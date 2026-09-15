import {
  fetchJsonWithBundledFallback,
  toAbsoluteUrl
} from './manifestSourceUtils.js';

export const DEFAULT_APP_PACKAGE_BASE_URL = 'https://r2.1701701.xyz/app';

const DEFAULT_APP_PACKAGE_INDEX_URL = String(
  import.meta.env.VITE_APP_PACKAGE_INDEX_URL
    || 'https://r2.1701701.xyz/json/app-packages.json'
).trim();

const BUNDLED_SNAPSHOT_PATH = '/app-packages.json';

export const APP_PACKAGE_MANIFEST_SOURCE = Object.freeze({
  primaryUrl: DEFAULT_APP_PACKAGE_INDEX_URL,
  fallbackPath: BUNDLED_SNAPSHOT_PATH,
  baseUrl: DEFAULT_APP_PACKAGE_BASE_URL
});

export const DEFAULT_APP_PACKAGES = Object.freeze([
  Object.freeze({
    key: 'mac',
    title: 'macOS 版',
    detail: '无法验证:系统设置-隐私与安全性-安全性-仍要打开',
    filename: '1701701.dmg',
    url: '1701701.dmg',
    icon: 'mac',
    sortOrder: 10
  }),
  Object.freeze({
    key: 'win',
    title: 'Windows 版',
    detail: '推荐 Windows 10/11 x64',
    filename: '1701701-win-x64.exe',
    url: '1701701-win-x64.exe',
    icon: 'win',
    sortOrder: 20
  }),
  Object.freeze({
    key: 'android',
    title: 'Android APK',
    detail: '安装前需允许“未知来源安装”',
    filename: '1701701-android-twa.apk',
    url: '1701701-android-twa.apk',
    icon: 'android',
    sortOrder: 30
  })
]);

const asTrimmedString = (value) => String(value ?? '').trim();

const isEnabled = (value) => value !== false && value !== 'false' && value !== 0;

const normalizeBaseUrl = (baseUrl) => {
  const input = asTrimmedString(baseUrl);
  if (!input) return '';
  return input.endsWith('/') ? input : `${input}/`;
};

export const resolvePackageHref = (url, baseUrl = DEFAULT_APP_PACKAGE_BASE_URL) => {
  const input = asTrimmedString(url);
  if (!input) return '';
  const absolute = toAbsoluteUrl(input, normalizeBaseUrl(baseUrl));
  return absolute || input;
};

export const normalizeAppPackages = (payload) => {
  const baseUrl = asTrimmedString(payload?.baseUrl) || DEFAULT_APP_PACKAGE_BASE_URL;
  const rawList = Array.isArray(payload?.packages) ? payload.packages : [];
  const seenKeys = new Set();

  const normalized = rawList
    .map((item, index) => {
      const key = asTrimmedString(item?.key);
      const filename = asTrimmedString(item?.filename);
      const href = resolvePackageHref(item?.url || filename, baseUrl);
      const sortOrder = Number(item?.sortOrder);

      if (!key || !href || seenKeys.has(key)) return null;
      if (!isEnabled(item?.enabled)) return null;
      seenKeys.add(key);

      return {
        key,
        title: asTrimmedString(item?.title) || filename || key,
        detail: asTrimmedString(item?.detail),
        filename: filename || href.split('/').pop() || key,
        href,
        icon: asTrimmedString(item?.icon) || key,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : index * 10
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return normalized.length ? normalized : [];
};

let cachedAppPackages = null;
let inflightAppPackagesPromise = null;

const fetchAppPackages = async () => {
  try {
    const { payload, usedFallback } = await fetchJsonWithBundledFallback({
      primaryUrl: APP_PACKAGE_MANIFEST_SOURCE.primaryUrl,
      fallbackPath: APP_PACKAGE_MANIFEST_SOURCE.fallbackPath,
      requestLabel: '客户端清单加载失败'
    });

    const packages = normalizeAppPackages(payload);
    if (packages.length) {
      return { packages, usedFallback, cacheable: true };
    }
    throw new Error('客户端清单为空');
  } catch {
    return {
      packages: normalizeAppPackages({
        baseUrl: DEFAULT_APP_PACKAGE_BASE_URL,
        packages: DEFAULT_APP_PACKAGES
      }),
      usedFallback: true,
      cacheable: false
    };
  }
};

export const loadAppPackages = async () => {
  if (cachedAppPackages) {
    return { packages: cachedAppPackages, usedFallback: false };
  }
  if (inflightAppPackagesPromise) {
    return await inflightAppPackagesPromise;
  }

  inflightAppPackagesPromise = fetchAppPackages();
  try {
    const result = await inflightAppPackagesPromise;
    if (result.cacheable) {
      cachedAppPackages = result.packages;
    }
    return result;
  } finally {
    inflightAppPackagesPromise = null;
  }
};

export const clearAppPackageManifestCache = () => {
  cachedAppPackages = null;
  inflightAppPackagesPromise = null;
};
