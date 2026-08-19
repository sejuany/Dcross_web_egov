// 기본 및 업체별 초기값은 
// TM_COMPANY_CONFIG 테이블에서 세팅한다

// ===== 초기값 =====
export const initialDsService = {
	SERVICE_ID: '',
	WORK_CD: '010',
	REQUEST_DT: '',
	PROC_DT: '',
	JUDGE_DT: '',
	PROC_ST: 'INPUT',
	JUDGE_ST: '',
	RETURN_TX: '',
	COMPANY_ID: '',
	LINK_ID: '',
	GOVT_ID: '',
	UPD_USER: ''
};

export const initialDsNewCar = {
	// 기본
	TASK_CD: '',
	PROC_CD: '',
	CARID_NO: '',
	CAR_NO: '',
	
	REG_GB: '',
	REG_NO: '',
	OWNER_NM: '',
	BIZ_NO: '',

	// 차량정보
	MADE_DT: '',
	MADE_YY: '',
	CAR_KD: '',
	// 예상금액 계산에 필요한 차량 제원
	CAR_KD_CD: '',
	CAR_CC: '',
	GETIN_NO: '',
	LOW_POLLUTION_YN: '',
	CAR_NM: '',
	FM_NM: '',
	SPMNNO: '',
	FUEL_CD: 'e',
	MULTI_PURPOSE_YN: 'N',
	COLOR_GB: '',
	CAR_US: '2',
	LAST_DT: '',
	GOVT_TX: '',
	REGIST_DATE: '',
	GETIN_NO: '',
	CAR_CC: '',

	// 번호판
	NUMPLATE_GB: '7',
	IMSINUM_YN: 'N',
	REQ_CAR_NO: '',

	// 주소
	ADDRESS: '',
	ADDRESS_DT: '',
	POST_NO: '',
	BUBJUNG_CD: '',	

	BASE_ADDRESS: '',
	BASE_ADDRESS_DT: '',
	BASE_POST_NO: '',
	BASE_BUBJUNG_CD: '',	

	ADDR_INFO: '',
	ADDR_INFO2: '',
	
	CARP_ADDRESS: '',
	CARP_ADDRESS_DT: '',
	CARP_POST_NO: '',

	// 연락처
	TEL_NO: '',
	MPHONE_NO: '',
	
	RETURN_NO: '',
	RETURN_NM: '',

	// 보험
	INSURER_CD: '',
	INSURER_SDT: '',
	INSURER_EDT: '',
	IMSIGV_DT: '',

	// 금액
	BUY_AMT: 0,
	TOTAL_AMT: 0,
	// 표준과세금액, 없으면 BUY_AMT 기준으로 계산함
	STANDARD_AMT: 0,
	RT_AMT: 0,

	// 채권
	BOND_YN: 'N',
	BOND_DC: '',
	BOND_AMT: 0,
	BOND_BANK_CD: '',
	BOND_BANK_NO: '',
	BOND_LINK_YN: '',

	// 결제
	PAY_NM: '',
	PAY_HP_NO: '',
	PAY_GB: 'B', // 선납 (B), 후납(A)
	PAY_ME: 'B',
	PAY_ST: 'N',
	VBANK_CD: '',
	VBANK_NO: '',
	CARD_YN: 'N',

	// 환급
	RT_BANK_CD: '',
	RT_ACC_NO: '',
	RT_ACC_NM: '',

	// 기타
	MEMO_TX: '',
	NEWCAR_REG_DT: '',
	NTAX_TRGET_CD: '00',
	NTAX_TRGET_GR_CD: '0',
	NTAX_APPLC_CD: '0',
	NTAX_WHO: 'REPRE',
	STAMP_GB: 'TOTAL',
	INJI_NO: '',
	PREREG_AMT: '',
	RATIO_NO: '100',
	CONTRACTOR_NM: '',
	CONTRACTOR_DT: ''
};

