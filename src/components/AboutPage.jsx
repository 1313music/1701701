import React, { useState, useEffect, useRef } from 'react';
import '../styles/about.css';
import { copyTextToClipboard } from '../utils/appDomUtils.js';
import { SHOW_RESOURCES_PAGE } from '../utils/featureFlags.js';
import ExternalJumpDialog from './ExternalJumpDialog.jsx';

const officialCd = {
    href: 'https://tower.jp/search/item/%E6%9D%8E%E5%BF%97'
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
    const [copyFeedback, setCopyFeedback] = useState({ name: '', status: 'idle' });
    const copyFeedbackTimerRef = useRef(null);

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
            <p className="about-v3-purchase-note">
                <span>支持正版：</span>
                <button
                    type="button"
                    className="about-v3-purchase-link"
                    onClick={() => setIsJumpOpen(true)}
                >
                    官方专辑购买渠道
                </button>
            </p>
            <p className="about-v3-related-note">
                <span>相关资料：</span>
                <span className="about-v3-related-links">
                    {SHOW_RESOURCES_PAGE && (
                        <>
                            <a className="about-v3-related-link" href="/resources">文档</a>
                            <span className="about-v3-related-separator" aria-hidden="true">/</span>
                        </>
                    )}
                    <a className="about-v3-related-link" href="/archive">旧官网档案馆</a>
                </span>
            </p>
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
        <ExternalJumpDialog
            isOpen={isJumpOpen}
            href={officialCd.href}
            host="tower.jp"
            onClose={() => setIsJumpOpen(false)}
        />
    </div>
    );
};

export default AboutPage;
