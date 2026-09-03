// 구분값
// gubun: 'NWEB' DCROSS 첨부파일에 보여짐
// gubun: 'MERGE' 비과세대상 파일 밑에 추가로 병합되는 파일
// gubun: 'MINOR' 소유자/공동소유자 미성년자 일 때 첨부되는 파일 (5개가 넘어서 병합하고 있다) 
export const SIGN_DOC = {
    SIGN: {
        code: 'SIGN',
        name: '감면신청서 서명',
		gubun: 'SIGN'
    }
};

// 기타 첨부파일
export const ETC_DOCS = [
    {
        code: 'ETC_1',
        name: '기타',
        seq: 900,
        gubun: 'NWEB',
		choice: 'Y'
    },
];

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
        name: '공동명의 등록조서',
        seq: 40,
        gubun: 'NWEB'
		//formYn: 'Y'
    },

    // ===== 이용자명의 리스 =====
    LEASE_AGREEMENT: {
        code: 'LEASE_AGREEMENT',
        name: '리스계약서',
        seq: 50,
        gubun: 'NWEB'
    },

	// ===== 미성년자 확인 =====
	MINOR_AGREEMENT: {
	    code: 'MINOR_AGREEMENT',
	    name: '(보호자)법정대리인 동의서',
		seq: 60,
	    gubun: 'MINOR', 
		formYn: 'Y' 	// 고객페이지에 양식 파일 올라가는 경우
	},
	GUARDIAN_CERT: {
	    code: 'GUARDIAN_CERT',
	    name: '(보호자)보호자 인감증명서 또는 본인서명사실확인서',
		seq: 61,
		gubun: 'MINOR'
	},
	
	GUARDIAN_ID: {
	    code: 'GUARDIAN_ID',
	    name: '(보호자)보호자 신분증',
		seq: 62,
	    gubun: 'MINOR'
	},

	FAMILY_CERT: {
	    code: 'FAMILY_CERT',
	    name: '(청소년 기준) 가족관계증명서(상세)',
	    seq: 63,
	    gubun: 'MINOR'
	},

	BASIC_CERT: {
	    code: 'BASIC_CERT',
	    name: '(청소년 기준) 기본증명서(상세)',
	    seq: 64,
	    gubun: 'MINOR'
	},
};

