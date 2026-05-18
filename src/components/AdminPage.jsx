import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ImagePlus,
  KeyRound,
  Megaphone,
  RefreshCw,
  Save,
  UploadCloud
} from 'lucide-react';
import '../styles/admin.css';

import AnnouncementModal from './AnnouncementModal.jsx';
import { loadAnnouncement } from '../data/announcementSource.js';
import {
  isAnnouncementAdminApiConfigured,
  publishAnnouncement
} from '../data/announcementAdminApi.js';
import {
  isGalleryAdminApiConfigured,
  publishGalleryImages
} from '../data/galleryAdminApi.js';

const ADMIN_TOKEN_STORAGE_KEY = 'announcement-admin-token:v1';
const ADMIN_PANEL_ANNOUNCEMENT = 'announcement';
const ADMIN_PANEL_GALLERY = 'gallery';

const createDefaultDraft = () => ({
  id: new Date().toISOString().slice(0, 10),
  enabled: true,
  title: '站点公告',
  content: '',
  type: 'info',
  force: false,
  confirmText: '我知道了',
  linkText: '',
  linkUrl: '',
  startAt: '',
  endAt: '',
  updatedAt: ''
});

const createDefaultGalleryDraft = () => ({
  category: '未分类',
  name: '',
  message: '',
  files: []
});

const toDatetimeInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const fromDatetimeInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const createDraftFromAnnouncement = (announcement) => ({
  ...createDefaultDraft(),
  ...(announcement || {}),
  startAt: toDatetimeInputValue(announcement?.startAt),
  endAt: toDatetimeInputValue(announcement?.endAt)
});

const serializeDraft = (draft) => ({
  ...draft,
  id: String(draft.id || '').trim(),
  title: String(draft.title || '').trim(),
  content: String(draft.content || '').trim(),
  type: String(draft.type || 'info').trim(),
  confirmText: String(draft.confirmText || '').trim() || '我知道了',
  linkText: String(draft.linkText || '').trim(),
  linkUrl: String(draft.linkUrl || '').trim(),
  startAt: fromDatetimeInputValue(draft.startAt),
  endAt: fromDatetimeInputValue(draft.endAt),
  updatedAt: new Date().toISOString()
});

