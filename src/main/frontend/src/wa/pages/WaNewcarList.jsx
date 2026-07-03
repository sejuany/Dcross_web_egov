import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ClipboardCheck, RotateCcw, Search, Upload, WalletCards, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import WaNewcarRequest from './newcar/WaNewcarRequest';
import '../styles/wa.css';

const dateTypeFallbackOptions = [
    { CODE_ID: 'REQDT', CODE_NM: '신청일자' },
    { CODE_ID: 'JDGDT', CODE_NM: '등록일자' },
    { CODE_ID: 'REGDT', CODE_NM: '등록예정일자' },
];

const registrationTypeFallbackOptions = [
    { CODE_ID: 'B', CODE_NM: '대행등록' },
    { CODE_ID: 'A', CODE_NM: '직접등록' }
];

const processStatusFallbackOptions = [];


const plateDeliveryOptions = [
    { value: '', label: '전체' },
    { value: 'BEFORE', label: '배송 전' },
    { value: 'ING', label: '배송 중' },
    { value: 'DONE', label: '배송 완료' },
    { value: 'NONE', label: '미배송' }
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
    { key: 'reset', label: '초기화', Icon: RotateCcw, variant: 'outline' },
    { key: 'close', label: '닫기', Icon: X, variant: 'outline' }
];

const gridActionButtons = [
    { key: 'apply', label: '신청', Icon: ClipboardCheck, variant: 'outline' },
    { key: 'payment', label: '차량대금 납부', Icon: WalletCards, variant: 'outline' }
];

const DEFAULT_MIN_COLUMN_WIDTH = 56;

const columns = [
    { key: 'CHK', label: '', type: 'checkbox', width: 44, minWidth: 40, sortable: false },
    { key: 'SEQ', label: '순번', width: 42, minWidth: 20, sortType: 'number' },
    { key: 'REGIST_DATE', label: '등록예정일자', width: 116, minWidth: 50, sortType: 'date' },
    { key: 'PROC_ST', label: '처리상태', type: 'processStatus', width: 92, minWidth: 60 },
    { key: 'LINK_ID', label: '주문번호', width: 82, minWidth: 60 },
    { key: 'CARID_NO', label: '차대번호', width: 150, minWidth: 60 },
    { key: 'CAR_NO', label: '차량번호', width: 96, minWidth: 60 },
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
    { key: 'INSTALL_DT', label: '배송일자', width: 90, minWidth: 60, sortType: 'date' },
    { key: 'SPACE', label: 'SPACE', width: 116, minWidth: 60 },
    { key: 'DELIVERY_ADDR', label: '배송 주소', width: 230, minWidth: 60, className: 'wide-text' },
    { key: 'INS_USER', label: '담당SP명', width: 112, minWidth: 60 },
    { key: 'GOVT_TX', label: '비고', type: 'remark', width: 190, minWidth: 60, className: 'wide-text' }
];

const getFormattedDateOffset = (offsetDays) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const getInitialSearchFilters = () => ({
    dateType: dateTypeFallbackOptions[0].CODE_ID,
    startDate: getFormattedDateOffset(0),
    endDate: getFormattedDateOffset(7),
    processStatus: '',
    plateDeliveryStatus: '',
    spaceType: '',
    registrationType: '',
    carKeyword: '',
    orderNo: '',
    ownerName: ''
});

const getUserCompanyId = (user) => String(
    user?.COMPANY_ID ??
    user?.company_ID ??
    user?.companyId ??
    user?.company_id ??
    ''
).trim();

const toYmd = (value) => String(value || '').replace(/-/g, '');

const toStringValue = (value) => String(value ?? '').trim();

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
    const text = `${statusLabel || ''} ${statusCode || ''}`;

    if (/반려|RET|REJECT/.test(text)) return 'reject';
    if (/완료|END|DONE/.test(text)) return 'done';
    if (/중|REQ|ING/.test(text)) return 'progress';
    return 'ready';
};

const isRejectRow = (row) => /반려|RET|REJECT/.test(`${row.processStatus} ${row.PROC_ST}`);

const isStatusIn = (row, statusCodes) => statusCodes.includes(toStringValue(row.PROC_ST));

const createStatusCards = (rows) => [
    { label: '정보입력', value: rows.filter(row => isStatusIn(row, ['SAV', 'INFO'])).length },
    { label: '신청대기', value: rows.filter(row => isStatusIn(row, ['C_REQ', 'REQ'])).length },
    { label: '인도금 납부중', value: rows.filter(row => isStatusIn(row, ['P_REQ', 'B_REQ', 'PAYING'])).length, active: true },
    { label: '인도금 납부완료', value: rows.filter(row => isStatusIn(row, ['P_END', 'PBEND', 'PAID'])).length },
    { label: '등록 중', value: rows.filter(row => isStatusIn(row, ['J_REQ', 'J_ING', 'D_REQ', 'D_ING', 'REG_ING'])).length },
    { label: '등록 완료', value: rows.filter(row => isStatusIn(row, ['J_END', 'D_END', 'END', 'REG_DONE'])).length },
    { label: '반려', value: rows.filter(isRejectRow).length, danger: true },
    { label: '고객 직접 납부', value: rows.filter(row => toStringValue(row.PAY_GB) === 'A').length, muted: true }
];

