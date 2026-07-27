import axios from 'axios';
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

	mask(value, type) {

	    const patterns = {
	        PHONE: '___-____-____',
	        TEL: '__-___-____',
	        BIZNO: '___-__-_____',
	        REGNO: '______-_______',
	        CARD: '____-____-____-____ __/__'
	    };

	    const pattern = patterns[type];

	    if (!pattern) {
	        return value ?? '';
	    }

	    value = String(value ?? '');

	    // 이미 마스크가 적용된 값이면 그대로 사용
	    if (value.includes('_')) {
	        return value;
	    }

	    const raw = value.replace(/[^\d_]/g, '');

	    let result = '';
	    let idx = 0;

	    for (const ch of pattern) {

	        if (ch === '_') {

	            if (idx < raw.length) {
	                result += raw[idx++];
	            } else {
	                result += '_';
	            }

	        } else {
	            result += ch;
	        }
	    }

	    return result;
	},
	
	/**
	 * 마스크 입력 시 커서 위치 유지
	 */
	maskCursor(e) {

	    const input = e.target;

		requestAnimationFrame(() => {

		    const pos = input.__cursorPos ?? 0;

		    input.setSelectionRange(
		        pos,
		        pos
		    );
		});
	},

	maskKeyDown(e) {

	    const input = e.target;
	    const value = input.value;

		// 숫자 입력 시 현재 위치 숫자를 덮어씀
		if (/^\d$/.test(e.key)) {

		    e.preventDefault();

		    let insertPos = input.selectionStart;

		    // 숫자 또는 언더바 위치 찾기
		    while (
		        insertPos < value.length &&
		        !/[\d_]/.test(value[insertPos])
		    ) {
		        insertPos++;
		    }

		    if (insertPos >= value.length) {
		        return;
		    }

		    const newValue =
		        value.substring(0, insertPos) +
		        e.key +
		        value.substring(insertPos + 1);

		    input.value = newValue;

		    input.__cursorPos = insertPos + 1;

		    requestAnimationFrame(() => {

		        input.setSelectionRange(
		            insertPos + 1,
		            insertPos + 1
		        );

		        input.dispatchEvent(
		            new Event('input', { bubbles: true })
		        );
		    });

		    return;
		}

	    input.__cursorPos = input.selectionStart;

	    // 여러 글자 선택 후 Backspace 했을 때 추가
	    if (
	        e.key === 'Backspace' &&
	        input.selectionStart < input.selectionEnd
	    ) {

	        e.preventDefault();

	        const start = input.selectionStart;
	        const end = input.selectionEnd;

	        const chars = value.split('');

	        for (let i = start; i < end; i++) {

	            // 숫자만 언더바로 치환
	            if (/\d/.test(chars[i])) {
	                chars[i] = '_';
	            }
	        }

	        input.value = chars.join('');

	        requestAnimationFrame(() => {

	            input.setSelectionRange(
	                start,
	                start
	            );

	            input.dispatchEvent(
	                new Event('input', { bubbles: true })
	            );
	        });

	        return;
	    }

	    // 여기서부터는 숫자를 삭제 했을 때, 언더바로 치환되도록 설정
	    if (e.key !== 'Backspace') {
	        return;
	    }

	    e.preventDefault();

	    const cursorPos = input.selectionStart;

	    let deletePos = cursorPos - 1;

	    // 숫자 위치 찾기
	    while (
	        deletePos >= 0 &&
	        !/\d/.test(value[deletePos])
	    ) {
	        deletePos--;
	    }

	    if (deletePos < 0) {
	        return;
	    }

	    const newValue =
	        value.substring(0, deletePos) +
	        '_' +
	        value.substring(deletePos + 1);

	    input.value = newValue;

	    requestAnimationFrame(() => {

	        input.setSelectionRange(
	            deletePos,
	            deletePos
	        );

	        input.dispatchEvent(
	            new Event('input', { bubbles: true })
	        );
	    });
	},
	
	// 광역자치단체
	findSidoNm(address) {
		
		const SIDO_MAP = {
		    '서울': '서울특별시',
		    '서울시': '서울특별시',
		    '서울특별시': '서울특별시',

		    '부산': '부산광역시',
		    '부산시': '부산광역시',
		    '부산광역시': '부산광역시',

		    '대구': '대구광역시',
		    '대구시': '대구광역시',
		    '대구광역시': '대구광역시',

		    '인천': '인천광역시',
		    '인천시': '인천광역시',
		    '인천광역시': '인천광역시',

		    '광주': '광주광역시',
		    '광주시': '광주광역시',
		    '광주광역시': '광주광역시',

		    '대전': '대전광역시',
		    '대전시': '대전광역시',
		    '대전광역시': '대전광역시',

		    '울산': '울산광역시',
		    '울산시': '울산광역시',
		    '울산광역시': '울산광역시',

		    '세종': '세종특별자치시',
		    '세종시': '세종특별자치시',
		    '세종특별자치시': '세종특별자치시',

		    '경기': '경기도',
		    '경기도': '경기도',

		    '강원': '강원특별자치도',
		    '강원도': '강원특별자치도',
		    '강원특별자치도': '강원특별자치도',

		    '충북': '충청북도',
		    '충청북도': '충청북도',

		    '충남': '충청남도',
		    '충청남도': '충청남도',

		    '전북': '전북특별자치도',
		    '전북도': '전북특별자치도',
		    '전북특별자치도': '전북특별자치도',

		    '전남': '전라남도',
			'전라도': '전라남도',
		    '전라남도': '전라남도',

		    '경북': '경상북도',
		    '경상북도': '경상북도',

		    '경남': '경상남도',
		    '경상남도': '경상남도',

		    '제주': '제주특별자치도',
		    '제주도': '제주특별자치도',
		    '제주특별자치도': '제주특별자치도'
		};
		
		const firstWord = address.trim().split(/\s+/)[0];

		return SIDO_MAP[firstWord] || '';
	},
	
	// 전체 주소 넣고 조회하기 
	createAddrParam(address) {

		// 광역자치단체  
		const SIDO_NM = gf.findSidoNm(address);
		
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
					SIDO_NM,
			        ROAD_NM,
			        BUILDB_NO,
			        BUILDS_NO,
			        BUBJUNGRI_NM
			    });

	    return {
			SIDO_NM,
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

	},
	

	/**
	 * 최소 로딩시간 보장
	 * @param {number} startTime Date.now()
	 * @param {Function} callback 로딩 종료 함수
	 * @param {number} minTime 최소 유지 시간(ms)
	 */
	 loadingDelay(startTime, callback, minTime = 800) {
	    const elapsed = Date.now() - startTime;
	    const remain = Math.max(0, minTime - elapsed);

	    setTimeout(callback, remain);
	},
	
	// 금액 콤마
	formatAmount(amount) {

	    if (amount === '' || amount == null) {
	        return '';
	    }

	    return Number(String(amount).replaceAll(',', '')).toLocaleString();
	},
	
	// 공통코드 목록 조회
	// 회사별 정책에 따라 허용된 코드만 반환
	getCodeList(codes, companyPolicy, companyId, codeId) {

	    let list = codes[codeId] || [];

	    const filterCodes =
	        companyPolicy?.[companyId]?.[codeId];

	    if (filterCodes) {

	        list = list
	            .filter(item => filterCodes.includes(item.CODE_ID))
				// 쓴 순서대로 정렬
	            .sort((a, b) =>
	                filterCodes.indexOf(a.CODE_ID) -
	                filterCodes.indexOf(b.CODE_ID)
	            );
	    }

	    return list;
	},
};

 
export const mapData = (prev, dbData, mapping) => {
    const result = { ...prev };

    Object.keys(mapping).forEach(key => {
        const dbKey = mapping[key];
        result[key] = dbData[dbKey] ?? prev[key];
    });

    return result;
};
