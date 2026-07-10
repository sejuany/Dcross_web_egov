
/* =========================================================
 * Import
 * ========================================================= */
import React, { useEffect, useRef, useState } from 'react';

import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, CarFront, ChevronLeft, FileText, LoaderCircle, UserRound, CircleAlert } from 'lucide-react';

// 공통
import { gf, log, mapData } from '../../../utils/utils';
// 주소 기능
import useAddressHandler from '../../../hooks/useAddressHandler';

// 초기값
import {
    initialDsService,
    initialDsNewCar,
    initialOwnerInfo,
    initialOwnerInfo1,
    initialDsPaymentList,
    initialDsBranchList,
    initialDsBaseList,
    initialDsCarNoDetach,
    initialDsTaxReceipt,
    serviceMap,
    newCarMap,
    ownerMap,
    taxReceiptMap
} from './WaNewcarInitial';

// 화면
import CarInfo from './CarInfo';
import ConfirmInfo from './ConfirmInfo';
import NewcarInfo from './NewcarInfo';
import OwnerNormal from './owner/OwnerNormal';
import OwnerLease from './owner/OwnerLease';
import OwnerUserLease from './owner/OwnerUserLease';
import OwnerRent from './owner/OwnerRent';
// 상세 조회 화면
import WaNewcarDetail from './WaNewcarDetail';
// 첨부서류 모달
import WaNewcarAttachModal from './WaNewcarAttachModal';
import WaSendSmsModal from './WaSendSmsModal';

// Style
import '../../styles/wa.css';
import '../../styles/WaNewcarRequest.css';

/* =========================================================
 * Constant
 * ========================================================= */

// 회사별 기본값
// 값이 있으면 기존값과 관계없이 적용
const COMPANY_DEFAULT = {

    WA001: {},

    WB001: {
        dsNewCar: {
            NUMPLATE_GB: '',   // 번호판 선택
            REGIST_DATE: ''
        }
    }
};

// 회사별 번호판 비용
const COMPANY_NUMPLATE_PRICE = {

    WA001: {
        DEFAULT: 0,
        NOT: 0,
        '': 0,
        '7': 31400,   // 전기
        F: 28600      // 필름
    }
};

// 화면 필수 입력 항목
const REQUIRED_FIELDS = [
    { name: 'TASK_CD', label: '업무구분' },
    { name: 'CARID_NO', label: '차대번호' },
    { name: 'REQ_CAR_NO', label: '차량번호' },
    { name: 'REG_GB', label: '등록구분' },
    { name: 'REG_NO', label: '등록번호' },
    { name: 'OWNER_NM', label: '성명(상호)' },
    { name: 'RATIO_NO', label: '소유비율' },
    { name: 'MPHONE_NO', label: '휴대폰번호' },
    { name: 'ADDRESS', label: '소유자 주소' },
    { name: 'RT_ACC_NM', label: '소유자 성명' },
    { name: 'BASE_ADDRESS', label: '사용본거지 주소' },
    { name: 'RT_ACC_NO', label: '사용본거지 연락처' },
    { name: 'NUMPLATE_GB', label: '번호판 종류' },
    { name: 'PAY_GB', label: '결제구분' },
    { name: 'BUY_AMT', label: '공급가액' },
    { name: 'NTAX_TRGET_CD', label: '비과세대상' },
    { name: 'BOND_DC', label: '채권할인여부' },
    { name: 'RT_BANK_CD', label: '환급계좌 은행' },
    { name: 'RETURN_NO', label: '환급계좌번호' },
    { name: 'RETURN_NM', label: '환급예금주' }
];


// 상세조회 화면 표시 대상 상태
const DETAIL_PROC_STATUS = ['REQ', 'S_REQ', 'RET', 'END'];
// 신청 단계
const REQUEST_STEPS = [ '소유자 정보 입력', '자동차 정보 입력', '신규등록 정보 입력', '최종 확인'];
// 단계 제목
const STEP_TITLES = { 1: '소유자 정보', 2: '자동차 정보', 3: '신규등록 정보', 4: '최종 확인' };
// 차량 구매 방식
const OWNER_TYPE_OPTIONS = [
    {
        value: 'NORMAL',
        label: '현금/할부',
        taskCd: 'NORML', // 일반등록
        procCd: 'I'		 // 수입차신규
    },
    {
        value: 'LEASE',
        label: '리스',
        taskCd: 'LEASE', // 리스
        procCd: 'I'		 // 수입차신규
    },
    {
        value: 'USER_LEASE',
        label: '이용자명의 리스',
        taskCd: 'LEASE', // 리스
        procCd: 'C'		 // 이용자명의 리스
    },
    {
        value: 'RENT',
        label: '렌트',
        taskCd: 'ADD', // 증차배정
        procCd: 'I'
    }
];

// 결제관리 코드명 변환
const payKdMap = { ACQ: '취득세', BFEE: '채권취급수수료', BOND: '채권', FEE: '등록수수료', INJI: '인지세', SPARE: '예비비', STAMP: '증지대', TNUM: '번호판대', UNUM: '번호판대행', UREG: '등록면허세' };
// 결제관리 컬럼 정의
const paymentColumnDefs = [
	{
		headerName: '결제종류',
		field: 'PAY_KD',
		width: 150,
		valueFormatter: p => payKdMap[p.value] || p.value
	},
	{
		headerName: '전자납부번호(가상계좌)',
		field: 'VBANK_NO',
		flex: 1,
		editable: true
	},
	{
		headerName: '결제여부',
		field: 'PAY_OP',
		width: 120,
		editable: true,
		cellEditor: 'agSelectCellEditor',
		cellEditorParams: {
			values: ['Y', 'N']
		},
		valueFormatter: p => p.value === 'Y' ? '납부' : '미납'
	},
	{
		headerName: '예상금액',
		field: 'PRE_PAY_AMT',
		width: 130,
		editable: true,
		cellClass: 'ag-right-cell',
		valueFormatter: p => Number(p.value || 0).toLocaleString()
	},
	{
		headerName: '결제금액',
		field: 'PAY_AMT',
		width: 130,
		editable: true,
		cellClass: 'ag-right-cell',
		valueFormatter: p => Number(p.value || 0).toLocaleString()
	},
	{
		headerName: '결제상태',
		field: 'PAY_ST',
		width: 120,
		editable: true,
		cellEditor: 'agSelectCellEditor',
		cellEditorParams: {
			values: ['Y', 'N']
		},
		valueFormatter: p => p.value === 'Y' ? '입금' : '미입금'
	},
	{
		headerName: '결제일시',
		field: 'PAY_DT',
		width: 200,
		editable: false,
		valueFormatter: p => p.value || '-'
	}
];

