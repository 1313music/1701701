import React from 'react';
import { Share2, ThumbsUp } from 'lucide-react';
import '../styles/support.css';
// 支持页没有用 PageHeader 组件（要保持居中布局），但复用了它的 .page-hero-share 按钮样式。
// page-hero.css 只被 PageHeader.jsx 引入，而页面是懒加载的 —— 不在这里显式引入的话，
// 直接打开 /support（或刷新）时这个按钮会丢掉 36×36 热区、hover 变色和指针样式。
import '../styles/page-hero.css';

const supportOptions = [
    {
        title: '赞赏支持',
        icon: '🍺',
        description: [
            '金额自由，全凭心意。',
            '静默相伴，已是共鸣。'
        ],
        action: '微信赞赏',
        alt: '微信赞赏码',
        image: 'https://p1.music.126.net/ifGbpzmPVmB_S5ikLD9GZA==/109951173466867867.jpg'
    },
    {
        title: '免费支持',
        icon: '⚡️',
        description: [
            '顺手消耗一波广告商的预算。',
            '不花一分钱，也能让服务器电力满满。'
        ],
        action: '观看广告',
        alt: '免费支持二维码',
        image: 'https://p1.music.126.net/2okpfR3EE8OJdP9MKcwuVg==/109951173468389389.jpg'
    }
];

const supportNotes = [
    '因乐相逢',
    '自由分享',
    '行路有光'
];

const SupportPage = ({ onCopyPageLink }) => (
    <div className="support-page">
        <section className="support-shell" aria-labelledby="support-title">
            <header className="support-intro">
                {typeof onCopyPageLink === 'function' && (
                    <button
                        type="button"
                        className="page-hero-share support-share"
                        onClick={(event) => onCopyPageLink({ anchorEvent: { currentTarget: event.currentTarget } })}
                        aria-label="分享支持页"
                        title="分享支持页"
                    >
                        <Share2 size={18} strokeWidth={2.2} absoluteStrokeWidth />
                    </button>
                )}
                <div className="support-kicker">
                    <ThumbsUp size={16} strokeWidth={2.5} absoluteStrokeWidth />
                    <span>支持本站</span>
                </div>
                <h1 id="support-title">1701701.xyz</h1>
                <p>
                    一方音乐自留地 · 你的每一次停留，皆是动力。
                </p>
                <ul className="support-notes">
                    {supportNotes.map((note) => (
                        <li key={note}>{note}</li>
                    ))}
                </ul>
            </header>
            <div className="support-qr-list" aria-label="支持方式">
                {supportOptions.map((option) => (
                    <div className="support-qr" key={option.title}>
                        <div className="support-card-head">
                            <h2>
                                <span>{option.title}</span>
                                <span className="support-title-emoji" aria-hidden="true">{option.icon}</span>
                            </h2>
                        </div>
                        <div className="support-qr-frame">
                            <img src={option.image} alt={option.alt} />
                        </div>
                        <div className="support-qr-copy">
                            <p className="support-qr-description">
                                {option.description.map((line) => (
                                    <span key={line}>{line}</span>
                                ))}
                            </p>
                            <span className="support-qr-action">{option.action}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    </div>
);

export default SupportPage;
