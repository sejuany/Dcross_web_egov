import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BarChart3, Download, RotateCcw, Search, X } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { exportRowsToXlsx } from '../../../utils/xlsxExport';
import '../../styles/wa.css';

// 검색 기간 기준, 빠른 기간 버튼, 상단 기능 버튼의 고정 옵션을 정의함
const dateTypeOptions = [
    { value: 'PROC_DT', label: '처리일' },
    { value: 'REQUEST_DT', label: '신청일' }
];

const quickDateButtons = [
    { key: 'today', label: '오늘', startOffset: 0 },
    { key: 'week', label: '1주일', startOffset: -7 },
    { key: 'month', label: '1개월', startOffset: -30 }
];

const headerActionButtons = [
    { key: 'search', label: '조회', Icon: Search, variant: 'primary' },
    { key: 'statistics', label: '통계', Icon: BarChart3, variant: 'outline' },
    { key: 'export', label: '엑셀', Icon: Download, variant: 'outline' },
    { key: 'reset', label: '초기화', Icon: RotateCcw, variant: 'outline' },
    { key: 'close', label: '닫기', Icon: X, variant: 'outline' }
];

// 회사 선택 가능 권한을 정의함
// 목록에 없는 권한은 로그인 계정의 회사로 검색 범위를 고정함
const companySelectableMemberGbs = ['UU', 'UA', 'GU', 'NA'];

// 납부상태 검색 select와 백엔드 PAY_STATUS 값을 연결함
const paymentStatusOptions = [
    { value: '', label: '전체' },
    { value: 'PAID', label: '납부' },
    { value: 'REG_PAID', label: '등록비용 납부' },
    { value: 'BPAY_PAID', label: '차량대금 납부' },
    { value: 'UNPAID', label: '미납' }
];

// 그리드 컬럼 폭, 왼쪽 고정 컬럼, 표시 순서를 정의함
// PINNED_COLUMN_KEYS 순서대로 sticky left 값을 누적 계산함
const DEFAULT_MIN_COLUMN_WIDTH = 56;
const PINNED_COLUMN_KEYS = ['SEQ', 'LINK_ID', 'CARID_NO', 'CAR_NO', 'PROC_ST', 'PAY_STATUS_NM'];
const PINNED_COLUMN_SET = new Set(PINNED_COLUMN_KEYS);

const columns = [
    { key: 'SEQ', label: '순번', width: 52, minWidth: 44, sortType: 'number' },
    { key: 'LINK_ID', label: '주문번호', width: 106, minWidth: 74 },
    { key: 'CARID_NO', label: '차대번호', width: 156, minWidth: 100 },
    { key: 'CAR_NO', label: '차량번호', width: 104, minWidth: 72 },
    { key: 'PROC_ST', label: '처리상태', type: 'processStatus', width: 98, minWidth: 68 },
    { key: 'PAY_STATUS_NM', label: '납부상태', type: 'paymentStatus', width: 108, minWidth: 78 },
    { key: 'ACQ_AMT', label: '취득세', width: 96, minWidth: 72, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'REGIS_AMT', label: '등록면허세', width: 104, minWidth: 78, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'INJI_AMT', label: '인지세', width: 88, minWidth: 70, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'STAMP_AMT', label: '증지대', width: 88, minWidth: 70, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'BOND_AMT', label: '채권', width: 96, minWidth: 72, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'BFEE_AMT', label: '채권취급수수료', width: 122, minWidth: 86, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'FEE_AMT', label: '등록수수료', width: 96, minWidth: 72, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'NUMP_AMT', label: '번호판대', width: 96, minWidth: 72, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'TOTAL_AMT', label: '입금총액', width: 104, minWidth: 78, sortType: 'number', className: 'number-cell wa-pay-highlight-amount' },
    { key: 'BRANCH_NM', label: 'SPACE', width: 116, minWidth: 72 },
    { key: 'MEMBER_NM', label: '담당SP', width: 112, minWidth: 76 },
    { key: 'REQUEST_DT', label: '신청일자', width: 98, minWidth: 76, sortType: 'date' },
    { key: 'BPAY_DT', label: '차량대금 납부일자', width: 126, minWidth: 88, sortType: 'date' },
    { key: 'REGIST_DT', label: '등록일자', width: 98, minWidth: 76, sortType: 'date' },
    { key: 'VBANK_NO', label: '가상계좌', width: 132, minWidth: 92 }
];

// 날짜/숫자/코드 표시를 맞추는 공통 포맷 유틸을 관리함
// date input은 yyyy-MM-dd, 서버 조회값은 yyyyMMdd 기반으로 처리함
const formatDateInputValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const getFormattedDateOffset = (offsetDays) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);

    return formatDateInputValue(date);
};

// 로그인 사용자 객체에서 대소문자/스네이크/카멜 케이스가 섞인 키를 순서대로 탐색함
// 값이 비어 있으면 다음 후보 키를 확인하고 최종적으로 빈 문자열을 반환함
const getUserValue = (user, keys) => {
    for (const key of keys) {
        const value = user?.[key];

        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }

    return '';
};

const getUserCompanyId = (user) => getUserValue(user, [
    'COMPANY_ID',
    'company_ID',
    'companyId',
    'company_id'
]).toUpperCase();

const getUserCompanyName = (user) => getUserValue(user, [
    'COMPANY_NM',
    'company_NM',
    'companyNm',
    'company_nm',
    'COMPANY_NAME',
    'companyName'
]);

const getUserMemberGb = (user) => getUserValue(user, [
    'MEMBER_GB',
    'member_GB',
    'memberGb',
    'member_gb'
]).toUpperCase();

const getUserBranchId = (user) => getUserValue(user, [
    'BRANCH_ID',
    'branch_ID',
    'branchId',
    'branch_id'
]);

const getUserLoginId = (user) => getUserValue(user, [
    'LOGIN_ID',
    'login_ID',
    'loginId',
    'login_id',
    'MEMBER_ID',
    'member_ID',
    'memberId',
    'member_id'
]);

const getUserMemberName = (user) => getUserValue(user, [
    'MEMBER_NM',
    'member_NM',
    'memberNm',
    'member_nm',
    'USER_NM',
    'userNm'
]);

// 최초 검색 조건을 생성함
// 회사는 로그인 회사, 기간은 오늘 기준으로 설정하고 지점/담당SP/상태 조건은 전체로 시작함
const getInitialSearchFilters = (user) => {
    const memberGb = getUserMemberGb(user);
    const branchId = getUserBranchId(user);
    const loginId = getUserLoginId(user);

    const isBranchFixed = ['BA', 'SU'].includes(memberGb);
    const isMemberFixed = memberGb === 'SU';

    return {
        companyId: getUserCompanyId(user),
        branchId: isBranchFixed ? branchId : '',
        memberId: isMemberFixed ? loginId : '',
        dateType: dateTypeOptions[0].value,
        startDate: getFormattedDateOffset(0),
        endDate: getFormattedDateOffset(0),
        processStatus: '',
        paymentStatus: '',
        carNo: ''
    };
};
// 검색값과 금액값을 안전하게 비교/표시하는 기본 변환 역할을 함
const toStringValue = (value) => String(value ?? '').trim();
const toYmd = (value) => toStringValue(value).replace(/-/g, '');

