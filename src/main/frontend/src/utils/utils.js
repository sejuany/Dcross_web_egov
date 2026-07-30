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
	
	// 광역자치단체명 표준화
	findSidoNm(address) {

	    const SIDO_MAP = {
	        '서울특별시': '서울특별시',
	        '서울시': '서울특별시',
	        '서울': '서울특별시',

	        '부산광역시': '부산광역시',
	        '부산시': '부산광역시',
	        '부산': '부산광역시',

	        '대구광역시': '대구광역시',
	        '대구시': '대구광역시',
	        '대구': '대구광역시',

	        '인천광역시': '인천광역시',
	        '인천시': '인천광역시',
	        '인천': '인천광역시',

	        '광주광역시': '광주광역시',
	        '광주시': '광주광역시',
	        '광주': '광주광역시',

	        '대전광역시': '대전광역시',
	        '대전시': '대전광역시',
	        '대전': '대전광역시',

	        '울산광역시': '울산광역시',
	        '울산시': '울산광역시',
	        '울산': '울산광역시',

	        '세종특별자치시': '세종특별자치시',
	        '세종시': '세종특별자치시',
	        '세종': '세종특별자치시',

	        '경기도': '경기도',

	        '강원특별자치도': '강원특별자치도',
	        '강원도': '강원특별자치도',
	        '강원': '강원특별자치도',

	        '충청북도': '충청북도',
	        '충북': '충청북도',

	        '충청남도': '충청남도',
	        '충남': '충청남도',

	        '전북특별자치도': '전북특별자치도',
	        '전북도': '전북특별자치도',
	        '전북': '전북특별자치도',

	        '전라남도': '전라남도',
	        '전라도': '전라남도',
	        '전남': '전라남도',

	        '경상북도': '경상북도',
	        '경북': '경상북도',

	        '경상남도': '경상남도',
	        '경남': '경상남도',

	        '제주특별자치도': '제주특별자치도',
	        '제주도': '제주특별자치도',
	        '제주': '제주특별자치도'
	    };

	    const input = (address || '').replace(/\s/g, '');

	    for (const key of Object.keys(SIDO_MAP).sort((a, b) => b.length - a.length)) {
	        if (input.startsWith(key)) {
	            return SIDO_MAP[key];
	        }
	    }

	    return '';
	},
	
	// 주소를 공백 기준으로 분리하고 약식 주소는 숫자를 분리
	parseAddress(address) {

		const tokens = (address || '')
		    .trim()
		    .split(/\s+/)
		    .filter(Boolean);

		// 공백이 없는 입력 대응
		if (tokens.length === 1) {

		    const token = tokens[0];

		    const match = token.match(
		        /^(.+?)([0-9]+(?:-[0-9]+)?)$/
		    );

		    if (match) {
		        return [match[1], match[2]];
		    }
		}

		return tokens;
	},
	

	// 주소 토큰을 시도, 도로명(지번), 건물번호로 분류
	classifyAddress(tokens) {

		const result = {
		    sido: '',
		    sigungu: '',
		    eupmyeon: '',
		    road: '',
		    jibun: '',
		    buildNo: '',
		    buildSubNo: ''
		};

	    tokens.forEach(token => {

	        const sido = gf.findSidoNm(token);

	        if (!result.sido && sido) {
	            result.sido = sido;
	            return;
	        }

	        if (!result.sigungu && /(?:시|군|구)$/.test(token)) {
	            result.sigungu = token;
	            return;
	        }

	        if (!result.eupmyeon && /(?:읍|면)$/.test(token)) {
	            result.eupmyeon = token;
	            return;
	        }

	        if (!result.road && /(?:대로|로|길)$/.test(token)) {
	            result.road = token;
	            return;
	        }

	        if (!result.jibun && /(?:동|리)$/.test(token)) {
	            result.jibun = token;
	            return;
	        }


			if (!result.buildNo && /^[0-9]+(?:-[0-9]+)?$/.test(token)) {

			    const [mainNo, subNo = ''] = token.split('-');

			    result.buildNo = mainNo;
			    result.buildSubNo = subNo;

			    return;
			}
	    });

		result.roadSearch = result.road;

		result.jibunSearch = [
		    result.sigungu,
		    result.eupmyeon,
		    result.jibun
		].filter(Boolean).join('');

	    return result;
	},
	

	// 주소검색
	createAddrParam(address) {

		address = (address || '').trim();
		
		// 한글+숫자 중 한글 부분의 공백 개수 확인
		const spaceCount = (address.match(/\s+/g) || []).length;

		// 공백이 1개 이하인 약식 주소 처리
		if (spaceCount <= 1) {

		    const match = address.match(/^(.+?)(\d+(?:-\d+)?)$/);

		    if (match) {

		        const roadNm = match[1].replace(/\s+/g, '');
		        const [buildNo, buildSubNo = ''] = match[2].split('-');

		        return {
		            SIDO_NM: '',
		            ROAD_NM: roadNm,
		            BUILDB_NO: buildNo,
		            BUILDS_NO: buildSubNo,
		            BUBJUNGRI_NM: 'N'
		        };
		    }
		}


		// 전체 주소에서 건물번호 앞 공백이 없는 경우 보정
		const match = address.match(/^(.+?)(\d+(?:-\d+)?)$/);

		if (match) {
		    const [, text, number] = match;
		    address = `${text.trim()} ${number}`;
		}

		const info = gf.classifyAddress(gf.parseAddress(address));
		log(info);
	
	    if (info.road) {

			return {
				SIDO_NM: info.sido,
		        ROAD_NM: info.road,
			    BUILDB_NO: info.buildNo,
			    BUILDS_NO: info.buildSubNo,
			    BUBJUNGRI_NM: 'N'
			};
	    }

	    if (info.jibun) {

			return {
			    SIDO_NM: info.sido,
			    ROAD_NM: info.jibun,
			    BUILDB_NO: info.buildNo,
			    BUILDS_NO: info.buildSubNo,
			    BUBJUNGRI_NM: 'N'
			};
	    }

	    return null;
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
	
	/**
	 * 주민등록번호 기준 미성년자 여부
	 */
	isMinor(regNo) {

	    if (!regNo || regNo.length < 7) {
	        return false;
	    }

	    const yy = Number(regNo.substring(0, 2));
	    const mm = Number(regNo.substring(2, 4));
	    const dd = Number(regNo.substring(4, 6));
	    const gender = regNo.charAt(6);

	    // 출생연도
	    const year = ['1', '2', '5', '6'].includes(gender)
	        ? 1900 + yy
	        : 2000 + yy;

	    const today = new Date();

	    let age = today.getFullYear() - year;

	    // 올해 생일이 아직 지나지 않았으면 1살 차감
	    if (
	        today.getMonth() + 1 < mm ||
	        (
	            today.getMonth() + 1 === mm &&
	            today.getDate() < dd
	        )
	    ) {
	        age--;
	    }

	    return age < 19;
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
