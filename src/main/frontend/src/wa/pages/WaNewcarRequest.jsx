import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertCircle, CalendarDays, CarFront, CheckCircle2, FileText, LoaderCircle, Save, UserRound } from 'lucide-react';
import {
    initialDsCarNoDetach,
    initialDsNewCar,
    initialDsPaymentList,
    initialDsService,
    initialOwnerInfo,
    initialOwnerInfo1
} from '../../components/newcar/newcarInitial';
import '../styles/wa.css';

const DELIVERY_OPTIONS = [
    { value: 'INPUT', label: '직접 입력' },
    { value: 'HANAM', label: '하남' },
    { value: 'JEJU', label: '제주' },
    { value: 'SUWON', label: '수원' },
    { value: 'SEOUL', label: '서울' },
    { value: 'DAEGU', label: '대구' },
    { value: 'BUSAN', label: '부산' },
    { value: 'DAEJE', label: '대전' },
    { value: 'GWANG', label: '광주' },
    { value: 'ILSAN', label: '일산' }
];

const TASK_OPTIONS = [
    { value: 'NORML', label: '일반' },
    { value: 'LEASE', label: '리스' }
];

const REG_GB_OPTIONS = [
    { value: 'B', label: '법인' },
    { value: 'R', label: '개인' }
];

const NUMPLATE_OPTIONS = [
    { value: '7', label: '전기 번호판', amount: 31400 },
    { value: 'F', label: '필름 번호판', amount: 28600 },
    { value: 'NOT', label: '번호판 미신청', amount: 0 }
];

const PAY_OPTIONS = [
    { value: 'B', label: '가상계좌' },
    { value: 'A', label: '직접납부' }
];

const OWNER_TYPE_OPTIONS = [
    { value: 'PERSONAL', label: '개인', regGb: 'R', taskCd: 'NORML' },
    { value: 'CORPORATE', label: '법인', regGb: 'B', taskCd: 'NORML' },
    { value: 'LEASE', label: '리스', regGb: 'B', taskCd: 'LEASE' },
    { value: 'USER_LEASE', label: '이용자명의 리스', regGb: 'R', taskCd: 'LEASE' }
];

const REQUEST_STEPS = [
    '소유자 정보 입력',
    '자동차 정보 입력',
    '신규등록 정보 입력',
    '최종 확인'
];

const EMPTY_FORM = {
    linkId: '',
    taskCd: 'NORML',
    deliveryGb: 'INPUT',
    carIdNo: '',
    regGb: 'R',
    regNo: '',
    ownerNm: '',
    mphoneNo: '',
    address: '',
    baseAddress: '',
    sameBaseAddress: true,
    carName: '',
    madeDate: '',
    registDate: '',
    buyAmt: '',
    numplateGb: '7',
    payGb: 'B',
    memo: ''
};

const onlyNumber = (value) => String(value || '').replace(/\D/g, '');
const trimValue = (value) => String(value || '').trim();
const toYmd = (value) => onlyNumber(value).slice(0, 8);

const formatAmount = (value) => {
    const number = Number(onlyNumber(value));
    return number ? number.toLocaleString() : '';
};

const getNumplateAmount = (numplateGb) => (
    NUMPLATE_OPTIONS.find(option => option.value === numplateGb)?.amount || 0
);

const normalizePaymentList = (paymentList, numplateGb) => {
    const baseList = Array.isArray(paymentList) && paymentList.length > 0
        ? paymentList
        : initialDsPaymentList;
    const numplateAmount = getNumplateAmount(numplateGb);

    return baseList.map(row => (
        row.PAY_KD === 'TNUM'
            ? { ...row, PRE_PAY_AMT: numplateAmount, PAY_AMT: numplateAmount }
            : { ...row }
    ));
};

const mergeFilled = (base, data) => {
    const merged = { ...base };

    Object.entries(data || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            merged[key] = value;
        }
    });

    return merged;
};

const validateForm = (form) => {
    if (trimValue(form.carIdNo).length !== 17) return '차대번호 17자리를 입력해주세요.';
    if (!trimValue(form.ownerNm)) return '소유자명을 입력해주세요.';
    if (!onlyNumber(form.regNo)) return '등록번호를 입력해주세요.';
    if (!onlyNumber(form.mphoneNo)) return '연락처를 입력해주세요.';
    if (!trimValue(form.address)) return '소유자 주소를 입력해주세요.';
    if (!onlyNumber(form.buyAmt)) return '공급가액을 입력해주세요.';
    return '';
};

