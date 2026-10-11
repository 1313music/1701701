import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.jsx';

describe('ConfirmDialog', () => {
  it('open=false 时不渲染任何内容', () => {
    render(
      <ConfirmDialog open={false} title="不会出现" onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('不会出现')).not.toBeInTheDocument();
  });

  it('渲染标题、说明与两个按钮，并默认把焦点放在「取消」上', async () => {
    render(
      <ConfirmDialog
        open
        title="确定要清空收藏吗？"
        description="清空后收藏的歌曲需要重新添加。"
        confirmText="清空"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('确定要清空收藏吗？')).toBeInTheDocument();
    expect(screen.getByText('清空后收藏的歌曲需要重新添加。')).toBeInTheDocument();
    // 默认聚焦取消，避免顺手回车误删
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '取消' })).toHaveFocus();
    });
  });

  it('点「确认」「取消」分别触发对应回调', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="标题" confirmText="删除" onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole('button', { name: '删除' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('按 ESC 等同于点取消', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="标题" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('点遮罩关闭，点卡片内部不关闭', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmDialog open title="标题" onConfirm={() => {}} onCancel={onCancel} />
    );
    fireEvent.click(container.ownerDocument.querySelector('.confirm-dialog'));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(container.ownerDocument.querySelector('.confirm-dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('danger 时确认键带 is-danger，非 danger 时不带', () => {
    const { unmount } = render(
      <ConfirmDialog open title="标题" danger confirmText="删除" onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByRole('button', { name: '删除' })).toHaveClass('is-danger');
    unmount();

    render(
      <ConfirmDialog open title="标题" confirmText="确定" onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(screen.getByRole('button', { name: '确定' })).not.toHaveClass('is-danger');
  });
});
