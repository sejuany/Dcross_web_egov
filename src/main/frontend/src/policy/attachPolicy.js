

import { gf } from '../utils/utils';

import {
    SIGN_DOC,
    ATTACH_DOC,
    NTAX_ATTACH_DOC,
    NTAX_POLICY
} from './attachDoc';

/**
 * 일반 첨부파일 정책
 */
export function getAttachPolicy(dsNewCar, dsOwnerInfo) {

    // 서명
    const signs = new Set();

    // 첨부파일
    const docs = new Set();

    // ===== 비과세 =====
    if (dsNewCar.NTAX_TRGET_CD && dsNewCar.NTAX_TRGET_CD !== '00') {
        signs.add(SIGN_DOC.SIGN);
    }

    // ===== 외국인 =====
	// 일반등록, 이용자명의리스만 해당
    if ((dsNewCar.TASK_CD === 'NORML' || 
		(dsNewCar.TASK_CD === 'LEASE' && dsNewCar.PROC_CD === 'C')) && 
		dsNewCar.REG_GB === 'F') {
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
	
	// ===== 미성년자 =====
	// 대표 소유자: REG_GB가 R 또는 F이고 미성년자인 경우
	// 공동 소유자: 공동소유(RATIO_NO !== 100)이면서 DEBTOR_GB가 R 또는 F이고 미성년자인 경우
	const needMinorDocs =
	    (
	        ['R', 'F'].includes(dsNewCar.REG_GB) &&
	        gf.isMinor(dsNewCar.REG_NO)
	    ) ||
	    (
	        Number(dsNewCar.RATIO_NO || 100) !== 100 &&
	        ['R', 'F'].includes(dsOwnerInfo?.DEBTOR_GB) &&
	        gf.isMinor(dsOwnerInfo?.DEBTOR_REG_NO)
	    );

	if (needMinorDocs) {
		console.log("미성년자");
	    docs.add(ATTACH_DOC.MINOR_AGREEMENT);
	    docs.add(ATTACH_DOC.PARENT_SEAL);
	    docs.add(ATTACH_DOC.PARENT_ID);
	    docs.add(ATTACH_DOC.FAMILY_CERT_MINOR);
	    docs.add(ATTACH_DOC.BASIC_CERT);
	}

	console.log({
	    needSign: signs.size > 0,
	    needUpload: docs.size > 0,
	    requiredSigns: [...signs],
	    requiredDocs: [...docs],
		needMinorDocs
	});
	
	return {
	    needSign: signs.size > 0,
	    needUpload: docs.size > 0,
	    needMinorDocs,
	    requiredSigns: [...signs],
	    requiredDocs: [...docs]
	};
}

// 비과세 대상 
export function getNtaxAttachPolicy(dsNewCar) {

    const docs = new Set();
	
	
	if (!dsNewCar.NTAX_TRGET_CD ||
		dsNewCar.NTAX_TRGET_CD === '00' || 
		[ '7', '8', '9', '10', '11', '12', '13', '14'].includes(dsNewCar.NTAX_TRGET_GR_CD)
	) {
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

/*	console.log({
		    needUpload: docs.size > 0,
		    requiredDocs: [...docs]
		});*/
		
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