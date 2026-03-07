import React from 'react';

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
        <p className="video-access-tip">
          <span className="video-access-tip-label">先关注公众号【{officialAccountName}】</span>
          <span className="video-access-tip-highlight">发送“{keyword}”获取访问密码</span>
        </p>
        <div className="video-access-qr">
          <img loading="lazy" src={qrUrl} alt="公众号二维码" />
        </div>
        <div className="video-access-helper-actions">
          <button
            type="button"
            className="video-access-btn ghost"
            onClick={onCopyOfficialAccountName}
          >
            一键复制公众号名
          </button>
        </div>
        <input
          className="video-access-input"
          type="password"
          placeholder="请输入访问密码"
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