const toNumber = (value) => {
    const digits = String(value ?? '').replace(/[^0-9.-]/g, '');

    if (!digits || digits === '-' || digits === '.') {
        return 0;
    }

    const numberValue = Number(digits);

    return Number.isNaN(numberValue) ? 0 : numberValue;
};

const formatAmount = (value) => {
    const numberValue = toNumber(value);
    return numberValue ? numberValue.toLocaleString('ko-KR') : '0';
};

const formatDate = (value) => {
    const rawValue = toStringValue(value);
    const digits = rawValue.replace(/[^0-9]/g, '');

    if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    }

    return rawValue;
};
// 공통코드 응답을 GROUP_ID별 코드명 조회 Map 형태로 변환함
// formatCode에서 CODE_ID를 CODE_NM으로 빠르게 치환하기 위해 사용함
const buildCodeMap = (codes) => Object.entries(codes || {}).reduce((acc, [groupId, list]) => {
    acc[groupId] = (list || []).reduce((map, code) => {
        map[code.CODE_ID] = code.CODE_NM;
        return map;
    }, {});

    return acc;
}, {});

// 공통코드 목록을 전체 옵션이 포함된 select option 배열로 변환함
const toSelectOptions = (codeList) => [
    { value: '', label: '전체' },
    ...(codeList || []).map(code => ({
        value: code.CODE_ID,
        label: code.CODE_NM
    }))
];

// API별로 다른 필드명 후보에서 첫 번째 유효값을 찾아 반환함
// 회사/지점/담당자 정규화 함수에서 키 표기 차이를 흡수함
const getItemValue = (item, keys) => {
    for (const key of keys) {
        const value = item?.[key];

        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }

    return '';
};

// 회사 목록 응답을 COMPANY_ID/COMPANY_NM 구조로 정규화함
// 중복 COMPANY_ID는 제거하고, 회사명이 없으면 회사 ID를 화면명으로 사용함
const normalizeCompanyList = (list) => {
    const seen = new Set();

    return (list || []).reduce((acc, item) => {
        const companyId = getItemValue(item, ['COMPANY_ID', 'companyId', 'company_ID']);

        if (!companyId || seen.has(companyId)) {
            return acc;
        }

        seen.add(companyId);
        acc.push({
            COMPANY_ID: companyId,
            COMPANY_NM: getItemValue(item, ['COMPANY_NM', 'companyNm', 'company_NM', 'COMPANY_NAME']) || companyId
        });

        return acc;
    }, []);
};

// 지점 목록 응답을 BRANCH_ID/BRANCH_NM 구조로 정규화함
// 빈 지점 ID는 select option에서 제외함
const normalizeBranchList = (list) => (list || []).map(item => {
    const branchId = getItemValue(item, ['BRANCH_ID', 'branchId', 'CODE_ID']);
    return {
        BRANCH_ID: branchId,
        BRANCH_NM: getItemValue(item, ['BRANCH_NM', 'branchNm', 'CODE_NM']) || branchId
    };
}).filter(item => item.BRANCH_ID);

// 담당SP 목록 응답을 LOGIN_ID/MEMBER_NM 구조로 정규화함
// 담당자명이 없으면 로그인 ID를 화면명으로 사용하고, 빈 LOGIN_ID는 제외함
const normalizeMemberList = (list) => (list || []).map(item => {
    const loginId = getItemValue(item, ['LOGIN_ID', 'loginId', 'MEMBER_ID', 'memberId']);
    return {
        LOGIN_ID: loginId,
        MEMBER_NM: getItemValue(item, ['MEMBER_NM', 'memberNm', 'USER_NM', 'userNm']) || loginId
    };
}).filter(item => item.LOGIN_ID);

// 정렬 대상 컬럼 타입에 맞는 비교값을 생성함
// 숫자/날짜는 값 비교가 가능하도록 변환하고, 그 외는 화면 표시 문자열로 비교함
const getComparableValue = (row, column) => {
    const rawValue = row.rawValues?.[column.key] ?? row.displayValues?.[column.key] ?? '';

    if (column.sortType === 'number') {
        return toNumber(rawValue);
    }

    if (column.sortType === 'date') {
        const timeValue = new Date(String(rawValue).replace(/\./g, '-')).getTime();
        return Number.isNaN(timeValue) ? Number.NEGATIVE_INFINITY : timeValue;
    }

    return String(row.displayValues?.[column.key] ?? rawValue).trim().toLocaleLowerCase('ko-KR');
};

// 처리상태 코드/명칭을 그리드 배지 색상 클래스와 연결함
const getStatusClass = (statusLabel, statusCode) => {
    const code = toStringValue(statusCode).toUpperCase();
    const label = toStringValue(statusLabel);

    if (['RET', 'REJECT', 'DEL', 'CANCEL'].includes(code) || /반려|취소|삭제/.test(label)) {
        return 'reject';
    }

    if (['END', 'COMP', 'P_END', 'S_END', 'Y', 'PAID'].includes(code) || /완료/.test(label)) {
        return 'done';
    }

    if (['REQ', 'W_REQ', 'P_REQ', 'S_REQ', 'ING', 'N'].includes(code) || /대기|진행|미납/.test(label)) {
        return 'progress';
    }

    return 'ready';
};

// PAY_ST와 BPAY_YN 조합으로 납부상태 표시명을 계산함
const getPaymentStatusLabel = (row) => {
    const paySt = toStringValue(row.PAY_ST).toUpperCase();
    const bpayYn = toStringValue(row.BPAY_YN).toUpperCase();

    if (paySt === 'Y' && bpayYn === 'Y') return '납부';
    if (paySt === 'Y' && bpayYn !== 'Y') return '등록비용 납부';
    if (paySt !== 'Y' && bpayYn === 'Y') return '차량대금 납부';
    return '미납';
};

// 납부상태 표시명을 배지 색상 클래스와 연결함
const getPaymentStatusClass = (row) => {
    const label = toStringValue(row.displayValues?.PAY_STATUS_NM || row.PAY_STATUS_NM || getPaymentStatusLabel(row));

    if (label === '납부') return 'done';
    if (label === '미납') return 'progress';
    return 'ready';
};

// 통계 모달에서 사용하는 비율, 그룹 요약, 분류 기준을 정의함
const getPercent = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

// 통계 그룹 라벨이 비어 있을 때 미지정 값을 보정함
const getDashboardLabel = (value, fallback = '미지정') => {
    const label = toStringValue(value);
    return label || fallback;
};

