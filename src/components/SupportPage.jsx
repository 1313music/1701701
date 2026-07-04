import React from 'react';
import { ThumbsUp } from 'lucide-react';
import '../styles/support.css';

const supportOptions = [
    {
        title: '请站长喝杯冰啤酒',
        icon: '🍺',
        label: '随心请客',
        description: [
            '吨吨吨！',
            '碰个杯，全凭缘分和心情。',
            '顺手给站长满上一罐冰啤酒，快乐加倍。'
        ],
        action: '扫码碰个杯',
        alt: '微信赞赏码',
        image: 'https://p1.music.126.net/ifGbpzmPVmB_S5ikLD9GZA==/109951173466867867.jpg'
    },
    {
        title: '让广告商来买单',
        icon: '🍾',
        label: '免费支持',
        description: [
            '薅羊毛！',
            '动动手指戳一下看个短片。',
            '让广告商替你把这杯酒钱付了，双赢。'
        ],
        action: '扫码薅羊毛',
        alt: '免费支持二维码',
        image: 'https://p1.music.126.net/2okpfR3EE8OJdP9MKcwuVg==/109951173468389389.jpg'
    }
];

const supportNotes = [
    '全场免单',
    '随缘碰杯',
    '开心就好'
];

const SupportPage = () => (
    <div className="support-page">
        <section className="support-shell" aria-labelledby="support-title">
            <header className="support-intro">
                <div className="support-kicker">
                    <ThumbsUp size={18} strokeWidth={2.5} absoluteStrokeWidth />
                    <span>支持本站</span>
                </div>
                <h1 id="support-title" aria-label="逛累了？来跟站长碰个杯 🥂">
                    <span>逛累了？来跟站长碰个杯</span>
                    <span className="support-title-emoji" aria-hidden="true">🥂</span>
                </h1>
                <p>
                    这里全场免费，随时欢迎来打个招呼。如果刚好心情不错，不如一起隔空干一杯？
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