export const initialOwnerInfo = {
	SEQ: 0,
	DEBTOR_GB: '',
	DEBTOR_NM: '',
	DEBTOR_REG_NO: '',
	DEBTOR_BIZ_NO: '',
	DEBTOR_RATIO: '',
	DEBTOR_TEL_NO: '',
	DEBTOR_MPHONE_NO: '',
	DEBTOR_ADDR: '',
	DEBTOR_ADDR_DT: '',
	DEBTOR_ROAD_CD: '',
	EXPIRE_DT: ''
};

export const initialOwnerInfo1 = {
	SEQ: 1,
	DEBTOR_GB: '',
	DEBTOR_NM: '',
	DEBTOR_REG_NO: '',
	DEBTOR_BIZ_NO: '',
	DEBTOR_RATIO: '',
	DEBTOR_TEL_NO: '',
	DEBTOR_MPHONE_NO: '',
	DEBTOR_ADDR: '',
	DEBTOR_ADDR_DT: '',
	DEBTOR_ROAD_CD: '',
	EXPIRE_DT: ''
};

export const initialCarNoDetach = {
	DELIVERY_GB: '',
	DELIVERY_ADDR: '',
	DELIVERY_ADDR_DT: '',
	DELIVERY_CP: '',
	INSTALL_DT: '',
	INSTALL_TM: '',
	INSTALL_NM: '',
	INSTALL_TEL_NO: '',
	INSTALL_SMS_TX: '',
	STATUS_SMS_NO: '',
	RECEIVE_NM: '',
	RECEIVE_TEL_NO: '',
	CUSTOMER_NM: '',
	NUM_MEMO_TX: '',
	NUMPLATE_ST: '',
	SEND_YN: '',
	RECEIVE_YN: '',
	RENT_SEND_YN: '',
	RENT_RECEIVE_YN: '',
	HOLE_YN: '02',
	SEAL_YN: '02',
	TOKEN: ''
};

export const initialDsPaymentList = [
    {
        PAY_KD: '',
        VBANK_NO: '',
        PAY_OP: '',
        PRE_PAY_AMT: 0,
        PAY_AMT: 0,
        PAY_ST: '',
        PAY_DT: ''
    }
];

export const initialDsBranchList = [
    {
        COMPANY_ID: '',
        BRANCH_ID: '',
        BRANCH_NM: '',
        BIZ_NO: '',
        POST_NO: '',
        ADDRESS: '',
        ADDRESS_DT: '',
        TEL_NO: '',
        MPHONE_NO: '',
        BASE_ID: '',
        NEWCAR_YN: '',
        MORTREG_YN: '',
        MORTERS_YN: '',
        TRNSNAME_YN: '',
        PAYMENT_ME: '',
        USE_YN: '',
        BUBJUNG_CD: '',
        BUBJUNG_NM: '',
        HJD_CD: '',
        HJD_NM: '',
        ROAD_CD: '',
        ROAD_NM: '',
		ASSIGN_CD: ''
    }
];


export const initialDsBaseList = [
    {
        COMPANY_ID: '',
        BASE_ID: '',
        BASE_NM: '',
        BIZ_NO: '',
        POST_NO: '',
        ADDRESS: '',
        ADDRESS_DT: '',
        BUBJUNG_CD: '',
        BUBJUNG_NM: '',
        HJD_CD: '',
        HJD_NM: '',
        ROAD_CD: '',
        ROAD_NM: '',
        USE_YN: '',
        ADDR_INFO: ''
    }
];

