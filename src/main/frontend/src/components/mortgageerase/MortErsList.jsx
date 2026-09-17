import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './MortErsList.css';
import { useAuth } from '../../context/AuthContext';
import { useTabs, useTabPageState } from '../../context/TabContext';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import { exportAgGridToXlsx, exportRowsToXlsx } from '../../utils/xlsxExport';

ModuleRegistry.registerModules([AllCommunityModule]);

const getFormattedDateOffset = (offsetDays) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getUserValue = (user, ...keys) => {
    for (const key of keys) {
        if (user?.[key] !== undefined && user?.[key] !== null) return String(user[key]);
    }
    return '';
};

const getInitialSearchFilters = (user, reset = false) => {
    const memberGb = getUserValue(user, 'member_GB', 'MEMBER_GB').toUpperCase();
    const companyId = getUserValue(user, 'company_ID', 'COMPANY_ID');
    const companyIdKey = companyId.toUpperCase();
    const isStaff = memberGb.startsWith('U');
    const isGovt = memberGb === 'GU';
    const showAuto = memberGb !== 'UU' && (isStaff || (isGovt && ['HAMYA', 'HAMAN'].includes(companyIdKey)));

    return {
        companyID: (isStaff || isGovt) ? '' : companyId,
        govtId: isGovt ? companyId : '',
        payerName: '',
        carNo: '',
        startDate: getFormattedDateOffset(isGovt || (reset && memberGb === 'UA') ? -30 : -7),
        endDate: getFormattedDateOffset(0),
        processStatus: isGovt ? 'S_REQ' : '',
        payStatus: '',
        autoYn: showAuto && memberGb !== 'UA' ? 'N' : '',
        readYn: isGovt ? 'Y' : ''
    };
};

const maskName = (value) => {
    const text = String(value || '').trim();
    if (text.length <= 1) return text;
    if (text.length === 2) return `${text[0]}*`;
    return `${text[0]}${'*'.repeat(text.length - 2)}${text[text.length - 1]}`;
};

const formatAmount = value => Number(value || 0).toLocaleString();

