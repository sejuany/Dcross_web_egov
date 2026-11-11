// 신규신청현황 컬럼만 관리한다. 검색·조회·상세 이동은 NewcarList.jsx에서 공통으로 처리한다.
// 기업 추가 시 해당 기업의 컬럼과 마지막 선택 분기를 추가하고 기존 기본 구성을 유지한다.
const formatYyyyMmDd = (value) => {
    const digits = String(value || '').replace(/[^0-9]/g, '');

    if (digits.length !== 8) {
        return value || '';
    }

    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const formatAmount = (value) => {
    const digits = String(value ?? '').replace(/[^0-9-]/g, '');

    if (!digits || digits === '-') {
        return '';
    }

    const numberValue = Number(digits);

    if (Number.isNaN(numberValue)) {
        return value || '';
    }

    return numberValue.toLocaleString('ko-KR');
};
// 공통 코드의 업무 의미를 한성 화면 용어로 바꾼다. 저장된 상태 코드는 변경하지 않는다.
const wb001StatusLabels = {
    입력: '입력', 저장: '저장', 납부요청: '등록비입금 요청', 납부완료: '등록비입금 완료',
    심사요청: '등록 중', 심사완료: '등록완료',
    채권납부요청: '채권 처리중(등록완료)', 지방세요청: '지방세 처리중(등록완료)', 처리완료: '처리완료'
};

export const getNewcarListColumns = ({ companyId, memberGb, formatCode }) => {
    // 기본 사용자 항목 (24개)
    const defaultColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40 },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 40, textAlign: 'center' },
        { headerName: '접수번호', field: 'SERVICE_ID', width: 145 },
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
        { headerName: '차량번호', field: 'REQ_CAR_NO', width: 110 },
        { headerName: '업무구분', field: 'WORK_CD', width: 90, valueFormatter: params => formatCode('SGB', params.value) },
        { headerName: '신청상태', field: 'PROC_ST', width: 90, valueFormatter: params => formatCode('PR_ST', params.value) },
        { headerName: '납부상태', field: 'PAY_ST', width: 90, valueFormatter: params => formatCode('PAYST', params.value) },
        { headerName: '사용연료', field: 'FUEL_CD', width: 90, valueFormatter: params => formatCode('FUEL', params.value) },
        { headerName: '임판여부', field: 'IMSINUM_YN', width: 90, valueFormatter: params => formatCode('IMPST', params.value) },
        { headerName: '비고', field: 'GOVT_TX', width: 120 },
        { headerName: '배송지', field: 'DELIVERY_ADDR', width: 250 },
        { headerName: '고객명', field: 'CUSTOMER_NM', width: 90 },
        { headerName: '전자납부번호', field: 'TAX_VBANK_NO', width: 120 },
        { headerName: '신청일자', field: 'REQUEST_DT', width: 120 },
        { headerName: '심사일자', field: 'JUDGE_DT', width: 100 },
        { headerName: '배송상태', field: 'NUM_PROC_ST', width: 120, valueFormatter: params => formatCode('NUMST', params.value) },
        { headerName: '배송구분', field: 'DELIVERY_GB', width: 90, valueFormatter: params => {
		    const value = params.value;
	        if (value === 'null' || value == null) {
	            return '';
	        }
	        return formatCode('DLVGB', value);
	    }},
        { headerName: '차량명', field: 'CAR_NM', width: 150 },
        { headerName: '차종', field: 'CAR_KD', width: 90, valueFormatter: params => formatCode('CARKD', params.value) },
        { headerName: '취득가액', field: 'BUY_AMT', width: 100, valueFormatter: params => formatAmount(params.value), cellClass: 'ag-right-cell' },
        { headerName: '소유자명', field: 'OWNER_NM', width: 90 },
        { headerName: '회사명', field: 'COMPANY_NM', width: 120 },
        { headerName: '신청인', field: 'MEMBER_NM', width: 90 },
        { headerName: '관청', field: 'GOVT_ID', width: 90, valueFormatter: params => formatCode('GOVT', params.value) },
    ];

    // SA 사용자 전용 항목 (21개)
	const saColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 20 },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 40, textAlign: 'center' },
        { headerName: '처리상태', field: 'PROC_ST', width: 90, valueFormatter: params => formatCode('PR_ST', params.value) },
        { headerName: '등록 예정일자', field: 'REGIST_DATE', width: 120, valueFormatter: params => formatYyyyMmDd(params.value) },
        { headerName: '주문번호', field: 'LINK_ID', width: 145 },
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
        { headerName: '차량번호', field: 'REQ_CAR_NO', width: 110 },
        { headerName: '소유자명', field: 'OWNER_NM', width: 90 },
		{ headerName: '공급가액', field: 'BUY_AMT', width: 100, valueFormatter: params => formatAmount(params.value), cellClass: 'ag-right-cell' },
        { headerName: '납부상태', field: 'ALL_PAY_YN', width: 90, valueFormatter: params => formatCode('PAYST', params.value) },
        { headerName: '차량대금 납부일자', field: 'BPAY_DT', width: 120 },
        { headerName: '등록비용 납부일자', field: 'PAY_DT', width: 120 },
        { headerName: '입력일자', field: 'REQUEST_DT', width: 120 },
        { headerName: '등록일자', field: 'JUDGE_DT', width: 100 },
		{ headerName: 'Space',  field: 'DELIVERY_GB', width: 90, valueFormatter: params => {
		    const value = params.value;
	        if (value === 'null' || value == null) {
	            return '';
	        }
	        return formatCode('DLVGB', value);
	    }},
        { headerName: '신청SP명', field: 'MEMBER_NM', width: 90 },
        { headerName: '접수번호', field: 'SERVICE_ID', width: 90 },
    ];

	// SU 사용자 전용 항목 (21개)
	const suColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 20 },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 40, textAlign: 'center' },
		{ headerName: '처리상태', field: 'PROC_ST', width: 90, valueFormatter: params => formatCode('PR_ST', params.value) },
		{ headerName: '주문번호', field: 'LINK_ID', width: 170 },
        { headerName: '차대번호', field: 'CARID_NO', width: 180 },
		{ headerName: '계약자명', field: 'CUSTOMER_NM', width: 130 },
        { headerName: '입력일자', field: 'REQUEST_DT', width: 120 },
		{ headerName: '등록 예정일자', field: 'REGIST_DATE', width: 130, valueFormatter: params => formatYyyyMmDd(params.value) },
		{ headerName: '공급가액', field: 'BUY_AMT', width: 120, valueFormatter: params => formatAmount(params.value), cellClass: 'ag-right-cell' },
		{ headerName: 'Space',  field: 'DELIVERY_GB', width: 180, valueFormatter: params => {
		    const value = params.value;
	        if (value === 'null' || value == null) {
	            return '';
	        }
	        return formatCode('DLVGB', value);
	    }},
        { headerName: '접수번호', field: 'SERVICE_ID',  flex: 1},
    ];

    // 한성 화면설계서 5페이지 순서. 체크박스는 기존 일괄 신청을 위해 유지한다.
    const wb001Columns = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40 },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 60 },
        { headerName: '등록예정일자', field: 'REGIST_DATE', width: 120, valueFormatter: params => formatYyyyMmDd(params.value) },
        { headerName: '처리상태', field: 'PROC_ST', width: 180, valueFormatter: params => {
            const label = formatCode('PR_ST', params.value);
            return wb001StatusLabels[label] || label;
        } },
        // 커미션 번호는 기존 주문번호(LINK_ID)의 한성 화면 표기다.
        { headerName: '커미션 번호', field: 'LINK_ID', width: 145 },
        { headerName: '구입 조건', colId: 'BUY_CONDITION', width: 130, valueGetter: ({ data }) => {
            if (data?.TASK_CD === 'NORML' && data.PROC_CD === 'I') return '현금/할부';
            if (data?.TASK_CD === 'LEASE') return data.PROC_CD === 'C' ? '이용자명의리스'
                : data.PROC_CD === 'I' ? '리스' : '';
            return '';
        } },
        { headerName: '차대번호', field: 'CARID_NO', width: 180 },
        // 등록 차량번호가 없으면 신청 시 선택한 번호를 표시하는 공통 조회값이다.
        { headerName: '차량번호', field: 'R_CAR_NO', width: 110 },
        { headerName: '소유자명', field: 'OWNER_NM', width: 120 },
        // 일반 리스는 TR_OWNERINFO, 이용자명의리스는 CUSTOMER_NM을 공통 SQL에서 연결한다.
        { headerName: '(리스)계약자명', field: 'LEASE_CUSTOMER_NM', width: 140 },
        { headerName: '공급가액', field: 'BUY_AMT', width: 130, valueFormatter: params => formatAmount(params.value), cellClass: 'ag-right-cell' },
        // 파일 한 개의 존재 여부가 아니라 필수서류 전체의 완료 여부. 첨부 대상이 아니면 빈칸이다.
        { headerName: '첨부서류', colId: 'ATTACH_STATUS', width: 90, valueGetter: ({ data }) =>
            data?.ATTACH_YN === 'Y' ? (data.ATTACH_COMPLETE_YN === 'Y' ? 'Y' : 'N') : '' },
        { headerName: '감면여부', field: 'NTAX_YN', width: 90 },
        // CARD_PAY_YN(납부 확인)이 아닌 취득세 카드납부 선택 여부다.
        { headerName: '카드납부', field: 'CARD_YN', width: 90 },
        { headerName: '입금일자', field: 'PAY_DT', width: 120 },
        // 배송 예정일(INSTALL_DT)이 아닌 실제 발송 처리일이다.
        { headerName: '배송일자', field: 'SEND_YN_DT', width: 120 },
        { headerName: '등록일자', field: 'JUDGE_DT', width: 120 },
        { headerName: '저공해 종류', field: 'LOW_POLLUTION_KD', width: 110 },
        { headerName: '저공해 번호', field: 'LOW_POLLUTION_NO', width: 170 },
        { headerName: '전시장', field: 'BRANCH_NM', width: 120 },
        { headerName: '신청SC명', field: 'MEMBER_NM', width: 110 },
        // 비고는 데이터 연결 없이 빈칸으로 제공한다.
        { headerName: '비고', colId: 'WB001_REMARK', width: 150, valueGetter: () => '' }
    ];

    // 기업 전용 구성을 우선하고, 그 외에는 기존 권한별 기본 그리드를 그대로 사용한다.
    if (companyId === 'WB001') return wb001Columns;
    if (memberGb === 'SA' || memberGb === 'CA') return saColumnDefs;
    if (memberGb === 'SU') return suColumnDefs;
    return defaultColumnDefs;
};
