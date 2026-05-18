import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Film,
  ImagePlus,
  KeyRound,
  Megaphone,
  Music,
  RefreshCw,
  Save,
  UploadCloud
} from 'lucide-react';
import '../styles/admin.css';

import AnnouncementModal from './AnnouncementModal.jsx';
import { loadAnnouncement } from '../data/announcementSource.js';
import { loadGalleryItems } from '../data/galleryManifest.js';
import { loadDownloadSections } from '../data/downloadManifest.js';
import { loadMusicManifestAlbums } from '../data/musicManifest.js';
import { loadVideoCatalog } from '../data/videoManifest.js';
import {
  isAnnouncementAdminApiConfigured,
  publishAnnouncement
} from '../data/announcementAdminApi.js';
import {
  isGalleryAdminApiConfigured,
  publishGalleryImages
} from '../data/galleryAdminApi.js';
import {
  isMusicAdminApiConfigured,
  publishMusicAlbum
} from '../data/musicAdminApi.js';
import {
  isVideoAdminApiConfigured,
  isVideoAccessAdminApiConfigured,
  loadVideoAccessSettings,
  publishVideoAccessSettings,
  publishVideoLinks
} from '../data/videoAdminApi.js';
import {
  isDownloadAdminApiConfigured,
  publishDownloadLinks
} from '../data/downloadAdminApi.js';

const ADMIN_TOKEN_STORAGE_KEY = 'announcement-admin-token:v1';
const ADMIN_PANEL_ANNOUNCEMENT = 'announcement';
const ADMIN_PANEL_GALLERY = 'gallery';
const ADMIN_PANEL_MUSIC = 'music';
const ADMIN_PANEL_VIDEO = 'video';
const ADMIN_PANEL_DOWNLOAD = 'download';
const NEW_VIDEO_FOLDER_VALUE = '__new_video_folder__';

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

const createDefaultMusicDraft = () => ({
  albumId: '',
  albumName: '',
  artist: '李志',
  coverUrl: '',
  year: '',
  type: 'live',
  sortOrder: '',
  startTrackNumber: '',
  songNames: '',
  audioUrls: '',
  lyricUrls: '',
  songCoverUrls: '',
  audioFiles: [],
  lyricFiles: [],
  coverFile: null,
  songCoverFiles: []
});

const createDefaultVideoDraft = () => ({
  categoryId: '',
  categoryName: '',
  categoryIcon: 'video',
  categorySortOrder: '',
  folderId: '',
  folderTitle: '',
  folderThumb: '',
  folderSortOrder: '',
  startSortOrder: '',
  videoIds: '',
  videoTitles: '',
  videoUrls: '',
  backupUrls: '',
  thumbUrls: ''
});

const createDefaultVideoAccessDraft = () => ({
  password: '',
  passwordVersion: '',
  updatedAt: ''
});

