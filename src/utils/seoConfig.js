import { SHOW_DOWNLOAD_PAGE, SHOW_RESOURCES_PAGE } from './featureFlags.js';

export const SITE_URL = 'https://1701701.xyz';
export const SITE_NAME = '1701701.xyz';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`;

export const SEO_VIEW_PATHS = Object.freeze({
  library: '/',
  video: '/video/',
  resources: '/resources/',
  archive: '/archive/',
  download: '/download/',
  gallery: '/gallery/',
  app: '/app/',
  support: '/support/',
  about: '/about/'
});

export const PUBLIC_SEO_VIEWS = Object.freeze([
  'library',
  'video',
  'resources',
  'archive',
  'download',
  'gallery',
  'app',
  'support',
  'about'
].filter((view) => (
  (view !== 'download' || SHOW_DOWNLOAD_PAGE)
  && (view !== 'resources' || SHOW_RESOURCES_PAGE)
)));

export const LI_ZHI_ENTITY_LINKS = Object.freeze([
  'https://musicbrainz.org/artist/e54bc357-19aa-4e1f-9795-3346e486d5db',
  'https://en.wikipedia.org/wiki/Li_Zhi_(singer)'
]);

export const RESEARCHED_KEY_RELEASES = Object.freeze([
  { name: '被禁忌的游戏', year: '2004' },
  { name: '梵高先生', year: '2005' },
  { name: '这个世界会好吗', year: '2006' },
  { name: '我爱南京', year: '2009' },
  { name: '你好，郑州', year: '2010' },
  { name: 'F', year: '2011' },
  { name: '1701', year: '2014' },
  { name: '8', year: '2016' },
  { name: '在每一条伤心的应天大街上', year: '2016' },
  { name: '看见', year: '2020' }
]);

const KL_EVENT_DATES = Object.freeze([
  '2025-11-11T20:30:00+08:00',
  '2025-11-12T20:30:00+08:00',
  '2025-11-13T20:30:00+08:00'
]);

const KL_EVENT_URL = 'https://idealivearena.com/event/three-missing-one/';

export const SEO_MAP = Object.freeze({
  library: {
    title: '李志音乐 | 1701701.xyz',
    heading: '李志音乐与现场资料',
    description: '收录李志代表作与现场内容，包含《被禁忌的游戏》《梵高先生》《1701》及叁缺壹吉隆坡站等，支持歌词查看、播放列表与收藏管理。',
    pageType: 'CollectionPage',
    keywords: [
      '李志',
      '李志音乐',
      '李志专辑',
      '李志现场',
      '李志1701',
      '李志8',
      '334计划',
      '我们的叁叁肆',
      '叁缺壹吉隆坡站',
      '叁缺壹东京站',
      'Three Missing One',
      'IDEA LIVE ARENA',
      '被禁忌的游戏',
      '梵高先生',
      '这个世界会好吗',
      '我爱南京',
      '你好郑州',
      '在每一条伤心的应天大街上'
    ]
  },
  video: {
    title: '李志现场视频与纪录片 | 1701701.xyz',
    heading: '李志现场视频与纪录片',
    description: '整理李志相关现场视频、纪录片与演出影像，覆盖“我们的叁叁肆”、叁叁肆计划巡演、跨年与采访内容。',
    pageType: 'VideoGallery',
    keywords: [
      '李志视频',
      '李志纪录片',
      '我们的叁叁肆',
      '334计划',
      '334城巡演',
      '李志巡演',
      '李志跨年',
      '叁缺壹现场',
      '叁缺壹吉隆坡站'
    ]
  },
  resources: {
    title: '李志文档 | 1701701.xyz',
    heading: '李志文档',
    description: '整理李志相关文字、吉他谱、PDF 文档与可预览资源，方便集中浏览与下载。',
    pageType: 'CollectionPage',
    keywords: [
      '李志文档',
      '李志资料',
      '李志自传',
      '李志吉他谱',
      '李志乐谱',
      '李志 PDF',
      '李志文章'
    ]
  },
  archive: {
    title: '李志旧官网档案馆 | 1701701.xyz',
    heading: '李志旧官网档案馆',
    description: '整理 nanjinglizhi.cn 的李志旧官网代表版本，按时间线浏览 2013 至 2019 年的网页快照。',
    pageType: 'CollectionPage',
    keywords: [
      '李志官网',
      '李志旧官网',
      'nanjinglizhi.cn',
      '李志档案',
      '李志资料',
      '网页存档'
    ]
  },
  download: {
    title: '李志音乐资源下载 | 1701701.xyz',
    heading: '李志音乐资源下载',
    description: '提供李志相关资源下载入口与内容汇总，覆盖叁缺壹吉隆坡站、东京站以及代表专辑相关资源。',
    pageType: 'CollectionPage',
    keywords: [
      '李志下载',
      '李志资源',
      '叁缺壹吉隆坡站下载',
      '叁缺壹东京站下载',
      '李志现场音频',
      '李志1701下载',
      '李志梵高先生'
    ]
  },
  gallery: {
    title: '图库 | 1701701.xyz',
    heading: '图库',
    description: '前端图库展示页，默认读取图片索引并以瀑布流展示已发布图片。',
    pageType: 'CollectionPage',
    keywords: ['图库', '图片瀑布流', '图片索引', '图床展示']
  },
  app: {
    title: 'APP 下载 | 1701701.xyz',
    heading: '1701701 APP 下载',
    description: '下载 1701701 的 macOS、Windows 与 Android 客户端，并查看 iOS 添加到主屏幕使用教程。',
    pageType: 'CollectionPage',
    keywords: [
      '1701701 app',
      '1701701 mac',
      '1701701 windows',
      '1701701 android',
      '1701701 apk',
      'iOS PWA',
      '添加到主屏幕'
    ]
  },
  support: {
    title: '支持本站 | 1701701.xyz',
    heading: '支持 1701701.xyz',
    description: '1701701.xyz 的支持入口，本站内容完全免费开放，可以通过微信赞赏或观看广告随缘支持。',
    pageType: 'AboutPage',
    keywords: ['支持本站', '1701701.xyz', '李志音乐站']
  },
  about: {
    title: '关于本站 | 1701701.xyz',
    heading: '关于 1701701.xyz',
    description: '了解本站的内容范围、资源说明与使用说明。',
    pageType: 'AboutPage',
    keywords: ['1701701.xyz', '李志音乐站', '李志资料整理']
  }
});

export const getSeoPathForView = (view) => SEO_VIEW_PATHS[view] || SEO_VIEW_PATHS.library;

export const getCanonicalUrlForView = (view) => new URL(getSeoPathForView(view), SITE_URL).toString();

export const getSeoConfigForView = (view) => SEO_MAP[view] || SEO_MAP.library;

export const isPublicSeoView = (view) => PUBLIC_SEO_VIEWS.includes(view);

export const getSeoRobotsContent = (view) => (
  isPublicSeoView(view) ? 'index,follow,max-image-preview:large' : 'noindex,follow'
);

const getNavigationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: `${SITE_NAME} 站内导航`,
  itemListElement: PUBLIC_SEO_VIEWS.map((view, index) => {
    const seo = getSeoConfigForView(view);
    return {
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SiteNavigationElement',
        name: seo.heading || seo.title,
        url: getCanonicalUrlForView(view)
      }
    };
  })
});

const getBreadcrumbJsonLd = ({ view, currentSeo, canonicalUrl }) => {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: '首页',
      item: SITE_URL
    }
  ];

  if (view !== 'library') {
    items.push({
      '@type': 'ListItem',
      position: 2,
      name: currentSeo.heading || currentSeo.title,
      item: canonicalUrl
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items
  };
};

export const buildSeoJsonLdPayload = ({
  view,
  currentSeo = getSeoConfigForView(view),
  canonicalUrl = getCanonicalUrlForView(view),
  musicAlbums
}) => {
  const researchedReleaseNames = RESEARCHED_KEY_RELEASES.map((item) => item.name);
  const releaseYearMap = new Map(
    RESEARCHED_KEY_RELEASES.map((item) => [item.name, item.year])
  );
  const albumListForSeo = Array.isArray(musicAlbums)
    ? musicAlbums.filter((album) => album?.name).slice(0, 30)
    : [];

  const payload = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: 'zh-CN',
      description: '一个分享李志音乐与视频的网站',
      about: {
        '@type': 'Person',
        name: '李志'
      },
      keywords: ['李志音乐', '李志现场视频', '叁缺壹吉隆坡站', '1701701.xyz'],
      hasPart: PUBLIC_SEO_VIEWS.map((seoView) => ({
        '@type': 'WebPage',
        name: getSeoConfigForView(seoView).heading,
        url: getCanonicalUrlForView(seoView)
      }))
    },
    {
      '@context': 'https://schema.org',
      '@type': currentSeo.pageType,
      name: currentSeo.title,
      url: canonicalUrl,
      inLanguage: 'zh-CN',
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL
      },
      about: {
        '@type': 'Person',
        name: '李志'
      },
      description: currentSeo.description,
      keywords: currentSeo.keywords,
      mentions: researchedReleaseNames.slice(0, 8).map((name) => ({
        '@type': 'MusicAlbum',
        name,
        byArtist: {
          '@type': 'MusicGroup',
          name: '李志'
        }
      }))
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: '李志',
      birthDate: '1978-11-13',
      birthPlace: {
        '@type': 'Place',
        name: '江苏金坛'
      },
      jobTitle: 'Singer-Songwriter',
      genre: ['contemporary folk', 'singer-songwriter'],
      description: '民谣音乐人，代表作包括《梵高先生》《这个世界会好吗》《1701》等。',
      sameAs: LI_ZHI_ENTITY_LINKS,
      knowsAbout: ['李志音乐', 'contemporary folk', 'singer-songwriter', ...researchedReleaseNames.slice(0, 6)]
    },
    {
      '@context': 'https://schema.org',
      '@type': 'MusicEvent',
      name: '叁缺壹·吉隆坡站',
      startDate: KL_EVENT_DATES[0],
      endDate: KL_EVENT_DATES[2],
      eventStatus: 'https://schema.org/EventCompleted',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: 'IDEA LIVE ARENA',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Petaling Jaya',
          addressCountry: 'MY'
        }
      },
      performer: {
        '@type': 'Person',
        name: '李志'
      },
      offers: {
        '@type': 'Offer',
        availabilityStarts: '2025-08-26T12:30:00+08:00',
        url: KL_EVENT_URL
      },
      description: '2025年11月11日至11月13日，叁缺壹吉隆坡站在 IDEA LIVE ARENA 演出（官方开售时间为 2025-08-26）。',
      subEvent: KL_EVENT_DATES.map((startDate, index) => ({
        '@type': 'MusicEvent',
        name: `叁缺壹·吉隆坡站 第${index + 1}场`,
        startDate,
        eventStatus: 'https://schema.org/EventCompleted',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: 'IDEA LIVE ARENA'
        },
        performer: {
          '@type': 'Person',
          name: '李志'
        }
      })),
      url: KL_EVENT_URL
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CreativeWorkSeries',
      name: '我们的叁叁肆',
      description: '围绕叁叁肆计划巡演的影像记录内容。',
      keywords: ['我们的叁叁肆', '叁叁肆计划', '334城巡演'],
      about: {
        '@type': 'Person',
        name: '李志'
      }
    },
    getNavigationJsonLd(),
    getBreadcrumbJsonLd({ view, currentSeo, canonicalUrl })
  ];

  if (view === 'library' && albumListForSeo.length > 0) {
    payload.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: '李志音乐专辑列表',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: albumListForSeo.length,
      itemListElement: albumListForSeo.map((album, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'MusicAlbum',
          '@id': `${canonicalUrl}#album-${encodeURIComponent(String(album.id || index + 1))}`,
          name: album.name,
          byArtist: {
            '@type': 'MusicGroup',
            name: album.artist || '李志'
          },
          datePublished: releaseYearMap.get(album.name) || undefined,
          numTracks: Array.isArray(album.songs) ? album.songs.length : undefined,
          image: album.cover || undefined,
          url: canonicalUrl
        }
      }))
    });
  }

  return payload;
};
