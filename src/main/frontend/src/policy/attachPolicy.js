import {
    SIGN_DOC,
    ATTACH_DOC,
    NTAX_ATTACH_DOC,
    NTAX_POLICY
} from './attachDoc';

/**
 * 일반 첨부파일 정책
 */
export function getAttachPolicy(dsNewCar) {

    // 서명
    const signs = new Set();

    // 첨부파일
    const docs = new Set();

    // ===== 비과세 =====
    if (dsNewCar.NTAX_TRGET_CD !== '00') {
        signs.add(SIGN_DOC.SIGN);
    }

    // ===== 외국인 =====
    if (dsNewCar.REG_GB === 'F') {
        docs.add(ATTACH_DOC.FOREIGN_ID);
    }

    // ===== 공동소유 =====
    if (Number(dsNewCar.RATIO_NO || 100) !== 100) {
        docs.add(ATTACH_DOC.OWNER_ID);
        docs.add(ATTACH_DOC.JOINT_OWNER_ID);
        docs.add(ATTACH_DOC.JOINT_OWNER_AGREEMENT);
    }

    // ===== 이용자명의 리스 =====
    if (
        dsNewCar.TASK_CD === 'LEASE' &&
        dsNewCar.PROC_CD === 'C'
    ) {
        docs.add(ATTACH_DOC.LEASE_AGREEMENT);
    }

    return {
        needSign: signs.size > 0,
        needUpload: docs.size > 0,
        requiredSigns: [...signs],
        requiredDocs: [...docs]
    };
}

// 비과세 대상 
export function getNtaxAttachPolicy(dsNewCar) {

    const docs = new Set();
	
	if (dsNewCar.NTAX_TRGET_CD === '00') {
	    return {
	        needUpload: false,
	        requiredDocs: []
	    };
	}

    const policy = NTAX_POLICY[dsNewCar.NTAX_TRGET_CD];

	if (!policy) {
	    return {
	        needUpload: false,
	        requiredDocs: []
	    };
	}

    (policy[dsNewCar.NTAX_WHO] || []).forEach(doc => docs.add(doc));

    // ===== 추가 조건 =====

    // 재혼
    // docs.add(NTAX_ATTACH_DOC.MARRIAGE_CERT);

	// 시각장애 기존4급
	if (
	    dsNewCar.NTAX_TRGET_CD === '05' &&
	    dsNewCar.NTAX_TRGET_GR_CD === '4'
	) {
	    docs.add(NTAX_ATTACH_DOC.DISABILITY_LEVEL_CERT);
	}

	// 미성년 장애인
	if (
	    dsNewCar.NTAX_TRGET_CD === '04' &&
	    dsNewCar.NTAX_WHO === 'UNION'
	) {
	    docs.add(NTAX_ATTACH_DOC.LEGAL_REPRESENTATIVE_AGREEMENT);
	    docs.add(NTAX_ATTACH_DOC.GUARDIAN_CERT);
	    docs.add(NTAX_ATTACH_DOC.BASIC_CERT);
	}

	return {
	    needUpload: docs.size > 0,
	    requiredDocs: [...docs]
	};
}


export {
    SIGN_DOC,
    ATTACH_DOC,
    NTAX_ATTACH_DOC,
    NTAX_POLICY
};