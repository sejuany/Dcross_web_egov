import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { 
	AlertCircle, Building2, CalendarDays, Leaf, Car, CarFront, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CreditCard, FileText, LoaderCircle, Mail, MapPin, MapPinned, Minus, Phone, Plus, Save, Search, User, UserRound, Users, X 
} from 'lucide-react';

import {
    initialDsCarNoDetach,
    initialDsNewCar,
    initialDsPaymentList,
    initialDsService,
    initialOwnerInfo,
    initialOwnerInfo1
} from '../../../components/newcar/newcarInitial';

import '../../styles/wa.css';
import '../../styles/WaNewcarRequest.css';
import OwnerPersonal from './owner/OwnerPersonal';
import OwnerCorporate from './owner/OwnerCorporate';
import OwnerLease from './owner/OwnerLease';
import OwnerUserLease from './owner/OwnerUserLease';

import CarInfo from './CarInfo';
import NewcarInfo from './NewcarInfo';
import ConfirmInfo from './ConfirmInfo';

// 신청 단계 제목
const REQUEST_STEPS = [
    '소유자 정보 입력',
    '자동차 정보 입력',
    '신규등록 정보 입력',
    '최종 확인'
];

const SUMMARY_ITEMS = [
    {
        key: 'linkId',
        label: '주문번호',
        icon: FileText,
        formatter: value => value || '-'
    },
    {
        key: 'carIdNo',
        label: '차대번호',
        icon: CarFront,
        formatter: value => value ? value.toUpperCase() : '-'
    },
    {
        key: 'ownerNm',
        label: '계약자명',
        icon: UserRound,
        formatter: value => value || '-'
    },
    {
        key: 'registDate',
        label: '등록 예정일',
        icon: CalendarDays,
        formatter: value => value || '-'
    }
];


// 단계별 제목
const STEP_TITLES = {
    1: '소유자 정보',
    2: '자동차 정보',
    3: '신규등록 정보',
    4: '최종 확인'
};

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
const toDateInput = (value) => {
    const text = trimValue(value);

    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const digits = onlyNumber(text);

    return digits.length >= 8
        ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
        : text;
};

const getOwnerTypeFromDetail = (dsNewCar = {}) => {
    const taskCd = trimValue(dsNewCar.TASK_CD);
    const regGb = trimValue(dsNewCar.REG_GB);

    if (taskCd === 'LEASE' && regGb === 'R') return 'USER_LEASE';
    if (taskCd === 'LEASE') return 'LEASE';
    if (regGb === 'B') return 'CORPORATE';

    return 'PERSONAL';
};

const mapDetailToForm = (detail = {}) => {
    const dsService = detail.dsService || {};
    const dsNewCar = detail.dsNewCar || {};
    const dsCarNoDetach = detail.dsCarNoDetach || {};
    const address = trimValue([dsNewCar.ADDRESS, dsNewCar.ADDRESS_DT].filter(Boolean).join(' '));
    const baseAddress = trimValue([dsNewCar.BASE_ADDRESS, dsNewCar.BASE_ADDRESS_DT].filter(Boolean).join(' '));

    return {
        ...EMPTY_FORM,
        linkId: trimValue(dsService.LINK_ID || dsNewCar.LINK_ID),
        taskCd: trimValue(dsNewCar.TASK_CD) || EMPTY_FORM.taskCd,
        deliveryGb: trimValue(dsCarNoDetach.DELIVERY_GB) || EMPTY_FORM.deliveryGb,
        carIdNo: trimValue(dsNewCar.CARID_NO),
        regGb: trimValue(dsNewCar.REG_GB) || EMPTY_FORM.regGb,
        regNo: trimValue(dsNewCar.REG_NO || dsNewCar.BIZ_NO),
        ownerNm: trimValue(dsNewCar.OWNER_NM),
        mphoneNo: trimValue(dsNewCar.MPHONE_NO),
        address,
        baseAddress: baseAddress || address,
        sameBaseAddress: !baseAddress || baseAddress === address,
        carName: trimValue(dsNewCar.CAR_NM),
        madeDate: toDateInput(dsNewCar.MADE_DT),
        registDate: toDateInput(dsNewCar.REGIST_DATE),
        buyAmt: trimValue(dsNewCar.BUY_AMT),
        numplateGb: trimValue(dsNewCar.NUMPLATE_GB || dsCarNoDetach.NUMPLATE_GB) || EMPTY_FORM.numplateGb,
        payGb: trimValue(dsNewCar.PAY_GB) || EMPTY_FORM.payGb,
        memo: trimValue(dsNewCar.MEMO_TX)
    };
};

