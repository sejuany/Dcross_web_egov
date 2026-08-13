import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import {
    Calculator,
    CheckCircle2,
    CircleAlert,
    CreditCard,
    LoaderCircle,
    ReceiptText,
    RefreshCw,
    X
} from 'lucide-react';

import CommonSelect from '../../../components/common/CommonSelect';
import { gf } from '../../../utils/utils';
import SplitInput from '../common/SplitInput';
import AddressSearch from '../common/AddressSearch';
import {
    buildNewcarEstimateKey,
    calculateNewcarEstimate,
    calculateTotalFromRows,
    formatAmount,
    isEcoAcquisitionEligible,
    resolveBondPreExemption,
    sortPaymentRows
} from './newcarAmountCalculator';
import {
    buildCarSpecPatch,
    resolveBondSearchCriteria
} from './newcarCarSpec';

const BOND_OPTIONS = [
    { value: 'SELL', label: '매도(할인)' },
    { value: 'BUY', label: '매입' }
];

const ECO_EXEMPTION_NOTICE_BY_CODE = {
    '15': {
        targetName: '다자녀 감면',
        benefit: '다자녀(2자녀) – 취득세 70만원 감면'
    },
    '06': {
        targetName: '다자녀 감면',
        benefit: '다자녀(3자녀) – 취득세 140만원 감면'
    },
    '14': {
        targetName: '보훈보상대상자 감면',
        benefit: '보훈보상대상자 – 취득세 50% 감면 (정확한 감면 금액은 [예상납부금액 확인] 클릭)'
    }
};

const getEstimateVehicleInfo = async (newCar) => {
    const carName = String(newCar.CAR_NM ?? '').trim();

    if (!carName) {
        throw new Error('차량명을 입력해주세요.');
    }

    const [carSpecResponse, taxInfoResponse] = await Promise.all([
        axios.get('/api/newcar/car-spec', { params: { carName } }),
        axios.get('/api/newcar/tax-info')
    ]);
    const carSpec = carSpecResponse.data?.data;
    const taxInfo = taxInfoResponse.data?.data;

    if (!carSpec) {
        throw new Error('차량제원 조회 결과가 없습니다.');
    }
    if (!taxInfo) {
        throw new Error('신규등록 세율정보 조회 결과가 없습니다.');
    }

    return {
        carSpecPatch: buildCarSpecPatch(newCar, carSpec),
        taxInfo
    };
};

const FALLBACK_EXEMPTION_TARGETS = [
    { CODE_ID: '15', CODE_NM: '다자녀(2자녀)' },
    { CODE_ID: '06', CODE_NM: '다자녀(3자녀)' },
    { CODE_ID: '01', CODE_NM: '국가유공자' },
    { CODE_ID: '04', CODE_NM: '장애인' },
    { CODE_ID: '05', CODE_NM: '시각장애' },
    { CODE_ID: '02', CODE_NM: '5.18 민주화운동대상' },
    { CODE_ID: '03', CODE_NM: '고엽제 후유증 대상' },
    { CODE_ID: '09', CODE_NM: '교환자동차 감면' },
    { CODE_ID: '11', CODE_NM: '수출용중고자동차' },
    { CODE_ID: '12', CODE_NM: '공동경비구역(JSA) 거주자' },
    { CODE_ID: '13', CODE_NM: '비영리사업자' },
    { CODE_ID: '14', CODE_NM: '보훈보상대상자' },
    { CODE_ID: '18', CODE_NM: '다자녀2 + 경증장애인(중복감면)' },
    { CODE_ID: '16', CODE_NM: '다자녀3 + 경증장애인(중복감면)' },
];

const FALLBACK_EXEMPTION_WHO = [
    { CODE_ID: 'REPRE', CODE_NM: '대표소유자' },
    { CODE_ID: 'JOINT', CODE_NM: '공동소유자' }
];

const FALLBACK_EXEMPTION_GRADES = [
    { CODE_ID: '0', CODE_NM: '미적용' },
    { CODE_ID: '1', CODE_NM: '1급' },
    { CODE_ID: '2', CODE_NM: '2급' },
    { CODE_ID: '3', CODE_NM: '3급' },
    { CODE_ID: '4', CODE_NM: '4급' },
    { CODE_ID: '5', CODE_NM: '5급' },
    { CODE_ID: '6', CODE_NM: '6급' },
    { CODE_ID: '7', CODE_NM: '7급' },
    { CODE_ID: '8', CODE_NM: '8급' },
    { CODE_ID: '9', CODE_NM: '9급' },
    { CODE_ID: '10', CODE_NM: '10급' },
    { CODE_ID: '11', CODE_NM: '11급' },
    { CODE_ID: '12', CODE_NM: '12급' },
    { CODE_ID: '13', CODE_NM: '13급' },
    { CODE_ID: '14', CODE_NM: '14급' },
    { CODE_ID: 'A', CODE_NM: '고도' },
    { CODE_ID: 'B', CODE_NM: '중도' },
    { CODE_ID: 'C', CODE_NM: '경도' },
    { CODE_ID: 'D', CODE_NM: '적용' },
    { CODE_ID: '01', CODE_NM: '중증장애' },
    { CODE_ID: '05', CODE_NM: '경증장애' }
];

const AUTO_APPLY_EXEMPTION_TARGET_CODES = new Set(['06', '09', '12', '13', '15']);

const EXEMPTION_GRADE_CODES_BY_TARGET = {
    '01': ['1', '2', '3', '4', '5', '6', '7'],
    '02': ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
    '03': ['A', 'B', 'C'],
    '04': ['01', '05', '1', '2', '3', '4', '5', '6'],
    '05': ['01', '05', '1', '2', '3', '4', '5', '6'],
    '06': ['D'],
    '09': ['D'],
    '12': ['D'],
    '13': ['D'],
    '14': ['1', '2', '3', '4', '5', '6', '7'],
    '15': ['D']
};

const EXCLUDED_EXEMPTION_TARGET_NAMES = new Set([
    '경상북도소상공인',
    '3자녀+장애인(중복감면)',
    '2자녀+장애인(중복감면)',
    '이용자명의리스'
]);

const normalizeExemptionTargetName = (value) => String(value || '').replace(/\s+/g, '');

const JOINT_OWNER_DOCUMENT_NOTE = '공동명의 신청시\n1. 주민등록등본\n2. 가족관계증명서';
const FAMILY_RELATION_NUMBER_NOTE = '가족관계증명서는 주민번호 뒷번호 모두 표기 되어야 함';
const EXEMPTION_DOCUMENT_INFO = {
    '15': {
        name: '다자녀(2자녀)',
        documents: [
            '가족관계증명서 (차소유자 기준)',
            '주민등록등본 (차소유주 기준)'
        ],
        note: []
    },
    '06': {
        name: '다자녀(3자녀)',
        documents: [
            '가족관계증명서 (차소유자 기준)',
            '주민등록등본 (차소유주 기준)'

        ],
        note: []
    },
    '01': {
        name: '국가유공자',
        documents: [
            '국가유공자증 또는 국가유공자증명서'
        ],
        note: JOINT_OWNER_DOCUMENT_NOTE,
        amount: '취득세 100% 면제'
    },
    '04': {
        name: '장애인',
        documents: [
            '장애인증명서 또는 장애인등록증(복지카드)'
        ],
        note: JOINT_OWNER_DOCUMENT_NOTE,
        amount: [
            '장애정도가 심한 장애인(기존 1급~3급 중증 장애인) 취득세 100% 면제',
            '\n차량 1대만 가능',
            '\n경증 장애인(기존 4급~6급)은 취득세 면제 대상 제외'
        ]
    },
    '05': {
        name: '시각장애',
        documents: [
            '장애인증명서 또는 장애인등록증(복지카드)'
        ],
        note: `${JOINT_OWNER_DOCUMENT_NOTE}` + '\n장애정도가 심하지 않은 장애 중 기존 4급일 경우 장애정도결정서 필요'
    },
    '02': {
        name: '5.18 민주화운동대상',
        documents: [
            ' 5.18 민주유공자증(신체장애등급 표기 1~14급)  '
        ],
        note: `${JOINT_OWNER_DOCUMENT_NOTE}\n부상자 본인이 포함되어 있어야 함`
    },
    '03': {
        name: '고엽제 후유증 대상',
        documents: [
            '고엽제 적용 대상확인원'
        ],
        note: JOINT_OWNER_DOCUMENT_NOTE,
    },
    '09': {
        name: '교환자동차 감면',
        documents: [
            '감면신청서',
            '제작사의 결함확인서 공문 또는 자동차 안전하자 심의위원회의 판정문',
            '말소사실증명서',
            '자동차제작증(교환차량)'
        ],
        note: [
            '반납차량은 말소사유가 제작결함으로 나와야 함',
            '제작자 또는 판매자에게 반품',
            '침수차량으로 전손처리된 경우 폐차증명서 필요'
        ].join('\n'),
        amount: [
            '교환받는 자동차의 취득세는 면제',
            '새 차량의 세액이 기존 차량의 세액을 초과하면 초과분에 대해 취득세 부과',
            '새 차 세액 < 기존 차 세액: 취득세 전액 면제',
            '새 차 세액 > 기존 차 세액: 차액만큼 취득세 부과'
        ].join('\n')
    },
    '11': {
        name: '수출용중고자동차',
        documents: [
            '감면 신청서',
            '사업자등록증 (무역업, 수출업 업태 확인용)',
            '중고자동차 매매계약서 및 자동차등록증'
        ],
        note: '수출완료 후 수출신고필증 및 선하증권(B/L) 사본 필요(추징 방지 확인용)',
        amount: [
            '산정된 취득세액 200만원 이하: 100% 면제',
            '산정된 취득세액 200만원 이상: 취득세 85% 감면'
        ].join('\n')
    },
    '12': {
        name: '공동경비구역(JSA) 거주자',
		documents: ["거주지 주소가 파주 '대성동'으로 확인되면 감면신청서 외 구비서류 불필요"],
    },
    '13': {
        name: '비영리사업자',
        documents: [
            '관용차량만 비영리사업자 취득세 감면 가능'
        ],
        note: [
            '관용차량 등록 시 구비서류',
            '1. 고유번호증',
            '2. 관용차량 정수배정서 또는 차량교체승인서',
            '교회, 단체 등 비영리사업자는 취득세 감면 불가능'
        ].join('\n'),
        amount: '취득세 100% 면제',
        reference: [
            '국방용: 군용 차량',
            '경호, 경비용: 대통령 및 요인 경호용 차량',
            '교통순찰, 소방용: 경찰차, 소방차 등',
            '공익 목적 행정 차량: 구급차, 소방차, 오물제거 차량, 도로공사 작업차량 등'
        ].join('\n')
    },
    '14': {
        name: '보훈보상대상자',
        documents: [
            '국가유공자 확인서 또는 국가유공자증(상이등급 표기)'
        ],
        note: '보훈보상대상자로서 상이등급 1~7급 (2024.1.1 이후 등록분부터 취득세 50% 감면)'
    },
    '18': {
        name: '다자녀2 + 장애인(중복감면)',
        documents: [
            '중복 감면 불가'
        ],
        note: [
            '경증장애일 경우 공채감면',
            '1. 감면신청서',
            '2. 가족관계증명서',
            '3. 주민등록등본',
            '4. 장애인증명서 또는 복지카드'
        ].join('\n'),
        amount: '취득세 70만원 감면\n경증장애일 경우 공채 금액 감면'
    },
    '16': {
        name: '다자녀3 + 장애인(중복감면)',
        documents: [
            '중복 감면 불가'
        ],
        note: [
            '경증장애일 경우 공채감면',
            '1. 감면신청서',
            '2. 가족관계증명서',
            '3. 주민등록등본',
            '4. 장애인증명서 또는 복지카드'
        ].join('\n'),
        amount: '취득세 140만원 감면\n경증장애일 경우 공채 금액 감면'
    },

};

