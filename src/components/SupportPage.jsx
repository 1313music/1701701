import React from 'react';
import { ThumbsUp } from 'lucide-react';
import '../styles/support.css';

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

const SupportPage = () => (
    <div className="support-page">
        <section className="support-shell" aria-labelledby="support-title">
            <header className="support-intro">
                <div className="support-kicker">
                    <ThumbsUp size={22} strokeWidth={2.5} absoluteStrokeWidth />
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
