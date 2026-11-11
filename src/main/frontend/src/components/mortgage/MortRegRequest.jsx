import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useTabs } from '../../context/TabContext';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import CommonSelect from '../common/CommonSelect';
import '../newcar/NewcarRequest.css';
import './MortRegRequest.css';

// DaCOS MortRegRequestV32의 입력 항목명을 유지하고 공통코드·조회 결과는 서버에서 적용한다.
const initialMortgage = {
    CAR_NO: '', MORT_REG_GB: 'R', MORT_REG_NO: '', MORT_BIZ_NO: '', MORT_NM: '', BOND_AMT: '', RATIO_NO: '100',
    DSIGN_GB: '', DSIGN_HP_GB: '', DSIGN_HP_NO: '',
    PAY_NM: '', PAY_HP_NO: '', PAY_GB: '', PAY_ME: '', COMPANY_NO: '', WONBU_YN: 'N', PRE_MORT_NM: '0'
};
const initialOwnerInfo = {
    DEBTOR_NM: '', DEBTOR_GB: 'R', REG_NO: '', DEBTOR_RATIO: '', UNION_YN: 'N', BIZ_NO: '',
    DEBTOR_ADDR: '', DEBTOR_ADDR_DT: '', DSIGN_GB: '', DSIGN_HP_GB: '', DSIGN_HP_NO: ''
};

