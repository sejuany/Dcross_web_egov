import React, { useEffect, useMemo, useState } from 'react';
import {
    Calculator,
    CheckCircle2,
    CircleHelp,
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

const BOND_OPTIONS = [
    { value: 'SELL', label: '매도(할인)' },
    { value: 'BUY', label: '매입' }
];

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
    { CODE_ID: '18', CODE_NM: '다자녀2 + 장애인(중복감면)' },
    { CODE_ID: '19', CODE_NM: '다자녀2 + 시각장애(중복감면)' },
    { CODE_ID: '16', CODE_NM: '다자녀3 + 장애인(중복감면)' },
    { CODE_ID: '17', CODE_NM: '다자녀3 + 시각장애(중복감면)' }
];

const FALLBACK_EXEMPTION_WHO = [
    { CODE_ID: 'REPRE', CODE_NM: '대표소유자' },
    { CODE_ID: 'JOINT', CODE_NM: '공동소유자' }
];

const FALLBACK_EXEMPTION_GRADES = [
    { CODE_ID: '0', CODE_NM: '등급 없음' },
    { CODE_ID: '1', CODE_NM: '1급' },
    { CODE_ID: '2', CODE_NM: '2급' },
    { CODE_ID: '3', CODE_NM: '3급' },
    { CODE_ID: '4', CODE_NM: '4급' },
    { CODE_ID: '5', CODE_NM: '5급' },
    { CODE_ID: '6', CODE_NM: '6급' }
];

const JOINT_OWNER_DOCUMENT_NOTE = '공동명의 신청시\n1. 주민등록등본\n2. 가족관계증명서';
const FAMILY_RELATION_NUMBER_NOTE = '가족관계증명서는 주민번호 뒷번호 모두 표기 되어야 함';
const VEHICLE_EXEMPTION_REFERENCE = [
    '배기량 2,000cc 이하',
    '승차정원 7인승 이상 10인승 이하 승용차',
    '승차정원 15인승 이하 승합차',
    '최대적재량 1톤 이하 화물차',
    '배기량 250cc 이하 이륜자동차'
].join('\n');
const DIVORCED_FAMILY_REFERENCE = [
    '이혼가정 다자녀 요청 서류(양육권 있으나 별거하는 경우)',
    '함양: 주민등록등본, 가족관계증명서(상세)',
    '창원/대구: 주민등록등본, 가족관계증명서(상세), 등본에 자녀 확인이 안 되면 양육권 판결서 또는 관청 확인 필요',
    '부산: 가족관계증명서(상세)',
    '함안: 감면여부 판단이 필요하므로 사용본거지 관청 문의 안내',
    '주민등록등본은 양육권 판결 및 세대당 1대 감면 여부 확인 목적'
].join('\n');