// 통계 계산용 납부상태명을 행 데이터에서 우선순위대로 가져오도록 함
const getRowPaymentStatus = (row) => row.PAY_STATUS_NM || row.displayValues?.PAY_STATUS_NM || getPaymentStatusLabel(row);

// 지점/담당SP처럼 값이 다양한 항목을 그룹별 건수/금액/완납률로 집계함
// 건수와 금액 기준으로 정렬하고 화면에 보여줄 상위 항목만 반환함
const createGroupSummary = (rows, getLabel, limit = 8) => {
    const totalCount = rows.length;
    const grouped = rows.reduce((map, row) => {
        const label = getDashboardLabel(getLabel(row));
        const current = map.get(label) || {
            label,
            count: 0,
            paidCount: 0,
            unpaidCount: 0,
            amount: 0
        };
        const paymentStatus = getRowPaymentStatus(row);

        current.count += 1;
        current.amount += toNumber(row.TOTAL_AMT);

        if (paymentStatus === '납부') {
            current.paidCount += 1;
        }

        if (paymentStatus === '미납') {
            current.unpaidCount += 1;
        }

        map.set(label, current);
        return map;
    }, new Map());

    return Array.from(grouped.values())
        .sort((left, right) => right.count - left.count || right.amount - left.amount || left.label.localeCompare(right.label, 'ko-KR'))
        .slice(0, limit)
        .map(item => ({
            ...item,
            ratio: getPercent(item.count, totalCount),
            paidRate: getPercent(item.paidCount, item.count)
        }));
};

// 등록방법별 통계 분류 기준을 정의함
// TR_NEWCAR.DIRECT_YN이 Y이면 직접등록, 그 외는 대행등록으로 집계함
const registrationMethodDefinitions = [
    {
        label: '대행등록',
        isMatch: row => toStringValue(row.DIRECT_YN).toUpperCase() !== 'Y'
    },
    {
        label: '직접등록',
        isMatch: row => toStringValue(row.DIRECT_YN).toUpperCase() === 'Y'
    }
];

// 구매자별 통계 분류 기준을 정의함
// 현금/할부: TASK_CD=NORML 이면서 원본 REG_GB가 R 또는 B이면 일반등록으로 분류함
// 이용자명의리스/리스/렌트는 TASK_CD와 PROC_CD 조합으로 구분함
const buyerSummaryDefinitions = [
    {
        label: '현금 / 할부',
        isMatch: row => {
            const taskCd = toStringValue(row.TASK_CD).toUpperCase();
            const regGb = toStringValue(row.RAW_REG_GB || row.NEWCAR_REG_GB || row.REG_GB).toUpperCase();

            return taskCd === 'NORML' && ['R', 'B'].includes(regGb);
        }
    },
    {
        label: '이용자명의리스',
        isMatch: row => toStringValue(row.TASK_CD).toUpperCase() === 'LEASE' && toStringValue(row.PROC_CD).toUpperCase() === 'C'
    },
    {
        label: '리스',
        isMatch: row => toStringValue(row.TASK_CD).toUpperCase() === 'LEASE' && toStringValue(row.PROC_CD).toUpperCase() === 'I'
    },
    {
        label: '렌트',
        isMatch: row => toStringValue(row.TASK_CD).toUpperCase() === 'ADD' && toStringValue(row.PROC_CD).toUpperCase() === 'I'
    }
];

// 고정된 분류 정의 배열을 기준으로 건수와 비율을 계산함
// 정의된 조건에 맞지 않는 데이터는 필요 시 기타 항목으로 합산함
const createFixedSummaryRows = (rows, definitions, includeUnmatched = false) => {
    const totalCount = rows.length;
    const summaryRows = definitions.map(definition => {
        const count = rows.filter(row => definition.isMatch(row)).length;

        return {
            label: definition.label,
            count,
            ratio: getPercent(count, totalCount)
        };
    });

    if (includeUnmatched) {
        const unmatchedCount = rows.filter(row => !definitions.some(definition => definition.isMatch(row))).length;

        if (unmatchedCount > 0) {
            summaryRows.push({
                label: '기타',
                count: unmatchedCount,
                ratio: getPercent(unmatchedCount, totalCount)
            });
        }
    }

    return summaryRows;
};

// 현재 검색 결과 전체를 통계 모달용 지표 구조로 변환함
// 상단 KPI, 등록방법/구매자 요약, 지점 차트, 담당SP 순위를 함께 계산함
const createPaymentStatistics = (rows) => {
    const totalCount = rows.length;
    const totalAmount = rows.reduce((sum, row) => sum + toNumber(row.TOTAL_AMT), 0);
    const statusRows = paymentStatusOptions
        .filter(option => option.value)
        .map(option => {
            const statusRowsForOption = rows.filter(row => getRowPaymentStatus(row) === option.label);
            const amount = statusRowsForOption.reduce((sum, row) => sum + toNumber(row.TOTAL_AMT), 0);

            return {
                label: option.label,
                count: statusRowsForOption.length,
                ratio: getPercent(statusRowsForOption.length, totalCount),
                amount
            };
        });
    const paidCount = statusRows.find(row => row.label === '납부')?.count || 0;
    const unpaidCount = statusRows.find(row => row.label === '미납')?.count || 0;
    const regPaidCount = statusRows.find(row => row.label === '등록비용 납부')?.count || 0;
    const bpayPaidCount = statusRows.find(row => row.label === '차량대금 납부')?.count || 0;
    const branchRows = createGroupSummary(rows, row => row.displayValues?.BRANCH_NM || row.BRANCH_NM, 9);

    return {
        totalCount,
        totalAmount,
        paidCount,
        unpaidCount,
        regPaidCount,
        bpayPaidCount,
        paidRate: getPercent(paidCount, totalCount),
        unpaidRate: getPercent(unpaidCount, totalCount),
        totalRate: totalCount > 0 ? 100 : 0,
        registrationMethodRows: createFixedSummaryRows(rows, registrationMethodDefinitions),
        buyerRows: createFixedSummaryRows(rows, buyerSummaryDefinitions, true),
        branchRows,
        memberRows: createGroupSummary(rows, row => row.displayValues?.MEMBER_NM || row.MEMBER_NM, 5),
        maxBranchCount: branchRows.reduce((max, row) => Math.max(max, row.count), 0)
    };
};

