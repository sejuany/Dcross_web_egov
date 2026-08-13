import { gf } from '../utils/utils';

import {
    SIGN_DOC,
    ATTACH_DOC,
    NTAX_ATTACH_DOC,
    NTAX_POLICY,
	ETC_DOCS
} from './attachDoc';

/**
 * 비과세 정책 기본값
 */
const EMPTY_NTAX_POLICY = {
    needUpload: false,
    requiredDocs: [],
    optionalDocs: [],
    groups: {
        required: [],
        optional: []
    },
    amount: [],
    notices: [],
	
	// 미성년자 확인서류 중복 저장 대상
	duplicateMinorCodes: new Set()
};

/**
 * 일반 첨부파일 정책 설정
 */
export function getAttachPolicy(dsNewCar, dsOwnerInfo) {

	if (!dsNewCar) {
	    return {
	        needSign: false,
	        needUpload: false,
	        needMinorDocs: false,
	        requiredSigns: [],
	        requiredDocs: [],
	        groups: {
	            foreign: [],
	            joint: [],
	            lease: [],
	            minor: []
	        },
	        duplicateMinorCodes: new Set()
	    };
	}
	
    const signs = new Set();
    const docs = new Set();

    // 화면 출력용 그룹
    const groups = {
        foreign: [],
        joint: [],
        lease: [],
        minor: []
    };

    /**
     * 그룹 및 전체 첨부파일 추가
     */
    const addGroup = (group, list = []) => {

        const validDocs = list.filter(Boolean);

        groups[group].push(...validDocs);

        validDocs.forEach(doc => docs.add(doc));
    };

    // ======================
    // 전자서명
    // ======================

    if (dsNewCar.NTAX_TRGET_CD !== '00') {
        signs.add(SIGN_DOC.SIGN);
    }

    // ======================
    // 외국인
    // ======================

    if (
        (
            dsNewCar.TASK_CD === 'NORML' ||
            (
                dsNewCar.TASK_CD === 'LEASE' &&
                dsNewCar.PROC_CD === 'C'
            )
        ) &&
        dsNewCar.REG_GB === 'F'
    ) {

        addGroup('foreign', [
            ATTACH_DOC.FOREIGN_ID
        ]);
    }

    // ======================
    // 공동소유
    // ======================

    if (Number(dsNewCar.RATIO_NO || 100) !== 100) {

        addGroup('joint', [
            ATTACH_DOC.JOINT_OWNER_AGREEMENT
        ]);
    }

    // ======================
    // 이용자명의 리스
    // ======================

    if (
        dsNewCar.TASK_CD === 'LEASE' &&
        dsNewCar.PROC_CD === 'C'
    ) {
        addGroup('lease', [ ATTACH_DOC.LEASE_AGREEMENT ]);
    }

    // ======================
    // 미성년자
    // ======================
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

        addGroup('minor', [

            ATTACH_DOC.MINOR_AGREEMENT,
            ATTACH_DOC.GUARDIAN_CERT,
            ATTACH_DOC.GUARDIAN_ID,
            ATTACH_DOC.FAMILY_CERT,
            ATTACH_DOC.BASIC_CERT

        ]);
    }

	return {

	    needSign: signs.size > 0,
	    needUpload: docs.size > 0,
	    needMinorDocs,

	    requiredSigns: [...signs],
	    requiredDocs: [...docs],

	    groups,

	    duplicateMinorCodes: new Set([
	        ATTACH_DOC.MINOR_AGREEMENT.code,
	        ATTACH_DOC.GUARDIAN_CERT.code,
	        ATTACH_DOC.GUARDIAN_ID.code,
	        ATTACH_DOC.FAMILY_CERT.code,
	        ATTACH_DOC.BASIC_CERT.code
	    ])
	};
}

/**
 * 비과세 첨부파일 정책 설정
 */
