import React from 'react';
import { render, screen } from '@testing-library/react';
import { Star } from 'lucide-react';
import StatePanel from './StatePanel.jsx';

describe('StatePanel', () => {
  it('loading 渲染加载环，并带 status 语义供读屏播报', () => {
    const { container } = render(<StatePanel variant="loading" title="加载中…" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('加载中…')).toBeInTheDocument();
    expect(container.querySelector('.state-panel')).toHaveClass('is-loading');
    expect(container.querySelector('.state-panel-ring')).toBeInTheDocument();
    // loading 态不应出现图标
    expect(container.querySelector('.state-panel-icon')).toBeNull();
  });

  it('empty 渲染默认图标与标题', () => {
    const { container } = render(<StatePanel variant="empty" title="暂无视频内容" />);
    expect(screen.getByText('暂无视频内容')).toBeInTheDocument();
    expect(container.querySelector('.state-panel')).toHaveClass('is-empty');
    expect(container.querySelector('.state-panel-icon')).toBeInTheDocument();
  });

  it('error 渲染标题、说明与重试按钮', () => {
    render(
      <StatePanel
        variant="error"
        title="视频列表加载失败"
        description="Failed to fetch"
        action={<button type="button">重试</button>}
      />
    );
    expect(screen.getByText('视频列表加载失败')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('compact 模式带 is-compact，且允许覆盖图标', () => {
    const { container } = render(
      <StatePanel variant="empty" icon={Star} title="暂无历史公告" compact />
    );
    expect(container.querySelector('.state-panel')).toHaveClass('is-compact');
    // 覆盖图标后，默认图标不应再渲染
    expect(container.querySelectorAll('.state-panel-icon')).toHaveLength(1);
  });

  it('不传 title / description / action 时不渲染多余节点', () => {
    const { container } = render(<StatePanel variant="empty" />);
    expect(container.querySelector('.state-panel-title')).toBeNull();
    expect(container.querySelector('.state-panel-desc')).toBeNull();
    expect(container.querySelector('.state-panel-action')).toBeNull();
  });
});
