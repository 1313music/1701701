/**
 * 音乐资源配置文件
 * 请将您的 Cloudflare R2 资源链接填入下方
 */
export const musicResources = [
    {
        id: 1,
        title: "示例歌曲 1",
        artist: "R2 艺术家",
        album: "演示专辑",
        cover: "https://picsum.photos/seed/music1/200/200",
        url: "https://your-r2-public-url.com/song1.mp3", // 替换为您的 R2 公网链接
    },
    {
        id: 2,
        title: "示例歌曲 2",
        artist: "R2 艺术家",
        album: "演示专辑",
        cover: "https://picsum.photos/seed/music2/200/200",
        url: "https://your-r2-public-url.com/song2.mp3", // 替换为您的 R2 公网链接
    }
];

export const siteConfig = {
    title: "1701701.xyz",
    description: "由 Cloudflare R2 & Pages 驱动",
    theme: "light" // 'light' or 'dark'
};
