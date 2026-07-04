import React from 'react';
import { ThumbsUp } from 'lucide-react';
import '../styles/support.css';

const supportOptions = [
    {
        title: '请喝杯冰啤酒',
        icon: '🍺',
        label: '微信赞赏码',
        description: [
            '金额自由，全凭心意。',
            '不用留言，感谢支持。'
        ],
        action: '微信赞赏',
        alt: '微信赞赏码',
        image: 'https://p1.music.126.net/ifGbpzmPVmB_S5ikLD9GZA==/109951173466867867.jpg'
    },
    {
        title: '免费点个赞',
        icon: '👍',
        label: '免费支持',
        description: [
            '顺手帮忙看个短视频广告。',
            '无需花费金钱，同样是很大的支持。'
        ],
        action: '观看广告',
        alt: '免费支持二维码',
        image: 'https://p1.music.126.net/2okpfR3EE8OJdP9MKcwuVg==/109951173468389389.jpg'
    }
];

const supportNotes = [
    '独立维护',
    '完全免费',
    '随缘支持'
];

const SupportPage = () => (
    <div className="support-page">
        <section className="support-shell" aria-labelledby="support-title">
            <header className="support-intro">
                <div className="support-kicker">
                    <ThumbsUp size={18} strokeWidth={2.5} absoluteStrokeWidth />
                    <span>支持本站</span>
                </div>
                <h1 id="support-title">支持 1701701.xyz</h1>
                <p>
                    本站内容完全免费开放。如果你刚好心情不错，欢迎顺手请站长喝杯饮料。
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
                            <span className="support-qr-label">{option.label}</span>
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
