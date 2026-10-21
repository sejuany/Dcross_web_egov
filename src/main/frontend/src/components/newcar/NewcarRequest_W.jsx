import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTabs } from '../../context/TabContext';
import { gf } from '../../utils/utils';
import ErpField from '../common/ErpField';
import ErpSection from '../common/ErpSection';
import CommonSelect from '../common/CommonSelect';
import AddressSearchModal from '../common/AddressSearchModal';
import NumberPlateModal from './NumPlateSelectModal';
import NewCarReceiptModal from './NewCarReceiptModal';
import BondReceiptModal from './BondReceiptModal';
import WaNewcarAttachModal from '../../wa/pages/newcar/WaNewcarAttachModal';
import { initialOwnerInfo1 } from './newcarInitial';
import { canEditW, fieldLabels, gradeTargets, normalizeWData, pdfWChanges, requiredWFields, validateW } from './newcarRequestW';
import './NewcarRequest.css';
import './NewcarRequest_W.css';

const REQUEST_PATH = '/newcar/newcar-request-w';
const LIST_PATH = '/newcar/newcar-list-w';
const payLabels = { ACQ: '취득세', BFEE: '채권취급수수료', BOND: '채권', FEE: '등록수수료', INJI: '인지세', SPARE: '예비비', STAMP: '증지대', TNUM: '번호판대', UNUM: '번호판대행', UREG: '등록면허세' };
const codeGroups = ['SGB', 'PR_ST', 'JG_ST', 'TASK', 'BOND', 'NTTCD', 'NTTGR', 'NTWHO', 'REGGB', 'NUMGB', 'NUMST', 'PAYST', 'PAYME', 'BANK', 'FUEL', 'NHOLE', 'NSEAL', 'CARM'];

