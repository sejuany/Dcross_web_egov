import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useTabs } from '../../context/TabContext';
import { exportRowsToXlsx } from '../../utils/xlsxExport';
import './MortErsList.css';
import './MortErsGroupRequest.css';

const ROUTE_PATH = '/mortgageerase/mort-ers-group-request';
const EXPORT_COLUMNS = [
    { label: '순번', key: 'NO' },
    { label: '선택', key: 'CHK' },
    { label: '차량번호', key: 'CAR_NO' },
    { label: '휴대폰번호', key: 'MPHONE_NO' },
    { label: '결제자명', key: 'PAY_NM' },
    { label: '채권가액', key: 'BOND_AMT', excelAlign: 'right' },
    { label: '수수료정산', key: 'PAY_TP' },
    { label: '처리상태', key: 'PROC_TX', excelAlign: 'left' },
    { label: '신청일자', key: 'REQUEST_DT' },
    { label: '신청자', key: 'MEMBER_NM' }
];

const valueOf = (object, ...keys) => {
    for (const key of keys) {
        if (object?.[key] !== undefined && object?.[key] !== null) return String(object[key]);
    }
    return '';
};

const cleanCarNo = value => String(value || '').replace(/\s/g, '');
const cleanAmount = value => String(value ?? '').replace(/[^0-9]/g, '');
const comparableAmount = value => cleanAmount(value).replace(/^0+(?=\d)/, '') || '0';
const errorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

