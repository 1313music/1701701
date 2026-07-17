const SOURCES = Object.freeze({
  wikipedia: Object.freeze({
    name: '维基百科',
    url: 'https://zh.wikipedia.org/wiki/%E6%9D%8E%E5%BF%97'
  }),
  officialArchive: Object.freeze({
    name: '李志官网',
    url: 'https://web.archive.org/web/20110614001659/http://www.lizhizhuangbi.com/'
  }),
  hangzhouDaily: Object.freeze({
    name: '都市快报',
    url: 'https://hznews.hangzhou.com.cn/wenti/content/2015-08/07/content_5875318.htm'
  }),
  hongKong01: Object.freeze({
    name: '香港01',
    url: 'https://www.hk01.com/article/277285/2019-%E6%AD%A3%E5%BC%8F%E9%96%8B%E5%B9%B4-%E4%BB%8A%E5%80%8B%E4%B8%80%E6%9C%88%E6%9C%89%E4%B9%9C-show'
  }),
  legacyTaipei: Object.freeze({
    name: 'Legacy Taipei',
    url: 'https://www.legacy.com.tw/article/page/taipei/988'
  }),
  trackMetadata: Object.freeze({
    name: '曲目文件信息',
    url: ''
  })
});

const createProfile = ({ releaseDate = '', description = '', source }) => Object.freeze({
  releaseDate,
  description,
  sourceName: source?.name || '',
  sourceUrl: source?.url || ''
});

const wikipediaProfile = (releaseDate, description = '') => createProfile({
  releaseDate,
  description,
  source: SOURCES.wikipedia
});

const wikipediaVerbatimProfile = (releaseDate, description = '') => createProfile({
  releaseDate,
  description,
  source: SOURCES.wikipedia
});

