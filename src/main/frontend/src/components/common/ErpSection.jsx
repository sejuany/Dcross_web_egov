/**
 * =====================================================
 * ErpSection.jsx - ERP 스타일 섹션(박스) 공통 컴포넌트
 * =====================================================
 *
 * 화면의 특정 영역을 박스 형태로 묶어주는 컴포넌트입니다.
 * 모든 화면에서 일관된 레이아웃을 유지하기 위해 사용합니다.
 *
 * [Props - 사용 가능한 속성]
 * @prop {string}  title    - 섹션 제목 (없으면 제목 영역 미표시)
 * @prop {boolean} isHeader - true: 검색 조건 박스 스타일 / false: 기본 스타일 (기본값: false)
 * @prop {string}  className - 추가 CSS 클래스명 (선택사항)
 * @prop {node}    children - 내부에 들어갈 내용 (ErpField 등)
 *
 * [사용 예시]
 *
 * // 검색 조건 영역 (상단 회색 박스)
 * <ErpSection isHeader={true}>
 *     <div className="erp-row">
 *         <ErpField label="차량번호" span={2}>
 *             <input ... />
 *         </ErpField>
 *     </div>
 * </ErpSection>
 *
 * // 정보 입력 영역 (제목 있는 박스)
 * <ErpSection title="기본 정보">
 *     <div className="erp-row">
 *         <ErpField label="신청자명" span={2}>
 *             <input ... />
 *         </ErpField>
 *     </div>
 * </ErpSection>
 */
import React from 'react';

const ErpSection = ({ title, isHeader = false, children, className = '' }) => {
    return (
        <div className={`erp-section ${isHeader ? 'header-info' : ''} ${className}`}>
            {/* title 속성이 있을 때만 섹션 제목 표시 */}
            {title && (
                <div className="erp-section-title">
                    <span className="icon">◆</span> {title}
                </div>
            )}
            {/* erp-grid: 내부 ErpField들이 그리드 형태로 배치됨 */}
            <div className="erp-grid">
                {children}
            </div>
        </div>
    );
};

export default ErpSection;