// 결제정보 총금액 계산
const calculateTotalAmt = paymentList =>
    paymentList.reduce((sum, item) => sum + Number(item.PRE_PAY_AMT || 0), 0);

// 번호판 종류에 따른 번호판대(TNUM) 금액 조회
const getNumplateAmount = (companyId, numplateGb, paymentList) => {

    const companyPrice = COMPANY_NUMPLATE_PRICE[companyId] || {};
    const dbAmount = paymentList.find(item => item.PAY_KD === 'TNUM')?.PRE_PAY_AMT;

    return Number(dbAmount ?? companyPrice[numplateGb] ?? companyPrice.DEFAULT ?? 27500);
};

// 번호판 종류에 따른 번호판대 및 총금액 계산
const getNumplateResult = (companyId, newCar, paymentList) => {

    const numplateAmt = getNumplateAmount(companyId, newCar.NUMPLATE_GB, paymentList);

    const dsPaymentList = paymentList.map(item =>
        item.PAY_KD === 'TNUM'
            ? { ...item, PRE_PAY_AMT: numplateAmt, PAY_AMT: numplateAmt }
            : item
    );

    return {
        dsNewCar: {
            ...newCar,
            TOTAL_AMT: calculateTotalAmt(dsPaymentList)
        },
        dsPaymentList
    };
};

// 저장 및 신청할 때 하이픈(-), 콤마(,) 제거한 숫자만 저장되도록 포맷팅
const formatNumberData = (dataSet) => {
    return {
        ...dataSet,

        dsService: {
            ...dataSet.dsService,
            LINK_ID: gf.onlyNumber(String(dataSet.dsService.LINK_ID || ''))
        },

        dsNewCar: {
            ...dataSet.dsNewCar,
			// 주민등록번호
			REG_NO: gf.onlyNumber(String(dataSet.dsNewCar.REG_NO || '')),

			// 휴대폰번호
			MPHONE_NO: gf.onlyNumber(String(dataSet.dsNewCar.MPHONE_NO || '')),

			// 환급계좌
			RT_ACC_NO: gf.onlyNumber(String(dataSet.dsNewCar.RT_ACC_NO || '')),

			// 가상계좌
			VBANK_NO: gf.onlyNumber(String(dataSet.dsNewCar.VBANK_NO || '')),

			// 반환번호
			RETURN_NO: gf.onlyNumber(String(dataSet.dsNewCar.RETURN_NO || '')),

			// 금액
			BUY_AMT: gf.onlyNumber(String(dataSet.dsNewCar.BUY_AMT || '')),
			TOTAL_AMT: gf.onlyNumber(String(dataSet.dsNewCar.TOTAL_AMT || '')),
			RT_AMT: gf.onlyNumber(String(dataSet.dsNewCar.RT_AMT || '')),
			BOND_AMT: gf.onlyNumber(String(dataSet.dsNewCar.BOND_AMT || '')),
			
			// 날짜
			REGIST_DATE: gf.onlyNumber(String(dataSet.dsNewCar.REGIST_DATE || '')),
			MADE_DT: gf.onlyNumber(String(dataSet.dsNewCar.MADE_DT || '')),
			LAST_DT: gf.onlyNumber(String(dataSet.dsNewCar.LAST_DT || '')),
			INSURER_SDT: gf.onlyNumber(String(dataSet.dsNewCar.INSURER_SDT || '')),
			INSURER_EDT: gf.onlyNumber(String(dataSet.dsNewCar.INSURER_EDT || '')),
			NEWCAR_REG_DT: gf.onlyNumber(String(dataSet.dsNewCar.NEWCAR_REG_DT || ''))
        },
		
		dsCarNoDetach: {
			...dataSet.dsCarNoDetach
		},

        dsTaxReceipt: {
            ...(dataSet.dsTaxReceipt || {}),
            REG_NO: gf.onlyNumber(String(dataSet.dsTaxReceipt?.REG_NO || '')),
            PHONE_NO: gf.onlyNumber(String(dataSet.dsTaxReceipt?.PHONE_NO || ''))
        },

        dsOwnerInfo: {
            ...dataSet.dsOwnerInfo,

			// 공동소유자 주민번호
			DEBTOR_REG_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo.DEBTOR_REG_NO || '')),

			// 공동소유자 사업자번호
			DEBTOR_BIZ_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo.DEBTOR_BIZ_NO || '')),

			// 공동소유자 전화번호
			DEBTOR_TEL_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo.DEBTOR_TEL_NO || '')),

			// 공동소유자 휴대폰번호
			DEBTOR_MPHONE_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo.DEBTOR_MPHONE_NO || ''))
        },
		

		dsOwnerInfo1: {
		    ...dataSet.dsOwnerInfo1,

		    DEBTOR_REG_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo1.DEBTOR_REG_NO || '')),
		    DEBTOR_BIZ_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo1.DEBTOR_BIZ_NO || '')),
		    DEBTOR_TEL_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo1.DEBTOR_TEL_NO || '')),
		    DEBTOR_MPHONE_NO: gf.onlyNumber(String(dataSet.dsOwnerInfo1.DEBTOR_MPHONE_NO || ''))
		},
		
		dsPaymentList: dataSet.dsPaymentList.map(item => ({
		    ...item,

		    PRE_PAY_AMT: gf.onlyNumber(String(item.PRE_PAY_AMT || '')),
		    PAY_AMT: gf.onlyNumber(String(item.PAY_AMT || ''))
		}))
    };
};

