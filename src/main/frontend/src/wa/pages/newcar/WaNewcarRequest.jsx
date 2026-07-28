﻿﻿ 
/* =========================================================
 * Import
 * ========================================================= */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';

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

// 파일 업로드 정책 가져오기
import {
    getAttachPolicy,
    getNtaxAttachPolicy,
	NTAX_POLICY
} from '../../../policy/attachPolicy';

// 화면
import CarInfo from './CarInfo';
import ConfirmInfo from './ConfirmInfo';
import NewcarInfo from './NewcarInfo';
import { calculateTotalFromRows } from './newcarAmountCalculator';
import OwnerNormal from './owner/OwnerNormal';
import OwnerLease from './owner/OwnerLease';
import OwnerUserLease from './owner/OwnerUserLease';
import OwnerRent from './owner/OwnerRent';
// 상세 조회 화면
import WaNewcarDetail from './WaNewcarDetail';
import WaNoticeModal from '../common/WaNoticeModal';

// Style
import '../../styles/wa.css';
import '../../styles/WaNewcarRequest.css';

/**
 * 신규등록 신청 화면의 전체 데이터 흐름
 *
 * 1. 최초 진입
 *    - 접수번호가 없으면 initProcess()가 /api/newcar/init을 호출한다.
 *    - 서버 기본값과 WaNewcarInitial.js의 초기값, 회사별 기본값을 병합해 화면 state를 만든다.
 *
 * 2. 기존 신청건 진입
 *    - 목록 또는 라우터에서 SERVICE_ID를 받으면 loadDetail()이
 *      /api/newcar/detail/{SERVICE_ID}를 호출해 저장된 신청 데이터를 다시 구성한다.
 *
 * 3. 사용자 입력
 *    - 각 자식 화면은 input/select의 data-type으로 변경할 state를 지정한다.
 *    - handleChange()가 data-type과 name을 읽어 dsService, dsNewCar,
 *      공동소유자, 번호판 탈부착, 세금계산서 state 중 하나를 갱신한다.
 *
 * 4. 단계 이동 및 저장
 *    - handleNext()/handlePrev() -> changeStep() 순서로 호출된다.
 *    - changeStep()은 필요한 검증과 파생값 계산 후 saveProcess()를 호출한다.
 *    - saveProcess()는 여러 state를 서버 요청 구조로 조합하고 processService()에 전달한다.
 *    - processService()는 /api/newcar/process로 저장한 뒤 reloadProcess()를 호출하여
 *      DB에 실제 저장된 값을 다시 조회하고 화면 state와 동기화한다.
 *
 * 5. 최종 요청
 *    - 최종 확인 단계의 요청 버튼은 requestWaitProcess()를 호출한다.
 *    - validateRequest()에서 필수값, 공동소유 비율, 첨부파일/서명을 확인한 뒤
 *      PROC_ST를 W_REQ로 변경하여 /api/newcar/process에 요청한다.
 */

/* =========================================================
 * Constant
 * ========================================================= */