const ALBUM_PROFILES = Object.freeze({
  'san-que-yi-kl': wikipediaProfile(
    '',
    '2025年 11月11日至13日，李志携全新编制的乐队及新编曲目，在马来西亚吉隆坡连续举办了三场演出。'
  ),
  'tokyo-live': wikipediaProfile(
    '2025-06-13',
    '来自2024年5月2日“叁缺壹 (Three Missing One) JAPAN Tour 2024”巡回演唱会东京站。\n此专辑于2025年6月13日起以CD和12寸LP的形式推出，仅在日本限定发行。'
  ),
  'forbidden-games': wikipediaVerbatimProfile(
    '2005-12-01',
    '李志的个人第一张专辑，2004年10月至12月于南京录制。\n《红色气球》是李志创作并录制成型的第一首歌。\n专辑发行时并未使用李志的名字，而是署了李志当时的网名B&B。\n后由“口袋唱片”购买并发行成为如今的《被禁忌的游戏》。'
  ),
  'van-gogh': createProfile({
    releaseDate: '2005-12-25',
    description: '2004年—2006年 制作三张low-fi个人专辑。前两张由口袋唱片以《被禁忌的游戏》《梵高先生》发行，第三张《这个世界会好吗》没有再版。',
    source: SOURCES.officialArchive
  }),
  'will-the-world': wikipediaVerbatimProfile(
    '2006-11-20',
    'CD一张，2006年9月份开始录制，11月完工的音乐。'
  ),
  'i-love-nanjing': createProfile({
    releaseDate: '2009-10-16',
    description: '2009年9月完成；第四张专辑；10月16日在南京举行首发演出；随后进行“动物凶猛”巡演34场，历时70天。',
    source: SOURCES.officialArchive
  }),
  'hello-zhengzhou': createProfile({
    releaseDate: '2010-09-01',
    description: '2010年9月 完成第五张专辑《你好，郑州》，同时官方网站正式上线，提供全部视频音频资料的下载。',
    source: SOURCES.officialArchive
  }),
  f: wikipediaVerbatimProfile(
    '2011-09-28（数字） / 2014-05-22（实体）',
    '李志第一次尝试无实体唱片，2011年首次发行时只发行了网络数字版。\n专辑上市时在李志官网开放下载链接，并采用“先下载后自由付费”的方式。\n2014年与京东联合出版发行实体唱片。'
  ),
  '1701': wikipediaVerbatimProfile(
    '2014-05-22',
    '专辑名取自好友的排练房房号\n李志第七张录音室创作专辑'
  ),
  '8': wikipediaVerbatimProfile(
    '2016-10-18',
    '李志：“我一直想翻唱儿歌，去年和乐队录了这几首。\n做好之后大家觉得太难听，可能小孩子不喜欢，于是一直就没公开。\n几天前我的一个好朋友五十岁得子，没什么拿得出手的礼物，想来想去就送它吧，一点儿心意。”\n公益专辑，免费试听下载。'
  ),
  'yingti-dajie': wikipediaVerbatimProfile(
    '2016-11-20',
    '录音室专辑，2016年11月20日发行，共8首歌曲。\n少量发行实体版'
  ),
  'gongti-east-road': wikipediaProfile(
    '2009-01-22',
    '来自 2009年1月11日北京愚公移山 “李志单刀赴会个人弹唱专场”\n通过网络发行免费下载'
  ),
  '2009-1016': wikipediaProfile(
    '2010-01-30',
    '来自 2009年10月16日李志《我爱南京》专辑 南京首发现场实录\n双CD+双DVD，制作100张限量赠送。'
  ),
  imagine: wikipediaProfile(
    '2012',
    '来自 2011-2012 “IMAGINE” 跨年音乐会\n双CD+双DVD'
  ),
  '108-keywords': wikipediaProfile(
    '2013',
    '来自 2012-2013 “108个关键词/李志的自我修养2012年度汇报演出” 跨年音乐会\n双CD+双DVD'
  ),
  gousanda: wikipediaProfile(
    '2014-04-01',
    '来自 2013-2014 “勾三搭四” 跨年音乐会\n双CD'
  ),
  io: wikipediaProfile(
    '2015-01-21',
    '来自 2014-2015 “i/O” 跨年音乐会\n开始仅通过网络发行'
  ),
  see: wikipediaProfile(
    '2015-06-27',
    '来自 2015年6月27日 “看见” 巡回演唱会北京站\n其中《梵高先生》来自玩偶之主录音棚，并非巡演曲目。'
  ),
  movement: wikipediaProfile(
    '2016-03-14',
    '来自 2015-2016 “动静” 跨年音乐会'
  ),
  'beijing-unplugged': wikipediaProfile(
    '2016-08-11',
    '来自 2016年5月29日 “北京‘降噪’Ⅳ摇滚·民谣系列音乐会” 李志专场'
  ),
  'electric-orchestra': wikipediaProfile(
    '2017-05-16',
    '来自 2016-2017 “家” 跨年音乐会，管弦乐章节与 靳海音管弦乐团 共同演绎。\n少量发行实体版'
  ),
  'jazz-unplugged': wikipediaProfile(
    '2018-04-16',
    '来自 2017-2018 “相信未来” 跨年音乐会\n不插电章节与南京青年乐手合作，爵士乐章节则与 JZ Music爵士上海 合作。\n少量发行实体版。'
  ),
  'electric-orchestra-2': wikipediaProfile(
    '2018-05-16',
    '来自 2017-2018 “相信未来” 跨年音乐会，管弦乐章节再次与 靳海音管弦乐团 合作。\n少量发行实体版。'
  ),
  'wash-heart': wikipediaProfile(
    '',
    '2018-2019　洗心革面　欧拉艺术空间（邀请制）'
  ),
  volume1: wikipediaProfile(
    '2019-04-01（CD） / 2019-04-13（LP）',
    '李志的第一张精选辑，碟1是录音室版本，碟2是同作品的现场演出版本。\n专辑汇集了李志从2004年出道开始，于14年间发表的所有专辑中最精选的10首代表曲目。\n此专辑于2019年4月1日以CD的形式推出，并于2019年4月28日推出第二版，于2019年11月推出第三版。\n此专辑于2019年4月13日起以12寸LP的形式推出，并于2019年7月10日推出第二版,于2021年5月推出第四版。 此专辑仅在日本限定发行。'
  ),
  volume2: wikipediaProfile(
    '2020-05-18（LP） / 2020-05-27（CD）',
    '李志的第二张精选辑，碟1是录音室版本，碟2是同作品的现场演出版本。\n其中碟2《被禁忌的游戏》现场演出版本来自 2018-2019 “洗心革面” 跨年音乐会，为 首次发行。\n此专辑于2020年5月18日以CD的形式推出。\n此专辑于2020年5月27日以12寸LP的形式推出，并于2020年6月 推出第二版。 此专辑仅在日本限定发行。'
  ),
  volume3: wikipediaProfile(
    '2021-11-12（LP） / 2021-12-24（CD）',
    '李志的第三张精选辑，碟1是录音室版本，碟2是同作品的现场演出版本。\n其中碟2《一个夜晚》和《倒影》现场演出版本来自 2018-2019 “洗心革面” 跨年音乐会，为 首次发行。\n此专辑于2021年7月以12寸LP的形式推出，并于2021年12月推出第二版。\n此专辑于2021年12月24日以CD的形式推出。 此专辑仅在日本限定发行。'
  ),
  'hangzhou-jiuqiuhui': createProfile({
    description: '民谣歌手李志今晚把“工体”搬到杭州连演两场',
    source: SOURCES.hangzhouDaily
  }),
  'yiwu-gebi-bar': wikipediaProfile(
    '',
    '动物凶猛第35站　义乌隔壁酒吧'
  ),
  'hongkong-morning': createProfile({
    description: '《香港早上好》李志巡演香港站\n1月3日 & 1月4日 九龍灣展貿 Musiczone',
    source: SOURCES.hongKong01
  }),
  'taipei-morning': createProfile({
    releaseDate: '2019-01-13',
    description: '“台北早上好”2019李志港台小巡演-台北站',
    source: SOURCES.legacyTaipei
  }),
  other: createProfile({
    description: '收录不同场合留下的现场与弹唱录音，包括“1701”演出、巡演和音乐节现场，作为嘉宾参与的演唱、微博弹唱、小酒馆演出，以及部分翻唱与即兴片段。',
    source: SOURCES.trackMetadata
  }),
  'chengdu-2020': wikipediaProfile(
    '',
    '2020年 7月21日，票务平台秀动发布了2020“叁缺壹”成都联合专场演出公告。公告列出了除李志以外的全体乐队成员，演出定于8月8日至13日在成都正火艺术中心举行——该场地正是此前“叁叁肆”计划四川巡演被迫取消的站点之一。\n最终在演出期间，李志意外登台现身，完成了这次“计划外”的公开亮相。'
  )
});

const normalizeText = (value) => String(value || '').trim();

export const formatAlbumReleaseDate = (value) => normalizeText(value).replace(
  /(\d{4})-(\d{2})-(\d{2})/g,
  '$1.$2.$3'
);

export const getAlbumProfile = (album) => {
  if (!album?.id || album.isVirtual) return null;

  const fallback = ALBUM_PROFILES[album.id] || {};
  const releaseDate = normalizeText(album.releaseDate || fallback.releaseDate);
  const description = normalizeText(album.description || fallback.description);
  const sourceName = normalizeText(album.profileSourceName || fallback.sourceName);
  const sourceUrl = normalizeText(album.profileSourceUrl || fallback.sourceUrl);

  if (!releaseDate && !description) return null;

  return Object.freeze({ releaseDate, description, sourceName, sourceUrl });
};

export const __albumProfilesForTests = ALBUM_PROFILES;
