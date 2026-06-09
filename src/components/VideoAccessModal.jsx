import React from 'react';
import '../styles/video-access.css';

const DEFAULT_PROMPT_LINES = [
  '扫码观看广告后获取视频密码'
];

const getPromptLines = (promptLines) => {
  const lines = Array.isArray(promptLines)
    ? promptLines
    : String(promptLines || '').split(/\r?\n/);
  const normalizedLines = lines
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  return normalizedLines.length > 0 ? normalizedLines : DEFAULT_PROMPT_LINES;
};

const VideoAccessModal = ({
  isOpen,
  onClose,
  promptLines,
  qrUrl,
  qrAlt = '视频验证二维码',
  passwordNote = '如密码失效，请刷新网页或清除缓存并重新扫码获取最新密码',
  videoPassword,
  onPasswordChange,
  videoPasswordError,
  onSubmit,
  onQrClick,
  onCopyOfficialAccountName
}) => {
  if (!isOpen) return null;

  const lines = getPromptLines(promptLines);
  const handleQrClick = onQrClick || onCopyOfficialAccountName;
  const qrClassName = `video-access-qr ${handleQrClick ? 'is-clickable' : ''}`.trim();
  const qrImage = <img loading="lazy" src={qrUrl} alt={qrAlt} />;

  return (
    <div className="video-access-modal" onClick={onClose}>
      <div className="video-access-card" onClick={(event) => event.stopPropagation()}>
        <div className="video-access-copy-hint">
          {lines.map((line) => (
            <p className="video-access-copy-line" key={line}>{line}</p>
          ))}
        </div>
        {handleQrClick ? (
          <button
            type="button"
            className={qrClassName}
            onClick={handleQrClick}
            aria-label="复制视频验证信息"
            title="复制视频验证信息"
          >
            {qrImage}
          </button>
        ) : (
          <div className={qrClassName}>
            {qrImage}
          </div>
        )}
        <p className="video-access-password-note">{passwordNote}</p>
        <input
          className="video-access-input"
          type="password"
          placeholder="请输入视频密码"
          value={videoPassword}
          onChange={(event) => onPasswordChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit();
          }}
        />
        {videoPasswordError && <div className="video-access-error">{videoPasswordError}</div>}
        <div className="video-access-actions">
          <button
            type="button"
            className="video-access-btn ghost"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="video-access-btn"
            onClick={onSubmit}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoAccessModal;