const WaNewcarRequest = () => {
    const [form, setForm] = useState(EMPTY_FORM);
    const [ownerType, setOwnerType] = useState('PERSONAL');
    const [initData, setInitData] = useState(null);
    const [serviceId, setServiceId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;

        const loadInit = async () => {
            try {
                setLoading(true);
                const res = await axios.get('/api/newcar/init', { withCredentials: true });
                if (!mounted) return;

                if (res.data?.success) {
                    setInitData(res.data.data || {});
                    setError('');
                } else {
                    setError(res.data?.message || '초기 데이터를 불러오지 못했습니다.');
                }
            } catch (err) {
                if (!mounted) return;
                setError(err.response?.data?.message || '초기 데이터를 불러오지 못했습니다.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadInit();

        return () => {
            mounted = false;
        };
    }, []);

    const numplateAmount = useMemo(() => getNumplateAmount(form.numplateGb), [form.numplateGb]);
    const buyAmountLabel = useMemo(() => formatAmount(form.buyAmt), [form.buyAmt]);

    const requestSummary = useMemo(() => ([
        { label: '주문번호', value: trimValue(form.linkId) || '-', Icon: FileText },
        { label: '차대번호', value: trimValue(form.carIdNo).toUpperCase() || '-', Icon: CarFront },
        { label: '계약자명', value: trimValue(form.ownerNm) || '-', Icon: UserRound },
        { label: '등록 예정일', value: form.registDate || '-', Icon: CalendarDays }
    ]), [form.carIdNo, form.linkId, form.ownerNm, form.registDate]);

    const updateForm = (name, value) => {
        setForm(prev => {
            const next = { ...prev, [name]: value };

            if (name === 'address' && prev.sameBaseAddress) {
                next.baseAddress = value;
            }

            if (name === 'sameBaseAddress') {
                next.baseAddress = value ? prev.address : prev.baseAddress;
            }

            return next;
        });
    };

    const handleOwnerTypeSelect = (option) => {
        setOwnerType(option.value);
        setForm(prev => ({
            ...prev,
            regGb: option.regGb,
            taskCd: option.taskCd
        }));
    };

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        const nextValue = type === 'checkbox' ? checked : value;
        updateForm(name, nextValue);
    };

    const buildPayload = () => {
        const dsService = mergeFilled(initialDsService, initData?.dsService || {});
        const dsNewCar = mergeFilled(initialDsNewCar, initData?.dsNewCar || {});
        const dsOwnerInfo = mergeFilled(initialOwnerInfo, initData?.dsOwnerInfo || {});
        const dsOwnerInfo1 = mergeFilled(initialOwnerInfo1, initData?.dsOwnerInfo1 || {});
        const dsCarNoDetach = mergeFilled(initialDsCarNoDetach, initData?.dsCarNoDetach || {});
        const regNo = onlyNumber(form.regNo);
        const phoneNo = onlyNumber(form.mphoneNo);
        const address = trimValue(form.address);
        const baseAddress = form.sameBaseAddress ? address : trimValue(form.baseAddress);

        const nextNewCar = {
            ...dsNewCar,
            PROC_CD: 'I',
            TASK_CD: form.taskCd,
            CARID_NO: trimValue(form.carIdNo).toUpperCase(),
            REG_GB: form.regGb,
            REG_NO: regNo,
            OWNER_NM: trimValue(form.ownerNm),
            MPHONE_NO: phoneNo,
            ADDRESS: address,
            BASE_ADDRESS: baseAddress,
            CAR_NM: trimValue(form.carName),
            MADE_DT: toYmd(form.madeDate),
            MADE_YY: toYmd(form.madeDate).slice(0, 4),
            REGIST_DATE: toYmd(form.registDate),
            BUY_AMT: onlyNumber(form.buyAmt),
            NUMPLATE_GB: form.numplateGb,
            IMSINUM_YN: 'N',
            PAY_GB: form.payGb,
            PAY_ME: form.payGb,
            PAY_ST: 'N',
            CARD_YN: 'N',
            BOND_YN: 'N',
            RATIO_NO: '100',
            FUEL_CD: 'e',
            CAR_US: '2',
            STAMP_GB: 'TOTAL',
            NTAX_TRGET_GR_CD: '0',
            NTAX_APPLC_CD: '0',
            NTAX_WHO: 'REPRE',
            MEMO_TX: trimValue(form.memo)
        };

        return {
            dsService: {
                ...dsService,
                SERVICE_ID: serviceId || dsService.SERVICE_ID || '',
                WORK_CD: '010',
                PROC_ST: 'SAV',
                JUDGE_ST: dsService.JUDGE_ST || '',
                LINK_ID: trimValue(form.linkId)
            },
            dsNewCar: nextNewCar,
            dsOwnerInfo: {
                ...dsOwnerInfo,
                SEQ: 0,
                DEBTOR_GB: form.regGb,
                DEBTOR_NM: trimValue(form.ownerNm),
                DEBTOR_REG_NO: regNo,
                DEBTOR_RATIO: '100',
                DEBTOR_TEL_NO: phoneNo,
                DEBTOR_MPHONE_NO: phoneNo,
                DEBTOR_ADDR: address
            },
            dsOwnerInfo1,
            dsCarNoDetach: {
                ...dsCarNoDetach,
                WORK_CD: '010',
                NUMPLATE_GB: form.numplateGb,
                DELIVERY_GB: form.deliveryGb,
                CUSTOMER_NM: trimValue(form.ownerNm),
                STATUS_SMS_NO: phoneNo
            },
            dsPaymentList: normalizePaymentList(initData?.dsPaymentList, form.numplateGb)
        };
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');

        const validationMessage = validateForm(form);
        if (validationMessage) {
            setError(validationMessage);
            return;
        }

        try {
            setSaving(true);
            const res = await axios.post('/api/newcar/process', buildPayload());
            const result = res.data?.data || {};
            const isError = Number(result.RESULT_CD || 0) < 0;

            if (res.data?.success && !isError) {
                const nextServiceId = result.SERVICE_ID || serviceId;
                setServiceId(nextServiceId);
                setMessage(nextServiceId ? `저장되었습니다. 접수번호 ${nextServiceId}` : '저장되었습니다.');
                return;
            }

            setError(result.MESSAGE || res.data?.message || '저장에 실패했습니다.');
        } catch (err) {
            setError(err.response?.data?.message || '저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="wa-loading">
                <LoaderCircle size={24} className="wa-spin" />
                <span>불러오는 중</span>
            </div>
        );
    }

    return (
        <div className="wa-request-page">
            <form className="wa-request-card" onSubmit={handleSubmit}>
                <ol className="wa-stepper" aria-label="신차등록 신청 단계">
                    {REQUEST_STEPS.map((step, index) => (
                        <li key={step} className={index === 0 ? 'active' : ''}>
                            <span>{index + 1}</span>
                            <strong>{step}</strong>
                        </li>
                    ))}
                </ol>

                <section className="wa-request-summary" aria-label="신청 요약 정보">
                    {requestSummary.map(({ label, value, Icon }) => (
                        <div key={label} className="wa-request-summary-item">
                            <span className="wa-summary-icon"><Icon size={16} /></span>
                            <div>
                                <p>{label}</p>
                                <strong>{value}</strong>
                            </div>
                        </div>
                    ))}
                </section>

                <header className="wa-request-title">
                    <h1>소유자 정보</h1>
                    {serviceId && <span className="wa-service-badge">접수번호 {serviceId}</span>}
                </header>

                <div className="wa-owner-tabs" role="tablist" aria-label="소유자 유형">
                    {OWNER_TYPE_OPTIONS.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            className={ownerType === option.value ? 'active' : ''}
                            onClick={() => handleOwnerTypeSelect(option)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="wa-alert error">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}
                {message && (
                    <div className="wa-alert success">
                        <CheckCircle2 size={18} />
                        <span>{message}</span>
                    </div>
                )}

                <div className="wa-request-form-body">
                    <section className="wa-section">
                        <div className="wa-section-title">
                            <h2>접수 정보</h2>
                        </div>
                        <div className="wa-field-grid compact">
                            <label className="wa-field">
                                <span>주문번호</span>
                                <input name="linkId" value={form.linkId} onChange={handleChange} maxLength={30} />
                            </label>
                            <label className="wa-field">
                                <span>업무구분</span>
                                <select name="taskCd" value={form.taskCd} onChange={handleChange}>
                                    {TASK_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="wa-field">
                                <span>배송지</span>
                                <select name="deliveryGb" value={form.deliveryGb} onChange={handleChange}>
                                    {DELIVERY_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </section>

                    <section className="wa-section">
                        <div className="wa-section-title">
                            <h2>소유자 정보</h2>
                        </div>
                        <div className="wa-field-grid">
                            <label className="wa-field">
                                <span>등록구분</span>
                                <select name="regGb" value={form.regGb} onChange={handleChange}>
                                    {REG_GB_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="wa-field">
                                <span>등록번호</span>
                                <input
                                    name="regNo"
                                    value={form.regNo}
                                    onChange={(event) => updateForm('regNo', onlyNumber(event.target.value).slice(0, 13))}
                                    inputMode="numeric"
                                    required
                                />
                            </label>
                            <label className="wa-field">
                                <span>소유자명</span>
                                <input name="ownerNm" value={form.ownerNm} onChange={handleChange} required />
                            </label>
                            <label className="wa-field">
                                <span>연락처</span>
                                <input
                                    name="mphoneNo"
                                    value={form.mphoneNo}
                                    onChange={(event) => updateForm('mphoneNo', onlyNumber(event.target.value).slice(0, 11))}
                                    inputMode="numeric"
                                    required
                                />
                            </label>
                            <label className="wa-field full">
                                <span>소유자 주소</span>
                                <input name="address" value={form.address} onChange={handleChange} required />
                            </label>
                            <label className="wa-check-field">
                                <input
                                    type="checkbox"
                                    name="sameBaseAddress"
                                    checked={form.sameBaseAddress}
                                    onChange={handleChange}
                                />
                                <span>사용본거지 동일</span>
                            </label>
                            {!form.sameBaseAddress && (
                                <label className="wa-field full">
                                    <span>사용본거지 주소</span>
                                    <input name="baseAddress" value={form.baseAddress} onChange={handleChange} required />
                                </label>
                            )}
                        </div>
                    </section>

                    <section className="wa-section">
                        <div className="wa-section-title">
                            <h2>자동차 정보</h2>
                        </div>
                        <div className="wa-field-grid">
                            <label className="wa-field wide">
                                <span>차대번호</span>
                                <input
                                    name="carIdNo"
                                    value={form.carIdNo}
                                    onChange={(event) => updateForm('carIdNo', event.target.value.toUpperCase().slice(0, 17))}
                                    maxLength={17}
                                    required
                                />
                            </label>
                            <label className="wa-field">
                                <span>차량명</span>
                                <input name="carName" value={form.carName} onChange={handleChange} />
                            </label>
                            <label className="wa-field">
                                <span>제작일자</span>
                                <input name="madeDate" type="date" value={form.madeDate} onChange={handleChange} />
                            </label>
                            <label className="wa-field">
                                <span>등록예정일</span>
                                <input name="registDate" type="date" value={form.registDate} onChange={handleChange} />
                            </label>
                            <label className="wa-field">
                                <span>공급가액</span>
                                <input
                                    name="buyAmt"
                                    value={buyAmountLabel}
                                    onChange={(event) => updateForm('buyAmt', onlyNumber(event.target.value))}
                                    inputMode="numeric"
                                    required
                                />
                            </label>
                        </div>
                    </section>

                    <section className="wa-section">
                        <div className="wa-section-title">
                            <h2>신규등록 정보</h2>
                        </div>
                        <div className="wa-field-grid">
                            <label className="wa-field">
                                <span>번호판 종류</span>
                                <select name="numplateGb" value={form.numplateGb} onChange={handleChange}>
                                    {NUMPLATE_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <div className="wa-readonly-field">
                                <span>번호판 금액</span>
                                <strong>{numplateAmount.toLocaleString()}원</strong>
                            </div>
                            <label className="wa-field">
                                <span>결제구분</span>
                                <select name="payGb" value={form.payGb} onChange={handleChange}>
                                    {PAY_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="wa-field full">
                                <span>메모</span>
                                <textarea name="memo" rows={3} value={form.memo} onChange={handleChange} />
                            </label>
                        </div>
                    </section>
                </div>

                <div className="wa-form-actions">
                    <button type="submit" className="wa-save-btn" disabled={saving}>
                        {saving ? <LoaderCircle size={18} className="wa-spin" /> : <Save size={18} />}
                        <span>{saving ? '저장 중' : '확인'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default WaNewcarRequest;