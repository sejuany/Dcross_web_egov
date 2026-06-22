// console.log 단축용 로그 함수
export const log = (...args) => console.log(...args);

let commonPopupHandler = null;
const commonPopupQueue = [];
let commonPopupRunning = false;

const runCommonPopupQueue = async () => {
    if (commonPopupRunning) {
        return;
    }

    if (commonPopupQueue.length === 0) {
        return;
    }

    const job = commonPopupQueue.shift();

    if (!commonPopupHandler) {
        console.error('[공통팝업] CommonPopupProvider가 등록되지 않았습니다.');
        job.reject(new Error('CommonPopupProvider가 등록되지 않았습니다.'));
        runCommonPopupQueue();
        return;
    }

    commonPopupRunning = true;

    try {
        const result = await commonPopupHandler(job.options);
        job.resolve(result);
    } catch (error) {
        job.reject(error);
    } finally {
        commonPopupRunning = false;
        runCommonPopupQueue();
    }
};

export const commonPopup = {
    bind(handler) {
        commonPopupHandler = handler;
    },

    unbind() {
        commonPopupHandler = null;
    },

    open(options) {
        return new Promise((resolve, reject) => {
            commonPopupQueue.push({
                options,
                resolve,
                reject,
            });

            runCommonPopupQueue();
        });
    },
};

const SPECIAL_COMPANY_CACHE_KEY = 'SPECIAL_COMPANY_IDS';

let specialCompanyIdsCache = null;
const codeGroupCache = {};
const codeGroupPending = {};

const parsePipeCompanyIds = (value) => {
    return String(value || '')
        .split('|')
        .map(item => item.trim())
        .filter(item => item !== '');
};


// 토스트창
export const toast = (msg, delay = 2500) => {

    const toast = document.createElement('div');

    toast.innerText = msg;
    toast.className = 'custom-toast';

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, delay);
};