const WaNewcarRequest = ({ initialServiceId = '', embedded = false, onSaved } = {}) => {
    const [form, setForm] = useState(EMPTY_FORM);
	
	// 소유자 유형 선택
    const [ownerType, setOwnerType] = useState('PERSONAL');
	
    const [initData, setInitData] = useState(null);
    const [serviceId, setServiceId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
	
	// 첫번째 진행단계 step 설정
	const [step, setStep] = useState(1);
	// hocer 했을 때 파란 선 움직이는 효과
	const [hoverStep, setHoverStep] = useState(null);
	// 표시할 밑줄 위치
	const current = hoverStep ?? step;

    useEffect(() => {
        let mounted = true;

        const loadInit = async () => {
            try {
                setLoading(true);
                const targetServiceId = trimValue(initialServiceId);
                const res = targetServiceId
                    ? await axios.get(`/api/newcar/detail/${encodeURIComponent(targetServiceId)}`, { withCredentials: true })
                    : await axios.get('/api/newcar/init', { withCredentials: true });

                if (!mounted) return;

                if (res.data?.success) {
                    const data = res.data.data || {};
                    setInitData(data);
                    setServiceId(targetServiceId || '');
                    setMessage('');
                    setError('');

                    if (targetServiceId) {
                        setForm(mapDetailToForm(data));
                        setOwnerType(getOwnerTypeFromDetail(data.dsNewCar));
                    } else {
                        setForm(EMPTY_FORM);
                        setOwnerType('PERSONAL');
                    }
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
    }, [initialServiceId]);

    const numplateAmount = useMemo(() => getNumplateAmount(form.numplateGb), [form.numplateGb]);
    const buyAmountLabel = useMemo(() => formatAmount(form.buyAmt), [form.buyAmt]);

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
            PROC_CD: dsNewCar.PROC_CD || 'I',
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
                PROC_ST: serviceId ? (dsService.PROC_ST || 'SAV') : 'SAV',
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

	const handleSave = async () => {
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
	            setMessage(
	                nextServiceId
	                    ? `저장되었습니다. 접수번호 ${nextServiceId}`
	                    : '저장되었습니다.'
	            );
	            onSaved?.(nextServiceId);
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
        <div className={`wa-request-page${embedded ? ' embedded' : ''}`}>
            <div className="wa-request-card">
			
				{/* 진행 단계 */}
				<div className="simple-step-wrap">
				    {REQUEST_STEPS.map((title, index) => {
				        const stepNo = index + 1;
	
				        return (
				            <div
				                key={title}
				                className={`simple-step ${step === stepNo ? 'active' : ''}`}
				                onMouseEnter={() => setHoverStep(stepNo)}
				                onMouseLeave={() => setHoverStep(null)}
				                onClick={() => setStep(stepNo)}
				            >
				                <div className="step-circle">{stepNo}</div>
				                <span>{title}</span>
				            </div>
				        );
				    })}
	
				    <div
				        className="step-indicator"
				        style={{
				            transform: `translateX(${(current - 1) * 100}%)`
				        }}
				    />
				</div>
				
				{/* 차량 정보 */}
				<div className="simple-summary">
				    {SUMMARY_ITEMS.map(item => {
				        const Icon = item.icon;

				        return (
				            <div key={item.key} className="summary-item">
				                <div className="summary-icon">
				                    <Icon size={16} />
				                </div>

				                <div>
				                    <div className="summary-label">
				                        {item.label}
				                    </div>

				                    <div className="summary-value">
				                        {item.formatter(form[item.key])}
				                    </div>
				                </div>
				            </div>
				        );
				    })}
				</div>
				
				<div className="wa-body">

                    {(message || error) && (
                        <div className={`wa-request-alert ${error ? 'error' : 'success'}`}>
                            {error || message}
                        </div>
                    )}

				    {/* 현재 단계 제목 */}
				    <h2 className="wa-title">
				        {STEP_TITLES[step]}
				    </h2>

				    {/* 단계별 내용 */}
				    {step === 1 && (
				        <>
				            {/* 소유자 유형 */}
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
							{/* 소유자 정보 입력 */}
							<div className="wa-form-body">

								{/* 개인 */}
								{ownerType === 'PERSONAL' && <OwnerPersonal />}
									
								{/* 법인 */}
								{ownerType === 'CORPORATE' && <OwnerCorporate />}
	
								{/* 리스 */}
								{ownerType === 'LEASE' && <OwnerLease />}
								
								{/* 이용자명의 리스 */}
								{ownerType === 'USER_LEASE' && <OwnerUserLease />}
				            </div>
					    </>
					)}
					
					{/* 번호판 정보 입력 */}	
					{step === 2 && <CarInfo />}

					{/* 신규등록 정보 */}
					{step === 3 && <NewcarInfo />}
					
					{/* 최종 확인 */}
					{step === 4 && <ConfirmInfo />}
				</div>
				
				<div className="wa-form-actions">

				    <button
				        type="button"
				        className="wa-action-btn wa-prev-btn"
				        disabled
				    >
						<ChevronLeft size={16} strokeWidth={2.5} />
				        이전
				    </button>

				    <button
				        type="button"
				        className="wa-action-btn wa-confirm-btn"
				        disabled={saving}
				    onClick={handleSave}
				    >
				        {saving ? <LoaderCircle size={18} className="wa-spin" /> : <Save size={18} />}
				        <span>{saving ? '저장 중' : '확인'}</span>
				    </button>

				    <button
				        type="button"
				        className="wa-action-btn wa-save-btn"
				    disabled={saving}
				    onClick={handleSave}
				    >
				        저장
				    </button>

				</div>
            </div>
        </div>
    );
};

export default WaNewcarRequest;