const EXEMPTION_DOCUMENT_INFO = {
    '15': {
        name: '다자녀(2자녀)',
        documents: [
            '감면 신청서',
            '가족관계증명서 (차소유자 기준)',
            '주민등록등본 (차소유주 기준)'
        ],
        note: [
            '재혼가정이 전배우자의 자녀를 포함해 신청하는 경우',
            '1. 혼인관계증명서',
            '2. 주민등록등본',
            '3-1. 가족관계증명서 일반(본인, 현배우자, 본인과 현배우자의 자녀)',
            '3-2. 가족관계증명서 상세(본인, 본인과 전배우자의 자녀)'
        ].join('\n'),
        amount: '70만원',
        reference: DIVORCED_FAMILY_REFERENCE
    },
    '06': {
        name: '다자녀(3자녀)',
        documents: [
            '감면 신청서',
            '가족관계증명서 (차소유자 기준)',
            '주민등록등본 (차소유주 기준)'
        ],
        note: [
            '재혼가정이 전배우자의 자녀를 포함해 신청하는 경우',
            '1. 혼인관계증명서',
            '2. 주민등록등본',
            '3-1. 가족관계증명서 일반(본인, 현배우자, 본인과 현배우자의 자녀)',
            '3-2. 가족관계증명서 상세(본인, 본인과 전배우자의 자녀)'
        ].join('\n'),
        amount: '140만원',
        reference: DIVORCED_FAMILY_REFERENCE
    },
    '01': {
        name: '국가유공자',
        documents: [
            '감면신청서',
            '국가유공자증 또는 국가유공자증명서'
        ],
        note: JOINT_OWNER_DOCUMENT_NOTE,
        amount: '취득세 100% 면제',
        reference: [
            VEHICLE_EXEMPTION_REFERENCE,
            '미성년자 장애인 공동명의건: 미성년자 자동차 취득 동의서, 법정대리인의 인감증명서 또는 본인서명사실확인서, 가족관계증명서 및 기본증명서(상세)'
        ].join('\n')
    },
    '04': {
        name: '장애인',
        documents: [
            '감면신청서',
            '장애인증명서 또는 장애인등록증(복지카드)'
        ],
        note: `${JOINT_OWNER_DOCUMENT_NOTE}\n장애정도가 심한 장애인만 감면 대상`,
        amount: [
            '장애정도가 심한 장애인(기존 1급~3급 중증 장애인) 취득세 100% 면제',
            '차량 1대만 가능',
            '경증 장애인(기존 4급~6급)은 취득세 면제 대상 제외'
        ].join('\n')
    },
    '05': {
        name: '시각장애',
        documents: [
            '감면신청서',
            '장애인증명서 또는 장애인등록증(복지카드)'
        ],
        note: `${JOINT_OWNER_DOCUMENT_NOTE}\n장애정도가 심하지 않은 장애 중 기존 4급일 경우 장애정도결정서 필요`,
        amount: '시각장애 중 기존 4급 취득세 100% 면제'
    },
    '02': {
        name: '5.18 민주화운동대상',
        documents: [
            '감면신청서',
            '5.18 민주화운동부상자로서 신체장애등급 1~14급 대상'
        ],
        note: `${JOINT_OWNER_DOCUMENT_NOTE}\n부상자 본인이 포함되어 있어야 함`,
        amount: '취득세 100% 면제'
    },
    '03': {
        name: '고엽제 후유증 대상',
        documents: [
            '감면신청서',
            '고엽제 적용 대상확인원',
            '고엽제후유의증 환자로서 경도장애 이상'
        ],
        note: JOINT_OWNER_DOCUMENT_NOTE,
        amount: '취득세 100% 면제'
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
        documents: [
            "거주지 주소에 '대송동길'이 확인되면 구비서류 불필요"
        ],
        note: '조례사항으로 지자체마다 확인 필요'
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
            '감면신청서',
            '국가유공자 확인서 또는 국가유공자증(상이등급 표기)'
        ],
        note: '보훈보상대상자로서 상이등급 1~7급(2024.1.1 이후 등록분부터 취득세 50% 감면)',
        amount: '취득세의 50% 면제',
        reference: VEHICLE_EXEMPTION_REFERENCE
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
    '19': {
        name: '다자녀2 + 시각장애(중복감면)',
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
    '17': {
        name: '다자녀3 + 시각장애(중복감면)',
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
    }
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

const PAYMENT_ORDER = ['ACQ', 'UREG', 'INJI', 'STAMP', 'BOND', 'BFEE', 'FEE', 'TNUM', 'UNUM', 'SPARE'];
const ESTIMATE_PAYMENT_KINDS = ['ACQ', 'BOND', 'BFEE', 'FEE', 'INJI', 'STAMP'];

const getCodeOptions = (codes, groupId, fallback = []) => {
    const optionList = codes?.[groupId];
    return Array.isArray(optionList) && optionList.length ? optionList : fallback;
};

const getNumber = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;
const formatAmount = (value) => getNumber(value).toLocaleString();

const getPaymentAmount = (paymentList, payKd, fallback = 0) => {
    const item = paymentList.find(row => row.PAY_KD === payKd);
    const amount = item?.PAY_AMT ?? item?.PRE_PAY_AMT;
    return amount === undefined || amount === null || amount === '' ? fallback : getNumber(amount);
};

const sortPaymentRows = (rows) => [...rows].sort((a, b) => {
    const left = PAYMENT_ORDER.indexOf(a.PAY_KD);
    const right = PAYMENT_ORDER.indexOf(b.PAY_KD);
    return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
});

const buildPaymentRows = (paymentList) => {
    const rows = Array.isArray(paymentList) ? paymentList.filter(row => row?.PAY_KD) : [];
    const rowByKind = new Map(rows.map(row => [row.PAY_KD, row]));

    const estimateRows = ESTIMATE_PAYMENT_KINDS.map(payKd => ({
        PAY_KD: payKd,
        VBANK_NO: '',
        PAY_OP: 'Y',
        PRE_PAY_AMT: 0,
        PAY_AMT: 0,
        PAY_ST: 'N',
        PAY_DT: '',
        ...(rowByKind.get(payKd) || {})
    }));

    const extraRows = rows.filter(row => !ESTIMATE_PAYMENT_KINDS.includes(row.PAY_KD));
    return [...estimateRows, ...extraRows];
};

const calculateTotalFromRows = (paymentList, cardYn) => {
    const rows = Array.isArray(paymentList) ? paymentList.filter(row => row?.PAY_KD) : [];

    if (!rows.length) {
        return null;
    }

    return rows.reduce((sum, row) => {
        if (cardYn === 'Y' && row.PAY_KD === 'ACQ') {
            return sum;
        }

        return sum + getNumber(row.PAY_AMT ?? row.PRE_PAY_AMT);
    }, 0);
};

const NewcarInfo = ({
    dsNewCar = {},
    dsPaymentList = [],
    codes = {},
    handleChange,
    setDsNewCar,
    dsTaxReceipt = {},
    setDsTaxReceipt,
    onTaxReceiptAddressSelect,
    onTaxReceiptAddressClear,
    setDsPaymentList
}) => {
    const hasExemption = Boolean(dsNewCar.NTAX_TRGET_CD && dsNewCar.NTAX_TRGET_CD !== '00');
    const [isExemptionOpen, setIsExemptionOpen] = useState(hasExemption);
    const [estimating, setEstimating] = useState(false);
    const [estimateSummary, setEstimateSummary] = useState(null);
    const [receiptType, setReceiptType] = useState('');
    const [taxReceiptSameOwner, setTaxReceiptSameOwner] = useState(false);

    const exemptionTargetOptions = useMemo(
        () => getCodeOptions(codes, 'NTTCD', FALLBACK_EXEMPTION_TARGETS),
        [codes]
    );
    const exemptionWhoOptions = useMemo(
        () => getCodeOptions(codes, 'NTWHO', FALLBACK_EXEMPTION_WHO),
        [codes]
    );
    const exemptionGradeOptions = useMemo(
        () => getCodeOptions(codes, 'NTTGR', FALLBACK_EXEMPTION_GRADES),
        [codes]
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

    const estimateKey = useMemo(() => [
        dsNewCar.BUY_AMT ?? '',
        dsNewCar.BOND_DC ?? '',
        dsNewCar.CARD_YN ?? '',
        dsNewCar.NTAX_WHO ?? '',
        dsNewCar.NTAX_TRGET_CD ?? '',
        dsNewCar.NTAX_TRGET_GR_CD ?? ''
    ].join('|'), [
        dsNewCar.BUY_AMT,
        dsNewCar.BOND_DC,
        dsNewCar.CARD_YN,
        dsNewCar.NTAX_WHO,
        dsNewCar.NTAX_TRGET_CD,
        dsNewCar.NTAX_TRGET_GR_CD
    ]);

    const estimateDirty = Boolean(estimateSummary && estimateSummary.key !== estimateKey);

    useEffect(() => {
        if (hasExemption) {
            setIsExemptionOpen(true);
        }
    }, [hasExemption]);

    useEffect(() => {
        const nextReceiptType = dsTaxReceipt.GUBUN || '';

        if (nextReceiptType !== receiptType) {
            setReceiptType(nextReceiptType);
        }

        if (nextReceiptType !== 'TAX' && taxReceiptSameOwner) {
            setTaxReceiptSameOwner(false);
        }
    }, [dsTaxReceipt.GUBUN, receiptType, taxReceiptSameOwner]);

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

    const updateNewCar = (updater) => {
        if (!setDsNewCar) {
            return;
        }

        setDsNewCar(prev => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
    };

    const updateTaxReceipt = (updater) => {
        if (!setDsTaxReceipt) {
            return;
        }

        setDsTaxReceipt(prev => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
    };

    const getOwnerTaxReceiptDefaults = () => ({
        REG_NO: dsNewCar.BIZ_NO || dsNewCar.REG_NO || '',
        COMPANY_NM: dsNewCar.OWNER_NM || '',
        NAME: dsNewCar.OWNER_NM || '',
        ADDR: dsNewCar.BASE_ADDRESS || dsNewCar.ADDRESS || '',
        ADDR_DT: dsNewCar.BASE_ADDRESS_DT || dsNewCar.ADDRESS_DT || '',
        POST_NO: dsNewCar.BASE_POST_NO || dsNewCar.POST_NO || ''
    });

    const showAlert = (message) => {
        if (gf?.alert) {
            return gf.alert(message);
        }

        window.alert(message);
        return Promise.resolve();
    };

    const getEstimateResult = () => {
        const buyAmt = getNumber(dsNewCar.BUY_AMT);
        const acqTax = Math.floor((buyAmt * 0.07) / 10) * 10;
        const bondBuyAmt = Math.floor((buyAmt * 0.2) / 10) * 10;
        const bond = Math.floor((buyAmt * 0.2 * 0.1) / 10) * 10;
        const bondFee = Math.floor(((bondBuyAmt * 0.003) + 600) / 10) * 10;
        const paymentRows = buildPaymentRows(dsPaymentList);
        const fee = getPaymentAmount(paymentRows, 'FEE', 27500);
        const stamp = getPaymentAmount(paymentRows, 'STAMP', 2500);
        const inji = getPaymentAmount(paymentRows, 'INJI', 3000);
        const isCardPay = dsNewCar.CARD_YN === 'Y';
        const totalAmt = isCardPay
            ? bond + bondFee + fee + stamp + inji
            : acqTax + bond + bondFee + fee + stamp + inji;

        const calculatedAmounts = {
            ACQ: acqTax,
            BOND: bond,
            BFEE: bondFee,
            FEE: fee,
            INJI: inji,
            STAMP: stamp
        };

        const updatedPaymentList = paymentRows.map(row => (
            Object.prototype.hasOwnProperty.call(calculatedAmounts, row.PAY_KD)
                ? {
                    ...row,
                    PRE_PAY_AMT: calculatedAmounts[row.PAY_KD],
                    PAY_AMT: calculatedAmounts[row.PAY_KD]
                }
                : row
        ));

        return {
            key: estimateKey,
            buyAmt,
            acqTax,
            bond,
            bondFee,
            fee,
            stamp,
            inji,
            isCardPay,
            totalAmt,
            updatedPaymentList
        };
    };

    const handleBondSelect = (value) => {
        updateNewCar(prev => ({
            ...prev,
            BOND_YN: 'Y',
            BOND_DC: value
        }));
    };

    const handleExemptionToggle = () => {
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

        updateNewCar(prev => ({
            ...prev,
            NTAX_WHO: prev.NTAX_WHO || 'REPRE',
            NTAX_TRGET_CD: prev.NTAX_TRGET_CD === '00' ? '' : (prev.NTAX_TRGET_CD || ''),
            NTAX_TRGET_GR_CD: prev.NTAX_TRGET_GR_CD || '0'
        }));
        setIsExemptionOpen(true);
    };

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
            await new Promise(resolve => setTimeout(resolve, 450));
            const result = getEstimateResult();

            setDsPaymentList?.(result.updatedPaymentList);
            updateNewCar(prev => ({
                ...prev,
                PREREG_AMT: result.totalAmt,
                TOTAL_AMT: result.totalAmt,
                BOND_AMT: result.bond
            }));
            setEstimateSummary(result);
        } finally {
            setEstimating(false);
        }
    };

    const handleReceiptSelect = (type) => {
        setReceiptType(type);

        if (type === 'CASH') {
            updateTaxReceipt(prev => ({
                ...prev,
                GUBUN: type,
                PHONE_NO: prev.PHONE_NO || dsNewCar.PAY_HP_NO || dsNewCar.MPHONE_NO || '',
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

        const defaults = getOwnerTaxReceiptDefaults();

        updateTaxReceipt(prev => ({
            ...prev,
            GUBUN: type,
            PHONE_NO: '',
            REG_NO: prev.REG_NO || defaults.REG_NO,
            COMPANY_NM: prev.COMPANY_NM || defaults.COMPANY_NM,
            NAME: prev.NAME || defaults.NAME,
            ADDR: prev.ADDR || defaults.ADDR,
            ADDR_DT: prev.ADDR_DT || defaults.ADDR_DT,
            POST_NO: prev.POST_NO || defaults.POST_NO
        }));
    };

    const handleReceiptClose = () => {
        setReceiptType('');
        setTaxReceiptSameOwner(false);
        updateTaxReceipt({ GUBUN: '' });
    };

    const handleTaxReceiptSameOwner = (checked) => {
        setTaxReceiptSameOwner(checked);

        if (!checked) {
            return;
        }

        updateTaxReceipt(prev => ({
            ...prev,
            ...getOwnerTaxReceiptDefaults(),
            GUBUN: 'TAX'
        }));
    };

    const displayRows = estimateSummary
        ? sortPaymentRows(estimateSummary.updatedPaymentList).filter(row => PAYMENT_LABELS[row.PAY_KD])
        : [];

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

                <button
                    type="button"
                    className={`wa-sub-btn ${isExemptionOpen ? 'active' : ''}`}
                    aria-pressed={isExemptionOpen}
                    onClick={handleExemptionToggle}
                >
                    <CircleHelp size={18} />
                    감면 대상자 해당 시 클릭
                    {isExemptionOpen && <CheckCircle2 size={16} />}
                </button>

                {isExemptionOpen && (
                    <div className="wa-conditional-panel">
                        <div className="wa-form-row">
                            <label className="wa-form-label">감면 대상 정보</label>

                            <div className="wa-form-control">
                                <div className="wa-inline-group wa-select-stack">
                                    <CommonSelect
                                        className="wa-select"
                                        name="NTAX_WHO"
                                        data-type="newcar"
                                        value={dsNewCar.NTAX_WHO ?? ''}
                                        options={exemptionWhoOptions}
                                        onChange={handleChange}
                                    />

                                    <CommonSelect
                                        className="wa-select wa-flex"
                                        name="NTAX_TRGET_CD"
                                        data-type="newcar"
                                        value={dsNewCar.NTAX_TRGET_CD === '00' ? '' : (dsNewCar.NTAX_TRGET_CD ?? '')}
                                        options={exemptionTargetOptions}
                                        onChange={handleChange}
                                    />

                                    <CommonSelect
                                        className="wa-select"
                                        name="NTAX_TRGET_GR_CD"
                                        data-type="newcar"
                                        value={dsNewCar.NTAX_TRGET_GR_CD ?? ''}
                                        options={exemptionGradeOptions}
                                        onChange={handleChange}
                                    />
                                </div>

                                {selectedExemptionDocInfo && (
                                    <div className="wa-required-docs">
                                        <div className="wa-required-docs-heading">
                                            <ReceiptText size={15} />
                                            <strong>{selectedExemptionDocInfo.name} 필요서류</strong>
                                        </div>

                                        <ol className="wa-required-docs-list">
                                            {selectedExemptionDocInfo.documents.map(document => (
                                                <li key={document}>{document}</li>
                                            ))}
                                        </ol>

                                        {selectedExemptionDocInfo.note && (
                                            <div className="wa-required-docs-section">
                                                <strong>비고</strong>
                                                <p>{selectedExemptionDocInfo.note}</p>
                                            </div>
                                        )}

                                        {selectedExemptionDocInfo.amount && (
                                            <div className="wa-required-docs-section">
                                                <strong>감면금액</strong>
                                                <p>{selectedExemptionDocInfo.amount}</p>
                                            </div>
                                        )}

                                        {selectedExemptionDocInfo.reference && (
                                            <div className="wa-required-docs-section">
                                                <strong>참고사항</strong>
                                                <p>{selectedExemptionDocInfo.reference}</p>
                                            </div>
                                        )}

                                        {showFamilyRelationNumberNote && (
                                            <p className="wa-required-docs-footnote">* {FAMILY_RELATION_NUMBER_NOTE}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

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
                                            <td>{isCardExcluded ? '카드납부' : '입금대상'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <hr className="wa-divider" />

            <div className="wa-info-section">
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
                                    <div className="wa-form-row compact">
                                        <label className="wa-form-label">휴대폰번호</label>
                                        <div className="wa-form-control">
                                            <div className="wa-inline-group">
                                                <SplitInput
                                                    value={dsTaxReceipt.PHONE_NO ?? ''}
                                                    lengths={[3, 4, 4]}
                                                    placeholders={['010', '1234', '5678']}
                                                    onChange={value => updateTaxReceipt({ GUBUN: 'CASH', PHONE_NO: value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
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
                                                        lengths={[3, 2, 5]}
                                                        placeholders={['123', '45', '67890']}
                                                        onChange={value => updateTaxReceipt({ REG_NO: value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="wa-tax-receipt-grid">
                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">상호명</label>
                                                <div className="wa-form-control">
                                                    <input
                                                        className="wa-input"
                                                        name="COMPANY_NM"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.COMPANY_NM ?? ''}
                                                        onChange={handleChange}
                                                        placeholder="상호명을 입력하세요"
                                                    />
                                                </div>
                                            </div>

                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">대표자명</label>
                                                <div className="wa-form-control">
                                                    <input
                                                        className="wa-input"
                                                        name="NAME"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.NAME ?? ''}
                                                        onChange={handleChange}
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
                                                    <input
                                                        className="wa-input"
                                                        name="BUSINESS_TYPE"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.BUSINESS_TYPE ?? ''}
                                                        onChange={handleChange}
                                                        placeholder="업태를 입력하세요"
                                                    />
                                                </div>
                                            </div>

                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">업종</label>
                                                <div className="wa-form-control">
                                                    <input
                                                        className="wa-input"
                                                        name="INDUSTRY_TYPE"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.INDUSTRY_TYPE ?? ''}
                                                        onChange={handleChange}
                                                        placeholder="업종을 입력하세요"
                                                    />
                                                </div>
                                            </div>

                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">이메일주소</label>
                                                <div className="wa-form-control">
                                                    <input
                                                        className="wa-input"
                                                        name="MAIL1"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.MAIL1 ?? ''}
                                                        onChange={handleChange}
                                                        placeholder="example@company.com"
                                                    />
                                                </div>
                                            </div>

                                            <div className="wa-form-row compact">
                                                <label className="wa-form-label">이메일주소2</label>
                                                <div className="wa-form-control">
                                                    <input
                                                        className="wa-input"
                                                        name="MAIL2"
                                                        data-type="taxReceipt"
                                                        value={dsTaxReceipt.MAIL2 ?? ''}
                                                        onChange={handleChange}
                                                        placeholder="추가 수신 이메일"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="wa-form-row">
                    <label className="wa-form-label">결제자 연락처</label>

                    <div className="wa-form-control">
                        <div className="wa-inline-group">
                            <SplitInput
                                value={dsNewCar.PAY_HP_NO ?? ''}
                                lengths={[3, 4, 4]}
                                placeholders={['010', '1234', '5678']}
                                onChange={value => updateNewCar({ PAY_HP_NO: value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="wa-form-row">
                    <label className="wa-form-label">환불정보</label>

                    <div className="wa-form-control">
                        <div className="wa-inline-group wa-refund-group">
                            <CommonSelect
                                className="wa-select"
                                name="RT_BANK_CD"
                                data-type="newcar"
                                value={dsNewCar.RT_BANK_CD ?? ''}
                                options={bankOptions}
                                onChange={handleChange}
                            />

                            <input
                                className="wa-input wa-flex"
                                name="RETURN_NO"
                                data-type="newcar"
                                value={dsNewCar.RETURN_NO ?? ''}
                                onChange={handleChange}
                                placeholder="계좌번호 입력"
                            />

                            <input
                                className="wa-input refund-owner"
                                name="RETURN_NM"
                                data-type="newcar"
                                value={dsNewCar.RETURN_NM ?? ''}
                                onChange={handleChange}
                                placeholder="예금주"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewcarInfo;