import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUp, Check, ChevronRight, Menu, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import './WaNewcarGuide.css';

const GUIDE_GROUPS = [
    {
        title: 'WA 신규등록',
        items: [
            { id: 'overview', title: '가이드 소개', keywords: '시작 로그인 준비' },
            { id: 'status', title: '신규신청현황', keywords: '조회 검색 F2 엑셀 신청' },
            { id: 'request', title: '신규등록 신청', keywords: '신청 등록 네 단계' }
        ]
    },
    {
        title: '신청 단계',
        items: [
            { id: 'owner', title: '1. 소유자 정보', keywords: '계약자 공동명의 현금 할부 리스 렌트' },
            { id: 'vehicle', title: '2. 자동차 정보', keywords: '차량 차대번호 제작증' },
            { id: 'registration', title: '3. 신규등록 정보', keywords: '번호판 채권 결제 감면 예상납부금액' },
            { id: 'confirm', title: '4. 최종 확인', keywords: '저장 요청 검증' }
        ]
    },
    {
        title: '도움말',
        items: [
            { id: 'attachments', title: '첨부·전자서명', keywords: '서류 업로드 서명 비과세' },
            { id: 'troubleshooting', title: '문제 해결', keywords: '세션 만료 오류 로그인 필수값' }
        ]
    }
];

const GUIDE_ITEMS = GUIDE_GROUPS.flatMap(group => group.items);

