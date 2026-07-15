export const SIGN_DOC = {
    SIGN: {
        code: 'SIGN',
        name: '감면신청서 서명',
		gubun: 'SIGN'
    }
};

// 일반 첨부파일
export const ATTACH_DOC = {

    // ===== 외국인 =====
    FOREIGN_ID: {
        code: 'FOREIGN_ID',
        name: '외국인등록증',
        seq: 10,
        gubun: 'NWEB'
    },

    // ===== 공동소유 =====
    OWNER_ID: {
        code: 'OWNER_ID',
        name: '대표소유자 신분증',
        seq: 20,
        gubun: 'NWEB'
    },

    JOINT_OWNER_ID: {
        code: 'JOINT_OWNER_ID',
        name: '공동소유자 신분증',
        seq: 30,
        gubun: 'NWEB'
    },

    JOINT_OWNER_AGREEMENT: {
        code: 'JOINT_OWNER_AGREEMENT',
        name: '공동명의 동의서',
        seq: 40,
        gubun: 'NWEB'
    },

    // ===== 이용자명의 리스 =====
    LEASE_AGREEMENT: {
        code: 'LEASE_AGREEMENT',
        name: '리스 신청서',
        seq: 50,
        gubun: 'NWEB'
    }
};

// 비과세대상자 필요서류
export const NTAX_ATTACH_DOC = {

    // ===== 가족관계 =====
    FAMILY_CERT: {
        code: 'FAMILY_CERT',
        name: '가족관계증명서(상세)',
        seq: 110,
        gubun: 'MERGE'
    },

    RESIDENT_CERT: {
        code: 'RESIDENT_CERT',
        name: '주민등록등본',
        seq: 120,
        gubun: 'MERGE'
    },

    BASIC_CERT: {
        code: 'BASIC_CERT',
        name: '기본증명서(상세)',
        seq: 140,
        gubun: 'MERGE'
    },

    // ===== 장애 =====
    DISABILITY_CERT: {
        code: 'DISABILITY_CERT',
        name: '장애인증명서(복지카드)',
        seq: 210,
        gubun: 'MERGE'
    },

    DISABILITY_LEVEL_CERT: {
        code: 'DISABILITY_LEVEL_CERT',
        name: '장애정도 결정서',
        seq: 220,
        gubun: 'MERGE'
    },

    // ===== 미성년 장애인 =====
    LEGAL_REPRESENTATIVE_AGREEMENT: {
        code: 'LEGAL_REPRESENTATIVE_AGREEMENT',
        name: '법정대리인 동의서',
        seq: 310,
        gubun: 'MERGE'
    },

    GUARDIAN_CERT: {
        code: 'GUARDIAN_CERT',
        name: '보호자 인감증명서 또는 본인서명사실확인서',
        seq: 320,
        gubun: 'MERGE'
    },

    // ===== 국가유공 / 보훈 =====
    PATRIOT_CERT: {
        code: 'PATRIOT_CERT',
        name: '국가유공자증(증명서)',
        seq: 410,
        gubun: 'MERGE'
    },

    PATRIOT_CONFIRM: {
        code: 'PATRIOT_CONFIRM',
        name: '국가유공자 확인서',
        seq: 420,
        gubun: 'MERGE'
    },

    // ===== 고엽제 =====
    AGENT_ORANGE_TARGET_CERT: {
        code: 'AGENT_ORANGE_TARGET_CERT',
        name: '고엽제 적용대상 확인원',
        seq: 510,
        gubun: 'MERGE'
    },

    AGENT_ORANGE_CERT: {
        code: 'AGENT_ORANGE_CERT',
        name: '고엽제후유(의)증 환자 확인서',
        seq: 520,
        gubun: 'MERGE'
    },

    // ===== 교환자동차 =====
    DEFECT_CERT: {
        code: 'DEFECT_CERT',
        name: '제작사 결함확인서',
        seq: 610,
        gubun: 'MERGE'
    },

    VEHICLE_DEFECT_DECISION: {
        code: 'VEHICLE_DEFECT_DECISION',
        name: '자동차안전하자심의위원회 판정문',
        seq: 620,
        gubun: 'MERGE'
    },

    DEREGISTRATION_CERT: {
        code: 'DEREGISTRATION_CERT',
        name: '말소사실증명서',
        seq: 630,
        gubun: 'MERGE'
    },

    MANUFACTURER_CERT: {
        code: 'MANUFACTURER_CERT',
        name: '자동차제작증',
        seq: 640,
        gubun: 'MERGE'
    },

    SCRAP_CERT: {
        code: 'SCRAP_CERT',
        name: '폐차증명서',
        seq: 650,
        gubun: 'MERGE'
    },

    // ===== 수출용 중고자동차 =====
    BUSINESS_CERT: {
        code: 'BUSINESS_CERT',
        name: '사업자등록증',
        seq: 710,
        gubun: 'MERGE'
    },

    SALES_CONTRACT: {
        code: 'SALES_CONTRACT',
        name: '중고자동차 매매계약서',
        seq: 720,
        gubun: 'MERGE'
    },

    VEHICLE_REGISTRATION: {
        code: 'VEHICLE_REGISTRATION',
        name: '자동차등록증',
        seq: 730,
        gubun: 'MERGE'
    },

    EXPORT_DECLARATION: {
        code: 'EXPORT_DECLARATION',
        name: '수출신고필증',
        seq: 740,
        gubun: 'MERGE'
    },

    BILL_OF_LADING: {
        code: 'BILL_OF_LADING',
        name: '선하증권(B/L)',
        seq: 750,
        gubun: 'MERGE'
    },

    // ===== 비영리사업자 =====
    UNIQUE_NUMBER_CERT: {
        code: 'UNIQUE_NUMBER_CERT',
        name: '고유번호증',
        seq: 810,
        gubun: 'MERGE'
    },

    OFFICIAL_VEHICLE_APPROVAL: {
        code: 'OFFICIAL_VEHICLE_APPROVAL',
        name: '관용차량 정수배정서 또는 차량교체승인서',
        seq: 820,
        gubun: 'MERGE'
    }
};

