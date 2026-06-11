import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  Search,
  Trash2
} from 'lucide-react';

import {
  deleteDanmakuItem,
  loadDanmakuItems
} from '../data/danmakuAdminApi.js';

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'visible', label: '已显示' }
];

const STATUS_LABELS = {
  pending: '未显示',
  visible: '已显示',
  hidden: '已隐藏'
};

const formatVideoTime = (value) => {
  const seconds = Math.max(0, Number(value || 0));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
};

const formatCreatedAt = (value) => {
  const timestamp = Number(value || 0);
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDanmakuType = (value) => {
  if (Number(value) === 1) return '顶部';
  if (Number(value) === 2) return '底部';
  return '滚动';
};

const DanmakuAdminPanel = ({
  token,
  apiConfigured,
  onStatusChange = () => {}
}) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [videoKeyFilter, setVideoKeyFilter] = useState('');
  const [queryFilter, setQueryFilter] = useState('');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, visible: 0, hidden: 0 });
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [actionId, setActionId] = useState('');

  const loadItems = useCallback(async () => {
    if (!apiConfigured) {
      onStatusChange({ tone: 'error', message: '弹幕后台接口未配置' });
      return;
    }
    if (!String(token || '').trim()) {
      onStatusChange({ tone: 'error', message: '请输入管理员口令后查看弹幕' });
      setItems([]);
      setTotal(0);
      return;
    }

    setIsLoading(true);
    try {
      const result = await loadDanmakuItems({
        token,
        status: statusFilter,
        videoKey: videoKeyFilter,
        query: queryFilter
      });
      setItems(Array.isArray(result?.items) ? result.items : []);
      setCounts({
        pending: Number(result?.counts?.pending || 0),
        visible: Number(result?.counts?.visible || 0),
        hidden: Number(result?.counts?.hidden || 0)
      });
      setTotal(Number(result?.total || 0));
      onStatusChange({
        tone: 'success',
        message: `已读取弹幕：共 ${Number(result?.total || 0)} 条`
      });
    } catch (error) {
      setItems([]);
      setTotal(0);
      onStatusChange({ tone: 'error', message: error?.message || '弹幕读取失败' });
    } finally {
      setIsLoading(false);
    }
  }, [apiConfigured, onStatusChange, queryFilter, statusFilter, token, videoKeyFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleSubmit = (event) => {
    event.preventDefault();
    void loadItems();
  };

  const handleDelete = async (item) => {
    if (!item?.id || actionId) return;
    const confirmed = window.confirm(`确定永久删除这条弹幕吗？\n${item.text || item.id}`);
    if (!confirmed) return;

    setActionId(item.id);
    try {
      await deleteDanmakuItem({
        id: item.id,
        token
      });
      await loadItems();
      onStatusChange({ tone: 'success', message: '弹幕已删除' });
    } catch (error) {
      onStatusChange({ tone: 'error', message: error?.message || '弹幕删除失败' });
    } finally {
      setActionId('');
    }
  };

  return (
    <div className="admin-form">
      <form className="admin-section" onSubmit={handleSubmit}>
        <div className="admin-section-title">弹幕审核</div>
        <div className="admin-grid">
          <label className="admin-field">
            <span>状态</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>弹幕池 ID</span>
            <input
              value={videoKeyFilter}
              onChange={(event) => setVideoKeyFilter(event.target.value)}
              placeholder="留空查看全部视频"
            />
          </label>
          <label className="admin-field admin-field-full">
            <span>搜索</span>
            <div className="admin-input-with-icon">
              <Search size={17} />
              <input
                value={queryFilter}
                onChange={(event) => setQueryFilter(event.target.value)}
                placeholder="搜索内容、作者或弹幕池 ID"
              />
            </div>
          </label>
        </div>

        <div className="admin-file-summary">
          全部 {counts.pending + counts.visible + counts.hidden} 条 · 已显示 {counts.visible} 条
        </div>

        <div className="admin-actions">
          <button
            type="submit"
            className="admin-btn secondary"
            disabled={isLoading || !apiConfigured}
          >
            <RefreshCw size={17} className={isLoading ? 'is-spinning' : ''} />
            {isLoading ? '读取中...' : '刷新弹幕'}
          </button>
        </div>
      </form>

      <section className="admin-section">
        <div className="admin-section-title">弹幕列表（{total}）</div>
        {items.length > 0 ? (
          <div className="admin-danmaku-list">
            {items.map((item) => (
              <article className="admin-danmaku-item" key={item.id}>
                <div className="admin-danmaku-main">
                  <div className="admin-danmaku-head">
                    <span className={`admin-danmaku-status ${item.status}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    <span>{formatVideoTime(item.time)}</span>
                    <span>{formatDanmakuType(item.type)}</span>
                    <span>{formatCreatedAt(item.createdAt)}</span>
                  </div>
                  <p>{item.text}</p>
                  <div className="admin-danmaku-meta">
                    <span>{item.videoKey}</span>
                    <span>{item.author}</span>
                    <span style={{ color: item.colorHex }}>{item.colorHex}</span>
                  </div>
                </div>
                <div className="admin-danmaku-actions">
                  <button
                    type="button"
                    className="admin-icon-btn danger"
                    onClick={() => handleDelete(item)}
                    disabled={Boolean(actionId)}
                    aria-label={`删除弹幕：${item.text}`}
                    title="删除弹幕"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty">
            {isLoading ? '正在读取弹幕...' : '当前筛选下没有弹幕'}
          </div>
        )}
      </section>
    </div>
  );
};

export default DanmakuAdminPanel;