const normalizeExemptionCode = (code) => {
    const codeText = String(code ?? '').trim();

    if (!codeText) {
        return '';
    }

    return /^\d+$/.test(codeText) ? codeText.padStart(2, '0') : codeText;
};

const normalizeExemptionName = (value) => String(value ?? '').replace(/\s+/g, '').trim();

const getOptionCode = (option) => option?.CODE_ID ?? option?.value ?? option?.CD;
const getOptionName = (option) => option?.CODE_NM ?? option?.label ?? option?.NAME;

const EXEMPTION_DOCUMENT_INFO_BY_NAME = Object.values(EXEMPTION_DOCUMENT_INFO).reduce((acc, info) => {
    acc[normalizeExemptionName(info.name)] = info;
    return acc;
}, {});

const getExemptionDocumentInfo = (code, options = []) => {
    const normalizedCode = normalizeExemptionCode(code);

    if (!normalizedCode || normalizedCode === '00') {
        return null;
    }

    if (EXEMPTION_DOCUMENT_INFO[normalizedCode]) {
        return EXEMPTION_DOCUMENT_INFO[normalizedCode];
    }

    const selectedOption = options.find(option => normalizeExemptionCode(getOptionCode(option)) === normalizedCode);
    return EXEMPTION_DOCUMENT_INFO_BY_NAME[normalizeExemptionName(getOptionName(selectedOption))] || null;
};

const hasFamilyRelationDocument = (info) => {
    if (!info) {
        return false;
    }

    const targetText = [
        ...(info.documents || []),
        info.note,
        info.reference
    ].filter(Boolean).join('\n');

    return targetText.includes('가족관계증명서') || targetText.includes('가족관계 증명서');
};

const FALLBACK_BANKS = [
    { CODE_ID: '088', CODE_NM: '신한은행' },
    { CODE_ID: '004', CODE_NM: '국민은행' },
    { CODE_ID: '020', CODE_NM: '우리은행' },
    { CODE_ID: '081', CODE_NM: '하나은행' },
    { CODE_ID: '011', CODE_NM: '농협은행' }
];

const PAYMENT_LABELS = {
    ACQ: '취득세',
    UREG: '등록면허세',
    INJI: '인지세',
    STAMP: '증지대',
    BOND: '채권',
    BFEE: '채권취급수수료',
    FEE: '등록수수료',
    TNUM: '번호판대',
    UNUM: '번호판대행',
    SPARE: '예비비'
};


const getCodeOptions = (codes, groupId, fallback = []) => {
    const optionList = codes?.[groupId];
    return Array.isArray(optionList) && optionList.length ? optionList : fallback;
};

// 일반 문자 입력은 마지막 입력 후 이 시간이 지났을 때 상위 state에 반영한다.
// 너무 짧으면 큰 부모 컴포넌트가 다시 자주 렌더링되고, 너무 길면 검증값 반영이 늦어진다.
const DEFERRED_INPUT_SYNC_DELAY = 220;

// SplitInput에 인라인 배열을 넘기면 NewcarInfo 렌더마다 새 배열로 인식된다.
// 모듈 상수로 고정해 SplitInput 내부 effect가 불필요하게 실행되지 않도록 한다.
const PHONE_PART_LENGTHS = [3, 4, 4];
const PHONE_FIXED_VALUES = ['010'];
const PHONE_PLACEHOLDERS = ['010', '1234', '5678'];
const BUSINESS_NO_PART_LENGTHS = [3, 2, 5];
const BUSINESS_NO_PLACEHOLDERS = ['123', '45', '67890'];
const removeHangul = (value) => String(value ?? '').replace(/[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF]/g, '');

/**
 * 문자 입력 중에는 해당 input만 다시 렌더링하고, 입력이 확정되는 시점에만
 * 상위 dsNewCar/dsTaxReceipt state로 값을 전달한다.
 *
 * - IME 조합 중간값은 상위 state에 반영하지 않는다.
 * - 조합 완료, 포커스 이탈 또는 짧은 입력 중단 후 최신값을 반영한다.
 * - 외부 조회/초기화로 value가 바뀌면 로컬 draft도 동기화한다.
 */
const DeferredInput = memo(({
    name,
    value = '',
    onCommit,
    sanitizeValue,
    ...inputProps
}) => {
    // 화면에 보이는 값은 로컬 draft로 관리한다.
    // 사용자가 키를 입력할 때 NewcarInfo와 WaNewcarRequest 전체가 렌더되는 것을 막기 위함이다.
    const externalValue = String(value ?? '');
    const [draftValue, setDraftValue] = useState(externalValue);

    // 비동기 debounce와 blur 시점에서도 가장 최근 입력값을 읽기 위한 ref다.
    const latestValueRef = useRef(externalValue);

    // 한글 IME 조합 중간값(예: ㅇ → 이 → 임)을 상위 state로 보내지 않기 위한 플래그다.
    const composingRef = useRef(false);

    // 상세 재조회, 저장 후 재조회 등 외부 state 값이 변경되면 화면 draft도 맞춘다.
    useEffect(() => {
        latestValueRef.current = externalValue;
        setDraftValue(externalValue);
    }, [externalValue]);

    // 값이 실제로 달라진 경우에만 상위 state 갱신 콜백을 실행한다.
    const commitValue = useCallback((nextValue = latestValueRef.current) => {
        if (nextValue !== externalValue) {
            onCommit?.(name, nextValue);
        }
    }, [externalValue, name, onCommit]);

    // 일반 입력은 연속 입력이 잠시 멈춘 뒤 한 번만 상위 state에 반영한다.
    useEffect(() => {
        if (composingRef.current || draftValue === externalValue) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            // 타이머 대기 중 IME 조합이 시작될 수 있으므로 실행 직전에도 다시 확인한다.
            if (!composingRef.current) {
                commitValue(latestValueRef.current);
            }
        }, DEFERRED_INPUT_SYNC_DELAY);

        return () => window.clearTimeout(timer);
    }, [commitValue, draftValue, externalValue]);

    // 키 입력 시에는 작은 DeferredInput 컴포넌트의 로컬 state만 갱신한다.
    const handleDraftChange = (event) => {
        const nextValue = sanitizeValue ? sanitizeValue(event.target.value) : event.target.value;
        latestValueRef.current = nextValue;
        setDraftValue(nextValue);
    };

    // 한글 조합이 완료되면 완성된 문자열만 상위 state에 반영한다.
    const handleCompositionEnd = (event) => {
        const nextValue = sanitizeValue ? sanitizeValue(event.currentTarget.value) : event.currentTarget.value;
        composingRef.current = false;
        latestValueRef.current = nextValue;
        setDraftValue(nextValue);
        commitValue(nextValue);
    };

    return (
        <input
            {...inputProps}
            autoComplete="off"
            name={name}
            value={draftValue}
            onChange={handleDraftChange}
            onCompositionStart={() => {
                composingRef.current = true;
            }}
            onCompositionEnd={handleCompositionEnd}
            // 다음/저장 버튼 클릭 전에 blur가 먼저 발생하므로 최신 입력값이 검증·저장에 포함된다.
            onBlur={() => commitValue(latestValueRef.current)}
        />
    );
});