export function getNtaxAttachPolicy(dsNewCar, dsOwnerInfo) {

	if (!dsNewCar) {
	    return EMPTY_NTAX_POLICY;
	}
	
    const docs = new Set();
    const optionalDocs = new Set();

    // 화면 출력용 그룹
    const groups = {
        required: [],
        optional: []
    };

    /**
     * 그룹 및 전체 첨부파일 추가
     */
    const addGroup = (group, list = []) => {

        const validDocs = list.filter(Boolean);

        groups[group].push(...validDocs);

        validDocs.forEach(doc => {

            if (group === 'required') {
                docs.add(doc);
            }
            else {
                optionalDocs.add(doc);
            }

        });
    };

    // ======================
    // 비과세 대상 여부
    // ======================
	if (
	    !dsNewCar.NTAX_TRGET_CD ||
	    dsNewCar.NTAX_TRGET_CD === '00'
	) {
	    return EMPTY_NTAX_POLICY;
	}

    // ======================
    // 정책
    // ======================
    const policy = NTAX_POLICY[dsNewCar.NTAX_TRGET_CD];

    if (!policy) {
		return EMPTY_NTAX_POLICY;
    }

    // ======================
    // 제출 서류 구분
    // ======================

    const isOwnerMinor =
        dsNewCar.NTAX_WHO === 'REPRE' &&
        gf.isMinor(dsNewCar.REG_NO);

    const isJointOwnerMinor =
        dsNewCar.NTAX_WHO === 'UNION' &&
        gf.isMinor(dsOwnerInfo?.DEBTOR_REG_NO);

    let docType = dsNewCar.NTAX_WHO;

    if (
        dsNewCar.NTAX_TRGET_CD === '04' &&
        (isOwnerMinor || isJointOwnerMinor)
    ) {
        docType = 'MINOR';
    }

    const required =
        typeof policy[docType] === 'function'
            ? policy[docType](dsNewCar.NTAX_TRGET_GR_CD)
            : (policy[docType] ?? []);

    addGroup(
        'required',
        required
    );

    // ======================
    // 선택 서류
    // ======================

    const optional =
        typeof policy.OPTIONAL === 'function'
            ? policy.OPTIONAL(dsNewCar.NTAX_TRGET_GR_CD)
            : (policy.OPTIONAL ?? []);

    addGroup('optional', optional);
	
	// ===== 감면 금액 =====
	// 등급별(함수) / 고정(배열) 모두 지원
	const amount =
	    typeof policy.AMOUNT === 'function'
	        ? policy.AMOUNT(dsNewCar.NTAX_TRGET_GR_CD)
	        : (policy.AMOUNT ?? []);

	// ===== 추가 안내사항 =====
	// 등급별(함수) / 고정(배열) 모두 지원
	const notices =
	    typeof policy.NOTICE === 'function'
	        ? policy.NOTICE(dsNewCar.NTAX_TRGET_GR_CD)
	        : (policy.NOTICE ?? []);

	// 서명도 안 받고 감면서류도 안 받는 경우 
	const needSign =
	    typeof policy.NEED_SIGN === 'function'
	        ? policy.NEED_SIGN(dsNewCar.NTAX_TRGET_GR_CD)
	        : (policy.NEED_SIGN ?? true);
			
	return {
		// 서명도 안 받고 감면서류도 안 받음
		needSign,
		
	    // 첨부파일 업로드 필요 여부
	    needUpload: docs.size > 0,

	    // 필수 제출 서류
	    requiredDocs: [...docs],

	    // 선택 제출 서류
	    optionalDocs: [...optionalDocs],

	    // 화면 출력용 서류 그룹
	    groups,

	    // 감면 금액 안내
	    amount: Array.isArray(amount) ? amount : [amount],

	    // 추가 안내사항
	    notices,
		
		// 미성년자 확인서류 PDF 병합을 위해 MINOR로도 저장하는 첨부파일 코드
		duplicateMinorCodes: new Set()
	};
}

/**
 * 일반 첨부파일 안내창
 */
export function buildNotice({ attachPolicy }) {

    const items = [];
    const titles = [];
    const checks = [];

    /**
     * 제목 + 서류 추가
     */
    const addDocs = (title, docs = []) => {

        const validDocs = docs.filter(Boolean);

        if (!validDocs.length) {
            return;
        }

        titles.push({
            index: items.length,
            text: title
        });

        items.push(
            ...validDocs.map(doc => doc.name)
        );
    };

    // ======================
    // 첨부파일 그룹
    // ======================

    const GROUPS = [
        {
            key: 'foreign',
            title: '외국인'
        },
        {
            key: 'joint',
            title: '공동소유'
        },
        {
            key: 'lease',
            title: '이용자명의 리스'
        },
        {
            key: 'minor',
            title: '미성년자'
        }
    ];

    GROUPS.forEach(group => {

        const docs =
            attachPolicy.groups[group.key];

        if (!docs.length) {
            return;
        }

        addDocs(
            group.title,
            docs
        );

    });

    // ======================
    // 안내 문구
    // ======================

    if (attachPolicy.groups.lease.length) {

        checks.push(
            '이용자명의 리스로 차량 등록 시 리스계약서가 필요합니다.\n최종확인 페이지에서 리스계약서를 제출해 주세요.'
        );
    }

    if (attachPolicy.groups.minor.length) {

        checks.push(
            '등록하신 정보는 만 19세 미만으로 확인됩니다. 차량 소유자가 청소년일 경우, 부모 등 법정대리인의 동의가 필요합니다.'
        );
    }

    if (items.length) {

        checks.push(
            '해당 고객님은 서류 제출 대상자입니다.\n최종확인 페이지에서 위 서류를 제출해 주세요.'
        );
    }

    return {
        title: '서류 안내',
        items,
        titles,
        checks,
        footer: []
    };
}