// 비과세대상자 조건
export const NTAX_POLICY = {

    // 국가유공자
    '01': {
        REPRE: [
            NTAX_ATTACH_DOC.PATRIOT_CERT
        ],
        UNION: [
            NTAX_ATTACH_DOC.PATRIOT_CERT,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ]
    },

    // 5.18 민주화운동
    '02': {
        REPRE: [
            NTAX_ATTACH_DOC.PATRIOT_CERT
        ],
        UNION: [
            NTAX_ATTACH_DOC.PATRIOT_CERT,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ]
    },

    // 고엽제
    '03': {
        REPRE: [
            NTAX_ATTACH_DOC.AGENT_ORANGE_TARGET_CERT,
            NTAX_ATTACH_DOC.AGENT_ORANGE_CERT
        ],
        UNION: [
            NTAX_ATTACH_DOC.AGENT_ORANGE_TARGET_CERT,
            NTAX_ATTACH_DOC.AGENT_ORANGE_CERT,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ]
    },

    // 장애인
    '04': {
        REPRE: [
            NTAX_ATTACH_DOC.DISABILITY_CERT
        ],
        UNION: [
            NTAX_ATTACH_DOC.DISABILITY_CERT,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ]
    },

    // 시각장애
    '05': {
        REPRE: [
            NTAX_ATTACH_DOC.DISABILITY_CERT
        ],
        UNION: [
            NTAX_ATTACH_DOC.DISABILITY_CERT,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ]
    },

    // 다자녀(18세미만 3명이상)
	'06': {
	    REPRE: [
	        NTAX_ATTACH_DOC.FAMILY_CERT,
	        NTAX_ATTACH_DOC.RESIDENT_CERT
	    ],
	    UNION: [
	        NTAX_ATTACH_DOC.FAMILY_CERT,
	        NTAX_ATTACH_DOC.RESIDENT_CERT
	    ]
	},
	
	// 2자녀(18세미만 2명이상)
	'15': {
		REPRE: [
		    NTAX_ATTACH_DOC.FAMILY_CERT,
		    NTAX_ATTACH_DOC.RESIDENT_CERT
		],
		UNION: [
		    NTAX_ATTACH_DOC.FAMILY_CERT,
		    NTAX_ATTACH_DOC.RESIDENT_CERT
		]
	},

    // 교환자동차
    '09': {
        REPRE: [
            NTAX_ATTACH_DOC.DEFECT_CERT,
            NTAX_ATTACH_DOC.DEREGISTRATION_CERT,
            NTAX_ATTACH_DOC.MANUFACTURER_CERT
        ],
        UNION: []
    },

    // 수출용중고차
    '11': {
        REPRE: [
            NTAX_ATTACH_DOC.BUSINESS_CERT,
            NTAX_ATTACH_DOC.SALES_CONTRACT,
            NTAX_ATTACH_DOC.VEHICLE_REGISTRATION
        ],
        UNION: []
    },

    // 공동경비구역
    '12': {
        REPRE: [],
        UNION: []
    },

    // 비영리사업자
    '13': {
        REPRE: [
            NTAX_ATTACH_DOC.UNIQUE_NUMBER_CERT,
            NTAX_ATTACH_DOC.OFFICIAL_VEHICLE_APPROVAL
        ],
        UNION: []
    },

    // 보훈보상대상자
    '14': {
        REPRE: [
            NTAX_ATTACH_DOC.PATRIOT_CONFIRM
        ],
        UNION: [
            NTAX_ATTACH_DOC.PATRIOT_CONFIRM,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ]
    },

};