// 회사별 기본값
// 값이 있으면 기존값과 관계없이 적용
const COMPANY_DEFAULT = {

    WA001: {
		DLVGB: ['GWANG', 'DAEGU', 'DAEJE', 'BUSAN', 'SEOUL', 'SUWON', 'JEJU', 'HANAM', 'ILSAN', 'INPUT'],
	},

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

const isEmptyRequiredValue = (value) => (
    value === null
    || value === undefined
    || String(value).trim() === ''
);

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

const NH_BOND_AREAS = new Set([
    '울산광역시',
    '강원도',
    '강원특별자치도',
    '경기도',
    '경상북도',
    '전라남도',
    '전라북도',
    '전북특별자치도',
    '충청남도',
    '충청북도',
    '인천광역시',
    '제주특별자치도'
]);

/**
 * 사용본거지와 채권 처리방식으로 TR_NEWCAR의 채권 연계 필드를 계산한다.
 * 반환값은 3단계에서 4단계로 이동할 때 dsNewCar에 합쳐지고 바로 저장된다.
 * 매입(BUY)은 은행 연계를 사용하지 않으므로 주소 판정보다 우선한다.
 */
const resolveBondBankFields = (baseAddress, busanBond, bondDc) => {
    if (String(bondDc || '').trim() === 'BUY') {
        return { BOND_LINK_YN: 'N', BOND_BANK_CD: '' };
    }

    const normalizedAddress = String(baseAddress || '').trim().replace(/\s+/g, ' ');
    const firstArea = normalizedAddress.split(' ')[0] || '';
    const area = ['경상남도 함양군', '경상남도 창원시'].find(
        candidate => normalizedAddress.startsWith(candidate)
    ) || firstArea;

    if (area === '서울특별시') {
        return { BOND_LINK_YN: 'Y', BOND_BANK_CD: '088' };
    }

    if (['대구광역시', '경상남도 함양군', '경상남도 창원시', '경상남도'].includes(area)) {
        return { BOND_LINK_YN: 'Y', BOND_BANK_CD: '011' };
    }

    if (NH_BOND_AREAS.has(area)) {
        return { BOND_LINK_YN: 'Y', BOND_BANK_CD: '011' };
    }

    if (area === '세종특별자치시') {
        return { BOND_LINK_YN: 'N', BOND_BANK_CD: '081' };
    }

    if (area === '광주광역시') {
        return { BOND_LINK_YN: 'N', BOND_BANK_CD: '034' };
    }

    if (area === '대전광역시') {
        return { BOND_LINK_YN: 'N', BOND_BANK_CD: '081' };
    }

    if (area === '부산광역시') {
        return String(busanBond || '').trim() === 'N'
            ? { BOND_LINK_YN: 'Y', BOND_BANK_CD: '004' }
            : { BOND_LINK_YN: 'N', BOND_BANK_CD: '032' };
    }

    return { BOND_LINK_YN: 'N', BOND_BANK_CD: '' };
};


// 상세조회 화면 표시 대상 상태
const DETAIL_PROC_STATUS = ['REQ', 'S_REQ', 'RET', 'END'];

// 신청 단계
const REQUEST_STEPS = [
    { no: 1, title: '소유자 정보', label: '소유자 정보 입력' },
    { no: 2, title: '자동차 정보', label: '자동차 정보 입력' },
    { no: 3, title: '신규등록 정보', label: '신규등록 정보 입력' },
    { no: 4, title: '최종 확인', label: '최종 확인' }
];
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


// 번호판 종류에 따른 번호판대(TNUM) 금액 조회
const getNumplateAmount = (companyId, numplateGb, paymentList) => {

    const companyPrice = COMPANY_NUMPLATE_PRICE[companyId] || {};
    const dbAmount = paymentList.find(item => item.PAY_KD === 'TNUM')?.PRE_PAY_AMT;

    return Number(dbAmount ?? companyPrice[numplateGb] ?? companyPrice.DEFAULT ?? 27500);
};

/**
 * 번호판 종류에 따른 번호판대와 총액을 계산한다.
 * 서버에서 받은 납부목록의 TNUM 행을 갱신하고, 변경된 목록을 기준으로
 * calculateTotalFromRows()를 호출하여 TR_NEWCAR.TOTAL_AMT에 대응하는 값을 만든다.
 */
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
            TOTAL_AMT: calculateTotalFromRows(dsPaymentList, newCar.CARD_YN) ?? 0
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
    onSaved,
	stepMemory
}) => {
	
/* =========================================================
 * State
 * 화면에서 사용하는 데이터
 * ========================================================= */
	// 목록에서 전달받은 접수번호. 값이 있으면 신규 초기화 대신 상세조회 흐름을 탄다.
	const [serviceId, setServiceId] = useState(initialServiceId);

	// TR_SERVICE 성격의 신청 공통정보: 처리상태, 주문번호, 회사/업무 구분 등을 보관한다.
	const [dsService, setDsService] = useState(initialDsService);
	// TR_NEWCAR 성격의 신규등록 본문: 소유자, 차량, 결제, 채권, 감면 정보를 보관한다.
	const [dsNewCar, setDsNewCar] = useState(initialDsNewCar);
	// 공동소유자 1, 2 정보. 대표소유자 비율과 합계가 100인지 최종 요청 전에 검증한다.
	const [dsOwnerInfo, setDsOwnerInfo] = useState(initialOwnerInfo);
	const [dsOwnerInfo1, setDsOwnerInfo1] = useState(initialOwnerInfo1);
	// 번호판 탈부착/배송 관련 정보와 세금계산서 발행정보를 각각 독립 state로 관리한다.
	const [dsCarNoDetach, setDsCarNoDetach] = useState(initialDsCarNoDetach);
	const [dsTaxReceipt, setDsTaxReceipt] = useState(initialDsTaxReceipt);

	// 초기조회 또는 상세조회 API가 함께 내려주는 보조 데이터 목록이다.
	const [dsBranchList, setDsBranchList] = useState(initialDsBranchList);
	const [dsBaseList, setDsBaseList] = useState(initialDsBaseList);
	// TR_PAYMENT 성격의 납부 항목 목록. 예상금액 계산과 총액 산출에도 사용한다.
	const [dsPaymentList, setDsPaymentList] = useState([]);
	// 회사 기본정보, 업무별 회사 설정, 로그인 사용자 정보는 조건 분기와 기본값에 사용한다.
	const [dsCompanyInfo, setDsCompanyInfo] = useState({});
	const [dsWorkCp, setDsWorkCp] = useState({});
	const [dsUserInfo, setDsUserInfo] = useState({});
	// 공통코드 그룹별 목록. CommonSelect와 코드명 표시에서 사용한다.
	const [codes, setCodes] = useState({});
	const [noticeOpen, setNoticeOpen] = useState(false); // 서류 안내창
	const [notice, setNotice] = useState(null); // 안내
	const [nextStep, setNextStep] = useState(null);

	// 화면 상태 ===
	// 소유자 유형 선택	
	const [purchaseType, setOwnerType] = useState('');
	// 첫번째 진행단계 step 설정
	const [step, setStep] = useState(1);
	// hocer 했을 때 파란 선 움직이는 효과
	const [hoverStep, setHoverStep] = useState(null);

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	
	// 주소 기능 사용
	const address = useAddressHandler({
	    dsNewCar,
	    dsBaseList,
	    dsOwnerInfo,
	    setDsNewCar,
	    setDsOwnerInfo,
	    setDsCarNoDetach
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
	
	// 소유자 정보 입력(탭)
	const ownerRef = useRef(null);
	// 자동차 정보 입력(탭)
	const deliveryRef = useRef(null);
	// 신규등록 정보 입력(탭)
	const paymentRef = useRef(null);

	
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
	// 처리상태가 '입력'이고, 신규등록 구분이 '렌트'인 경우 특정 화면을 보여줌  
	const isRentInput = dsService.PROC_ST === 'INPUT' && dsNewCar.TASK_CD === 'ADD';
	// 상세조회 화면 여부
	const isDetailPage = useMemo(() => {
	    if (DETAIL_PROC_STATUS.includes(dsService.PROC_ST)) {
	        return true;
	    }

	    if (
	        dsService.PROC_ST === 'W_REQ' &&
	        dsUserInfo.MEMBER_GB === 'SU'
	    ) {
	        return true;
	    }

	    return Boolean(dsService.JUDGE_ST);
	}, [
	    dsService.PROC_ST,
	    dsService.JUDGE_ST,
	    dsUserInfo.MEMBER_GB
	]);

/* =========================================================
 * Effect
 * ========================================================= */

	/**
	 * 화면 최초 1회 공통코드를 병렬 조회한다.
	 * gf.getCodes()는 일반 코드그룹, gf.getCodeDetails()는 상세 조건이 있는 코드를 가져온다.
	 * 조회 결과는 codes에 그룹 ID를 key로 저장되고 각 탭의 CommonSelect로 전달된다.
	 */
	useEffect(() => {
		if (hasLoadedCodesRef.current) {
			return;
		}

		const loadCodes = async () => {
			// 일반 화면코드와 공채 할인율 상세코드를 함께 가져옴.
			const [codeData, detailCodeData] = await Promise.all([
				gf.getCodes(['SGB', 'PR_ST', 'JG_ST', 'NEWGB', 'DELIV', 'TASK', 
				'BOND', 'NTTCD', 'NTTGR', 'NTACD', 'NTWHO', 'STAGB', 'DLVGB', 'DLADD', 'REGGB', 
				'NUMGB', 'CARM', 'FRTAX', 'GOVT', 'PAYME', 'PAYGB', 'INSUR', 'NUMST', 'IMPST',
				'PAYKD', 'PAYME', 'PAYOP', 'PAYST', 'PAYTP', 'BANK', 'FUEL', 'CARUS', 'NHOLE', 
				'NSEAL' 
			]),
				gf.getCodeDetails(['TUSE'])
			]);

			hasLoadedCodesRef.current = true;
			setCodes({
				...codeData,
				TUSE: detailCodeData?.TUSE || []
			});
		};

		loadCodes();
	}, [setCodes]);
	
	// 부모 목록에서 다른 신청건을 선택하면 전달받은 SERVICE_ID를 상세조회 기준값으로 반영한다.
	useEffect(() => {
	    if (!initialServiceId) {
	        return;
	    }

	    setServiceId(initialServiceId);
	}, [initialServiceId]);

	// serviceId가 바뀔 때마다 loadDetail()을 호출하여 해당 신청건의 모든 데이터셋을 재조회한다.
	useEffect(() => {
	    if (!serviceId) {
	        return;
	    }

	    loadDetail(serviceId);
		
	}, [serviceId]);
	

	
	/**
	 * 저장중인 화면(INPUT, SAV 등)은
	 * 마지막으로 작업하던 진행단계를 복원한다.
	 */
	useEffect(() => {

	    if (!dsService.SERVICE_ID) {
	        return;
	    }

	    if (isDetailPage) {
	        return;
	    }

	    const savedStep =
	        stepMemory?.get(dsService.SERVICE_ID);

	    if (savedStep) {
	        setStep(savedStep);
	    } else {
	        setStep(1);
	    }
 
	}, [
	    dsService.SERVICE_ID,
		isDetailPage
	]);
	
	
/* =========================================================
 * 사인 및 첨부서류 관련
 * ========================================================= */
	const [attachReady, setAttachReady] = useState(false);
	
	// 일반 첨부 정책	
	const attachPolicy = useMemo(
	    () => getAttachPolicy(dsNewCar),
	    [dsNewCar]
	);
	// 비과세 첨부 정책
	const ntaxPolicy = useMemo(
	    () => getNtaxAttachPolicy(dsNewCar),
	    [dsNewCar]
	);
	
	// 사인 및 서류 필요한 상황 
	const showAttach =
	    attachPolicy.needSign || attachPolicy.needUpload || ntaxPolicy.needUpload;
			
	// 첨부 완료 여부 반환
	const checkAttachReady = async () => {
		
		// 첨부 및 전자서명 완료 여부 확인
	    if (!showAttach) {
	        return {
	            ready: true,
	            message: ''
	        };
	    }
		console.log('SERVICE_ID', dsService.SERVICE_ID);
		
		if (!dsService.SERVICE_ID) {
		    return {
		        ready: false,
		    };
		}
		
		// 업로드된 첨부파일 조회
	    const res = await axios.get('/api/newcar/wa-attach-files', {
	        params: {
	            serviceId: dsService.SERVICE_ID
	        }
	    });

	    const attachFiles = res.data.list ?? [];
		
		// 업로드된 첨부파일 코드 목록
	    const uploadedCodes = new Set(
	        attachFiles.map(file => file.CODE)
	    );
		
		// 필수 첨부파일 목록
	    const requiredDocs = [
	        ...attachPolicy.requiredDocs,
	        ...ntaxPolicy.requiredDocs
	    ];

		// 필수 첨부파일 누락 여부
	    const hasMissing = requiredDocs.some(
	        doc => !uploadedCodes.has(doc.code)
	    );
		
		// 전자서명 파일 존재 여부
		const hasSignFile = uploadedCodes.has('SIGN');
		
		// 전자서명, 첨부파일 모두 누락
		if (attachPolicy.needSign && !hasSignFile && hasMissing) {
		    return {
		        ready: false,
		        message: '전자서명 및 첨부파일 업로드를 완료해주세요.'
		    };
		}
		
		// 전자서명이 필요한데 없는 경우
		if (attachPolicy.needSign && !hasSignFile) {
	        return {
	            ready: false,
	            message: '전자서명을 완료해주세요.'
	        };
	    }
		
		// 필수 첨부파일이 없는 경우
	    if (hasMissing) {
	        return {
	            ready: false,
	            message: '첨부파일 업로드를 완료해주세요.'
	        };
	    }

	    return {
	        ready: true,
	        message: ''
	    };
	};
	
	// 첨부 완료 여부 갱신(버튼에서 쓸 겨)
	useEffect(() => {

	    const load = async () => {
	        const result = await checkAttachReady();
	        setAttachReady(result.ready);
	    };

	    load();

	}, [
	    dsService.SERVICE_ID,
	    showAttach
	]);



/* =========================================================
 * * Event
 * ========================================================= */	
	/**
	 * 하단의 다음/요청 버튼 진입점.
	 * 1~3단계는 changeStep()으로 넘기고, 최종 확인 단계의 SU 요청은
	 * requestWaitProcess()로 분기한다. 렌트 선택 건은 일반 단계 진행 대신
	 * 직접등록 상태로 변경한 데이터를 saveProcess()에 전달한다.
	 */
	const handleNext = async (e) => {
	    e.preventDefault();
		
		// SU 사용자가 최종 확인에서 요청
		if (step === 4 && dsUserInfo.MEMBER_GB === 'SU') {
		    await requestWaitProcess();
		    return;
		}
		
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
			
			console.log("REQ_CAR_NO >>" + dsNewCar.REQ_CAR_NO);
			
			// 기존 번호 해제 API 호출
			await axios.post('/api/newcar/updateNumplateUseYn', {
			    serviceId: dsService.SERVICE_ID,
			    carNo: dsNewCar.REQ_CAR_NO
			});

			// 상태 초기화
			setDsNewCar(prev => ({ ...prev, REQ_CAR_NO: '' }));
			
			const newDsService = {
			    ...dsService,
			    PROC_ST: 'DIRCT',
			    JUDGE_ST: '',
				JUDGE_DT: '',
				TASK_CD: 'ADD',
			};

			const success = await saveProcess(
			    {...dsNewCar}, 'SAV', null, null, newDsService
			);
			
			console.log(success); // true 또는 false
			
			if(success) {
				// 부모 목록 재조회
			    onSaved?.();
				// 화면 닫기
			    onClose?.();
			}
			
			return;
	    }

	    switch (step) {
	        case 1:
	            changeStep(2); // 자동차 정보 입력
	            break;

	        case 2:
	            changeStep(3); // 신규등록 정보 입력
	            break;

	        case 3:
	            changeStep(4); // 최종 확인
	            break;

	        default:
	            break;
	    }
	};
	
	const handlePrev = async (e) => {
		e.preventDefault();
				
		switch (step) {
		    case 2:
		        changeStep(1);
		        break;

		    case 3:
		        changeStep(2);
		        break;

		    case 4:
		        changeStep(3);
		        break;

		    default:
		        break;
		}
	};
	
	/**
	 * 진행단계 변경과 현재 입력내용 저장을 한 번에 처리한다.
	 *
	 * - openNotice()가 안내 대상을 찾으면 실제 이동을 중단하고 모달을 먼저 연다.
	 * - 앞으로 이동할 때 현재 탭부터 이동 직전 탭까지 단계별 필수값을 검사한다.
	 * - 3 -> 4 이동은 검증 통과 후 채권은행 파생값을 계산한다.
	 * - 파생값을 합친 newCarForSave를 saveProcess()에 직접 넘겨 React state의
	 *   비동기 갱신 시점과 관계없이 같은 값이 DB에 저장되도록 한다.
	 * - 상세조회 화면이 아니면 stepMemory에 마지막 작업 단계를 보관한다.
	 */
	const changeStep = async (nextStep, skipNotice = false) => {

		// 앞으로 이동할 때는 현재 탭부터 이동 직전 탭까지 순서대로 검사한다.
		// 상단 단계 번호로 여러 단계를 건너뛰어도 중간 단계의 필수값을 빠뜨릴 수 없다.
		if (nextStep > step) {
			const validation = validateRequiredSteps(step, Math.min(nextStep - 1, 3));

			if (validation.message) {
				await gf.alert(validation.message);

				if (validation.step !== step) {
					setStep(validation.step);
				}

				return false;
			}
		}
		
	    if (!skipNotice) {
	        if (openNotice(step, nextStep)) {
	            return;
	        }
	    }
		
		let newCarForSave = null;
		// 3 -> 4로 넘어갈 때 주소와 채권 처리방식에 맞는 채권은행 값을 저장한다.
	    if (step === 3 && nextStep === 4) {
			const busanBond = (
				dsNewCar.BUSAN_BOND
				?? dsNewCar.BUSAN_BOND_YN
				?? dsWorkCp?.BUSAN_BOND
				?? dsWorkCp?.BUSAN_BOND_YN
				?? dsCompanyInfo?.BUSAN_BOND
				?? dsCompanyInfo?.BUSAN_BOND_YN
				?? ''
			);
			const bondBankFields = resolveBondBankFields(
				dsNewCar.BASE_ADDRESS,
				busanBond,
				dsNewCar.BOND_DC
			);

			newCarForSave = {
				...dsNewCar,
				...bondBankFields
			};

			setDsNewCar(prev => ({
				...prev,
				...bondBankFields
			}));
	    }

	    try {
	        // 현재 내용 저장
	        await saveProcess(
				newCarForSave,
				"SAV",
				null,
				null,
				null,
				true
			);
	    } catch (e) {
	        console.error(e);
	    } finally {
	        // 저장 성공 여부와 관계없이 단계 이동
	        setStep(nextStep);

	        if (
	            !isDetailPage &&
	            dsService.SERVICE_ID &&
	            stepMemory
	        ) {
	            stepMemory.set(dsService.SERVICE_ID, nextStep);
	        }
	    }
	};
	
	// 서류안내 모달창
	const openNotice = (currentStep, nextStep) => {

	    // 1 -> 2
	    if (currentStep === 1 && nextStep === 2) {
			
	        if (noticeCheck.items.length || noticeCheck.checks.length) {
	            setNotice(noticeCheck);
	            setNextStep(2);
	            setNoticeOpen(true);
	            return true;
	        }
	    }

	    // 3 -> 4
	    if (currentStep === 3 && nextStep === 4) {

			if (
			    exemptionNotice &&
			    (exemptionNotice.items.length || exemptionNotice.checks.length)
			) {
			    setNotice(exemptionNotice);
			    setNextStep(4);
			    setNoticeOpen(true);
			    return true;
			}
	    }

	    return false;
	};
	
	// 차량 구매 방식 정보 저장
	const handlePurchaseTypeSelect = async (option) => {
		console.log(purchaseType);
		
		// 업무 구분 변경시 초기화 될 정보 (공동명의 테이블)		
	    if (dsOwnerInfo.DEBTOR_NM ||
			dsOwnerInfo.DEBTOR_GB ||
	        dsOwnerInfo.DEBTOR_REG_NO ||
	        dsOwnerInfo.DEBTOR_BIZ_NO ||
	        dsOwnerInfo.DEBTOR_RATIO) {
			
			let msg_title;
			let msg_text;
			
			if(purchaseType === 'NORMAL') {
				msg_title = '공동명의 삭제';
				msg_text = '공동명의 정보를 삭제하시겠습니까?\n확인을 누르면 공동명의 정보가 삭제되며, 단독소유로 변경됩니다.';
			}
			
			else if(purchaseType === 'LEASE') {
				msg_title = '리스 계약자 정보 삭제';
				msg_text = '리스 계약자 정보를 삭제하시겠습니까?\n확인을 누르면 리스 계약자 정보가 삭제 됩니다.';
			}
			
			if(purchaseType !== 'USER_LEASE') {
				const ok = await gf.confirm(msg_text, msg_title);
						
				if (!ok) {
				    return;
				}
			}


	        setDsOwnerInfo(prev => ({
	            ...prev,
	            DEBTOR_GB: '',
	            DEBTOR_NM: '',
	            DEBTOR_REG_NO: '',
	            DEBTOR_BIZ_NO: '',
	            DEBTOR_RATIO: '',
	            DEBTOR_TEL_NO: '',
	            DEBTOR_ADDR: '',
	            DEBTOR_ADDR_DT: '',
	            DEBTOR_ROAD_CD: ''
	        }));

			// 대표소유자 비율도 단독소유로 변경
			setDsNewCar(prev => ({
			    ...prev,
			    RATIO_NO: '100',
			}));
	    }
		
		if(['LEASE', 'USER_LEASE'].includes(purchaseType)) {
			clearLeaseAddress();
		}
		
        setDsNewCar(prev => ({
            ...prev,
            TASK_CD: option.taskCd,
            PROC_CD: option.procCd
        }));

	    setOwnerType(option.value);
	};

	const clearLeaseAddress = () => {
	    setDsNewCar(prev => ({
	        ...prev,

	        // 소유자 주소
	        ADDRESS: '',
	        ADDRESS_DT: '',
	        POST_NO: '',
	        BUBJUNG_CD: '',
	        RT_ACC_NM: '',
	        ADDR_INFO: '',

	        // 사용본거지
	        BASE_BRANCH_ID: '',
	        BASE_ADDRESS: '',
	        BASE_ADDRESS_DT: '',
	        BASE_POST_NO: '',
	        BASE_BUBJUNG_CD: '',
	        RT_ACC_NO: '',
	        ADDR_INFO2: ''
	    }));
	};
	
	/**
	 * 모든 탭의 input/select가 공유하는 변경 핸들러.
	 *
	 * 자식 컴포넌트는 name에 DB/데이터셋 필드명, data-type에 대상 state를 넣는다.
	 * - newcar: dsNewCar
	 * - service: dsService
	 * - detach: dsCarNoDetach
	 * - taxReceipt: dsTaxReceipt
	 * - company: dsCompanyInfo
	 * - owner / owner1: 공동소유자 state
	 *
	 * 차대번호 대문자 변환, 금액의 쉼표 제거, 대표/공동소유 비율 계산처럼
	 * 단순 대입 외의 보정도 이 함수에서 수행한다.
	 */
	const handleChange = async (e) => {
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
		} else if (dataset.type === 'detach') {
			setDsCarNoDetach(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'taxReceipt') {
			setDsTaxReceipt(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'company') {
			setDsCompanyInfo(prev => ({ ...prev, [name]: v }));
		} else if (dataset.type === 'owner') {
		    // 공동소유자 비율 변경 시
			if (name === 'DEBTOR_RATIO') {

			    if (v === '') {
			        setDsOwnerInfo(prev => ({
			            ...prev,
			            DEBTOR_RATIO: ''
			        }));

			        setDsNewCar(prev => ({
			            ...prev,
			            RATIO_NO: '100'
			        }));
			        return;
			    }

			    let ratio = Number(v);
				
				// 숫자가 아닌 경우 ex.NaN
				if (Number.isNaN(ratio)) {
				    ratio = '';
				}

			    if (ratio < 0 || ratio === 0) {
			        ratio = '';
			        await gf.alert("공동명의 비율은 1부터 입력이 가능합니다.", "공동명의 비율 확인");
			    } else if (ratio >= 100) {
			        ratio = 99;
			        await gf.alert("공동명의 비율은 100 미만이어야 합니다.", "공동명의 비율 확인");
			    }

			    setDsOwnerInfo(prev => ({
			        ...prev,
			        DEBTOR_RATIO: String(ratio)
			    }));

			    setDsNewCar(prev => ({
			        ...prev,
			        RATIO_NO: String(100 - ratio)
			    }));
				
				return;
			} 
			
	        setDsOwnerInfo(prev => ({
	            ...prev,
	            [name]: v
	        }));
		} else if (dataset.type === 'owner1') {
			setDsOwnerInfo1(prev => ({ ...prev, [name]: v }));
		} 
	};

	/**
	 * 저장된 신청건 상세조회.
	 *
	 * GET /api/newcar/detail/{SERVICE_ID}
	 *   -> dsService, dsNewCar, 공동소유자, 결제목록, 번호판/세금계산서 정보,
	 *      회사/업무/사용자 보조정보를 한 번에 받는다.
	 *
	 * 날짜 포맷을 정리한 뒤 mapData()로 서버 응답 필드를 화면 초기 구조에 맞추고,
	 * getNumplateResult()로 번호판대와 총액을 다시 계산한 결과를 각 state에 넣는다.
	 */
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
				
				// 구매방식 선택: 값 없으면 아무것도 안 누른 상태로 뜸
				if (result.dsNewCar.TASK_CD === 'LEASE' && result.dsNewCar.PROC_CD === 'I') {
				    setOwnerType('LEASE'); // 리스
				}
				else if (result.dsNewCar.TASK_CD === 'LEASE' && result.dsNewCar.PROC_CD === 'C') {
				    setOwnerType('USER_LEASE'); // 이용자명의 리스
				}
				else if (result.dsNewCar.TASK_CD === 'ADD' && result.dsNewCar.PROC_CD === 'I') {
				    setOwnerType('RENT'); // 렌트
				}
				else if (result.dsNewCar.TASK_CD === 'NORML' && result.dsNewCar.PROC_CD === 'I') {
				    setOwnerType('NORMAL'); // 일반등록
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
	
	/**
	 * 저장 전에 감면/카드 선택값을 DB 저장 규칙에 맞게 정규화한다.
	 * 감면 대상이 없으면 감면 적용/등급 코드를 0으로 되돌리고,
	 * 체크되지 않은 카드납부 값은 항상 N으로 저장한다.
	 */
	const normalizePaymentOptionFields = (newCar = {}) => {
		const normalized = { ...newCar };
		const exemptionTargetCode = String(normalized.NTAX_TRGET_CD ?? '').trim();

		if (!exemptionTargetCode || exemptionTargetCode === '00') {
			normalized.NTAX_APPLC_CD = '0';
			normalized.NTAX_TRGET_GR_CD = '0';
		}

		normalized.CARD_YN = normalized.CARD_YN === 'Y' ? 'Y' : 'N';
		return normalized;
	};

	/**
	 * 현재 화면 state를 /api/newcar/process 요청 데이터셋으로 조립한다.
	 *
	 * 인자로 최신 계산 결과가 전달되면 state보다 인자값을 우선 사용한다.
	 * 이 방식은 예상금액 계산이나 단계 이동 직후처럼 setState 반영을 기다리지 않고
	 * 즉시 저장해야 할 때 사용한다.
	 *
	 * 처리 순서:
	 * 1. dsService/dsNewCar/소유자/번호판/세금계산서/결제목록을 복사한다.
	 * 2. 법인번호판 조건과 감면/카드 기본값을 보정한다.
	 * 3. formatNumberData()로 하이픈과 금액 쉼표를 제거한다.
	 * 4. 처리상태를 SAV로 정리한 뒤 processService()를 호출한다.
	 */
	const saveProcess = async (
	    newDsNewCar = null,
	    proc = "SAV",
	    newDsPaymentList = null, // 사전조회 계산 결과 저장용
		newDsOwnerInfo = null, 	// 공동소유자 정보 저장용
		newDsService = null,
		silent = false,  // alert 안 띄우기 위해
		newDsCarNoDetach = null
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
		    dsNewCar: normalizePaymentOptionFields(newDsNewCar ? { ...newDsNewCar } : { ...dsNewCar }),
			dsOwnerInfo: newDsOwnerInfo ? { ...newDsOwnerInfo } : { ...dsOwnerInfo },
		    dsOwnerInfo1,
			dsCarNoDetach: newDsCarNoDetach ? { ...newDsCarNoDetach } : { ...dsCarNoDetach },
            dsTaxReceipt,

		    dsPaymentList: newDsPaymentList ? [...newDsPaymentList] : [...dsPaymentList]
		};
		
		// 법인번호판 대상이 아닌 경우
		const isCorpNumplate =
		    newDataSet.dsNewCar.REG_GB === 'B' &&
		    Number(newDataSet.dsNewCar.BUY_AMT || 0) >= 80000000;

		// 법인번호판이 아닌데 G 계열 번호판이면 전기(7)로 변경
		if (
		    !isCorpNumplate &&
		    String(newDataSet.dsNewCar.NUMPLATE_GB).includes('G')
		) {
		    newDataSet.dsNewCar.NUMPLATE_GB = '7';
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
	    return await processService(newDataSet, proc, silent);
	};
	

	/**
	 * 서버 저장 API를 호출하고 저장 결과를 화면에 반영한다.
	 * POST /api/newcar/process는 proc 값과 dsService.PROC_ST에 따라
	 * 신규 INSERT, 수정 UPDATE, 요청 상태변경 등을 서버에서 처리한다.
	 *
	 * 성공하면 최초 발급된 SERVICE_ID를 라우터 state에 기록하고,
	 * reloadProcess()로 DB 값을 다시 조회한다. 따라서 저장 후 화면에는
	 * 프런트의 임시값이 아니라 서버에서 확정된 값이 표시된다.
	 */
	const processService = async (newDataSet, proc, silent) => {

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

				if(proc !== "NUM_SAV" && !silent) {
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
	

	/**
	 * 저장 후 화면 데이터 동기화.
	 * SERVICE_ID가 있으면 loadDetail()로 기존 건을 재조회하고,
	 * 없으면 initProcess()로 신규 신청 기본값을 다시 구성한다.
	 * 현재 step은 변경하지 않아 사용자가 보던 탭을 유지한다.
	 */
	const reloadProcess = async (targetServiceId = '') => {
		
		// 로딩 시작
		const startTime = Date.now();
		setLoading(true);

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
	

	/**
	 * 신규 신청 화면 초기화.
	 *
	 * GET /api/newcar/init에서 로그인 사용자 기준 회사정보, 업무설정,
	 * 지점/사용본거지 목록, 신규등록 기본 데이터와 초기 납부항목을 받는다.
	 *
	 * 병합 우선순위:
	 * 1. 서버가 내려준 DB 기본값
	 * 2. WaNewcarInitial.js의 화면 기본 구조와 누락 필드
	 * 3. COMPANY_DEFAULT의 회사별 강제 기본값
	 */
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

	/**
	 * SU 사용자가 최종 확인 단계에서 요청할 때 실행한다.
	 * validateRequest() 통과 후 PROC_ST를 W_REQ로 바꾸고,
	 * 감면 전자서명이 필요한 경우 dsExemption 데이터도 함께 구성하여 저장 요청한다.
	 */
	const requestWaitProcess = async () => {
		
		// 저장 및 요청일 때만 요청할 수 있게 => 신청대기 변경
		if(!['C_REQ', 'SAV'].includes(dsService.PROC_ST)) {
			gf.alert('저장 및 요청 상태일 때만 요청 가능합니다.');
		    return;
		}
		
		// 필수 입력값 체크
		const validMsg = await validateRequest(true);

		if (validMsg) {
			gf.alert(validMsg);
			return;
		}
		
		const ok = await gf.confirm('요청하시겠습니까?', '요청 확인');
		
		if (!ok) {
		    return;
		}

	    const newDataSet = {
	        dsService: {
	            ...dsService,
	            PROC_ST: 'W_REQ' // 신청대기
	        },
	        dsNewCar: { ...dsNewCar },
	        dsOwnerInfo,
	        dsOwnerInfo1,
	        dsCarNoDetach,
			dsTaxReceipt,
	        dsPaymentList: [...dsPaymentList]
	    };
		
		// 감면신청서 데이터 추가
		if (attachPolicy.needSign) {

		    const ntaxReason =
		        NTAX_POLICY[dsNewCar.NTAX_TRGET_CD]?.NAME || '';

		    const ntaxDocuments =
		        (ntaxPolicy.requiredDocs || [])
		            .map(doc => doc.name)
		            .join(', ');

		    newDataSet.dsExemption = {
		        REASON: ntaxReason,
		        DOCUMENT: ntaxDocuments
		    };
		}

		await processService(newDataSet, "REQ");
	};
	

	/**
	 * 최종 요청 전 전체 유효성 검사.
	 * 1~3단계 필수값, 필수 첨부/전자서명, 차대번호 길이,
	 * 대표·공동소유자 비율과 공동소유자 인적사항을 순서대로 확인한다.
	 * 오류가 있으면 사용자에게 표시할 첫 번째 메시지를 반환한다.
	 */
	const validateRequest = async (moveToInvalidStep = false) => {

		// 최종 요청에서는 1~3단계를 처음부터 다시 검사한다.
		const requiredValidation = validateRequiredSteps(1, 3);

		if (requiredValidation.message) {
			if (moveToInvalidStep && requiredValidation.step) {
				setStep(requiredValidation.step);
			}

			return requiredValidation.message;
		}
		
		// 서명 및 첨부파일 확인
		const result = await checkAttachReady();

		setAttachReady(result.ready);

		if (!result.ready) {
		    return result.message;
		}

		if (gf.Check(dsNewCar.CARID_NO, '차대번호', 17)) {
			return '차대번호를 확인해주세요.';
		}

		if (
			purchaseType === 'NORMAL'
			&& Boolean(validateJointOwner())
			&& dsNewCar.RATIO_NO < 100
		) {
			// TODO 대표소유자 비율이 100% 이하인경우에는 공동소유자가 존재해야한다.
			// 대표소유자 비율 + 공동소유자 비율의 합이 100%가 되어야 한다.	(공동소유자 비율 0이상, 대표소유자 비율 100 이하 둘의 합이 100이 아닐경우)
			if (dsOwnerInfo.DEBTOR_RATIO > 0 && dsOwnerInfo.DEBTOR_RATIO <= 100 && Number(dsNewCar.RATIO_NO) + Number(dsOwnerInfo.DEBTOR_RATIO) !== 100) {
				return '대표소유자 + 공동소유자 비율을 확인해주세요 둘의 합은 100%이어야 합니다.';				
			}
			else {
				// 공동소유자2명인 경우 총합이 100이 안되는지 확인
				if (dsOwnerInfo.DEBTOR_RATIO > 0 && dsOwnerInfo.DEBTOR_RATIO <= 100 
				 && dsOwnerInfo1.DEBTOR_RATIO > 0 && dsOwnerInfo1.DEBTOR_RATIO <= 100 
				 && Number(dsNewCar.RATIO_NO) + Number(dsOwnerInfo.DEBTOR_RATIO) + Number(dsOwnerInfo1.DEBTOR_RATIO) !== 100) {
					return '대표소유자 + 공동소유자1 + 공동소유자2 비율을 확인해주세요 둘의 합은 100%이어야 합니다.';
				}
				// 공동소유자 비율 합이 100%인경우 성명, 등록번호 주소체크
				if (dsOwnerInfo.DEBTOR_NM === '' || dsOwnerInfo.DEBTOR_REG_NO === '' || dsOwnerInfo.DEBTOR_ADDR === '') {
					return '공동소유자의 정보를 입력해주세요.';
				}
			}
		} else if (purchaseType === 'NORMAL' && Boolean(validateJointOwner())) {
			// 대표소유자 비율이 100%인 경우 공동소유자 정보가 없어야 한다.
			if (dsOwnerInfo.DEBTOR_RATIO > 0) {
				return '대표소유자 비율이 100%인 경우 공동소유자 비율은 0%이어야 합니다.';
			}
			
			// 2026.07.28 리스계약자 정보, 이용자명의리스 일 때 정보가 들어가야 돼서 지움
			/*
			if (dsOwnerInfo.DEBTOR_NM || dsOwnerInfo.DEBTOR_REG_NO || dsOwnerInfo.DEBTOR_ADDR) {
				return '대표소유자 비율이 100%인 경우 공동소유자 정보는 입력할 수 없습니다.';
			}*/
		}
		
		if (
			dsNewCar.NTAX_TRGET_CD
			&& dsNewCar.NTAX_TRGET_CD !== '00'
			&& !dsNewCar.NTAX_WHO
		) {
			return '비과세대상자 정보를 입력해주세요.';
		}
		
		return '';
	};
	
	
	const requireValue = (value, label) => (
		isEmptyRequiredValue(value) ? `${label}를(을) 입력해주세요.` : ''
	);

	const requireDigitLength = (value, length, label) => {
		const requiredMessage = requireValue(value, label);

		if (requiredMessage) {
			return requiredMessage;
		}

		return onlyDigits(value).length === length
			? ''
			: `${label} ${length}자리를 정확히 입력해주세요.`;
	};

	// 휴대폰번호 입력란의 고정값인 010만 있는 경우는 미입력으로 처리한다.
	const requirePhoneNumber = (value, label) => {
		const digits = onlyDigits(value);

		if (!digits || digits === '010') {
			return `${label}를(을) 입력해주세요.`;
		}

		return digits.length === 11
			? ''
			: `${label}는 11자리로 입력해주세요.`;
	};

	const requireTextLength = (value, length, label) => {
		const requiredMessage = requireValue(value, label);

		if (requiredMessage) {
			return requiredMessage;
		}

		return String(value).trim().length === length
			? ''
			: `${label} ${length}자리를 정확히 입력해주세요.`;
	};

	const validateJointOwner = () => {
		if (purchaseType !== 'NORMAL') {
			return '';
		}

		const representativeRatio = Number(dsNewCar.RATIO_NO);
		const firstRatio = Number(dsOwnerInfo.DEBTOR_RATIO || 0);
		const secondRatio = Number(dsOwnerInfo1.DEBTOR_RATIO || 0);
		const hasFirstOwnerInfo = Boolean(
			firstRatio
			|| dsOwnerInfo.DEBTOR_NM
			|| dsOwnerInfo.DEBTOR_REG_NO
			|| dsOwnerInfo.DEBTOR_BIZ_NO
			|| dsOwnerInfo.DEBTOR_ADDR
		);
		const hasSecondOwnerInfo = Boolean(
			secondRatio
			|| dsOwnerInfo1.DEBTOR_NM
			|| dsOwnerInfo1.DEBTOR_REG_NO
			|| dsOwnerInfo1.DEBTOR_BIZ_NO
			|| dsOwnerInfo1.DEBTOR_ADDR
		);

		if (!Number.isFinite(representativeRatio) || representativeRatio < 0 || representativeRatio > 100) {
			return '대표소유자 비율을 확인해주세요.';
		}

		if (representativeRatio === 100) {
			return hasFirstOwnerInfo || hasSecondOwnerInfo
				? '대표소유자 비율이 100%인 경우 공동소유자 정보를 입력할 수 없습니다.'
				: '';
		}

		if (firstRatio <= 0) {
			return '공동소유자1 비율을 입력해주세요.';
		}

		for (const [owner, ownerNo] of [[dsOwnerInfo, 1], [dsOwnerInfo1, 2]]) {
			const ratio = Number(owner.DEBTOR_RATIO || 0);

			if (ratio <= 0) {
				continue;
			}

			const registrationNo = owner.DEBTOR_GB === 'C'
				? owner.DEBTOR_BIZ_NO
				: owner.DEBTOR_REG_NO;
			const ownerMessage = (
				requireValue(owner.DEBTOR_NM, `공동소유자${ownerNo} 성명`)
				|| requireValue(owner.DEBTOR_GB, `공동소유자${ownerNo} 등록구분`)
				|| requireValue(registrationNo, `공동소유자${ownerNo} 등록번호`)
				|| requireValue(owner.DEBTOR_ADDR, `공동소유자${ownerNo} 주소`)
			);

			if (ownerMessage) {
				return ownerMessage;
			}
		}

		return representativeRatio + firstRatio + secondRatio === 100
			? ''
			: '대표소유자와 공동소유자 비율의 합은 100%이어야 합니다.';
	};

	const validateOwnerStep = () => {
		let message = requireValue(purchaseType, '차량 구매 방식')
			|| requireValue(dsNewCar.TASK_CD, '업무구분');

		if (message) {
			return message;
		}

		if (purchaseType === 'LEASE') {
			const debtorRegistrationNo = dsOwnerInfo.DEBTOR_GB === 'C'
				? dsOwnerInfo.DEBTOR_BIZ_NO
				: dsOwnerInfo.DEBTOR_REG_NO;

			return requireValue(dsNewCar.BASE_BRANCH_ID, '리스사')
				|| requireValue(dsOwnerInfo.DEBTOR_NM, '리스 계약자명')
				|| requireValue(dsOwnerInfo.DEBTOR_GB, '리스 계약자 등록구분')
				|| requireValue(debtorRegistrationNo, '리스 계약자 등록번호')
				|| requirePhoneNumber(dsOwnerInfo.DEBTOR_TEL_NO, '리스 계약자 휴대폰번호')
				|| requireValue(dsNewCar.BASE_ADDRESS, '리스사 사용본거지 주소');
		}

		message = requireValue(dsNewCar.OWNER_NM, '대표소유자명')
			|| requireValue(dsNewCar.REG_GB, '등록번호 구분')
			|| requireDigitLength(dsNewCar.REG_NO, 13, '등록번호')
			|| (purchaseType !== 'USER_LEASE'
				? requirePhoneNumber(dsNewCar.MPHONE_NO, '휴대폰번호')
				: '')
			|| requireValue(dsNewCar.ADDRESS, '소유자 주소')
			|| requireValue(dsNewCar.BASE_ADDRESS, '사용본거지 주소')
			|| requireValue(dsNewCar.RATIO_NO, '대표소유자 비율');

		if (message) {
			return message;
		}

		if (dsNewCar.REG_GB === 'B') {
			message = requireDigitLength(dsNewCar.BIZ_NO, 10, '사업자등록번호');
		}

		if (!message && purchaseType === 'USER_LEASE') {
			message = requireValue(dsNewCar.BASE_BRANCH_ID, '리스사')
				|| requireValue(dsNewCar.IMSIGV_DT, '리스 종료일');
		}

		return message || validateJointOwner();
	};

	const validateCarStep = () => {
		const message = requireTextLength(dsNewCar.CARID_NO, 17, '차대번호')
			|| requireValue(dsNewCar.CAR_NM, '차량명')
			|| (Number(dsNewCar.BUY_AMT || 0) > 0 ? '' : '공급가액을 입력해주세요.')
			|| requireValue(dsNewCar.NUMPLATE_GB, '번호판 종류')
			|| requireValue(dsNewCar.REQ_CAR_NO, '차량번호')
			|| requireValue(dsCarNoDetach.DELIVERY_GB, '번호판 배송지');

		if (message) {
			return message;
		}

		return dsCarNoDetach.DELIVERY_GB === 'INPUT'
			? requireValue(dsCarNoDetach.DELIVERY_ADDR, '번호판 배송지 주소')
			: '';
	};

	const validateRegistrationStep = () => {
		let message = requireValue(dsNewCar.PAY_GB, '결제구분')
			|| requireValue(dsNewCar.BOND_DC, '채권 처리 방식')
			|| requirePhoneNumber(dsNewCar.PAY_HP_NO, '결제자 연락처')
			|| requireValue(dsNewCar.RETURN_NM, '환불 예금주')
			|| requireValue(dsNewCar.RT_BANK_CD, '환불 계좌 은행')
			|| requireValue(dsNewCar.RETURN_NO, '환불 계좌번호');

		if (message) {
			return message;
		}

		const exemptionTargetCode = String(dsNewCar.NTAX_TRGET_CD || '');

		if (exemptionTargetCode && exemptionTargetCode !== '00') {
			message = requireValue(dsNewCar.NTAX_WHO, '감면 대상자')
				|| requireValue(dsNewCar.NTAX_TRGET_GR_CD, '감면 등급');
		}

		if (!message && dsTaxReceipt.GUBUN === 'CASH') {
			message = requirePhoneNumber(dsTaxReceipt.PHONE_NO, '현금영수증 휴대폰번호');
		}

		if (!message && dsTaxReceipt.GUBUN === 'TAX') {
			message = requireDigitLength(dsTaxReceipt.REG_NO, 10, '세금계산서 등록번호')
				|| requireValue(dsTaxReceipt.COMPANY_NM, '세금계산서 상호명')
				|| requireValue(dsTaxReceipt.NAME, '세금계산서 대표자명')
				|| requireValue(dsTaxReceipt.ADDR, '세금계산서 사업장주소')
				|| requireValue(dsTaxReceipt.BUSINESS_TYPE, '세금계산서 업태')
				|| requireValue(dsTaxReceipt.INDUSTRY_TYPE, '세금계산서 업종')
				|| requireValue(dsTaxReceipt.MAIL1, '세금계산서 이메일주소');
		}

		return message;
	};

	const validateStepRequiredFields = (targetStep) => {
		const validators = {
			1: validateOwnerStep,
			2: validateCarStep,
			3: validateRegistrationStep
		};
		const message = validators[targetStep]?.() || '';

		return { step: targetStep, message };
	};

	const validateRequiredSteps = (fromStep = 1, toStep = 3) => {
		for (let targetStep = fromStep; targetStep <= toStep; targetStep += 1) {
			const result = validateStepRequiredFields(targetStep);

			if (result.message) {
				return result;
			}
		}

		return { step: null, message: '' };
	};

	// 요청 가능 여부 갱신1(버튼 비활성화용, css용)
	const [requestDisabled, setRequestDisabled] = useState(false);
	
	// 요청 가능 여부 갱신2
	useEffect(() => {

	    const check = async () => {

	        // 요청 가능 여부 확인
	        const msg = await validateRequest();

	        // 요청 불가 시 버튼 비활성화
	        setRequestDisabled(!!msg);
	    };

	    check();

	}, [
	    dsNewCar,
	    dsOwnerInfo,
	    dsOwnerInfo1,
	    dsService.SERVICE_ID,
	    showAttach
	]);
	
	// 서류 안내창
	const noticeCheck = useMemo(() => {

	    const items = [];
	    const checks = [];
	    const footer = [];
		
		let normalCheck = false;
		
	    if((dsNewCar.TASK_CD === 'NORML' || 
			(dsNewCar.TASK_CD === 'LEASE' && dsNewCar.PROC_CD === 'C')) && 
			 dsNewCar.REG_GB === 'F') {
	        items.push('외국인등록증');
			normalCheck = true;
	    }
		
		if (dsOwnerInfo.DEBTOR_GB === 'F') {
			
	        items.push('공동명의자 외국인등록증');
			normalCheck = true;
	    }

		if (String(dsNewCar.RATIO_NO) !== '100') {
	        items.push('공동명의 동의서');
	        items.push('신분증 사본(대표소유자 및 공동명의자)');
			normalCheck = true;
	    }
		
		if (dsNewCar.TASK_CD === 'LEASE' && dsNewCar.PROC_CD === 'C') {
		    items.push('리스계약서');
			checks.push('이용자명의 리스로 차량 등록 시 리스계약서가 필요합니다.\n최종확인 페이지에서 리스계약서를 제출해 주세요.');
		}
		
		if(normalCheck) {
			checks.push('해당 고객님은 서류 제출 대상자입니다.\n최종확인 페이지에서 위 서류를 제출해 주세요.');
		}

	    return {
	        title: '서류 안내',
	        items,
	        checks,
	        footer
	    };

	}, [dsNewCar, dsOwnerInfo]);
	

	// 감면 안내창
	const exemptionNotice = useMemo(() => {
		
		const isExempt = attachPolicy.needSign || ntaxPolicy.needUpload;
		
		// 감면 안내가 필요 없으면 모달 자체를 띄우지 않음
		if (!isExempt) {
		    return null;
		}
		
		const items = [];
		const checks = [];
		const footer = [];

		let normalCheck = false;

		// 감면 대상
		if (dsNewCar.NTAX_WHO === 'REPRE') {
			items.push('감면 대상 : 대표소유자');
			normalCheck = true;
		}
		else if (dsNewCar.NTAX_WHO === 'UNION') {
			items.push('감면 대상 : 공동소유자');
			normalCheck = true;
		}
	
		// 감면 유형 
		const nType = (codes.NTTCD || []).find(
		    item => item.CODE_ID === dsNewCar.NTAX_TRGET_CD
		);
		
		if (nType) {
		    items.push(`감면 유형 : ${nType.CODE_NM}`);
		}
		
		// 감면 등급
		const nGrade = (codes.NTTGR || []).find(
		    item => item.CODE_ID === dsNewCar.NTAX_TRGET_GR_CD
		);
		
		// 등급을 선택했고 실제 코드가 존재할 때만
		if (dsNewCar.NTAX_TRGET_GR_CD &&
		    dsNewCar.NTAX_TRGET_GR_CD !== '0' &&
		    nGrade) {
		    items.push(`감면 등급 : ${nGrade.CODE_NM}`);
		}
		
		// 기본 체크 문구
		if(normalCheck) {
			checks.push('위 정보를 확인하였으며, 해당 내용으로 감면을 신청합니다.');
			checks.push('감면은 세대당 1대만 가능합니다. 기존 감면 차량은 판매 후 60일 이내 자진신고를 완료해야 새로운 감면 신청이 가능합니다.');
		}
		
		if (
			['04', '05'].includes(dsNewCar.NTAX_TRGET_CD)
			&& ['4', '5', '6', '05'].includes(dsNewCar.NTAX_TRGET_GR_CD)
		) {
			checks.push('경증 장애인(기존 4~6급)은 공채 감면만 적용되며, 취득세 감면은 제외됩니다.');
		}
		
		// 감면 정책
		const policy = NTAX_POLICY[dsNewCar.NTAX_TRGET_CD];

		if (policy) {

		    // 감면 금액
		    if (policy.AMOUNT) {
		        footer.push(`감면 금액 : ${policy.AMOUNT}`);
		    }

		    // 필요 서류
			const docs = policy[dsNewCar.NTAX_WHO] ?? [];

			if (docs.length) {
			    footer.push(
			        `필요 서류 : ${docs.map(doc => doc.name).join(', ')}`
			    );
			}
		}
		
	
		return {
		    title: '서류 안내',
		    items,
		    checks,
		    footer
		};
	}, [dsNewCar, dsOwnerInfo]);
	
	// ===================================================
	// 처리상태가 상세조회 대상이면 편집 탭 대신 조회 전용 컴포넌트에 데이터셋을 전달한다.
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
				dsTaxReceipt={dsTaxReceipt}
				saveProcess={saveProcess}
				setDsCarNoDetach={setDsCarNoDetach}
				dsBaseList={dsBaseList}
				onClose={onClose}
				dsPR_ST={gf.getCodeList(
			        codes,
			        COMPANY_DEFAULT,
			        dsUserInfo.COMPANY_ID,
			        'PR_ST'
			    )}
				dsFUEL={gf.getCodeList(
			        codes,
			        COMPANY_DEFAULT,
			        dsUserInfo.COMPANY_ID,
			        'FUEL'
			    )}
				dsNUMGB={gf.getCodeList(
			        codes,
			        COMPANY_DEFAULT,
			        dsUserInfo.COMPANY_ID,
			        'NUMGB'
			    )}
				dsDLVGB={gf.getCodeList(
			        codes,
			        COMPANY_DEFAULT,
			        dsUserInfo.COMPANY_ID,
			        'DLVGB'
			    )}
				dsBANK={gf.getCodeList(
			        codes,
			        COMPANY_DEFAULT,
			        dsUserInfo.COMPANY_ID,
			        'BANK'
			    )}
				dsNTTCD={gf.getCodeList(
			        codes,
			        COMPANY_DEFAULT,
			        dsUserInfo.COMPANY_ID,
			        'NTTCD'
			    )}
				dsNTTGR={gf.getCodeList(
			        codes,
			        COMPANY_DEFAULT,
			        dsUserInfo.COMPANY_ID,
			        'NTTGR'
			    )}
			/>
	    );
	}
	
	/**
	 * 입력 화면 렌더링.
	 * step에 따라 Owner 계열 컴포넌트, CarInfo, NewcarInfo, ConfirmInfo 중 하나를 보여준다.
	 * 각 자식은 현재 데이터셋과 setter/handleChange를 받아 값을 수정하며,
	 * 실제 서버 저장은 하단 버튼의 saveProcess() 또는 changeStep()에서 수행한다.
	 */
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
					{REQUEST_STEPS.map(({ no, label }) => (
					    <div
					        key={no}
					        className={`simple-step ${step === no ? 'active' : ''}`}
					        onMouseEnter={() => setHoverStep(no)}
					        onMouseLeave={() => setHoverStep(null)}
					        onClick={() => changeStep(no)}
					    >
					        <div className="step-circle">{no}</div>
					        <span>{label}</span>
					    </div>
					))}

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
						    {REQUEST_STEPS[step - 1].title} 
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
											dsService={dsService}
											dsNewCar={dsNewCar}
										    dsCarNoDetach={dsCarNoDetach}
											setDsNewCar={setDsNewCar}
											dsOwnerInfo={dsOwnerInfo}
											setDsOwnerInfo={setDsOwnerInfo}
											handleChange={handleChange}
											saveProcess={saveProcess}
											
											address={address}
										/>
									}
	
									{/* 리스 */}
									{purchaseType === 'LEASE' &&
										<OwnerLease
											dsService={dsService}
											dsNewCar={dsNewCar}
											setDsNewCar={setDsNewCar}
											dsOwnerInfo={dsOwnerInfo}
											dsCarNoDetach={dsCarNoDetach}
											dsBaseList={dsBaseList}
											setDsOwnerInfo={setDsOwnerInfo}
											handleChange={handleChange}
											onSave={saveProcess}
										/>
									}
	
									{/* 이용자명의 리스 */}
									{purchaseType === 'USER_LEASE' &&
										<OwnerUserLease
											dsService={dsService}
											dsNewCar={dsNewCar}
											setDsNewCar={setDsNewCar}
											dsCarNoDetach={dsCarNoDetach}
											dsBaseList={dsBaseList}
											dsOwnerInfo={dsOwnerInfo}
											setDsOwnerInfo={setDsOwnerInfo}
											handleChange={handleChange}
											onSave={saveProcess}
											
											address={address}
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
	
						{/* 자동차 정보 입력 */}
						{step === 2 &&
							<CarInfo
								dsService={dsService}
								dsNewCar={dsNewCar}
								setDsNewCar={setDsNewCar}
								dsCarNoDetach={dsCarNoDetach}
								setDsCarNoDetach={setDsCarNoDetach}
								codes={codes}
								dsUserInfo={dsUserInfo}
								handleChange={handleChange}
								saveProcess={saveProcess}
								dsDLVGB={gf.getCodeList(
								        codes,
								        COMPANY_DEFAULT,
								        dsUserInfo.COMPANY_ID,
								        'DLVGB'
								    )}

								address={address}
							/>
						}
	
						{/* 신규등록 정보 */}
						{step === 3 &&
							<NewcarInfo
							dsService={dsService}
							dsNewCar={dsNewCar}
							dsPaymentList={dsPaymentList}
							dsWorkCp={dsWorkCp}
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
								dsService={dsService}
						        dsNewCar={dsNewCar}
								dsCarNoDetach={dsCarNoDetach}
								setDsCarNoDetach={setDsCarNoDetach}
								dsUserInfo={dsUserInfo}
								saveProcess={saveProcess}
								dsDLVGB={gf.getCodeList(
							        codes,
							        COMPANY_DEFAULT,
							        dsUserInfo.COMPANY_ID,
							        'DLVGB'
							    )}
								dsNUMGB={gf.getCodeList(
							        codes,
							        COMPANY_DEFAULT,
							        dsUserInfo.COMPANY_ID,
							        'NUMGB'
							    )}
								dsBANK={gf.getCodeList(
							        codes,
							        COMPANY_DEFAULT,
							        dsUserInfo.COMPANY_ID,
							        'BANK'
							    )}
								dsNTTCD={gf.getCodeList(
							        codes,
							        COMPANY_DEFAULT,
							        dsUserInfo.COMPANY_ID,
							        'NTTCD'
							    )}
								dsNTTGR={gf.getCodeList(
							        codes,
							        COMPANY_DEFAULT,
							        dsUserInfo.COMPANY_ID,
							        'NTTGR'
							    )}
								dsOwnerInfo={dsOwnerInfo}
								dsTaxReceipt={dsTaxReceipt}
								dsBaseList={dsBaseList}
								dsPaymentList={dsPaymentList}
								onAttachClose={() => reloadProcess(dsService.SERVICE_ID)}
								onMoveStep={setStep}
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
								disabled={saving}
								onClick={handlePrev}
							>
								<ChevronLeft size={16} strokeWidth={2.5} />
								이전
							</button>
						)}

						<button
						    type="button"
						    className={`wa-action-btn wa-confirm-btn ${
						        (step === 4 && dsUserInfo.MEMBER_GB === 'SU' && requestDisabled ) ? 'wa-disabled' : ''
						    }`}
						    onClick={handleNext}
						>
							<span>
								{
									purchaseType === 'RENT' ? '확인' 
									: (step === 4 && dsUserInfo.MEMBER_GB === 'SU') ? '요청' 
									: '다음'
								}
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
			
			{/* 안내 모달 */}
			<WaNoticeModal
			    open={noticeOpen}
			    notice={notice}
			    onClose={() => {
			        setNoticeOpen(false);
			        setNextStep(null);
			    }}
				onConfirm={() => {
				    setNoticeOpen(false);
				    changeStep(nextStep, true);
				}}
			/>
		</div>
	);
};

export default WaNewcarRequest;