export const initialDsTaxReceipt = {
    SERVICE_ID: '',
    GUBUN: '',
    ETC1: 'N',
    REG_NO: '',
    NAME: '',
    COMPANY_NM: '',
    PHONE_NO: '',
    ADDR: '',
    ADDR_DT: '',
    POST_NO: '',
    BUSINESS_TYPE: '',
    INDUSTRY_TYPE: '',
    MAIL1: '',
    MAIL2: ''
};
export const initialDsCarNoDetach = {
    SERVICE_ID: '',
    WORK_CD: '010',
    NUMPLATE_GB: '',
    CAR_NO: '',
    POST_CAR_NO: '',
    DELIVERY_GB: '',
    DELIVERY_CP: '',
    DELIVERY_ADDR: '',
    DELIVERY_ADDR_DT: '',
    DELIVERY_POST_NO: '',
    INSTALL_DT: '',
    INSTALL_NM: '',
    INSTALL_TEL_NO: '',
    INSTALL_TM: '',
    INSTALL_YN: '',
    NUMPLATE_ST: '',
    RECEIVE_NM: '',
    CUSTOMER_NM: '',
    STATUS_SMS_NO: '',
    NUM_MEMO_TX: '',
    HOLE_YN: '02',
    SEAL_YN: '02',
	TOKEN: ''
};

// ===== 매핑 =====
export const serviceMap = {
	SERVICE_ID: 'SERVICE_ID',
	WORK_CD: 'WORK_CD',
	REQUEST_DT: 'REQUEST_DT',
	PROC_DT: 'PROC_DT',
	JUDGE_DT: 'JUDGE_DT',
	PROC_ST: 'PROC_ST',
	JUDGE_ST: 'JUDGE_ST',
	RETURN_TX: 'RETURN_TX',
	COMPANY_ID: 'COMPANY_ID',
	GOVT_ID: 'GOVT_ID',
	LINK_ID: 'LINK_ID',
};

export const newCarMap = {
	// 기본
	PROC_CD: 'PROC_CD',
	TASK_CD: 'TASK_CD',
	CARID_NO: 'CARID_NO',
	CAR_NO: 'CAR_NO',
	
	REG_NO: 'REG_NO',
	REG_GB: 'REG_GB',
	OWNER_NM: 'OWNER_NM',
	BIZ_NO: 'BIZ_NO',

	// 차량정보
	MADE_DT: 'MADE_DT',
	MADE_YY: 'MADE_YY',
	CAR_KD: 'CAR_KD',
	// 계산 모듈에서 취득세율 판단에 사용함
	CAR_KD_CD: 'CAR_KD_CD',
	CAR_CC: 'CAR_CC',
	GETIN_NO: 'GETIN_NO',
	LOW_POLLUTION_YN: 'LOW_POLLUTION_YN',
	CAR_NM: 'CAR_NM',
	FM_NM: 'FM_NM',
	SPMNNO: 'SPMNNO',
	FUEL_CD: 'FUEL_CD',
	COLOR_GB: 'COLOR_GB',
	CAR_US: 'CAR_US',
	LAST_DT: 'LAST_DT',
	GOVT_TX: 'GOVT_TX',
	REGIST_DATE: 'REGIST_DATE',
	GETIN_NO: 'GETIN_NO',
	CAR_CC: 'CAR_CC',
	// 번호판
	NUMPLATE_GB: 'NUMPLATE_GB',
	IMSINUM_YN: 'IMSINUM_YN',
	REQ_CAR_NO: 'REQ_CAR_NO',

	// 주소
	ADDRESS: 'ADDRESS',
	ADDRESS_DT: 'ADDRESS_DT',
	POST_NO: 'POST_NO',
	BUBJUNG_CD: 'BUBJUNG_CD',
	RT_ACC_NM: 'RT_ACC_NM', // 소유자 도로명코드
	
	BASE_ADDRESS: 'BASE_ADDRESS',
	BASE_ADDRESS_DT: 'BASE_ADDRESS_DT',
	BASE_POST_NO: 'BASE_POST_NO',
	BASE_BUBJUNG_CD: 'BASE_BUBJUNG_CD',
	RT_ACC_NO: 'RT_ACC_NO', // 사용본거지 도로명코드
	ADDR_INFO: 'ADDR_INFO',
	ADDR_INFO2: 'ADDR_INFO2',
	
	BASE_BRANCH_ID: 'BASE_BRANCH_ID',
	OWNER_BRANCH_ID: 'OWNER_BRANCH_ID',

	// 연락처
	TEL_NO: 'TEL_NO',
	MPHONE_NO: 'MPHONE_NO',

	// 보험
	INSURER_CD: 'INSURER_CD',
	INSURER_SDT: 'INSURER_SDT',
	INSURER_EDT: 'INSURER_EDT',
	IMSIGV_DT : 'IMSIGV_DT',

	// 금액
	BUY_AMT: 'BUY_AMT',
	TOTAL_AMT: 'TOTAL_AMT',
	// 계산 모듈에서 과세표준 판단에 사용함
	STANDARD_AMT: 'STANDARD_AMT',
	RT_AMT: 'RT_AMT',

	// 채권
	BOND_YN: 'BOND_YN',
	BOND_DC: 'BOND_DC',
	BOND_AMT: 'BOND_AMT',
	BOND_BANK_CD: 'BOND_BANK_CD',
	BOND_BANK_NO: 'BOND_BANK_NO',
	BOND_LINK_YN: 'BOND_LINK_YN',

	// 결제
	PAY_NM: 'PAY_NM',
	PAY_HP_NO: 'PAY_HP_NO',
	PAY_GB: 'PAY_GB',
	PAY_ME: 'PAY_ME',
	PAY_ST: 'PAY_ST',
	VBANK_CD: 'VBANK_CD',
	VBANK_NO: 'VBANK_NO',
	CARD_YN: 'CARD_YN',

	// 환급·환불
	RT_BANK_CD: 'RT_BANK_CD',
	RETURN_NO: 'RETURN_NO',
	RETURN_NM: 'RETURN_NM',
	
	// 기타
	MEMO_TX: 'MEMO_TX',
	NEWCAR_REG_DT: 'NEWCAR_REG_DT',
	CARP_ADDRESS: 'CARP_ADDRESS',
	CARP_ADDRESS_DT: 'CARP_ADDRESS_DT',
	CARP_POST_NO: 'CARP_POST_NO',

	// 세금
	NTAX_TRGET_CD: 'NTAX_TRGET_CD',
	NTAX_TRGET_GR_CD: 'NTAX_TRGET_GR_CD',
	NTAX_APPLC_CD: 'NTAX_APPLC_CD',
	NTAX_WHO: 'NTAX_WHO',
	STAMP_GB: 'STAMP_GB',
	INJI_NO: 'INJI_NO',
	PREREG_AMT: 'PREREG_AMT',

	// 비율
	RATIO_NO: 'RATIO_NO',

	// 계약
	CONTRACTOR_NM: 'CONTRACTOR_NM',
	CONTRACTOR_DT: 'CONTRACTOR_DT',
	
	// 다목적 차량
	VH_TY_CD: 'VH_TY_CD'
};

