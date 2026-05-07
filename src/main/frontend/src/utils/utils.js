// console.log 단축용 로그 함수
export const log = (...args) => console.log(...args);

export const gf = {
	
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

	    const res = await fetch('/api/codes/list', {
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
		
		// 그룹별 코드 데이터 반환
		// ex)
		// {
		//   TASK: [...],
		//   BANK: [...],
		//   PAYGB: [...]
		// }
	    return data.codes || {};
	},

	getCodeOptions(codes, groupId) {
	    return codes?.[groupId] || [];
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