/**
 * 비과세 안내창
 */
export function buildExemptionNotice({
    dsNewCar,
    codes,
    attachPolicy,
    ntaxPolicy
}) {

    if (
        !attachPolicy.needSign &&
        !ntaxPolicy.needUpload
    ) {
        return null;
    }

    const items = [];
    const checks = [];
    const footer = [];

    // ======================
    // 감면 대상
    // ======================

    if (dsNewCar.NTAX_WHO === 'REPRE') {
        items.push('감면 대상 : 대표소유자');
    }
    else if (dsNewCar.NTAX_WHO === 'UNION') {
        items.push('감면 대상 : 공동소유자');
    }

    // ======================
    // 감면 유형
    // ======================

    const nType =
        (codes.NTTCD ?? []).find(
            item => item.CODE_ID === dsNewCar.NTAX_TRGET_CD
        );

    if (nType) {
        items.push(
            `감면 유형 : ${nType.CODE_NM}`
        );
    }

    // ======================
    // 감면 등급
    // ======================

    const nGrade =
        (codes.NTTGR ?? []).find(
            item => item.CODE_ID === dsNewCar.NTAX_TRGET_GR_CD
        );

    if (
        dsNewCar.NTAX_TRGET_GR_CD &&
        dsNewCar.NTAX_TRGET_GR_CD !== '0' &&
        nGrade
    ) {

        items.push(
            `감면 등급 : ${nGrade.CODE_NM}`
        );
    }

    // ======================
    // 체크 문구
    // ======================

    if (items.length) {

        checks.push(
            '위 정보를 확인하였으며, 해당 내용으로 감면을 신청합니다.'
        );

        checks.push(
            '감면은 세대당 1대만 가능합니다. 기존 감면 차량은 판매 후 60일 이내 자진신고를 완료해야 새로운 감면 신청이 가능합니다.'
        );
    }

    if (
        '04'.includes(dsNewCar.NTAX_TRGET_CD) && ['4', '5', '6', '05'].includes(dsNewCar.NTAX_TRGET_GR_CD)
    ) {

        checks.push(
            '경증(4~6급)은 공채 감면만 적용되며, 취득세 감면은 제외됩니다.'
        );
    }

	// 시각장애인 경증
	if (dsNewCar.NTAX_TRGET_CD === '05' && dsNewCar.NTAX_TRGET_GR_CD === '05') {

		checks.push('다음 어느 하나에 해당되면 취득세 면제 가능합니다. (기존 4급에 해당)\n' +
			'- 좋은 눈의 시력이 0.06 초과 0.1 이하인 사람\n' + 
			'- 두 눈의 시야가 각각 모든 방향에서 5도 초과 10도 이하로 남은 사람');
	}
	
	
    // ======================
    // 감면 금액
    // ======================

    ntaxPolicy.amount.forEach((text, index) => {

        footer.push(
            index === 0
                ? `* 감면 금액 : ${text}`
                : `  - ${text}`
        );

    });

    // ======================
    // 필요 서류
    // ======================

    if (
        ntaxPolicy.groups.required.length ||
        ntaxPolicy.groups.optional.length
    ) {

        footer.push(
            `* 필요 서류 : ${[
                ...ntaxPolicy.groups.required,
                ...ntaxPolicy.groups.optional
            ]
                .map(doc => `${doc.name}${doc.choice === 'Y' ? '(선택)' : ''}`)
                .join(', ')}`
        );
    }

    // ======================
    // 안내사항
    // ======================

    footer.push(
        ...ntaxPolicy.notices.map(
            text => `  - ${text}`
        )
    );

    return {

        title: '서류 안내',

        items,

        checks,

        footer
    };
}

/**
 * 감면 표시 정보
 */
export function getExemptionInfo(dsNewCar, codes) {
	
	if (!dsNewCar) {
	    return {
	        typeName: '-',
	        gradeName: '-'
	    };
	}
	
    const type = (codes.NTTCD ?? []).find(
        item => item.CODE_ID === dsNewCar.NTAX_TRGET_CD
    );

    const grade = (codes.NTTGR ?? []).find(
        item => item.CODE_ID === dsNewCar.NTAX_TRGET_GR_CD
    );

    return {
        typeName: type?.CODE_NM ?? '-',
        gradeName:
            dsNewCar.NTAX_TRGET_GR_CD &&
            dsNewCar.NTAX_TRGET_GR_CD !== '0'
                ? (grade?.CODE_NM ?? '-')
                : '-'
    };
}

export {
    SIGN_DOC,
    ATTACH_DOC,
    NTAX_ATTACH_DOC,
    NTAX_POLICY,
	ETC_DOCS
};