const AdminPage = () => {
  const announcementApiConfigured = useMemo(() => isAnnouncementAdminApiConfigured(), []);
  const galleryApiConfigured = useMemo(() => isGalleryAdminApiConfigured(), []);
  const [activePanel, setActivePanel] = useState(ADMIN_PANEL_ANNOUNCEMENT);
  const [draft, setDraft] = useState(createDefaultDraft);
  const [galleryDraft, setGalleryDraft] = useState(createDefaultGalleryDraft);
  const [galleryFileInputKey, setGalleryFileInputKey] = useState(0);
  const [galleryPublishResult, setGalleryPublishResult] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [announcementStatus, setAnnouncementStatus] = useState({
    tone: announcementApiConfigured ? 'idle' : 'error',
    message: announcementApiConfigured ? '正在读取当前公告...' : '公告后台接口未配置'
  });
  const [galleryStatus, setGalleryStatus] = useState({
    tone: galleryApiConfigured ? 'info' : 'error',
    message: galleryApiConfigured ? '选择图片后可发布到图床仓库' : '图库后台接口未配置'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGallerySaving, setIsGallerySaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const loadCurrentAnnouncement = async () => {
    setIsLoading(true);
    try {
      const result = await loadAnnouncement();
      if (result.announcement) {
        setDraft(createDraftFromAnnouncement(result.announcement));
        setAnnouncementStatus({ tone: 'success', message: '已读取当前公告' });
      } else {
        setAnnouncementStatus({ tone: 'info', message: '当前没有可用公告，可直接新建' });
      }
    } catch (error) {
      setAnnouncementStatus({ tone: 'error', message: error?.message || '公告读取失败' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCurrentAnnouncement();
  }, []);

  useEffect(() => {
    try {
      if (token) {
        window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }, [token]);

  const updateDraftField = (field, value) => {
    setDraft((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const updateGalleryDraftField = (field, value) => {
    setGalleryDraft((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handlePublish = async (event) => {
    event.preventDefault();

    const announcement = serializeDraft(draft);
    if (!announcement.id || !announcement.content) {
      setAnnouncementStatus({ tone: 'error', message: '公告 id 和正文不能为空' });
      return;
    }

    setIsSaving(true);
    try {
      const published = await publishAnnouncement({ announcement, token });
      setDraft(createDraftFromAnnouncement(published));
      setAnnouncementStatus({ tone: 'success', message: '公告已发布' });
    } catch (error) {
      setAnnouncementStatus({ tone: 'error', message: error?.message || '公告发布失败' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishGallery = async (event) => {
    event.preventDefault();

    if (!galleryDraft.files.length) {
      setGalleryStatus({ tone: 'error', message: '请选择要发布的图片' });
      return;
    }

    setIsGallerySaving(true);
    setGalleryPublishResult(null);
    try {
      const result = await publishGalleryImages({
        files: galleryDraft.files,
        category: galleryDraft.category,
        name: galleryDraft.name,
        message: galleryDraft.message,
        token
      });
      const publishedCount = Array.isArray(result?.items) ? result.items.length : galleryDraft.files.length;
      setGalleryDraft(createDefaultGalleryDraft());
      setGalleryFileInputKey((value) => value + 1);
      setGalleryPublishResult(result);
      setGalleryStatus({ tone: 'success', message: `已发布 ${publishedCount} 张图片，等待 Cloudflare Pages 更新` });
    } catch (error) {
      setGalleryStatus({ tone: 'error', message: error?.message || '图库发布失败' });
    } finally {
      setIsGallerySaving(false);
    }
  };

  const previewAnnouncement = serializeDraft(draft);
  const activeStatus = activePanel === ADMIN_PANEL_GALLERY ? galleryStatus : announcementStatus;
  const StatusIcon = activeStatus.tone === 'error'
    ? AlertTriangle
    : activeStatus.tone === 'success'
      ? CheckCircle2
      : null;
  const selectedFileSummary = galleryDraft.files.map((file) => file.name).join('、');

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">Admin Console</p>
          <h1>后台管理</h1>
        </div>
        <button
          type="button"
          className="admin-icon-btn"
          onClick={loadCurrentAnnouncement}
          disabled={isLoading}
          aria-label="刷新当前公告"
          title="刷新当前公告"
        >
          <RefreshCw size={18} className={isLoading ? 'is-spinning' : ''} />
        </button>
      </header>

      <div className="admin-panel">
        <div className={`admin-status ${activeStatus.tone}`}>
          {StatusIcon && <StatusIcon size={16} />}
          <span>{activeStatus.message}</span>
        </div>

        <section className="admin-section">
          <div className="admin-section-title">访问凭据</div>
          <label className="admin-field admin-field-token">
            <span>管理员口令</span>
            <div className="admin-input-with-icon">
              <KeyRound size={17} />
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Worker ADMIN_TOKEN"
                autoComplete="current-password"
              />
            </div>
          </label>
        </section>

        <div className="admin-tabs" role="tablist" aria-label="后台工具">
          <button
            type="button"
            className={`admin-tab ${activePanel === ADMIN_PANEL_ANNOUNCEMENT ? 'is-active' : ''}`}
            onClick={() => setActivePanel(ADMIN_PANEL_ANNOUNCEMENT)}
            role="tab"
            aria-selected={activePanel === ADMIN_PANEL_ANNOUNCEMENT}
          >
            <Megaphone size={16} />
            公告
          </button>
          <button
            type="button"
            className={`admin-tab ${activePanel === ADMIN_PANEL_GALLERY ? 'is-active' : ''}`}
            onClick={() => setActivePanel(ADMIN_PANEL_GALLERY)}
            role="tab"
            aria-selected={activePanel === ADMIN_PANEL_GALLERY}
          >
            <ImagePlus size={16} />
            图库
          </button>
        </div>

        {activePanel === ADMIN_PANEL_ANNOUNCEMENT && (
          <form className="admin-form" onSubmit={handlePublish}>
            <section className="admin-section">
              <div className="admin-section-title">公告内容</div>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>公告 id</span>
                  <input
                    value={draft.id}
                    onChange={(event) => updateDraftField('id', event.target.value)}
                    placeholder="2026-05-18-update-01"
                  />
                </label>
                <label className="admin-field">
                  <span>类型</span>
                  <select
                    value={draft.type}
                    onChange={(event) => updateDraftField('type', event.target.value)}
                  >
                    <option value="info">普通</option>
                    <option value="warning">重要</option>
                    <option value="success">完成</option>
                  </select>
                </label>
              </div>

              <label className="admin-field">
                <span>标题</span>
                <input
                  value={draft.title}
                  onChange={(event) => updateDraftField('title', event.target.value)}
                  placeholder="站点更新公告"
                />
              </label>

              <label className="admin-field">
                <span>正文</span>
                <textarea
                  value={draft.content}
                  onChange={(event) => updateDraftField('content', event.target.value)}
                  rows={7}
                  placeholder="输入要弹给用户看的内容"
                />
              </label>
            </section>

            <section className="admin-section">
              <div className="admin-section-title">展示规则</div>
              <div className="admin-toggle-row">
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => updateDraftField('enabled', event.target.checked)}
                  />
                  <span>启用公告</span>
                </label>
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={draft.force}
                    onChange={(event) => updateDraftField('force', event.target.checked)}
                  />
                  <span>重要提醒</span>
                </label>
              </div>

              <div className="admin-grid">
                <label className="admin-field">
                  <span>开始时间</span>
                  <input
                    type="datetime-local"
                    value={draft.startAt}
                    onChange={(event) => updateDraftField('startAt', event.target.value)}
                  />
                </label>
                <label className="admin-field">
                  <span>结束时间</span>
                  <input
                    type="datetime-local"
                    value={draft.endAt}
                    onChange={(event) => updateDraftField('endAt', event.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="admin-section">
              <div className="admin-section-title">按钮</div>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>确认按钮</span>
                  <input
                    value={draft.confirmText}
                    onChange={(event) => updateDraftField('confirmText', event.target.value)}
                    placeholder="我知道了"
                  />
                </label>
                <label className="admin-field">
                  <span>链接文字</span>
                  <input
                    value={draft.linkText}
                    onChange={(event) => updateDraftField('linkText', event.target.value)}
                    placeholder="查看详情"
                  />
                </label>
              </div>
              <label className="admin-field">
                <span>链接地址</span>
                <input
                  value={draft.linkUrl}
                  onChange={(event) => updateDraftField('linkUrl', event.target.value)}
                  placeholder="/about"
                />
              </label>
            </section>

            <div className="admin-actions">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setIsPreviewOpen(true)}
              >
                <Eye size={17} />
                预览
              </button>
              <button
                type="submit"
                className="admin-btn primary"
                disabled={isSaving || !announcementApiConfigured}
              >
                <Save size={17} />
                {isSaving ? '发布中...' : '发布公告'}
              </button>
            </div>
          </form>
        )}

        {activePanel === ADMIN_PANEL_GALLERY && (
          <form className="admin-form" onSubmit={handlePublishGallery}>
            <section className="admin-section">
              <div className="admin-section-title">图库发布</div>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>分类</span>
                  <input
                    value={galleryDraft.category}
                    onChange={(event) => updateGalleryDraftField('category', event.target.value)}
                    placeholder="XKK"
                  />
                </label>
                <label className="admin-field">
                  <span>显示名称</span>
                  <input
                    value={galleryDraft.name}
                    onChange={(event) => updateGalleryDraftField('name', event.target.value)}
                    placeholder="单张图片可选"
                  />
                </label>
              </div>

              <label className="admin-field admin-file-field">
                <span>图片文件</span>
                <input
                  key={galleryFileInputKey}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => updateGalleryDraftField(
                    'files',
                    Array.from(event.target.files || [])
                  )}
                />
              </label>

              {selectedFileSummary && (
                <div className="admin-file-summary" title={selectedFileSummary}>
                  {galleryDraft.files.length} 个文件：{selectedFileSummary}
                </div>
              )}

              <label className="admin-field">
                <span>提交说明</span>
                <input
                  value={galleryDraft.message}
                  onChange={(event) => updateGalleryDraftField('message', event.target.value)}
                  placeholder="留空则自动生成"
                />
              </label>
            </section>

            {galleryPublishResult?.commit?.url && (
              <div className="admin-result">
                <span>GitHub commit</span>
                <a href={galleryPublishResult.commit.url} target="_blank" rel="noreferrer">
                  {galleryPublishResult.commit.sha?.slice(0, 7) || '查看提交'}
                </a>
              </div>
            )}

            <div className="admin-actions">
              <button
                type="submit"
                className="admin-btn primary"
                disabled={isGallerySaving || !galleryApiConfigured}
              >
                <UploadCloud size={17} />
                {isGallerySaving ? '发布中...' : '发布图片'}
              </button>
            </div>
          </form>
        )}
      </div>

      {activePanel === ADMIN_PANEL_ANNOUNCEMENT && (
        <AnnouncementModal
          announcement={previewAnnouncement}
          open={isPreviewOpen}
          onConfirm={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminPage;