export const MortErsReceiptViewer = ({ rows, onClose }) => {
    const [page, setPage] = useState(0);
    const row = rows[page] || {};
    const move = direction => setPage(current => (current + direction + rows.length) % rows.length);

    useEffect(() => {
        const handleKey = event => {
            if (event.key === 'F9') { event.preventDefault(); onClose(); }
            if (event.key === 'F10') { event.preventDefault(); window.print(); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div className="mort-receipt-overlay">
            <div className="mort-receipt-viewer">
                <div className="mort-receipt-head no-print">
                    <div className="mort-receipt-page">
                        {rows.length > 1 && <button onClick={() => move(-1)}>◀</button>}
                        <strong>{page + 1}</strong> / {rows.length}건
                        {rows.length > 1 && <button onClick={() => move(1)}>▶</button>}
                    </div>
                    <div><button onClick={() => window.print()}>인쇄[F10]</button><button onClick={onClose}>닫기[F9]</button></div>
                </div>
                <div className="mort-receipt-paper">
                    <h2>통 합 납 부 영 수 증</h2>
                    <table>
                        <tbody>
                            <tr><th>접수번호</th><td>{row.SERVICE_ID}</td><th>차량번호</th><td>{row.CAR_NO}</td></tr>
                            <tr><th>은행명</th><td>{row.BANK_NM}</td><th>가상계좌</th><td>{row.VBANK_NO}</td></tr>
                            <tr><th>납부일시</th><td>{row.PAY_DT}</td><th>납부총액</th><td className="amount">{formatAmount(row.TOTAL_AMT)} 원</td></tr>
                            <tr><th>등록면허세액</th><td className="amount">{formatAmount(row.REGIS_AMT)} 원</td><th>전자납부번호</th><td>{row.REGIS_NO}</td></tr>
                            <tr><th>증지대</th><td className="amount">{formatAmount(row.STAMP_AMT)} 원</td><th>등록관청</th><td>{row.GOVT_NM}</td></tr>
                            <tr><th>등록수수료(VAT포함)</th><td className="amount">{formatAmount(row.FEE_AMT)} 원</td><th>납부방법</th><td>{row.PAY_ME}</td></tr>
                        </tbody>
                    </table>
                    <p>고객센터 1688-6112</p>
                    <p>{new Date().toLocaleDateString('ko-KR')}<br /><strong>주식회사 다코스</strong></p>
                </div>
            </div>
        </div>
    );
};

const MortErsReceiptSearch = ({ onClose, showToast }) => {
    const [file, setFile] = useState(null);
    const [startDate, setStartDate] = useState(getFormattedDateOffset(0));
    const [endDate, setEndDate] = useState(getFormattedDateOffset(0));
    const [dayGb, setDayGb] = useState('TS.REQUEST_DT');
    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [viewerRows, setViewerRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const downloadTemplate = () => exportRowsToXlsx({
        fileName: '영수증_양식.xlsx', sheetName: '차량번호',
        columns: [{ label: '차량번호', key: 'CAR_NO' }], rows: [{ CAR_NO: '' }]
    });
    const search = async () => {
        if (!file) { showToast('Excel 파일을 선택해 주세요.'); return; }
        const form = new FormData();
        form.append('file', file);
        form.append('startDate', startDate);
        form.append('endDate', endDate);
        form.append('dayGb', dayGb);
        setLoading(true);
        try {
            const response = await axios.post('/api/mortgageerase/receipt/search', form);
            const list = Array.isArray(response.data?.list) ? response.data.list : [];
            setRows(list);
            setSelected(new Set());
            if (list.length === 0) showToast('조회된 납부완료 영수증이 없습니다.');
        } catch (error) {
            showToast(error.response?.data?.message || '영수증 조회에 실패했습니다.');
        } finally { setLoading(false); }
    };
    const toggle = serviceId => setSelected(previous => {
        const next = new Set(previous);
        if (next.has(serviceId)) next.delete(serviceId); else next.add(serviceId);
        return next;
    });
    const openSelected = () => {
        const targets = rows.filter(row => selected.has(row.SERVICE_ID));
        if (targets.length === 0) { showToast('영수증을 선택해 주세요.'); return; }
        setViewerRows(targets);
    };

    return (
        <div className="mort-receipt-overlay">
            <div className="mort-receipt-search">
                <div className="mort-popup-title"><strong>영수증 다건조회</strong><button onClick={onClose}>×</button></div>
                <div className="mort-receipt-conditions">
                    <select value={dayGb} onChange={event => setDayGb(event.target.value)}>
                        <option value="TS.REQUEST_DT">요청일자</option><option value="TS.PROC_DT">처리일자</option><option value="TM.PAY_DT">입금일자</option>
                    </select>
                    <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
                    <span>~</span><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
                    <input type="file" accept=".xls,.xlsx" onChange={event => setFile(event.target.files?.[0] || null)} />
                    <button onClick={downloadTemplate}>양식받기</button><button onClick={search} disabled={loading}>업로드/조회</button>
                </div>
                <div className="mort-receipt-actions"><span>조회 {rows.length}건 / 선택 {selected.size}건</span><button onClick={openSelected}>선택보기</button></div>
                <div className="mort-receipt-grid">
                    <table><thead><tr>
                        <th><input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={event => setSelected(event.target.checked ? new Set(rows.map(row => row.SERVICE_ID)) : new Set())} /></th>
                        <th>접수번호</th><th>차량번호</th><th>처리상태</th><th>영수증</th><th>요청일자</th><th>처리일자</th><th>입금일자</th>
                    </tr></thead><tbody>{rows.map(row => <tr key={row.SERVICE_ID}>
                        <td><input type="checkbox" checked={selected.has(row.SERVICE_ID)} onChange={() => toggle(row.SERVICE_ID)} /></td>
                        <td>{row.SERVICE_ID}</td><td>{row.CAR_NO}</td><td>{row.PROC_ST}</td>
                        <td><button className="link-button" onClick={() => setViewerRows([row])}>보기</button></td>
                        <td>{row.REQUEST_DT}</td><td>{row.PROC_DT}</td><td>{row.PAY_DT}</td>
                    </tr>)}</tbody></table>
                </div>
                <div className="mort-popup-footer"><button onClick={onClose}>닫기[F9]</button></div>
            </div>
            {viewerRows.length > 0 && <MortErsReceiptViewer rows={viewerRows} onClose={() => setViewerRows([])} />}
        </div>
    );
};

const MortErsList = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const gridRef = useRef(null);
    const initialSearchDoneRef = useRef(false);
    const toastTimerRef = useRef(null);
    const { user } = useAuth();
    const { activeTabId, removeTab } = useTabs();

    const memberGb = getUserValue(user, 'member_GB', 'MEMBER_GB').toUpperCase();
    const userCompanyId = getUserValue(user, 'company_ID', 'COMPANY_ID');
    const userCompanyKey = userCompanyId.toUpperCase();
    const isStaff = memberGb.startsWith('U');
    const isGovt = memberGb === 'GU';
    const isUu = memberGb === 'UU';
    const showCompany = isStaff || isGovt;
    const showGovt = isStaff;
    const showAuto = !isUu && (isStaff || (isGovt && ['HAMYA', 'HAMAN'].includes(userCompanyKey)));
    const showManual = userCompanyKey === 'HAMYA' && !isUu && (isStaff || isGovt);
    const statusGroupId = isGovt
        ? 'JG_ST'
        : ['UA', 'UC', 'UU', 'NA'].includes(memberGb) ? 'PR_ST' : 'ERSST';

    const [searchFilters, setSearchFilters] = useTabPageState(
        'mortErsListSearchFilters',
        () => getInitialSearchFilters(user)
    );
    const [codeMap, setCodeMap] = useState({});
    const [codeListMap, setCodeListMap] = useState({});
    const [companyList, setCompanyList] = useState([]);
    const [toastMessage, setToastMessage] = useState('');
    const [rowData, setRowData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [receiptSearchOpen, setReceiptSearchOpen] = useState(false);

    const showToast = useCallback((message) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMessage(message);
        toastTimerRef.current = setTimeout(() => setToastMessage(''), 2500);
    }, []);

    useEffect(() => () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }, []);

    const formatCode = useCallback((groupId, value) => (
        codeMap[groupId]?.[value] || value || ''
    ), [codeMap]);

    const buildRequest = useCallback((filters) => ({
        WORK_CD: '001',
        COMPANY_ID: showCompany ? (filters.companyID || '') : userCompanyId,
        GOVT_ID: isGovt ? userCompanyId : (showGovt ? (filters.govtId || '') : ''),
        BRANCH_ID: '',
        SANGSA_ID: '',
        CAR_NO: filters.carNo.trim(),
        PAY_NM: filters.payerName.trim(),
        START_DT: filters.startDate.replace(/-/g, ''),
        END_DT: filters.endDate.replace(/-/g, ''),
        PROC_ST: isGovt ? '' : filters.processStatus,
        JUDGE_ST: isGovt ? filters.processStatus : '',
        PAY_ST: filters.payStatus,
        AUTO_YN: showAuto ? filters.autoYn : '',
        READ_YN: isGovt ? filters.readYn : '',
        ORDERBY: isGovt ? 'ASC' : ''
    }), [isGovt, showAuto, showCompany, showGovt, userCompanyId]);

    const fetchMortErsList = useCallback(async (filters = searchFilters) => {
        if (isUu && !filters.carNo.trim() && !filters.payerName.trim()) {
            showToast('조회 조건을 입력하셔야 합니다.');
            return false;
        }

        setLoading(true);
        try {
            const response = await axios.post('/api/mortgageerase/list', buildRequest(filters));
            const list = response.data?.success && Array.isArray(response.data.list)
                ? response.data.list
                : [];
            setRowData(list);
            return true;
        } catch (error) {
            console.error('말소신청현황 조회 실패:', error);
            showToast(error.response?.data?.message || '데이터 조회에 실패했습니다.');
            return false;
        } finally {
            setLoading(false);
        }
    }, [buildRequest, isUu, searchFilters, showToast]);

    useEffect(() => {
        const fetchCodes = async () => {
            const groupIds = ['SGB', 'CPRST', 'PR_ST', 'PAYST', 'PAYGB', 'JG_ST', 'GOVT', 'AUTO', 'PAYME', 'BANK', 'ERSST'];
            try {
                const responses = await Promise.all(groupIds.map(id => axios.get(`/api/codes/${id}`)));
                const nextCodeMap = {};
                const nextCodeListMap = {};
                responses.forEach((response, index) => {
                    const groupId = groupIds[index];
                    const codes = response.data?.success && Array.isArray(response.data.codes)
                        ? response.data.codes.filter(code => code.CODE_ID)
                        : [];
                    nextCodeListMap[groupId] = codes;
                    nextCodeMap[groupId] = Object.fromEntries(codes.map(code => [code.CODE_ID, code.CODE_NM]));
                });
                setCodeListMap(nextCodeListMap);
                setCodeMap(nextCodeMap);
            } catch (error) {
                console.error('공통 코드 조회 실패:', error);
                showToast('공통 코드를 불러오지 못했습니다.');
            }
        };
        fetchCodes();
    }, [showToast]);

    useEffect(() => {
        if (!showCompany) {
            setCompanyList([]);
            return;
        }

        const fetchCompanies = async () => {
            try {
                const response = await axios.get('/api/companies', {
                    params: {
                        workCd: '001',
                        ...(isGovt ? { govtId: userCompanyId } : {})
                    }
                });
                const list = response.data?.success && Array.isArray(response.data.list)
                    ? response.data.list
                    : [];
                const uniqueCompanies = Array.from(
                    new Map(list.map(company => [company.COMPANY_ID, company])).values()
                );
                setCompanyList(uniqueCompanies);
            } catch (error) {
                console.error('회사 목록 조회 실패:', error);
                showToast('회사 목록을 불러오지 못했습니다.');
            }
        };
        fetchCompanies();
    }, [isGovt, showCompany, showToast, userCompanyId]);

    useEffect(() => {
        if (!user || initialSearchDoneRef.current || isUu) return;
        initialSearchDoneRef.current = true;
        fetchMortErsList();
    }, [fetchMortErsList, isUu, user]);

    const processCellStyle = useCallback((params) => {
        const style = { justifyContent: 'center' };
        if (params.data?.EMER_YN === 'Y') style.backgroundColor = '#ff8f7d';
        if (params.value === 'END') style.color = '#0645d8';
        if (params.value === 'RET') style.color = '#d71920';
        if (params.value === 'C_REQ') style.color = '#e66a00';
        return style;
    }, []);

    const payCellStyle = useCallback((params) => ({
        justifyContent: 'center',
        color: params.value === 'N' ? '#d71920' : params.value === 'Y' ? '#0645d8' : undefined
    }), []);

    const columnDefs = useMemo(() => {
        const center = 'ag-center-aligned-cell';
        const processField = isGovt ? 'JUDGE_ST' : 'PROC_ST';
        const processGroup = isGovt ? 'JG_ST' : 'PR_ST';
        const serviceColumn = { headerName: '접수번호', field: 'SERVICE_ID', width: 145, cellClass: center };
        const carColumn = { headerName: '차량번호', field: 'CAR_NO', width: 115, cellClass: center };
        const commonStart = [
            serviceColumn,
            carColumn,
            { headerName: '채권가액', field: 'BOND_AMT', width: 100, cellClass: 'ag-right-aligned-cell', valueFormatter: p => Number(p.value || 0).toLocaleString() },
            { headerName: '납부자명', field: 'PAY_NM', width: 105, cellClass: center, valueFormatter: p => isUu ? maskName(p.value) : (p.value || '') },
            { headerName: '처리상태', field: processField, width: 95, cellStyle: processCellStyle, valueFormatter: p => formatCode(processGroup, p.value) }
        ];
        const payStatus = { headerName: '납부상태', field: 'PAY_ST', width: 85, cellStyle: payCellStyle, valueFormatter: p => formatCode('PAYST', p.value) };
        const requestDate = { headerName: '신청일자', field: 'REQUEST_DT', width: 95, cellClass: center };
        const requestTime = { headerName: '심사요청시간', field: 'REQUEST_DT2', width: 115, cellStyle: p => ({ justifyContent: 'center', backgroundColor: p.data?.EMER_YN === 'Y' ? '#ff8f7d' : undefined }) };
        const judgeDate = { headerName: '심사일자', field: 'JUDGE_DT', width: 95, cellClass: center };
        const company = { headerName: '회사명', field: 'COMPANY_NM', width: 170 };
        const member = { headerName: '신청자', field: 'MEMBER_NM', width: 95, cellClass: center };

        let columns;
        if (userCompanyKey === 'CC002') {
            columns = [
                { headerName: '순번', valueGetter: p => p.node.rowIndex + 1, width: 65, cellClass: center },
                ...commonStart,
                payStatus,
                requestDate,
                judgeDate,
                member
            ];
        } else if (isStaff || isGovt) {
            columns = [
                ...commonStart,
                { headerName: '관청', field: 'GOVT_ID2', width: 80, cellClass: center },
                ...(showAuto ? [{ headerName: '자동', field: 'AUTO_YN', width: 70, cellClass: center, valueFormatter: p => formatCode('AUTO', p.value) }] : []),
                payStatus,
                requestTime,
                judgeDate,
                company,
                member
            ];
        } else {
            columns = [...commonStart, payStatus, requestDate, judgeDate, member];
        }

        return columns;
    }, [formatCode, isGovt, isStaff, isUu, payCellStyle, processCellStyle, showAuto, userCompanyKey]);

    const handleResetClick = useCallback(() => {
        const nextFilters = getInitialSearchFilters(user, true);
        setSearchFilters(nextFilters);
        if (!isUu) fetchMortErsList(nextFilters);
    }, [fetchMortErsList, isUu, setSearchFilters, user]);

    const handleExportExcel = useCallback(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        const dateText = getFormattedDateOffset(0).replace(/-/g, '');

        if (userCompanyKey === 'CB008') {
            api.exportDataAsCsv({ fileName: `${dateText}_저당말소현황.csv` });
            return;
        }

        if (userCompanyKey === 'CB026') {
            const rows = [];
            api.forEachNodeAfterFilterAndSort(node => {
                if (node.data) rows.push(node.data);
            });
            if (rows.length === 0) {
                showToast('내보낼 데이터가 없습니다.');
                return;
            }
            exportRowsToXlsx({
                fileName: `${dateText}_저당말소현황.xlsx`,
                sheetName: '말소신청현황',
                columns: [
                    { label: '접수번호', key: 'SERVICE_ID' },
                    { label: '차량번호', key: 'CAR_NO' },
                    { label: '채권가액', key: 'BOND_AMT' },
                    { label: '납부자명', key: 'PAY_NM' },
                    { label: '처리상태', key: 'PROC_ST' },
                    { label: '납부상태', key: 'PAY_ST' },
                    { label: '신청일자', key: 'REQUEST_DT' },
                    { label: '심사일자', key: 'JUDGE_DT' },
                    { label: '신청자', key: 'MEMBER_NM' },
                    { label: '관청', key: 'GOVT_ID' },
                    { label: '차대번호', key: 'CARID_NO' },
                    { label: '을부번호', key: 'EULBU_NO' },
                    { label: '설정일자', key: 'MORTREG_DT' }
                ],
                rows,
                getCellValue: (row, column) => {
                    if (column.key === 'PROC_ST') return formatCode('PR_ST', row.PROC_ST);
                    if (column.key === 'PAY_ST') return formatCode('PAYST', row.PAY_ST);
                    return row[column.key] ?? '';
                }
            });
            return;
        }

        const exported = exportAgGridToXlsx(api, `${dateText}_저당말소현황.xlsx`, '말소신청현황');
        if (!exported) showToast('내보낼 데이터가 없습니다.');
    }, [formatCode, showToast, userCompanyKey]);

    const handleCloseClick = useCallback(() => {
        if (activeTabId) removeTab(activeTabId);
    }, [activeTabId, removeTab]);

    const handleRegisterClick = useCallback(() => {
        if (isGovt) return;
        navigate('/mortgageerase/mort-ers-request', {
            state: { receiptNo: '', autoLoad: ['UA', 'UU'].includes(memberGb) }
        });
    }, [isGovt, memberGb, navigate]);

    const handleManualClick = useCallback(async () => {
        const selectedRows = gridRef.current?.api?.getSelectedRows?.() || [];
        if (selectedRows.length === 0) {
            showToast('수동 변경할 항목을 선택해 주세요.');
            return;
        }
        if (!window.confirm('선택한 데이터를 수동으로 변경하시겠습니까?')) return;

        try {
            const response = await axios.post('/api/mortgageerase/manual', {
                serviceIds: selectedRows.map(row => row.SERVICE_ID)
            });
            showToast(`${response.data?.updatedCount || selectedRows.length}건을 수동으로 변경했습니다.`);
            fetchMortErsList();
        } catch (error) {
            console.error('수동 변경 실패:', error);
            showToast(error.response?.data?.message || '수동 변경에 실패했습니다.');
        }
    }, [fetchMortErsList, showToast]);

    const handleCellClicked = useCallback((event) => {
        if (!['SERVICE_ID', 'CAR_NO'].includes(event.colDef.field) || !event.value) return;
        navigator.clipboard.writeText(String(event.value))
            .then(() => showToast(`"${event.value}" 복사되었습니다.`))
            .catch(error => console.error('클립보드 복사 실패:', error));
    }, [showToast]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (location.pathname !== '/mortgageerase/mort-ers-list') return;
            if (event.key === 'F2') {
                event.preventDefault();
                fetchMortErsList();
            } else if (event.key === 'F7' && !isUu) {
                event.preventDefault();
                handleExportExcel();
            } else if (event.key === 'F8') {
                event.preventDefault();
                handleResetClick();
            } else if (event.key === 'F9') {
                event.preventDefault();
                handleCloseClick();
            } else if (event.key === 'F10' && !isGovt) {
                event.preventDefault();
                handleRegisterClick();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fetchMortErsList, handleCloseClick, handleExportExcel, handleRegisterClick, handleResetClick, isGovt, isUu, location.pathname]);

    const updateFilter = (key, value) => setSearchFilters(previous => ({ ...previous, [key]: value }));

    return (
        <div className="status-container mort-ers-list">
            {toastMessage && <div className="toast-notification">{toastMessage}</div>}

            <div className="status-toolbar">
                <div className="toolbar-left">
                    <span className="toolbar-title">말소신청현황</span>
                    <span className="title-count">{rowData.length}</span> 건
                </div>
                <div className="toolbar-right">
                    {isStaff && <button className="btn-status" onClick={() => setReceiptSearchOpen(true)}>영수증</button>}
                    {showManual && <button className="btn-status" onClick={handleManualClick}>수동</button>}
                    <button className="btn-status" onClick={() => fetchMortErsList()} disabled={loading}>조회[F2]</button>
                    {!isUu && <button className="btn-status" onClick={handleExportExcel}>엑셀[F7]</button>}
                    <button className="btn-status" onClick={handleResetClick}>초기화[F8]</button>
                    <button className="btn-status" onClick={handleCloseClick}>닫기[F9]</button>
                    <button className="btn-status" onClick={handleRegisterClick} disabled={isGovt}>등록[F10]</button>
                </div>
            </div>

            <ErpSection isHeader={true}>
                <div className="erp-row">
                    <ErpField label="신청구분" span={5}>
                        <select className="erp-input" value="001" disabled>
                            <option value="001">{formatCode('SGB', '001') || '저당말소'}</option>
                        </select>
                        {showCompany && (
                            <select className="erp-input" value={searchFilters.companyID} onChange={event => updateFilter('companyID', event.target.value)}>
                                <option value="">전체 (회사)</option>
                                {companyList.map(company => (
                                    <option key={company.COMPANY_ID} value={company.COMPANY_ID}>{company.COMPANY_NM}</option>
                                ))}
                            </select>
                        )}
                        {showGovt && (
                            <select className="erp-input" value={searchFilters.govtId} onChange={event => updateFilter('govtId', event.target.value)}>
                                <option value="">전체 (관청)</option>
                                {(codeListMap.GOVT || []).map(code => (
                                    <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                                ))}
                            </select>
                        )}
                    </ErpField>
                    <ErpField label="납부자명" span={2}>
                        <input className="erp-input" value={searchFilters.payerName} onChange={event => updateFilter('payerName', event.target.value)} />
                    </ErpField>
                    <ErpField label="차량번호" span={3}>
                        <input className="erp-input" value={searchFilters.carNo} onChange={event => updateFilter('carNo', event.target.value)} />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="신청일자" span={5}>
                        <input type="date" className="erp-input" value={searchFilters.startDate} onChange={event => updateFilter('startDate', event.target.value)} />
                        <span>~</span>
                        <input type="date" className="erp-input" value={searchFilters.endDate} onChange={event => updateFilter('endDate', event.target.value)} />
                    </ErpField>
                    <ErpField label="처리상태" span={2}>
                        <select className="erp-input" value={searchFilters.processStatus} onChange={event => updateFilter('processStatus', event.target.value)}>
                            <option value="">전체</option>
                            {(codeListMap[statusGroupId] || []).map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                    <ErpField label="납부상태" span={2}>
                        <select className="erp-input" value={searchFilters.payStatus} onChange={event => updateFilter('payStatus', event.target.value)}>
                            <option value="">전체</option>
                            {(codeListMap.PAYST || []).map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                    {showAuto && (
                        <ErpField label="자동처리" span={2}>
                            <select className="erp-input" value={searchFilters.autoYn} onChange={event => updateFilter('autoYn', event.target.value)}>
                                <option value="">전체</option>
                                {(codeListMap.AUTO || []).map(code => (
                                    <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                                ))}
                            </select>
                        </ErpField>
                    )}
                    {isGovt && (
                        <label className="mort-ers-unread">
                            <input
                                type="checkbox"
                                checked={searchFilters.readYn === 'Y'}
                                onChange={event => {
                                    const nextFilters = { ...searchFilters, readYn: event.target.checked ? 'Y' : '' };
                                    setSearchFilters(nextFilters);
                                    fetchMortErsList(nextFilters);
                                }}
                            />
                            미처리
                        </label>
                    )}
                </div>
            </ErpSection>

            <div className="grid-container ag-theme-alpine">
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={{ sortable: true, resizable: true, filter: true }}
                    rowSelection={{ mode: 'multiRow' }}
                    loading={loading}
                    getRowId={params => params.data.SERVICE_ID}
                    getRowStyle={params => params.data?.EMER_YN === 'Y' ? { backgroundColor: '#fff1ee' } : undefined}
                    onCellClicked={handleCellClicked}
                    onRowDoubleClicked={event => navigate('/mortgageerase/mort-ers-request', { state: { receiptNo: event.data.SERVICE_ID, autoLoad: true } })}
                />
            </div>
            {receiptSearchOpen && <MortErsReceiptSearch onClose={() => setReceiptSearchOpen(false)} showToast={showToast} />}
        </div>
    );
};

export default MortErsList;
