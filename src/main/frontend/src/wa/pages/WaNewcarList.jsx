import React, { useCallback, useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
import axios from 'axios';
import { ChevronRight, ClipboardCheck, Download, Filter, MoreVertical, RotateCcw, Search, Upload, WalletCards, X, UsersRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { exportRowsToXlsx } from '../../utils/xlsxExport';
import WaNewcarRequest from './newcar/WaNewcarRequest';
import { gf } from '../../utils/utils'; // 공통 유틸 함수
import '../styles/wa.css';

const dateTypeFallbackOptions = [
    { CODE_ID: 'REQDT', CODE_NM: '입력일자' },
    { CODE_ID: 'JDGDT', CODE_NM: '등록일자' },
    { CODE_ID: 'REGDT', CODE_NM: '등록예정일자' },
];


const processStatusFallbackOptions = [];

const SEARCH_START_LIMIT_YEARS = 2;
const DIRECT_REGISTRATION_PROCESS_CODE = 'DIRCT';
const DIRECT_REGISTRATION_BLANK_COLUMN_KEYS = new Set([
	// 26.09.01 자가등록건도 등록예정일자 표시하도록 처리
	//'REGIST_DATE',
    'ATTACH_YN',
    'CARD_YN',
    'NTAX_YN',
    'PAY_ST',
    'BPAY_DT',
    'PAY_DT',
    'INS_DATE',
	// 26.09.01 자가등록건은 등록일자 대신 등록예정일자를 표시하므로 blank 처리하지 않음
    //'JUDGE_DT',
    'INSTALL_YN',
    'LAST_DELIVERY_ADDR'
]);


const plateDeliveryOptions = [
    { value: '', label: '전체' },
    { value: 'BEFORE', label: '미배송' },
    { value: 'DELIVERY', label: '배송' }
];

const spaceFallbackOptions = [
    { value: '본점', label: '본점' },
    { value: '일산바이브나인', label: '일산바이브나인' },
    { value: '서울점', label: '서울점' },
    { value: '하남점', label: '하남점' },
    { value: '수원점', label: '수원점' },
    { value: '대전점', label: '대전점' },
    { value: '제주점', label: '제주점' },
    { value: '부산점', label: '부산점' },
    { value: '대구점', label: '대구점' },
    { value: '광주점', label: '광주점' }
];

const quickDateButtons = [
    { key: 'today', label: '오늘', startOffset: 0 },
    { key: 'week', label: '1주일', startOffset: -7 },
    { key: 'month', label: '1개월', startOffset: -30 }
];

const headerActionButtons = [
    { key: 'search', label: '조회', Icon: Search, variant: 'primary' },
    { key: 'export', label: '엑셀', Icon: Download, variant: 'outline' },
    { key: 'reset', label: '초기화', Icon: RotateCcw, variant: 'outline' }
];

const gridActionButtons = [
	{
		key: 'apply',
		label: '신청',
		Icon: ClipboardCheck,
		variant: 'outline',
		roles: ['CA']
	},
	{
		key: 'payment',
		label: '차량대금 납부',
		Icon: WalletCards,
		variant: 'outline',
		roles: ['CA']
	},
	{
		key: 'suChange',
		label: '담당자 변경',
		Icon: UsersRound,
		variant: 'outline',
		roles: ['BA']
	}
];

const DEFAULT_MIN_COLUMN_WIDTH = 56;
// 왼쪽 고정 컬럼
// CHK부터 주문번호까지 순서대로 고정
const PINNED_COLUMN_KEYS = [
    'CHK',
    'SEQ',
    'REGIST_DATE',
    'PROC_ST',
    'LINK_ID'
];

const PINNED_COLUMN_SET = new Set(PINNED_COLUMN_KEYS);

const columns = [
    { key: 'CHK', label: '', type: 'checkbox', width: 44, minWidth: 40, sortable: false },
    { key: 'SEQ', label: '순번', width: 44, minWidth: 20, sortable: false },
    { key: 'REGIST_DATE', label: '등록예정일자', width: 116, minWidth: 50, sortType: 'date', excelAlign : "left" },
    { key: 'PROC_ST', label: '처리상태', type: 'processStatus', width: 120, minWidth: 70 },
    { key: 'LINK_ID', label: '주문번호', width: 82, minWidth: 60 },
    { key: 'CARID_NO', label: '차대번호', width: 150, minWidth: 60 },
    { key: 'CAR_NO', label: '차량번호', width: 96, minWidth: 60 },
    { key: 'CUSTOMER_NM', label: '계약자명', width: 120, minWidth: 60 },
    { key: 'OWNER_NM', label: '소유자명', width: 120, minWidth: 60 },
    { key: 'BUY_AMT', label: '공급가액', width: 102, minWidth: 60, sortType: 'number', className: 'number-cell' },
    { key: 'ATTACH_YN', label: '첨부서류', width: 65, minWidth: 60 },
    { key: 'CARD_YN', label: '카드납부', width: 65, minWidth: 60 },
    { key: 'NTAX_YN', label: '감면여부', width: 65, minWidth: 60 },
    { key: 'PAY_ST', label: '납부상태', width: 65, minWidth: 60 },
    { key: 'BPAY_DT', label: '차량대금 납부일자', width: 110, minWidth: 60, sortType: 'date' },
    { key: 'PAY_DT', label: '등록비용 납부일자', width: 110, minWidth: 60, sortType: 'date' },
    { key: 'INS_DATE', label: '입력일자', width: 90, minWidth: 60, sortType: 'date' },
    { key: 'JUDGE_DT', label: '등록일자', width: 90, minWidth: 60, sortType: 'date' },
    { key: 'INSTALL_YN', label: '배송여부', width: 90, minWidth: 60, sortType: 'date' },
    { key: 'SPACE', label: 'SPACE', width: 116, minWidth: 60 },
    { key: 'LAST_DELIVERY_ADDR', label: '배송 주소', width: 230, minWidth: 60, className: 'wide-text' },
    { key: 'MEMBER_ID', label: '담당SP명', width: 112, minWidth: 60 },
    { key: 'RETURN_TX', label: '비고', type: 'remark', width: 190, minWidth: 60, className: 'wide-text' }
];

const privacyExcelColumns = columns.flatMap(column => {
    if (column.key !== 'OWNER_NM') {
        return [column];
    }

    return [
        column,
        { key: 'OWNER_TYPE', label: '소유자 구분', width: 90 },
        { key: 'OWNER_REG_NO', label: '소유자 등록번호', width: 130 },
        { key: 'OWNER_BIZ_NO', label: '소유자 사업자번호', width: 130 },
        { key: 'OWNER_ADDRESS', label: '소유자 주소', width: 220, excelAlign: 'left' },
        { key: 'OWNER_EMAIL1', label: '소유자 이메일주소1', width: 180, excelAlign: 'left' },
        { key: 'OWNER_EMAIL2', label: '소유자 이메일주소2', width: 180, excelAlign: 'left' },
        { key: 'JOINT_OWNER_NM', label: '공동소유자명', width: 120 },
        { key: 'JOINT_OWNER_TYPE', label: '공동소유자 구분', width: 130 },
        { key: 'JOINT_OWNER_REG_NO', label: '공동소유자 등록번호', width: 150 },
        { key: 'JOINT_OWNER_BIZ_NO', label: '공동소유자 사업자번호', width: 160 },
        { key: 'JOINT_OWNER_ADDRESS', label: '공동소유자 주소', width: 220, excelAlign: 'left' }
    ];
});

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

const getSearchStartLimitDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - SEARCH_START_LIMIT_YEARS);

    return formatDateInputValue(date);
};

const clampSearchStartDate = (value) => {
    const dateValue = String(value || '');

    if (!dateValue) {
        return dateValue;
    }

    const minDate = getSearchStartLimitDate();

    return dateValue < minDate ? minDate : dateValue;
};

const getInitialSearchDateRange = (memberGb) => {
    const normalizedMemberGb = String(memberGb || '').trim().toUpperCase();
    const today = getFormattedDateOffset(0);

    if (normalizedMemberGb === 'CA' || normalizedMemberGb === 'BA') {
        return {
            startDate: clampSearchStartDate(getFormattedDateOffset(-7)),
            endDate: today
        };
    }

    return {
        startDate: today,
        endDate: today
    };
};

const getInitialSearchFilters = (memberGb = '', branchId = '') => {
    const dateRange = getInitialSearchDateRange(memberGb);
    const normalizedMemberGb = String(memberGb || '').trim().toUpperCase();
    const isSpaceFixed = ['BA', 'SU'].includes(normalizedMemberGb);

    return {
        dateType: dateTypeFallbackOptions[0].CODE_ID,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        processStatus: '',
        plateDeliveryStatus: '',
        spaceType: isSpaceFixed ? branchId : '',
        registrationType: '',
        carKeyword: '',
        orderNo: '',
        ownerName: ''
    };
};

