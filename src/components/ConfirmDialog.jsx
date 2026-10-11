import React, { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/confirm-dialog.css';

/**
 * 全站统一的「确认」弹窗，用来替代浏览器原生的 window.confirm。
 *
 * 为什么要有它：原来「清空收藏 / 清空记录 / 删公告 / 删弹幕」弹的是浏览器原生灰框，
 * 样式不可控、手机上还会显示网址，跟站内其他弹窗完全是两个世界。
 *
 * 用法（受控）：
 *   const [pending, setPending] = useState(null);
 *   ...
 *   <ConfirmDialog
 *     open={Boolean(pending)}
 *     title="确定要清空收藏吗？"
 *     danger
 *     onConfirm={...}
 *     onCancel={() => setPending(null)}
 *   />
 *
 * 细节：
 * - 打开时**默认聚焦「取消」**，避免顺手回车误删；
 * - 支持 ESC 关闭、点遮罩关闭；
 * - 关闭后焦点回到打开它的那个元素；
 * - danger 时确认键用站内已有的红（--favorite-active-color）—— 删除不可逆，
 *   给一点视觉警示是有实际价值的，和「错误态不用红」不冲突：
 *   一个是用户被动撞上错误，一个是用户主动做危险操作。
 */
const ConfirmDialog = ({
  open,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel
}) => {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(null);
  const lastActiveRef = useRef(null);

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    onConfirm?.();
  }, [onConfirm]);

  useEffect(() => {
    if (!open) return undefined;

    lastActiveRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    // 默认把焦点放在「取消」上，回车不会误触危险操作
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const previous = lastActiveRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open, handleCancel]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="confirm-dialog-backdrop" onClick={handleCancel}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="confirm-dialog-title" id={titleId}>{title}</p>
        {description ? (
          <p className="confirm-dialog-desc" id={descId}>{description}</p>
        ) : null}
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-dialog-btn"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn is-primary ${danger ? 'is-danger' : ''}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
