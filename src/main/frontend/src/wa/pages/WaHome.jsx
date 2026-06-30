import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, ClipboardList, ClipboardPlus, CreditCard, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getUserCompanyId } from '../auth/waRouting';
import '../styles/wa.css';

const getUserValue = (user, key) => {
    if (!user) return '';

    const camelKey = key
        .toLowerCase()
        .replace(/_([a-z])/g, (_, char) => char.toUpperCase());

    return (
        user[key] ??
        user[key.toLowerCase()] ??
        user[camelKey] ??
        ''
    );
};

const WaHome = () => {
    const { user } = useAuth();
    const companyId = getUserCompanyId(user);
    const companyName = getUserValue(user, 'COMPANY_NM') || companyId || 'WA001';
    const memberName = getUserValue(user, 'MEMBER_NM') || '사용자';

    return (
        <div className="wa-home-page">
            <section className="wa-home-hero">
                <div>
                    <h1>폴스타 신규등록 간편 업무</h1>
                    <p>신차등록 신청부터 진행 현황 확인까지 WA001 전용 화면에서 처리합니다.</p>
                </div>
                <Link className="wa-primary-link" to="/wa/newcar-request">
                    <ClipboardPlus size={18} />
                    <span>신차등록 시작</span>
                    <ArrowRight size={16} />
                </Link>
            </section>

            <section className="wa-home-summary" aria-label="사용자 정보">
                <div className="wa-summary-tile">
                    <Building2 size={20} />
                    <span>회사</span>
                    <strong>{companyName}</strong>
                </div>
                <div className="wa-summary-tile">
                    <UserRound size={20} />
                    <span>담당자</span>
                    <strong>{memberName}</strong>
                </div>
                <div className="wa-summary-tile muted">
                    <ClipboardList size={20} />
                    <span>신규신청현황</span>
                    <strong>준비중</strong>
                </div>
                <div className="wa-summary-tile muted">
                    <CreditCard size={20} />
                    <span>납부현황</span>
                    <strong>준비중</strong>
                </div>
            </section>

            <section className="wa-home-action">
                <div>
                    <h2>신차등록 신청</h2>
                    <p>소유자, 차량, 등록 정보를 순서대로 입력하고 기존 신규등록 API로 저장합니다.</p>
                </div>
                <Link className="wa-secondary-link" to="/wa/newcar-request">
                    신청서 작성
                    <ArrowRight size={16} />
                </Link>
            </section>
        </div>
    );
};

export default WaHome;