const createDefaultDownloadDraft = () => ({
  sectionTitle: '',
  sectionSortOrder: '',
  groupTitle: '',
  groupSortOrder: '',
  startSortOrder: '',
  itemTitles: '',
  itemUrls: '',
  filenames: '',
  previewUrls: ''
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

const getUniqueGalleryCategories = (items) => {
  const categories = new Set();
  for (const item of items || []) {
    const category = String(item?.category || '').trim();
    if (category) categories.add(category);
  }

  return Array.from(categories).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
};

const countNonEmptyLines = (value) => String(value || '')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .length;

const toAdminIconName = (value) => String(value || 'video').replace(/^#?icon-/, '') || 'video';

const AdminPage = () => {
  const announcementApiConfigured = useMemo(() => isAnnouncementAdminApiConfigured(), []);
  const galleryApiConfigured = useMemo(() => isGalleryAdminApiConfigured(), []);
  const musicApiConfigured = useMemo(() => isMusicAdminApiConfigured(), []);
  const videoApiConfigured = useMemo(() => isVideoAdminApiConfigured(), []);
  const videoAccessApiConfigured = useMemo(() => isVideoAccessAdminApiConfigured(), []);
  const downloadApiConfigured = useMemo(() => isDownloadAdminApiConfigured(), []);
  const [activePanel, setActivePanel] = useState(ADMIN_PANEL_ANNOUNCEMENT);
  const [draft, setDraft] = useState(createDefaultDraft);
  const [galleryDraft, setGalleryDraft] = useState(createDefaultGalleryDraft);
  const [musicDraft, setMusicDraft] = useState(createDefaultMusicDraft);
  const [videoDraft, setVideoDraft] = useState(createDefaultVideoDraft);
  const [videoAccessDraft, setVideoAccessDraft] = useState(createDefaultVideoAccessDraft);
  const [downloadDraft, setDownloadDraft] = useState(createDefaultDownloadDraft);
  const [videoFolderSelection, setVideoFolderSelection] = useState('');
  const [galleryCategories, setGalleryCategories] = useState([]);
  const [musicAlbums, setMusicAlbums] = useState([]);
  const [videoCatalog, setVideoCatalog] = useState({ videoCategories: [], videoData: {} });
  const [downloadSections, setDownloadSections] = useState([]);
  const [galleryFileInputKey, setGalleryFileInputKey] = useState(0);
  const [musicAudioInputKey, setMusicAudioInputKey] = useState(0);
  const [musicLyricInputKey, setMusicLyricInputKey] = useState(0);
  const [musicCoverInputKey, setMusicCoverInputKey] = useState(0);
  const [musicSongCoverInputKey, setMusicSongCoverInputKey] = useState(0);
  const [galleryPublishResult, setGalleryPublishResult] = useState(null);
  const [musicPublishResult, setMusicPublishResult] = useState(null);
  const [videoPublishResult, setVideoPublishResult] = useState(null);
  const [videoAccessPublishResult, setVideoAccessPublishResult] = useState(null);
  const [downloadPublishResult, setDownloadPublishResult] = useState(null);
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
  const [musicStatus, setMusicStatus] = useState({
    tone: musicApiConfigured ? 'info' : 'error',
    message: musicApiConfigured ? '上传音频或填写外链后可发布到曲库' : '音乐后台接口未配置'
  });
  const [videoStatus, setVideoStatus] = useState({
    tone: videoApiConfigured ? 'info' : 'error',
    message: videoApiConfigured ? '填写视频链接后可更新视频清单' : '视频后台接口未配置'
  });
  const [downloadStatus, setDownloadStatus] = useState({
    tone: downloadApiConfigured ? 'info' : 'error',
    message: downloadApiConfigured ? '填写下载链接后可更新下载清单' : '下载后台接口未配置'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGallerySaving, setIsGallerySaving] = useState(false);
  const [isMusicSaving, setIsMusicSaving] = useState(false);
  const [isVideoSaving, setIsVideoSaving] = useState(false);
  const [isVideoAccessLoading, setIsVideoAccessLoading] = useState(false);
  const [isVideoAccessSaving, setIsVideoAccessSaving] = useState(false);
  const [isDownloadSaving, setIsDownloadSaving] = useState(false);
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

  const loadGalleryCategories = async () => {
    try {
      const items = await loadGalleryItems();
      setGalleryCategories(getUniqueGalleryCategories(items));
    } catch {
      setGalleryCategories([]);
    }
  };

  const loadMusicAlbumsForAdmin = async () => {
    try {
      const albums = await loadMusicManifestAlbums();
      setMusicAlbums(Array.isArray(albums) ? albums : []);
    } catch {
      setMusicAlbums([]);
    }
  };

  const loadVideoCatalogForAdmin = async () => {
    try {
      const catalog = await loadVideoCatalog();
      setVideoCatalog({
        videoCategories: Array.isArray(catalog?.videoCategories) ? catalog.videoCategories : [],
        videoData: catalog?.videoData && typeof catalog.videoData === 'object' ? catalog.videoData : {}
      });
    } catch {
      setVideoCatalog({ videoCategories: [], videoData: {} });
    }
  };

  const loadDownloadSectionsForAdmin = async () => {
    try {
      const sections = await loadDownloadSections();
      setDownloadSections(Array.isArray(sections) ? sections : []);
    } catch {
      setDownloadSections([]);
    }
  };

  useEffect(() => {
    void loadCurrentAnnouncement();
  }, []);

  useEffect(() => {
    if (activePanel === ADMIN_PANEL_GALLERY && galleryCategories.length === 0) {
      void loadGalleryCategories();
    }
  }, [activePanel, galleryCategories.length]);

  useEffect(() => {
    if (activePanel === ADMIN_PANEL_MUSIC && musicAlbums.length === 0) {
      void loadMusicAlbumsForAdmin();
    }
  }, [activePanel, musicAlbums.length]);

  useEffect(() => {
    if (activePanel === ADMIN_PANEL_VIDEO && videoCatalog.videoCategories.length === 0) {
      void loadVideoCatalogForAdmin();
    }
  }, [activePanel, videoCatalog.videoCategories.length]);

  useEffect(() => {
    if (activePanel === ADMIN_PANEL_DOWNLOAD && downloadSections.length === 0) {
      void loadDownloadSectionsForAdmin();
    }
  }, [activePanel, downloadSections.length]);

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

  const updateMusicDraftField = (field, value) => {
    setMusicDraft((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const updateVideoDraftField = (field, value) => {
    setVideoDraft((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const updateVideoAccessDraftField = (field, value) => {
    setVideoAccessDraft((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const updateDownloadDraftField = (field, value) => {
    setDownloadDraft((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const applyMusicAlbum = (album) => {
    if (!album) return;
    setMusicDraft((previous) => ({
      ...previous,
      albumId: String(album.id || ''),
      albumName: String(album.name || ''),
      artist: String(album.artist || previous.artist || ''),
      coverUrl: String(album.cover || ''),
      year: album.year ? String(album.year) : previous.year,
      type: String(album.type || previous.type || 'live'),
      startTrackNumber: String((album.songs?.length || 0) + 1)
    }));
  };

  const handleMusicAlbumSelect = (value) => {
    const selectedAlbum = musicAlbums.find((album) => album.id === value);
    if (selectedAlbum) {
      applyMusicAlbum(selectedAlbum);
      return;
    }
    updateMusicDraftField('albumId', value);
  };

  const applyVideoCategory = (category) => {
    if (!category) return;
    setVideoFolderSelection('');
    setVideoDraft((previous) => ({
      ...previous,
      categoryId: String(category.id || ''),
      categoryName: String(category.name || ''),
      categoryIcon: toAdminIconName(category.icon),
      folderId: '',
      folderTitle: '',
      folderThumb: '',
      folderSortOrder: ''
    }));
  };

  const handleVideoCategorySelect = (value) => {
    setVideoFolderSelection('');
    const selectedCategory = videoCategories.find((category) => category.id === value);
    if (selectedCategory) {
      applyVideoCategory(selectedCategory);
      return;
    }
    setVideoDraft((previous) => ({
      ...previous,
      categoryId: value,
      folderId: '',
      folderTitle: '',
      folderThumb: '',
      folderSortOrder: ''
    }));
  };

  const applyVideoFolder = (folder) => {
    if (!folder) return;
    setVideoFolderSelection(String(folder.folderId || folder.id || ''));
    setVideoDraft((previous) => ({
      ...previous,
      folderId: String(folder.folderId || folder.id || ''),
      folderTitle: String(folder.title || ''),
      folderThumb: String(folder.thumb || '')
    }));
  };

  const handleVideoFolderSelect = (value) => {
    setVideoFolderSelection(value);
    if (!value) {
      setVideoDraft((previous) => ({
        ...previous,
        folderId: '',
        folderTitle: '',
        folderThumb: '',
        folderSortOrder: ''
      }));
      return;
    }
    if (value === NEW_VIDEO_FOLDER_VALUE) {
      setVideoDraft((previous) => ({
        ...previous,
        folderId: '',
        folderTitle: '',
        folderThumb: '',
        folderSortOrder: ''
      }));
      return;
    }
    const selectedFolder = videoFolders.find((folder) => (folder.folderId || folder.id) === value);
    if (selectedFolder) {
      applyVideoFolder(selectedFolder);
      return;
    }
    updateVideoDraftField('folderId', value);
  };

  const handleDownloadSectionSelect = (value) => {
    const selectedSection = downloadSections.find((section) => section.title === value);
    setDownloadDraft((previous) => ({
      ...previous,
      sectionTitle: value,
      groupTitle: selectedSection?.groups?.[0]?.title || ''
    }));
  };

  const handleDownloadGroupSelect = (value) => {
    updateDownloadDraftField('groupTitle', value);
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
      const publishedCategories = getUniqueGalleryCategories(result?.items);
      if (publishedCategories.length > 0) {
        setGalleryCategories((previous) => getUniqueGalleryCategories([
          ...previous.map((category) => ({ category })),
          ...publishedCategories.map((category) => ({ category }))
        ]));
      }
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

  const handlePublishMusic = async (event) => {
    event.preventDefault();

    if (!String(musicDraft.albumId || '').trim()) {
      setMusicStatus({ tone: 'error', message: '请填写专辑 ID' });
      return;
    }
    if (!String(musicDraft.albumName || '').trim()) {
      setMusicStatus({ tone: 'error', message: '请填写专辑名' });
      return;
    }
    if (!musicDraft.audioFiles.length && !String(musicDraft.audioUrls || '').trim()) {
      setMusicStatus({ tone: 'error', message: '请选择要发布的音频文件或填写音频链接' });
      return;
    }

    setIsMusicSaving(true);
    setMusicPublishResult(null);
    try {
      const result = await publishMusicAlbum({
        ...musicDraft,
        token
      });
      const publishedCount = Array.isArray(result?.songs)
        ? result.songs.length
        : musicDraft.audioFiles.length + countNonEmptyLines(musicDraft.audioUrls);
      setMusicDraft(createDefaultMusicDraft());
      setMusicAudioInputKey((value) => value + 1);
      setMusicLyricInputKey((value) => value + 1);
      setMusicCoverInputKey((value) => value + 1);
      setMusicSongCoverInputKey((value) => value + 1);
      setMusicPublishResult(result);
      setMusicStatus({ tone: 'success', message: `已发布 ${publishedCount} 首歌曲到 R2` });
    } catch (error) {
      setMusicStatus({ tone: 'error', message: error?.message || '音乐发布失败' });
    } finally {
      setIsMusicSaving(false);
    }
  };

  const applyVideoAccessSettings = (config) => {
    setVideoAccessDraft({
      password: String(config?.password || ''),
      passwordVersion: String(config?.passwordVersion || ''),
      updatedAt: String(config?.updatedAt || '')
    });
  };

  const handleLoadVideoAccess = async () => {
    setIsVideoAccessLoading(true);
    try {
      const config = await loadVideoAccessSettings({ token });
      applyVideoAccessSettings(config);
      setVideoStatus({ tone: 'success', message: '已读取当前视频访问口令' });
    } catch (error) {
      setVideoStatus({ tone: 'error', message: error?.message || '视频口令读取失败' });
    } finally {
      setIsVideoAccessLoading(false);
    }
  };

  const handlePublishVideoAccess = async () => {
    const password = String(videoAccessDraft.password || '').trim();
    if (!password) {
      setVideoStatus({ tone: 'error', message: '请填写视频访问口令' });
      return;
    }

    setIsVideoAccessSaving(true);
    setVideoAccessPublishResult(null);
    try {
      const result = await publishVideoAccessSettings({
        password,
        token
      });
      applyVideoAccessSettings(result?.config);
      setVideoAccessPublishResult(result);
      setVideoStatus({ tone: 'success', message: '视频访问口令已保存，旧授权已失效' });
    } catch (error) {
      setVideoStatus({ tone: 'error', message: error?.message || '视频口令保存失败' });
    } finally {
      setIsVideoAccessSaving(false);
    }
  };

  const handlePublishVideo = async (event) => {
    event.preventDefault();

    if (!String(videoDraft.categoryId || '').trim()) {
      setVideoStatus({ tone: 'error', message: '请填写分类 ID' });
      return;
    }
    if (!String(videoDraft.categoryName || '').trim()) {
      setVideoStatus({ tone: 'error', message: '请填写分类名称' });
      return;
    }
    if (!String(videoDraft.videoUrls || '').trim()) {
      setVideoStatus({ tone: 'error', message: '请填写视频链接' });
      return;
    }

    setIsVideoSaving(true);
    setVideoPublishResult(null);
    try {
      const result = await publishVideoLinks({
        ...videoDraft,
        token
      });
      const publishedCount = Array.isArray(result?.items)
        ? result.items.length
        : countNonEmptyLines(videoDraft.videoUrls);
      setVideoDraft(createDefaultVideoDraft());
      setVideoFolderSelection('');
      setVideoPublishResult(result);
      setVideoStatus({ tone: 'success', message: `已发布 ${publishedCount} 个视频链接` });
    } catch (error) {
      setVideoStatus({ tone: 'error', message: error?.message || '视频发布失败' });
    } finally {
      setIsVideoSaving(false);
    }
  };

  const handlePublishDownload = async (event) => {
    event.preventDefault();

    if (!String(downloadDraft.sectionTitle || '').trim()) {
      setDownloadStatus({ tone: 'error', message: '请填写下载栏目' });
      return;
    }
    if (!String(downloadDraft.groupTitle || '').trim()) {
      setDownloadStatus({ tone: 'error', message: '请填写下载分组' });
      return;
    }
    if (!String(downloadDraft.itemUrls || '').trim()) {
      setDownloadStatus({ tone: 'error', message: '请填写下载链接' });
      return;
    }

    setIsDownloadSaving(true);
    setDownloadPublishResult(null);
    try {
      const result = await publishDownloadLinks({
        ...downloadDraft,
        token
      });
      const publishedCount = Array.isArray(result?.items)
        ? result.items.length
        : countNonEmptyLines(downloadDraft.itemUrls);
      setDownloadDraft(createDefaultDownloadDraft());
      setDownloadPublishResult(result);
      setDownloadStatus({ tone: 'success', message: `已发布 ${publishedCount} 个下载链接` });
    } catch (error) {
      setDownloadStatus({ tone: 'error', message: error?.message || '下载发布失败' });
    } finally {
      setIsDownloadSaving(false);
    }
  };

  const previewAnnouncement = serializeDraft(draft);
  const activeStatus = activePanel === ADMIN_PANEL_GALLERY
    ? galleryStatus
    : activePanel === ADMIN_PANEL_MUSIC
      ? musicStatus
      : activePanel === ADMIN_PANEL_VIDEO
        ? videoStatus
        : activePanel === ADMIN_PANEL_DOWNLOAD
          ? downloadStatus
          : announcementStatus;
  const StatusIcon = activeStatus.tone === 'error'
    ? AlertTriangle
    : activeStatus.tone === 'success'
      ? CheckCircle2
      : null;
  const selectedFileSummary = galleryDraft.files.map((file) => file.name).join('、');
  const selectedAudioSummary = musicDraft.audioFiles.map((file) => file.name).join('、');
  const selectedLyricSummary = musicDraft.lyricFiles.map((file) => file.name).join('、');
  const selectedAlbumCoverSummary = musicDraft.coverFile?.name || '';
  const selectedSongCoverSummary = musicDraft.songCoverFiles.map((file) => file.name).join('、');
  const videoCategories = videoCatalog.videoCategories;
  const videoFolders = (videoCatalog.videoData?.[videoDraft.categoryId] || [])
    .filter((item) => item?.isFolder || item?.folderId);
  const selectedDownloadSection = downloadSections.find((section) => section.title === downloadDraft.sectionTitle);
  const downloadGroups = Array.isArray(selectedDownloadSection?.groups) ? selectedDownloadSection.groups : [];
  const selectedVideoFolderValue = videoFolderSelection || (
    videoFolders.some((folder) => (folder.folderId || folder.id) === videoDraft.folderId)
      ? videoDraft.folderId
      : videoDraft.folderId || videoDraft.folderTitle
        ? NEW_VIDEO_FOLDER_VALUE
        : ''
  );
  const usesVideoFolder = selectedVideoFolderValue !== '';

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
          <button
            type="button"
            className={`admin-tab ${activePanel === ADMIN_PANEL_MUSIC ? 'is-active' : ''}`}
            onClick={() => setActivePanel(ADMIN_PANEL_MUSIC)}
            role="tab"
            aria-selected={activePanel === ADMIN_PANEL_MUSIC}
          >
            <Music size={16} />
            音乐
          </button>
          <button
            type="button"
            className={`admin-tab ${activePanel === ADMIN_PANEL_VIDEO ? 'is-active' : ''}`}
            onClick={() => setActivePanel(ADMIN_PANEL_VIDEO)}
            role="tab"
            aria-selected={activePanel === ADMIN_PANEL_VIDEO}
          >
            <Film size={16} />
            视频
          </button>
          <button
            type="button"
            className={`admin-tab ${activePanel === ADMIN_PANEL_DOWNLOAD ? 'is-active' : ''}`}
            onClick={() => setActivePanel(ADMIN_PANEL_DOWNLOAD)}
            role="tab"
            aria-selected={activePanel === ADMIN_PANEL_DOWNLOAD}
          >
            <Download size={16} />
            下载
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
                    <option value="success">更新</option>
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
                    list="admin-gallery-category-list"
                    value={galleryDraft.category}
                    onChange={(event) => updateGalleryDraftField('category', event.target.value)}
                    placeholder="XKK"
                  />
                  <datalist id="admin-gallery-category-list">
                    {galleryCategories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
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

              {galleryCategories.length > 0 && (
                <div className="admin-category-options" aria-label="已有分类">
                  {galleryCategories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`admin-category-option ${galleryDraft.category === category ? 'is-active' : ''}`}
                      onClick={() => updateGalleryDraftField('category', category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}

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

        {activePanel === ADMIN_PANEL_MUSIC && (
          <form className="admin-form" onSubmit={handlePublishMusic}>
            <section className="admin-section">
              <div className="admin-section-title">目标专辑</div>
              <label className="admin-field">
                <span>选择专辑</span>
                <select
                  value={musicAlbums.some((album) => album.id === musicDraft.albumId) ? musicDraft.albumId : ''}
                  onChange={(event) => handleMusicAlbumSelect(event.target.value)}
                >
                  <option value="">新建专辑</option>
                  {musicAlbums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>专辑 ID</span>
                  <input
                    value={musicDraft.albumId}
                    onChange={(event) => updateMusicDraftField('albumId', event.target.value)}
                    placeholder="例如 san-que-yi-kuala-lumpur"
                  />
                </label>
                <label className="admin-field">
                  <span>专辑名</span>
                  <input
                    value={musicDraft.albumName}
                    onChange={(event) => updateMusicDraftField('albumName', event.target.value)}
                    placeholder="例如 叁缺壹吉隆坡站"
                  />
                </label>
              </div>

              <details className="admin-details">
                <summary>专辑设置</summary>
                <div className="admin-details-body">
                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>艺术家</span>
                      <input
                        value={musicDraft.artist}
                        onChange={(event) => updateMusicDraftField('artist', event.target.value)}
                        placeholder="李志"
                      />
                    </label>
                    <label className="admin-field">
                      <span>专辑封面 URL</span>
                      <input
                        value={musicDraft.coverUrl}
                        onChange={(event) => updateMusicDraftField('coverUrl', event.target.value)}
                        placeholder="https://r2.1701701.xyz/img/music/专辑/cover.jpg"
                      />
                    </label>
                  </div>

                  <label className="admin-field admin-file-field">
                    <span>上传专辑封面</span>
                    <input
                      key={musicCoverInputKey}
                      type="file"
                      accept="image/*"
                      onChange={(event) => updateMusicDraftField(
                        'coverFile',
                        Array.from(event.target.files || [])[0] || null
                      )}
                    />
                  </label>

                  {selectedAlbumCoverSummary && (
                    <div className="admin-file-summary" title={selectedAlbumCoverSummary}>
                      专辑封面：{selectedAlbumCoverSummary}
                    </div>
                  )}

                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>年份</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={musicDraft.year}
                        onChange={(event) => updateMusicDraftField('year', event.target.value)}
                        placeholder="2026"
                      />
                    </label>
                    <label className="admin-field">
                      <span>类型</span>
                      <select
                        value={musicDraft.type}
                        onChange={(event) => updateMusicDraftField('type', event.target.value)}
                      >
                        <option value="live">live</option>
                        <option value="studio">studio</option>
                        <option value="compilation">compilation</option>
                        <option value="single">single</option>
                      </select>
                    </label>
                  </div>

                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>专辑排序</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={musicDraft.sortOrder}
                        onChange={(event) => updateMusicDraftField('sortOrder', event.target.value)}
                        placeholder="留空自动追加"
                      />
                    </label>
                    <label className="admin-field">
                      <span>起始曲序</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={musicDraft.startTrackNumber}
                        onChange={(event) => updateMusicDraftField('startTrackNumber', event.target.value)}
                        placeholder="留空自动追加"
                      />
                    </label>
                  </div>
                </div>
              </details>
            </section>

            <section className="admin-section">
              <div className="admin-section-title">歌曲来源</div>
              <div className="admin-grid">
                <label className="admin-field admin-file-field">
                  <span>上传音频</span>
                  <input
                    key={musicAudioInputKey}
                    type="file"
                    accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.webm"
                    multiple
                    onChange={(event) => updateMusicDraftField(
                      'audioFiles',
                      Array.from(event.target.files || [])
                    )}
                  />
                </label>
                <label className="admin-field">
                  <span>音频链接</span>
                  <textarea
                    className="admin-textarea-compact"
                    value={musicDraft.audioUrls}
                    onChange={(event) => updateMusicDraftField('audioUrls', event.target.value)}
                    rows={3}
                    placeholder="每行一个音频 URL"
                  />
                </label>
              </div>

              {selectedAudioSummary && (
                <div className="admin-file-summary" title={selectedAudioSummary}>
                  {musicDraft.audioFiles.length} 个音频：{selectedAudioSummary}
                </div>
              )}

              <label className="admin-field">
                <span>歌曲名称</span>
                <textarea
                  className="admin-textarea-compact"
                  value={musicDraft.songNames}
                  onChange={(event) => updateMusicDraftField('songNames', event.target.value)}
                  rows={3}
                  placeholder="可选，每行对应一个音频"
                />
              </label>

              <details className="admin-details">
                <summary>单曲资料（可选）</summary>
                <div className="admin-details-body">
                  <div className="admin-grid">
                    <label className="admin-field admin-file-field">
                      <span>歌词文件</span>
                      <input
                        key={musicLyricInputKey}
                        type="file"
                        accept=".lrc,.txt,text/plain"
                        multiple
                        onChange={(event) => updateMusicDraftField(
                          'lyricFiles',
                          Array.from(event.target.files || [])
                        )}
                      />
                    </label>
                    <label className="admin-field admin-file-field">
                      <span>上传单曲封面</span>
                      <input
                        key={musicSongCoverInputKey}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => updateMusicDraftField(
                          'songCoverFiles',
                          Array.from(event.target.files || [])
                        )}
                      />
                    </label>
                  </div>

                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>歌词链接</span>
                      <textarea
                        className="admin-textarea-compact"
                        value={musicDraft.lyricUrls}
                        onChange={(event) => updateMusicDraftField('lyricUrls', event.target.value)}
                        rows={3}
                        placeholder="每行一个歌词 URL"
                      />
                    </label>
                    <label className="admin-field">
                      <span>单曲封面链接</span>
                      <textarea
                        className="admin-textarea-compact"
                        value={musicDraft.songCoverUrls}
                        onChange={(event) => updateMusicDraftField('songCoverUrls', event.target.value)}
                        rows={3}
                        placeholder="每行一个封面 URL；空行或 - 用专辑封面"
                      />
                    </label>
                  </div>

                  {selectedLyricSummary && (
                    <div className="admin-file-summary" title={selectedLyricSummary}>
                      {musicDraft.lyricFiles.length} 个歌词：{selectedLyricSummary}
                    </div>
                  )}
                  {selectedSongCoverSummary && (
                    <div className="admin-file-summary" title={selectedSongCoverSummary}>
                      {musicDraft.songCoverFiles.length} 个单曲封面：{selectedSongCoverSummary}
                    </div>
                  )}
                </div>
              </details>
            </section>

            {musicPublishResult?.manifestTarget && (
              <div className="admin-result">
                <span>音乐清单</span>
                <a href={musicPublishResult.manifestTarget.url} target="_blank" rel="noreferrer">
                  {musicPublishResult.manifestTarget.key || '查看 music-index.json'}
                </a>
              </div>
            )}

            <div className="admin-actions">
              <button
                type="submit"
                className="admin-btn primary"
                disabled={isMusicSaving || !musicApiConfigured}
              >
                <UploadCloud size={17} />
                {isMusicSaving ? '发布中...' : '发布音乐'}
              </button>
            </div>
          </form>
        )}

        {activePanel === ADMIN_PANEL_VIDEO && (
          <form className="admin-form" onSubmit={handlePublishVideo}>
            <section className="admin-section">
              <div className="admin-section-title">视频访问口令</div>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>访问口令</span>
                  <input
                    value={videoAccessDraft.password}
                    onChange={(event) => updateVideoAccessDraftField('password', event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handlePublishVideoAccess();
                      }
                    }}
                    placeholder="例如 SongSharing"
                  />
                </label>
                <label className="admin-field">
                  <span>当前版本</span>
                  <input
                    value={videoAccessDraft.passwordVersion || '未读取'}
                    readOnly
                  />
                </label>
              </div>
              {videoAccessDraft.updatedAt && (
                <div className="admin-file-summary">
                  上次保存：{new Date(videoAccessDraft.updatedAt).toLocaleString('zh-CN')}
                </div>
              )}
              {videoAccessPublishResult?.publicTarget && (
                <div className="admin-result">
                  <span>口令配置</span>
                  <a href={videoAccessPublishResult.publicTarget.url} target="_blank" rel="noreferrer">
                    {videoAccessPublishResult.publicTarget.key || '查看 video-access.json'}
                  </a>
                </div>
              )}
              <div className="admin-actions">
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={handleLoadVideoAccess}
                  disabled={isVideoAccessLoading || !videoAccessApiConfigured}
                >
                  <RefreshCw size={17} className={isVideoAccessLoading ? 'is-spinning' : ''} />
                  {isVideoAccessLoading ? '读取中...' : '读取口令'}
                </button>
                <button
                  type="button"
                  className="admin-btn primary"
                  onClick={handlePublishVideoAccess}
                  disabled={isVideoAccessSaving || !videoAccessApiConfigured}
                >
                  <Save size={17} />
                  {isVideoAccessSaving ? '保存中...' : '保存口令'}
                </button>
              </div>
            </section>

            <section className="admin-section">
              <div className="admin-section-title">目标位置</div>
              <label className="admin-field">
                <span>选择分类</span>
                <select
                  value={videoCategories.some((category) => category.id === videoDraft.categoryId) ? videoDraft.categoryId : ''}
                  onChange={(event) => handleVideoCategorySelect(event.target.value)}
                >
                  <option value="">新建分类或手动填写</option>
                  {videoCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>分类 ID</span>
                  <input
                    value={videoDraft.categoryId}
                    onChange={(event) => updateVideoDraftField('categoryId', event.target.value)}
                    placeholder="knxy"
                  />
                </label>
                <label className="admin-field">
                  <span>分类名称</span>
                  <input
                    value={videoDraft.categoryName}
                    onChange={(event) => updateVideoDraftField('categoryName', event.target.value)}
                    placeholder="跨年音乐会"
                  />
                </label>
              </div>

              <div className="admin-grid">
                <label className={`admin-field ${usesVideoFolder ? '' : 'admin-field-full'}`}>
                  <span>选择文件夹</span>
                  <select
                    value={selectedVideoFolderValue}
                    onChange={(event) => handleVideoFolderSelect(event.target.value)}
                  >
                    <option value="">直接放在分类下</option>
                    {videoFolders.map((folder) => (
                      <option key={folder.folderId || folder.id} value={folder.folderId || folder.id}>
                        {folder.title}
                      </option>
                    ))}
                    <option value={NEW_VIDEO_FOLDER_VALUE}>新建文件夹</option>
                  </select>
                </label>
                {usesVideoFolder && (
                  <label className="admin-field">
                    <span>文件夹标题</span>
                    <input
                      value={videoDraft.folderTitle}
                      onChange={(event) => updateVideoDraftField('folderTitle', event.target.value)}
                      placeholder={selectedVideoFolderValue === NEW_VIDEO_FOLDER_VALUE ? '例如 叁缺壹吉隆坡站' : '可按需修改'}
                    />
                  </label>
                )}
              </div>

              <details className="admin-details">
                <summary>分类与文件夹设置</summary>
                <div className="admin-details-body">
                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>分类图标</span>
                      <input
                        value={videoDraft.categoryIcon}
                        onChange={(event) => updateVideoDraftField('categoryIcon', event.target.value)}
                        placeholder="video"
                      />
                    </label>
                    <label className="admin-field">
                      <span>分类排序</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={videoDraft.categorySortOrder}
                        onChange={(event) => updateVideoDraftField('categorySortOrder', event.target.value)}
                        placeholder="留空自动追加"
                      />
                    </label>
                  </div>

                  {usesVideoFolder && (
                    <>
                      <div className="admin-grid">
                        <label className="admin-field">
                          <span>文件夹 ID</span>
                          <input
                            value={videoDraft.folderId}
                            onChange={(event) => updateVideoDraftField('folderId', event.target.value)}
                            placeholder="留空按标题生成"
                          />
                        </label>
                        <label className="admin-field">
                          <span>文件夹封面</span>
                          <input
                            value={videoDraft.folderThumb}
                            onChange={(event) => updateVideoDraftField('folderThumb', event.target.value)}
                            placeholder="https://r2.1701701.xyz/img/dian2.jpg"
                          />
                        </label>
                      </div>

                      <label className="admin-field">
                        <span>文件夹排序</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={videoDraft.folderSortOrder}
                          onChange={(event) => updateVideoDraftField('folderSortOrder', event.target.value)}
                          placeholder="留空自动追加"
                        />
                      </label>
                    </>
                  )}
                </div>
              </details>
            </section>

            <section className="admin-section">
              <div className="admin-section-title">视频链接</div>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>视频 URL</span>
                  <textarea
                    className="admin-textarea-compact"
                    value={videoDraft.videoUrls}
                    onChange={(event) => updateVideoDraftField('videoUrls', event.target.value)}
                    rows={3}
                    placeholder="每行一个 m3u8 或 mp4 链接"
                  />
                </label>
                <label className="admin-field">
                  <span>视频标题</span>
                  <textarea
                    className="admin-textarea-compact"
                    value={videoDraft.videoTitles}
                    onChange={(event) => updateVideoDraftField('videoTitles', event.target.value)}
                    rows={3}
                    placeholder="可选，每行对应一个视频"
                  />
                </label>
              </div>

              <details className="admin-details">
                <summary>视频设置</summary>
                <div className="admin-details-body">
                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>封面 URL</span>
                      <textarea
                        className="admin-textarea-compact"
                        value={videoDraft.thumbUrls}
                        onChange={(event) => updateVideoDraftField('thumbUrls', event.target.value)}
                        rows={3}
                        placeholder="每行对应一个视频；只填一行会套用给全部"
                      />
                    </label>
                    <label className="admin-field">
                      <span>备用 URL</span>
                      <textarea
                        className="admin-textarea-compact"
                        value={videoDraft.backupUrls}
                        onChange={(event) => updateVideoDraftField('backupUrls', event.target.value)}
                        rows={3}
                        placeholder="可选，每行对应一个视频"
                      />
                    </label>
                  </div>

                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>视频 ID</span>
                      <textarea
                        className="admin-textarea-compact"
                        value={videoDraft.videoIds}
                        onChange={(event) => updateVideoDraftField('videoIds', event.target.value)}
                        rows={3}
                        placeholder="可选，每行一个；留空自动生成"
                      />
                    </label>
                    <label className="admin-field">
                      <span>起始排序</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={videoDraft.startSortOrder}
                        onChange={(event) => updateVideoDraftField('startSortOrder', event.target.value)}
                        placeholder="留空自动追加"
                      />
                    </label>
                  </div>
                </div>
              </details>
            </section>

            {videoPublishResult?.manifestTarget && (
              <div className="admin-result">
                <span>视频清单</span>
                <a href={videoPublishResult.manifestTarget.url} target="_blank" rel="noreferrer">
                  {videoPublishResult.manifestTarget.key || '查看 video-index.json'}
                </a>
              </div>
            )}

            <div className="admin-actions">
              <button
                type="submit"
                className="admin-btn primary"
                disabled={isVideoSaving || !videoApiConfigured}
              >
                <UploadCloud size={17} />
                {isVideoSaving ? '发布中...' : '发布视频'}
              </button>
            </div>
          </form>
        )}

        {activePanel === ADMIN_PANEL_DOWNLOAD && (
          <form className="admin-form" onSubmit={handlePublishDownload}>
            <section className="admin-section">
              <div className="admin-section-title">目标位置</div>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>选择栏目</span>
                  <select
                    value={downloadSections.some((section) => section.title === downloadDraft.sectionTitle) ? downloadDraft.sectionTitle : ''}
                    onChange={(event) => handleDownloadSectionSelect(event.target.value)}
                  >
                    <option value="">新建栏目</option>
                    {downloadSections.map((section) => (
                      <option key={section.title} value={section.title}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span>选择分组</span>
                  <select
                    value={downloadGroups.some((group) => group.title === downloadDraft.groupTitle) ? downloadDraft.groupTitle : ''}
                    onChange={(event) => handleDownloadGroupSelect(event.target.value)}
                  >
                    <option value="">新建分组</option>
                    {downloadGroups.map((group) => (
                      <option key={group.title} value={group.title}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-grid">
                <label className="admin-field">
                  <span>栏目标题</span>
                  <input
                    value={downloadDraft.sectionTitle}
                    onChange={(event) => updateDownloadDraftField('sectionTitle', event.target.value)}
                    placeholder="例如 叁缺壹吉隆坡站"
                  />
                </label>
                <label className="admin-field">
                  <span>分组标题</span>
                  <input
                    value={downloadDraft.groupTitle}
                    onChange={(event) => updateDownloadDraftField('groupTitle', event.target.value)}
                    placeholder="例如 11月11日现场"
                  />
                </label>
              </div>

              <details className="admin-details">
                <summary>排序设置（可选）</summary>
                <div className="admin-details-body">
                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>栏目排序</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={downloadDraft.sectionSortOrder}
                        onChange={(event) => updateDownloadDraftField('sectionSortOrder', event.target.value)}
                        placeholder="留空自动追加"
                      />
                    </label>
                    <label className="admin-field">
                      <span>分组排序</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={downloadDraft.groupSortOrder}
                        onChange={(event) => updateDownloadDraftField('groupSortOrder', event.target.value)}
                        placeholder="留空自动追加"
                      />
                    </label>
                  </div>
                </div>
              </details>
            </section>

            <section className="admin-section">
              <div className="admin-section-title">下载链接</div>
              <label className="admin-field">
                <span>显示标题</span>
                <textarea
                  className="admin-textarea-compact"
                  value={downloadDraft.itemTitles}
                  onChange={(event) => updateDownloadDraftField('itemTitles', event.target.value)}
                  rows={3}
                  placeholder="可选，每行对应一个链接；留空用文件名"
                />
              </label>

              <label className="admin-field">
                <span>下载 URL</span>
                <textarea
                  className="admin-textarea-primary"
                  value={downloadDraft.itemUrls}
                  onChange={(event) => updateDownloadDraftField('itemUrls', event.target.value)}
                  rows={4}
                  placeholder="每行一个下载链接"
                />
              </label>

              <details className="admin-details">
                <summary>文件名与预览（可选）</summary>
                <div className="admin-details-body">
                  <div className="admin-grid">
                    <label className="admin-field">
                      <span>下载文件名</span>
                      <textarea
                        className="admin-textarea-compact"
                        value={downloadDraft.filenames}
                        onChange={(event) => updateDownloadDraftField('filenames', event.target.value)}
                        rows={3}
                        placeholder="可选，留空用链接里的文件名"
                      />
                    </label>
                    <label className="admin-field">
                      <span>预览 URL</span>
                      <textarea
                        className="admin-textarea-compact"
                        value={downloadDraft.previewUrls}
                        onChange={(event) => updateDownloadDraftField('previewUrls', event.target.value)}
                        rows={3}
                        placeholder="可选，文档预览链接；每行对应一个下载"
                      />
                    </label>
                  </div>

                  <label className="admin-field">
                    <span>起始排序</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={downloadDraft.startSortOrder}
                      onChange={(event) => updateDownloadDraftField('startSortOrder', event.target.value)}
                      placeholder="留空自动追加"
                    />
                  </label>
                </div>
              </details>
            </section>

            {downloadPublishResult?.manifestTarget && (
              <div className="admin-result">
                <span>下载清单</span>
                <a href={downloadPublishResult.manifestTarget.url} target="_blank" rel="noreferrer">
                  {downloadPublishResult.manifestTarget.key || '查看 download-index.json'}
                </a>
              </div>
            )}

            <div className="admin-actions">
              <button
                type="submit"
                className="admin-btn primary"
                disabled={isDownloadSaving || !downloadApiConfigured}
              >
                <UploadCloud size={17} />
                {isDownloadSaving ? '发布中...' : '发布下载'}
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