const WaNewcarGuide = () => {
    const [activeId, setActiveId] = useState('overview');
    const [query, setQuery] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    const searchResults = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return [];
        return GUIDE_ITEMS.filter(item =>
            `${item.title} ${item.keywords}`.toLowerCase().includes(keyword)
        );
    }, [query]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (visible) setActiveId(visible.target.id);
            },
            { rootMargin: '-96px 0px -65% 0px' }
        );

        GUIDE_ITEMS.forEach(item => {
            const section = document.getElementById(item.id);
            if (section) observer.observe(section);
        });

        return () => observer.disconnect();
    }, []);

    const moveTo = id => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveId(id);
        setQuery('');
        setMenuOpen(false);
    };

    const handleSearch = event => {
        event.preventDefault();
        if (searchResults[0]) moveTo(searchResults[0].id);
    };

    return (
        <div className="wa-guide-page">
            <header className="wa-guide-header">
                <div className="wa-guide-header-inner">
                    <button
                        type="button"
                        className="wa-guide-menu-button"
                        onClick={() => setMenuOpen(true)}
                        aria-label="가이드 메뉴 열기"
                    >
                        <Menu size={21} />
                    </button>

                    <Link className="wa-guide-brand" to="/guide/wa-newcar">
                        <img src="/logo_navy_horizontal.png" alt="DACOS" />
                        <span>사용 가이드</span>
                    </Link>

                    <form className="wa-guide-search" onSubmit={handleSearch} role="search">
                        <Search size={18} aria-hidden="true" />
                        <input
                            type="search"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="가이드 검색"
                            aria-label="가이드 검색"
                        />
                        {query && (
                            <div className="wa-guide-search-results">
                                {searchResults.length ? searchResults.map(item => (
                                    <button key={item.id} type="button" onClick={() => moveTo(item.id)}>
                                        <span>{item.title}</span>
                                        <ChevronRight size={15} />
                                    </button>
                                )) : <p>검색 결과가 없습니다.</p>}
                            </div>
                        )}
                    </form>

                    <Link className="wa-guide-service-link" to="/wa/newcar-status">
                        WA 신규등록 바로가기
                        <ChevronRight size={16} />
                    </Link>
                </div>
            </header>

            <div className="wa-guide-layout">
                {menuOpen && (
                    <button
                        type="button"
                        className="wa-guide-dim"
                        onClick={() => setMenuOpen(false)}
                        aria-label="가이드 메뉴 닫기"
                    />
                )}

                <aside className={`wa-guide-sidebar${menuOpen ? ' open' : ''}`}>
                    <div className="wa-guide-sidebar-heading">
                        <strong>WA 신규등록 가이드</strong>
                        <button type="button" onClick={() => setMenuOpen(false)} aria-label="가이드 메뉴 닫기">
                            <X size={19} />
                        </button>
                    </div>
                    <nav aria-label="가이드 목차">
                        {GUIDE_GROUPS.map(group => (
                            <div className="wa-guide-nav-group" key={group.title}>
                                <strong>{group.title}</strong>
                                {group.items.map(item => (
                                    <button
                                        type="button"
                                        key={item.id}
                                        className={activeId === item.id ? 'active' : ''}
                                        onClick={() => moveTo(item.id)}
                                    >
                                        {item.title}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </nav>
                </aside>

                <main className="wa-guide-content">
                    <div className="wa-guide-breadcrumb">WA 서비스 <span>›</span> 신규등록</div>

                    <article>
                        <section id="overview" className="wa-guide-section wa-guide-hero">
                            <span className="wa-guide-kicker">WA NEW CAR</span>
                            <h1>신규등록 사용 가이드</h1>
                            <p>
                                신규신청현황 조회부터 소유자·자동차·등록정보 입력, 첨부파일 확인과
                                최종 신청까지의 업무 흐름을 안내합니다.
                            </p>
                            <div className="wa-guide-start-grid">
                                <div><span>1</span><strong>신청현황 확인</strong><p>조건을 입력해 대상 차량을 찾습니다.</p></div>
                                <div><span>2</span><strong>정보 입력</strong><p>네 단계의 필수정보를 순서대로 입력합니다.</p></div>
                                <div><span>3</span><strong>검토 후 신청</strong><p>첨부와 금액을 확인하고 최종 요청합니다.</p></div>
                            </div>
                        </section>

                        <section id="status" className="wa-guide-section">
                            <span className="wa-guide-section-no">01</span>
                            <h2>신규신청현황</h2>
                            <p>신청일자와 처리상태를 선택하거나 소유자명, 차량·차대번호, 주문번호로 대상을 조회합니다.</p>
                            <div className="wa-guide-callout">
                                <strong>빠른 조회</strong>
                                <p>텍스트 검색칸에서 <kbd>Enter</kbd> 또는 <kbd>F2</kbd>를 누르면 조회 버튼과 동일하게 실행됩니다.</p>
                            </div>
                            <figure className="wa-guide-screen">
                                <div className="wa-guide-screen-bar"><span /><span /><span /><strong>신규신청현황</strong></div>
                                <div className="wa-guide-screen-tools">
                                    <div>신청일자</div><div>처리상태</div><div>차량/차대번호</div><button type="button">조회 F2</button>
                                </div>
                                <div className="wa-guide-screen-summary">
                                    <button type="button">신청</button><button type="button">차량대금 납부</button>
                                    <button type="button">공급가액 수정</button><button type="button">엑셀 업로드</button>
                                    <strong>검색 결과 총 27건</strong>
                                </div>
                                <div className="wa-guide-screen-table">
                                    <span>등록예정일</span><span>처리상태</span><span>주문번호</span><span>차대번호</span><span>계약자명</span>
                                    {Array.from({ length: 15 }, (_, index) => <i key={index} />)}
                                </div>
                                <figcaption>신규신청현황 화면 구성 예시</figcaption>
                            </figure>
                            <ul className="wa-guide-check-list">
                                <li><Check size={17} /> 신규 신청은 상단 또는 목록의 신청 버튼에서 시작합니다.</li>
                                <li><Check size={17} /> 목록 버튼은 로그인 권한에 따라 다르게 표시될 수 있습니다.</li>
                                <li><Check size={17} /> 검색 결과 건수는 목록 오른쪽에서 확인합니다.</li>
                            </ul>
                        </section>

                        <section id="request" className="wa-guide-section">
                            <span className="wa-guide-section-no">02</span>
                            <h2>신규등록 신청</h2>
                            <p>신청 화면은 네 단계로 구성됩니다. 다음 단계로 이동할 때 현재 입력값이 검증되고 저장됩니다.</p>
                            <div className="wa-guide-flow" aria-label="신규등록 신청 단계">
                                {['소유자 정보', '자동차 정보', '신규등록 정보', '최종 확인'].map((title, index) => (
                                    <div key={title}><span>{index + 1}</span><strong>{title}</strong></div>
                                ))}
                            </div>
                        </section>

                        <section id="owner" className="wa-guide-section">
                            <h2>1. 소유자 정보</h2>
                            <p>차량 구매 방식을 먼저 선택한 뒤 계약자와 소유자 정보를 입력합니다.</p>
                            <div className="wa-guide-two-column">
                                <div><strong>구매 방식</strong><p>현금/할부, 리스, 이용자명의리스, 렌트 중 업무에 맞는 항목을 선택합니다.</p></div>
                                <div><strong>공동소유</strong><p>대표소유자와 공동소유자 비율의 합이 100%가 되도록 입력합니다.</p></div>
                            </div>
                            <div className="wa-guide-note"><strong>확인</strong> 구매 방식에 따라 입력해야 하는 계약자 정보와 필수서류가 달라집니다.</div>
                        </section>

                        <section id="vehicle" className="wa-guide-section">
                            <h2>2. 자동차 정보</h2>
                            <p>차량 기본정보와 차대번호를 확인합니다. 차대번호는 영문 대문자로 정리되며 입력 오류가 없는지 제작증과 대조합니다.</p>
                            <ul className="wa-guide-check-list">
                                <li><Check size={17} /> 차량명과 차종, 연식이 신청 대상과 일치하는지 확인합니다.</li>
                                <li><Check size={17} /> 차대번호 누락이나 자리 수 오류를 확인합니다.</li>
                                <li><Check size={17} /> 주문번호가 있는 차량은 상단 요약정보와 함께 확인합니다.</li>
                            </ul>
                        </section>

                        <section id="registration" className="wa-guide-section">
                            <h2>3. 신규등록 정보</h2>
                            <p>등록 예정일, 번호판, 채권 처리, 결제정보와 감면 여부를 입력하고 예상납부금액을 확인합니다.</p>
                            <div className="wa-guide-card-grid">
                                <div><span>번호판</span><strong>번호 선택 및 배송정보</strong></div>
                                <div><span>채권</span><strong>처리 방식과 은행 확인</strong></div>
                                <div><span>결제</span><strong>결제자 연락처와 증빙</strong></div>
                                <div><span>감면</span><strong>대상·등급 및 증빙서류</strong></div>
                            </div>
                            <div className="wa-guide-callout warning">
                                <strong>예상납부금액 확인</strong>
                                <p>입력정보가 바뀌면 금액을 다시 확인한 뒤 다음 단계로 이동하세요.</p>
                            </div>
                        </section>

                        <section id="confirm" className="wa-guide-section">
                            <h2>4. 최종 확인</h2>
                            <p>소유자, 차량, 등록정보와 납부금액을 최종 검토합니다. 요청 버튼을 누르면 전체 단계의 필수값을 다시 검사합니다.</p>
                            <ol className="wa-guide-number-list">
                                <li><span>1</span><div><strong>요약정보 확인</strong><p>계약자명, 차대번호, 주문번호, 등록 예정일을 확인합니다.</p></div></li>
                                <li><span>2</span><div><strong>금액·첨부 확인</strong><p>납부금액과 필수 첨부파일, 전자서명 완료 여부를 확인합니다.</p></div></li>
                                <li><span>3</span><div><strong>신청 요청</strong><p>요청 후 신규신청현황에서 변경된 처리상태를 확인합니다.</p></div></li>
                            </ol>
                        </section>

                        <section id="attachments" className="wa-guide-section">
                            <span className="wa-guide-section-no">03</span>
                            <h2>첨부파일과 전자서명</h2>
                            <p>선택한 구매 방식과 감면 조건에 필요한 서류가 있으면 단계 이동 시 안내창이 표시됩니다.</p>
                            <div className="wa-guide-note"><strong>파일 누락 시</strong> 안내창에서 필요한 서류를 확인한 뒤 업로드하고 다시 진행하세요.</div>
                        </section>

                        <section id="troubleshooting" className="wa-guide-section">
                            <span className="wa-guide-section-no">04</span>
                            <h2>문제 해결</h2>
                            <div className="wa-guide-faq">
                                <details open>
                                    <summary>다음 단계로 이동되지 않아요.</summary>
                                    <p>화면에 표시된 첫 번째 필수 입력 항목을 확인하세요. 오류 위치로 자동 이동합니다.</p>
                                </details>
                                <details>
                                    <summary>로그인 세션 만료 안내가 표시돼요.</summary>
                                    <p>서버 세션이 만료된 상태입니다. 확인을 누르면 로그인 화면으로 이동하므로 다시 로그인해 주세요.</p>
                                </details>
                                <details>
                                    <summary>첨부 안내창이 계속 표시돼요.</summary>
                                    <p>현재 신청 조건에 필요한 서류 코드가 모두 업로드되었는지 확인하세요.</p>
                                </details>
                            </div>
                        </section>
                    </article>
                </main>

                <aside className="wa-guide-toc">
                    <strong>이 페이지에서</strong>
                    <nav aria-label="현재 페이지 목차">
                        {GUIDE_ITEMS.map(item => (
                            <button
                                type="button"
                                key={item.id}
                                className={activeId === item.id ? 'active' : ''}
                                onClick={() => moveTo(item.id)}
                            >
                                {item.title}
                            </button>
                        ))}
                    </nav>
                </aside>
            </div>

            <button type="button" className="wa-guide-top" onClick={() => moveTo('overview')} aria-label="맨 위로 이동">
                <ArrowUp size={19} />
            </button>
        </div>
    );
};

export default WaNewcarGuide;
