import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useTabs } from '../../context/TabContext';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import { MortErsReceiptViewer } from './MortErsList';
import './MortErsList.css';

const userValue = (user, ...keys) => {
    for (const key of keys) if (user?.[key] !== undefined && user?.[key] !== null) return String(user[key]);
    return '';
};
const emptyService = { SERVICE_ID: '', WORK_CD: '001', PROC_ST: 'INPUT', JUDGE_ST: '', REQUEST_DT: '', JUDGE_DT: '', RETURN_TX: '', GOVT_ID: '' };
const emptyMortgage = { CAR_NO: '', MORT_NM: '', REG_GB: '', REG_NO: '', BIZ_NO: '', BOND_AMT: 0, PAY_NM: '', PAY_HP_NO: '', PAY_GB: 'A', PAY_ME: 'B', PAY_ST: 'N', VBANK_CD: '', VBANK_NO: '', TOTAL_AMT: 0, PAY_TP: 'GUN' };
const emptyCarInfo = { EULBU_NO: '', CARID_NO: '', CAR_NM: '', CAR_KD: '', CAR_US: '', CAR_YY: '', CARREG_DT: '', MORTREG_DT: '', MORT_CT: '', DIST_CT: '' };
const vehicleNumberPattern = /^(?:(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\d{1,2}[가-힣]\d{4}|\d{2,3}[가-힣]\d{4})$/;
const vehicleIdentificationNumberPattern = /^[A-HJ-NPR-Z0-9]{17}$/;
const normalizeCarIdentifier = value => String(value || '').replace(/\s/g, '').toUpperCase().slice(0, 17);
const getCarIdentifierError = value => {
    const normalized = normalizeCarIdentifier(value);
    if (!normalized) return '차량번호 또는 차대번호를 입력해 주세요.';
    if (vehicleNumberPattern.test(normalized) || vehicleIdentificationNumberPattern.test(normalized)) return '';
    return '차량번호 형식 또는 영문·숫자 17자리 차대번호인지 확인해 주세요.';
};
const mobilePhonePattern = /^(?:010\d{8}|01[16789]\d{7,8})$/;
const normalizePhoneDigits = value => String(value || '').replace(/\D/g, '').slice(0, 11);
const formatMobilePhone = value => {
    const digits = normalizePhoneDigits(value);
    if (digits.length <= 3) return digits;
    const middleLength = digits.startsWith('010') || digits.length === 11 ? 4 : 3;
    if (digits.length <= 3 + middleLength) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middleLength)}-${digits.slice(3 + middleLength)}`;
};
const getPayerNameError = value => String(value || '').trim().length > 50 ? '결제자명은 50자 이내로 입력해 주세요.' : '';
const getMobilePhoneError = value => {
    const digits = normalizePhoneDigits(value);
    if (!digits) return '';
    return mobilePhonePattern.test(digits) ? '' : '휴대폰번호 형식을 확인해 주세요. 예: 010-1234-5678';
};
export const manualMortgageCompanies = [
    { COMPANY_ID: 'CC005', COMPANY_NM: '신한카드' },
    { COMPANY_ID: 'CB035', COMPANY_NM: '하나캐피탈' },
    { COMPANY_ID: 'CB025', COMPANY_NM: '아주캐피탈' }
];

function MortErsRequest({ manualMode = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { activeTabId, removeTab } = useTabs();
    const toastTimer = useRef(null);
    const loadedId = useRef('');
    const handledReceipt = useRef(null);
    const loadVersion = useRef(0);
    const receiptNo = location.state?.receiptNo || '';
    const memberGb = userValue(user, 'member_GB', 'MEMBER_GB').toUpperCase();
    const isGovt = memberGb === 'GU';
    const routePath = manualMode ? '/mortgageerase/mort-ers-m-request' : '/mortgageerase/mort-ers-request';

    const [service, setService] = useState(emptyService);
    const [mortgage, setMortgage] = useState(emptyMortgage);
    const [carInfo, setCarInfo] = useState(emptyCarInfo);
    const [payments, setPayments] = useState([]);
    const [company, setCompany] = useState({});
    const [codes, setCodes] = useState({});
    const [mortOptions, setMortOptions] = useState([]);
    const [mortgageVerified, setMortgageVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');
    const [receiptOpen, setReceiptOpen] = useState(false);
    const [manualCompanyId, setManualCompanyId] = useState('CC005');

    const notify = useCallback(message => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast(message);
        toastTimer.current = setTimeout(() => setToast(''), 2800);
    }, []);
    useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

    const codeName = useCallback((group, value) => codes[group]?.find(code => code.CODE_ID === value)?.CODE_NM || value || '', [codes]);
    const totalAmount = useMemo(() => payments.reduce((sum, row) => {
        if (mortgage.PAY_TP === 'MON' && row.PAY_KD === 'FEE') return sum;
        return sum + Number(row.PAY_AMT || 0);
    }, 0), [mortgage.PAY_TP, payments]);
    useEffect(() => setMortgage(previous => ({ ...previous, TOTAL_AMT: totalAmount })), [totalAmount]);

    const loadCodes = useCallback(async () => {
        const groups = ['SGB', 'PR_ST', 'JG_ST', 'PAYME', 'PAYST', 'PAYKD', 'BANK', 'CARUS', 'GOVT'];
        try {
            const responses = await Promise.all(groups.map(group => axios.get(`/api/codes/${group}`)));
            setCodes(Object.fromEntries(groups.map((group, index) => [group, responses[index].data?.codes || []])));
        } catch { notify('공통 코드를 불러오지 못했습니다.'); }
    }, [notify]);

    const applyDetail = useCallback(data => {
        setService({ ...emptyService, ...(data.service || {}) });
        setMortgage({ ...emptyMortgage, ...(data.mortgage || {}), PAY_HP_NO: formatMobilePhone(data.mortgage?.PAY_HP_NO) });
        setCarInfo({ ...emptyCarInfo, ...(data.carInfo || {}) });
        setPayments(Array.isArray(data.payments) ? data.payments : []);
        setCompany(data.company || {});
        if (manualMode && data.service?.COMPANY_ID) setManualCompanyId(data.service.COMPANY_ID);
        setMortOptions([]);
    }, [manualMode]);

    const loadDetail = useCallback(async serviceId => {
        if (!serviceId) return;
        const version = ++loadVersion.current;
        setMortgageVerified(false);
        setLoading(true);
        try {
            const response = await axios.get(`/api/mortgageerase/detail/${encodeURIComponent(serviceId)}`);
            if (version !== loadVersion.current) return;
            applyDetail(response.data?.data || {});
            loadedId.current = serviceId;
        } catch (error) { if (version === loadVersion.current) notify(error.response?.data?.message || '신청 정보를 불러오지 못했습니다.'); }
        finally { if (version === loadVersion.current) setLoading(false); }
    }, [applyDetail, notify]);

    const initRequest = useCallback(async (selectedCompanyId = manualCompanyId) => {
        const version = ++loadVersion.current;
        handledReceipt.current = '';
        loadedId.current = '';
        setMortgageVerified(false);
        navigate(location.pathname, { replace: true, state: {} });
        setLoading(true);
        try {
            const response = await axios.get(
                manualMode ? '/api/mortgageerase/manual-request/init' : '/api/mortgageerase/request/init',
                manualMode ? { params: { companyId: selectedCompanyId } } : undefined
            );
            if (version !== loadVersion.current) return;
            const data = response.data?.data || {};
            const cp = data.workCp || {};
            const tax = data.tax || {};
            const initialPayments = [
                { PAY_KD: 'FEE', PAY_AMT: Number(cp.FEE || 0), PAY_OP: cp.PAYMENT_OP || '', PAY_ST: 'N', VBANK_CD: '', VBANK_NO: '', PAY_DT: '' },
                { PAY_KD: 'REGIS', PAY_AMT: Number(tax.REGIST_AMT || 0), PAY_OP: cp.PAYMENT_OP || '', PAY_ST: 'N', VBANK_CD: '', VBANK_NO: '', PAY_DT: '' },
                { PAY_KD: 'STAMP', PAY_AMT: Number(tax.STAMP_AMT || 0), PAY_OP: cp.PAYMENT_OP || '', PAY_ST: 'N', VBANK_CD: '', VBANK_NO: '', PAY_DT: '' }
            ];
            setService({ ...emptyService, ...(data.service || {}) });
            if (manualMode) setManualCompanyId(data.service?.COMPANY_ID || selectedCompanyId);
            const companyInfo = data.company || {};
            setMortgage({
                ...emptyMortgage,
                MORT_NM: companyInfo.COMPANY_NM || '',
                BIZ_NO: companyInfo.BIZ_NO || '',
                PAY_GB: cp.PAYMENT_GB || 'A',
                PAY_ME: cp.PAYMENT_ME || 'B',
                PAY_TP: cp.PAYMENT_TP || 'GUN'
            });
            setCarInfo(emptyCarInfo); setPayments(initialPayments); setCompany(data.company || {}); setMortOptions([]);
            setReceiptOpen(false);
        } catch (error) { if (version === loadVersion.current) notify(error.response?.data?.message || '신규 신청 기본정보를 불러오지 못했습니다.'); }
        finally { if (version === loadVersion.current) setLoading(false); }
    }, [location.pathname, manualCompanyId, manualMode, navigate, notify]);

    useEffect(() => { loadCodes(); }, [loadCodes]);
    useEffect(() => {
        if (!user || location.pathname !== routePath) return;
        if (handledReceipt.current === receiptNo) return;
        handledReceipt.current = receiptNo;
        if (receiptNo) {
            if (loadedId.current !== receiptNo) loadDetail(receiptNo);
        } else initRequest();
    }, [initRequest, loadDetail, location.pathname, receiptNo, routePath, user]);

    const editable = !service.SERVICE_ID || ['INPUT', 'SAV', 'C_REQ'].includes(service.PROC_ST || 'INPUT');
    const formEditable = !isGovt && editable;
    const feeMonthEditable = formEditable && memberGb !== 'SU';
    const judgeEditable = isGovt && !!service.SERVICE_ID;
    const updateMortgage = (key, value) => setMortgage(previous => ({ ...previous, [key]: value }));
    const applyMortOption = option => {
        setCarInfo(previous => ({
            ...previous,
            EULBU_NO: option.EULBU_NO || '',
            MORTREG_DT: option.MORT_SET_DT || option.MORTREG_DT || ''
        }));
        updateMortgage('BOND_AMT', Number(option.BOND_AMT || 0));
        setMortgageVerified(!!option.EULBU_NO);
    };
    const changeCarIdentifier = value => {
        const carIdentifier = normalizeCarIdentifier(value);
        if (carIdentifier === mortgage.CAR_NO) return;
        setMortgage(previous => ({ ...previous, CAR_NO: carIdentifier, BOND_AMT: 0 }));
        setCarInfo(emptyCarInfo);
        setMortOptions([]);
        setMortgageVerified(false);
    };

    const linkCar = async () => {
        const carIdentifier = normalizeCarIdentifier(mortgage.CAR_NO);
        const validationError = getCarIdentifierError(carIdentifier);
        if (validationError) { notify(validationError); return; }
        if (carIdentifier !== mortgage.CAR_NO) updateMortgage('CAR_NO', carIdentifier);
        setMortgageVerified(false);
        setCarInfo(emptyCarInfo);
        setMortOptions([]);
        setLoading(true);
        try {
            const response = await axios.post(
                manualMode ? '/api/mortgageerase/manual-request/car-info' : '/api/mortgageerase/car-info',
                { CAR_NO: carIdentifier, GOVT_ID: service.GOVT_ID, BOND_AMT: mortgage.BOND_AMT, COMPANY_ID: manualMode ? manualCompanyId : service.COMPANY_ID }
            );
            const payload = response.data?.data || {};
            const info = payload.DATA || payload;
            const options = Array.isArray(payload.MORT_INFO) ? payload.MORT_INFO : (Array.isArray(info.MORT_INFO) ? info.MORT_INFO : []);
            const code = String(payload.code ?? info.code ?? '');
            setCarInfo(previous => ({ ...previous, ...info, CARID_NO: info.CARID_NO || info.CARID_NO2 || previous.CARID_NO }));
            setMortOptions(options);
            if (code === '0') { setCarInfo(emptyCarInfo); notify('등록된 저당이 없어 말소 신청을 할 수 없습니다.'); }
            else if (code === '1' || options.length === 1) applyMortOption(options[0] || info);
            else if (code === '2' || options.length > 1) { applyMortOption(options[0]); notify('말소할 을부번호를 선택해 주세요.'); }
            else if (code === '3') { setCarInfo(emptyCarInfo); notify('등록된 저당이 없어 말소 신청을 할 수 없습니다.'); }
            else if (code === '-1') { setCarInfo(emptyCarInfo); notify(info.message || '차량정보 조회에 실패했습니다.'); }
            else { setCarInfo(emptyCarInfo); notify('저당권을 확인하지 못했습니다.'); }
        } catch (error) { setCarInfo(emptyCarInfo); notify(error.response?.data?.message || '차량정보 연계에 실패했습니다.'); }
        finally { setLoading(false); }
    };

    const process = async status => {
        if (status === 'REQ' && (!mortgageVerified || !String(carInfo.EULBU_NO || '').trim())) {
            notify('연계 버튼을 눌러 말소할 저당권을 먼저 확인해 주세요.');
            return;
        }
        const carIdentifier = normalizeCarIdentifier(mortgage.CAR_NO);
        const validationError = getCarIdentifierError(carIdentifier);
        if (validationError) { notify(validationError); return; }
        const payerName = String(mortgage.PAY_NM || '').trim();
        const payerNameError = getPayerNameError(payerName);
        if (payerNameError) { notify(payerNameError); return; }
        const phone = formatMobilePhone(mortgage.PAY_HP_NO);
        const phoneError = getMobilePhoneError(phone);
        if (phoneError) { notify(phoneError); return; }
        if (status === 'REQ' && window.location.hostname !== 'localhost' && new Date().getHours() >= 17) { notify('오후 5시 이후에는 신청할 수 없습니다.'); return; }
        if (status === 'REQ' && !phone && !window.confirm('결제자의 휴대폰번호가 입력되지 않았습니다. 휴대폰번호를 입력하지 않고 계속하시겠습니까?')) return;
        if (status === 'REQ' && !window.confirm('저당말소를 신청하시겠습니까?')) return;
        const nextService = { ...service, PROC_ST: status };
        setLoading(true);
        try {
            const response = await axios.post(
                manualMode ? '/api/mortgageerase/manual-request/process' : '/api/mortgageerase/request/process',
                { service: nextService, mortgage: { ...mortgage, CAR_NO: carIdentifier, PAY_NM: payerName, PAY_HP_NO: phone }, carInfo, payments }
            );
            applyDetail(response.data?.data || {});
            notify(status === 'REQ' ? '저당말소를 신청했습니다.' : '저장했습니다.');
        } catch (error) { notify(error.response?.data?.message || '저장 처리에 실패했습니다.'); }
        finally { setLoading(false); }
    };

    const deleteRequest = async () => {
        if (!service.SERVICE_ID) { notify('저장되지 않은 신청입니다.'); return; }
        if (!window.confirm('이 신청을 삭제하시겠습니까?')) return;
        try {
            await axios.post('/api/mortgageerase/request/delete', { SERVICE_ID: service.SERVICE_ID });
            notify('삭제했습니다.'); setTimeout(() => navigate('/mortgageerase/mort-ers-list'), 500);
        } catch (error) { notify(error.response?.data?.message || '삭제하지 못했습니다.'); }
    };

    const sendSms = async () => {
        const phone = normalizePhoneDigits(mortgage.PAY_HP_NO);
        if (!service.SERVICE_ID || !mortgage.VBANK_NO) { notify('가상계좌가 발급된 저장 건에서만 문자를 보낼 수 있습니다.'); return; }
        const phoneError = getMobilePhoneError(phone);
        if (phoneError || !phone) { notify(phoneError || '휴대폰번호를 입력해 주세요.'); return; }
        const text = `${company.COMPANY_NM || ''} [${mortgage.CAR_NO}] 저당말소 ${Number(mortgage.TOTAL_AMT || 0).toLocaleString()}원 (${codeName('BANK', mortgage.VBANK_CD)})[${mortgage.VBANK_NO}] 입금바랍니다.`;
        try { await axios.post('/api/mortgageerase/request/sms', { SERVICE_ID: service.SERVICE_ID, PAY_HP_NO: phone, TEXT: text }); notify('입금 안내 문자를 발송했습니다.'); }
        catch (error) { notify(error.response?.data?.message || '문자 발송에 실패했습니다.'); }
    };

    const close = useCallback(() => { if (activeTabId) removeTab(activeTabId); else navigate('/mortgageerase/mort-ers-list'); }, [activeTabId, navigate, removeTab]);
    useEffect(() => {
        const key = event => {
            if (location.pathname !== routePath) return;
            if (event.key === 'F3' && formEditable) { event.preventDefault(); process('REQ'); }
            else if (event.key === 'F4' && (formEditable || judgeEditable)) { event.preventDefault(); process('SAV'); }
            else if (event.key === 'F5' && service.SERVICE_ID) { event.preventDefault(); loadDetail(service.SERVICE_ID); }
            else if (event.key === 'F6') { event.preventDefault(); deleteRequest(); }
            else if (event.key === 'F8' && !isGovt) { event.preventDefault(); initRequest(); }
            else if (event.key === 'F9') { event.preventDefault(); close(); }
            else if (event.key === 'F10') { event.preventDefault(); navigate('/mortgageerase/mort-ers-list'); }
        };
        window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
    });

    const changeManualCompany = useCallback(event => {
        const companyId = event.target.value;
        setManualCompanyId(companyId);
        initRequest(companyId);
    }, [initRequest]);

    const receiptRows = [{ ...service, ...mortgage,
        BANK_NM: codeName('BANK', mortgage.VBANK_CD), PAY_ME: codeName('PAYME', mortgage.PAY_ME), GOVT_NM: codeName('GOVT', service.GOVT_ID),
        FEE_AMT: payments.find(row => row.PAY_KD === 'FEE')?.PAY_AMT, REGIS_AMT: payments.find(row => row.PAY_KD === 'REGIS')?.PAY_AMT,
        REGIS_NO: payments.find(row => row.PAY_KD === 'REGIS')?.VBANK_NO, STAMP_AMT: payments.find(row => row.PAY_KD === 'STAMP')?.PAY_AMT,
        PAY_DT: mortgage.PAY_DT || payments.find(row => row.PAY_DT)?.PAY_DT }];

    return (
        <div className="mort-ers-request">
            {toast && <div className="toast-notification">{toast}</div>}
            <div className="status-toolbar"><div className="toolbar-left"><span className="toolbar-title">{manualMode ? '저당말소 수동신청' : '저당말소 신청'}</span></div><div className="toolbar-right">
                <button className="btn-status" onClick={() => process('REQ')} disabled={!formEditable || !mortgageVerified || loading}>신청[F3]</button><button className="btn-status" onClick={() => process('SAV')} disabled={(!formEditable && !judgeEditable) || loading}>저장[F4]</button>
                <button className="btn-status" onClick={() => loadDetail(service.SERVICE_ID)} disabled={!service.SERVICE_ID}>새로고침[F5]</button><button className="btn-status" onClick={deleteRequest} disabled={!service.SERVICE_ID || isGovt}>삭제[F6]</button>
                <button className="btn-status" onClick={() => initRequest()} disabled={isGovt}>초기화[F8]</button><button className="btn-status" onClick={close}>닫기[F9]</button><button className="btn-status" onClick={() => navigate('/mortgageerase/mort-ers-list')}>목록[F10]</button>
            </div></div>
            <ErpSection isHeader><div className="erp-row">
                <ErpField label="신청구분" span={2}><input className="erp-input" value={codeName('SGB', '001') || '저당말소'} readOnly /></ErpField><ErpField label="접수번호" span={2}><input className="erp-input" value={service.SERVICE_ID || ''} readOnly /></ErpField>
                <ErpField label="신청자명" span={2}><input className="erp-input" value={service.MEMBER_NM || userValue(user, 'member_NM', 'MEMBER_NM')} readOnly /></ErpField><ErpField label="신청일자" span={2}><input className="erp-input" value={service.REQUEST_DT || ''} readOnly /></ErpField>
                {manualMode && <ErpField label="회사" span={2}><select className="erp-input" value={manualCompanyId} disabled={!!service.SERVICE_ID || loading} onChange={changeManualCompany}>{manualMortgageCompanies.map(item => <option key={item.COMPANY_ID} value={item.COMPANY_ID}>{item.COMPANY_NM}</option>)}</select></ErpField>}
            </div><div className="erp-row">
                <ErpField label="신청상태" span={2}><input className="erp-input" value={codeName('PR_ST', service.PROC_ST)} readOnly /></ErpField><ErpField label="심사일자" span={2}><input className="erp-input" value={service.JUDGE_DT || ''} readOnly /></ErpField>
                <ErpField label="심사상태" span={2}><select className="erp-input" value={service.JUDGE_ST || ''} disabled={!judgeEditable} onChange={e => setService(p => ({ ...p, JUDGE_ST: e.target.value }))}><option value="">선택</option>{(codes.JG_ST || []).map(c => <option key={c.CODE_ID} value={c.CODE_ID}>{c.CODE_NM}</option>)}</select></ErpField>
                <ErpField label="반려사유" span={4}><input className="erp-input" value={service.RETURN_TX || ''} disabled={!judgeEditable} onChange={e => setService(p => ({ ...p, RETURN_TX: e.target.value }))} /></ErpField>
            </div></ErpSection>
            <div className="mort-request-section"><h3>저당권자 정보</h3><div className="mort-form-grid">
                <label>성명(상호)<input value={company.COMPANY_NM || ''} readOnly /></label><label>등록번호<input value={company.COMPANY_NO || ''} readOnly /></label><label>사업자번호<input value={company.BIZ_NO || ''} readOnly /></label>
                <label className="wide">주소<input value={`${company.ADDRESS || ''} ${company.ADDRESS_DT || ''}`.trim()} readOnly /></label><label>우편번호<input value={company.POST_NO || ''} readOnly /></label>
            </div></div>
            <div className="mort-request-section"><h3>저당정보</h3><div className="mort-form-grid">
                <label>차량번호/차대번호<div className="inline"><input value={mortgage.CAR_NO || ''} disabled={!formEditable} maxLength={17} onChange={e => changeCarIdentifier(e.target.value)} onKeyDown={e => e.key === 'Enter' && linkCar()} /><button onClick={linkCar} disabled={!formEditable}>연계</button></div></label>
                <label>채권가액(채권최고액)<input type="number" value={mortgage.BOND_AMT || 0} disabled={!formEditable || mortOptions.length > 0} onChange={e => updateMortgage('BOND_AMT', e.target.value)} /></label>
                <label>을부번호{mortOptions.length > 1 ? <select value={carInfo.EULBU_NO || ''} onChange={e => applyMortOption(mortOptions.find(o => o.EULBU_NO === e.target.value) || {})}>{mortOptions.map(o => <option key={o.EULBU_NO} value={o.EULBU_NO}>{o.EULBU_NO}</option>)}</select> : <input value={carInfo.EULBU_NO || ''} readOnly />}</label>
            </div><table className="mort-info-table"><thead><tr><th>차대번호</th><th>차명</th><th>차종</th><th>용도</th><th>저당건수</th><th>압류건수</th><th>모델연도</th><th>최초등록일</th></tr></thead><tbody><tr><td>{carInfo.CARID_NO}</td><td>{carInfo.CAR_NM}</td><td>{carInfo.CAR_KD}</td><td>{codeName('CARUS', carInfo.CAR_US)}</td><td>{carInfo.MORT_CT}</td><td>{carInfo.DIST_CT}</td><td>{carInfo.CAR_YY}</td><td>{carInfo.CARREG_DT}</td></tr></tbody></table></div>
            <div className="mort-request-section"><h3>결제 정보</h3><div className="mort-form-grid payment">
                <label>결제자명<input value={mortgage.PAY_NM || ''} disabled={!formEditable} maxLength={50} onChange={e => updateMortgage('PAY_NM', e.target.value)} /></label><label>휴대폰번호<div className="inline"><input type="tel" inputMode="numeric" value={mortgage.PAY_HP_NO || ''} disabled={!formEditable} maxLength={13} onChange={e => updateMortgage('PAY_HP_NO', formatMobilePhone(e.target.value))} /><button onClick={sendSms} disabled={!service.SERVICE_ID || !mortgage.VBANK_NO}>SMS발송</button></div></label>
                <label>총 금액<input value={`${totalAmount.toLocaleString()} 원`} readOnly /></label><label>가상계좌<div className="inline"><select value={mortgage.VBANK_CD || ''} disabled><option value="">은행</option>{(codes.BANK || []).map(c => <option key={c.CODE_ID} value={c.CODE_ID}>{c.CODE_NM}</option>)}</select><input value={mortgage.VBANK_NO || ''} readOnly /></div></label>
                <label>납부방법<div className="payment-method-control"><select value={mortgage.PAY_ME || ''} disabled={!formEditable} onChange={e => updateMortgage('PAY_ME', e.target.value)}>{(codes.PAYME || []).map(c => <option key={c.CODE_ID} value={c.CODE_ID}>{c.CODE_NM}</option>)}</select><span className="fee-month-check"><input type="checkbox" checked={mortgage.PAY_TP === 'MON'} disabled={!feeMonthEditable} onChange={e => updateMortgage('PAY_TP', e.target.checked ? 'MON' : 'GUN')} />수수료 월납</span></div></label><label>납부상태<input value={codeName('PAYST', mortgage.PAY_ST)} readOnly /></label>
            </div><div className="receipt-button-row"><button onClick={() => setReceiptOpen(true)} disabled={mortgage.PAY_ST !== 'Y'}>납부영수증</button></div>
            <table className="mort-info-table"><thead><tr><th>결제종류</th><th>전자납부번호(가상계좌번호)</th><th>결제금액</th><th>입금여부</th><th>결제일시</th></tr></thead><tbody>{payments.map((row, index) => <tr key={`${row.PAY_KD}-${index}`}><td>{codeName('PAYKD', row.PAY_KD)}</td><td>{row.VBANK_NO}</td><td className="amount">{Number(row.PAY_AMT || 0).toLocaleString()}</td><td>{codeName('PAYST', row.PAY_ST)}</td><td>{row.PAY_DT}</td></tr>)}</tbody></table></div>
            {receiptOpen && <MortErsReceiptViewer rows={receiptRows} onClose={() => setReceiptOpen(false)} />}
        </div>
    );
}

export default MortErsRequest;