// 비과세대상자 필요서류
export const NTAX_ATTACH_DOC = {

    // ===== 가족관계 =====
	
	FAMILY_CERT: {
        code: 'FAMILY_CERT',
        name: '가족관계증명서(상세)',
        seq: 110,
        gubun: 'MERGE', 
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

	MARRIAGE_CERT: {
	    code: 'MARRIAGE_CERT',
	    name: '혼인관계증명서',
	    seq: 820,
	    gubun: 'MERGE',
		choice: 'Y'
	},
	
	GUARDIAN_ID: {
	    code: 'GUARDIAN_ID',
	    name: '(보호자)보호자 신분증',
	    seq: 330,
	    gubun: 'MERGE'
	},
	
	MINOR_AGREEMENT: {
	    code: 'MINOR_AGREEMENT',
	    name: '(보호자)법정대리인 동의서',
		seq: 60,
	    gubun: 'MERGE', 
		formYn: 'Y' 	// 고객페이지에 양식 파일 올라가는 경우
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
        name: '장애정도 결정서(기존 4급)',
        seq: 220,
        gubun: 'MERGE'
    },

    GUARDIAN_CERT: {
        code: 'GUARDIAN_CERT',
        name: '(보호자)보호자 인감증명서 또는 본인서명사실확인서',
        seq: 320,
        gubun: 'MERGE'
    },

    // ===== 국가유공 / 보훈 =====
    PATRIOT_CERT: {
        code: 'PATRIOT_CERT',
        name: '국가유공자 확인서 또는 국가유공자증명서(상이등급표기)',
        seq: 410,
        gubun: 'MERGE'
    },
	
	DEMOCRACY_CERT: {
	    code: 'DEMOCRACY_CERT',
	    name: '5.18 민주유공자 확인증(신체 장해등급 표기)',
	    seq: 420,
	    gubun: 'MERGE'
	},

    // ===== 고엽제 =====
    AGENT_ORANGE_TARGET_CERT: {
        code: 'AGENT_ORANGE_TARGET_CERT',
        name: '고엽제 적용대상 확인원 또는 보훈대상자 증명서',
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
        name: '제작사의 결함확인서 공문 또는 자동차안전하자심의위원회 판정문',
        seq: 610,
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
    },

};

// 비과세대상자 조건
// 파일명은 겹치면 안 됨 !!
export const NTAX_POLICY = {

    // 국가유공자
    '01': {
		NAME: '국가유공자',
		AMOUNT: ['취득세 100% 면제', '공채 100% 면제'],
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
		NAME: '취득세 100% 면제',
		AMOUNT: ['취득세 100% 면제', '공채 100% 면제'],
        REPRE: [
            NTAX_ATTACH_DOC.DEMOCRACY_CERT
        ],
        UNION: [
            NTAX_ATTACH_DOC.DEMOCRACY_CERT,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ]
    },

    // 고엽제
    '03': {
		NAME: '고엽제 후유증 대상',
		AMOUNT: ['취득세 100% 면제', '공채 100% 면제'],
        REPRE: [
            NTAX_ATTACH_DOC.AGENT_ORANGE_TARGET_CERT
        ],
        UNION: [
            NTAX_ATTACH_DOC.AGENT_ORANGE_TARGET_CERT,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ]
    },

    // 장애인
    '04': {
		NAME: '장애인',
		AMOUNT: (grade) => {
			if (['1', '2', '3', '01'].includes(grade)) {
			    return ['취득세 100% 면제', '공채 100% 면제'];
			}
			if (['4', '5', '6', '05'].includes(grade)) {
			    return '공채 100% 면제';
			}

		    return [];
		},
		
		// 대표소유자 제출서류
        REPRE: [
            NTAX_ATTACH_DOC.DISABILITY_CERT
        ],
		
		// 공동소유자 제출서류
        UNION: [
            NTAX_ATTACH_DOC.DISABILITY_CERT,
            NTAX_ATTACH_DOC.RESIDENT_CERT,
            NTAX_ATTACH_DOC.FAMILY_CERT
        ],

		// 대표 또는 공동소유자가 미성년자 일 때 제출서류
		MINOR: [
			    NTAX_ATTACH_DOC.DISABILITY_CERT, // 장애인증명서(복지카드)
			    NTAX_ATTACH_DOC.RESIDENT_CERT,	// 주민등록등본
			    NTAX_ATTACH_DOC.FAMILY_CERT,	// 가족관계증명서(상세)
			    NTAX_ATTACH_DOC.BASIC_CERT,		// 기본증명서(상세)
			    NTAX_ATTACH_DOC.MINOR_AGREEMENT, // (보호자)법정대리인 동의서
			    NTAX_ATTACH_DOC.GUARDIAN_CERT, 	// (보호자)보호자 인감증명서 또는 본인서명사실확인서
			    NTAX_ATTACH_DOC.GUARDIAN_ID 	// (보호자)보호자 신분증
		],
		
		// 취득세 면제인 것들만 사인을 하고, 감면신청서 없이 파일끼리 병합만 한다. (병합 pdf는 만들어야 됨)
		NEED_SIGN: (grade) =>
		    !['4', '5', '6', '05'].includes(grade),
    },

    // 시각장애
    '05': {
		NAME: '시각장애',
		AMOUNT: (grade) => {
		    if (['1', '2', '3', '4', '01'].includes(grade)) {
		        return ['취득세 100% 면제', '공채 100% 면제'];
		    }

		    if (['05'].includes(grade)) {
				return ['공채 100% 면제'];
		    }

		    if (['5', '6'].includes(grade)) {
		        return ['5~6급은 공채 감면만 적용되며, 취득세 감면은 제외됩니다.', '공채 100% 면제'];
		    }

		    return [];
		},
		
		// 대표소유자 제출서류
		REPRE: (grade) => {
		    const docs = [
		        NTAX_ATTACH_DOC.DISABILITY_CERT
		    ];

		    // 시각장애 경증만 장애정도 확인서류 추가
		    if (grade === '05') {
		        docs.push(NTAX_ATTACH_DOC.DISABILITY_LEVEL_CERT);
		    }

		    return docs;
		},
		

		// 공동소유자 제출서류
		UNION: (grade) => {
			const docs = [
			    NTAX_ATTACH_DOC.DISABILITY_CERT,
				NTAX_ATTACH_DOC.RESIDENT_CERT,
		        NTAX_ATTACH_DOC.FAMILY_CERT
			];
			
			// 시각장애 경증만 장애정도 확인서류 추가
		    if (grade === '05') {
		        docs.push(NTAX_ATTACH_DOC.DISABILITY_LEVEL_CERT);
		    }

		    return docs;
		},
		
		// 미성년자 제출서류
		MINOR: [
			    ATTACH_DOC.DISABILITY_CERT, // 장애인증명서(복지카드)
			    ATTACH_DOC.RESIDENT_CERT,	// 주민등록등본
			    ATTACH_DOC.FAMILY_CERT,	// 가족관계증명서(상세)
			    ATTACH_DOC.BASIC_CERT,		// 기본증명서(상세)
			    ATTACH_DOC.MINOR_AGREEMENT, // (보호자)법정대리인 동의서
			    ATTACH_DOC.GUARDIAN_CERT, 	// (보호자)보호자 인감증명서 또는 본인서명사실확인서
			    ATTACH_DOC.GUARDIAN_ID 		// (보호자)보호자 신분증
		],
		
		// 취득세 면제인 것들만 사인을 하고, 감면신청서 없이 파일끼리 병합만 한다. (병합 pdf는 만들어야 됨)
		NEED_SIGN: (grade) =>
			!['5', '6', '05'].includes(grade),
    },

    // 다자녀(18세미만 3명이상)
	'06': {
		NAME: '다자녀(3자녀)',
		AMOUNT: [
			'6인승 이하 : 취득세 100% 감면 (감면 금액 최대 140만원)',
			'(7~10인승)산정된 취득세액 200만원 미만 : 취득세 100% 면제',
			'(7~10인승)산정된 취득세액 200만원 이상 : 취득세 85% 감면'
		],
		
	    REPRE: [
	        NTAX_ATTACH_DOC.FAMILY_CERT,
	        NTAX_ATTACH_DOC.RESIDENT_CERT
	    ],
	    UNION: [
	        NTAX_ATTACH_DOC.FAMILY_CERT,
	        NTAX_ATTACH_DOC.RESIDENT_CERT
	    ],
		// (선택) 제출 서류
		OPTIONAL: [
		    NTAX_ATTACH_DOC.MARRIAGE_CERT
		],
		// 추가 안내사항
		NOTICE: [
		    '재혼가정의 경우 혼인관계증명서 추가'
		]
	},
	
	// 2자녀(18세미만 2명이상)
	'15': {
		NAME: '다자녀(2자녀)',
		AMOUNT: [
			'6인승 이하 : 취득세 50% 감면 (감면 금액 최대 70만원)',
			'7~10인승 : 취득세 50% 감면 (금액 한도 없음)'
		],
		REPRE: [
		    NTAX_ATTACH_DOC.FAMILY_CERT,
		    NTAX_ATTACH_DOC.RESIDENT_CERT
		],
		UNION: [
		    NTAX_ATTACH_DOC.FAMILY_CERT,
		    NTAX_ATTACH_DOC.RESIDENT_CERT
		],
		OPTIONAL: [
		    NTAX_ATTACH_DOC.MARRIAGE_CERT
		],
		// 추가 안내사항
		NOTICE: [
		    '재혼가정의 경우 혼인관계증명서 추가'
		]
	},

    // 공동경비구역
    '12': {
		NAME: '공동경비구역(JSA) 거주자',
		AMOUNT: '취득세 100% 면제',
		REPRE: [],
        UNION: []
    },

	// 보훈대상자
	'14': {
		NAME: '보훈보상대상자',
		AMOUNT: ['취득세의 50% 감면'],
	    REPRE: [
	        NTAX_ATTACH_DOC.PATRIOT_CERT
	    ],
	    UNION: [
	        NTAX_ATTACH_DOC.PATRIOT_CERT,
	        NTAX_ATTACH_DOC.RESIDENT_CERT,
	        NTAX_ATTACH_DOC.FAMILY_CERT
	    ],
	},

    // 비영리사업자
    '13': {
		NAME: '비영리사업자',
		AMOUNT: [
			'비영리사업자로 취득세 감면 받을 수 있는 차량은 관용차량만 가능합니다.'+
			'(국방용, 경호, 경비용 교통순찰, 소방용공익 목적 행정 차량)',
			'교회, 단체 등 비영리사업자는 취득세 감면이 불가합니다.',
			'취득세 100% 면제'],
		
        REPRE: [
            NTAX_ATTACH_DOC.UNIQUE_NUMBER_CERT,
            NTAX_ATTACH_DOC.OFFICIAL_VEHICLE_APPROVAL
        ],
        UNION: []
    },
	
	// 교환자동차
	'09': {
		NAME: '교환자동차 감면',
		AMOUNT:['교환자동차 감면은 다코스 담당자에게 문의 바랍니다.', 
		'070-7931-2380 또는 070-7931-2818'
		],
	    REPRE: [],
	    UNION: []
	},

	/*
	// 수출용중고차
	'11': {
		NAME: '수출용중고자동차',
		AMOUNT: [
		    '산정된 취득세액 200만원 이하: 100% 면제',
		    '산정된 취득세액 200만원 이상: 취득세 85% 감면'
		],
	    REPRE: [
	        NTAX_ATTACH_DOC.BUSINESS_CERT,
	        NTAX_ATTACH_DOC.SALES_CONTRACT,
	        NTAX_ATTACH_DOC.VEHICLE_REGISTRATION
	    ],
	    UNION: []
	}
	*/

};