function MortErsGroupRequest() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { activeTabId, removeTab } = useTabs();
    const fileInputRef = useRef(null);
    const toastTimerRef = useRef(null);
    const rowSequenceRef = useRef(0);

    const [initData, setInitData] = useState({ company: {}, workCp: {}, tax: {}, service: {} });
    const [rows, setRows] = useState([]);
    const [linked, setLinked] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [toast, setToast] = useState('');

    const notify = useCallback(message => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast(message);
        toastTimerRef.current = setTimeout(() => setToast(''), 3500);
    }, []);
    useEffect(() => () => toastTimerRef.current && clearTimeout(toastTimerRef.current), []);

    const createRow = useCallback((payType, values = {}) => ({
        _id: ++rowSequenceRef.current,
        CHK: true,
        NOT_CHK: false,
        CAR_NO: '',
        MPHONE_NO: '',
        PAY_NM: '',
        BOND_AMT: '',
        PAY_TP: payType || 'GUN',
        PROC_TX: '',
        REQUEST_DT: '',
        MEMBER_NM: '',
        VALID: false,
        CAR_INFO: {},
        ...values
    }), []);

    const initialize = useCallback(async () => {
        setBusy(true);
        setProgress('');
        try {
            const response = await axios.get('/api/mortgageerase/request/init');
            const data = response.data?.data || {};
            const payType = ['GUN', 'MON'].includes(data.workCp?.PAYMENT_TP)
                ? data.workCp.PAYMENT_TP : 'GUN';
            setInitData({
                company: data.company || {},
                workCp: data.workCp || {},
                tax: data.tax || {},
                service: data.service || {}
            });
            setRows([createRow(payType)]);
            setLinked(false);
            setCompleted(false);
        } catch (error) {
            notify(errorMessage(error, '다건말소 기본정보를 불러오지 못했습니다.'));
        } finally {
            setBusy(false);
        }
    }, [createRow, notify]);

    useEffect(() => {
        if (user && location.pathname === ROUTE_PATH) initialize();
    }, [initialize, location.pathname, user]);

    const amounts = useMemo(() => ({
        fee: Number(initData.workCp?.FEE || 0),
        registration: Number(initData.tax?.REGIST_AMT || 0),
        stamp: Number(initData.tax?.STAMP_AMT || 0)
    }), [initData]);
    const rowAmount = useCallback(row => amounts.registration + amounts.stamp
        + (row.PAY_TP === 'MON' ? 0 : amounts.fee), [amounts]);
    const selectedRows = useMemo(() => rows.filter(row => row.CHK && !row.NOT_CHK), [rows]);
    const totalAmount = useMemo(() => linked
        ? selectedRows.reduce((sum, row) => sum + rowAmount(row), 0) : 0,
    [linked, rowAmount, selectedRows]);

    const updateRow = (rowId, key, value) => {
        setRows(previous => previous.map(row => row._id === rowId
            ? { ...row, [key]: value, VALID: false, PROC_TX: key === 'CHK' ? row.PROC_TX : '' }
            : row));
    };
    const addRow = () => {
        if (rows.length >= 100) { notify('최대 100건까지 입력할 수 있습니다.'); return; }
        setRows(previous => [...previous, createRow(initData.workCp?.PAYMENT_TP)]);
    };
    const removeRow = rowId => setRows(previous => {
        const next = previous.filter(row => row._id !== rowId);
        return next.length ? next : [createRow(initData.workCp?.PAYMENT_TP)];
    });

    const downloadTemplate = () => exportRowsToXlsx({
        fileName: '다건말소양식.xlsx',
        sheetName: '다건말소',
        columns: [
            { label: '차량번호(필수)', key: 'CAR_NO' },
            { label: '휴대폰번호', key: 'MPHONE_NO' },
            { label: '결제자명', key: 'PAY_NM' },
            { label: '채권가액', key: 'BOND_AMT' },
            { label: '수수료 월납', key: 'MONTHLY' }
        ],
        rows: [
            { CAR_NO: '01가1234', MPHONE_NO: '010-1234-5678', PAY_NM: '홍길동', BOND_AMT: '', MONTHLY: 'Y' },
            { CAR_NO: '서울01가1234', MPHONE_NO: '', PAY_NM: '', BOND_AMT: '', MONTHLY: '' }
        ]
    });

    const uploadExcel = async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const form = new FormData();
        form.append('file', file);
        setBusy(true);
        try {
            const response = await axios.post('/api/mortgageerase/group/upload', form);
            const uploaded = Array.isArray(response.data?.rows) ? response.data.rows : [];
            setRows(uploaded.map(row => createRow(row.PAY_TP, row)));
            setLinked(false);
            setCompleted(false);
            notify(`${uploaded.length}건을 불러왔습니다.`);
        } catch (error) {
            notify(errorMessage(error, 'Excel 파일을 불러오지 못했습니다.'));
        } finally {
            setBusy(false);
        }
    };

    const exportExcel = useCallback(() => {
        if (!rows.length) { notify('내보낼 데이터가 없습니다.'); return; }
        const date = new Date();
        const fileDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        exportRowsToXlsx({
            columns: EXPORT_COLUMNS,
            rows: rows.map((row, index) => ({ ...row, NO: index + 1 })),
            fileName: `${fileDate}_다건말소.xlsx`,
            sheetName: '다건말소',
            getCellValue: (row, column) => {
                if (column.key === 'CHK') return row.CHK ? '선택' : '';
                if (column.key === 'PAY_TP') return row.PAY_TP === 'MON' ? '월납' : '건납';
                return row[column.key] ?? '';
            }
        });
    }, [notify, rows]);

    const linkRows = useCallback(async () => {
        const targets = rows.filter(row => row.CHK && !row.NOT_CHK);
        if (!targets.length) { notify('원부연계할 차량을 선택해 주세요.'); return; }
        setBusy(true);
        setProgress(`원부연계 0/${targets.length}`);
        const seenCars = new Set();
        let available = 0;
        let unavailable = 0;
        let missingPhone = 0;
        const nextRows = [];
        let processed = 0;

        for (const originalRow of rows) {
            let row = { ...originalRow, CAR_NO: cleanCarNo(originalRow.CAR_NO) };
            if (!row.CHK || row.NOT_CHK) {
                nextRows.push({ ...row, VALID: false });
                continue;
            }

            processed += 1;
            setProgress(`원부연계 ${processed}/${targets.length}`);
            const carNo = cleanCarNo(row.CAR_NO);
            if (carNo.length < 7) {
                nextRows.push({ ...row, CHK: false, NOT_CHK: true, VALID: false, PROC_TX: '차량번호 입력 안됨' });
                unavailable += 1;
                continue;
            }
            if (seenCars.has(carNo)) {
                nextRows.push({ ...row, CHK: false, NOT_CHK: true, VALID: false, PROC_TX: '중복된 차량번호' });
                unavailable += 1;
                continue;
            }
            seenCars.add(carNo);

            try {
                const response = await axios.post('/api/mortgageerase/car-info', {
                    CAR_NO: carNo,
                    BOND_AMT: String(row.BOND_AMT || '0'),
                    GOVT_ID: initData.service?.GOVT_ID || ''
                });
                const payload = response.data?.data || {};
                const info = payload.DATA || payload;
                const mortgageRows = Array.isArray(payload.MORT_INFO)
                    ? payload.MORT_INFO
                    : (Array.isArray(info.MORT_INFO) ? info.MORT_INFO : []);
                const mortgageInfo = mortgageRows[0] || info;
                const code = String(payload.code ?? info.code ?? '');
                let status = '';
                let valid = false;

                if (code === '1') {
                    const linkedBond = mortgageInfo.BOND_AMT ?? info.BOND_AMT ?? '';
                    if (String(row.BOND_AMT || '').trim()
                            && comparableAmount(linkedBond) !== comparableAmount(row.BOND_AMT)) {
                        status = '원부의 채권가액과 입력된 채권가액이 서로 상이합니다.';
                    } else {
                        valid = true;
                        row.BOND_AMT = String(row.BOND_AMT || linkedBond || '0');
                    }
                } else if (code === '2') status = '다수의 저당권 있음';
                else if (code === '0' || code === '3') status = '저당권 없음';
                else status = info.message || '알 수 없는 오류 발생';

                if (!valid) {
                    nextRows.push({ ...row, CHK: false, NOT_CHK: true, VALID: false, PROC_TX: status });
                    unavailable += 1;
                    continue;
                }

                if (!String(row.MPHONE_NO || '').trim()) {
                    status = '휴대폰 번호 입력안됨';
                    missingPhone += 1;
                }
                nextRows.push({
                    ...row,
                    CHK: true,
                    NOT_CHK: false,
                    VALID: true,
                    EULBU_NO: mortgageInfo.EULBU_NO || info.EULBU_NO || '',
                    PROC_TX: status,
                    CAR_INFO: {
                        ...info,
                        ...mortgageInfo,
                        CARID_NO: info.CARID_NO || info.CARID_NO2 || mortgageInfo.CARID_NO || '',
                        EULBU_NO: mortgageInfo.EULBU_NO || info.EULBU_NO || '',
                        MORTREG_DT: mortgageInfo.MORT_SET_DT || mortgageInfo.MORTREG_DT || ''
                    }
                });
                available += 1;
            } catch (error) {
                nextRows.push({
                    ...row, CHK: false, NOT_CHK: true, VALID: false,
                    PROC_TX: errorMessage(error, '원부연계 중 오류가 발생했습니다.')
                });
                unavailable += 1;
            }
        }

        setRows(nextRows);
        setLinked(true);
        setCompleted(false);
        setBusy(false);
        setProgress('');
        const phoneText = missingPhone ? `\n휴대폰 번호 미입력 ${missingPhone}건은 가상계좌번호를 발송할 수 없습니다.` : '';
        window.alert(`신청 가능한 건: ${available}\n신청 불가능한 건: ${unavailable}${phoneText}`);
    }, [initData.service, notify, rows]);

    const requestRows = useCallback(async () => {
        const targets = rows.filter(row => row.CHK && row.VALID && !row.NOT_CHK);
        if (!targets.length) { notify('신청 가능한 차량이 없습니다. 원부연계를 먼저 실행해 주세요.'); return; }
        if (window.location.hostname !== 'localhost' && new Date().getHours() >= 17) {
            notify('오후 5시 이후에는 신청할 수 없습니다.');
            return;
        }
        if (!window.confirm(`선택한 ${targets.length}건의 저당말소를 신청하시겠습니까?`)) return;

        setBusy(true);
        setProgress(`신청 0/${targets.length}`);
        let success = 0;
        let failure = 0;
        let processed = 0;
        const resultRows = [...rows];

        for (const target of targets) {
            processed += 1;
            setProgress(`신청 ${processed}/${targets.length}`);
            const index = resultRows.findIndex(row => row._id === target._id);
            const total = rowAmount(target);
            const service = { ...initData.service, SERVICE_ID: '', PROC_ST: 'REQ', CAR_NO: target.CAR_NO };
            const mortgage = {
                SERVICE_ID: '',
                CAR_NO: target.CAR_NO,
                MORT_NM: initData.company?.COMPANY_NM || '',
                REG_GB: initData.company?.COMPANY_NO ? 'B' : '',
                REG_NO: initData.company?.COMPANY_NO || '',
                BIZ_NO: initData.company?.BIZ_NO || '',
                BOND_AMT: String(target.BOND_AMT || '0'),
                PAY_NM: target.PAY_NM || '',
                PAY_HP_NO: target.MPHONE_NO || '',
                PAY_GB: initData.workCp?.PAYMENT_GB || 'A',
                PAY_ME: initData.workCp?.PAYMENT_ME || 'B',
                PAY_ST: 'N',
                TOTAL_AMT: total,
                PAY_TP: target.PAY_TP || 'GUN'
            };
            const carInfo = { ...(target.CAR_INFO || {}), EULBU_NO: target.EULBU_NO || target.CAR_INFO?.EULBU_NO || '' };
            const payments = [
                { PAY_KD: 'FEE', PAY_AMT: amounts.fee, PAY_OP: initData.workCp?.PAYMENT_OP || '', PAY_ST: 'N', PAY_DT: '' },
                { PAY_KD: 'REGIS', PAY_AMT: amounts.registration, PAY_OP: 'Y', PAY_ST: 'N', PAY_DT: '' },
                { PAY_KD: 'STAMP', PAY_AMT: amounts.stamp, PAY_OP: 'Y', PAY_ST: 'N', PAY_DT: '' }
            ];

            try {
                const response = await axios.post('/api/mortgageerase/request/process', { service, mortgage, carInfo, payments });
                const detail = response.data?.data || {};
                resultRows[index] = {
                    ...resultRows[index],
                    SERVICE_ID: detail.service?.SERVICE_ID || '',
                    REQUEST_DT: detail.service?.REQUEST_DT || '',
                    MEMBER_NM: detail.service?.MEMBER_NM || valueOf(user, 'member_NM', 'MEMBER_NM'),
                    PROC_TX: '저당말소 신청처리 성공'
                };
                success += 1;
            } catch (error) {
                resultRows[index] = { ...resultRows[index], PROC_TX: errorMessage(error, '처리 중 오류가 발생했습니다.') };
                failure += 1;
            }
            setRows([...resultRows]);
        }

        setCompleted(true);
        setBusy(false);
        setProgress('');
        window.alert(`총 ${success}건이 신청처리 되었습니다.${failure ? `\n실패 ${failure}건의 처리상태를 확인해 주세요.` : ''}`);
    }, [amounts, initData, notify, rowAmount, rows, user]);

    const close = useCallback(() => {
        if (activeTabId) removeTab(activeTabId);
        else navigate('/mortgageerase/mort-ers-list');
    }, [activeTabId, navigate, removeTab]);

    useEffect(() => {
        const handleKey = event => {
            if (location.pathname !== ROUTE_PATH) return;
            if (event.key === 'F3' && linked && !completed && !busy) { event.preventDefault(); requestRows(); }
            else if (event.key === 'F7') { event.preventDefault(); exportExcel(); }
            else if (event.key === 'F8' && !busy) { event.preventDefault(); initialize(); }
            else if (event.key === 'F9') { event.preventDefault(); close(); }
            else if (event.key === 'F10') { event.preventDefault(); navigate('/mortgageerase/mort-ers-list'); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [busy, close, completed, exportExcel, initialize, linked, location.pathname, navigate, requestRows]);

    return (
        <div className="mort-ers-group-request">
            {toast && <div className="toast-notification">{toast}</div>}
            <div className="status-toolbar">
                <div className="toolbar-left"><span className="toolbar-title">다건말소등록</span></div>
                <div className="toolbar-right">
                    <button className="btn-status" onClick={() => navigate('/mortgageerase/mort-ers-list')}>목록[F10]</button>
                    <button className="btn-status" onClick={addRow} disabled={linked || busy || rows.length >= 100}>행 추가</button>
                    <button className="btn-status" onClick={() => fileInputRef.current?.click()} disabled={linked || busy}>Excel 업로드</button>
                    <button className="btn-status" onClick={downloadTemplate} disabled={busy}>양식받기</button>
                    <button className="btn-status red" onClick={linkRows} disabled={linked || busy}>원부연계</button>
                    <button className="btn-status" onClick={requestRows} disabled={!linked || completed || busy || !selectedRows.some(row => row.VALID)}>신청[F3]</button>
                    <button className="btn-status" onClick={exportExcel}>엑셀[F7]</button>
                    <button className="btn-status" onClick={initialize} disabled={busy}>초기화[F8]</button>
                    <button className="btn-status" onClick={close}>닫기[F9]</button>
                    <input ref={fileInputRef} type="file" accept=".xls,.xlsx" hidden onChange={uploadExcel} />
                </div>
            </div>

            <div className="mort-group-summary">
                <div><span>회사</span><strong>{initData.company?.COMPANY_NM || '-'}</strong></div>
                <div><span>기본 수수료정산</span><strong>{initData.workCp?.PAYMENT_TP === 'MON' ? '월납' : '건납'}</strong></div>
                <div><span>수수료</span><strong>{amounts.fee.toLocaleString()}원</strong></div>
                <div><span>등록면허세</span><strong>{amounts.registration.toLocaleString()}원</strong></div>
                <div><span>증지대</span><strong>{amounts.stamp.toLocaleString()}원</strong></div>
                <div className="total"><span>선택 {selectedRows.length}건 / 총 금액</span><strong>{totalAmount.toLocaleString()}원</strong></div>
            </div>

            {progress && <div className="mort-group-progress">{progress}</div>}
            <div className="mort-group-grid-wrap">
                <table className="mort-group-grid">
                    <thead><tr>
                        <th className="no">순번</th><th className="check">선택</th><th>차량번호</th><th>휴대폰번호</th>
                        <th>결제자명</th><th>채권가액</th><th>수수료정산</th><th className="status">처리상태</th>
                        <th>신청일자</th><th>신청자</th><th className="delete">삭제</th>
                    </tr></thead>
                    <tbody>
                        {rows.map((row, index) => <tr key={row._id} className={row.NOT_CHK ? 'invalid' : row.SERVICE_ID ? 'success' : ''}>
                            <td className="center">{index + 1}</td>
                            <td className="center"><input type="checkbox" checked={!!row.CHK} disabled={linked || busy || row.NOT_CHK} onChange={event => updateRow(row._id, 'CHK', event.target.checked)} /></td>
                            <td><input value={row.CAR_NO || ''} disabled={linked || busy} maxLength={20} onChange={event => updateRow(row._id, 'CAR_NO', event.target.value)} /></td>
                            <td><input value={row.MPHONE_NO || ''} disabled={linked || busy} maxLength={20} onChange={event => updateRow(row._id, 'MPHONE_NO', event.target.value)} /></td>
                            <td><input value={row.PAY_NM || ''} disabled={linked || busy} maxLength={40} onChange={event => updateRow(row._id, 'PAY_NM', event.target.value)} /></td>
                            <td><input className="amount" inputMode="numeric" value={row.BOND_AMT || ''} disabled={linked || busy} onChange={event => updateRow(row._id, 'BOND_AMT', cleanAmount(event.target.value))} /></td>
                            <td><select value={row.PAY_TP || 'GUN'} disabled={linked || busy} onChange={event => updateRow(row._id, 'PAY_TP', event.target.value)}><option value="GUN">건납</option><option value="MON">월납</option></select></td>
                            <td className="status-text" title={row.PROC_TX || ''}>{row.PROC_TX || ''}</td>
                            <td className="center">{row.REQUEST_DT || ''}</td><td className="center">{row.MEMBER_NM || ''}</td>
                            <td className="center"><button className="row-delete" disabled={linked || busy} onClick={() => removeRow(row._id)}>−</button></td>
                        </tr>)}
                    </tbody>
                </table>
            </div>
            <div className="mort-group-footer">
                <span>총 {rows.length}건</span>
                <span>선택 {selectedRows.length}건</span>
                <span>{linked ? '원부연계 완료' : '입력 중'}</span>
                {completed && <strong>신청처리 완료</strong>}
            </div>
        </div>
    );
}

export default MortErsGroupRequest;