function MortRegRequest() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    // 로그인 DTO 응답은 member_GB·company_ID 형식이며, 기존 대문자 사용자 정보도 함께 읽는다.
    const memberGb = user?.member_GB ?? user?.MEMBER_GB ?? '';
    const companyId = user?.company_ID ?? user?.COMPANY_ID ?? '';
    const memberNm = user?.member_NM ?? user?.MEMBER_NM ?? '';
    const { activeTabId, removeTab, addTab } = useTabs();
    const [dsMortgage, setDsMortgage] = useState(initialMortgage);
    const [dsOwnerInfo, setDsOwnerInfo] = useState(initialOwnerInfo);
    const [activeTab, setActiveTab] = useState('owner');
    const [dsService, setDsService] = useState({});
    const [dsCarBaseInfo, setDsCarBaseInfo] = useState({});
    const [referenceData, setReferenceData] = useState({});
    const [linkToken, setLinkToken] = useState('');
    const [busy, setBusy] = useState(true);
    const [message, setMessage] = useState('');
    const [reloadCount, setReloadCount] = useState(0);
    const serviceId = location.state?.receiptNo || '';
    const detailOpenKey = location.state?.detailOpenKey || '';
    const loadedRequest = useRef('');
    const codes = referenceData.codes || {};
    const workCp = referenceData.workCp || {};
    const history = referenceData.companyHistory || [];
    const isAgency = memberGb.startsWith('R') || companyId.startsWith('CR');
    const company = isAgency ? (history.find(row => row.COMPANY_NO === dsMortgage.COMPANY_NO) || {}) : (referenceData.company || {});
    const codeName = (group, value) => codes[group]?.find(row => row.CODE_ID === value)?.CODE_NM || value || '';
    // 수정권한은 서버가 사용자 업무권한(TM_WORK_MB)으로 판단한다.
    const canEdit = !busy && referenceData.canWrite === true && memberGb !== 'GU'
        && (!dsService.COMPANY_ID || dsService.COMPANY_ID === companyId)
        && ['INPUT', 'SAV'].includes(dsService.PROC_ST || 'INPUT') && !dsService.JUDGE_ST
        && ['', 'WAIT', 'NOT'].includes(dsMortgage.IDEN_ST || '')
        && ['', 'WAIT', 'NOT'].includes(dsMortgage.DSIGN_ST || '')
        && dsMortgage.PAY_ST !== 'Y' && !dsMortgage.VBANK_NO
        && (referenceData.owners || []).length <= 1
        && (referenceData.payments || []).every(row => row.PAY_ST !== 'Y')
        && (referenceData.owners || []).every(row => ['', 'WAIT', 'NOT'].includes(row.IDEN_ST || '') && ['', 'WAIT', 'NOT'].includes(row.DSIGN_ST || ''));

    // 원본 DSIGB의 등록구분·회사 제한을 적용한다. 전자서명 요청 기능은 다음 단계에서 연결한다.
    const signatureOptions = (registration) => (codes.DSIGB || []).filter(code => {
        const scope = String(code.DETAIL_ID || '');
        const companies = String(code.DETAIL_NM || '');
        const corporation = ['B', 'C'].includes(registration);
        if (!(scope.includes(corporation ? 'B' : 'R') || scope.includes(corporation ? 'C' : 'F'))) return false;
        if (!(companies.includes('ALL') || companies.includes(companyId))) return false;
        if (isAgency && code.CODE_ID !== 'POST') return false;
        return !(['CB054', 'CB015', 'CB005', 'CB016', 'CB116'].includes(companyId) && ['REGNO', 'DRIVE'].includes(code.CODE_ID));
    });

    // 초기조회·저장·새로고침에 동일한 서버 응답 구조를 사용한다.
    const applyData = useCallback((data) => {
        setReferenceData(data);
        setDsService(data.service || {});
        setDsMortgage({ ...initialMortgage, ...data.mortgage,
            COMPANY_NO: (data.companyHistory || []).find(row => row.COMPANY_NO === data.mortgage?.COMPANY_ID)?.COMPANY_NO || '' });
        setDsCarBaseInfo(data.carInfo || {});
        setDsOwnerInfo({ ...initialOwnerInfo, ...data.owners?.[0] });
    }, []);

    // 상세 전환 중 이전 요청이 나중 화면을 덮어쓰지 않도록 정리한다.
    useEffect(() => {
        if (location.pathname !== '/mortgage/mort-reg-request') return;
        const requestKey = serviceId + ':' + reloadCount + ':' + detailOpenKey;
        if (loadedRequest.current === requestKey) return;
        let active = true;
        setBusy(true);
        setLinkToken('');
        const url = serviceId ? '/api/mortgage/request/detail/' + encodeURIComponent(serviceId) : '/api/mortgage/request/init';
        axios.get(url).then(response => {
            if (active) { applyData(response.data.data); loadedRequest.current = requestKey; setMessage(''); }
        }).catch(error => {
            if (active) { setReferenceData({ canWrite: false }); setMessage(error.response?.data?.message || '설정등록 정보를 불러오지 못했습니다.'); }
        }).finally(() => { if (active) setBusy(false); });
        return () => { active = false; };
    }, [serviceId, reloadCount, detailOpenKey, location.pathname, applyData]);

    // 신규등록 화면처럼 name과 data-type으로 입력값을 구분한다.
    const handleChange = (e) => {
        const { name, value, dataset, checked, type } = e.target;
        let next = type === 'checkbox' ? (checked ? 'Y' : 'N') : value;
        if (name === 'PRE_MORT_NM') next = checked ? '1' : '0';
        if (name === 'CAR_NO') next = value.replace(/\s/g, '').toUpperCase();
        if (['MORT_REG_NO', 'MORT_BIZ_NO', 'REG_NO', 'BIZ_NO', 'DSIGN_HP_NO', 'PAY_HP_NO'].includes(name)) next = value.replace(/\D/g, '');
        if (dataset.type === 'owner') {
            setDsOwnerInfo(prev => ({ ...prev, [name]: next,
                ...(name === 'DEBTOR_GB' ? { REG_NO: '', DSIGN_GB: '' } : {}) }));
        } else {
            setDsMortgage(prev => ({ ...prev, [name]: next,
                ...(name === 'MORT_REG_GB' ? { MORT_REG_NO: '', MORT_BIZ_NO: '', DSIGN_GB: '' } : {}) }));
            if (['CAR_NO', 'MORT_REG_GB', 'MORT_REG_NO', 'MORT_NM'].includes(name)) {
                setDsCarBaseInfo({}); setLinkToken('');
            }
        }
    };

    // 입력 중인 내용을 버릴 때만 확인한다. 서버의 저장자료는 삭제하지 않는다.
    const handleReset = () => {
        if (!window.confirm('입력한 내용을 초기화하시겠습니까?')) return;
        setActiveTab('owner');
        addTab(activeTabId, '설정등록', '/mortgage/mort-reg-request');
        setReloadCount(count => count + 1);
    };
    const handleClose = () => removeTab(activeTabId);

    // 원본의 등록구분별 길이를 화면과 서버에서 각각 검사한다.
    const registrationError = (kind, value) => {
        const size = kind === 'C' ? 10 : (['B', 'E'].includes(kind) ? 13 : 7);
        return !kind || !new RegExp('^\\d{' + size + '}$').test(value || '') ? '등록구분에 맞는 등록번호 ' + size + '자리를 입력해 주세요.' : '';
    };

    const handleConnect = async () => {
        const error = registrationError(dsMortgage.MORT_REG_GB, dsMortgage.MORT_REG_NO);
        if (!dsMortgage.CAR_NO || error) { setMessage(error || '차량번호를 입력해 주세요.'); return; }
        setBusy(true); setMessage('차량정보를 연계하고 있습니다.');
        setDsCarBaseInfo({}); setLinkToken('');
        try {
            const response = await axios.post('/api/mortgage/request/car-info', dsMortgage);
            const data = response.data.data;
            const car = data.carInfo;
            if (Number(car.MORT_CT) > 0 && !window.confirm('기존 저당이 ' + car.MORT_CT + '건 있습니다. 계속하시겠습니까?')) {
                setMessage('차량 연계를 취소했습니다.'); return;
            }
            setDsCarBaseInfo(car); setLinkToken(data.linkToken);
            if (data.CAR_NO) setDsMortgage(prev => ({ ...prev, CAR_NO: data.CAR_NO }));
            // 공동소유자는 원본처럼 비율 0으로 불러온 뒤 사용자가 확인한다.
            const owner = String(car.OWNER_INFO || '').match(/공동소유자\s*:\s*([^(]+)\([^:]*:\s*([\d*-]+)/);
            if (car.SHARE_YN === 'Y' && owner) {
                setDsOwnerInfo(prev => ({ ...prev, DEBTOR_NM: owner[1].trim(), REG_NO: owner[2].replace(/\D/g, ''),
                    UNION_YN: 'Y', DEBTOR_RATIO: '0' }));
            }
            setMessage(car.message || '차량 연계가 완료되었습니다.');
        } catch (error) { setMessage(error.response?.data?.message || '차량 연계에 실패했습니다.'); }
        finally { setBusy(false); }
    };

    // 채권가액 변경 시 미리보기만 계산한다. 실제 저장금액은 서버에서 다시 계산한다.
    const taxAmount = (kind) => {
        const tax = referenceData.tax || {};
        const minimum = Number(tax[kind + '_AMT'] || 0);
        const amount = tax[kind + '_BASE'] === kind + '_PER'
            ? Math.max(minimum, Number(dsMortgage.BOND_AMT || 0) * Number(tax[kind + '_PER'] || 0)) : minimum;
        return Math.floor(amount / 10) * 10;
    };
    const previewPayments = [
        { PAY_KD: 'FEE', PAY_AMT: Number(workCp.FEE || 0), PAY_ST: 'N' },
        { PAY_KD: 'REGIS', PAY_AMT: taxAmount('REGIST'), PAY_ST: 'N' },
        { PAY_KD: 'STAMP', PAY_AMT: taxAmount('STAMP'), PAY_ST: 'N' }
    ];
    const paymentRows = canEdit ? previewPayments : (referenceData.payments || []);
    const total = canEdit ? previewPayments.reduce((sum, row) => sum + (row.PAY_KD === 'FEE' && dsMortgage.PAY_TP === 'MON' ? 0 : row.PAY_AMT), 0) : Number(dsMortgage.TOTAL_AMT || 0);

    const handleSave = async () => {
        let error = registrationError(dsMortgage.MORT_REG_GB, dsMortgage.MORT_REG_NO);
        if (!dsMortgage.CAR_NO || !dsMortgage.MORT_NM) error = '차량번호와 저당권 설정자명을 입력해 주세요.';
        if (dsMortgage.BOND_AMT === '' || !Number.isInteger(Number(dsMortgage.BOND_AMT)) || Number(dsMortgage.BOND_AMT) < 0) error = '채권가액을 원 단위로 입력해 주세요.';
        if (dsMortgage.RATIO_NO === '' || Number(dsMortgage.RATIO_NO) < 0 || Number(dsMortgage.RATIO_NO) > 100) error = '채무비율은 0~100으로 입력해 주세요.';
        if (!dsMortgage.DSIGN_GB || !dsMortgage.PAY_ME) error = '전자적 확인방법과 납부방법을 선택해 주세요.';
        if (!['POST', 'POSTI', 'INPUT', 'SNODT'].includes(dsMortgage.DSIGN_GB) && !(memberGb === 'SU' && dsMortgage.DSIGN_GB === 'NPKI') && !dsMortgage.DSIGN_HP_NO) error = '전자적 확인에 사용할 휴대전화번호를 입력해 주세요.';
        if (error) { setMessage(error); return; }
        setBusy(true); setMessage('');
        try {
            const response = await axios.post('/api/mortgage/request/save', {
                service: { ...dsService, PROC_ST: 'SAV' }, mortgage: dsMortgage, linkToken,
                owners: dsOwnerInfo.DEBTOR_NM || dsOwnerInfo.REG_NO ? [dsOwnerInfo] : []
            });
            applyData(response.data.data);
            addTab(activeTabId, '설정등록', '/mortgage/mort-reg-request', { state: { receiptNo: response.data.data.service.SERVICE_ID } });
            setMessage('저장되었습니다.');
        } catch (error) { setMessage(error.response?.data?.message || '저장하지 못했습니다.'); }
        finally { setBusy(false); }
    };

    return (
        <div className="new-reg-container mort-reg-request">
            {/* 상단 업무 버튼: 조회·저장만 연결하며 신청·삭제는 다음 단계에서 연결한다. */}
            <div className="erp-toolbar">
                <div className="toolbar-left">
                    <span className="toolbar-title">설정등록</span>
                    <button className="btn-erp" onClick={() => navigate('/mortgage/mort-reg-list')}>목록</button>
                </div>
                <div className="toolbar-right">
                    <button className="btn-erp" disabled>신청</button>
                    <button className="btn-erp" onClick={handleSave} disabled={!canEdit}>저장</button>
                    <button className="btn-erp" onClick={() => setReloadCount(count => count + 1)} disabled={busy}>새로고침</button>
                    <button className="btn-erp" disabled>삭제</button>
                    <button className="btn-erp" onClick={handleReset} disabled={busy}>초기화</button>
                    <button className="btn-erp" onClick={handleClose}>닫기</button>
                </div>
            </div>

            <div className="mort-reg-body">
                <p className="mort-reg-notice">설정등록 저장까지 가능합니다. 신청·본인확인·전자서명·결제 요청은 다음 단계에서 연결됩니다.</p>
                {!busy && referenceData.canWrite === false && <p className="mort-reg-notice">설정등록 저장 권한이 없습니다. 사용자 업무권한을 확인해 주세요.</p>}
                {message && <p className="mort-reg-message" role="status">{message}</p>}
                {busy && <p role="status" className="mort-reg-notice">처리 중입니다.</p>}

                {/* 신청정보: 접수번호, 날짜, 처리상태는 서버 조회 결과로 표시할 항목이다. */}
                <ErpSection isHeader>
                    <div className="erp-row">
                        <ErpField label="신청구분" span={3}><input aria-label="신청구분" className="erp-input" value="저당설정" readOnly /></ErpField>
                        <ErpField label="접수번호" span={3}><input aria-label="접수번호" className="erp-input" value={dsService.SERVICE_ID || ''} readOnly /></ErpField>
                        <ErpField label="신청자명" span={3}><input aria-label="신청자명" className="erp-input" value={dsService.MEMBER_NM || memberNm} readOnly /></ErpField>
                        <ErpField label="신청일자" span={3}><input aria-label="신청일자" className="erp-input" value={dsService.REQUEST_DT || ''} readOnly /></ErpField>
                    </div>
                    <div className="erp-row">
                        <ErpField label="신청상태" span={3}><CommonSelect aria-label="신청상태" codes={codes} groupId="PR_ST" value={dsService.PROC_ST || ''} disabled /></ErpField>
                        <ErpField label="심사일자" span={3}><input aria-label="심사일자" className="erp-input" value={dsService.JUDGE_DT || ''} readOnly /></ErpField>
                        <ErpField label="심사상태" span={3}><CommonSelect aria-label="심사상태" codes={codes} groupId="JG_ST" value={dsService.JUDGE_ST || ''} disabled /></ErpField>
                    </div>
                    <div className="erp-row">
                        <ErpField label="반려사유" span={12}><input aria-label="반려사유" className="erp-input" value={dsService.RETURN_TX || ''} readOnly /></ErpField>
                    </div>
                </ErpSection>

                {/* 저당권자 정보: 회사 상세조회 결과의 등록번호와 사업자번호를 표시한다. */}
                <ErpSection title="저당권자 정보">
                    {isAgency && <div className="erp-row"><ErpField label="저당권자 선택" span={12}>
                        <CommonSelect aria-label="저당권자 선택" options={history} valueField="COMPANY_NO" labelField="COMPANY_NM" name="COMPANY_NO" value={dsMortgage.COMPANY_NO} onChange={handleChange} disabled={!canEdit} />
                    </ErpField></div>}
                    <div className="erp-row">
                        <ErpField label="성명(상호)" span={4}><input aria-label="저당권자 성명(상호)" className="erp-input" value={company.COMPANY_NM || ''} readOnly /></ErpField>
                        <ErpField label="등록번호" span={4}><input aria-label="저당권자 등록번호" className="erp-input" value={company.COMPANY_NO || ''} readOnly /></ErpField>
                        <ErpField label="사업자번호" span={4}><input aria-label="저당권자 사업자번호" className="erp-input" value={company.BIZ_NO || ''} readOnly /></ErpField>
                    </div>
                </ErpSection>

                {/* 저당 입력정보와 원부 연계 결과. 조회 전에는 차량정보를 임의로 채우지 않는다. */}
                <ErpSection title="저당정보" titleExtra={<button className="btn-erp sm light" disabled>첨부서류</button>}>
                    <div className="erp-row">
                        <ErpField label="차량번호" required span={4}>
                            <input aria-label="차량번호" className="erp-input" name="CAR_NO" value={dsMortgage.CAR_NO} onChange={handleChange} disabled={!canEdit} />
                            <button className="btn-erp sm light" onClick={handleConnect} disabled={!canEdit}>연계</button>
                        </ErpField>
                        <ErpField label="등록구분" required span={4}>
                            <CommonSelect aria-label="등록구분" codes={codes} groupId="REGGB" name="MORT_REG_GB" value={dsMortgage.MORT_REG_GB} onChange={handleChange} disabled={!canEdit} />
                        </ErpField>
                        <ErpField label="등록번호" required span={4}>
                            <input aria-label="설정자 등록번호" className="erp-input" name="MORT_REG_NO" maxLength={dsMortgage.MORT_REG_GB === 'C' ? 10 : (['B', 'E'].includes(dsMortgage.MORT_REG_GB) ? 13 : 7)} value={dsMortgage.MORT_REG_NO} onChange={handleChange} disabled={!canEdit} />
                        </ErpField>
                    </div>
                    <div className="erp-row">
                        <ErpField label="저당권 설정자명" required span={4}>
                            <input aria-label="저당권 설정자명" className="erp-input" name="MORT_NM" value={dsMortgage.MORT_NM} onChange={handleChange} disabled={!canEdit} />
                        </ErpField>
                        <ErpField label="채권가액(최고액)" required span={4} labelWidth="120px">
                            <input aria-label="채권가액" type="number" min="0" step="1" className="erp-input text-right" name="BOND_AMT" value={dsMortgage.BOND_AMT} onChange={handleChange} disabled={!canEdit} /><span className="mort-reg-unit">원</span>
                        </ErpField>
                        <ErpField label="채무비율" span={4}>
                            <input aria-label="채무비율" type="number" min="0" max="100" step="0.01" className="erp-input text-right" name="RATIO_NO" value={dsMortgage.RATIO_NO} onChange={handleChange} disabled={!canEdit} /><span className="mort-reg-unit">%</span>
                        </ErpField>
                    </div>
                    <div className="mort-reg-table-wrap">
                        <table className="mort-reg-table" aria-label="차량정보">
                            <thead><tr><th scope="col">차대번호</th><th scope="col">차명</th><th scope="col">차종</th><th scope="col">용도</th><th scope="col">저당건수</th><th scope="col">압류건수</th><th scope="col">공동소유</th><th scope="col">모델연도</th><th scope="col">최초등록일</th></tr></thead>
                            <tbody>{dsCarBaseInfo.CARID_NO ? <tr>
                                <td>{dsCarBaseInfo.CARID_NO}</td><td>{dsCarBaseInfo.CAR_NM}</td><td>{dsCarBaseInfo.CAR_KD}</td><td>{codeName('CARUS', dsCarBaseInfo.CAR_US)}</td>
                                <td>{dsCarBaseInfo.MORT_CT}</td><td>{dsCarBaseInfo.DIST_CT}</td><td>{dsCarBaseInfo.SHARE_YN === 'Y' ? '공동소유' : '단독소유'}</td><td>{dsCarBaseInfo.CAR_YY}</td><td>{dsCarBaseInfo.CARREG_DT}</td>
                            </tr> : <tr><td colSpan={9} className="mort-reg-empty">차량 연계 후 차량정보가 표시됩니다.</td></tr>}</tbody>
                        </table>
                    </div>
                </ErpSection>

                {/* 법인 사업자번호와 원본 추가설정·원부파일 옵션도 저장한다. */}
                <ErpSection>
                    <div className="erp-row">
                        {dsMortgage.MORT_REG_GB === 'B' && <ErpField label="설정자 사업자번호" span={4} labelWidth="120px"><input aria-label="설정자 사업자번호" className="erp-input" name="MORT_BIZ_NO" maxLength={10} value={dsMortgage.MORT_BIZ_NO} onChange={handleChange} disabled={!canEdit} /></ErpField>}
                        <ErpField label="추가설정요청" span={4}><input aria-label="추가설정요청" type="checkbox" name="PRE_MORT_NM" checked={dsMortgage.PRE_MORT_NM === '1'} onChange={handleChange} disabled={!canEdit} /></ErpField>
                        <ErpField label="원부파일 생성" span={4}><input aria-label="원부파일 생성" type="checkbox" name="WONBU_YN" checked={dsMortgage.WONBU_YN === 'Y'} onChange={handleChange} disabled={!canEdit} /></ErpField>
                    </div>
                </ErpSection>

                {/* 원본의 소유자 전자서명 / 전자서명 추가 탭을 구성한다. */}
                <div className="tab-container mort-reg-signature">
                    <div className="tab-header-list">
                        <div className="tab-button-group" role="tablist" aria-label="전자서명 구분">
                            <button id="mort-owner-tab" role="tab" aria-selected={activeTab === 'owner'} aria-controls="mort-signature-panel" className={`tab-btn ${activeTab === 'owner' ? 'active' : ''}`} onClick={() => setActiveTab('owner')}>소유자 전자서명</button>
                            <button id="mort-debtor-tab" role="tab" aria-selected={activeTab === 'debtor'} aria-controls="mort-signature-panel" className={`tab-btn ${activeTab === 'debtor' ? 'active' : ''}`} onClick={() => setActiveTab('debtor')}>전자서명 추가</button>
                        </div>
                    </div>
                    <div id="mort-signature-panel" role="tabpanel" aria-labelledby={activeTab === 'owner' ? 'mort-owner-tab' : 'mort-debtor-tab'} className="tab-content">
                        {activeTab === 'owner' ? (
                            <ErpSection title="저당권 설정자 전자서명" titleExtra={<><button className="btn-erp sm light" disabled>본인확인</button><button className="btn-erp sm light" disabled>전자서명</button><button className="btn-erp sm light" disabled>새로고침</button><button className="btn-erp sm light" disabled>결과확인</button></>}>
                                <div className="erp-row">
                                    <ErpField label="전자적 확인방법" required span={4} labelWidth="120px"><CommonSelect aria-label="소유자 전자적 확인방법" options={signatureOptions(dsMortgage.MORT_REG_GB)} name="DSIGN_GB" value={dsMortgage.DSIGN_GB} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="휴대전화 구분" span={4}><CommonSelect aria-label="소유자 휴대전화 구분" codes={codes} groupId="DHPGB" name="DSIGN_HP_GB" value={dsMortgage.DSIGN_HP_GB} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="휴대전화" span={4}><input aria-label="소유자 휴대전화" type="tel" className="erp-input" name="DSIGN_HP_NO" value={dsMortgage.DSIGN_HP_NO} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="본인확인상태" span={4}><CommonSelect aria-label="본인확인상태" codes={codes} groupId="IDEST" value={dsMortgage.IDEN_ST || ''} disabled /></ErpField>
                                    <ErpField label="전자서명상태" span={4}><CommonSelect aria-label="전자서명상태" codes={codes} groupId="DSIST" value={dsMortgage.DSIGN_ST || ''} disabled /></ErpField>
                                    <ErpField label="확인번호" span={4}><input aria-label="확인번호" className="erp-input" name="CONFIRM_NO" value={dsMortgage.CONFIRM_NO || ''} onChange={handleChange} disabled={!canEdit} readOnly={!canEdit || !['INPUT', 'SNODT'].includes(dsMortgage.DSIGN_GB)} /></ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="확인날짜" span={4}><input aria-label="확인날짜" className="erp-input" value={dsMortgage.IDEN_DT || ''} readOnly /></ErpField>
                                    <ErpField label="서명날짜" span={4}><input aria-label="서명날짜" className="erp-input" value={dsMortgage.DSIGN_DT || ''} readOnly /></ErpField>
                                    <ErpField label="응답내용" span={4}><input aria-label="응답내용" className="erp-input" value={dsMortgage.CONFIRM_NO || ''} readOnly /></ErpField>
                                </div>
                            </ErpSection>
                        ) : (
                            <ErpSection title="추가 채무자 정보">
                                <div className="erp-row">
                                    <ErpField label="소유 구분" span={4}><CommonSelect aria-label="소유 구분" codes={codes} groupId="SGB" name="UNION_YN" data-type="owner" value={dsOwnerInfo.UNION_YN} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="등록구분" span={4}><CommonSelect aria-label="추가 채무자 등록구분" codes={codes} groupId="REGGB" name="DEBTOR_GB" data-type="owner" value={dsOwnerInfo.DEBTOR_GB} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="통신사" span={4}><CommonSelect aria-label="추가 채무자 통신사" codes={codes} groupId="DHPGB" name="DSIGN_HP_GB" data-type="owner" value={dsOwnerInfo.DSIGN_HP_GB} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                </div>
                                {dsOwnerInfo.DEBTOR_GB === 'B' && <div className="erp-row"><ErpField label="사업자번호" span={4}><input aria-label="추가 채무자 사업자번호" name="BIZ_NO" data-type="owner" className="erp-input" value={dsOwnerInfo.BIZ_NO} onChange={handleChange} disabled={!canEdit} /></ErpField></div>}
                                {/* 추가 채무자 입력은 저장에 포함하며, 전자서명 요청은 다음 단계에서 연결한다. */}
                                <div className="erp-row">
                                    <ErpField label="채무자명" span={4}><input aria-label="추가 채무자명" className="erp-input" data-type="owner" name="DEBTOR_NM" value={dsOwnerInfo.DEBTOR_NM} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="등록번호" span={4}><input aria-label="추가 채무자 등록번호" className="erp-input" data-type="owner" name="REG_NO" value={dsOwnerInfo.REG_NO} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="채무비율" span={4}><input aria-label="추가 채무비율" type="number" min="0" max="100" step="0.01" className="erp-input" data-type="owner" name="DEBTOR_RATIO" value={dsOwnerInfo.DEBTOR_RATIO} onChange={handleChange} disabled={!canEdit} /><span className="mort-reg-unit">%</span></ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="주소" span={8}><input aria-label="추가 채무자 주소" className="erp-input" data-type="owner" name="DEBTOR_ADDR" value={dsOwnerInfo.DEBTOR_ADDR} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="상세주소" span={4}><input aria-label="추가 채무자 상세주소" className="erp-input" data-type="owner" name="DEBTOR_ADDR_DT" value={dsOwnerInfo.DEBTOR_ADDR_DT} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                </div>
                                <div className="erp-row">
                                    <ErpField label="전자적 확인방법" span={4} labelWidth="120px"><CommonSelect aria-label="추가 채무자 전자적 확인방법" options={signatureOptions(dsOwnerInfo.DEBTOR_GB)} name="DSIGN_GB" value={dsOwnerInfo.DSIGN_GB} data-type="owner" onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="휴대전화" span={4}><input aria-label="추가 채무자 휴대전화" type="tel" className="erp-input" data-type="owner" name="DSIGN_HP_NO" value={dsOwnerInfo.DSIGN_HP_NO} onChange={handleChange} disabled={!canEdit} /></ErpField>
                                    <ErpField label="전자서명상태" span={4}><CommonSelect aria-label="추가 채무자 전자서명상태" codes={codes} groupId="DSIST" value={dsOwnerInfo.DSIGN_ST || ''} disabled /></ErpField>
                                </div>
                            </ErpSection>
                        )}
                    </div>
                </div>

                {/* 결제정보: 결제금액과 납부내역은 서버 계산 결과를 사용한다. */}
                <ErpSection title="결제정보" titleExtra={<button className="btn-erp sm light" disabled>납부영수증</button>}>
                    <div className="erp-row">
                        <ErpField label="결제자명" span={4}><input aria-label="결제자명" className="erp-input" name="PAY_NM" value={dsMortgage.PAY_NM} onChange={handleChange} disabled={!canEdit} /></ErpField>
                        <ErpField label="휴대폰번호" span={4}><input aria-label="결제자 휴대폰번호" type="tel" className="erp-input" name="PAY_HP_NO" value={dsMortgage.PAY_HP_NO} onChange={handleChange} disabled={!canEdit} /><button className="btn-erp sm light" disabled>SMS발송</button></ErpField>
                        <ErpField label="납부상태" span={4}><CommonSelect aria-label="납부상태" codes={codes} groupId="PAYST" value={dsMortgage.PAY_ST || ''} disabled /></ErpField>
                    </div>
                    <div className="erp-row">
                        <ErpField label="납부방법" span={4}><CommonSelect aria-label="납부방법" options={(codes.PAYME || []).filter(row => row.CODE_ID !== 'P' || ['A', 'B'].includes(workCp.POINT_COMMON_USE))} name="PAY_ME" value={dsMortgage.PAY_ME} onChange={handleChange} disabled={!canEdit} /></ErpField>
                        <ErpField label="가상계좌" span={4}><CommonSelect aria-label="가상계좌 은행" codes={codes} groupId="BANK" value={dsMortgage.VBANK_CD || ''} disabled /><input aria-label="가상계좌" className="erp-input" value={dsMortgage.VBANK_NO || ''} readOnly /></ErpField>
                        <ErpField label="총 금액" span={4}><input aria-label="총 금액" className="erp-input text-right" value={total.toLocaleString()} readOnly /><span className="mort-reg-unit">원</span></ErpField>
                    </div>
                    <div className="mort-reg-table-wrap">
                        <table className="mort-reg-table" aria-label="납부내역">
                            <thead><tr><th scope="col">결제종류</th><th scope="col">전자납부번호(가상계좌번호)</th><th scope="col">결제여부</th><th scope="col">결제금액</th><th scope="col">결제상태</th><th scope="col">결제일시</th></tr></thead>
                            <tbody>{paymentRows.map(row => <tr key={row.PAY_KD}><td>{codeName('PAYKD', row.PAY_KD)}</td><td>{row.VBANK_NO || ''}</td><td>{codeName('PAYOP', row.PAY_OP)}</td><td>{Number(row.PAY_AMT || 0).toLocaleString()}</td><td>{codeName('PAYST', row.PAY_ST)}</td><td>{row.PAY_DT || ''}</td></tr>)}</tbody>
                        </table>
                    </div>
                </ErpSection>
            </div>
        </div>
    );
}

export default MortRegRequest;
