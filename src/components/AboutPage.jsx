import React, { useState, useEffect } from 'react';

const followItems = [
    {
        title: 'SongSharing',
        subtitle: '一键上传·网易云盘',
        image: 'https://r2.1701701.xyz/img/xcx.jpg'
    },
    {
        title: '民谣俱乐部',
        subtitle: '获取最新资讯',
        image: 'https://r2.1701701.xyz/img/gzh.jpg'
    },
];

const officialCd = {
    title: '官方专辑',
    subtitle: '购买正版',
    image: 'https://p1.music.126.net/e6J7eFqsAwVFFuctHbXEgg==/109951167945120210.jpg',
    href: 'https://tower.jp/search/item/%E6%9D%8E%E5%BF%97'
};

const AboutPage = () => {
    const [isJumpOpen, setIsJumpOpen] = useState(false);

    useEffect(() => {
        if (!isJumpOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isJumpOpen]);

    const handleConfirmJump = () => {
        window.open(officialCd.href, '_blank', 'noopener,noreferrer');
        setIsJumpOpen(false);
    };

    return (
    <div className="about-page about-v3">
        <section className="about-v3-hero">
            <div className="about-v3-image">
                <img loading="lazy" src="https://r2.1701701.xyz/img/aboutbg.jpg" alt="李志" />
                <div className="about-v3-overlay">
                    <p>一个分享李志音乐&视频的网站 | 1701701.xyz</p>
                </div>
            </div>
        </section>

        <section className="about-v3-copy">
            <p>李志，独立音乐人。偶像派歌手。</p>
            <p>本站收录了李志先生的音乐作品，纪录片《我们的叁叁肆》、《逼哥夜话》系列以及跨年演唱会、巡演、音乐节等现场视频。</p>
            <p>所有资源来源于互联网，版权属于李志先生。仅限个人学习、研究、欣赏之用，完全免费，禁止用于商业目的。</p>
        </section>

        <section className="about-v3-section">
            <div className="about-v3-grid about-v3-grid-2">
                <button
                    type="button"
                    className="about-v3-card about-v3-card--cta"
                    onClick={() => setIsJumpOpen(true)}
                >
                    <div className="about-v3-card-media">
                        <img loading="lazy" src={officialCd.image} alt={officialCd.title} />
                    </div>
                    <div className="about-v3-card-body">
                        <h3>{officialCd.title}</h3>
                        <span>购买正版</span>
                    </div>
                </button>
                {followItems.map((item) => (
                    <div className="about-v3-card" key={item.title}>
                        <div className="about-v3-card-media">
                            <img loading="lazy" src={item.image} alt={item.title} />
                        </div>
                        <div className="about-v3-card-body">
                            <h3>{item.title}</h3>
                            <span>{item.subtitle}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
        {isJumpOpen && (
            <div className="about-jump-modal" onClick={() => setIsJumpOpen(false)}>
                <div className="about-jump-card" onClick={(event) => event.stopPropagation()}>
                    <h3>即将前往 tower.jp</h3>
                    <p>该站点在国内网络可能无法正常访问，建议使用科学上网。是否继续？</p>
                    <div className="about-jump-actions">
                        <button
                            type="button"
                            className="about-jump-btn ghost"
                            onClick={() => setIsJumpOpen(false)}
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            className="about-jump-btn"
                            onClick={handleConfirmJump}
                        >
                            确认跳转
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
    );
};

export default AboutPage;