const NewcarRequest_W = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { tabs, activeTabId, removeTab, addTab, switchTab } = useTabs();
    const [data, setData] = useState(() => normalizeWData());
    const [codes, setCodes] = useState({});
    const [tab, setTab] = useState('owner');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [modal, setModal] = useState('');
    const [secondOwner, setSecondOwner] = useState(false);
    const [addressTarget, setAddressTarget] = useState(null);
    const [certificate, setCertificate] = useState(null);
    const [preview, setPreview] = useState(null);
    const [paperUrl, setPaperUrl] = useState('');
    const [autoFields, setAutoFields] = useState([]);
    const loadedKey = useRef('');
    const loadedData = useRef(null);
    const savingRef = useRef(false);
    const formRef = useRef(null);
    const fileRef = useRef(null);
    const domainList = useId();
    const { dsService: service, dsNewCar: car, dsCarNoDetach: detach, dsTaxReceipt: tax } = data;
    const editable = canEditW(service) && data.dsUserInfo.COMPANY_ID === 'WB001' && !busy;
    const required = requiredWFields(data);
    const jointRequired = Number(car.RATIO_NO) < 100;
    const update = (key, name, value) => setData(previous => ({ ...previous, [key]: { ...previous[key], [name]: value } }));

    const load = useCallback(async (id = '') => {
        setBusy(true); setMessage('');
        try {
            const response = await axios.get(id ? `/api/newcar/detail/${encodeURIComponent(id)}` : '/api/newcar/init');
            if (!response.data?.success) throw new Error(response.data?.message || '신청 정보를 불러오지 못했습니다.');
            const next = normalizeWData(gf.formatDateFields(response.data.data));
            if (next.dsUserInfo.COMPANY_ID !== 'WB001') throw new Error('WB001 담당자만 사용할 수 있습니다.');
            setData(next); setSecondOwner(Boolean(next.dsOwnerInfo1.DEBTOR_NM || Number(next.dsOwnerInfo1.DEBTOR_RATIO) > 0));
            loadedData.current = next;
            setCertificate(null); setPreview(null);
            setAutoFields(next.dsCarNoDetach.FILENAME1 ? ['CARID_NO', 'CAR_NM', 'BUY_AMT', 'OWNER_NM', 'REG_NO', 'ADDRESS', 'MADE_DT', 'REGIST_DATE']
                .filter(key => next.dsNewCar[key] !== '' && next.dsNewCar[key] != null) : []);
            return true;
        } catch (error) { setMessage(error.response?.data?.message || error.message || '조회 중 오류가 발생했습니다.'); return false; }
        finally { setBusy(false); }
    }, []);
    useEffect(() => {
        let active = true;
        gf.getCodes(codeGroups).then(result => { if (active) setCodes(result); })
            .catch(() => { if (active) setMessage('공통코드를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.'); });
        return () => { active = false; };
    }, []);
    useEffect(() => {
        return () => { if (paperUrl) URL.revokeObjectURL(paperUrl); };
    }, [paperUrl]);
    useEffect(() => {
        if (location.pathname !== REQUEST_PATH) return;
        const id = location.state?.receiptNo || '';
        const key = `${id}:${location.state?.detailOpenKey || ''}`;
        if (loadedKey.current === key) return;
        loadedKey.current = key; load(id);
    }, [location.pathname, location.state?.receiptNo, location.state?.detailOpenKey, load]);
    const focusError = error => {
        setMessage(error.message);
        if (error.key === 'dsTaxReceipt') setModal('tax'); else setTab('owner');
        window.setTimeout(() => {
            const target = formRef.current?.querySelector(`[data-record="${error.key}"][name="${error.name}"]`);
            target?.scrollIntoView?.({ block: 'center' }); target?.focus();
        }, 0);
    };
    const save = async (action = 'SAVE', supplied = data) => {
        if (savingRef.current || !editable) return false;
        const error = action === 'DELETE' ? null : validateW(supplied, action);
        if (error) { focusError(error); return false; }
        if (action !== 'SAVE' && !await gf.confirm(action === 'DELETE' ? '신청건을 삭제하시겠습니까?' : '입력한 내용으로 신청하시겠습니까?')) return false;
        if (savingRef.current) return false;
        savingRef.current = true; setBusy(true); setMessage('');
        try {
            if (action === 'DELETE' && car.REQ_CAR_NO && await gf.confirm(`선택한 번호판 ${car.REQ_CAR_NO}도 미사용 처리하시겠습니까?`)) {
                await axios.post('/api/newcar/updateNumplateUseYn', { serviceId: service.SERVICE_ID, carNo: car.REQ_CAR_NO });
                update('dsNewCar', 'REQ_CAR_NO', '');
            }
            const request = JSON.parse(JSON.stringify(supplied));
            // 표시용 구분 문자는 제거하되 계좌·등록번호의 앞자리 0은 유지한다.
            for (const key of ['dsNewCar', 'dsOwnerInfo', 'dsOwnerInfo1', 'dsTaxReceipt']) {
                const fields = key === 'dsNewCar' ? ['REG_NO', 'BIZ_NO', 'MPHONE_NO', 'TEL_NO', 'PAY_HP_NO', 'RETURN_NO']
                    : key === 'dsTaxReceipt' ? ['REG_NO', 'PHONE_NO'] : ['DEBTOR_REG_NO', 'DEBTOR_BIZ_NO', 'DEBTOR_TEL_NO', 'DEBTOR_MPHONE_NO'];
                fields.forEach(name => { if (request[key][name] != null) request[key][name] = String(request[key][name]).replace(/\D/g, ''); });
            }
            const body = new FormData();
            body.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' })); body.append('action', action);
            if (certificate && action !== 'DELETE') body.append('productionCertificate', certificate);
            const response = await axios.post('/api/newcar/w/process', body);
            if (!response.data?.success || Number(response.data?.data?.RESULT_CD) < 0) throw new Error(response.data?.data?.MESSAGE || '처리를 완료하지 못했습니다.');
            const id = response.data.data.SERVICE_ID;
            setData(previous => ({ ...previous, dsService: { ...previous.dsService, SERVICE_ID: id } }));
            setCertificate(null);
            loadedKey.current = `${id}:`; navigate(REQUEST_PATH, { replace: true, state: { receiptNo: id } });
            const refreshed = await load(id);
            setMessage(refreshed ? (action === 'REQUEST' ? '신청되었습니다.' : action === 'DELETE' ? '삭제되었습니다.' : '저장되었습니다.')
                : '처리는 완료됐지만 다시 조회하지 못했습니다. 새로고침해 주세요.');
            return true;
        } catch (error) { setMessage(error.response?.data?.message || error.message || '처리 중 오류가 발생했습니다.'); return false; }
        finally { savingRef.current = false; setBusy(false); }
    };
    const selectPdf = async event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file || !editable) return;
        if (!/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setMessage('10MB 이내의 PDF 한 개를 선택해 주세요.'); return; }
        setBusy(true); setMessage('');
        try {
            const body = new FormData(); body.append('file', file);
            const response = await axios.post('/api/newcar/pdf-extract', body);
            if (!response.data?.success) throw new Error(response.data?.message || '제작증 추출에 실패했습니다.');
            setPreview({ file, values: pdfWChanges(car, response.data.data || {}) }); setModal('pdf');
        } catch (error) { setMessage(error.response?.data?.message || error.message || 'PDF를 읽지 못했습니다.'); }
        finally { setBusy(false); }
    };
    const showNumber = async () => {
        if (!service.SERVICE_ID) { setMessage('저장 후 번호를 선택할 수 있습니다.'); return; }
        if (!car.NUMPLATE_GB) { focusError({ key: 'dsNewCar', name: 'NUMPLATE_GB', message: '번호판 종류를 선택해 주세요.' }); return; }
        let next = data;
        if (car.REQ_CAR_NO) {
            if (!await gf.confirm(`선택된 번호 ${car.REQ_CAR_NO}를 해제하고 다시 선택하시겠습니까?`)) return;
            try {
                await axios.post('/api/newcar/updateNumplateUseYn', { serviceId: service.SERVICE_ID, carNo: car.REQ_CAR_NO });
                next = { ...data, dsNewCar: { ...car, REQ_CAR_NO: '' } }; setData(next);
            }
            catch { setMessage('기존 번호를 해제하지 못했습니다.'); return; }
        }
        const previous = loadedData.current;
        const changed = ['CARID_NO', 'NUMPLATE_GB', 'TASK_CD'].some(key => previous?.dsNewCar[key] !== car[key])
            || ['HOLE_YN', 'SEAL_YN'].some(key => previous?.dsCarNoDetach[key] !== detach[key]);
        if (changed && (!await gf.confirm('번호선택 조건이 변경되었습니다. 작성 내용을 저장한 뒤 번호를 조회하시겠습니까?') || !await save('SAVE', next))) return;
        setModal('number');
    };
    const showPaper = async () => {
        if (!service.SERVICE_ID) { setMessage('저장된 신청건의 등록증을 확인할 수 있습니다.'); return; }
        setBusy(true);
        try {
            const response = await axios.get('/api/newcar/w/carpaper', { params: { serviceId: service.SERVICE_ID }, responseType: 'blob' });
            setPaperUrl(URL.createObjectURL(response.data)); setModal('paper');
        } catch (error) {
            let text = '등록증 파일이 준비되지 않았거나 조회 권한이 없습니다.';
            if (error.response?.data?.text) { try { text = JSON.parse(await error.response.data.text()).message || text; } catch {} }
            setMessage(text);
        } finally { setBusy(false); }
    };
    const selectAddress = address => {
        const { key, prefix } = addressTarget;
        const fields = prefix === 'OWNER' ? ['ADDRESS', 'ADDRESS_DT', 'POST_NO', 'BUBJUNG_CD']
            : prefix === 'BASE' ? ['BASE_ADDRESS', 'BASE_ADDRESS_DT', 'BASE_POST_NO', 'BASE_BUBJUNG_CD']
            : prefix === 'CARP' ? ['CARP_ADDRESS', 'CARP_ADDRESS_DT', 'CARP_POST_NO']
            : prefix === 'TAX' ? ['ADDR', 'ADDR_DT', 'POST_NO'] : ['DEBTOR_ADDR', 'DEBTOR_ADDR_DT', 'DEBTOR_ROAD_CD'];
        const values = [address.ADDR, address.ADDR_DT, address.POST_NO, address.BUBJUNG_CD];
        const patch = Object.fromEntries(fields.map((name, index) => [name, values[index] || '']));
        if (['OWNER', 'BASE'].includes(prefix) && ['B', 'C'].includes(car.REG_GB)) patch[prefix === 'OWNER' ? 'ADDR_INFO' : 'ADDR_INFO2'] =
            `${address.ROAD_CD || ''}þ${String(address.BUBJUNG_CD || '').substring(0, 8)}00þ${address.HJD_CD || ''}þ${address.JIHA_YN || '0'}þ${address.BUILDB_NO || '0'}þ${address.BUILDS_NO || '0'}þ${address.ADDR_DT || ''}þ`;
        setData(previous => ({ ...previous, [key]: { ...previous[key], ...patch } })); setAddressTarget(null);
    };
    const goList = () => {
        const existing = tabs.find(item => item.path === LIST_PATH);
        if (existing) switchTab(existing.id); else addTab('newcar-list-w', '신규신청현황(W)', LIST_PATH);
    };
    const updateEmail = (part, value) => {
        const pieces = (car.CARP_MAIL || '').split('@');
        pieces[part] = value.replace(/[@\s]/g, '');
        update('dsNewCar', 'CARP_MAIL', (pieces[0] || pieces[1]) ? `${pieces[0] || ''}@${pieces[1] || ''}` : '');
    };
    const field = (key, name, label = fieldLabels[name], options = {}) => {
        const { group, span = 3, readOnly = false, type = 'text', options: selectOptions, disabled = false } = options;
        const needed = required.some(([record, fieldName]) => record === key && fieldName === name);
        const isAuto = key === 'dsNewCar' && autoFields.includes(name);
        const props = { name, 'aria-label': label, 'data-record': key, value: data[key]?.[name] ?? '',
            className: `erp-input ${needed ? 'w-required' : ''} ${isAuto ? 'w-auto' : ''}`,
            onChange: event => {
                let value = event.target.value;
                if (name === 'CARID_NO') value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
                if (name === 'BUY_AMT') value = value.replace(/[^0-9]/g, '');
                update(key, name, value);
            } };
        return <ErpField key={`${key}.${name}.${label}`} label={label} span={span} required={needed} labelWidth="122px">
            {group && !readOnly ? <CommonSelect {...props} codes={codes} groupId={group} options={selectOptions} disabled={disabled || !editable} />
                : group ? <input {...props} value={(selectOptions || codes[group] || []).find(row => String(row.CODE_ID) === String(props.value))?.CODE_NM || props.value} readOnly />
                : <input {...props} type={type} readOnly={readOnly || disabled || !editable} maxLength={name === 'CARID_NO' ? 17 : undefined} />}
        </ErpField>;
    };
    const addressFields = (key, prefix, label) => {
        const names = prefix === 'OWNER' ? ['ADDRESS', 'ADDRESS_DT'] : prefix === 'BASE' ? ['BASE_ADDRESS', 'BASE_ADDRESS_DT']
            : prefix === 'CARP' ? ['CARP_ADDRESS', 'CARP_ADDRESS_DT'] : prefix === 'TAX' ? ['ADDR', 'ADDR_DT'] : ['DEBTOR_ADDR', 'DEBTOR_ADDR_DT'];
        const disabled = !editable || (key.startsWith('dsOwnerInfo') && !jointRequired);
        return <div className="w-fields" key={`${key}.${prefix}`}>
            {field(key, names[0], label, { span: 8, readOnly: true })}
            <div className="w-address-action"><button type="button" className="btn-erp light" disabled={disabled} onClick={() => setAddressTarget({ key, prefix })}>{label} 검색</button></div>
            {field(key, names[1], `${label} 상세`, { span: 12, disabled })}
        </div>;
    };
    const jointPanel = (key, index) => <ErpSection title={`공동 소유자 정보${index ? ' (2)' : ''}`} key={key}>
        <div className="w-fields">
            {field(key, 'DEBTOR_NM', index ? '공동소유자명(2)' : '공동소유자명', { span: 6, disabled: !jointRequired })}
            {field(key, 'DEBTOR_TEL_NO', '전화번호', { span: 6, disabled: !jointRequired })}
            {field(key, 'DEBTOR_GB', '공동소유자 등록구분', { group: 'REGGB', span: 6, disabled: !jointRequired })}
            {field(key, 'DEBTOR_REG_NO', '공동소유자 등록번호', { span: 6, disabled: !jointRequired })}
            {data[key].DEBTOR_GB === 'B' && field(key, 'DEBTOR_BIZ_NO', '공동소유자 사업자번호', { span: 6, disabled: !jointRequired })}
            {field(key, 'DEBTOR_RATIO', '공동소유자비율(%)', { span: 6, type: 'number', disabled: !jointRequired })}
        </div>{addressFields(key, 'JOINT', '공동소유자 주소')}
    </ErpSection>;

    return <div className="new-reg-container newcar-request-w" ref={formRef}>
        <div className="erp-toolbar"><div className="toolbar-left">
            <button type="button" className="btn-erp light" disabled={busy} onClick={() => service.SERVICE_ID ? setModal('attach') : setMessage('저장 후 첨부서류를 등록할 수 있습니다.')}>첨부서류</button>
            <button type="button" className="btn-erp light" disabled={!editable} onClick={() => fileRef.current?.click()}>제작증 업로드</button>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={selectPdf} aria-label="제작증 PDF" />
            <button type="button" className="btn-erp light" onClick={goList}>목록</button>
        </div><div className="toolbar-right">
            <button type="button" className="btn-erp" disabled={!editable} onClick={() => save('REQUEST')}>신청</button>
            <button type="button" className="btn-erp" disabled={!editable} onClick={() => save()}>저장</button>
            <button type="button" className="btn-erp" disabled={busy} onClick={async () => { if (await gf.confirm('저장하지 않은 내용을 버리고 다시 조회하시겠습니까?')) load(service.SERVICE_ID); }}>새로고침</button>
            <button type="button" className="btn-erp" disabled={!editable || !service.SERVICE_ID} onClick={() => save('DELETE')}>삭제</button>
            <button type="button" className="btn-erp" disabled={busy} onClick={async () => {
                if (!await gf.confirm('작성 중인 내용을 초기화하시겠습니까?')) return;
                loadedKey.current = ':'; navigate(REQUEST_PATH, { replace: true, state: {} }); setTab('owner'); load();
            }}>초기화</button>
            <button type="button" className="btn-erp" disabled={busy} onClick={async () => { if (await gf.confirm('저장하지 않은 내용을 닫으시겠습니까?')) removeTab(activeTabId); }}>닫기</button>
        </div></div>
        {busy && <p className="w-state" role="status">처리 중입니다.</p>}
        {message && <p className="w-message" role="alert">{message}</p>}
        <div className="w-scroll">
            <ErpSection isHeader><div className="w-fields">
                {field('dsService', 'WORK_CD', '신청구분', { group: 'SGB', readOnly: true })}
                {field('dsService', 'SERVICE_ID', '접수번호', { readOnly: true })}
                {field('dsCompanyInfo', 'COMPANY_NM', '회사명', { readOnly: true })}
                {field('dsService', 'MEMBER_ID', '신청자명', { readOnly: true })}
                {field('dsService', 'REQUEST_DT', '신청일자', { readOnly: true, type: 'date' })}
                {field('dsService', 'PROC_ST', '신청상태', { group: 'PR_ST', readOnly: true })}
                {field('dsService', 'JUDGE_DT', '심사일자', { readOnly: true, type: 'date' })}
                {field('dsService', 'JUDGE_ST', '심사상태', { group: 'JG_ST', readOnly: true })}
                {field('dsCarNoDetach', 'NUMPLATE_ST', '배송상태', { group: 'NUMST', readOnly: true })}
                {field('dsService', 'RETURN_TX', '반려사유', { span: 9, readOnly: true })}
            </div></ErpSection>
            <ErpSection title="자동차정보"><div className="w-fields">
                {field('dsNewCar', 'TASK_CD', '업무구분', { group: 'TASK', options: (codes.TASK || []).filter(row => ['NORML', 'LEASE'].includes(row.CODE_ID)) })}
                {field('dsNewCar', 'CARID_NO')}{field('dsNewCar', 'REGIST_DATE', '등록예정일자', { type: 'date' })}{field('dsNewCar', 'BUY_AMT', '공급가액(VAT별도)')}
                {field('dsNewCar', 'NUMPLATE_GB', '번호판지정 요구사항', { group: 'NUMGB', span: 6, options: (codes.NUMGB || []).filter(row => ['F', '7', 'FG'].includes(row.CODE_ID)) })}
                {field('dsCarNoDetach', 'HOLE_YN', '천공 여부', { group: 'NHOLE' })}{field('dsCarNoDetach', 'SEAL_YN', '봉인 여부', { group: 'NSEAL' })}
                {field('dsNewCar', 'REQ_CAR_NO', '선택 차량번호', { readOnly: true })}
                <div className="w-number-action"><button type="button" className="btn-erp light" disabled={!editable} onClick={showNumber}>번호선택</button></div>
                {field('dsNewCar', 'CAR_NO', '등록차량번호', { readOnly: true })}{field('dsNewCar', 'MADE_DT', '최초등록일', { type: 'date', readOnly: true })}
                {field('dsNewCar', 'CAR_KD', '차종', { group: 'CARM', readOnly: true })}{field('dsNewCar', 'FM_NM', '원동기형식', { readOnly: true })}
                {field('dsNewCar', 'SPMNNO', '형식승인번호', { readOnly: true })}{field('dsNewCar', 'FUEL_CD', '사용연료', { group: 'FUEL', readOnly: true })}
                {field('dsNewCar', 'CAR_NM', '차명', { span: 6, readOnly: true })}{field('dsNewCar', 'CAR_NM', '형식', { span: 6, readOnly: true })}
            </div></ErpSection>
            <div className="tab-header-list" role="tablist" aria-label="신규등록 정보">
                <button type="button" role="tab" aria-selected={tab === 'owner'} className={`tab-btn ${tab === 'owner' ? 'active' : ''}`} onClick={() => setTab('owner')}>등록정보</button>
                <button type="button" role="tab" aria-selected={tab === 'payment'} className={`tab-btn ${tab === 'payment' ? 'active' : ''}`} onClick={() => setTab('payment')}>결제정보</button>
            </div>
            {tab === 'owner' ? <div role="tabpanel" aria-label="등록정보"><div className="w-owner-grid">
                <ErpSection title="대표 소유자 정보"><div className="w-fields">
                    {field('dsService', 'LINK_ID', '주문번호', { span: 6 })}{field('dsCarNoDetach', 'CUSTOMER_NM', '계약자명', { span: 6 })}
                    {field('dsNewCar', 'REG_GB', '등록구분', { span: 6, group: 'REGGB' })}{field('dsNewCar', 'REG_NO', '등록번호', { span: 6 })}
                    {car.REG_GB === 'B' && field('dsNewCar', 'BIZ_NO', '사업자번호', { span: 6 })}
                    {field('dsNewCar', 'OWNER_NM', '대표소유자명', { span: 6 })}{field('dsNewCar', 'RATIO_NO', '대표소유자 비율(%)', { span: 6, type: 'number' })}
                    {field('dsNewCar', 'MPHONE_NO', '휴대폰번호', { span: 6 })}{field('dsNewCar', 'TEL_NO', '전화번호', { span: 6 })}
                </div>{addressFields('dsNewCar', 'OWNER', '소유자주소')}{addressFields('dsNewCar', 'BASE', '사용본거지')}
                    <button type="button" className="btn-erp light" disabled={!editable} onClick={() => setData(previous => ({ ...previous,
                        dsNewCar: { ...previous.dsNewCar, BASE_ADDRESS: car.ADDRESS, BASE_ADDRESS_DT: car.ADDRESS_DT, BASE_POST_NO: car.POST_NO, BASE_BUBJUNG_CD: car.BUBJUNG_CD, ADDR_INFO2: car.ADDR_INFO } }))}>사용본거지를 소유자주소와 동일하게</button>
                </ErpSection>
                <div>{jointPanel('dsOwnerInfo', 0)}
                    <label className="w-joint-toggle"><input type="checkbox" checked={secondOwner} disabled={!editable || !jointRequired} onChange={async event => {
                        const checked = event.target.checked;
                        if (!checked && !await gf.confirm('두 번째 공동소유자 정보를 지우시겠습니까?')) return;
                        setSecondOwner(checked); if (!checked) setData(previous => ({ ...previous, dsOwnerInfo1: { ...initialOwnerInfo1 } }));
                    }} /> 공동소유자 2명</label>
                    {secondOwner && jointPanel('dsOwnerInfo1', 1)}
                </div>
            </div><ErpSection title="신규등록정보"><div className="w-fields">
                {field('dsNewCar', 'BUY_AMT', '공급가액(VAT별도)')}{field('dsNewCar', 'NTAX_TRGET_CD', '비과세대상', { group: 'NTTCD' })}
                {field('dsNewCar', 'NTAX_WHO', '비과세대상자', { group: 'NTWHO', disabled: car.NTAX_TRGET_CD === '00' })}
                {field('dsNewCar', 'NTAX_TRGET_GR_CD', '비과세대상등급', { group: 'NTTGR', disabled: !gradeTargets.includes(car.NTAX_TRGET_CD) })}
                {field('dsNewCar', 'CARD_YN', '취득세카드납부', { group: 'CARD', options: [{ CODE_ID: 'N', CODE_NM: '아니오' }, { CODE_ID: 'Y', CODE_NM: '예' }] })}
                <ErpField label="카드납부확인" span={3} labelWidth="122px"><input type="checkbox" aria-label="카드납부확인" checked={car.CARD_PAY_YN === 'Y'} disabled /></ErpField>
                {field('dsNewCar', 'BOND_DC', '채권할인여부', { group: 'BOND' })}{field('dsNewCar', 'TOTAL_AMT', '등록비용', { readOnly: true })}
                {field('dsNewCar', 'PAY_NM', '결제자명')}{field('dsNewCar', 'PAY_HP_NO', '결제자 휴대폰번호')}
                {field('dsNewCar', 'RT_BANK_CD', '환급은행', { group: 'BANK' })}{field('dsNewCar', 'RETURN_NO', '환급계좌')}
                {field('dsNewCar', 'RETURN_NM', '환급계좌예금주', { span: 6 })}{field('dsNewCar', 'RT_AMT', '환급금액', { span: 6, readOnly: true })}
            </div>{addressFields('dsNewCar', 'CARP', '등록증 배송지')}</ErpSection></div>
                : <div role="tabpanel" aria-label="결제정보"><ErpSection title="결제 및 납부 정보"><div className="w-fields">
                    {field('dsNewCar', 'PAY_ST', '납부상태', { group: 'PAYST', readOnly: true })}{field('dsNewCar', 'PAY_ME', '납부방법', { group: 'PAYME', readOnly: true })}
                    {field('dsNewCar', 'VBANK_NO', '가상계좌', { readOnly: true })}{field('dsNewCar', 'TOTAL_AMT', '총 금액', { readOnly: true })}
                </div><table className="w-payments"><caption>결제 세부 비용 (조회 전용)</caption><thead><tr><th>항목</th><th>예정 금액</th><th>납부 금액</th></tr></thead>
                    <tbody>{data.dsPaymentList.map(row => <tr key={row.PAY_KD}><th>{payLabels[row.PAY_KD] || row.PAY_KD}</th><td>{Number(row.PRE_PAY_AMT || 0).toLocaleString()}원</td><td>{Number(row.PAY_AMT || 0).toLocaleString()}원</td></tr>)}</tbody></table>
                    <div className="w-bottom-actions"><button type="button" className="btn-erp light" disabled={!service.SERVICE_ID || busy} onClick={() => setModal('receipt')}>납부영수증</button>
                        <button type="button" className="btn-erp light" disabled={!service.SERVICE_ID || car.BOND_LINK_YN !== 'Y' || busy} onClick={() => setModal('bond')}>채권 인쇄</button></div>
                </ErpSection></div>}
            <ErpSection title="추가 정보"><div className="w-fields">
                <ErpField label="저공해차여부" span={3} labelWidth="122px"><input type="checkbox" aria-label="저공해차여부" checked={car.LOW_POLLUTION_YN === 'Y'} disabled /></ErpField>
                {field('dsNewCar', 'LOW_POLLUTION_KD', '저공해발급 종류', { readOnly: true })}{field('dsNewCar', 'LOW_POLLUTION_NO', '저공해발급 번호', { span: 6, readOnly: true })}
                <ErpField label="이메일" span={12} labelWidth="122px">
                    <input className="erp-input" name="CARP_MAIL" data-record="dsNewCar" aria-label="등록증 이메일 아이디" value={(car.CARP_MAIL || '').split('@')[0]} readOnly={!editable}
                        onChange={event => updateEmail(0, event.target.value)} />
                    <span>@</span><input className="erp-input" aria-label="등록증 이메일 도메인" list={domainList} value={(car.CARP_MAIL || '').split('@')[1] || ''} readOnly={!editable}
                        onChange={event => updateEmail(1, event.target.value)} />
                    <datalist id={domainList}>{['naver.com', 'gmail.com', 'daum.net', 'dacos.co.kr'].map(domain => <option key={domain} value={domain} />)}</datalist>
                    <button type="button" className="btn-erp light" disabled={!editable} onClick={() => update('dsNewCar', 'CARP_MAIL', '')}>지우기</button>
                </ErpField>
                <ErpField label="메모" span={12} labelWidth="122px"><textarea className="erp-input w-memo" aria-label="메모" name="MEMO_TX" data-record="dsNewCar" maxLength={2000} value={car.MEMO_TX || ''} readOnly={!editable} onChange={event => update('dsNewCar', 'MEMO_TX', event.target.value)} /></ErpField>
            </div><div className="w-bottom-actions">
                <button type="button" className="btn-erp light" disabled={busy} onClick={showPaper}>등록증 확인</button>
                <button type="button" className="btn-erp light" disabled={busy} onClick={() => setModal('tax')}>세금계산서/현금영수증 정보</button>
                {certificate && <span>저장 대기 제작증: {certificate.name}</span>}
            </div></ErpSection>
        </div>
        {modal === 'pdf' && preview && <div className="w-modal-backdrop"><section className="w-modal" role="dialog" aria-modal="true" aria-labelledby="w-pdf-title">
            <h3 id="w-pdf-title">제작증 반영 내용 확인</h3><p>현재 화면에 반영될 값입니다. 저장·신청 전까지 접수에는 저장되지 않습니다.</p>
            <table className="w-payments"><thead><tr><th>항목</th><th>현재</th><th>제작증</th></tr></thead><tbody>{Object.entries(preview.values).map(([key, value]) => <tr key={key}><th>{fieldLabels[key] || { CAR_NM: '차명', MADE_DT: '최초등록일' }[key] || key}</th><td>{car[key] || '-'}</td><td>{value}</td></tr>)}</tbody></table>
            <div className="w-bottom-actions"><button type="button" className="btn-erp" onClick={() => {
                setData(previous => ({ ...previous, dsNewCar: { ...previous.dsNewCar, ...preview.values } }));
                setCertificate(preview.file); setAutoFields(Object.keys(preview.values)); setPreview(null); setModal('');
                setMessage('제작증을 화면에 반영했습니다. 저장 또는 신청하면 원본 PDF도 함께 저장됩니다.');
            }}>반영</button><button type="button" className="btn-erp light" onClick={() => { setPreview(null); setModal(''); }}>취소</button></div>
        </section></div>}
        {modal === 'tax' && <div className="w-modal-backdrop"><section className="w-modal" role="dialog" aria-modal="true" aria-labelledby="w-tax-title">
            <h3 id="w-tax-title">세금계산서/현금영수증 정보</h3><p>입력한 정보는 신청 화면에서 저장·신청할 때 함께 저장됩니다.</p><div className="w-fields">
                {field('dsTaxReceipt', 'GUBUN', '증빙 종류', { span: 12, group: 'RECEIPT', options: [{ CODE_ID: 'TAX', CODE_NM: '세금계산서' }, { CODE_ID: 'CASH', CODE_NM: '현금영수증' }] })}
                {tax.GUBUN === 'CASH' && <>{field('dsTaxReceipt', 'PHONE_NO', '현금영수증 휴대폰번호', { span: 6 })}{field('dsTaxReceipt', 'REG_NO', '현금영수증 사업자번호', { span: 6 })}</>}
                {tax.GUBUN === 'TAX' && <>
                    {field('dsTaxReceipt', 'REG_NO', '세금계산서 사업자번호', { span: 6 })}{field('dsTaxReceipt', 'COMPANY_NM', '상호명', { span: 6 })}
                    {field('dsTaxReceipt', 'NAME', '대표자명', { span: 6 })}{field('dsTaxReceipt', 'PHONE_NO', '연락처', { span: 6 })}
                    {field('dsTaxReceipt', 'BUSINESS_TYPE', '업태', { span: 6 })}{field('dsTaxReceipt', 'INDUSTRY_TYPE', '업종', { span: 6 })}
                    {field('dsTaxReceipt', 'MAIL1', '세금계산서 이메일', { span: 6 })}{field('dsTaxReceipt', 'MAIL2', '추가 이메일', { span: 6 })}
                </>}
            </div>{tax.GUBUN === 'TAX' && addressFields('dsTaxReceipt', 'TAX', '사업장주소')}
            <button type="button" className="btn-erp light" onClick={() => setModal('')}>닫기</button>
        </section></div>}
        {modal === 'attach' && <WaNewcarAttachModal open dsService={service} dsNewCar={car} dsOwnerInfo={data.dsOwnerInfo} dsCarNoDetach={detach}
            readOnly={!canEditW(service)} allowSms={false}
            dsUserInfo={data.dsUserInfo} setDsCarNoDetach={updater => setData(previous => ({ ...previous, dsCarNoDetach: typeof updater === 'function' ? updater(previous.dsCarNoDetach) : updater }))}
            saveProcess={() => save()} onClose={() => setModal('')} />}
        {modal === 'number' && <NumberPlateModal isOpen dsService={service} dsNewCar={car} dsCarNoDetach={detach} dsUserInfo={data.dsUserInfo}
            carIdNo={car.CARID_NO} taskCd={car.TASK_CD} onClose={() => setModal('')} onSelect={async (success, number) => {
                if (success) {
                    const next = { ...data, dsNewCar: { ...car, REQ_CAR_NO: number } };
                    setData(next); await save('SAVE', next);
                }
                setModal('');
            }} />}
        {modal === 'receipt' && <NewCarReceiptModal dsService={service} dsNewCar={car} dsPaymentList={data.dsPaymentList} dsCompanyInfo={data.dsCompanyInfo} gf={gf} onClose={() => setModal('')} />}
        {modal === 'bond' && <BondReceiptModal dsService={service} dsNewCar={car} dsPaymentList={data.dsPaymentList} dsCompanyInfo={data.dsCompanyInfo} gf={gf} onClose={() => setModal('')} />}
        {modal === 'paper' && <div className="w-modal-backdrop"><section className="w-modal" role="dialog" aria-modal="true" aria-labelledby="w-paper-title">
            <h3 id="w-paper-title">등록증 확인</h3><iframe className="w-paper" title="자동차 등록증 PDF" src={paperUrl} />
            <button type="button" className="btn-erp light" onClick={() => { setModal(''); setPaperUrl(''); }}>닫기</button>
        </section></div>}
        <AddressSearchModal isOpen={Boolean(addressTarget)} onClose={() => setAddressTarget(null)} onSelect={selectAddress} />
    </div>;
};

export default NewcarRequest_W;
