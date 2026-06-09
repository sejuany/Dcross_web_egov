/**
 * =====================================================
 * ErpField.jsx - 라벨 + 입력 한 줄 공통 컴포넌트
 * =====================================================
 *
 * ERP 화면에서 "라벨: [입력폼]" 형태의 한 줄을 만들 때 사용합니다.
 * ErpSection 안에서 ErpField를 배치하면 자동으로 정렬됩니다.
 *
 * [Props - 사용 가능한 속성]
 * @prop {string}  label      - 왼쪽에 표시할 라벨 텍스트 (필수)
 * @prop {boolean} required   - true: 라벨에 필수(*) 표시 (기본값: false)
 * @prop {number}  span       - 가로 칸 수, 1~숫자 (기본값: 1)
 *                              전체 줄 = 12칸 기준. span=2면 2칸 차지
 * @prop {string}  labelWidth - 라벨 영역의 너비 (기본값: '85px')
 * @prop {string}  fontSize   - 라벨 글자 크기 (기본값: 없음)
 * @prop {node}    children   - 입력 폼 요소 (input, select 등)
 *
 * [사용 예시]
 *
 * // 기본 텍스트 입력
 * <ErpField label="차량번호" span={2}>
 *     <input
 *         type="text"
 *         className="erp-input"
 *         value={값}
 *         onChange={e => 상태변경(e.target.value)}
 *     />
 * </ErpField>
 *
 * // 필수 항목 + 드롭다운
 * <ErpField label="처리상태" required={true} span={2}>
 *     <select className="erp-input" value={값} onChange={...}>
 *         <option value="">전체</option>
 *         <option value="ING">진행중</option>
 *     </select>
 * </ErpField>
 *
 * // 라벨 너비 조정 (긴 라벨)
 * <ErpField label="차량/차대번호" span={3} labelWidth="110px" fontSize="11px">
 *     <input type="text" className="erp-input" ... />
 * </ErpField>
 */
import React from 'react';

const ErpField = ({ label, required = false, span = 1, children, labelWidth = '95px', fontSize }) => {
    return (
        // col-{span}: 그리드에서 몇 칸을 차지할지 결정
        <div className={`field-group col-${span}`}>
            {/* erp-label: 왼쪽 라벨 / req 클래스: 필수 표시(*) 추가 */}
            <label
                className={`erp-label ${required ? 'req' : ''}`}
                style={{ width: labelWidth, fontSize: fontSize }}
            >
                {label}
            </label>
            {/* flex-row: 내부 입력 요소들을 가로로 나열 */}
            <div className="flex-row">
                {children}
            </div>
        </div>
    );
};

export default ErpField;