const WaNewcarList = () => {
    const { user, logout } = useAuth();
    const [codeListMap, setCodeListMap] = useState({});
    const [branchList, setBranchList] = useState([]);
    const [rawRows, setRawRows] = useState([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [searchFilters, setSearchFilters] = useState(getInitialSearchFilters);
    const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
    const [columnWidths, setColumnWidths] = useState({});
    const [activeRequest, setActiveRequest] = useState(null);

    const codeMap = useMemo(() => buildCodeMap(codeListMap), [codeListMap]);

    const formatCode = useCallback((groupId, value) => {
        const codeValue = toStringValue(value);
        return codeMap[groupId]?.[codeValue] || codeValue;
    }, [codeMap]);

    const dateTypeOptions = useMemo(
        () => getCodeOptions(codeListMap.NEWDT, dateTypeFallbackOptions),
        [codeListMap.NEWDT]
    );

    const registrationTypeOptions = useMemo(
        () => toSelectOptions(codeListMap.PSNGB, registrationTypeFallbackOptions),
        [codeListMap.PSNGB]
    );

    const processStatusOptions = useMemo(
        () => toSelectOptions(codeListMap.PR_ST, processStatusFallbackOptions),
        [codeListMap.PR_ST]
    );

    const spaceOptions = useMemo(() => {
        const branchOptions = branchList.map(branch => ({
            value: branch.BRANCH_ID,
            label: branch.BRANCH_NM
        }));

        return [
            { value: '', label: '전체' },
            ...(branchOptions.length > 0 ? branchOptions : spaceFallbackOptions)
        ];
    }, [branchList]);

    const rows = useMemo(() => rawRows.map((row, index) => {
        const processStatus = formatCode('PR_ST', row.PROC_ST);
        const paymentStatus = formatCode('PAYST', row.PAY_ST);
        const rowKey = toStringValue(row.SERVICE_ID) || `${row.LINK_ID || 'row'}-${index}`;
        const displayValues = {
            SEQ: row.SEQ || index + 1,
            REGIST_DATE: row.REGIST_DATE || '',
            PROC_ST: processStatus,
            LINK_ID: row.LINK_ID || '',
            CARID_NO: row.CARID_NO || '',
            CAR_NO: row.CAR_NO || '',
            OWNER_NM: row.OWNER_NM || '',
            BUY_AMT: formatAmount(row.BUY_AMT),
            ATTACH_YN: formatYn(row.ATTACH_YN),
            CARD_YN: formatYn(row.CARD_YN),
            NTAX_YN: formatYn(row.NTAX_YN),
            PAY_ST: paymentStatus,
            BPAY_DT: row.BPAY_DT || '',
            PAY_DT: row.PAY_DT || '',
            INS_DATE: row.INS_DATE || '',
            JUDGE_DT: row.JUDGE_DT || '',
            INSTALL_DT: row.INSTALL_DT || '',
            SPACE: row.SPACE || '',
            DELIVERY_ADDR: row.DELIVERY_ADDR || '',
            INS_USER: row.INS_USER || '',
            GOVT_TX: row.GOVT_TX || ''
        };

        return {
            ...row,
            rowKey,
            displayValues,
            processStatusCode: row.PROC_ST,
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
            deliveryDate: displayValues.INSTALL_DT,
            space: displayValues.SPACE,
            address: displayValues.DELIVERY_ADDR,
            sp: displayValues.INS_USER,
            remark: displayValues.GOVT_TX
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

    const buildSearchPayload = useCallback((filters) => ({
        WORK_CD: '010',
        DATE_CD: filters.dateType,
        START_DT: toYmd(filters.startDate),
        END_DT: toYmd(filters.endDate),
        CAR_NO: filters.carKeyword.trim(),
        LINK_ID: filters.orderNo.trim(),
        CUSTOMER_NM: filters.ownerName.trim(),
        PAY_GB: filters.registrationType,
        PROC_ST: filters.processStatus,
        NUM_PROC_ST: filters.plateDeliveryStatus,
        SPACE_TYPE: filters.spaceType
    }), []);

    const fetchNewCarList = useCallback(async (filters) => {
        setLoading(true);
        setErrorMessage('');

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
                    axios.post('/api/codes/list', { groupIds: ['NEWDT', 'PSNGB', 'PR_ST', 'PAYST'] }),
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

        fetchInitialData();
        fetchNewCarList(searchFilters);

        return () => {
            isMounted = false;
        };
        // 최초 진입 시 현재 기본 조회조건으로 한 번만 조회한다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchNewCarList, user]);

    useEffect(() => {
        const hasSelectedDateType = dateTypeOptions.some(option => option.CODE_ID === searchFilters.dateType);

        if (!hasSelectedDateType && dateTypeOptions.length > 0) {
            setSearchFilters(prev => ({
                ...prev,
                dateType: dateTypeOptions[0].CODE_ID
            }));
        }
    }, [dateTypeOptions, searchFilters.dateType]);

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setSearchFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleDateQuickRange = (startOffset) => {
        setSearchFilters(prev => ({
            ...prev,
            startDate: getFormattedDateOffset(startOffset),
            endDate: getFormattedDateOffset(0)
        }));
    };

    const handleReset = () => {
        const nextFilters = getInitialSearchFilters();
        setSearchFilters(nextFilters);
        fetchNewCarList(nextFilters);
    };

    const handleHeaderActionClick = (actionKey) => {
        if (actionKey === 'search') {
            fetchNewCarList(searchFilters);
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

    const handleCloseRequestFrame = useCallback(() => {
        setActiveRequest(null);
    }, []);



    const handleRequestSaved = useCallback(() => {
        fetchNewCarList(searchFilters);
    }, [fetchNewCarList, searchFilters]);

    useEffect(() => {
        if (!activeRequest) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setActiveRequest(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeRequest]);

    const getColumnWidth = useCallback((column) => (
        columnWidths[column.key] ?? column.width ?? column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH
    ), [columnWidths]);

    const handleSortColumn = useCallback((column) => {
        if (column.sortable === false) return;

        setSortConfig(prev => ({
            key: column.key,
            direction: prev.key === column.key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
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


    const renderGridCell = (row, column) => {
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

        if (column.type === 'processStatus') {
            return <span className={`wa-grid-status ${getStatusClass(row.displayValues.PROC_ST, row.processStatusCode)}`}>{row.displayValues.PROC_ST}</span>;
        }

        if (column.type === 'remark') {
            return <span className={isRejectRow(row) ? 'wa-grid-danger' : ''}>{row.displayValues.GOVT_TX}</span>;
        }

        return row.displayValues[column.key] ?? '';
    };
    return (
        <div className={`wa-status-page${activeRequest ? ' has-modal' : ''}`}>
            <div className="wa-status-page-content" aria-hidden={activeRequest ? 'true' : undefined}>
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

                <div className="wa-status-actions" aria-label="신규신청현황 기능 버튼">
                    {headerActionButtons.map(({ key, label, Icon, variant }) => (
                        <button key={key} type="button" className={`wa-status-action ${variant}`} onClick={() => handleHeaderActionClick(key)} disabled={loading && key === 'search'}>
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
                    <select name="spaceType" value={searchFilters.spaceType} onChange={handleFilterChange}>
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
                    <span>등록구분</span>
                    <select name="registrationType" value={searchFilters.registrationType} onChange={handleFilterChange}>
                        {registrationTypeOptions.map(option => (
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

            <section className="wa-status-grid-panel" aria-label="신규신청현황 목록">
                <section className="wa-status-heading">
                    <div className="wa-status-actions" aria-label="목록 처리 버튼">
                        {gridActionButtons.map(({ key, label, Icon, variant }) => (
                            <button key={key} type="button" className={`wa-status-action ${variant}`}>
                                <Icon size={15} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="wa-status-actions" aria-label="목록 부가 기능">
                        <strong>검색 결과 총 {rows.length}건</strong>
                        <button type="button" className="wa-status-action primary">
                            <Upload size={15} />
                            <span>엑셀 업로드</span>
                        </button>
                    </div>
                </section>

                {errorMessage && <div className="wa-status-error">{errorMessage}</div>}

                <div className="wa-status-table-scroll">
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
                                        <th key={column.key} aria-sort={column.sortable === false ? undefined : ariaSort}>
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
                                    <td className="wa-status-empty" colSpan={columns.length}>조회된 데이터가 없습니다.</td>
                                </tr>
                            ) : sortedRows.map(row => (
                                <tr key={row.rowKey} className="wa-status-data-row" onDoubleClick={() => handleRowDoubleClick(row)} tabIndex={0} onKeyDown={event => event.key === 'Enter' && handleRowDoubleClick(row)}>
                                    {columns.map(column => (
                                        <td key={`${row.rowKey}-${column.key}`} className={column.className || undefined}>
                                            {renderGridCell(row, column)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            </div>

            {activeRequest && (
                <div className="wa-request-modal-backdrop" role="presentation">
                    <section className="wa-request-modal-frame" role="dialog" aria-modal="true" aria-label="신규등록 상세">
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
                                onClose={handleCloseRequestFrame}
                                onSaved={handleRequestSaved}
                            />
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default WaNewcarList;