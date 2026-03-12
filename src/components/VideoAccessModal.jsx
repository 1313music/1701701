import React from 'react';
import '../styles/video-access.css';

const VideoAccessModal = ({
  isOpen,
  onClose,
  officialAccountName,
  keyword,
  qrUrl,
  videoPassword,
  onPasswordChange,
  videoPasswordError,
  onSubmit,
  onCopyOfficialAccountName
}) => {
  if (!isOpen) return null;

  return (
    <div className="video-access-modal" onClick={onClose}>
      <div className="video-access-card" onClick={(event) => event.stopPropagation()}>
        <div className="video-access-copy-hint">
          <p className="video-access-copy-line">关注【{officialAccountName}】公众号</p>
          <p className="video-access-copy-line">发送【{keyword}】获取视频密码</p>
        </div>
        <button
          type="button"
          className="video-access-qr"
          onClick={onCopyOfficialAccountName}
          aria-label={`复制公众号名 ${officialAccountName}`}
          title={`复制公众号名 ${officialAccountName}`}
        >
          <img loading="lazy" src={qrUrl} alt="公众号二维码" />
        </button>
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
