import React, { useEffect, useMemo, useState } from 'react';
import { Monitor, Laptop, Smartphone, Apple, Share2 } from 'lucide-react';

const DOMAIN_DOWNLOAD_BASE_URL = 'https://app.1701701.xyz';

const appPackages = [
  {
    key: 'mac',
    title: 'macOS 版',
    icon: Laptop,
    detail: '无法验证:系统设置-隐私与安全性-安全性-仍要打开',
    filename: '1701701.dmg',
    href: `${DOMAIN_DOWNLOAD_BASE_URL}/1701701.dmg`
  },
  {
    key: 'win',
    title: 'Windows 版',
    icon: Monitor,
    detail: '推荐 Windows 10/11 x64',
    filename: '1701701-win-x64.exe',
    href: `${DOMAIN_DOWNLOAD_BASE_URL}/1701701-win-x64.exe`
  },
  {
    key: 'android',
    title: 'Android APK',
    icon: Smartphone,
    detail: '安装前需允许“未知来源安装”',
    filename: '1701701-android-release.apk',
    href: `${DOMAIN_DOWNLOAD_BASE_URL}/1701701-android-release.apk`
  }
];

const isValidPackageResponse = (response) => {
  if (!response?.ok) return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType) return true;
  return !contentType.includes('text/html');
};

const shouldProbeByHead = (url) => {
  if (typeof window === 'undefined') return false;
  try {
    const resolved = new URL(url, window.location.href);
    return resolved.origin === window.location.origin;
  } catch {
    return false;
  }
};

const iosSteps = [
  '请使用 Safari 打开本站。',
  '点击底部“共享”按钮。',
  '选择“添加到主屏幕”。',
  '点击右上角“添加”完成安装。'
];

const AppPage = ({ onCopyPageLink }) => {
  const [statusMap, setStatusMap] = useState({});

  useEffect(() => {
    let canceled = false;

    const probeDownloads = async () => {
      const pairs = await Promise.all(
        appPackages.map(async (pkg) => {
          if (!shouldProbeByHead(pkg.href)) {
            return [pkg.key, true];
          }
          try {
            const response = await fetch(pkg.href, { method: 'HEAD', cache: 'no-store' });
            return [pkg.key, isValidPackageResponse(response)];
          } catch {
            return [pkg.key, false];
          }
        })
      );

      if (canceled) return;
      setStatusMap(Object.fromEntries(pairs));
    };

    void probeDownloads();
    return () => {
      canceled = true;
    };
  }, []);

  const allChecked = useMemo(
    () => Object.keys(statusMap).length === appPackages.length,
    [statusMap]
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
              <Share2 size={16} strokeWidth={2.2} absoluteStrokeWidth />
              分享本页
            </button>
          )}
        </div>
        <p>
          可按需下载对应平台客户端，iOS 可通过添加主屏方式使用。
        </p>
      </section>

      <section className="app-download-grid" aria-label="客户端下载">
        {appPackages.map((pkg) => {
          const Icon = pkg.icon;
          const isReady = statusMap[pkg.key] === true;
          return (
            <article className="app-download-card" key={pkg.key}>
              <div className="app-download-card-head">
                <Icon size={20} strokeWidth={2.2} absoluteStrokeWidth />
                <h2>{pkg.title}</h2>
              </div>
              <p className="app-download-card-detail">{pkg.detail}</p>
              <div className="app-download-card-file">{pkg.filename}</div>
              {isReady ? (
                <a
                  className="app-download-btn"
                  href={pkg.href}
                  target="_blank"
                  rel="noreferrer"
                  download
                >
                  立即下载
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
          iOS 暂无APP，请按以下步骤将网页添加到主屏幕后使用。
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