// 초기값 병합
// - DB값을 기준으로 생성
// - newcarInitial.js에 값이 있는 항목은 DB값보다 우선 적용
const mergeData = (initValue, dbValue) => {

    // DB값을 기준으로 생성
    const merged = { ...(dbValue || {}) };

    // initial에 값이 있는 항목만 DB값 덮어쓰기
    Object.keys(initValue || {}).forEach(key => {

        const value = initValue[key];

        if (
            value !== null &&
            value !== undefined &&
            value !== ''
        ) {
            merged[key] = value;
        }
    });

    return merged;
};


/* =========================================================
 * Component
 * ========================================================= */

const WaNewcarRequest = ({
    embedded = false,
    initialServiceId = '',
    onClose,
    onSaved
}) => {
	
/* =========================================================
 * State
 * 화면에서 사용하는 데이터
 * ========================================================= */
	// 화면 데이터

	// 목록에서 전달받은 SERVICE_ID를 최초 상태값으로 사용한다.
	const [serviceId, setServiceId] = useState(initialServiceId);
	
	const [dsService, setDsService] = useState(initialDsService);
	const [dsNewCar, setDsNewCar] = useState(initialDsNewCar);
	const [dsOwnerInfo, setDsOwnerInfo] = useState(initialOwnerInfo);
	const [dsOwnerInfo1, setDsOwnerInfo1] = useState(initialOwnerInfo1);
	const [dsCarNoDetach, setDsCarNoDetach] = useState(initialDsCarNoDetach);
	const [dsTaxReceipt, setDsTaxReceipt] = useState(initialDsTaxReceipt);

	// 조회 데이터
	const [dsBranchList, setDsBranchList] = useState(initialDsBranchList);
	const [dsBaseList, setDsBaseList] = useState(initialDsBaseList);
	const [dsPaymentList, setDsPaymentList] = useState([]);
	const [dsCompanyInfo, setDsCompanyInfo] = useState({});
	const [dsWorkCp, setDsWorkCp] = useState({});
	const [dsUserInfo, setDsUserInfo] = useState({});
	const [codes, setCodes] = useState({});

	// 화면 상태 ===
	// 소유자 유형 선택	
	const [purchaseType, setOwnerType] = useState('NORMAL');
	// 첫번째 진행단계 step 설정
	const [step, setStep] = useState(1);
	// hocer 했을 때 파란 선 움직이는 효과
	const [hoverStep, setHoverStep] = useState(null);

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	// 첨부서류 모달
	const [attachModalOpen, setAttachModalOpen] = useState(false);
	const [smsModalOpen, setSmsModalOpen] = useState(false);
	
	// 주소 기능 사용
	const {
	    handleAddressSelect,
	    handleSameAddress
	} = useAddressHandler({
	    dsNewCar,
	    dsBaseList,
	    setDsNewCar,
	    setDsOwnerInfo
	});
/* =========================================================
 * Ref
 * 렌더링 없이 유지되는 값
 * ========================================================= */

	const hasLoadedCodesRef = useRef(false);
	// 초기화 및 중복조회 방지
	const hasInitializedRef = useRef(false);
	// 마지막 조회한 접수번호
	const loadedReceiptNoRef = useRef('');
	// 마지막 조회한 상세조회 구분값
	const loadedDetailOpenKeyRef = useRef('');

	
/* =========================================================
 * Hook
 * React Hook 및 라우터
 * ========================================================= */

	const location = useLocation();
	const navigate = useNavigate();

	// 접수번호
	const receiptNo = location.state?.receiptNo ?? '';
	// 상세조회 새로고침 구분값
	const detailOpenKey = location.state?.detailOpenKey ?? '';

	
/* =========================================================
 * Derived Value
 * State로부터 계산된 값
 * ========================================================= */

	// 표시할 밑줄 위치
	const current = hoverStep ?? step;
	// 상세조회 화면 여부 = 상태가 DETAIL_PROC_STATUS에 포함되거나, JUDGE_ST가 빈값이 아닌 경우 
	const isDetailPage = DETAIL_PROC_STATUS.includes(dsService.PROC_ST) || dsService.JUDGE_ST;
	// 처리상태가 '입력'이고, 신규등록 구분이 '렌트'인 경우 특정 화면을 보여줌  
	const isRentInput = dsService.PROC_ST === 'INPUT' && dsNewCar.TASK_CD === 'ADD';
		
/* =========================================================
 * Effect
 * ========================================================= */

	// 공통코드 데이터 로딩
	useEffect(() => {
		if (hasLoadedCodesRef.current) {
			return;
		}

		const loadCodes = async () => {
			const codeData = await gf.getCodes(['SGB', 'PR_ST', 'JG_ST', 'NEWGB', 'DELIV', 'TASK', 
				'BOND', 'NTTCD', 'NTTGR', 'NTACD', 'NTWHO', 'STAGB', 'DLVGB', 'DLADD', 'REGGB', 
				'NUMGB', 'CARM', 'FRTAX', 'GOVT', 'PAYME', 'PAYGB', 'INSUR', 'NUMST', 'IMPST',
				'PAYKD', 'PAYME', 'PAYOP', 'PAYST', 'PAYTP', 'BANK', 'FUEL', 'CARUS', 'NHOLE', 
				'NSEAL' 
			]);

			hasLoadedCodesRef.current = true;
			setCodes(codeData);
		};

		loadCodes();
	}, [setCodes]);
	
	// 부모에서 SERVICE_ID가 변경되면 현재 화면도 함께 변경한다.
	useEffect(() => {
	    if (!initialServiceId) {
	        return;
	    }

	    setServiceId(initialServiceId);
	}, [initialServiceId]);

	// 전달받은 SERVICE_ID가 있으면 상세 데이터를 조회한다.
	useEffect(() => {
	    if (!serviceId) {
	        return;
	    }

	    loadDetail(serviceId);
		
	}, [serviceId]);
	
	// 다음 눌렀을 때 다음 단계로 이동하도록 함
	const handleNext = async (e) => {
	    e.preventDefault();

		// 이미 렌트 안내 화면인 경우
		if (isRentInput) {
		    onClose();
		    return;
		}
		
		// 렌트 선택하고 확인 눌렀을 때
	    if (purchaseType === 'RENT') {
			
			const confirm = await gf.confirm('렌트 차량은 직접등록 건으로 변경됩니다.\n계속 진행하시겠습니까?', '렌트 확인');
			
			if(!confirm) {
				return;
			}
			
			const newDsService = {
			    ...dsService,
			    PROC_ST: 'INPUT',
			    JUDGE_ST: '',
				TASK_CD: 'ADD'
			};

			await saveProcess(
			    {...dsNewCar}, 'SAV', null, null, newDsService
			);
			
			return;
	    }

	    switch (step) {
	        case 1:
	            setStep(2); // 자동차 정보 입력
	            break;

	        case 2:
	            setStep(3); // 신규등록 정보 입력
	            break;

	        case 3:
	            setStep(4); // 최종 확인
	            break;

	        default:
	            break;
	    }
	};
	
	// 차량 구매 방식 정보 저장
	const handlePurchaseTypeSelect = (option) => {

		console.log('handlePurchaseTypeSelect');
		console.log('이전 REG_GB =', dsNewCar.REG_GB);
		console.log(option);

	    setOwnerType(option.value);

	    setDsNewCar(prev => ({
	        ...prev,
	        TASK_CD: option.taskCd,
	        PROC_CD: option.procCd
	    }));
	};
	
	// input 공통 핸들러
	const handleChange = (e) => {
		const { name, value, dataset } = e.target;

		let v = value;

		// 차대번호 대문자
		if (name === 'CARID_NO') {
			v = gf.toUpperAlpha(value);
		}
		// 금액 콤마 제거
		else if (name === 'BUY_AMT') {
			v = value.replaceAll(',', '');
		}
		// 주민등록, 외국인등록번호 일 때 상세주소 입력시 사용본거지 상세주소도 입력
		else if (name === 'ADDRESS_DT') {

		    setDsNewCar(prev => ({
		        ...prev,
		        ADDRESS_DT: value,

		        ...(prev.REG_GB !== 'B' && {
		            BASE_ADDRESS_DT: value
		        })
		    }));

		    return;
		}

		if (dataset.type === 'newcar') {
			setDsNewCar(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'service') {
			setDsService(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'owner') {
			setDsOwnerInfo(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'owner1') {
			setDsOwnerInfo1(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'detach') {
			setDsCarNoDetach(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'taxReceipt') {
			setDsTaxReceipt(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'company') {
			setDsCompanyInfo(prev => ({ ...prev, [name]: v }));
		}
	};

	
	// 상세 조회 공통
	const loadDetail = async (receiptNo, showLoading = true) => {
		console.log('receiptNo >>' + receiptNo);
		
		// 로딩 시작
		if (showLoading) {
		    setLoading(true);
		}

		const startTime = Date.now();


	    try {

	        const res = await fetch(`/api/newcar/detail/${receiptNo}`);
	        const data = await res.json();

	        if (data.success && data.data) {

				const dbData = gf.formatDateFields(data.data);
				
				// 신규등록 데이터 매핑
				const mappedNewCar = mapData(
				    initialDsNewCar,
				    dbData.dsNewCar,
				    newCarMap
				);

				// 결제목록
				const paymentList = Array.isArray(dbData.dsPaymentList)
				    ? dbData.dsPaymentList
				    : [];

				// 번호판대(TNUM) 및 총금액 계산
				const result = getNumplateResult(
				    dbData.dsUserInfo?.COMPANY_ID,
				    mappedNewCar,
				    paymentList
				);
				

				setDsPaymentList(result.dsPaymentList);

				setDsService(
				    mapData(initialDsService, dbData.dsService, serviceMap)
				);

				setDsNewCar(result.dsNewCar);
				
				// 구매방식 선택
				if (result.dsNewCar.TASK_CD === 'LEASE' && result.dsNewCar.PROC_CD === 'I') {
				    setOwnerType('LEASE'); // 리스
				}
				else if (result.dsNewCar.TASK_CD === 'LEASE' && result.dsNewCar.PROC_CD === 'C') {
				    setOwnerType('USER_LEASE'); // 이용자명의 리스
				}
				else if (result.dsNewCar.TASK_CD === 'ADD' && result.dsNewCar.PROC_CD === 'I') {
				    setOwnerType('RENT'); // 렌트
				}
				else {
				    setOwnerType('NORMAL'); // 현금-할부
				}

				setDsOwnerInfo(
				    mapData(initialOwnerInfo, dbData.dsOwnerInfo || {}, ownerMap)
				);

				setDsOwnerInfo1(
				    mapData(initialOwnerInfo1, dbData.dsOwnerInfo1 || {}, ownerMap)
				);

                setDsTaxReceipt(
                    mapData(initialDsTaxReceipt, dbData.dsTaxReceipt || {}, taxReceiptMap)
                );
				
				// 상세조회 데이터
	            setDsBranchList(dbData.dsBranchList || []);
	            setDsBaseList(dbData.dsBaseList || []);
	            setDsCarNoDetach(dbData.dsCarNoDetach || {});
				setDsCompanyInfo(dbData.dsCompanyInfo || {});
				setDsWorkCp(dbData.dsWorkCp || {});
				setDsUserInfo(dbData.dsUserInfo || {});
				hasInitializedRef.current = true;
				loadedReceiptNoRef.current = receiptNo;
				loadedDetailOpenKeyRef.current = detailOpenKey;

	        }
	    } catch (err) {
			loadedReceiptNoRef.current = '';
			loadedDetailOpenKeyRef.current = '';
	        console.error(err);
		} finally {
			
		    if (showLoading) {
		        gf.loadingDelay(startTime, () => setLoading(false));
		    }
		}
	};
	
	// 주소 잘 저장 됐는지 확인 하는 용도 
	useEffect(() => {
	    console.log({
	        ADDRESS: dsNewCar.ADDRESS,
	        ADDRESS_DT: dsNewCar.ADDRESS_DT,
	        POST_NO: dsNewCar.POST_NO,
	        BUBJUNG_CD: dsNewCar.BUBJUNG_CD,
	        RT_ACC_NM: dsNewCar.RT_ACC_NM,
	        ADDR_INFO: dsNewCar.ADDR_INFO,

	        BASE_ADDRESS: dsNewCar.BASE_ADDRESS,
	        BASE_ADDRESS_DT: dsNewCar.BASE_ADDRESS_DT,
	        BASE_POST_NO: dsNewCar.BASE_POST_NO,
	        BASE_BUBJUNG_CD: dsNewCar.BASE_BUBJUNG_CD,
	        RT_ACC_NO: dsNewCar.RT_ACC_NO,
	        ADDR_INFO2: dsNewCar.ADDR_INFO2
	    });
	}, [dsNewCar]);
	
	// 저장
	const saveProcess = async (
	    newDsNewCar = null,
	    proc = "SAV",
	    newDsPaymentList = null, // 사전조회 계산 결과 저장용
		newDsOwnerInfo = null, 	// 공동소유자 정보 저장용
		newDsService = null
	) => {
		
		const targetNewCar = newDsNewCar || dsNewCar;

		// 저장은 차대번호만 체크
		if (gf.Check(targetNewCar.CARID_NO, '차대번호', 17)) {
		    gf.alert('차대번호를 확인해주세요.');
		    return;
		}
		
		// 저장 시 사용할 요청 데이터 생성
		// 파라미터가 있으면 계산된 최신 데이터 사용
		let newDataSet = {
		    dsService: newDsService ? { ...newDsService } : { ...dsService },
		    dsNewCar: newDsNewCar ? { ...newDsNewCar } : { ...dsNewCar },
			dsOwnerInfo: newDsOwnerInfo ? { ...newDsOwnerInfo } : { ...dsOwnerInfo },
		    dsOwnerInfo1,
		    dsCarNoDetach,
            dsTaxReceipt,

		    dsPaymentList: newDsPaymentList ? [...newDsPaymentList] : [...dsPaymentList]
		};
		
		// 법인번호판 대상이 아닌 경우
		const isCorpNumplate =
		    newDataSet.dsNewCar.REG_GB === 'B' &&
		    Number(newDataSet.dsNewCar.BUY_AMT || 0) >= 80000000;

		// 법인번호판이 아닌데 G 계열 번호판이면 필름(F)으로 변경
		if (
		    !isCorpNumplate &&
		    String(newDataSet.dsNewCar.NUMPLATE_GB).includes('G')
		) {
		    newDataSet.dsNewCar.NUMPLATE_GB = 'F';
		}
		
		// 숫자 데이터 하이픈(-), 쉼표(,) 등 제거 
		newDataSet = formatNumberData(newDataSet); 
		
	    const { PROC_ST } = dsService;
		const userGb = dsUserInfo.MEMBER_GB;

	    // 1. 일반 저장 상태 처리
		// 입력, 등록요청, 신청대기, 저장일 때 저장 가능 
	    if (["INPUT", "C_REQ", "W_REQ", "SAV"].includes(PROC_ST)) {
			
			// 최초 저장(INPUT) 또는 AD가 등록요청(C_REQ) 상태에서 저장할 때는 상태 유지, SU가 저장할 때는 저장으로 변경
			if ( PROC_ST === "INPUT" || (PROC_ST === "C_REQ" && userGb === "SU")) {
				newDataSet.dsService.PROC_ST = "SAV";
			}
	    }

		log("저장 요청 데이터:");
	    // 저장 실행
	    await processService(newDataSet, proc);
	};
	

	const processService = async (newDataSet, proc) => {

	    try {
			
	        // 저장 요청
	        const res = await axios.post('/api/newcar/process', newDataSet);
			
			// 서버에러
			const isErr = (res.data?.data?.RESULT_CD ?? 0) < 0;
			
	        // 성공
	        if (res.data.success && !isErr) {
				
				let completeMsg; 
				
				if(newDataSet.dsService.PROC_ST === "REQ" && proc === "REQ") {
					completeMsg = "신청되었습니다.";
				}
				else if (newDataSet.dsService.PROC_ST === "P_REQ" && proc === "REQ") {
					completeMsg = "납부요청되었습니다.";
				}
				else if (newDataSet.dsService.PROC_ST === "W_REQ" && proc === "REQ") {
					completeMsg = "요청되었습니다.";
				}
				else if (newDataSet.dsService.PROC_ST === "DEL" && proc === "DEL") {
					completeMsg = "삭제되었습니다.";
				}
				else {
					completeMsg = "저장되었습니다.";
				}

				if(proc !== "NUM_SAV") {
					await gf.alert(completeMsg);
				}
				
				// Alert 확인 누른 직후 로딩 시작
				setLoading(true);

	            const serviceId = newDataSet.dsService.SERVICE_ID || res.data.data?.SERVICE_ID;
				
				// 최초 저장(insert) 후 SERVICE_ID만 화면 state 반영
				if (!dsService.SERVICE_ID && serviceId) {

				    setDsService(prev => ({
				        ...prev,
				        SERVICE_ID: serviceId
				    }));
				}

				// URL 상태 유지
				if (serviceId) {
					hasInitializedRef.current = true;
					loadedReceiptNoRef.current = serviceId;
					loadedDetailOpenKeyRef.current = '';

					navigate(location.pathname, {
						replace: true,
						state: { receiptNo: serviceId }
					});

					// 처리 후 화면 재조회
					await reloadProcess(serviceId);
					return true;
				}

	        } else {
				const errMsg = res.data?.data?.MESSAGE || res.data?.message || '저장 실패';
	            gf.alert(errMsg);
				return false;
	        }

	    } catch (err) {

	        console.error(err);

	        gf.alert('서버 오류 발생');
			return false;
	    }
	};
	

	// 새로고침: 탭은 유지하고 현재 화면 데이터만 다시 조회
	const reloadProcess = async (targetServiceId = '') => {
		
		// 로딩 시작
		const startTime = Date.now();

		try {
			
			const serviceId = String(
			    targetServiceId ||
			    receiptNo ||
			    dsService.SERVICE_ID ||
			    ''
			).trim();
			
			// 저장 건이면 상세조회, 아니면 초기화
			if (serviceId) {
			    await loadDetail(serviceId, false);
			} else {
			    await initProcess();
			}
		}
		
		finally {
			// 로딩 해제
			gf.loadingDelay(startTime, () => setLoading(false));
	    }
	};
	

	// 초기값 적용 순서
	// DB 조회값 → newcarInitial.js 기본값 → COMPANY_DEFAULT(회사별 기본값)
	const initProcess = async () => {
	    hasInitializedRef.current = true;
	    loadedReceiptNoRef.current = '';
	    loadedDetailOpenKeyRef.current = '';

	    // receiptNo 제거
	    navigate(location.pathname, { replace: true, state: {} });

	    // 화면 상태 초기화
	    setDsService(initialDsService);
	    setDsNewCar(initialDsNewCar);
	    setDsOwnerInfo(initialOwnerInfo);
	    setDsOwnerInfo1(initialOwnerInfo1);
        setDsTaxReceipt(initialDsTaxReceipt);
	    setDsPaymentList([]);
	    setDsBranchList(initialDsBranchList);
	    setDsBaseList(initialDsBaseList);
	    setDsCompanyInfo({});
	    setDsCarNoDetach(initialDsCarNoDetach);

	    // DB 조회 후 초기값
	    const res = await fetch('/api/newcar/init', {
	        credentials: 'include',
	    });

	    const resData = await res.json();

	    log(resData);

	    if (resData.success) {

	        const {
	            dsService = {},
	            dsNewCar = {},
	            dsOwnerInfo = {},
	            dsOwnerInfo1 = {},
                dsTaxReceipt = {},
	            dsPaymentList = [],
	            dsBranchList = [],
	            dsBaseList = [],
	            dsCarNoDetach = {},
	            dsCompanyInfo = {},
	            dsUserInfo = {}
	        } = resData.data || {};

	        setDsUserInfo(dsUserInfo);

			// 회사별 기본값
			// 적용 순서
			// 1. DB 조회값
			// 2. newcarInitial.js 기본값
			// 3. COMPANY_DEFAULT (값이 있으면 빈값 포함하여 무조건 적용)
			const companyDefault =
			    COMPANY_DEFAULT[dsUserInfo.COMPANY_ID] || {};

			const mergedService = {
			    ...mergeData(initialDsService, dsService),
			    ...(companyDefault.dsService || {})
			};

			const mergedNewCar = {
			    ...mergeData(initialDsNewCar, dsNewCar),
			    ...(companyDefault.dsNewCar || {})
			};

			const mergedOwnerInfo = {
			    ...mergeData(initialOwnerInfo, dsOwnerInfo),
			    ...(companyDefault.dsOwnerInfo || {})
			};

			const mergedOwnerInfo1 = {
			    ...mergeData(initialOwnerInfo1, dsOwnerInfo1),
			    ...(companyDefault.dsOwnerInfo1 || {})
			};

            const mergedTaxReceipt = {
                ...mergeData(initialDsTaxReceipt, dsTaxReceipt),
                ...(companyDefault.dsTaxReceipt || {})
            };

			const mergedCarNoDetach = {
			    ...mergeData(initialDsCarNoDetach, dsCarNoDetach),
			    ...(companyDefault.dsCarNoDetach || {})
			};
			
			// 번호판 금액 계산에 사용할 결제목록
			// DB에 결제내역이 있으면 사용하고,
			// 없으면 초기 결제목록 사용
			const paymentList = dsPaymentList?.length ? dsPaymentList : initialDsPaymentList;

			// 회사별 번호판 종류에 따른 금액 계산
			// - TNUM(번호판대) 금액 반영
			// - 총금액(TOTAL_AMT) 재계산
			const result = getNumplateResult(
			    dsUserInfo.COMPANY_ID,
			    mergedNewCar,
			    paymentList
			);
			
	        // 최종 세팅
	        setDsService(mergedService);
			setDsNewCar(result.dsNewCar);
	        setDsOwnerInfo(mergedOwnerInfo);
	        setDsOwnerInfo1(mergedOwnerInfo1);
            setDsTaxReceipt(mergedTaxReceipt);
	        setDsCarNoDetach(mergedCarNoDetach);

	        setDsCompanyInfo(dsCompanyInfo || {});
			setDsPaymentList(result.dsPaymentList);

	        setDsBranchList(
	            dsBranchList?.length
	                ? dsBranchList
	                : initialDsBranchList
	        );

	        setDsBaseList(
	            dsBaseList?.length
	                ? dsBaseList
	                : initialDsBaseList
	        );
	    }
	};

	if (isDetailPage) {
	    return (
	        <WaNewcarDetail 
				dsService={dsService}
				dsNewCar={dsNewCar}
				dsOwnerInfo={dsOwnerInfo}
				dsOwnerInfo1={dsOwnerInfo1}
				dsPaymentList={dsPaymentList}
				paymentColumnDefs={paymentColumnDefs}
				dsCarNoDetach={dsCarNoDetach}
				dsCompanyInfo={dsCompanyInfo}
				dsWorkCp={dsWorkCp}
				dsUserInfo={dsUserInfo}
				loading={loading}
				gf={gf}
			/>
	    );
	}
	
	// 주민번호, 외국인일 때
	// 등본상 주소지에서 x 버튼 누르면, 화면에 안 보이는 소유자주소+사용본거지 주소 한 번에 지워지도록 함
	const handleClearAddress = (type) => {

	    const isCorp =
	        dsNewCar.REG_GB === 'B' ||
	        dsNewCar.REG_GB === 'C';

	    setDsNewCar(prev => {

	        const next = { ...prev };

	        switch (type) {

	            case 'ADDRESS':

	                next.ADDRESS = '';
	                //next.ADDRESS_DT = '';
	                next.POST_NO = '';
	                next.BUBJUNG_CD = '';
	                next.RT_ACC_NM = '';
	                next.ADDR_INFO = '';

	                // 개인은 사용본거지도 같이 삭제
	                if (!isCorp) {
	                    next.BASE_ADDRESS = '';
	                    //next.BASE_ADDRESS_DT = '';
	                    next.BASE_POST_NO = '';
	                    next.BASE_BUBJUNG_CD = '';
	                    next.RT_ACC_NO = '';
	                    next.ADDR_INFO2 = '';
	                }
	                break;

	            case 'BASE_ADDRESS':

	                next.BASE_ADDRESS = '';
	                //next.BASE_ADDRESS_DT = '';
	                next.BASE_POST_NO = '';
	                next.BASE_BUBJUNG_CD = '';
	                next.RT_ACC_NO = '';
	                next.ADDR_INFO2 = '';
	                break;

	            default:
	                break;
	        }

	        return next;
	    });
	};

    const handleTaxReceiptAddressSelect = (type, addr) => {
        if (type !== 'ADDR') {
            return;
        }

        setDsTaxReceipt(prev => ({
            ...prev,
            ADDR: addr.ADDR,
            POST_NO: addr.POST_NO
        }));
    };

    const handleClearTaxReceiptAddress = (type) => {
        if (type !== 'ADDR') {
            return;
        }

        setDsTaxReceipt(prev => ({
            ...prev,
            ADDR: '',
            ADDR_DT: '',
            POST_NO: ''
        }));
    };
	
	
	return (
		<div className="wa-request-page">
		
			{loading && (
			    <div className="wa-loading">
			        <LoaderCircle size={24} className="wa-spin" />
			        <span>불러오는 중</span>
			    </div>
			)}
			
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

					<div className="summary-item">
						<div className="summary-icon">
							<FileText size={16} />
						</div>

						<div>
							<div className="summary-label">주문번호</div>
							<div className="summary-value">
								{dsService.LINK_ID || '-'}
							</div>
						</div>
					</div>

					<div className="summary-item">
						<div className="summary-icon">
							<CarFront size={16} />
						</div>

						<div>
							<div className="summary-label">차대번호</div>
							<div className="summary-value">
								{dsNewCar.CARID_NO || '-'}
							</div>
						</div>
					</div>

					<div className="summary-item">
						<div className="summary-icon">
							<UserRound size={16} />
						</div>

						<div>
							<div className="summary-label">계약자명</div>
							<div className="summary-value">
								{dsCarNoDetach.CUSTOMER_NM || '-'}
							</div>
						</div>
					</div>

					<div className="summary-item">
						<div className="summary-icon">
							<CalendarDays size={16} />
						</div>

						<div>
							<div className="summary-label">등록 예정일</div>
							<div className="summary-value">
								{dsNewCar.REGIST_DATE || '-'}
							</div>
						</div>
					</div>

				</div>
<<<<<<< .mine

				<div className="wa-body">

					{/* 현재 단계 제목 */}
					<h2 className="wa-title">
						{STEP_TITLES[step]}
					</h2>

					{/* 단계별 내용 */}
					{step === 1 && (
						<>
							<span className="wa-bold-span1">해당하는 차량 구매 방식을 선택해주세요.</span>
							{/* 소유자 유형 */}
							<div className="wa-owner-tabs" role="tablist" aria-label="소유자 유형">
								{OWNER_TYPE_OPTIONS.map(option => (
									<button
										key={option.value}
										type="button"
										className={purchaseType === option.value ? 'active' : ''}
										onClick={() => handlePurchaseTypeSelect(option)}
									>
										{option.label}
									</button>
								))}
							</div>
							{/* 소유자 정보 입력 */}
							<div className="wa-form-body">

								{/* 개인 */}
								{purchaseType === 'NORMAL' &&
									<OwnerNormal
										dsNewCar={dsNewCar}
									    dsCarNoDetach={dsCarNoDetach}
										setDsNewCar={setDsNewCar}
										dsOwnerInfo={dsOwnerInfo}
										setDsOwnerInfo={setDsOwnerInfo}
										handleChange={handleChange}
										onSelect={handleAddressSelect}
										onSameChange={handleSameAddress}
										onClear={handleClearAddress}
										saveProcess={saveProcess}
									/>
								}

								{/* 리스 */}
								{purchaseType === 'LEASE' &&
									<OwnerLease
										dsNewCar={dsNewCar}
										setDsNewCar={setDsNewCar}
										dsCarNoDetach={dsCarNoDetach}
										dsBaseList={dsBaseList}
										setDsOwnerInfo={setDsOwnerInfo}
										handleChange={handleChange}
									/>
								}

								{/* 이용자명의 리스 */}
								{purchaseType === 'USER_LEASE' &&
									<OwnerUserLease
										dsNewCar={dsNewCar}
										setDsNewCar={setDsNewCar}
										dsCarNoDetach={dsCarNoDetach}
										dsBaseList={dsBaseList}
										setDsOwnerInfo={setDsOwnerInfo}
										handleChange={handleChange}
									/>}

								{/* 렌트 */}
								{purchaseType === 'RENT' &&
									<OwnerRent
										dsNewCar={dsNewCar}
										handleChange={handleChange}
									/>
								}
								<hr className="wa-divider hr2" />
							</div>
						</>
					)}

					{/* 번호판 정보 입력 */}
					{step === 2 &&
						<CarInfo
							dsNewCar={dsNewCar}
							dsCarNoDetach={dsCarNoDetach}
							handleChange={handleChange}
						/>
					}

					{/* 신규등록 정보 */}
					{step === 3 &&
						<NewcarInfo
							dsNewCar={dsNewCar}
							dsPaymentList={dsPaymentList}
							codes={codes}
							handleChange={handleChange}
							setDsNewCar={setDsNewCar}
							dsTaxReceipt={dsTaxReceipt}
                            setDsTaxReceipt={setDsTaxReceipt}
                            onTaxReceiptAddressSelect={handleTaxReceiptAddressSelect}
                            onTaxReceiptAddressClear={handleClearTaxReceiptAddress}
							setDsPaymentList={setDsPaymentList}
						/>
					}

					{/* 최종 확인 */}
					{step === 4 &&
						<ConfirmInfo
							dsNewCar={dsNewCar}
						/>
					}
					
				</div>
||||||| .r251
=======
>>>>>>> .r258
				
				
				<div className="wa-body">
					{isRentInput ? (
					    <>
					        <h2 className="wa-title rent">
					            렌트 차량 안내
					        </h2>
	
					        <div className="owner-corporate-box">
					            <div className="owner-corporate-info rent">
					                <CircleAlert
					                    className="owner-corporate-icon"
					                    size={24}
					                />
	
					                <div className="owner-corporate-text rent">
					                    <p>해당 차량은 렌트 차량입니다.</p>
										<p>렌트 등록은 렌터카 회사로 문의하여 진행해 주시기 바랍니다.</p>
					                </div>
					            </div>
					        </div>
					    </>
					) : (
					    <>
						{/* 현재 단계 제목 */}
						<h2 className="wa-title">
							{STEP_TITLES[step]}
						</h2>
	
						{/* 단계별 내용 */}
						{step === 1 && (
							<>
								<span className="wa-bold-span1">해당하는 차량 구매 방식을 선택해주세요.</span>
								{/* 소유자 유형 */}
								<div className="wa-owner-tabs" role="tablist" aria-label="소유자 유형">
									{OWNER_TYPE_OPTIONS.map(option => (
										<button
											key={option.value}
											type="button"
											className={purchaseType === option.value ? 'active' : ''}
											onClick={() => handlePurchaseTypeSelect(option)}
										>
											{option.label}
										</button>
									))}
								</div>
								{/* 소유자 정보 입력 */}
								<div className="wa-form-body">
	
									{/* 현금/할부 */}
									{purchaseType === 'NORMAL' &&
										<OwnerNormal
											dsNewCar={dsNewCar}
										    dsCarNoDetach={dsCarNoDetach}
											setDsNewCar={setDsNewCar}
											dsOwnerInfo={dsOwnerInfo}
											setDsOwnerInfo={setDsOwnerInfo}
											handleChange={handleChange}
											onSelect={handleAddressSelect}
											onSameChange={handleSameAddress}
											onClear={handleClearAddress}
											saveProcess={saveProcess}
										/>
									}
	
									{/* 리스 */}
									{purchaseType === 'LEASE' &&
										<OwnerLease
											dsNewCar={dsNewCar}
											setDsNewCar={setDsNewCar}
											dsCarNoDetach={dsCarNoDetach}
											dsBaseList={dsBaseList}
											setDsOwnerInfo={setDsOwnerInfo}
											handleChange={handleChange}
										/>
									}
	
									{/* 이용자명의 리스 */}
									{purchaseType === 'USER_LEASE' &&
										<OwnerUserLease
											dsNewCar={dsNewCar}
											setDsNewCar={setDsNewCar}
											dsCarNoDetach={dsCarNoDetach}
											dsBaseList={dsBaseList}
											setDsOwnerInfo={setDsOwnerInfo}
											handleChange={handleChange}
										/>}
	
									{/* 렌트 */}
									{purchaseType === 'RENT' &&
										<OwnerRent
											dsNewCar={dsNewCar}
											handleChange={handleChange}
										/>
									}
									<hr className="wa-divider hr2" />
								</div>
							</>
						)}
	
						{/* 번호판 정보 입력 */}
						{step === 2 &&
							<CarInfo
								dsService={dsService}
								dsNewCar={dsNewCar}
								setDsNewCar={setDsNewCar}
								dsCarNoDetach={dsCarNoDetach}
								dsUserInfo={dsUserInfo}
								handleChange={handleChange}
								saveProcess={saveProcess}
							/>
						}
	
						{/* 신규등록 정보 */}
						{step === 3 &&
							<NewcarInfo
								dsNewCar={dsNewCar}
								dsPaymentList={dsPaymentList}
								handleChange={handleChange}
							/>
						}
	
						{/* 최종 확인 */}
						{step === 4 &&
						    <ConfirmInfo
						        dsNewCar={dsNewCar}
						        onOpenAttachModal={() => setAttachModalOpen(true)}
						    />
						}
						
							</>
						)}
					</div>
					
					<div className="wa-form-actions">
					
						{step !== 1 && (
							<button
								type="button"
								className="wa-action-btn wa-prev-btn"
								disabled
							>
								<ChevronLeft size={16} strokeWidth={2.5} />
								이전
							</button>
						)}
					
						<button
							type="button"
							className="wa-action-btn wa-confirm-btn"
							disabled={saving}
							onClick={handleNext}
						>
							<span>
								{purchaseType === 'RENT' ? '확인' : '다음'}
							</span>
						</button>
	
						{(step !== 4 &&
							purchaseType !== 'RENT') &&	
							 (
							<button
								type="button"
								className="wa-action-btn wa-save-btn"
								onClick={() => saveProcess()}
							>
								{saving ? <LoaderCircle size={18} className="wa-spin" /> : ''}
								{saving ? '저장 중' : '저장'}
							</button>
						)}
					
					</div>
			</div>
			<WaNewcarAttachModal
			    open={attachModalOpen}
			    dsService={dsService}
			    dsNewCar={dsNewCar}
			    onClose={() => setAttachModalOpen(false)}
			    onOpenSmsModal={() => setSmsModalOpen(true)}
			/>

			<WaSendSmsModal
			    open={smsModalOpen}
			    dsNewCar={dsNewCar}
			    onClose={() => setSmsModalOpen(false)}
			/>
		</div>
	);
};

export default WaNewcarRequest;