const getUserCompanyId = (user) => String(
    user?.COMPANY_ID ??
    user?.company_ID ??
    user?.companyId ??
    user?.company_id ??
    ''
).trim();
const getUserMemberGb = (user) => String(
    user?.MEMBER_GB ??
    user?.member_GB ??
    user?.memberGb ??
    user?.member_gb ??
    ''
).trim().toUpperCase();
const getUserBranchId = (user) => String(
    user?.BRANCH_ID ??
    user?.branch_ID ??
    user?.branchId ??
    user?.branch_id ??
    ''
).trim();

const toYmd = (value) => String(value || '').replace(/-/g, '');

const toStringValue = (value) => String(value ?? '').trim();
const formatBizNo = (value) => toStringValue(value).replace(/\D/g, '').replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3');

const formatAmount = (value) => {
    const digits = String(value ?? '').replace(/[^0-9-]/g, '');

    if (!digits || digits === '-') {
        return '';
    }

    const numberValue = Number(digits);

    return Number.isNaN(numberValue) ? String(value ?? '') : numberValue.toLocaleString('ko-KR');
};

const formatYn = (value) => {
    const text = toStringValue(value).toUpperCase();
    return text || '';
};

const getComparableValue = (row, column) => {
    const rawValue = row.displayValues?.[column.key] ?? row[column.key] ?? '';

    if (column.sortType === 'number') {
        const numberValue = Number(String(rawValue).replace(/[^0-9.-]/g, ''));
        return Number.isNaN(numberValue) ? Number.NEGATIVE_INFINITY : numberValue;
    }

    if (column.sortType === 'date') {
        const timeValue = new Date(String(rawValue).replace(/\./g, '-')).getTime();
        return Number.isNaN(timeValue) ? Number.NEGATIVE_INFINITY : timeValue;
    }

    return String(row.displayValues?.[column.key] ?? rawValue).trim().toLocaleLowerCase('ko-KR');
};

const getCodeOptions = (codeList, fallbackOptions) => {
    if (Array.isArray(codeList) && codeList.length > 0) {
        return codeList;
    }

    return fallbackOptions;
};

const toSelectOptions = (codeList, fallbackOptions) => [
    { value: '', label: '전체' },
    ...getCodeOptions(codeList, fallbackOptions).map(option => ({
        value: option.CODE_ID,
        label: option.CODE_NM
    }))
];

const buildCodeMap = (codes) => Object.entries(codes || {}).reduce((acc, [groupId, list]) => {
    acc[groupId] = (list || []).reduce((map, code) => {
        map[code.CODE_ID] = code.CODE_NM;
        return map;
    }, {});
    return acc;
}, {});

const getStatusClass = (statusLabel, statusCode) => {
    const code = String(statusCode || '').trim().toUpperCase();

    if (/^(RET)$/.test(code)) {
        return 'reject';
    }

    if (/^(REQ|C_REQ|SAV|INPUT|W_REQ|B_REQ|P_REQ|PREND|PBEND|P_END|S_REQ|S_END|D_MAN|D_PAM|D_DAC)$/.test(code)) {
        return 'progress';
    }

    if (/^(J_REQ|J_ING|J_END|J_WTX|D_REQ|D_ING|D_END|D_CON|D_DLY|D_PAY|D_PAQ|P_RET|END)$/.test(code)) {
        return 'done';
    }

    return 'ready';
};

const getProcessGroupCode = (row) => toStringValue(row.NPROC_ST || row.PROC_ST);

const isRejectRow = (row) => {
    const code = String(row.PROC_ST || '').trim().toUpperCase();
    return /^(RET|REJECT)$/.test(code);
};

const isStatusIn = (row, statusCodes) => statusCodes.includes(getProcessGroupCode(row));

const isDirectRegistrationRow = (row) =>
    getProcessGroupCode(row) === DIRECT_REGISTRATION_PROCESS_CODE ||
    toStringValue(row.DIRECT_YN) === 'Y';

const createStatusCards = (rows) => [
    { label: '정보입력', value: rows.filter(row => isStatusIn(row, ['SAV','REQ'])).length },
    { label: '신청대기', value: rows.filter(row => isStatusIn(row, ['W_REQ'])).length },
    { label: '인도금 납부중', value: rows.filter(row => isStatusIn(row, ['P_REQ','PREND','PBEND'])).length},
    { label: '인도금 납부완료', value: rows.filter(row => isStatusIn(row, ['P_END'])).length },
    { label: '등록 중', value: rows.filter(row => isStatusIn(row, ['S_REQ'])).length },
    { label: '등록 완료', value: rows.filter(row => isStatusIn(row, ['S_END'])).length },
    { label: '반려', value: rows.filter(isRejectRow).length, danger: true },
    { label: '자가등록', value: rows.filter(row => isStatusIn(row, ['DIRCT'])).length , muted: true }
];

