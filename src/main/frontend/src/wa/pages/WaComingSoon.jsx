import React from 'react';
import '../styles/wa.css';

const WaComingSoon = ({ title }) => (
    <div className="wa-coming-page">
        <section className="wa-coming-card">
            <h1>{title}</h1>
            <p>해당 메뉴는 화면 준비중입니다.</p>
        </section>
    </div>
);

export default WaComingSoon;