DeferredInput.displayName = 'DeferredInput';

// 감면 대상별 필요서류 안내를 독립 렌더 영역으로 분리한다.
// 감면 코드가 그대로라면 다른 입력값이 바뀌어도 긴 문서 목록 DOM을 다시 만들지 않는다.
const RequiredDocuments = memo(({
    documentInfo,
    showFamilyRelationNumberNote
}) => {
    if (!documentInfo) {
        return null;
    }

    return (
        <div className="wa-required-docs">
            <div className="wa-required-docs-heading">
                <ReceiptText size={15} />
                <strong>{documentInfo.name} 필요서류</strong>
            </div>

            <ol className="wa-required-docs-list">
                {documentInfo.documents.map(document => (
                    <li key={document}>{document}</li>
                ))}
            </ol>

            {documentInfo.note && (
                <div className="wa-required-docs-section">
                    <strong>비고</strong>
                    <p>{documentInfo.note}</p>
                    
                    {showFamilyRelationNumberNote && (
                        <p className="wa-required-docs-footnote">
                            * {FAMILY_RELATION_NUMBER_NOTE}
                        </p>
                    )}
                </div>
            )}

            {documentInfo.amount && (
                <div className="wa-required-docs-section">
                    <strong>감면금액</strong>
                    <p>{documentInfo.amount}</p>
                </div>
            )}

            {documentInfo.reference && (
                <div className="wa-required-docs-section">
                    <strong>참고사항</strong>
                    <p>{documentInfo.reference}</p>
                </div>
            )}

        </div>
    );
});

RequiredDocuments.displayName = 'RequiredDocuments';

// 감면 관련 3개 select만 묶은 컴포넌트다.
// dsNewCar 전체 객체 대신 필요한 코드값만 받아 React.memo 비교가 가능하도록 한다.
const ExemptionSelectorFields = memo(({
    whoCode,
    targetCode,
    gradeCode,
    whoOptions,
    targetOptions,
    gradeOptions,
    gradeDisabled,
    onFieldChange
}) => (
    <div className="wa-inline-group wa-select-stack">
        <CommonSelect
            className="wa-select"
            name="NTAX_WHO"
            data-type="newcar"
            value={whoCode}
            options={whoOptions}
            onChange={onFieldChange}
        />
        <CommonSelect
            className="wa-select wa-flex"
            name="NTAX_TRGET_CD"
            data-type="newcar"
            value={targetCode || '00'}
			placeholder={null}
            options={targetOptions}
            onChange={onFieldChange}
        />
        <CommonSelect
            className="wa-select"
            name="NTAX_TRGET_GR_CD"
            data-type="newcar"
            value={gradeCode}
            options={gradeOptions}
            onChange={onFieldChange}
            disabled={gradeDisabled}
        />
    </div>
));

ExemptionSelectorFields.displayName = 'ExemptionSelectorFields';

/**
 * 감면 선택 버튼, 감면 콤보박스, 필요서류 안내를 하나의 memo 경계로 묶는다.
 * 환불계좌나 세금계산서처럼 감면과 무관한 값 변경 시 이 영역 렌더를 건너뛴다.
 */
const ExemptionSection = memo(({
    open,
    whoCode,
    targetCode,
    gradeCode,
    whoOptions,
    targetOptions,
    gradeOptions,
    gradeDisabled,
    selectedDocumentInfo,
    showFamilyRelationNumberNote,
    onToggle,
    onFieldChange
}) => (
    <>
        <button
            type="button"
            className={`wa-sub-btn ${open ? 'active' : ''}`}
            aria-pressed={open}
            onClick={onToggle}
        >
            <CircleAlert size={18} />
            감면 대상자 해당 시 클릭
            {open && <CheckCircle2 size={16} />}
        </button>

        {open && (
            <div className="wa-conditional-panel">
                <div className="wa-form-row">
                    <label className="wa-form-label">감면 대상 정보</label>
                    <div className="wa-form-control">
                        <ExemptionSelectorFields
                            whoCode={whoCode}
                            targetCode={targetCode}
                            gradeCode={gradeCode}
                            whoOptions={whoOptions}
                            targetOptions={targetOptions}
                            gradeOptions={gradeOptions}
                            gradeDisabled={gradeDisabled}
                            onFieldChange={onFieldChange}
                        />
                        <RequiredDocuments
                            documentInfo={selectedDocumentInfo}
                            showFamilyRelationNumberNote={showFamilyRelationNumberNote}
                        />
                    </div>
                </div>
            </div>
        )}
    </>
));

ExemptionSection.displayName = 'ExemptionSection';

const ExemptionWarningModal = memo(({ notice, onClose, onConfirm }) => {
    if (!notice) {
        return null;
    }

    const ecoNotice = notice.type === 'eco'
        ? ECO_EXEMPTION_NOTICE_BY_CODE[notice.targetCode]
        : null;

	const isExchange = notice.type === 'exchange'; // 교환 자동차 

	const title = ecoNotice
	    ? '친환경 차량 감면 안내'
	    : isExchange
	        ? '교환자동차 감면 안내'
	        : '기감면 조건 적용 불가 안내';

    return (
        <div className="wa-attach-modal-backdrop" onClick={onClose}>
            <div
                className="wa-attach-modal wa-notice-modal wa-exemption-warning-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="wa-exemption-warning-title"
                onClick={event => event.stopPropagation()}
            >
                <div className="wa-attach-modal-header">
                    <h3 id="wa-exemption-warning-title">{title}</h3>
                    <button
                        type="button"
                        className="wa-attach-modal-close"
                        aria-label={`${title} 닫기`}
                        onClick={onClose}
                    >
                        <X size={22} />
                    </button>
                </div>

                <div className="wa-attach-modal-body wa-exemption-warning-body">
                    {ecoNotice ? (
                        <>
                            <p className="wa-exemption-warning-main">
                                해당 차량은 친환경 차량으로 취득세 140만원 감면 대상입니다.
                                <br />
                                {ecoNotice.targetName} 선택 시 친환경 감면은 적용되지 않습니다.
                                {' '}
                                <span className="wa-exemption-warning-highlight-inline">(중복감면 불가)</span>
                            </p>
                            <div className="wa-eco-exemption-list">
                                <div>■ 친환경 차량 – 취득세 140만원 감면</div>
                                <div>■ {ecoNotice.benefit}</div>
                            </div>
                        </>
					) : isExchange ? (
					    <>
							<div style={{ margin: '25px 0 40px 0' }}>
						        {/* 교환자동차 감면 안내 */}
						        <p className="wa-exemption-warning-main normal">
						            교환자동차 감면은 <b>다코스 담당자</b>에게 문의 바랍니다. 
						        </p>
	
						        <h3 className="wa-exemption-warning-main normal small">
						            070-7931-2380 또는 070-7931-2818
						        </h3>
							</div>
					    </>
					) : (
                        <>
                            <strong className="wa-exemption-warning-highlight">
                                같은 감면 조건 여러 차량에 적용 불가
                            </strong>
                            <p className="wa-exemption-warning-main">
                                현재 감면 차량을 보유하신 경우, 동일한 조건의 감면을 적용할 수 없습니다.
                            </p>
                            <p className="wa-exemption-warning-note">
                                ※ 새 차량 등록일부터 60일 내에 기존 감면 차량을 말소 또는 이전 등록하면, 새 차량 감면 적용 가능
                            </p>
                            <div className="wa-exemption-warning-example">
                                (예시) 현재 다자녀(2자녀) 감면 적용 차량 보유 시, 다자녀(2자녀) 감면 적용 불가
                            </div>
                        </>
                    )}


					<div className="wa-attach-btn-div">
					    {notice.type === 'exchange' ? (
					        <button
					            type="button"
					            className="wa-attach-confirm-btn"
					            onClick={onClose}
					        >
					            확인
					        </button>
					    ) : (
					        <>
					            <button
					                type="button"
					                className="wa-attach-cancel-btn"
					                onClick={onClose}
					            >
					                닫기
					            </button>

					            <button
					                type="button"
					                className="wa-attach-confirm-btn"
					                onClick={onConfirm}
					            >
					                확인
					            </button>
					        </>
					    )}
					</div>
                </div>
            </div>
        </div>
    );
});

