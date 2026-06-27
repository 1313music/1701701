import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/about.css';
import { copyTextToClipboard } from '../utils/appDomUtils.js';

const officialCd = {
    title: '官方专辑',
    subtitle: '购买正版',
    image: 'https://p1.music.126.net/e6J7eFqsAwVFFuctHbXEgg==/109951167945120210.jpg',
    href: 'https://tower.jp/search/item/%E6%9D%8E%E5%BF%97'
};

const supportQr = {
    title: '支持本站',
    subtitle: '扫码支持',
    image: 'https://p1.music.126.net/2okpfR3EE8OJdP9MKcwuVg==/109951173468389389.jpg'
};

const officialAccounts = [
    {
        title: '共享云音乐',
        image: 'https://p1.music.126.net/DS_fxjI4TFZymft2hcnhKA==/109951173460969360.jpg'
    },
    {
        title: '民谣俱乐部',
        image: 'https://p1.music.126.net/tDzmXS4sGZDEJx4HKLqPww==/109951173460972219.jpg'
    }
];

const AboutPage = () => {
    const [isJumpOpen, setIsJumpOpen] = useState(false);
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [copyFeedback, setCopyFeedback] = useState({ name: '', status: 'idle' });
    const copyFeedbackTimerRef = useRef(null);
    const isModalOpen = isJumpOpen || isQrOpen;
    const portalRoot = typeof document === 'undefined' ? null : document.body;

    useEffect(() => {
        if (!isModalOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isModalOpen]);

    const handleConfirmJump = () => {
        window.open(officialCd.href, '_blank', 'noopener,noreferrer');
        setIsJumpOpen(false);
    };

    useEffect(() => () => {
        if (copyFeedbackTimerRef.current) {
            clearTimeout(copyFeedbackTimerRef.current);
        }
    }, []);

    const getCopyNameButtonText = (name) => {
        if (copyFeedback.name !== name) return '复制名称';
        if (copyFeedback.status === 'success') return '已复制';
        if (copyFeedback.status === 'error') return '复制失败';
        return '复制中';
    };

    const handleCopyAccountName = async (name) => {
        if (copyFeedbackTimerRef.current) {
            clearTimeout(copyFeedbackTimerRef.current);
        }
        setCopyFeedback({ name, status: 'pending' });
        const copied = await copyTextToClipboard(name);
        setCopyFeedback({ name, status: copied ? 'success' : 'error' });
        copyFeedbackTimerRef.current = setTimeout(() => {
            setCopyFeedback((current) => (
                current.name === name ? { name: '', status: 'idle' } : current
            ));
            copyFeedbackTimerRef.current = null;
        }, 1600);
    };

    return (
    <div className="about-page about-v3">
        <section className="about-v3-hero">
            <div className="about-v3-image">
                <img loading="lazy" src="https://p1.music.126.net/9zu8MA2HIIbkwpR5WbeiHg==/109951172851439998.jpg" alt="李志" />
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

        <section className="about-v3-archive" aria-label="旧官网档案馆">
            <a className="about-v3-archive-entry" href="/archive">
                <span>旧官网档案馆</span>
                <small>nanjinglizhi.cn 的 Wayback 存档</small>
            </a>
        </section>

        <section className="about-v3-section about-v3-official-section">
            <div className="about-v3-grid about-v3-official-grid">
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
                <div className="about-v3-card">
                    <div className="about-v3-card-media">
                        <img loading="lazy" src={supportQr.image} alt={`${supportQr.title}二维码`} />
                    </div>
                    <div className="about-v3-card-body">
                        <h3>{supportQr.title}</h3>
                        <span>{supportQr.subtitle}</span>
                    </div>
                </div>
            </div>
            <button
                type="button"
                className="about-v3-contact-entry"
                onClick={() => setIsQrOpen(true)}
            >
                <span>公众号</span>
                <small>共享云音乐 / 民谣俱乐部</small>
            </button>
        </section>

        <section className="about-v3-contact about-v3-contact-inline" aria-labelledby="about-v3-contact-title">
            <div className="about-v3-contact-head">
                <h2 id="about-v3-contact-title">公众号</h2>
                <p>⚠️ 防失联请关注公众号，最新地址与重要通知将优先发布。</p>
            </div>
            <div className="about-v3-contact-list">
                {officialAccounts.map((account) => (
                    <div className="about-v3-contact-item" key={account.title}>
                        <img
                            className="about-v3-contact-qr"
                            loading="lazy"
                            src={account.image}
                            alt={`${account.title}公众号二维码`}
                        />
                        <div className="about-v3-contact-copy">
                            <h3>{account.title}</h3>
                            <button
                                type="button"
                                className="about-v3-copy-name"
                                aria-label={`复制${account.title}名称`}
                                onClick={() => handleCopyAccountName(account.title)}
                                disabled={copyFeedback.name === account.title && copyFeedback.status === 'pending'}
                            >
                                {getCopyNameButtonText(account.title)}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </section>
        {isQrOpen && portalRoot && createPortal((
            <div className="about-qr-modal" onClick={() => setIsQrOpen(false)}>
                <div className="about-qr-card" onClick={(event) => event.stopPropagation()}>
                    <div className="about-qr-head">
                        <h3>公众号</h3>
                        <button type="button" onClick={() => setIsQrOpen(false)}>关闭</button>
                    </div>
                    <div className="about-qr-list">
                        {officialAccounts.map((account) => (
                            <div className="about-qr-item" key={account.title}>
                                <img loading="lazy" src={account.image} alt={`${account.title}公众号二维码`} />
                                <div>
                                    <h4>{account.title}</h4>
                                    <button
                                        type="button"
                                        className="about-v3-copy-name"
                                        aria-label={`复制${account.title}名称`}
                                        onClick={() => handleCopyAccountName(account.title)}
                                        disabled={copyFeedback.name === account.title && copyFeedback.status === 'pending'}
                                    >
                                        {getCopyNameButtonText(account.title)}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ), portalRoot)}
        {isJumpOpen && portalRoot && createPortal((
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
        ), portalRoot)}
    </div>
    );
};

export default AboutPage;