export const taxReceiptMap = {
    SERVICE_ID: 'SERVICE_ID',
    GUBUN: 'GUBUN',
    ETC1: 'ETC1',
    REG_NO: 'REG_NO',
    NAME: 'NAME',
    COMPANY_NM: 'COMPANY_NM',
    PHONE_NO: 'PHONE_NO',
    ADDR: 'ADDR',
    ADDR_DT: 'ADDR_DT',
    POST_NO: 'POST_NO',
    BUSINESS_TYPE: 'BUSINESS_TYPE',
    INDUSTRY_TYPE: 'INDUSTRY_TYPE',
    MAIL1: 'MAIL1',
    MAIL2: 'MAIL2'
};
export const ownerMap = {
    DEBTOR_GB: 'DEBTOR_GB',
    DEBTOR_NM: 'DEBTOR_NM',
    DEBTOR_REG_NO: 'REG_NO',
    DEBTOR_BIZ_NO: 'BIZ_NO',
    DEBTOR_RATIO: 'DEBTOR_RATIO',
    DEBTOR_TEL_NO: 'DSIGN_HP_NO',
    DEBTOR_ADDR: 'DEBTOR_ADDR',
    DEBTOR_ADDR_DT: 'DEBTOR_ADDR_DT',
    DEBTOR_ROAD_CD: 'DEBTOR_ROAD_CD',
	EXPIRE_DT: 'EXPIRE_DT'
};