ExemptionWarningModal.displayName = 'ExemptionWarningModal';

// 계산 금액이 0원이어도 계산 사유가 전액면제라면 감면 카드를 표시한다.
const hasFullExemptionReason = (reason) => /전액\s*(?:면제|감면)/.test(String(reason ?? ''));

/**
 * 예상금액 결과 표시 전용 컴포넌트다.
 * 계산 중 여부나 계산 결과가 바뀌지 않으면 React.memo가 기존 결과 DOM을 재사용한다.
 */
const EstimateResultPanel = memo(({
    estimating,
    estimateSummary,
    estimateDirty
}) => {
    // 결제행 복사/정렬/필터는 estimateSummary가 갱신될 때만 수행한다.
    const displayRows = useMemo(
        () => estimateSummary
            ? sortPaymentRows(estimateSummary.updatedPaymentList)
                .filter(row => PAYMENT_LABELS[row.PAY_KD])
            : [],
        [estimateSummary]
    );
    const isAcqFullyExempt = Boolean(estimateSummary)
        && Number(estimateSummary.acqTax) === 0
        && hasFullExemptionReason(estimateSummary.exemptionReason);
    const isBondFullyExempt = Boolean(estimateSummary)
        && Number(estimateSummary.bondBaseAmt) === 0
        && (estimateSummary.bondPreExempt || hasFullExemptionReason(estimateSummary.bondReliefReason));
    const showAcqReductionCard = Number(estimateSummary?.acqReductionAmt) > 0 || isAcqFullyExempt;
    // 공채 금액이 0원이어도 조회 매입률과 감면 판단 근거를 확인할 수 있도록 항상 표시한다.
    const showBondCalculationCard = Boolean(estimateSummary);
    // 운영 프로시저는 실제 공채액이 감면 한도보다 작아도 정책 감면액(예: 250만원)을 먼저 설정한다.
    const bondPolicyReductionAmt = Number(estimateSummary?.bondReductionLimit) > 0
        ? Number(estimateSummary.bondReductionLimit)
        : Number(estimateSummary?.bondReductionAmt);
    const hasBondRelief = bondPolicyReductionAmt > 0 || isBondFullyExempt;
    const bondCardTitle = isAcqFullyExempt && isBondFullyExempt && estimateSummary?.exemptionName
        ? `공채 감면 · ${estimateSummary.exemptionName}`
        : `공채 계산 · ${estimateSummary?.bondArea || '지역 확인'}`;

    return (
        <>
            <div className={`wa-estimate-guide ${estimateDirty ? 'warning' : ''}`}>
                ※ 예상납부금액 확인 버튼 클릭 후 채권/감면/취득세 선택 시 새로고침 버튼을 눌러 정보를 업데이트 해주세요.
            </div>

            {estimating && (
                <div className="wa-estimate-progress" role="status">
                    <LoaderCircle size={18} className="wa-spin" />
                    예상납부금액을 계산중입니다!
                </div>
            )}

            {estimateSummary && (
                <div className="wa-estimate-panel">
                    <div className="wa-estimate-total">
                        <span>예상 납부 합계</span>
                        <strong>{formatAmount(estimateSummary.totalAmt)} 원</strong>
                    </div>

                    {estimateSummary.isCardPay && (
                        <div className="wa-card-tax-amount">
                            취득세 카드납부 금액 {formatAmount(estimateSummary.acqTax)} 원
                        </div>
                    )}
                    {showAcqReductionCard && (
                        <div className={[
                            'wa-acq-reduction',
                            estimateSummary.exemptionApplied || isAcqFullyExempt ? 'applied' : 'review'
                        ].join(' ')}>
                            <div className="wa-acq-reduction-title">
                                <span>취득세 감면 · {(estimateSummary.exemptionName ? `${estimateSummary.exemptionName}` : '')}</span>
                                <strong>{isAcqFullyExempt
                                    ? '전액 감면'
                                    : `- ${formatAmount(estimateSummary.acqReductionAmt)} 원`}</strong>
                            </div>
                            <p>
                                감면 전 {formatAmount(estimateSummary.grossAcqTax)} 원
                                {' / '}
                                납부 {Number(estimateSummary.acqTax) === 0
                                    ? '전액 감면'
                                    : `${formatAmount(estimateSummary.acqTax)} 원`}
                            </p>
                            {estimateSummary.exemptionReason && <p>{estimateSummary.exemptionReason}</p>}
                            {estimateSummary.exemptionMissingRequirements.length > 0 && (
                                <p>확인 필요: {estimateSummary.exemptionMissingRequirements.join(', ')}</p>
                            )}
                        </div>
                    )}

                    {showBondCalculationCard && (
                        <div className={[
                            'wa-acq-reduction',
                            hasBondRelief ? 'applied' : 'review'
                        ].join(' ')}>
                            <div className="wa-acq-reduction-title">
                                <span>{bondCardTitle}</span>
                                <strong>
                                    {isBondFullyExempt
                                        ? '전액 감면'
                                        : (bondPolicyReductionAmt > 0
                                            ? `- ${formatAmount(bondPolicyReductionAmt)} 원`
                                            : '감면 없음')}
                                </strong>
                            </div>
                            <p>
                                {estimateSummary.bondValueType === 'RATE'
                                    ? `과세표준 ${formatAmount(estimateSummary.taxableStandard)} 원 × 매입률 ${(estimateSummary.bondRate * 100).toLocaleString()}%`
                                    : `공채 기준금액 ${formatAmount(estimateSummary.bondValue)} 원`}
                                {' / '}
                                감면 전 {formatAmount(estimateSummary.bondGrossAmt)} 원
                            </p>
                            <p>
                                {estimateSummary.bondReliefReason || '공채 감면 사유 없음'}
                                {bondPolicyReductionAmt > 0
                                    && ` / 실제 차감 ${formatAmount(estimateSummary.bondReductionAmt)} 원`}
                                {' / '}
                                매입기준금액 {Number(estimateSummary.bondBaseAmt) === 0
                                    ? '전액 감면'
                                    : `${formatAmount(estimateSummary.bondBaseAmt)} 원`}
                            </p>
                            <p>
                                {estimateSummary.bondPreExempt
                                    ? '전액 면제'
                                    : (estimateSummary.bondDc === 'BUY'
                                        ? '매입 선택'
                                        : `매도(할인율 ${(estimateSummary.bondDiscountRate * 100).toLocaleString()}%)`)}
                                {' / '}
                                실제 채권 납부액 {formatAmount(estimateSummary.bond)} 원
                            </p>
                        </div>
                    )}

                    <table className="wa-payment-table">
                        <thead>
                            <tr>
                                <th>항목</th>
                                <th>예상금액</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayRows.map(row => {
                                const isCardExcluded = estimateSummary.isCardPay && row.PAY_KD === 'ACQ';
                                const amount = row.PAY_AMT ?? row.PRE_PAY_AMT;

                                return (
                                    <tr key={row.PAY_KD} className={isCardExcluded ? 'muted' : ''}>
                                        <td>{PAYMENT_LABELS[row.PAY_KD]}</td>
                                        <td>{formatAmount(amount)} 원</td>
                                        <td>{isCardExcluded
                                            ? '카드납부'
                                            : Number(amount) === 0
                                                ? '-'
                                                : '입금대상'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
});

EstimateResultPanel.displayName = 'EstimateResultPanel';

/**
 * 환불 예금주와 계좌번호는 각각 DeferredInput의 로컬 draft를 사용한다.
 * 은행 select는 draft 컴포넌트 밖에 두어 문자 입력 시 select까지 렌더되지 않도록 한다.
 */
const RefundAccountFields = memo(({
    recordKey,
    returnName,
    bankCode,
    returnAccount,
    bankOptions,
    onFieldChange,
    onFieldCommit,
	dsTaxReceipt,
	receiptType,
	onTaxReceiptCommit
}) => (
    <>
		<div className="wa-form-row" style={{ marginBottom: '0px'}} >
            <label className="wa-form-label" style={{ alignSelf: 'flex-start', marginTop: '13px' }}>이메일 주소</label>
				
		    <div className="wa-form-control">
		        <DeferredInput
		            className="wa-input"
		            maxLength={50}
		            name="MAIL1"
		            data-type="taxReceipt"
					onCommit={onTaxReceiptCommit}
					value={dsTaxReceipt.MAIL1 ?? ''}
		            sanitizeValue={removeHangul}
		            placeholder="example@company.com"
		        />
				<p className="mailInfoBox">
				{receiptType === 'CASH'
				    ? '*차량대금 세금계산서 발행용입니다. (등록수수료는 현금영수증 발행)'
				    : receiptType === 'TAX'
				        ? '*차량대금 및 등록수수료 세금계산서 발행용입니다.'
				        : '*차량대금 세금계산서 발행용입니다.'
				}
				</p>
		    </div>
		</div>

		<div className="wa-form-row">
		    <label className="wa-form-label">이메일 주소2</label>
				
		    <div className="wa-form-control">
		        <DeferredInput
		            className="wa-input"
		            maxLength={50}
		            name="MAIL2"
		            data-type="taxReceipt"
					onCommit={onTaxReceiptCommit}
					value={dsTaxReceipt.MAIL2 ?? ''}
		            sanitizeValue={removeHangul}
		            placeholder="추가 수신 이메일"
		        />
		    </div>
		</div>
		
        <div className="wa-form-row">
            <label className="wa-form-label">환불 예금주</label>

            <div className="wa-form-control">
                <DeferredInput
                    key={`${recordKey}:RETURN_NM`}
                    className="wa-input"
                    name="RETURN_NM"
                    data-type="newcar"
                    value={returnName}
                    onCommit={onFieldCommit}
                    placeholder="예금주"
                />
            </div>
        </div>

        <div className="wa-form-row">
            <label className="wa-form-label">환불 계좌</label>

            <div className="wa-form-control">
                <div className="wa-inline-group wa-refund-group">
                    <CommonSelect
                        className="wa-select"
                        name="RT_BANK_CD"
                        data-type="newcar"
                        value={bankCode}
                        options={bankOptions}
                        onChange={onFieldChange}
                    />

                    <DeferredInput
                        key={`${recordKey}:RETURN_NO`}
                        className="wa-input wa-flex"
                        name="RETURN_NO"
                        data-type="newcar"
                        value={returnAccount}
                        onCommit={onFieldCommit}
                        placeholder="계좌번호 입력"
                    />
                </div>
            </div>
        </div>
    </>
));

RefundAccountFields.displayName = 'RefundAccountFields';


const NewcarInfo = ({
    dsNewCar = {},
    dsService = {},
    dsPaymentList = [],
    dsWorkCp = {},
    codes = {},
    handleChange,
    setDsNewCar,
    dsTaxReceipt = {},
    setDsTaxReceipt,
    onTaxReceiptAddressSelect,
    onTaxReceiptAddressClear,
    setDsPaymentList,
    dsBaseList = []
}) => {
    const hasExemption = Boolean(dsNewCar.NTAX_TRGET_CD && dsNewCar.NTAX_TRGET_CD !== '00');
    const [isExemptionOpen, setIsExemptionOpen] = useState(hasExemption);
    const [exemptionNotice, setExemptionNotice] = useState(null);
    const [estimating, setEstimating] = useState(false);
    const [estimateSummary, setEstimateSummary] = useState(null);
    const [receiptType, setReceiptType] = useState('');
    const [taxReceiptSameOwner, setTaxReceiptSameOwner] = useState(false);
    const [cashReceiptPhoneSource, setCashReceiptPhoneSource] = useState('');
    const isJsaEligibleAddress = ['대성동길', '조산리'].some(
        keyword => String(dsNewCar.BASE_ADDRESS ?? '').includes(keyword)
    );

    const exemptionTargetOptions = useMemo(
        () => getCodeOptions(codes, 'NTTCD', FALLBACK_EXEMPTION_TARGETS)
            .filter(item => (
                !['07','11', '17', '19'].includes(item.CODE_ID)
                && !EXCLUDED_EXEMPTION_TARGET_NAMES.has(normalizeExemptionTargetName(item.CODE_NM))
                && (String(item.CODE_ID) !== '12' || isJsaEligibleAddress)
            )),
        [codes, isJsaEligibleAddress]
    );
	const hasJointOwner = Number(dsNewCar.RATIO_NO || 100) !== 100;
	const exemptionWhoOptions = useMemo(() => {
	    const options = getCodeOptions(codes, 'NTWHO', FALLBACK_EXEMPTION_WHO);

	    if (!hasJointOwner) {
	        return options.filter(
	            option => option.CODE_NM !== '공동소유자'
	        );
	    }

	    return options;
	}, [codes, hasJointOwner]);
    const allExemptionGradeOptions = useMemo(
        () => getCodeOptions(codes, 'NTTGR', FALLBACK_EXEMPTION_GRADES),
        [codes]
    );
    const exemptionGradeOptions = useMemo(() => {
        const targetCode = String(dsNewCar.NTAX_TRGET_CD ?? '');
        const allowedGradeCodes = EXEMPTION_GRADE_CODES_BY_TARGET[targetCode];

        if (!allowedGradeCodes) {
            return [];
        }

        const gradeByCode = new Map(
            allExemptionGradeOptions.map(item => [String(item.CODE_ID), item])
        );

        return allowedGradeCodes
            .map(code => gradeByCode.get(code))
            .filter(Boolean);
    }, [allExemptionGradeOptions, dsNewCar.NTAX_TRGET_CD]);
    const isExemptionGradeDisabled = (
        !dsNewCar.NTAX_TRGET_CD
        || dsNewCar.NTAX_TRGET_CD === '00'
        || AUTO_APPLY_EXEMPTION_TARGET_CODES.has(String(dsNewCar.NTAX_TRGET_CD))
    );
    const bankOptions = useMemo(
        () => getCodeOptions(codes, 'BANK', FALLBACK_BANKS),
        [codes]
    );
    const selectedExemptionDocInfo = useMemo(
        () => getExemptionDocumentInfo(dsNewCar.NTAX_TRGET_CD, exemptionTargetOptions),
        [dsNewCar.NTAX_TRGET_CD, exemptionTargetOptions]
    );
    const showFamilyRelationNumberNote = hasFamilyRelationDocument(selectedExemptionDocInfo);

    // 예상금액 계산 기준 key 생성함.
    // 주요 입력값 변경 시 재계산 안내 표시용으로 사용함.
    const estimateKey = buildNewcarEstimateKey({ dsNewCar, dsWorkCp });

    const estimateDirty = Boolean(estimateSummary && estimateSummary.key !== estimateKey);

    useEffect(() => {
        if (hasExemption) {
            setIsExemptionOpen(true);
        }
    }, [hasExemption]);

    useEffect(() => {
        if (!setDsNewCar) {
            return;
        }

        const targetCode = String(dsNewCar.NTAX_TRGET_CD ?? '');

        if (!targetCode || targetCode === '00') {
            return;
        }

        const allowedGradeCodes = exemptionGradeOptions.map(item => String(item.CODE_ID));
        const currentGradeCode = String(dsNewCar.NTAX_TRGET_GR_CD ?? '');
        const nextGradeCode = AUTO_APPLY_EXEMPTION_TARGET_CODES.has(targetCode)
            ? (allowedGradeCodes[0] || '')
            : (allowedGradeCodes.includes(currentGradeCode) ? currentGradeCode : '');

        if (currentGradeCode === nextGradeCode) {
            return;
        }

        setDsNewCar(prev => ({
            ...prev,
            NTAX_TRGET_GR_CD: nextGradeCode
        }));
    }, [
        dsNewCar.NTAX_TRGET_CD,
        dsNewCar.NTAX_TRGET_GR_CD,
        exemptionGradeOptions,
        setDsNewCar
    ]);

    useEffect(() => {
        const nextReceiptType = dsTaxReceipt.GUBUN || '';

        if (nextReceiptType !== receiptType) {
            setReceiptType(nextReceiptType);
        }

        if (nextReceiptType !== 'TAX' && taxReceiptSameOwner) {
            setTaxReceiptSameOwner(false);
        }

        if (nextReceiptType !== 'CASH' && cashReceiptPhoneSource) {
            setCashReceiptPhoneSource('');
        }
    }, [cashReceiptPhoneSource, dsTaxReceipt.GUBUN, receiptType, taxReceiptSameOwner]);

    useEffect(() => {
        if (!setDsNewCar) {
            return;
        }

        const isLease = dsNewCar.TASK_CD === 'LEASE' && dsNewCar.PROC_CD === 'I';

        if (isLease || dsNewCar.PAY_HP_NO || !dsNewCar.MPHONE_NO) {
            return;
        }

        setDsNewCar(prev => ({
            ...prev,
            PAY_HP_NO: prev.PAY_HP_NO || prev.MPHONE_NO || ''
        }));
    }, [dsNewCar.MPHONE_NO, dsNewCar.PAY_HP_NO, dsNewCar.PROC_CD, dsNewCar.TASK_CD, setDsNewCar]);

    // 하위 memo 컴포넌트에 전달하는 함수의 참조가 매 렌더마다 바뀌지 않도록
    // useCallback으로 고정한다. updater 함수와 단순 patch 객체를 모두 받을 수 있다.
    const updateNewCar = useCallback((updater) => {
        if (!setDsNewCar) {
            return;
        }

        setDsNewCar(prev => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
    }, [setDsNewCar]);

    const updateTaxReceipt = useCallback((updater) => {
        if (!setDsTaxReceipt) {
            return;
        }

        setDsTaxReceipt(prev => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
    }, [setDsTaxReceipt]);

    // CommonSelect의 표준 change event를 dsNewCar 필드 갱신으로 변환한다.
    // 기존 값과 같으면 이전 객체를 그대로 반환해 불필요한 부모 렌더를 막는다.
    const handleNewCarFieldChange = useCallback((event) => {
        const { name, value } = event.target;
		updateNewCar(prev => ({
		    ...prev,
		    [name]: value,
			// 비과세대상 값을 받아서 비과세적용구분 값 세팅
		    NTAX_APPLC_CD: getApplyCode(value)
		}));
    }, [updateNewCar]);

    // DeferredInput이 조합 완료/debounce/blur 시 전달한 최신 draft를 dsNewCar에 확정한다.
    const commitNewCarField = useCallback((name, value) => {
        updateNewCar(prev => (
            prev[name] === value ? prev : { ...prev, [name]: value }
        ));
    }, [updateNewCar]);

    // 세금계산서 문자 입력용 확정 콜백이다.
    const commitTaxReceiptField = useCallback((name, value) => {
        updateTaxReceipt(prev => (
            prev[name] === value ? prev : { ...prev, [name]: value }
        ));
    }, [updateTaxReceipt]);

    const getOwnerTaxReceiptDefaults = () => {
        const isLease = dsNewCar.TASK_CD === 'LEASE' && dsNewCar.PROC_CD === 'I';
        const isUserLease = dsNewCar.TASK_CD === 'LEASE' && dsNewCar.PROC_CD === 'C';
        const isCorporateOwner = ['B', 'C'].includes(dsNewCar.REG_GB);
        const selectedLeaseBase = dsBaseList.find(item => (
            String(item.BASE_ID) === String(dsNewCar.BASE_BRANCH_ID)
        ));
        const leaseCompanyName = String(selectedLeaseBase?.BASE_NM ?? '')
            .replace(/주식회사/g, '')
            .replace(/\(.*?\)/g, '')
            .trim();
        const useLeaseCompany = isLease || isUserLease;

        return {
            // 주민/외국인 등록번호는 세금계산서 사업자번호로 사용할 수 없다.
            REG_NO: useLeaseCompany
                ? (selectedLeaseBase?.BIZ_NO || '')
                : (isCorporateOwner ? (dsNewCar.BIZ_NO || '') : ''),
            COMPANY_NM: isUserLease
                ? leaseCompanyName
                : ((isLease || isCorporateOwner) ? (dsNewCar.OWNER_NM || '') : ''),
            NAME: '',
            ADDR: useLeaseCompany
                ? (selectedLeaseBase?.ADDRESS || '')
                : (isCorporateOwner ? (dsNewCar.ADDRESS || '') : ''),
            ADDR_DT: useLeaseCompany
                ? (selectedLeaseBase?.ADDRESS_DT || '')
                : (isCorporateOwner ? (dsNewCar.ADDRESS_DT || '') : ''),
            POST_NO: useLeaseCompany
                ? (selectedLeaseBase?.POST_NO || '')
                : (isCorporateOwner ? (dsNewCar.POST_NO || '') : ''),
            BUSINESS_TYPE: '',
            INDUSTRY_TYPE: '',
            MAIL1: '',
            MAIL2: ''
        };
    };

    const showAlert = useCallback((message) => {
        if (gf?.alert) {
            return gf.alert(message);
        }

        window.alert(message);
        return Promise.resolve();
    }, []);

    // 실제 계산식은 newcarAmountCalculator.js의 calculateNewcarEstimate() 한 곳에서 처리한다.
    // 이 화면은 조회가 끝난 dsNewCar와 현재 결제목록을 계산기에 전달하고 결과를 state에 반영한다.
    // 화면에서 금액을 별도로 다시 계산하면 요약 카드와 DB 저장값이 달라질 수 있으므로 금지한다.
    const getEstimateResult = (newCar = dsNewCar) => calculateNewcarEstimate({
        dsNewCar: newCar,
        dsService,
        dsPaymentList,
        dsWorkCp,
        codes
    });

    /**
     * 계산에 필요한 서버 기준정보를 모아 calculateNewcarEstimate() 입력 객체를 만든다.
     *
     * 1. /car-spec: 로그인 회사별 Maker + 화면 차명으로 TR_CAR_SPEC 조회
     * 2. /tax-info: WORK_CD=010의 현재 TM_TAX와 친환경 공통코드 조회
     * 3. 차량제원을 dsNewCar 형식으로 매핑한 뒤 공채 사전 전액면제 여부 확인
     * 4. 면제면 TM_BOND 조회를 생략하고 0%, 아니면 /bond-rate로 현재 요율 조회
     *
     * 여기서 만든 BOND_*와 TM_TAX_INFO는 계산 기준값이다. 서버 저장 컬럼을 추가하려는 경우
     * 이 patch에 넣는 것만으로 끝내지 말고 TR_NEWCAR 매퍼의 실제 컬럼 매핑도 확인해야 한다.
     */
    const getCarSpecForEstimate = async () => {
        const carName = String(dsNewCar.CAR_NM ?? '').trim();
        const baseAddress = String(dsNewCar.BASE_ADDRESS ?? '').trim();

        if (!carName) {
            throw new Error('차량명을 입력해주세요.');
        }

        if (!baseAddress) {
            throw new Error('사용본거지 주소를 입력해주세요.');
        }

        // 친환경 감면 안내와 동일한 차량제원/세율정보 조회를 사용한다.
        const { carSpecPatch, taxInfo } = await getEstimateVehicleInfo(dsNewCar);
        const bondSearchCriteria = resolveBondSearchCriteria({
            ...dsNewCar,
            ...carSpecPatch
        });

        const estimateNewCar = { ...dsNewCar, ...carSpecPatch, TM_TAX_INFO: taxInfo };
        const bondPreExemption = resolveBondPreExemption(estimateNewCar, codes);

        // 비과세·1600cc 미만·친환경 지역·리스 등 전액면제는 TM_BOND를 조회하지 않는다.
        // 조회를 생략해도 뒤 계산기가 동일한 결과 형식을 받도록 0% 응답 모양을 만들어 전달한다.
        const bondRateRequest = bondPreExemption.exempt
            ? Promise.resolve({
                data: {
                    data: {
                        BOND_RATE: 0,
                        AREA: bondSearchCriteria.area,
                        BOND_GB: 'N',
                        FULL_EXEMPT_YN: 'Y',
                        EXEMPT_REASON: bondPreExemption.reason
                    }
                }
            })
            : axios.get('/api/newcar/bond-rate', {
                params: {
                    baseAddress: bondSearchCriteria.area,
                    carGb: bondSearchCriteria.carGb,
                    baseValue: bondSearchCriteria.baseValue
                }
            });
        const bondRateResponse = await bondRateRequest;
        const bondRateInfo = bondRateResponse.data?.data;

        if (!bondRateInfo || bondRateInfo.BOND_RATE === undefined || bondRateInfo.BOND_RATE === null) {
            throw new Error('공채 매입률 조회 결과가 없습니다.');
        }

        // 조회 기준값은 예상금액 계산에만 합치며 TR_NEWCAR 저장 필드에는 별도 매핑하지 않음.
        const estimatePatch = {
            ...carSpecPatch,
            BOND_RATE: bondRateInfo.BOND_RATE,
            BOND_AREA: bondRateInfo.AREA ?? '',
            BOND_GB: bondRateInfo.BOND_GB ?? '',
            BOND_FULL_EXEMPT_YN: bondRateInfo.FULL_EXEMPT_YN ?? 'N',
            BOND_RATE_BASE1: bondRateInfo.BASE1 ?? '',
            BOND_RATE_BASE2: bondRateInfo.BASE2 ?? '',
            BOND_SEARCH_CAR_GB: bondSearchCriteria.carGb,
            BOND_SEARCH_BASE_VALUE: bondSearchCriteria.baseValue,
            TM_TAX_INFO: taxInfo
        };

        return {
            carSpecPatch: estimatePatch,
            newCar: {
                ...dsNewCar,
                ...estimatePatch
            }
        };
    };

    const handleBondSelect = (value) => {
        updateNewCar(prev => ({
            ...prev,
            BOND_YN: 'Y',
            BOND_DC: value
        }));
    };

    const handleExemptionToggle = useCallback(() => {
        if (isExemptionOpen) {
            updateNewCar(prev => ({
                ...prev,
                NTAX_WHO: 'REPRE',
                NTAX_TRGET_CD: '00',
                NTAX_TRGET_GR_CD: '0',
                NTAX_APPLC_CD: '0'
            }));
            setIsExemptionOpen(false);
            return;
        }

        setExemptionNotice({ type: 'existing' });
    }, [isExemptionOpen, updateNewCar]);

    const handleExemptionWarningConfirm = useCallback(() => {
        if (exemptionNotice?.type === 'eco') {
            updateNewCar(prev => ({
                ...prev,
                NTAX_TRGET_CD: exemptionNotice.targetCode
            }));
            setExemptionNotice(null);
            return;
        }

        setExemptionNotice(null);
        updateNewCar(prev => ({
            ...prev,
			NTAX_WHO: dsNewCar.RATIO_NO === 100
			            ? (prev.NTAX_WHO || 'REPRE')
			            : '',
            NTAX_TRGET_CD: prev.NTAX_TRGET_CD === '00' ? '' : (prev.NTAX_TRGET_CD || ''),
            NTAX_TRGET_GR_CD: prev.NTAX_TRGET_GR_CD || '0'
        }));
        setIsExemptionOpen(true);
    }, [exemptionNotice, updateNewCar]);

	// 비과세대상(NTAX_TRGET_CD)을 받아서 비과세적용구분(NTAX_APPLC_CD) 값 세팅
	const getApplyCode = value =>
	    !value || value === '00' ? '0' : '11';
	
	// 감면대상 변경
    const handleExemptionFieldChange = useCallback(async (event) => {
        const { name, value } = event.target;

		// 교환자동차 감면 선택
		if (name === 'NTAX_TRGET_CD' && String(value) === '09') {
			handleNewCarFieldChange(event); // 09 선택값 반영, 선택 안 되게 하려면 이거 주석처리하면 됨 
			
		    setExemptionNotice({type: 'exchange'});
			
		    return;
		}
		
        if (name === 'NTAX_TRGET_CD' && String(value) === '12' && !isJsaEligibleAddress) {
            await showAlert('사용본거지 주소가 대성동길 또는 조산리인 경우에만 공동경비구역 거주자를 선택할 수 있습니다.');
            return;
        }
		
        const ecoNotice = name === 'NTAX_TRGET_CD'
            ? ECO_EXEMPTION_NOTICE_BY_CODE[String(value)]
            : null;

        if (!ecoNotice) {
            handleNewCarFieldChange(event);
            return;
        }

        try {
            const { carSpecPatch, taxInfo } = await getEstimateVehicleInfo(dsNewCar);
            const ecoEligible = isEcoAcquisitionEligible({
                dsNewCar: {
                    ...dsNewCar,
                    ...carSpecPatch,
                    TM_TAX_INFO: taxInfo
                },
                codes
            });

            if (ecoEligible) {
                setExemptionNotice({
                    type: 'eco',
                    targetCode: String(value)
                });
                return;
            }

			updateNewCar(prev => ({
			    ...prev,
			    [name]: value,
				// 비과세대상 값을 받아서 비과세적용구분 값 세팅
			    NTAX_APPLC_CD: getApplyCode(value)
			}));
        } catch (error) {
            const message = error.response?.data?.message || error.message || '친환경 차량 여부를 확인하지 못했습니다.';
            await showAlert(message);
        }
    }, [codes, dsNewCar, handleNewCarFieldChange, isJsaEligibleAddress, showAlert, updateNewCar]);

    const handleCardToggle = () => {
        updateNewCar(prev => {
            const cardYn = prev.CARD_YN === 'Y' ? 'N' : 'Y';
            const recalculatedTotal = calculateTotalFromRows(dsPaymentList, cardYn);

            return {
                ...prev,
                CARD_YN: cardYn,
                TOTAL_AMT: recalculatedTotal ?? prev.TOTAL_AMT
            };
        });
    };

    const handleEstimateClick = async () => {
        if (!dsNewCar.BOND_DC) {
            await showAlert('채권 처리 방식을 선택해주세요.');
            return;
        }

        setEstimating(true);

        try {
            // 조회 결과를 합친 newCar로 계산해야 차량제원/세율/공채요율이 한 계산에 함께 반영된다.
            const { carSpecPatch, newCar } = await getCarSpecForEstimate();
            const result = getEstimateResult(newCar);

            // 결제항목별 PRE_PAY_AMT/PAY_AMT와 BOND.REAL_ALOAN을 state에 반영한다.
            // 실제 DB 저장은 3단계에서 다음 버튼을 눌러 WaNewcarRequest.saveProcess()가 호출될 때 수행된다.
            setDsPaymentList?.(result.updatedPaymentList);
            // 조회한 차량제원과 TR_NEWCAR 저장 대상 금액 필드를 같은 시점에 반영한다.
            // PREREG_AMT/TOTAL_AMT=합계, BOND_AMT=선택한 BUY/SELL 방식의 실제 채권 납부액이다.
            updateNewCar(prev => ({
                ...prev,
                ...carSpecPatch,
                PREREG_AMT: result.totalAmt,
                TOTAL_AMT: result.totalAmt,
                BOND_AMT: result.bond,
                STANDARD_AMT: result.taxableStandard,
                NTAX_APPLC_CD: result.ntaxApplyCode
            }));
            setEstimateSummary(result);
        } catch (error) {
            const message = error?.response?.data?.message
                || error?.message
                || '예상금액 기준정보 조회 중 오류가 발생했습니다.';
            await showAlert(message);
        } finally {
            setEstimating(false);
        }
    };

    const handleReceiptSelect = (type) => {
        setReceiptType(type);

        if (type === 'CASH') {
            setCashReceiptPhoneSource('');
            updateTaxReceipt(prev => ({
                ...prev,
                GUBUN: type,
                PHONE_NO: prev.GUBUN === 'CASH' ? prev.PHONE_NO : '',
                REG_NO: '',
                NAME: '',
                COMPANY_NM: '',
                ADDR: '',
                ADDR_DT: '',
                POST_NO: '',
                BUSINESS_TYPE: '',
                INDUSTRY_TYPE: '',
                MAIL1: '',
                MAIL2: ''
            }));
            return;
        }

        updateTaxReceipt(prev => ({
            ...prev,
            GUBUN: type,
			PHONE_NO: '',
			REG_NO: '',
			COMPANY_NM: '',
			NAME: '',
			ADDR: '',
			ADDR_DT: '',
			POST_NO: ''
        }));
    };

    const handleReceiptClose = () => {
        setReceiptType('');
        setTaxReceiptSameOwner(false);
        setCashReceiptPhoneSource('');
        updateTaxReceipt({ GUBUN: '' });
    };

    const handleCashReceiptPhoneSource = (source, checked) => {
        setCashReceiptPhoneSource(checked ? source : '');

        if (!checked) {
            updateTaxReceipt({ GUBUN: 'CASH', PHONE_NO: '' });
            return;
        }

        updateTaxReceipt({
            GUBUN: 'CASH',
            PHONE_NO: source === 'OWNER' ? dsNewCar.MPHONE_NO : dsNewCar.PAY_HP_NO
        });
    };

    const handleTaxReceiptSameOwner = (checked) => {
        setTaxReceiptSameOwner(checked);

        if (!checked) {
            updateTaxReceipt(prev => ({
                ...prev,
                REG_NO: '',
                COMPANY_NM: '',
                NAME: '',
                ADDR: '',
                ADDR_DT: '',
                POST_NO: '',
                BUSINESS_TYPE: '',
                INDUSTRY_TYPE: '',
                MAIL1: '',
                MAIL2: ''
            }));
            return;
        }

        updateTaxReceipt(prev => ({
            ...prev,
            ...getOwnerTaxReceiptDefaults(),
            GUBUN: 'TAX'
        }));
    };

    return (
        <div className="wa-form-body wa-newcar-info-body">
            <div className="wa-info-section">
                <div className="wa-form-row">
                    <label className="wa-form-label">채권 처리 선택</label>

                    <div className="wa-form-control">
                        <div className="wa-inline-group">
                            {BOND_OPTIONS.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`wa-option-btn wa-flex ${dsNewCar.BOND_DC === option.value ? 'active' : ''}`}
                                    aria-pressed={dsNewCar.BOND_DC === option.value}
                                    onClick={() => handleBondSelect(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 감면과 무관한 문자 입력 시 감면 영역 전체가 다시 렌더되지 않도록 분리함. */}
                <ExemptionSection
                    open={isExemptionOpen}
                    whoCode={dsNewCar.NTAX_WHO ?? ''}
                    targetCode={dsNewCar.NTAX_TRGET_CD ?? ''}
                    gradeCode={dsNewCar.NTAX_TRGET_GR_CD ?? ''}
                    whoOptions={exemptionWhoOptions}
                    targetOptions={exemptionTargetOptions}
                    gradeOptions={exemptionGradeOptions}
                    gradeDisabled={isExemptionGradeDisabled}
                    selectedDocumentInfo={selectedExemptionDocInfo}
                    showFamilyRelationNumberNote={showFamilyRelationNumberNote}
                    onToggle={handleExemptionToggle}
                    onFieldChange={handleExemptionFieldChange}
                />

                <button
                    type="button"
                    className={`wa-sub-btn ${dsNewCar.CARD_YN === 'Y' ? 'active' : ''}`}
                    aria-pressed={dsNewCar.CARD_YN === 'Y'}
                    onClick={handleCardToggle}
                >
                    <CreditCard size={18} />
                    취득세 카드 납부 시 클릭
                    {dsNewCar.CARD_YN === 'Y' && <CheckCircle2 size={16} />}
                </button>

                <div className="wa-estimate-action-row">
                    <button
                        type="button"
                        className="wa-check-btn"
                        disabled={estimating}
                        onClick={handleEstimateClick}
                    >
                        {estimating ? <LoaderCircle size={18} className="wa-spin" /> : <Calculator size={18} />}
                        예상납부금액 확인
                    </button>

                    <button
                        type="button"
                        className="wa-refresh-btn"
                        disabled={estimating || !estimateSummary}
                        title="결제정보 업데이트"
                        aria-label="결제정보 업데이트"
                        onClick={handleEstimateClick}
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                {/* 정렬·금액 포맷이 포함된 계산 결과 영역은 계산값 변경 시에만 렌더함. */}
                <EstimateResultPanel
                    estimating={estimating}
                    estimateSummary={estimateSummary}
                    estimateDirty={estimateDirty}
                />
            </div>

            <hr className="wa-divider" />

            <div className="wa-info-section">
                <div className="wa-form-row">
					<label className="wa-form-label">
					    {dsNewCar?.PROC_CD === "C" || dsNewCar?.TASK_CD === "LEASE"
						        ? "리스 담당자 연락처"
						        : "결제자 연락처"}
					</label>

                    <div className="wa-form-control">
                        <div className="wa-inline-group">
                            <SplitInput
                                value={dsNewCar.PAY_HP_NO ?? ''}
                                lengths={PHONE_PART_LENGTHS}
                                fixedValues={PHONE_FIXED_VALUES}
                                placeholders={PHONE_PLACEHOLDERS}
                                deferred
                                onChange={value => updateNewCar({ PAY_HP_NO: value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="wa-form-row">
                    <label className="wa-form-label">수수료 증빙 선택</label>

                    <div className="wa-form-control">
                        <div className="wa-inline-group">
                            <button
                                type="button"
                                className={`wa-option-btn wa-flex ${receiptType === 'CASH' ? 'active' : ''}`}
                                onClick={() => handleReceiptSelect('CASH')}
                            >
                                현금영수증
                            </button>
                            <button
                                type="button"
                                className={`wa-option-btn wa-flex ${receiptType === 'TAX' ? 'active' : ''}`}
                                onClick={() => handleReceiptSelect('TAX')}
                            >
                                세금계산서
                            </button>
                        </div>

                        {receiptType && (
                            <div className="wa-receipt-panel" role="dialog" aria-label="수수료 증빙 정보">
                                <div className="wa-receipt-panel-header">
                                    <strong>{receiptType === 'CASH' ? '현금영수증 정보 입력' : '세금계산서 정보 입력'}</strong>
                                    <button
                                        type="button"
                                        aria-label="수수료 증빙 정보 닫기"
                                        onClick={handleReceiptClose}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {receiptType === 'CASH' ? (
                                    <>
                                        <div className="wa-receipt-phone-presets">
                                            <label className="wa-form-sub-label">
                                                소유자와 동일
                                                <input
                                                    type="checkbox"
                                                    checked={cashReceiptPhoneSource === 'OWNER'}
                                                    onChange={event => handleCashReceiptPhoneSource('OWNER', event.target.checked)}
                                                />
                                            </label>
                                            <label className="wa-form-sub-label">
                                                결제자와 동일
                                                <input
                                                    type="checkbox"
                                                    checked={cashReceiptPhoneSource === 'PAYER'}
                                                    onChange={event => handleCashReceiptPhoneSource('PAYER', event.target.checked)}
                                                />
                                            </label>
                                        </div>
                                        <div className="wa-form-row compact">
                                            <label className="wa-form-label">휴대폰번호</label>
                                            <div className="wa-form-control">
                                                <div className="wa-inline-group">
                                                    <SplitInput
                                                        value={dsTaxReceipt.PHONE_NO ?? ''}
                                                        lengths={PHONE_PART_LENGTHS}
                                                        fixedValues={PHONE_FIXED_VALUES}
                                                        placeholders={PHONE_PLACEHOLDERS}
                                                        deferred
                                                        onChange={value => {
                                                            setCashReceiptPhoneSource('');
                                                            updateTaxReceipt({ GUBUN: 'CASH', PHONE_NO: value });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <label className="wa-form-sub-label receipt-same-owner">
                                            소유자와 동일
                                            <input
                                                type="checkbox"
                                                checked={taxReceiptSameOwner}
                                                onChange={e => handleTaxReceiptSameOwner(e.target.checked)}
                                            />
                                        </label>

                                        <div className="wa-form-row compact">
                                            <label className="wa-form-label">등록번호</label>
                                            <div className="wa-form-control">
                                                <div className="wa-inline-group">
                                                    <SplitInput
                                                        value={dsTaxReceipt.REG_NO ?? ''}
                                                        lengths={BUSINESS_NO_PART_LENGTHS}
                                                        placeholders={BUSINESS_NO_PLACEHOLDERS}
                                                        deferred
                                                        onChange={value => updateTaxReceipt({ REG_NO: value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="wa-tax-receipt-grid">
                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">상호명</label>
                                                <div className="wa-form-control">
                                                    {/* 문자 조합 중에는 이 input만 렌더하고 완성값만 dsTaxReceipt에 반영함. */}
                                                    <DeferredInput
                                                        key={`${dsService.SERVICE_ID || 'new'}:COMPANY_NM`}
                                                        className="wa-input"
                                                        maxLength={50}
                                                        name="COMPANY_NM"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.COMPANY_NM ?? ''}
                                                        onCommit={commitTaxReceiptField}
                                                        placeholder="상호명을 입력하세요"
                                                    />
                                                </div>
                                            </div>

                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">대표자명</label>
                                                <div className="wa-form-control">
                                                    <DeferredInput
                                                        key={`${dsService.SERVICE_ID || 'new'}:NAME`}
                                                        className="wa-input"
                                                        maxLength={50}
                                                        name="NAME"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.NAME ?? ''}
                                                        onCommit={commitTaxReceiptField}
                                                        placeholder="대표자명을 입력하세요"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <AddressSearch
                                            label="사업장주소"
                                            placeholder="건물, 지번 또는 도로명 검색"
                                            type="ADDR"
                                            detailName="ADDR_DT"
											postName="POST_NO"
                                            addressMaxLength={70}
                                            detailMaxLength={70}
                                            data={dsTaxReceipt}
                                            dataType="taxReceipt"
                                            handleChange={handleChange}
                                            onSelect={onTaxReceiptAddressSelect}
                                            onClear={onTaxReceiptAddressClear}
                                        />

                                        <div className="wa-tax-receipt-grid">
                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">업태</label>
                                                <div className="wa-form-control">
                                                    <DeferredInput
                                                        key={`${dsService.SERVICE_ID || 'new'}:BUSINESS_TYPE`}
                                                        className="wa-input"
                                                        maxLength={10}
                                                        name="BUSINESS_TYPE"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.BUSINESS_TYPE ?? ''}
                                                        onCommit={commitTaxReceiptField}
                                                        placeholder="업태를 입력하세요"
                                                    />
                                                </div>
                                            </div>

                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">업종</label>
                                                <div className="wa-form-control">
                                                    <DeferredInput
                                                        key={`${dsService.SERVICE_ID || 'new'}:INDUSTRY_TYPE`}
                                                        className="wa-input"
                                                        maxLength={10}
                                                        name="INDUSTRY_TYPE"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.INDUSTRY_TYPE ?? ''}
                                                        onCommit={commitTaxReceiptField}
                                                        placeholder="업종을 입력하세요"
                                                    />
                                                </div>
                                            </div>
											
											{/*
                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">이메일주소</label>
                                                <div className="wa-form-control">
                                                    <DeferredInput
                                                        key={`${dsService.SERVICE_ID || 'new'}:MAIL1`}
                                                        className="wa-input"
                                                        maxLength={50}
                                                        name="MAIL1"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.MAIL1 ?? ''}
                                                        onCommit={commitTaxReceiptField}
                                                        sanitizeValue={removeHangul}
                                                        placeholder="example@company.com"
                                                    />
                                                </div>
                                            </div>

                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">이메일주소2</label>
                                                <div className="wa-form-control">
                                                    <DeferredInput
                                                        key={`${dsService.SERVICE_ID || 'new'}:MAIL2`}
                                                        className="wa-input"
                                                        maxLength={50}
                                                        name="MAIL2"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.MAIL2 ?? ''}
                                                        onCommit={commitTaxReceiptField}
                                                        sanitizeValue={removeHangul}
                                                        placeholder="추가 수신 이메일"
                                                    />
                                                </div>
                                            </div>*/}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Trace에서 입력 지연이 확인된 환불 입력 영역을 로컬 draft로 격리함. */}
                <RefundAccountFields
                    recordKey={dsService.SERVICE_ID || 'new'}
                    returnName={dsNewCar.RETURN_NM ?? ''}
                    bankCode={dsNewCar.RT_BANK_CD ?? ''}
                    returnAccount={dsNewCar.RETURN_NO ?? ''}
                    bankOptions={bankOptions}
                    onFieldChange={handleNewCarFieldChange}
                    onFieldCommit={commitNewCarField}
					dsTaxReceipt={dsTaxReceipt}
					receiptType={receiptType}
					onTaxReceiptCommit={commitTaxReceiptField}
                />

            </div>

            <ExemptionWarningModal
                notice={exemptionNotice}
                onClose={() => setExemptionNotice(null)}
                onConfirm={handleExemptionWarningConfirm}
            />
        </div>
    );
};

// 부모의 hover/모달 등 신규등록 입력과 무관한 state 변경 시 전체 화면 렌더를 건너뛴다.
export default memo(NewcarInfo);