const WaNewcarList = () => {
	const { user, logout } = useAuth();
	const memberGb = getUserMemberGb(user);
	const userBranchId = getUserBranchId(user);
	const isSpaceFixed = ['BA', 'SU'].includes(memberGb);
	const canManageNewcarActions = memberGb === 'CA';
    const [codeListMap, setCodeListMap] = useState({});
    const [branchList, setBranchList] = useState([]);
    const [rawRows, setRawRows] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [noticeMessage, setNoticeMessage] = useState('');
    const [searchFilters, setSearchFilters] = useState(() => getInitialSearchFilters(memberGb, userBranchId));
    const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
    const [columnWidths, setColumnWidths] = useState({});
    const [activeRequest, setActiveRequest] = useState(null);
    const [requestRows, setRequestRows] = useState([]);
    const [showRequestConfirm, setShowRequestConfirm] = useState(false);
	const [excelPasswordOpen, setExcelPasswordOpen] = useState(false);
	const [excelPassword, setExcelPassword] = useState('');
	const [excelPasswordError, setExcelPasswordError] = useState('');
	const [excelPasswordChecking, setExcelPasswordChecking] = useState(false);
	const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
	const [mobileFilterDraft, setMobileFilterDraft] = useState(null);
	const [isMobileView, setIsMobileView] = useState(() => (
		typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
	));
	const [showSuChangeModal, setShowSuChangeModal] = useState(false);
	const [changeUser, setChangeUser] = useState(null);
	const [userList, setUserList] = useState([]);
    const fileInputRef = useRef(null);
	const gridPanelRef = useRef(null);
	const [gridPanelHeight, setGridPanelHeight] = useState(null);
    const searchStartLimitDate = getSearchStartLimitDate();
	// 더블클릭 했을 때 해당 건으로 들어가기 위해
	const [clickTimer, setClickTimer] = useState(null);
	// 엑셀 업로드 / 양식 다운로드 선택 모달
	const [excelUploadModalOpen, setExcelUploadModalOpen] = useState(false);
	// 전체 로딩중
	const [templateDownloading, setTemplateDownloading] = useState(false);

	// SERVICE_ID별 진행단계 기억
	// - 신규등록현황 화면이 살아있는 동안만 유지되는 휘발성 데이터
	// - 목록 재조회 시 clear()
	// - 로그아웃 또는 화면 종료 시 자동 초기화
	const stepMemoryRef = useRef(new Map());
	
	const handleRowClick = (row) => {
	    if (clickTimer) {
	        clearTimeout(clickTimer);
	        setClickTimer(null);
	        handleRowDoubleClick(row);
	        return;
	    }

	    const timer = setTimeout(() => {
	        setClickTimer(null);
	    }, 250);

	    setClickTimer(timer);
	};

    const codeMap = useMemo(() => buildCodeMap(codeListMap), [codeListMap]);

    const formatCode = useCallback((groupId, value) => {
        const codeValue = toStringValue(value);
        return codeMap[groupId]?.[codeValue] || codeValue;
    }, [codeMap]);

    const dateTypeOptions = useMemo(
        () => getCodeOptions(codeListMap.NEWDT, dateTypeFallbackOptions),
        [codeListMap.NEWDT]
    );


    const processStatusOptions = useMemo(
        () => toSelectOptions(codeListMap.NPRST, processStatusFallbackOptions).map(option => (
            option.value === 'P_END'
                ? { ...option, label: '인도금 납부완료' }
                : option
        )),
        [codeListMap.NPRST]
    );

	const spaceOptions = useMemo(() => {
	    const branchOptions = branchList.map(branch => ({
	        value: branch.BRANCH_ID,
	        label: branch.BRANCH_NM
	    }));

	    const availableSpaceOptions = branchOptions.length > 0 ? branchOptions : spaceFallbackOptions;

	    const selectableSpaceOptions = memberGb === 'CA'
	        ? availableSpaceOptions.filter(option => String(option.label || '').trim() !== '본점')
	        : availableSpaceOptions;

	    if (isSpaceFixed) {
	        const mySpace = selectableSpaceOptions.find(option => String(option.value) === String(userBranchId));

	        return [
	            {
	                value: userBranchId,
	                label: mySpace?.label || userBranchId || '내 SPACE'
	            }
	        ];
	    }

	    return [
	        { value: '', label: '전체' },
	        ...selectableSpaceOptions
	    ];
	}, [branchList, memberGb, isSpaceFixed, userBranchId]);

    const rows = useMemo(() => rawRows.map((row, index) => {
		
        const processStatus = formatCode('NPRST', row.NPROC_ST || row.PROC_ST);
        const paymentStatus = formatCode('PAYST', row.PAY_ST);
        const rowKey = toStringValue(row.SERVICE_ID) || `${row.LINK_ID || 'row'}-${index}`;
        const displayValues = {
            SEQ: index + 1,
            REGIST_DATE: row.REGIST_DATE || '',
            PROC_ST: processStatus,
            LINK_ID: row.LINK_ID || '',
            CARID_NO: row.CARID_NO || '',
            CAR_NO: toStringValue(row.CAR_NO).trim() || row.REQ_CAR_NO || '',
            CUSTOMER_NM: row.CUSTOMER_NM || '',
            OWNER_NM: row.OWNER_NM || '',
            BUY_AMT: formatAmount(row.BUY_AMT),
			ATTACH_YN: toStringValue(row.ATTACH_YN) === 'Y' ? (toStringValue(row.ATTACH_COMPLETE_YN) === 'Y' ? 'Y' : 'N') : '',
			CARD_YN: ['Y', 'T'].includes(toStringValue(row.CARD_YN)) ? (toStringValue(row.CARD_PAY_YN) === 'Y' ? 'Y' : 'N') : '',
            NTAX_YN: formatYn(row.NTAX_YN),
            PAY_ST: paymentStatus,
            BPAY_DT: row.BPAY_DT || '',
            PAY_DT: row.PAY_DT || '',
            INS_DATE: row.INS_DATE || '',
			
			// DIRECT(자가등록)건은 JUDGE_DT 대신 REGIST_DATE(등록예정일) 날짜를 사용
			JUDGE_DT: isDirectRegistrationRow(row)
			    ? (row.REGIST_DATE || '')
			    : (row.JUDGE_DT || ''),
				
            INSTALL_YN: row.INSTALL_YN || '',
            SPACE: row.SPACE || '',
            LAST_DELIVERY_ADDR: row.LAST_DELIVERY_ADDR || '',
            MEMBER_ID: row.MEMBER_ID || '',
            RETURN_TX: row.RETURN_TX || '',
            CAR_NM: row.CAR_NM || ''
        };

        return {
            ...row,
            rowKey,
            displayValues,
            processStatusCode: row.PROC_ST,
            processStatusGroupCode: row.NPROC_ST,
            paymentStatusCode: row.PAY_ST,
            seq: displayValues.SEQ,
            expectedDate: displayValues.REGIST_DATE,
            processStatus,
            orderNo: displayValues.LINK_ID,
            vin: displayValues.CARID_NO,
            carNo: displayValues.CAR_NO,
            owner: displayValues.OWNER_NM,
            amount: displayValues.BUY_AMT,
            docs: displayValues.ATTACH_YN,
            cardPay: displayValues.CARD_YN,
            discount: displayValues.NTAX_YN,
            paymentStatus,
            carPayDate: displayValues.BPAY_DT,
            regPayDate: displayValues.PAY_DT,
            inputDate: displayValues.INS_DATE,
            regDate: displayValues.JUDGE_DT,
            installYn: displayValues.INSTALL_YN,
            space: displayValues.SPACE,
            address: displayValues.LAST_DELIVERY_ADDR,
            sp: displayValues.MEMBER_ID,
            remark: displayValues.RETURN_TX
        };
    }), [formatCode, rawRows]);

    const sortedRows = useMemo(() => {
        if (!sortConfig.key) {
            return rows;
        }

        const sortColumn = columns.find(column => column.key === sortConfig.key);

        if (!sortColumn || sortColumn.sortable === false) {
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

    const gridWidth = useMemo(() => columns.reduce((total, column) => {
        const width = columnWidths[column.key] ?? column.width ?? column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
        return total + width;
    }, 0), [columnWidths]);
    const statusCards = useMemo(() => createStatusCards(rawRows), [rawRows]);

    const selectedRowKeySet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);
    const allRowsSelected = rows.length > 0 && rows.every(row => selectedRowKeySet.has(row.rowKey));
    const selectedRows = useMemo(() => rows.filter(row => selectedRowKeySet.has(row.rowKey)), [rows, selectedRowKeySet]);
	const mobileDetailFilterCount = [
		!isSpaceFixed && searchFilters.spaceType,
		searchFilters.plateDeliveryStatus,
		searchFilters.carKeyword
	].filter(Boolean).length;
	const activeMobileFilters = mobileFilterDraft || searchFilters;

	const buildSearchPayload = useCallback((filters) => ({
	    WORK_CD: '010',
	    DATE_CD: filters.dateType,
	    START_DT: toYmd(clampSearchStartDate(filters.startDate)),
	    END_DT: toYmd(filters.endDate),
	    CAR_NO: filters.carKeyword.trim(),
	    LINK_ID: filters.orderNo.trim(),
	    CUSTOMER_NM: filters.ownerName.trim(),
	    PAY_GB: filters.registrationType,
	    PROC_ST: filters.processStatus,
	    NUM_PROC_ST: filters.plateDeliveryStatus,
	    SPACE_TYPE: isSpaceFixed ? userBranchId : filters.spaceType
	}), [isSpaceFixed, userBranchId]);

    const fetchNewCarList = useCallback(async (filters) => {
        setLoading(true);
        setErrorMessage('');
		
		// 목록을 다시 조회하면 이전에 기억한 진행단계 모두 초기화
		stepMemoryRef.current.clear();

        try {
            const response = await axios.post('/api/newcar/wa-list', buildSearchPayload(filters), { withCredentials: true });

            if (response.data?.success) {
                setRawRows(response.data.list || []);
                setSelectedRowKeys([]);
                return;
            }

            setErrorMessage(response.data?.message || '신규신청현황 조회에 실패했습니다.');
        } catch (error) {
            console.error('WA 신규신청현황 조회 실패:', error);

            if (error.response?.status === 401 || error.response?.status === 403) {
                await logout({ redirectTo: '/wa/login' });
                return;
            }

            setErrorMessage('신규신청현황 조회 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [buildSearchPayload, logout]);

    useEffect(() => {
        let isMounted = true;
        const companyId = getUserCompanyId(user);

        const fetchInitialData = async () => {
            try {
                const [codeResponse, branchResponse] = await Promise.all([
                    axios.post('/api/codes/list', { groupIds: ['NEWDT', 'PSNGB', 'NPRST', 'PAYST'] }),
                    companyId
                        ? axios.get('/api/branch/list', { params: { companyId } })
                        : Promise.resolve({ data: { success: false, list: [] } })
                ]);

                if (!isMounted) return;

                if (codeResponse.data?.success) {
                    setCodeListMap(codeResponse.data.codes || {});
                }

                if (branchResponse.data?.success) {
                    setBranchList(branchResponse.data.list || []);
                }
            } catch (error) {
                console.error('WA 신규신청현황 초기 데이터 조회 실패:', error);
            }
        };

		const initialFilters = getInitialSearchFilters(memberGb, userBranchId);
		setSearchFilters(initialFilters);

		fetchInitialData();
		fetchNewCarList(initialFilters);

        return () => {
            isMounted = false;
        };
        // 최초 진입 시 현재 기본 조회조건으로 한 번만 조회한다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchNewCarList, memberGb, user]);

    useEffect(() => {
        const hasSelectedDateType = dateTypeOptions.some(option => option.CODE_ID === searchFilters.dateType);

        if (!hasSelectedDateType && dateTypeOptions.length > 0) {
            setSearchFilters(prev => ({
                ...prev,
                dateType: dateTypeOptions[0].CODE_ID
            }));
        }
    }, [dateTypeOptions, searchFilters.dateType]);

	useEffect(() => {
		const mediaQuery = window.matchMedia('(max-width: 760px)');
		const syncMobileView = (event) => {
			setIsMobileView(event.matches);
			if (!event.matches) setMobileFilterOpen(false);
		};

		mediaQuery.addEventListener('change', syncMobileView);
		return () => mediaQuery.removeEventListener('change', syncMobileView);
	}, []);

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        const nextValue = name === 'startDate' ? clampSearchStartDate(value) : value;

        setSearchFilters(prev => ({
            ...prev,
            [name]: nextValue
        }));
    };

	const handleMobileFilterChange = (event) => {
		const { name, value } = event.target;

		setMobileFilterDraft(prev => ({
			...(prev || searchFilters),
			[name]: value
		}));
	};

	const openMobileFilters = () => {
		setMobileFilterDraft({ ...searchFilters });
		setMobileFilterOpen(true);
	};

	const clearMobileFilters = () => {
		setMobileFilterDraft(prev => ({
			...(prev || searchFilters),
			spaceType: isSpaceFixed ? userBranchId : '',
			plateDeliveryStatus: '',
			carKeyword: ''
		}));
	};

	const applyMobileFilters = () => {
		const nextFilters = mobileFilterDraft || searchFilters;
		setSearchFilters(nextFilters);
		setMobileFilterOpen(false);
		fetchNewCarList(nextFilters);
	};

	const handleMobileProcessStatus = (processStatus) => {
		const nextFilters = { ...searchFilters, processStatus };
		setSearchFilters(nextFilters);
		fetchNewCarList(nextFilters);
	};

    const handleDateQuickRange = (startOffset) => {
        setSearchFilters(prev => ({
            ...prev,
            startDate: clampSearchStartDate(getFormattedDateOffset(startOffset)),
            endDate: getFormattedDateOffset(0)
        }));
    };

	const handleReset = () => {
	    const nextFilters = getInitialSearchFilters(memberGb, userBranchId);
	    setSearchFilters(nextFilters);
	    fetchNewCarList(nextFilters);
	};

    const handleExport = () => {
        if (rows.length === 0) {
            setErrorMessage('내보낼 데이터가 없습니다.');
            setNoticeMessage('');
            return;
        }

        exportRowsToXlsx({
            columns,
            rows: sortedRows.map((row, index) => ({
                ...row,
                displayValues: {
                    ...row.displayValues,
                    SEQ: index + 1
                }
            })),
            fileName: `신규등록현황_${getFormattedDateOffset(0)}.xlsx`,
            sheetName: '신규등록현황',
            getCellValue: (row, column) => row.displayValues[column.key] ?? ''
        });
    };

    const handlePrivacyExport = (privacyRows) => {
        const privacyByServiceId = new Map((privacyRows || []).map(row => [
            toStringValue(row.SERVICE_ID),
            row
        ]));

        exportRowsToXlsx({
            columns: privacyExcelColumns,
            rows: sortedRows.map((row, index) => {
                const privacy = privacyByServiceId.get(toStringValue(row.SERVICE_ID)) || {};

                return {
                    ...row,
                    displayValues: {
                        ...row.displayValues,
                        SEQ: index + 1,
                        OWNER_NM: privacy.OWNER_NM || row.displayValues.OWNER_NM || '',
                        OWNER_TYPE: privacy.OWNER_TYPE || '',
                        OWNER_REG_NO: gf.formatRegNo(privacy.OWNER_REG_NO),
                        OWNER_BIZ_NO: formatBizNo(privacy.OWNER_BIZ_NO),
                        OWNER_ADDRESS: privacy.OWNER_ADDRESS || '',
                        OWNER_EMAIL1: privacy.OWNER_EMAIL1 || '',
                        OWNER_EMAIL2: privacy.OWNER_EMAIL2 || '',
                        JOINT_OWNER_NM: privacy.JOINT_OWNER_NM || '',
                        JOINT_OWNER_TYPE: privacy.JOINT_OWNER_TYPE || '',
                        JOINT_OWNER_REG_NO: gf.formatRegNo(privacy.JOINT_OWNER_REG_NO),
                        JOINT_OWNER_BIZ_NO: formatBizNo(privacy.JOINT_OWNER_BIZ_NO),
                        JOINT_OWNER_ADDRESS: privacy.JOINT_OWNER_ADDRESS || ''
                    }
                };
            }),
            fileName: `신규등록현황_${getFormattedDateOffset(0)}.xlsx`,
            sheetName: '신규등록현황',
            getCellValue: (row, column) => row.displayValues[column.key] ?? ''
        });
    };

	const closeExcelPasswordModal = () => {
		if (excelPasswordChecking) return;
		setExcelPasswordOpen(false);
		setExcelPassword('');
		setExcelPasswordError('');
	};

	const requestExcelExport = () => {
		if (rows.length === 0) {
			handleExport();
			return;
		}

		if (memberGb !== 'CA') {
			handleExport();
			return;
		}

		setExcelPassword('');
		setExcelPasswordError('');
		setExcelPasswordOpen(true);
	};

	const handleExcelPasswordSubmit = async (event) => {
		event.preventDefault();

		if (!excelPassword) {
			setExcelPasswordError('현재 로그인 비밀번호를 입력하세요.');
			return;
		}

		try {
			setExcelPasswordChecking(true);
			setExcelPasswordError('');

			const response = await axios.post('/api/newcar/wa-excel/privacy', {
				PASS_WD: excelPassword,
				SEARCH: buildSearchPayload(searchFilters)
			}, { withCredentials: true });

			if (!response.data?.success) {
				setExcelPasswordError(response.data?.message || '비밀번호가 일치하지 않습니다.');
				return;
			}

			setExcelPasswordOpen(false);
			setExcelPassword('');
			handlePrivacyExport(response.data?.list || []);
		} catch (error) {
			setExcelPasswordError(
				error.response?.data?.error?.message
				|| error.response?.data?.message
				|| '비밀번호 확인 중 오류가 발생했습니다.'
			);
		} finally {
			setExcelPasswordChecking(false);
		}
	};

    const handleHeaderActionClick = (actionKey) => {
        if (actionKey === 'search') {
            fetchNewCarList(searchFilters);
            return;
        }

        if (actionKey === 'export') {
            requestExcelExport();
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

    const handleExcelClick = () => {
        if (!canManageNewcarActions) {
            return;
        }

        setErrorMessage('');
        setNoticeMessage('');
        //fileInputRef.current?.click();
		
		// 바로 파일 선택창을 열지 않고 엑셀 작업 선택 모달을 연다.
		setExcelUploadModalOpen(true);
    };
	
	// 엑셀 파일 업로드 선택
	const handleExcelUploadClick = () => {

	    setExcelUploadModalOpen(false);

	    // 기존 파일 선택창 호출
	    fileInputRef.current?.click();
	};
	
	// 신규등록 엑셀 업로드 양식 다운로드
	const handleExcelTemplateDownload = async () => {

	    const companyId = getUserCompanyId(user);
	    let fileNm;

	    if (companyId === 'WA001') {
	        fileNm = '폴스타_엑셀업로드양식.xlsx';
	    }

	    if (!fileNm) {
	        gf.alert('등록된 엑셀 양식이 없습니다.');
	        return;
	    }

	    setExcelUploadModalOpen(false);

	    // 전체 화면 로딩 시작
	    setTemplateDownloading(true);

	    try {

	        // React가 로딩 화면을 먼저 렌더링할 시간 확보
	        await new Promise(resolve => setTimeout(resolve, 100));

	        // 로컬 테스트용 2초 지연
	        //await new Promise(resolve => setTimeout(resolve, 1500));

	        const response = await axios.get('/api/newcar/excel-template', {
	            params: {
	                fileName: fileNm
	            },
	            responseType: 'blob'
	        });

	        const url = window.URL.createObjectURL(response.data);
	        const link = document.createElement('a');

	        link.href = url;
	        link.download = fileNm;

	        document.body.appendChild(link);
	        link.click();
	        link.remove();

	        window.URL.revokeObjectURL(url);

	    } catch (error) {

	        console.error('엑셀 양식 다운로드 실패:', error);
	        gf.alert('엑셀 양식 다운로드 중 오류가 발생했습니다.');

	    } finally {

	        setTemplateDownloading(false);

	    }
	};

    const handleExcelUpload = async (event) => {
        const fileInput = event.target;
        const file = fileInput?.files?.[0];

        if (!file) {
            setErrorMessage('파일이 없습니다.');
            setNoticeMessage('');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        setNoticeMessage('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post('/api/newcar/excel-upload', formData);

            if (response.data?.data?.success) {
                const insertCount = response.data.data?.insertCount ?? 0;
                setNoticeMessage(`업로드 완료 ${insertCount}건`);
                await fetchNewCarList(searchFilters);
                return;
            }

            if (response.data?.message === '로그인 정보 없음') {
                setErrorMessage('세션이 만료되었습니다. 다시 로그인해주세요.');
                await logout({ redirectTo: '/wa/login' });
                return;
            }

            const errors = response.data?.data?.errors;
            const errorText = Array.isArray(errors) && errors.length
                ? errors.map(error => `${error.row ?? ''}행: ${(error.errors || []).join(', ')}`).join('\n')
                : '';
            const uploadErrorDetail = response.data?.message || response.data?.data?.message || errorText || '등록 실패';
            setErrorMessage(`오류사항 수정 후 재업로드 부탁드립니다.\n${uploadErrorDetail}`);
        } catch (error) {
            console.error('WA 엑셀 업로드 실패:', error);

            if (error.response?.status === 401 || error.response?.status === 403) {
                setErrorMessage('세션이 만료되었습니다. 다시 로그인해주세요.');
                await logout({ redirectTo: '/wa/login' });
                return;
            }

            setErrorMessage('등록 중 오류가 발생했습니다.');
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setLoading(false);
        }
    };
    const handleRequestClick = () => {
        setErrorMessage('');
        setNoticeMessage('');

        if (selectedRows.length === 0) {
            setErrorMessage('선택된 건이 없습니다.');
            return;
        }

        const invalidRows = selectedRows.filter(row => toStringValue(row.PROC_ST) !== 'W_REQ');

        if (invalidRows.length > 0) {
            setErrorMessage('처리상태가 신청대기인 건만 신청 가능합니다.');
            setSelectedRowKeys([]);
            return;
        }

        setRequestRows(selectedRows);
        setShowRequestConfirm(true);
    };

    const handleRequestConfirm = async () => {
        setLoading(true);
        setErrorMessage('');
        setNoticeMessage('');

        try {
            const payload = requestRows.map(row => ({ SERVICE_ID: row.SERVICE_ID }));
            const response = await axios.post('/api/newcar/request-process', payload);

            if (response.data?.success) {
                setNoticeMessage('신청이 완료되었습니다.');
                setSelectedRowKeys([]);
                await fetchNewCarList(searchFilters);
                return;
            }

            setErrorMessage(response.data?.message || '신청 실패');
        } catch (error) {
            console.error('WA 신규등록 신청 실패:', error);

            if (error.response?.status === 401 || error.response?.status === 403) {
                setErrorMessage('세션이 만료되었습니다. 다시 로그인해주세요.');
                await logout({ redirectTo: '/wa/login' });
                return;
            }

            setErrorMessage('신청 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
            setShowRequestConfirm(false);
            setRequestRows([]);
        }
    };

    const handlePaymentClick = async () => {
        setErrorMessage('');
        setNoticeMessage('');

        if (selectedRows.length === 0) {
            setErrorMessage('선택된 건이 없습니다.');
            return;
        }

        const invalidRows = selectedRows.filter(row => {
            const procStatus = toStringValue(row.PROC_ST);
            return procStatus !== 'P_REQ' && procStatus !== 'PREND';
        });

        if (invalidRows.length > 0) {
            setErrorMessage('납부요청 또는 등록비용 납부 상태만 처리 가능합니다.');
            return;
        }

        setLoading(true);

        try {
            const today = new Date();
            const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
            const payload = selectedRows.map(row => {
                const procStatus = toStringValue(row.PROC_ST);
                let nextStatus = '';

                if (procStatus === 'P_REQ') {
                    nextStatus = 'PBEND';
                } else if (procStatus === 'PREND') {
                    const registDate = toYmd(row.REGIST_DATE);
                    nextStatus = registDate && registDate <= todayYmd ? 'S_REQ' : 'P_END';
                }

                return {
                    SERVICE_ID: row.SERVICE_ID,
                    PROC_ST: nextStatus,
					CAR_NO: row.REQ_CAR_NO,
					SU_ID: row.SU_ID,
					PAY_HP_NO: row.PAY_HP_NO
                };
            });

            const response = await axios.post('/api/newcar/payment-process', payload);

            if (response.data?.success) {
                setNoticeMessage('차량대금 납부 처리가 완료되었습니다.');
                setSelectedRowKeys([]);
                await fetchNewCarList(searchFilters);
                return;
            }

            setErrorMessage(response.data?.message || '처리 실패!');
        } catch (error) {
            console.error('WA 차량대금 납부 처리 실패:', error);

            if (error.response?.status === 401 || error.response?.status === 403) {
                setErrorMessage('세션이 만료되었습니다. 다시 로그인해주세요.');
                await logout({ redirectTo: '/wa/login' });
                return;
            }

            setErrorMessage('납부 처리 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };
	
	const currentSuNames = [...new Set(
	    selectedRows.map(row => row.MEMBER_ID)
	)];

	const currentSuText = currentSuNames.length === 1
	    ? ` ${currentSuNames[0]}`
	    : ` ${currentSuNames.join(", ")}`;
		
	const handleSuChangeClick = async () => {
	    setErrorMessage("");
	    setNoticeMessage("");

	    if (selectedRows.length === 0) {
	        setErrorMessage("선택된 건이 없습니다.");
	        return;
	    }

		// 같은 지점 담당자 조회
	    const res = await axios.post("/api/company/user/list", 		{
		    MEMBER_GB: "SU",
		    BRANCH_ID: selectedRows[0].BRANCH_ID
		});
		
		
		setUserList(res.data.list);
	    setShowSuChangeModal(true);
	};
	
	const handleSuChangeConfirm = async () => {
		if (!changeUser?.LOGIN_ID) {
	        gf.alert("변경 담당자를 선택하세요.");
	        return;
	    }
		
	    try {
			const params = {
	            CHAGE_SU_ID: changeUser.LOGIN_ID,
	            CHAGE_SU_NM: changeUser.MEMBER_NM,
	            CHAGE_SU_HP: changeUser.MPHONE_NO,

	            LIST: selectedRows.map(row => ({
	                SERVICE_ID: row.SERVICE_ID
	            }))
	        };


	        await axios.post(
	            "/api/newcar/change-su",
	            params
	        );
	        gf.alert("담당자가 변경되었습니다.");
	        setShowSuChangeModal(false);
			setChangeUser(null);
	        fetchNewCarList(searchFilters);
	    } catch (e) {
	        gf.alert("담당자 변경 중 오류가 발생했습니다.");
	    }
	};

    const handleGridActionClick = (actionKey) => {
		if (actionKey === 'suChange') {
		    if (memberGb !== 'BA') return;

		    handleSuChangeClick();
		    return;
		}

		if (memberGb !== 'CA') return;

		if (actionKey === 'apply') {
		    handleRequestClick();
		    return;
		}

		if (actionKey === 'payment') {
		    handlePaymentClick();
		    return;
		}
    };
    const toggleAllRows = (checked) => {
        setSelectedRowKeys(checked ? rows.map(row => row.rowKey) : []);
    };

    const toggleRow = (rowKey, checked) => {
        setSelectedRowKeys(prev => {
            if (checked) {
                return prev.includes(rowKey) ? prev : [...prev, rowKey];
            }

            return prev.filter(key => key !== rowKey);
        });
    };

    const handleRowDoubleClick = useCallback((row) => {
        if (isDirectRegistrationRow(row)) {
            return;
        }

        const serviceId = toStringValue(row.SERVICE_ID);

        if (!serviceId) {
            setErrorMessage('SERVICE_ID가 없어 신규등록 화면을 열 수 없습니다.');
            return;
        }

        setActiveRequest({
            serviceId,
            title: row.displayValues?.LINK_ID || serviceId
        });
    }, []);

    // 신규등록 상세 모달을 닫으면 현재 조회조건으로 목록을 다시 조회한다.
    // 조회 버튼과 같은 함수를 호출하므로 모달에서 변경된 처리상태와 금액이 즉시 반영된다.
    const handleCloseRequestFrame = useCallback(() => {
        setActiveRequest(null);
        fetchNewCarList(searchFilters);
    }, [fetchNewCarList, searchFilters]);

    useEffect(() => {
        if (!activeRequest) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                handleCloseRequestFrame();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeRequest, handleCloseRequestFrame]);

    const getColumnWidth = useCallback((column) => (
        columnWidths[column.key] ?? column.width ?? column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH
    ), [columnWidths]);
	
	// 고정 컬럼 각각의 left 위치를 현재 컬럼 폭 기준으로 계산
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

	// 헤더와 일반 셀에 적용할 고정 컬럼 클래스
	const getColumnClassName = useCallback((column) => {
	    const classNames = [column.className];

	    if (PINNED_COLUMN_SET.has(column.key)) {
	        classNames.push('wa-status-sticky-column');

	        // 마지막 고정 컬럼인 주문번호 오른쪽에 구분선 표시
	        if (column.key === PINNED_COLUMN_KEYS[PINNED_COLUMN_KEYS.length - 1]) {
	            classNames.push('wa-status-sticky-column-last');
	        }
	    }

	    return classNames.filter(Boolean).join(' ') || undefined;
	}, []);

	// 고정 컬럼의 left 값
	const getStickyColumnStyle = useCallback((column) => (
	    PINNED_COLUMN_SET.has(column.key)
	        ? { left: `${stickyColumnOffsets[column.key] ?? 0}px` }
	        : undefined
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
        if (column.resizable === false) return;

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


    const renderGridCell = (row, column, rowIndex) => {
        if (column.type === 'checkbox') {
            return (
                <input
                    type="checkbox"
                    aria-label={`${row.displayValues.LINK_ID || row.rowKey} 선택`}
                    checked={selectedRowKeySet.has(row.rowKey)}
                    onChange={event => toggleRow(row.rowKey, event.target.checked)}
                />
            );
        }

        if (
            isDirectRegistrationRow(row) &&
            DIRECT_REGISTRATION_BLANK_COLUMN_KEYS.has(column.key)
        ) {
            return '';
        }

        if (column.type === 'processStatus') {
            return <span className={`wa-grid-status ${getStatusClass(row.displayValues.PROC_ST, row.processStatusCode)}`}>{row.displayValues.PROC_ST}</span>;
        }

        if (column.type === 'remark') {
            return <span className={isRejectRow(row) ? 'wa-grid-danger' : ''}>{row.displayValues.RETURN_TX}</span>;
        }

        if (column.key === 'SEQ') {
            return rowIndex + 1;
        }

        return row.displayValues[column.key] ?? '';
    };

	const getGridCellClassName = (row, column) => {
	    const classNames = [getColumnClassName(column)];
	    const processGroupCode = getProcessGroupCode(row);

	    if (!PINNED_COLUMN_SET.has(column.key)) {
	        if (processGroupCode === 'S_END') {
	            classNames.push('wa-row-complete');
	        } else if (processGroupCode === 'DIRCT') {
	            classNames.push('wa-row-direct');
	        } else if (processGroupCode === 'RET') {
	            classNames.push('wa-row-reject');
	        }
	    }

	    if (
	        ['ATTACH_YN', 'CARD_YN'].includes(column.key)
	        && row.displayValues[column.key] === 'N'
	    ) {
	        classNames.push('wa-requirement-pending');
	    }

	    return classNames.filter(Boolean).join(' ') || undefined;
	};
	// 모달 세로가 화면보다 커진 경우 상단 정렬
	const frameRef = useRef(null);
	const [isOverflow, setIsOverflow] = useState(false);

	useLayoutEffect(() => {
	    if (!activeRequest) return;

	    const check = () => {
	        if (!frameRef.current) return;

	        setIsOverflow(
	            frameRef.current.scrollHeight > window.innerHeight - 48
	        );
	    };

	    check();

	    const resizeObserver = new ResizeObserver(check);

	    if (frameRef.current) {
	        resizeObserver.observe(frameRef.current);
	    }

	    window.addEventListener('resize', check);

	    return () => {
	        resizeObserver.disconnect();
	        window.removeEventListener('resize', check);
	    };
	}, [activeRequest]);

	useEffect(() => {
		if (!mobileFilterOpen) return undefined;

		const closeOnEscape = (event) => {
			if (event.key === 'Escape') setMobileFilterOpen(false);
		};

		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	}, [mobileFilterOpen]);

	const pageHasModal = Boolean(activeRequest || showRequestConfirm || mobileFilterOpen || excelPasswordOpen);
	
	useLayoutEffect(() => {
	    let frameId = null;

	    const updateGridHeight = () => {
	        if (frameId) cancelAnimationFrame(frameId);

	        frameId = requestAnimationFrame(() => {
	            if (!gridPanelRef.current) return;

	            const viewportHeight = window.visualViewport?.height || window.innerHeight;
	            const gridTop = gridPanelRef.current.getBoundingClientRect().top;
	            const availableHeight = viewportHeight - gridTop - 12;

	            if (availableHeight < 220) {
	                setGridPanelHeight(420);
	                return;
	            }

	            setGridPanelHeight(Math.min(620, availableHeight));
	        });
	    };

	    updateGridHeight();

	    window.addEventListener('resize', updateGridHeight);
	    window.visualViewport?.addEventListener('resize', updateGridHeight);

	    const resizeObserver = new ResizeObserver(updateGridHeight);

	    if (gridPanelRef.current?.parentElement) {
	        resizeObserver.observe(gridPanelRef.current.parentElement);
	    }

	    return () => {
	        if (frameId) cancelAnimationFrame(frameId);
	        window.removeEventListener('resize', updateGridHeight);
	        window.visualViewport?.removeEventListener('resize', updateGridHeight);
	        resizeObserver.disconnect();
	    };
	}, [rawRows.length]);

    return (
        <div className={`wa-status-page wa-newcar-list-page${pageHasModal ? ' has-modal' : ''}${selectedRows.length > 0 ? ' has-mobile-selection' : ''}`}>
            <div className="wa-status-page-content" aria-hidden={pageHasModal ? 'true' : undefined}>
            <div className="wa-mobile-sticky-controls">
            <section className="wa-mobile-list-toolbar" aria-label="모바일 신규신청현황 조회 조건">
                <div className="wa-mobile-period-row">
                    <select name="dateType" value={searchFilters.dateType} onChange={handleFilterChange} aria-label="기준일자">
                        {dateTypeOptions.map(option => (
                            <option key={option.CODE_ID} value={option.CODE_ID}>{option.CODE_NM}</option>
                        ))}
                    </select>
                    <input type="date" name="startDate" value={searchFilters.startDate} min={searchStartLimitDate} onChange={handleFilterChange} aria-label="조회 시작일" />
                    <input type="date" name="endDate" value={searchFilters.endDate} onChange={handleFilterChange} aria-label="조회 종료일" />
                </div>

                <div className="wa-mobile-keyword-row">
                    <input type="text" name="ownerName" value={searchFilters.ownerName} onChange={handleFilterChange} placeholder="계약자명" aria-label="계약자명" autoComplete="off" />
                    <input type="text" name="orderNo" value={searchFilters.orderNo} onChange={handleFilterChange} placeholder="주문번호" aria-label="주문번호" autoComplete="off" />
                </div>

                <div className="wa-mobile-toolbar-actions">
                    <button type="button" className="wa-mobile-toolbar-button" onClick={openMobileFilters}>
                        <Filter size={17} />
                        <span>필터</span>
                        {mobileDetailFilterCount > 0 && <strong>{mobileDetailFilterCount}</strong>}
                    </button>
                    <button type="button" className="wa-mobile-toolbar-button primary" onClick={() => fetchNewCarList(searchFilters)} disabled={loading}>
                        <Search size={17} />
                        <span>조회</span>
                    </button>
                    <details className="wa-mobile-more-menu">
                        <summary aria-label="엑셀 및 추가 기능">
                            <MoreVertical size={19} />
                        </summary>
                        <div className="wa-mobile-more-popover">
                            <button type="button" onClick={event => { requestExcelExport(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>
                                <Download size={16} /> 엑셀 다운로드
                            </button>
                            {canManageNewcarActions && (
                                <button type="button" onClick={event => { handleExcelClick(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>
                                    <Upload size={16} /> 엑셀 업로드
                                </button>
                            )}
                            <button type="button" onClick={event => { handleReset(); event.currentTarget.closest('details')?.removeAttribute('open'); }}>
                                <RotateCcw size={16} /> 조회조건 초기화
                            </button>
                        </div>
                    </details>
                </div>
            </section>

            <nav className="wa-mobile-status-chips" aria-label="처리상태 필터">
                {processStatusOptions.map(option => (
                    <button
                        key={option.value || 'ALL'}
                        type="button"
                        className={searchFilters.processStatus === option.value ? 'active' : ''}
                        aria-pressed={searchFilters.processStatus === option.value}
                        onClick={() => handleMobileProcessStatus(option.value)}
                        disabled={loading}
                    >
                        {option.label}
                    </button>
                ))}
            </nav>

            <div className="wa-mobile-result-heading">
                <strong>검색 결과 총 {rows.length}건</strong>
                <label>
                    <input type="checkbox" checked={allRowsSelected} onChange={event => toggleAllRows(event.target.checked)} />
                    <span>전체 선택</span>
                </label>
            </div>
            </div>

            <section className="wa-status-top-toolbar" aria-label="신규신청현황 조회 조건">
                <section className="wa-status-period-panel" aria-label="조회 기간">
                    <label className="wa-status-field wa-status-date-field" aria-label="기준일자">
                        <div className="wa-status-date-controls">
                            <select name="dateType" value={searchFilters.dateType} onChange={handleFilterChange}>
                                {dateTypeOptions.map(option => (
                                    <option key={option.CODE_ID} value={option.CODE_ID}>{option.CODE_NM}</option>
                                ))}
                            </select>
                            <div className="wa-status-date-range">
                                <input type="date" name="startDate" value={searchFilters.startDate} min={searchStartLimitDate} onChange={handleFilterChange} />
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

                <div className="wa-status-actions" aria-label="신규신청현황 기능 버튼">
                    {headerActionButtons.map(({ key, label, Icon, variant }) => (
                        <button key={key} type="button" className={`wa-status-action ${variant} wa-status-action-${key}`} onClick={() => handleHeaderActionClick(key)} disabled={loading && key === 'search'}>
                            <Icon size={15} />
                            <span>{label}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="wa-status-card-grid" aria-label="처리 현황 요약">
                {statusCards.map(card => (
                    <button key={card.label} type="button" className={`wa-status-card${card.active ? ' active' : ''}${card.danger ? ' danger' : ''}${card.muted ? ' muted' : ''}`}>
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                    </button>
                ))}
            </section>

            <section className="wa-status-filter-panel" aria-label="검색 조건">
                <label className="wa-status-field">
                    <span>SPACE 구분</span>
                    <select name="spaceType" value={searchFilters.spaceType} onChange={handleFilterChange}disabled={isSpaceFixed}>
                        {spaceOptions.map(option => (
                            <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>

                <label className="wa-status-field">
                    <span>처리상태</span>
                    <select name="processStatus" value={searchFilters.processStatus} onChange={handleFilterChange}>
                        {processStatusOptions.map(option => (
                            <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>

                <label className="wa-status-field">
                    <span>번호판 배송상태</span>
                    <select name="plateDeliveryStatus" value={searchFilters.plateDeliveryStatus} onChange={handleFilterChange}>
                        {plateDeliveryOptions.map(option => (
                            <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>

                <label className="wa-status-field">
                    <span>소유자명(계약자명)</span>
                    <input type="text" name="ownerName" value={searchFilters.ownerName} onChange={handleFilterChange} placeholder="입력" />
                </label>

                <label className="wa-status-field">
                    <span>차량/차대번호</span>
                    <input type="text" name="carKeyword" value={searchFilters.carKeyword} onChange={handleFilterChange} placeholder="번호 입력" />
                </label>

                <label className="wa-status-field">
                    <span>주문번호</span>
                    <input type="text" name="orderNo" value={searchFilters.orderNo} onChange={handleFilterChange} placeholder="주문번호 입력" />
                </label>
            </section>

			<section ref={gridPanelRef} className="wa-status-grid-panel" aria-label="신규신청현황 목록" style={gridPanelHeight ? { height: `${gridPanelHeight}px`, maxHeight: 'none' } : undefined}>
                <section className="wa-status-heading">
					<div className="wa-status-actions" aria-label="목록 처리 버튼">
					    {gridActionButtons
					        .filter(button => button.roles.includes(memberGb))
					        .map(({ key, label, Icon, variant }) => (
					            <button
					                key={key}
					                type="button"
					                className={`wa-status-action ${variant}`}
					                onClick={() => handleGridActionClick(key)}
					                disabled={loading}
					            >
					                <Icon size={15} />
					                <span>{label}</span>
					            </button>
					        ))}
					</div>

                    <div className="wa-status-actions" aria-label="목록 부가 기능">
                        <strong>검색 결과 총 {rows.length}건</strong>
                        {canManageNewcarActions && (
                            <>
                                <button type="button" className="wa-status-action primary" onClick={handleExcelClick} disabled={loading}>
                                    <Upload size={15} />
                                    <span>엑셀 업로드</span>
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept=".xlsx,.xls"
                                    onChange={handleExcelUpload}
                                />
                            </>
                        )}
                    </div>
                </section>

                {errorMessage && <div className="wa-status-error">{errorMessage}</div>}
                {noticeMessage && <div className="wa-status-notice">{noticeMessage}</div>}

                {isMobileView && (
                    <>
                        <div className="wa-mobile-newcar-list">
                            {loading ? (
                                <div className="wa-mobile-list-empty">조회 중입니다.</div>
                            ) : sortedRows.length === 0 ? (
                                <div className="wa-mobile-list-empty">조회된 데이터가 없습니다.</div>
                            ) : sortedRows.map(row => {
                                const directRegistration = isDirectRegistrationRow(row);

                                return (
                                    <article key={row.rowKey} className={`wa-mobile-newcar-card${selectedRowKeySet.has(row.rowKey) ? ' selected' : ''}`}>
                                        <header>
                                            <label className="wa-mobile-card-checkbox">
                                                <input
                                                    type="checkbox"
                                                    aria-label={`${row.displayValues.LINK_ID || row.rowKey} 선택`}
                                                    checked={selectedRowKeySet.has(row.rowKey)}
                                                    onChange={event => toggleRow(row.rowKey, event.target.checked)}
                                                />
                                            </label>
                                            <span className={`wa-grid-status ${getStatusClass(row.displayValues.PROC_ST, row.processStatusCode)}`}>
                                                {row.displayValues.PROC_ST || '-'}
                                            </span>
                                            <time>{row.displayValues.REGIST_DATE || '등록예정일 미정'}</time>
                                        </header>

                                        <button type="button" className="wa-mobile-card-open" onClick={() => handleRowDoubleClick(row)} disabled={directRegistration}>
                                            <span className="wa-mobile-card-field primary">
                                                <small>주문번호</small>
                                                <strong>{row.displayValues.LINK_ID || '-'}</strong>
                                            </span>
                                            <span className="wa-mobile-card-field">
                                                <small>담당SP명</small>
                                                <strong>{row.displayValues.MEMBER_ID || '-'}</strong>
                                            </span>
                                            <span className="wa-mobile-card-field">
                                                <small>소유자명</small>
                                                <strong>{row.displayValues.OWNER_NM || '-'}</strong>
                                            </span>
                                            <span className="wa-mobile-card-field">
                                                <small>SPACE</small>
                                                <strong>{row.displayValues.SPACE || '-'}</strong>
                                            </span>
                                            <span className="wa-mobile-card-field">
                                                <small>계약자명</small>
                                                <strong>{row.displayValues.CUSTOMER_NM || '-'}</strong>
                                            </span>
                                            <span className="wa-mobile-card-field">
                                                <small>공급가액</small>
                                                <strong>{row.displayValues.BUY_AMT || '-'}</strong>
                                            </span>
                                            <span className="wa-mobile-card-field wide">
                                                <small>차명</small>
                                                <strong>{row.displayValues.CAR_NM  || '-'}</strong>
                                            </span>
                                            <span className="wa-mobile-card-field wide">
                                                <small>차대번호</small>
                                                <strong>{row.displayValues.CARID_NO || '-'}</strong>
                                            </span>

                                            {!directRegistration && <ChevronRight size={20} aria-hidden="true" />}
                                        </button>
                                    </article>
                                );
                            })}
                        </div>
                    </>
                )}

                {!isMobileView && <div className="wa-status-table-scroll">
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
										<th key={column.key}  className={getColumnClassName(column)} style={getStickyColumnStyle(column)} aria-sort={column.sortable === false ? undefined : ariaSort}>
                                            {column.type === 'checkbox' ? (
                                                <input type="checkbox" aria-label="전체 선택" checked={allRowsSelected} onChange={event => toggleAllRows(event.target.checked)} />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={`wa-status-sort-button${sortClassName}`}
                                                    onClick={() => handleSortColumn(column)}
                                                >
                                                    <span>{column.label}</span>
                                                </button>
                                            )}
                                            <span
                                                className="wa-status-column-resizer"
                                                role="separator"
                                                aria-orientation="vertical"
                                                aria-label={`${column.label || '선택'} 컬럼 폭 조절`}
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
                                    <td className="wa-status-empty" colSpan={columns.length} >조회된 데이터가 없습니다.</td>
                                </tr>
                            ) : sortedRows.map((row, rowIndex) => (
                                <tr key={row.rowKey} className="wa-status-data-row"
									onClick={() => handleRowClick(row)}
									/*onDoubleClick={() => handleRowDoubleClick(row)} */
									tabIndex={0} onKeyDown={event => event.key === 'Enter' && handleRowDoubleClick(row)}>
                                    {columns.map(column => (
                                        <td key={`${row.rowKey}-${column.key}`} className={getGridCellClassName(row, column)} style={getStickyColumnStyle(column)}>
                                            {renderGridCell(row, column, rowIndex)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>}
            </section>
            </div>

            {selectedRows.length > 0 && (
                <aside className="wa-mobile-selection-bar" aria-label="선택 항목 작업">
                    <div className="wa-mobile-selection-summary">
                        <strong>{selectedRows.length}건 선택</strong>
                        <button type="button" onClick={() => setSelectedRowKeys([])} aria-label="선택 해제">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="wa-mobile-selection-actions">
                        {gridActionButtons
                            .filter(button => button.roles.includes(memberGb))
                            .map(({ key, label, Icon }) => (
                                <button key={key} type="button" className={`wa-mobile-selection-action ${key}`} onClick={() => handleGridActionClick(key)} disabled={loading}>
                                    <Icon size={17} />
                                    <span>{label}</span>
                                </button>
                            ))}
                    </div>
                </aside>
            )}

            {mobileFilterOpen && (
                <div className="wa-mobile-filter-backdrop" role="presentation" onMouseDown={() => setMobileFilterOpen(false)}>
                    <section className="wa-mobile-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="wa-mobile-filter-title" onMouseDown={event => event.stopPropagation()}>
                        <header>
                            <strong id="wa-mobile-filter-title">상세 검색</strong>
                            <button type="button" onClick={() => setMobileFilterOpen(false)} aria-label="상세 검색 닫기">
                                <X size={21} />
                            </button>
                        </header>

                        <div className="wa-mobile-filter-fields">
                            {!isSpaceFixed && (
                                <label>
                                    <span>SPACE 구분</span>
                                    <select name="spaceType" value={activeMobileFilters.spaceType} onChange={handleMobileFilterChange}>
                                        {spaceOptions.map(option => (
                                            <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <label>
                                <span>번호판 배송상태</span>
                                <select name="plateDeliveryStatus" value={activeMobileFilters.plateDeliveryStatus} onChange={handleMobileFilterChange}>
                                    {plateDeliveryOptions.map(option => (
                                        <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span>차량/차대번호</span>
                                <input type="text" name="carKeyword" value={activeMobileFilters.carKeyword} onChange={handleMobileFilterChange} placeholder="차량번호 또는 차대번호 입력" autoComplete="off" />
                            </label>
                        </div>

                        <footer>
                            <button type="button" className="outline" onClick={clearMobileFilters}>초기화</button>
                            <button type="button" className="primary" onClick={applyMobileFilters} disabled={loading}>필터 적용</button>
                        </footer>
                    </section>
                </div>
            )}

            {showRequestConfirm && (
                <div className="wa-request-modal-backdrop" role="presentation">
                    <section className="wa-action-confirm-frame" role="dialog" aria-modal="true" aria-label="신규등록 신청 확인">
                        <header className="wa-action-confirm-header">
                            <strong>신규등록 신청</strong>
                            <button
                                type="button"
                                className="wa-request-modal-close"
                                onClick={() => {
                                    setShowRequestConfirm(false);
                                    setRequestRows([]);
                                }}
                                aria-label="닫기"
                                disabled={loading}
                            >
                                <X size={18} />
                            </button>
                        </header>
                        <div className="wa-action-confirm-content">
                            {requestRows.length}건 차량을 신규등록 신청하시겠습니까?
                        </div>
                        <footer className="wa-action-confirm-footer">
                            <button
                                type="button"
                                className="wa-status-action outline"
                                onClick={() => {
                                    setShowRequestConfirm(false);
                                    setRequestRows([]);
                                }}
                                disabled={loading}
                            >
                                취소
                            </button>
                            <button type="button" className="wa-status-action primary" onClick={handleRequestConfirm} disabled={loading}>
                                신청
                            </button>
                        </footer>
                    </section>
                </div>
            )}
            {excelPasswordOpen && (
                <div className="wa-request-modal-backdrop" role="presentation" onMouseDown={closeExcelPasswordModal}>
                    <section
                        className="wa-action-confirm-frame"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="wa-excel-password-title"
                        onMouseDown={event => event.stopPropagation()}
                    >
                        <header className="wa-action-confirm-header">
                            <strong id="wa-excel-password-title">엑셀 다운로드 비밀번호 확인</strong>
                            <button
                                type="button"
                                className="wa-request-modal-close"
                                onClick={closeExcelPasswordModal}
                                aria-label="닫기"
                                disabled={excelPasswordChecking}
                            >
                                <X size={18} />
                            </button>
                        </header>
                        <form onSubmit={handleExcelPasswordSubmit}>
                            <div className="wa-action-confirm-content wa-excel-password-content">
                                <label htmlFor="wa-excel-password">현재 로그인 비밀번호</label>
                                <input
                                    id="wa-excel-password"
                                    type="password"
                                    value={excelPassword}
                                    onChange={event => {
                                        setExcelPassword(event.target.value);
                                        setExcelPasswordError('');
                                    }}
                                    autoComplete="current-password"
                                    autoFocus
                                    disabled={excelPasswordChecking}
                                />
                                {excelPasswordError && <p>{excelPasswordError}</p>}
                            </div>
                            <footer className="wa-action-confirm-footer">
                                <button type="button" className="wa-status-action outline" onClick={closeExcelPasswordModal} disabled={excelPasswordChecking}>
                                    취소
                                </button>
                                <button type="submit" className="wa-status-action primary" disabled={excelPasswordChecking}>
                                    {excelPasswordChecking ? '확인 중...' : '확인 및 다운로드'}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}
			{excelUploadModalOpen && (

			    <div
			        className="wa-request-modal-backdrop"
			        role="presentation"
			        onMouseDown={() => setExcelUploadModalOpen(false)}
			    >
			        <section
			            className="wa-action-confirm-frame"
			            role="dialog"
			            aria-modal="true"
			            aria-labelledby="wa-excel-upload-title"
			            onMouseDown={event => event.stopPropagation()}
			        >

			            <header className="wa-action-confirm-header">

			                <strong id="wa-excel-upload-title">
			                    엑셀 업로드
			                </strong>

			                <button
			                    type="button"
			                    className="wa-request-modal-close"
			                    onClick={() => setExcelUploadModalOpen(false)}
			                    aria-label="닫기"
			                >
			                    <X size={18} />
			                </button>

			            </header>

			            <div className="wa-action-confirm-content">
			                엑셀 양식을 다운로드하거나 작성한 엑셀 파일을 업로드해주세요.
			            </div>

			            <footer className="wa-action-confirm-footer">

			                <button
			                    type="button"
			                    className="wa-status-action outline"
			                    onClick={handleExcelTemplateDownload}
			                >
			                    <Download size={15} />
			                    <span>양식 다운로드</span>
			                </button>

			                <button
			                    type="button"
			                    className="wa-status-action primary"
			                    onClick={handleExcelUploadClick}
			                >
			                    <Upload size={15} />
			                    <span>엑셀 업로드</span>
			                </button>

			            </footer>

			        </section>

			    </div>

			)}
            {activeRequest && (

				<div className={`wa-request-modal-backdrop ${isOverflow ? 'overflow' : ''}`}>
					<section ref={frameRef}
					    className="wa-request-modal-frame" role="dialog" aria-modal="true" aria-label="신규등록 상세"
						>
                        <header className="wa-request-modal-header">
                            <div>
                                <span>신규등록</span>
                                <strong>{activeRequest.title}</strong>
                            </div>
                            <button type="button" className="wa-request-modal-close" onClick={handleCloseRequestFrame} aria-label="닫기">
                                <X size={18} />
                            </button>
                        </header>
                        <div className="wa-request-modal-body">
                            <WaNewcarRequest
                                embedded
                                initialServiceId={activeRequest.serviceId}
								stepMemory={stepMemoryRef.current}
                                onClose={handleCloseRequestFrame}
                            />
                        </div>
                    </section>
                </div>
            )}
			{showSuChangeModal && (
			<div className="wa-request-modal-backdrop">
			    <section className="wa-action-confirm-frame">
			        <header className="wa-action-confirm-header">
			            <strong>담당자 변경</strong>
			        </header>
			        <div className="wa-action-confirm-content">
			            <table style={{width:"100%"}}>
		                <tbody>
							<tr>
								<td style={{width:70}}>기존</td>
								<td>{currentSuText}</td>
							</tr>
			                <tr>
			                    <td>변경</td>
			                    <td>
									<select
									    className="wa-su-change-select"
									    value={changeUser?.LOGIN_ID || ""}
									    onChange={(e) => {
											if (!e.target.value) {
									            setChangeUser(null);
									            return;
									        }
											
									        const user = userList.find(
									            u => u.LOGIN_ID === e.target.value
									        );
									        setChangeUser(user || null);
									    }}
									>
									    <option value="">선택</option>
	
										{[...userList]
											.filter(user =>
											    !selectedRows.some(row => row.MEMBER_ID === user.MEMBER_NM)
											)
										    .sort((a, b) => a.MEMBER_NM.localeCompare(b.MEMBER_NM, 'ko'))
										    .map(user => (
										        <option
										            key={user.LOGIN_ID}
										            value={user.LOGIN_ID}
										        >
										            {user.MEMBER_NM}
										        </option>
										    ))
										}
									</select>
			                    </td>
			                </tr>
			                </tbody>
			            </table>
			        </div>
			        <footer className="wa-action-confirm-footer">
			            <button
			                className="wa-status-action outline"
							onClick={() => {
					            setShowSuChangeModal(false);
					            setChangeUser(null);
					        }}
			            >
			                닫기
			            </button>
			            <button
			                className="wa-status-action primary"
			                onClick={handleSuChangeConfirm}
			            >
			                확인
			            </button>
			        </footer>

			    </section>
			</div>
			)}
			

			{templateDownloading && (
			    <div
			        style={{
			            position: 'fixed',
			            top: 0,
			            left: 0,
			            width: '100vw',
			            height: '100vh',
			            backgroundColor: 'rgba(0, 0, 0, 0.6)',
			            zIndex: 999999,
			            display: 'flex',
			            alignItems: 'center',
			            justifyContent: 'center'
			        }}
			    >
			        <div
			            style={{
			                color: '#fff',
			                fontSize: '24px',
			                fontWeight: 'bold'
			            }}
			        >
			            로딩 중...
			        </div>
			    </div>
			)}
			
        </div>
    );
};

export default WaNewcarList;