export const gf = {
	
	// 공통 알림 팝업
	alert: (message, title = '알림', options = {}, callback) => {
	    const promise = commonPopup.open({
	        type: 'alert',
	        title,
	        message,
	        okText: options.okText || '확인',
	        width: options.width,
	    }).then(() => {
	        if (typeof callback === 'function') {
	            callback();
	        }

	        return true;
	    });

	    return promise;
	},

	// 공통 확인 팝업
	confirm: (message, title = '확인', options = {}, callback) => {
	    const promise = commonPopup.open({
	        type: 'confirm',
	        title,
	        message,
	        okText: options.okText || '확인',
	        cancelText: options.cancelText || '취소',
	        width: options.width,
	    }).then((result) => {
	        const ok = result === true;

	        if (typeof callback === 'function') {
	            callback(ok);
	        }

	        return ok;
	    });

	    return promise;
	},
	
	// 특수회원사 여부 확인
	// GROUP_ID='TUSE', CODE_ID='SPCOM'
	isSpecialCompany: async (companyId) => {
		    const targetCompanyId = String(companyId || '').trim().toUpperCase();

		    if (!targetCompanyId) {
		        return false;
		    }

		    const codes = await gf.getCodeDetails(['TUSE']);
		    const list = codes?.TUSE || [];

		    const specialCode = list.find(item =>
		        (item.CODE_ID || item.codeId || item.code_ID) === 'SPCOM'
		    );

		    const detailNm =
		        specialCode?.DETAIL_NM ||
		        specialCode?.detailNm ||
		        specialCode?.detail_NM ||
		        '';

		    return String(detailNm || '').toUpperCase().includes(`|${targetCompanyId}|`);
		},
		
	// 빈값 체크
    isEmpty: (data) => data === '' || data == null,

	// 입력값 유효성 검사
    Check: (value, label, min, max) => {
		const str = String(value ?? '').trim();
		
		console.log('str : ' + str);
		
		if (str === '') {
		    return `${label} 값이 입력되지 않았습니다.`;
		}
	
		const clean = str.replace(/[^a-zA-Z0-9]/g, '');
		//const clean = value.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gim, '');

		if (max != null) {
	        if (clean.length < min || clean.length > max) {
	            return `${label} 값은 ${min}~${max}자리여야 합니다.`;
	        }
	    } else {
	        if (clean.length < min) {
	            return `${label} 값은 최소 ${min}자리여야 합니다.`;
	        }
	    }

	    return null;
	},

	// 숫자만 추출 (문자 제거)
    onlyNumber: (val) => val.replace(/[^0-9]/g, ''),
	
	// 영어 대문자와 숫자만 입력
	toUpperAlpha: (value) => {
		let v = value;
		
		// 한글제거
		v = v.replace(/[ㄱ-ㅎ-ㅣ가-힣]/g, '');
		
		// 특수문자 제거
		v = v.replace(/[^a-zA-Z0-9]/g, '');
		
		// 영문 대문자로
		v = v.toUpperCase();
		
		return v;
	},
	
	// 공통 코드 조회
	async getCodes(groupIds = []) {
	    const uniqueGroupIds = [...new Set((groupIds || []).filter(Boolean))];
	    const result = {};
	    const missingGroupIds = [];

	    uniqueGroupIds.forEach(groupId => {
	        if (Object.prototype.hasOwnProperty.call(codeGroupCache, groupId)) {
	            result[groupId] = codeGroupCache[groupId];
	        } else {
	            missingGroupIds.push(groupId);
	        }
	    });

	    if (missingGroupIds.length === 0) {
	        return result;
	    }

	    const pendingKey = missingGroupIds.slice().sort().join('|');

	    if (!codeGroupPending[pendingKey]) {
	        codeGroupPending[pendingKey] = fetch('/api/codes/list', {
	            method: 'POST',
	            headers: {
	                'Content-Type': 'application/json'
	            },
	            body: JSON.stringify({ groupIds: missingGroupIds })
	        })
	            .then(res => res.json())
	            .then(data => {
	                if (!data.success) {
	                    return {};
	                }

	                const codes = data.codes || {};

	                missingGroupIds.forEach(groupId => {
	                    codeGroupCache[groupId] = codes[groupId] || [];
	                });

	                return codes;
	            })
	            .finally(() => {
	                delete codeGroupPending[pendingKey];
	            });
	    }

	    const fetchedCodes = await codeGroupPending[pendingKey];

	    missingGroupIds.forEach(groupId => {
	        result[groupId] = codeGroupCache[groupId] || fetchedCodes[groupId] || [];
	    });
		
		// 그룹별 코드 데이터 반환
		// ex)
		// {
		//   TASK: [...],
		//   BANK: [...],
		//   PAYGB: [...]
		// }
		
	    return result;
	},
	
	// 공통 코드 상세 조회 - DETAIL_NM 포함
	async getCodeDetails(groupIds = []) {

	    const res = await fetch('/api/codes/detail-list', {
	        method: 'POST',
	        headers: {
	            'Content-Type': 'application/json'
	        },
	        body: JSON.stringify({ groupIds })
	    });

	    const data = await res.json();

	    if (!data.success) {
	        return {};
	    }

	    return data.codes || {};
	},

	getCodeOptions(codes, groupId) {
	    return codes?.[groupId] || [];
	},
	
	// 날짜 변환
	formatDateFields(obj) {

	    if (Array.isArray(obj)) {
	        return obj.map(item => this.formatDateFields(item));
	    }

	    if (!obj || typeof obj !== 'object') {
	        return obj;
	    }

	    const newObj = { ...obj };

	    Object.keys(newObj).forEach(key => {

	        const value = newObj[key];

	        // 하위 객체 재귀
	        if (typeof value === 'object' && value !== null) {
	            newObj[key] = this.formatDateFields(value);
	        }

	        // 날짜 변환
	        else if (
	            typeof value === 'string' &&
	            /^\d{8}$/.test(value) &&
	            (key.includes('DT') || key.includes('DATE'))
	        ) {
	            newObj[key] =
	                `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
	        }
	    });

	    return newObj;
	},
	
	async copyText (text, label = '값') {

		if (!text) {
		    return false;
		}

		try {
		    await navigator.clipboard.writeText(text);
		} catch (err) {

		    const textarea = document.createElement('textarea');

		    textarea.value = text;
		    textarea.style.position = 'fixed';
		    textarea.style.opacity = '0';

		    document.body.appendChild(textarea);

		    textarea.select();
		    document.execCommand('copy');

		    document.body.removeChild(textarea);
		}

		toast(`${label}가 복사되었습니다.`);

		return true;
	},
		
	// 등록번호 하이픈
	formatRegNo(regNo) {
	    if (!regNo) return '';

	    const value = String(regNo).replaceAll('-', '');

	    return value.length > 6
	        ? `${value.slice(0, 6)}-${value.slice(6)}`
	        : value;
	},
	
	// 핸드폰번호 하이픈 추가
	formatPhoneNo(phoneNo) {
	    if (!phoneNo) return '';

	    const value = String(phoneNo).replaceAll('-', '');

	    if (value.length === 11) {
	        return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
	    }

	    return value;
	},

	// 전체 주소 넣고 조회하기 
	createAddrParam(address) {

	    // 공백 제거
	    let inputAddr = address.replace(/\s/g, '');
		
		// 행정구역 제거하고 시작
		const addr = gf.removeRegionAddress(inputAddr);
		
		console.log("addr : " + addr);
		
	    // 결과값
	    let ROAD_NM = '';
	    let BUILDB_NO = '';
	    let BUILDS_NO = '';
	    let BUBJUNGRI_NM = 'N';

	    // 전체 주소에서 실제 검색 대상 추출
	    // ex)
		// · 길이름 + 건물번호 
	    // 서울중구세종대로110 -> 세종대로110
		// · 읍면동 + 번지
	    // 경기도성남시분당구삼평동681-1 -> 삼평동681-1
	    
		// 도로명 패턴
		const roadMatch = addr.match(
	        /([가-힣0-9]+(?:대로|로|길))([0-9]+(?:-[0-9]+)?)/
	    );

	    // 지번 패턴
	    const jibunMatch = addr.match(
	        /([가-힣0-9]+(?:읍|면|동|리))([0-9]+(?:-[0-9]+)?)/
	    );
		

	    let targetAddr = '';

	    // 도로명 우선
	    if (roadMatch) {

			targetAddr = roadMatch[0];

			ROAD_NM = roadMatch[1];
			BUILDB_NO = roadMatch[2];

	    }

	    // 지번
	    else if (jibunMatch) {

			targetAddr = jibunMatch[0];

	        ROAD_NM = jibunMatch[1];
	        BUILDB_NO = jibunMatch[2];

	    }

	    // 리 여부
	    if (ROAD_NM.endsWith('리')) {
	        BUBJUNGRI_NM = 'Y';
	    }

	    // 본번 / 부번 분리
	    if (BUILDB_NO.includes('-')) {

	        const splitNo = BUILDB_NO.split('-');

	        BUILDB_NO = splitNo[0];
	        BUILDS_NO = splitNo[1];

	    }
		
		console.log({
			        ROAD_NM,
			        BUILDB_NO,
			        BUILDS_NO,
			        BUBJUNGRI_NM
			    });

	    return {
	        ROAD_NM,
	        BUILDB_NO,
	        BUILDS_NO,
	        BUBJUNGRI_NM
	    };
		
	},


	// 행정구역 제거
	removeRegionAddress(address) {

	    let inputAddr = address.replace(/\s/g, '');

	    // 시/도 제거 대상
	    const removeWords = [
	        '경기도', '강원특별자치도', '충청북도', '충청남도',
	        '전북특별자치도', '전라남도', '경상북도', '경상남도',
	        '제주특별자치도', '강원도', '전라도', '경상도', '충청도',
	        
			'서울', '부산', '대구', '인천', '광주', '대전', '울산'
			// 나머지는 세종대로 같이 ㅇㅇ대로가 있어서 삭제함
	    ];

	    // 시/도 제거
	    removeWords.forEach(word => {

	        if (inputAddr.startsWith(word)) {

	            inputAddr =
	                inputAddr.substring(word.length);

	        }

	    });
		
		// 시/군/구 제거
		while (/^[가-힣]+?(시|군|구)(?=[가-힣])/.test(inputAddr)) {

		    inputAddr = inputAddr.replace(
		        /^[가-힣]+?(시|군|구)/,
		        ''
		    );

		}

		// 시/군/구 제거 후 남은 읍/면 제거
		inputAddr = inputAddr.replace(
		    /^[가-힣]+?(읍|면)/,
		    ''
		);

	    return inputAddr;

	}
};

 
export const mapData = (prev, dbData, mapping) => {
    const result = { ...prev };

    Object.keys(mapping).forEach(key => {
        const dbKey = mapping[key];
        result[key] = dbData[dbKey] ?? prev[key];
    });

    return result;
};
