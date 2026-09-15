import React, { useEffect, useMemo, useState } from 'react';
import { Monitor, Laptop, Smartphone, Apple, Share2 } from 'lucide-react';
import {
  DEFAULT_APP_PACKAGE_BASE_URL,
  DEFAULT_APP_PACKAGES,
  loadAppPackages,
  normalizeAppPackages
} from '../data/appPackageManifest.js';
import '../styles/app-download.css';

const PACKAGE_STATUS = Object.freeze({
  CHECKING: 'checking',
  READY: 'ready',
  MISSING: 'missing',
  UNVERIFIED: 'unverified'
});

const PACKAGE_ICON_MAP = Object.freeze({
  mac: Laptop,
  macos: Laptop,
  osx: Laptop,
  dmg: Laptop,
  win: Monitor,
  windows: Monitor,
  win32: Monitor,
  exe: Monitor,
  android: Smartphone,
  apk: Smartphone,
  ios: Apple,
  ipa: Apple
});

const resolvePackageIcon = (icon) => {
  const key = String(icon || '').trim().toLowerCase();
  return PACKAGE_ICON_MAP[key] || Smartphone;
};

const buildFallbackPackages = () => normalizeAppPackages({
  baseUrl: DEFAULT_APP_PACKAGE_BASE_URL,
  packages: DEFAULT_APP_PACKAGES
});

const getPackageAnalyticsAttributes = (pkg, action) => ({
  'data-umami-event': 'app_download_click',
  'data-umami-event-platform': pkg.key,
  'data-umami-event-title': pkg.title,
  'data-umami-event-filename': pkg.filename,
  'data-umami-event-action': action
});

const isValidPackageResponse = (response) => {
  if (!response?.ok) return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType) return true;
  return !contentType.includes('text/html');
};

const isSameOriginUrl = (url) => {
  if (typeof window === 'undefined') return false;
  try {
    const resolved = new URL(url, window.location.href);
    return resolved.origin === window.location.origin;
  } catch {
    return false;
  }
};

const probePackageStatus = async (url) => {
  const isSameOrigin = isSameOriginUrl(url);
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return isValidPackageResponse(response)
      ? PACKAGE_STATUS.READY
      : PACKAGE_STATUS.MISSING;
  } catch {
    return isSameOrigin
      ? PACKAGE_STATUS.MISSING
      : PACKAGE_STATUS.UNVERIFIED;
  }
};

const iosSteps = [
  '请先用 Safari 打开本站。',
  '点击底部“共享”按钮。',
  '选择“添加到主屏幕”。',
  '点击右上角“添加”即可放到主屏幕。'
];

const AppPage = ({ onCopyPageLink }) => {
  const [packages, setPackages] = useState(buildFallbackPackages);
  const [statusMap, setStatusMap] = useState({});

  useEffect(() => {
    let canceled = false;

    const syncManifest = async () => {
      const { packages: loaded } = await loadAppPackages();
      if (canceled || !loaded.length) return;
      setPackages(loaded);
    };

    void syncManifest();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    const probeDownloads = async () => {
      const pairs = await Promise.all(
        packages.map(async (pkg) => {
          const status = await probePackageStatus(pkg.href);
          return [pkg.key, status];
        })
      );

      if (canceled) return;
      setStatusMap(Object.fromEntries(pairs));
    };

    void probeDownloads();
    return () => {
      canceled = true;
    };
  }, [packages]);

  const allChecked = useMemo(
    () => packages.length > 0 && Object.keys(statusMap).length === packages.length,
    [packages.length, statusMap]
  );

  return (
    <div className="app-download-page">
      <section className="app-download-hero">
        <div className="app-download-hero-header">
          <h1>客户端下载</h1>
          {typeof onCopyPageLink === 'function' && (
            <button
              type="button"
              className="app-download-hero-share"
              onClick={(event) => onCopyPageLink({
                placement: 'bottom',
                anchorEvent: { currentTarget: event.currentTarget }
              })}
              aria-label="分享 APP 页"
            >
              <Share2 size={18} strokeWidth={2.2} absoluteStrokeWidth />
            </button>
          )}
        </div>
        <p>
          可按需下载对应平台客户端，iOS 可通过添加主屏方式使用。
        </p>
      </section>

      <section className="app-download-grid" aria-label="客户端下载">
        {packages.map((pkg) => {
          const Icon = resolvePackageIcon(pkg.icon);
          const status = statusMap[pkg.key] || PACKAGE_STATUS.CHECKING;
          const isReady = status === PACKAGE_STATUS.READY;
          const isUnverified = status === PACKAGE_STATUS.UNVERIFIED;
          return (
            <article className="app-download-card" key={pkg.key}>
              <div className="app-download-card-head">
                <Icon size={20} strokeWidth={2.2} absoluteStrokeWidth />
                <h2>{pkg.title}</h2>
              </div>
              <p className="app-download-card-detail">{pkg.detail}</p>
              <div className="app-download-card-file">{pkg.filename}</div>
              {isUnverified && (
                <p className="app-download-card-status">
                  无法自动校验，已提供直链
                </p>
              )}
              {isReady ? (
                <a
                  className="app-download-btn"
                  href={pkg.href}
                  download={pkg.filename}
                  {...getPackageAnalyticsAttributes(pkg, 'download')}
                >
                  立即下载
                </a>
              ) : isUnverified ? (
                <a
                  className="app-download-btn secondary"
                  href={pkg.href}
                  target="_blank"
                  rel="noreferrer"
                  {...getPackageAnalyticsAttributes(pkg, 'open_link')}
                >
                  打开下载链接
                </a>
              ) : (
                <button type="button" className="app-download-btn disabled" disabled>
                  {allChecked ? '待上传' : '检测中...'}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="app-ios-guide" aria-label="iOS 安装引导">
        <div className="app-ios-guide-head">
          <Apple size={20} strokeWidth={2.2} absoluteStrokeWidth />
          <h2>iOS 使用方式（PWA）</h2>
        </div>
        <p className="app-ios-guide-note">
          iOS 目前提供主屏网页版，按下面几步添加后，打开会更像一个独立应用。
        </p>
        <ol>
          {iosSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
};

export default AppPage;