const WaPayInfo = () => {
    const { user, logout } = useAuth();
	const memberGb = getUserMemberGb(user);
	const userCompanyId = getUserCompanyId(user);
	const userCompanyName = getUserCompanyName(user) || userCompanyId;
	const userBranchId = getUserBranchId(user);
	const userLoginId = getUserLoginId(user);
	const userMemberName = getUserMemberName(user) || userLoginId;

	const canSelectCompany = companySelectableMemberGbs.includes(memberGb);

	const isBranchFixed = ['BA', 'SU'].includes(memberGb);
	const isMemberFixed = memberGb === 'SU';

    // 검색 조건, 목록 데이터, 정렬/컬럼, 통계 모달 상태를 관리함
    const [codeListMap, setCodeListMap] = useState({});
    const [companyList, setCompanyList] = useState([]);
    const [branchList, setBranchList] = useState([]);
    const [memberList, setMemberList] = useState([]);
    const [rawRows, setRawRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [noticeMessage, setNoticeMessage] = useState('');
    const [searchFilters, setSearchFilters] = useState(() => getInitialSearchFilters(user));
    const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
    const [columnWidths, setColumnWidths] = useState({});
    const [showStatistics, setShowStatistics] = useState(false);

    const selectedCompanyId = searchFilters.companyId || userCompanyId;

    // 조회 조건 select option과 코드명 표시값을 계산함
    const codeMap = useMemo(() => buildCodeMap(codeListMap), [codeListMap]);

    const formatCode = useCallback((groupId, value) => {
        const codeValue = toStringValue(value);
        return codeMap[groupId]?.[codeValue] || codeValue;
    }, [codeMap]);

    const processStatusOptions = useMemo(() => toSelectOptions(codeListMap.NPRST), [codeListMap.NPRST]);

    const companyOptions = useMemo(() => {
        const normalizedCompanies = normalizeCompanyList(companyList);
        const seen = new Set();
        const options = [];

        const pushOption = (companyId, companyNm) => {
            if (!companyId || seen.has(companyId)) return;
            seen.add(companyId);
            options.push({ value: companyId, label: companyNm || companyId });
        };

        normalizedCompanies.forEach(company => pushOption(company.COMPANY_ID, company.COMPANY_NM));
        pushOption(userCompanyId, userCompanyName);

        return options;
    }, [companyList, userCompanyId, userCompanyName]);

	const branchOptions = useMemo(() => {
	    const normalizedBranches = normalizeBranchList(branchList);

	    if (isBranchFixed) {
	        const myBranch = normalizedBranches.find(branch => branch.BRANCH_ID === userBranchId);

	        return [
	            {
	                value: userBranchId,
	                label: myBranch?.BRANCH_NM || userBranchId || '내 SPACE'
	            }
	        ];
	    }

	    return [
	        { value: '', label: '전체(SPACE)' },
	        ...normalizedBranches.map(branch => ({
	            value: branch.BRANCH_ID,
	            label: branch.BRANCH_NM
	        }))
	    ];
	}, [branchList, isBranchFixed, userBranchId]);

	const memberOptions = useMemo(() => {
	    if (isMemberFixed) {
	        return [
	            {
	                value: userLoginId,
	                label: userMemberName || userLoginId || '내 계정'
	            }
	        ];
	    }

	    return [
	        { value: '', label: '전체' },
	        ...normalizeMemberList(memberList).map(member => ({
	            value: member.LOGIN_ID,
	            label: member.MEMBER_NM
	        }))
	    ];
	}, [memberList, isMemberFixed, userLoginId, userMemberName]);

    // API 원본 행을 그리드 표시값, 정렬값, XLSX 다운로드값 구조로 변환함
    // 금액/날짜/상태값은 화면에서 바로 사용할 수 있는 문자열로 보정함
    const rows = useMemo(() => rawRows.map((row, index) => {
        const paymentStatusLabel = row.PAY_STATUS_NM || getPaymentStatusLabel(row);
        const displayValues = {
            SEQ: row.SEQ || index + 1,
            WORK_CD: formatCode('SGB', row.WORK_CD),
            SERVICE_ID: row.SERVICE_ID || '',
            LINK_ID: row.LINK_ID || '',
            CARID_NO: row.CARID_NO || '',
            CAR_NO: row.CAR_NO || '',
            PROC_ST: formatCode('NPRST', row.NPROC_ST || row.PROC_ST),
            PAY_STATUS_NM: paymentStatusLabel,
            ACQ_AMT: formatAmount(row.ACQ_AMT),
            REGIS_AMT: formatAmount(row.REGIS_AMT),
            INJI_AMT: formatAmount(row.INJI_AMT),
            STAMP_AMT: formatAmount(row.STAMP_AMT),
            BOND_AMT: formatAmount(row.BOND_AMT),
            BFEE_AMT: formatAmount(row.BFEE_AMT),
            FEE_AMT: formatAmount(row.FEE_AMT),
            NUMP_AMT: formatAmount(row.NUMP_AMT),
            TOTAL_AMT: formatAmount(row.TOTAL_AMT),
            BRANCH_NM: row.BRANCH_NM || '',
            MEMBER_NM: row.MEMBER_NM || '',
            REQUEST_DT: formatDate(row.REQUEST_DT),
            BPAY_DT: formatDate(row.BPAY_DT),
            REGIST_DT: formatDate(row.REGIST_DT || row.REGIST_DATE),
            VBANK_NO: row.VBANK_NO || ''
        };

        return {
            ...row,
            rowKey: row.SERVICE_ID || row.LINK_ID || `${row.CAR_NO || 'pay'}-${index}`,
            displayValues,
            rawValues: {
                ...row,
                SEQ: row.SEQ || index + 1,
                REQUEST_DT: displayValues.REQUEST_DT,
                BPAY_DT: displayValues.BPAY_DT,
                REGIST_DT: displayValues.REGIST_DT
            }
        };
    }), [formatCode, rawRows]);

    // 사용자가 클릭한 컬럼 기준으로 그리드 행을 정렬함
    const sortedRows = useMemo(() => {
        if (!sortConfig.key) {
            return rows;
        }

        const sortColumn = columns.find(column => column.key === sortConfig.key);

        if (!sortColumn) {
            return rows;
        }

        const direction = sortConfig.direction === 'desc' ? -1 : 1;

        return rows
            .map((row, index) => ({ row, index }))
            .sort((left, right) => {
                const leftValue = getComparableValue(left.row, sortColumn);
                const rightValue = getComparableValue(right.row, sortColumn);

                if (leftValue > rightValue) return direction;
                if (leftValue < rightValue) return -direction;

                return left.index - right.index;
            })
            .map(item => item.row);
    }, [rows, sortConfig]);

    // 현재 검색 결과 기준으로 통계 모달에 보여줄 지표를 계산함
    const statistics = useMemo(() => createPaymentStatistics(rows), [rows]);

    // 컬럼 리사이즈 결과를 반영해 전체 테이블 폭을 유지함
    const gridWidth = useMemo(() => columns.reduce((total, column) => {
        const width = columnWidths[column.key] ?? column.width ?? column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
        return total + width;
    }, 0), [columnWidths]);

    // 화면 검색 조건을 WA 납부현황 조회 API 파라미터로 변환함
	const buildSearchPayload = useCallback((filters) => ({
	    WORK_CD: '010',
	    COMPANY_ID: filters.companyId || userCompanyId,
	    BRANCH_ID: isBranchFixed ? userBranchId : filters.branchId,
	    MEMBER_ID: isMemberFixed ? userLoginId : filters.memberId,
	    BASE_GUBUN: filters.dateType,
	    START_DT: toYmd(filters.startDate),
	    END_DT: toYmd(filters.endDate),
	    CAR_NO: filters.carNo.trim(),
	    PROC_ST: filters.processStatus,
	    PAY_STATUS: filters.paymentStatus
	}), [userCompanyId, isBranchFixed, userBranchId, isMemberFixed, userLoginId]);
    // 인증 만료 응답은 로그인 화면 이동으로 처리함
    const handleAuthError = useCallback(async (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            await logout({ redirectTo: '/wa/login' });
            return true;
        }

        return false;
    }, [logout]);

    // 회사 ID 기준으로 지점 select 목록을 조회함
    const fetchBranchOptions = useCallback(async (companyId) => {
        if (!companyId) {
            return [];
        }

        const response = await axios.get('/api/branch/list', {
            params: { companyId },
            withCredentials: true
        });

        return response.data?.success ? response.data.list || [] : [];
    }, []);

    // 회사/지점 조건 기준으로 담당SP select 목록을 조회함
    const fetchMemberOptions = useCallback(async (companyId, branchId = '') => {
        if (!companyId) {
            return [];
        }

        const response = await axios.post('/api/payment/wa/member-list', {
            COMPANY_ID: companyId,
            BRANCH_ID: branchId
        }, { withCredentials: true });

        return response.data?.success ? response.data.list || [] : [];
    }, []);

    // 납부현황 목록을 조회하고 로딩/오류/빈 결과 상태를 갱신함
    const fetchPaymentList = useCallback(async (filters) => {
        setLoading(true);
        setErrorMessage('');
        setNoticeMessage('');

        try {
            const response = await axios.post('/api/payment/wa-list', buildSearchPayload(filters), { withCredentials: true });

            if (response.data?.success) {
                setRawRows(response.data.list || []);
                return;
            }

            setRawRows([]);
            setErrorMessage(response.data?.message || '납부현황 조회에 실패했습니다.');
        } catch (error) {
            console.error('WA 납부현황 조회 실패:', error);

            if (await handleAuthError(error)) {
                return;
            }

            setRawRows([]);
            setErrorMessage('납부현황 조회 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [buildSearchPayload, handleAuthError]);

    // 최초 진입 시 코드, 회사, 지점, 담당자, 목록 데이터를 병렬로 준비함
    useEffect(() => {
        let isMounted = true;
        const initialFilters = getInitialSearchFilters(user);
        const companyId = initialFilters.companyId;

        const fetchInitialData = async () => {
            try {
                const companyParams = { workCd: '010' };

                if (!canSelectCompany && companyId) {
                    companyParams.companyId = companyId;
                }

                const [codeResponse, companyResponse, branchResponse, memberResponse] = await Promise.all([
                    axios.post('/api/codes/list', { groupIds: ['SGB', 'NPRST', 'GOVT'] }, { withCredentials: true }),
                    axios.get('/api/companies', { params: companyParams, withCredentials: true }),
                    companyId ? fetchBranchOptions(companyId) : Promise.resolve([]),
                    companyId ? fetchMemberOptions(companyId, initialFilters.branchId) : Promise.resolve([])
                ]);

                if (!isMounted) return;

                if (codeResponse.data?.success) {
                    setCodeListMap(codeResponse.data.codes || {});
                }

                if (companyResponse.data?.success) {
                    setCompanyList(companyResponse.data.list || []);
                }

                setBranchList(branchResponse || []);
                setMemberList(memberResponse || []);
            } catch (error) {
                console.error('WA 납부현황 초기 데이터 조회 실패:', error);

                if (await handleAuthError(error)) {
                    return;
                }

                if (isMounted) {
                    setErrorMessage('검색 조건 정보를 불러오지 못했습니다.');
                }
            }
        };

        setSearchFilters(initialFilters);
        fetchInitialData();
        fetchPaymentList(initialFilters);

        return () => {
            isMounted = false;
        };
    }, [canSelectCompany, fetchBranchOptions, fetchMemberOptions, fetchPaymentList, handleAuthError, user]);

    // 검색 조건 변경 이벤트를 처리함
    const handleFilterChange = (event) => {
        const { name, value } = event.target;

        setSearchFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 회사 변경 시 지점/담당SP 선택값을 초기화하고 하위 목록을 재조회함
	const handleCompanyChange = async (event) => {
	    const nextCompanyId = event.target.value;
	    const nextBranchId = isBranchFixed ? userBranchId : '';
	    const nextMemberId = isMemberFixed ? userLoginId : '';

	    setSearchFilters(prev => ({
	        ...prev,
	        companyId: nextCompanyId,
	        branchId: nextBranchId,
	        memberId: nextMemberId
	    }));

	    setBranchList([]);
	    setMemberList([]);

	    if (!nextCompanyId) {
	        return;
	    }

	    try {
	        const [nextBranchList, nextMemberList] = await Promise.all([
	            fetchBranchOptions(nextCompanyId),
	            fetchMemberOptions(nextCompanyId, nextBranchId)
	        ]);

	        setBranchList(nextBranchList || []);
	        setMemberList(nextMemberList || []);
	    } catch (error) {
	        console.error('WA 납부현황 회사 조건 변경 실패:', error);

	        if (await handleAuthError(error)) {
	            return;
	        }

	        setErrorMessage('회사 조건에 맞는 지점/담당SP 정보를 불러오지 못했습니다.');
	    }
	};

    // 지점 변경 시 담당SP 목록을 해당 지점 기준으로 재조회함
	const handleBranchChange = async (event) => {
	    if (isBranchFixed) {
	        setSearchFilters(prev => ({
	            ...prev,
	            branchId: userBranchId,
	            memberId: isMemberFixed ? userLoginId : prev.memberId
	        }));
	        return;
	    }

	    const nextBranchId = event.target.value;
	    const companyId = selectedCompanyId;

	    setSearchFilters(prev => ({
	        ...prev,
	        branchId: nextBranchId,
	        memberId: ''
	    }));

	    setMemberList([]);

	    if (!companyId) {
	        return;
	    }

	    try {
	        const nextMemberList = await fetchMemberOptions(companyId, nextBranchId);
	        setMemberList(nextMemberList || []);
	    } catch (error) {
	        console.error('WA 납부현황 지점 조건 변경 실패:', error);

	        if (await handleAuthError(error)) {
	            return;
	        }

	        setErrorMessage('지점 조건에 맞는 담당SP 정보를 불러오지 못했습니다.');
	    }
	};

    // 오늘/1주일/1개월 빠른 기간 선택을 처리함
    const handleDateQuickRange = (startOffset) => {
        setSearchFilters(prev => ({
            ...prev,
            startDate: getFormattedDateOffset(startOffset),
            endDate: getFormattedDateOffset(0)
        }));
    };

    // 검색 조건을 초기값으로 되돌리고 목록을 다시 조회함
    const handleReset = async () => {
        const nextFilters = getInitialSearchFilters(user);
        setSearchFilters(nextFilters);

        try {
            const [nextBranchList, nextMemberList] = await Promise.all([
                nextFilters.companyId ? fetchBranchOptions(nextFilters.companyId) : Promise.resolve([]),
                nextFilters.companyId ? fetchMemberOptions(nextFilters.companyId, nextFilters.branchId) : Promise.resolve([])
            ]);

            setBranchList(nextBranchList || []);
            setMemberList(nextMemberList || []);
        } catch (error) {
            console.error('WA 납부현황 조건 초기화 실패:', error);
        }

        fetchPaymentList(nextFilters);
    };
    // 현재 정렬된 그리드 결과의 XLSX 파일 다운로드를 실행함
    const handleExport = () => {
        if (rows.length === 0) {
            setErrorMessage('내보낼 데이터가 없습니다.');
            setNoticeMessage('');
            return;
        }

        exportRowsToXlsx({
            columns,
            rows: sortedRows,
            fileName: `납부현황_${getFormattedDateOffset(0)}.xlsx`,
            sheetName: '납부현황',
            getCellValue: (row, column) => row.displayValues[column.key] ?? ''
        });
    };

    // 상단 버튼별 동작을 한 곳에서 분기함
    const handleHeaderActionClick = (actionKey) => {
        if (actionKey === 'search') {
            fetchPaymentList(searchFilters);
            return;
        }

        if (actionKey === 'statistics') {
            setShowStatistics(true);
            return;
        }

        if (actionKey === 'export') {
            handleExport();
            return;
        }

        if (actionKey === 'reset') {
            handleReset();
            return;
        }

        if (actionKey === 'close') {
            window.history.back();
        }
    };

    // 그리드 컬럼 폭, 고정 컬럼 위치, 리사이즈 동작을 계산함
    // 왼쪽 고정 컬럼은 현재 컬럼 폭을 누적해 sticky left 값을 생성함
    const getColumnWidth = useCallback((column) => (
        columnWidths[column.key] ?? column.width ?? column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH
    ), [columnWidths]);

    const stickyColumnOffsets = useMemo(() => {
        const offsets = {};
        let nextLeft = 0;

        columns.forEach(column => {
            if (!PINNED_COLUMN_SET.has(column.key)) {
                return;
            }

            offsets[column.key] = nextLeft;
            nextLeft += getColumnWidth(column);
        });

        return offsets;
    }, [getColumnWidth]);

    const getColumnClassName = useCallback((column) => {
        const classNames = [column.className];

        if (PINNED_COLUMN_SET.has(column.key)) {
            classNames.push('wa-status-sticky-column');

            if (column.key === PINNED_COLUMN_KEYS[PINNED_COLUMN_KEYS.length - 1]) {
                classNames.push('wa-status-sticky-column-last');
            }
        }

        return classNames.filter(Boolean).join(' ') || undefined;
    }, []);

    const getStickyColumnStyle = useCallback((column) => (
        PINNED_COLUMN_SET.has(column.key) ? { left: `${stickyColumnOffsets[column.key] ?? 0}px` } : undefined
    ), [stickyColumnOffsets]);

    const handleSortColumn = useCallback((column) => {
		if (column.sortable === false) return;

		    setSortConfig(prev => {
		        // 1. 다른 컬럼을 클릭한 경우 -> 오름차순(asc) 시작
		        if (prev.key !== column.key) {
		            return { key: column.key, direction: 'asc' };
		        }
		        // 2. 같은 컬럼인데 현재 오름차순(asc)인 경우 -> 내림차순(desc)
		        if (prev.direction === 'asc') {
		            return { key: column.key, direction: 'desc' };
		        }
		        // 3. 같은 컬럼인데 현재 내림차순(desc)인 경우 -> 정렬 초기화(none)
		        return { key: null, direction: 'none' }; 
		    });
    }, []);

    const handleColumnResizeStart = useCallback((event, column) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = getColumnWidth(column);
        const minWidth = column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
        const originalCursor = document.body.style.cursor;
        const originalUserSelect = document.body.style.userSelect;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handlePointerMove = (moveEvent) => {
            const nextWidth = Math.max(minWidth, Math.round(startWidth + moveEvent.clientX - startX));
            setColumnWidths(prev => ({ ...prev, [column.key]: nextWidth }));
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            document.body.style.cursor = originalCursor;
            document.body.style.userSelect = originalUserSelect;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
    }, [getColumnWidth]);

    // 상태 컬럼은 배지로, 일반 컬럼은 표시값 그대로 렌더링함
    const renderGridCell = (row, column) => {
        if (column.type === 'processStatus') {
            return <span className={`wa-grid-status ${getStatusClass(row.displayValues.PROC_ST, row.NPROC_ST || row.PROC_ST)}`}>{row.displayValues.PROC_ST}</span>;
        }

        if (column.type === 'paymentStatus') {
            return <span className={`wa-grid-status ${getPaymentStatusClass(row)}`}>{row.displayValues[column.key]}</span>;
        }

        return row.displayValues[column.key] ?? '';
    };

    return (
        <div className="wa-status-page">
            <div className="wa-status-page-content">
                {/* 조회 기간과 상단 기능 버튼을 렌더링함 */}
                <section className="wa-status-top-toolbar" aria-label="납부현황 조회 조건">
                    <section className="wa-status-period-panel" aria-label="조회 기간">
                        <label className="wa-status-field wa-status-date-field" aria-label="기준일자">
                            <div className="wa-status-date-controls">
                                <select name="dateType" value={searchFilters.dateType} onChange={handleFilterChange}>
                                    {dateTypeOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                <div className="wa-status-date-range">
                                    <input type="date" name="startDate" value={searchFilters.startDate} onChange={handleFilterChange} />
                                    <span aria-hidden="true">~</span>
                                    <input type="date" name="endDate" value={searchFilters.endDate} onChange={handleFilterChange} />
                                </div>
                            </div>
                        </label>

                        <div className="wa-status-actions" aria-label="기간 빠른 선택">
                            {quickDateButtons.map(button => (
                                <button key={button.key} type="button" className="wa-status-action outline" onClick={() => handleDateQuickRange(button.startOffset)}>
                                    <span>{button.label}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <div className="wa-status-actions" aria-label="납부현황 기능 버튼">
                        {headerActionButtons.map(({ key, label, Icon, variant }) => {
                            const buttonVariant = key === 'statistics' && showStatistics ? 'primary' : variant;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    className={`wa-status-action ${buttonVariant}`}
                                    onClick={() => handleHeaderActionClick(key)}
                                    disabled={loading && key === 'search'}
                                >
                                    <Icon size={15} />
                                    <span>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
                {/* 회사/지점, 담당SP, 차량번호, 처리/납부상태 검색 조건을 렌더링함 */}
                <section className="wa-status-filter-panel" aria-label="검색 조건" style= {{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }} >
                    <label className="wa-status-field wa-pay-registration-field">
                        <span>등록구분</span>
                        <div className="wa-pay-registration-controls">
                            <select name="companyId" value={selectedCompanyId} onChange={handleCompanyChange} disabled={!canSelectCompany}>
                                {companyOptions.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
							<select
							    name="branchId"
							    value={searchFilters.branchId}
							    onChange={handleBranchChange}
							    disabled={isBranchFixed}
							>
                                {branchOptions.map(option => (
                                    <option key={option.value || 'ALL_BRANCH'} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                    </label>

                    <label className="wa-status-field">
                        <span>담당SP명</span>
						<select
						    name="memberId"
						    value={searchFilters.memberId}
						    onChange={handleFilterChange}
						    disabled={isMemberFixed}
						>
                            {memberOptions.map(option => (
                                <option key={option.value || 'ALL_MEMBER'} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="wa-status-field">
                        <span>차량/차대번호</span>
                        <input type="text" name="carNo" value={searchFilters.carNo} onChange={handleFilterChange} placeholder="번호 입력" />
                    </label>

                    <label className="wa-status-field">
                        <span>처리상태</span>
                        <select name="processStatus" value={searchFilters.processStatus} onChange={handleFilterChange}>
                            {processStatusOptions.map(option => (
                                <option key={option.value || 'ALL_PROCESS'} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="wa-status-field">
                        <span>납부상태</span>
                        <select name="paymentStatus" value={searchFilters.paymentStatus} onChange={handleFilterChange}>
                            {paymentStatusOptions.map(option => (
                                <option key={option.value || 'ALL_PAYMENT'} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                </section>
                {/* 조회 결과 그리드를 렌더링함 */}
				{/* 1. 최상단 section에 Flexbox를 적용하여 자식 요소들이 높이를 꽉 채우도록 합니다. */}
				<section 
				    className="wa-status-grid-panel" 
				    aria-label="납부현황 목록" 
				    style={{ display: 'flex', flexDirection: 'column', minHeight: `52vh`, maxHeight: `70vh` }}
				>
				    <section className="wa-status-heading">
				        <div className="wa-status-actions" aria-label="납부현황 결과 요약">
				            <strong>검색 결과 총 {rows.length}건</strong>
				        </div>
				    </section>

				    {errorMessage && <div className="wa-status-error">{errorMessage}</div>}
				    {noticeMessage && <div className="wa-status-notice">{noticeMessage}</div>}

				    {/* 2. 스크롤 컨테이너 역시 Flexbox로 만들어서 내부 요소들을 위아래로 배치합니다. */}
				    <div 
				        className="wa-status-table-scroll" 
				        style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}
				    >
				        {/* 3. 데이터 테이블을 div로 감싸고 flex: 1 속성을 주어, 데이터가 적어도 하얀 여백을 이 div가 모두 차지하게(밀어내게) 합니다. */}
				        <div style={{ flex: '1 1 auto' }}>
				            <table className="wa-status-table" style={{ width: `${gridWidth}px`, minWidth: `${gridWidth}px` }}>
				                <colgroup>
				                    {columns.map(column => (
				                        <col key={column.key} style={{ width: `${getColumnWidth(column)}px` }} />
				                    ))}
				                </colgroup>
				                <thead>
				                    <tr>
				                        {columns.map(column => {
				                            const isSorted = sortConfig.key === column.key;
				                            const ariaSort = isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none';
				                            const sortClassName = isSorted ? ` sort-${sortConfig.direction}` : '';

				                            return (
				                                <th key={column.key} className={getColumnClassName(column)} style={getStickyColumnStyle(column)} aria-sort={ariaSort}>
				                                    <button type="button" className={`wa-status-sort-button${sortClassName}`} onClick={() => handleSortColumn(column)}>
				                                        <span>{column.label}</span>
				                                    </button>
				                                    <span
				                                        className="wa-status-column-resizer"
				                                        role="separator"
				                                        aria-orientation="vertical"
				                                        aria-label={`${column.label} 컬럼 폭 조절`}
				                                        onPointerDown={event => handleColumnResizeStart(event, column)}
				                                    />
				                                </th>
				                            );
				                        })}
				                    </tr>
				                </thead>
				                <tbody>
				                    {loading ? (
				                        <tr>
				                            <td className="wa-status-empty" colSpan={columns.length}>조회 중입니다.</td>
				                        </tr>
				                    ) : rows.length === 0 ? (
				                        <tr>
				                            <td className="wa-status-empty" colSpan={columns.length}>조회된 데이터가 없습니다.</td>
				                        </tr>
				                    ) : sortedRows.map(row => (
				                        <tr key={row.rowKey} className="wa-status-data-row" tabIndex={0}>
				                            {columns.map(column => (
				                                <td key={`${row.rowKey}-${column.key}`} className={getColumnClassName(column)} style={getStickyColumnStyle(column)}>
				                                    {renderGridCell(row, column)}
				                                </td>
				                            ))}
				                        </tr>
				                    ))}
				                </tbody>
				            </table>
				        </div>

				        {/* 4. 합계 영역을 별도의 테이블로 분리하고 sticky 처리합니다. */}
				        {!loading && rows.length > 0 && (
				            <table 
				                className="wa-status-table wa-status-summary-table" 
				                style={{ 
				                    width: `${gridWidth}px`, 
				                    minWidth: `${gridWidth}px`,
				                    position: 'sticky', 
				                    bottom: 0, 
				                    zIndex: 10, 
				                    backgroundColor: '#f8f9fa',
				                    borderTop: '2px solid #243447' // 합계 선을 뚜렷하게
				                }}
				            >
				                {/* 💡 데이터 테이블과 똑같은 colgroup을 사용하여 열 너비를 완벽하게 동기화합니다. */}
				                <colgroup>
				                    {columns.map(column => (
				                        <col key={column.key} style={{ width: `${getColumnWidth(column)}px` }} />
				                    ))}
				                </colgroup>
				                <tfoot>
				                    <tr className="wa-status-summary-row">
				                        {columns.map((column, index) => {
				                            if (index === 0) {
				                                return (
				                                    <td key={`summary-${column.key}`} className={getColumnClassName(column)} style={{...getStickyColumnStyle(column), textAlign: 'center'}}>
				                                        <strong>합계</strong>
				                                    </td>
				                                );
				                            }

				                            //const isNumeric = column.isNumeric; // 컬럼의 속성에 따라 판별
				                            let cellContent = '';
				                            
											const isNumeric = ['ACQ_AMT', 'TOTAL_AMT', 'NUMP_AMT', 'FEE_AMT', 'BFEE_AMT', 'BOND_AMT', 'STAMP_AMT', 'INJI_AMT', 'REGIS_AMT'].includes(column.key);
											
				                            if (isNumeric) {
				                                const sum = sortedRows.reduce((acc, row) => {
				                                    const value = Number(row[column.key]);
				                                    return acc + (isNaN(value) ? 0 : value);
				                                }, 0);
				                                cellContent = sum.toLocaleString(); 
				                            }

				                            return (
				                                <td key={`summary-${column.key}`} className={getColumnClassName(column)} style={getStickyColumnStyle(column)}>
				                                    <strong>{cellContent}</strong>
				                                </td>
				                            );
				                        })}
				                    </tr>
				                </tfoot>
				            </table>
				        )}
				    </div>
				</section>
                {/* 통계 버튼 클릭 시 표시되는 모달을 렌더링함 */}
                {showStatistics && (
                    <div className="wa-pay-dashboard-backdrop" role="presentation" onClick={() => setShowStatistics(false)}>
                        <section
                            className="wa-pay-dashboard-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="wa-pay-dashboard-title"
                            onClick={event => event.stopPropagation()}
                        >
                            <header className="wa-pay-dashboard-header">
                                <h2 id="wa-pay-dashboard-title">DACOS 신규등록 통계</h2>
                                <div className="wa-pay-dashboard-controls" aria-label="납부 통계 조회 조건">
                                    <select name="dateType" value={searchFilters.dateType} onChange={handleFilterChange}>
                                        {dateTypeOptions.map(option => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                    <input type="date" name="startDate" value={searchFilters.startDate} onChange={handleFilterChange} />
                                    <span aria-hidden="true">~</span>
                                    <input type="date" name="endDate" value={searchFilters.endDate} onChange={handleFilterChange} />
                                    <button type="button" className="wa-pay-dashboard-search" onClick={() => fetchPaymentList(searchFilters)} disabled={loading}>
                                        <Search size={16} />
                                        <span>조회</span>
                                    </button>
                                    <button type="button" className="wa-pay-dashboard-close" aria-label="통계 닫기" onClick={() => setShowStatistics(false)}>
                                        <X size={18} />
                                    </button>
                                </div>
                            </header>

                            <section className="wa-pay-dashboard-hero" aria-label="납부현황 통계 요약">
                                <span>TOTAL REGISTRATIONS (총 등록건수)</span>
                                <strong>{statistics.totalCount} 건</strong>
                                <small>완납률 {statistics.paidRate}% · 미납 {statistics.unpaidCount}건 · 입금총액 {formatAmount(statistics.totalAmount)}원</small>
                            </section>

                            <section className="wa-pay-dashboard-kpis" aria-label="핵심 지표">
                                <div>
                                    <span>완납</span>
                                    <strong>{statistics.paidCount}건</strong>
                                    <small>{statistics.paidRate}%</small>
                                </div>
                                <div>
                                    <span>등록비용 납부</span>
                                    <strong>{statistics.regPaidCount}건</strong>
                                    <small>차량대금 대기</small>
                                </div>
                                <div>
                                    <span>차량대금 납부</span>
                                    <strong>{statistics.bpayPaidCount}건</strong>
                                    <small>등록비용 대기</small>
                                </div>
                                <div className={statistics.unpaidCount > 0 ? 'danger' : ''}>
                                    <span>미납</span>
                                    <strong>{statistics.unpaidCount}건</strong>
                                    <small>{statistics.unpaidRate}%</small>
                                </div>
                            </section>

                            <section className="wa-pay-dashboard-layout">
                                <div className="wa-pay-dashboard-stack">
                                    <section className="wa-pay-dashboard-panel">
                                        <h3>등록방법별 요약</h3>
                                        <table className="wa-pay-dashboard-table">
                                            <thead>
                                                <tr>
                                                    <th>등록방법</th>
                                                    <th>건수</th>
                                                    <th>비율(%)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {statistics.registrationMethodRows.map(row => (
                                                    <tr key={row.label}>
                                                        <td>{row.label}</td>
                                                        <td>{row.count}</td>
                                                        <td>{row.ratio}%</td>
                                                    </tr>
                                                ))}
                                                <tr className="total">
                                                    <td>합계</td>
                                                    <td>{statistics.totalCount}</td>
                                                    <td>{statistics.totalRate}%</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>

                                    <section className="wa-pay-dashboard-panel">
                                        <h3>구매자별 요약</h3>
                                        <table className="wa-pay-dashboard-table">
                                            <thead>
                                                <tr>
                                                    <th>구매자 구분</th>
                                                    <th>건수</th>
                                                    <th>비율(%)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {statistics.buyerRows.map(row => (
                                                    <tr key={row.label}>
                                                        <td>{row.label}</td>
                                                        <td>{row.count}</td>
                                                        <td>{row.ratio}%</td>
                                                    </tr>
                                                ))}
                                                <tr className="total">
                                                    <td>합계</td>
                                                    <td>{statistics.totalCount}</td>
                                                    <td>{statistics.totalRate}%</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </section>
                                </div>

                                <section className="wa-pay-dashboard-panel wa-pay-dashboard-chart-panel">
                                    <h3>지점별 분포 트렌드</h3>
                                    <div className="wa-pay-dashboard-chart" role="img" aria-label="지점별 납부현황 건수 막대 차트">
                                        {statistics.branchRows.length === 0 ? (
                                            <div className="wa-pay-dashboard-chart-empty">데이터 없음</div>
                                        ) : statistics.branchRows.map((row, index) => {
                                            const barHeight = statistics.maxBranchCount > 0 ? Math.max(10, Math.round((row.count / statistics.maxBranchCount) * 100)) : 0;

                                            return (
                                                <div key={row.label} className="wa-pay-dashboard-bar-item">
                                                    <span className="wa-pay-dashboard-bar-value">{row.count}</span>
                                                    <div className="wa-pay-dashboard-bar-track">
                                                        <span
                                                            className={`wa-pay-dashboard-bar${row.unpaidCount > 0 ? ' warn' : ''}${index === 0 ? ' top' : ''}`}
                                                            style={{ height: `${barHeight}%` }}
                                                        />
                                                    </div>
                                                    <span className="wa-pay-dashboard-bar-label">{row.label}</span>
                                                    <strong>{row.ratio}%</strong>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </section>

                            <section className="wa-pay-dashboard-panel wa-pay-dashboard-member-panel">
                                <h3>담당SP 상위 처리량</h3>
                                <div className="wa-pay-dashboard-member-list">
                                    {statistics.memberRows.length === 0 ? (
                                        <span className="empty">데이터 없음</span>
                                    ) : statistics.memberRows.map(row => (
                                        <div key={row.label}>
                                            <span>{row.label}</span>
                                            <strong>{row.count}건</strong>
                                            <small>완납률 {row.paidRate}%</small>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WaPayInfo;
