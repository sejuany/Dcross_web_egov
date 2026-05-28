﻿import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useAuth } from '../../context/AuthContext';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import './PayInfo.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

const getFormattedDateOffset = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 관청을 보여줄지 말지 선택
let bGovtVisible = false;

const PayInfo = () => {
    const navigate = useNavigate();
    const gridRef = useRef(null);	
    const { user } = useAuth(); // 로그인 사용자 정보 가져오기 use_YN	'Y', regist_NO	'UA', member_NM	'다코스관리자', branch_ID	'dacos', login_GB	'UA', sangsa_ID	'dacos', login_ID	'dacos', member_GB	'UA', company_ID	'dacos', pass_WD	null
		
    const [codeMap, setCodeMap] = useState({});
    const [codeListMap, setCodeListMap] = useState({});
    const [companyList, setCompanyList] = useState([]);
    const [toastMessage, setToastMessage] = useState('');
    const [rowData, setRowData] = useState([]);
    const [totalCount, setTotalCount] = useState(0);

    const [searchFilters, setSearchFilters] = useState({
        workCD: '',
        companyID: '',
        govtId: '',
        userNM: '',
        carNo: '',
		baseGubun: 'PROC_DT',
        startDate: getFormattedDateOffset(0),
        endDate: getFormattedDateOffset(0),
        processStatus: 'END',
        PAY_ST: '',
		PAY_TP: ''
    });

	const SGB_DATA = [
	    { CODE_ID: '000', CODE_NM: '저당설정' },
	    { CODE_ID: '001', CODE_NM: '저당말소' },
	    { CODE_ID: '010', CODE_NM: '신규등록' },
	    { CODE_ID: '011', CODE_NM: '이전등록' },
	    { CODE_ID: '030', CODE_NM: '변경등록' },
	    { CODE_ID: '032', CODE_NM: '변경(이전)' },
	    { CODE_ID: '002', CODE_NM: '저당권변경' },
	    { CODE_ID: '003', CODE_NM: '저당권이전' },
	    { CODE_ID: '031', CODE_NM: '등록증재발급' }
	];
	
	// codeListMap에 적용 시
	codeListMap['WORK_CD'] = SGB_DATA;	

	const BASE_GUBUN = [
	    { CODE_ID: 'PROC_DT', CODE_NM: '처리일' },
	    { CODE_ID: 'REQUEST_DT', CODE_NM: '신청일' }
	];

	// codeListMap에 적용 시
	codeListMap['BASE_GUBUN'] = BASE_GUBUN;

	// 일부 지자체의 경우에 대해 처리
	const LOCAL = [
	    { CODE_ID: 'LOCAL', CODE_NM: '관내' },
	    { CODE_ID: 'GLOBAL', CODE_NM: '관외' }
	];	
	
		
	// useEffect시 []); 로 끝나면 딱 한번만 실행됨.
	useEffect(() => {		

		fetchCodes();        
	    fetchCompanies('000');
		
		if (user.member_GB.substring(0, 1) === 'U' || user.member_GB === 'GU') {
			if (user.member_GB.substring(0, 1) === 'U') {
				bGovtVisible = true;	// 최고관리자인 경우는 관청을 보여준다. 
			}			
		}
			
	}, []); 
	
	// 화면에 사용할 코드값 가져오기.
	const fetchCodes = async () => {
	    try {
	        const groupIds = ['SGB', 'BANK', 'PAYST', 'PR_ST', 'PAYME', 'DSIGB', 'GOVT', 'PAYTP', 'TRNGB', 'TASK'];
	        const responses = await Promise.all(
	            groupIds.map(id => axios.get(`/api/codes/${id}`))
	        );

	        const newCodeMap = {};
	        const newCodeListMap = {};
	        responses.forEach((res, index) => {
	            const groupId = groupIds[index];
	            if (res.data.success) {
	                newCodeListMap[groupId] = res.data.codes;
	                const tempMap = {};
	                res.data.codes.forEach(code => {
	                    tempMap[code.CODE_ID] = code.CODE_NM;
	                });
	                newCodeMap[groupId] = tempMap;
	            }
	        });
			/*
			const filteredGovt = newCodeListMap['GOVT'];
			
			// 로그인 한 사람이 관청이라면
			if (user.member_GB.substring(0, 1) === 'G') {
				// 해당 관청코드만 필터링 하여 처리
			    const govtResult = filteredGovt.filter(item => item.CODE_ID === user.company_ID);
			    newCodeListMap['GOVT'] = govtResult;

			    // 필터링 결과가 1개라면 즉시 상태값에 반영
			    if (govtResult.length === 1) {
			        setSearchFilters(prev => ({
			            ...prev,
			            govtId: govtResult[0].CODE_ID // 'CHANG' 같은 값이 바로 들어감
			        }));
			    }
			}
			*/
			
			if (user.company_ID === 'CHANG' || user.company_ID === 'DAEGU') {
				// 창원이나 대구인 경우엔 관내 / 관외를 표시해야 한다.					
				bGovtVisible = true;
				newCodeListMap['GOVT'] = LOCAL;
			}	
			
			
			setCodeMap(newCodeMap);
			setCodeListMap(newCodeListMap);			
	        //console.log(newCodeListMap);
	    } catch (error) {
	        console.error('공통 코드 조회 실패:', error);
	    }
	};
	
	// 각 업무별 회원사 정보 가져오기. 처음엔 설정 기준
	const fetchCompanies = async (workCd) => {
	    try {
	        // 사용자의 요청에 따라 관청(govtId) 조건 없이 WORK_CD='010'에 해당하는 
	        // 전체 회사 목록을 한 번만 불러와서 리스트에 넣어줍니다.
			console.log('member_GB : ' + user.member_GB)
			const requestParams = {
				workCd: workCd
			};
			
			if (user.member_GB.substring(0, 1) === 'C' || user.member_GB.substring(0, 1) === 'R') {
				// 일반 회사인경우
				requestParams.companyId = user.company_ID
			}
			if (user.member_GB.substring(0, 1) === 'G') {
				// 관청인 경우
				requestParams.govtId = user.company_ID
			}
			
			console.table(requestParams);
	        const response = await axios.get('/api/companies', {
	            params: requestParams
	        });
	        if (response.data.success) {
	            setCompanyList(response.data.list);
	        }
	    } catch (error) {
	        console.error('회사 목록 갱신 실패:', error);
	    }
	};	

	// 조회 버튼 눌렀을때
    const fetchPaymentList = async () => {
        try {
            const cleanParam = (val) => (val === '전체' || val === '전체 (회사)' || val === '전체 (관청)') ? '' : val;

			/*
			// 화면을 초기화할때 이미 정해져 있을테지만 조회시 다시한번 강화시킬 목적			
			const govtList = codeListMap['GOVT'];
			// 만약 현재 govtId가 비어있는데, 목록은 딱 1개라면 그 값을 사용함
			const finalGovtId = (!searchFilters.govtId && govtList?.length === 1) ? govtList[0].CODE_ID : searchFilters.govtId;
			*/
			let finalGovtId = '';
			let sLocalID = '';
			
			if (user.member_GB.substring(0, 1) === 'G') {
				// 관청인 경우
				finalGovtId = user.company_ID;
				if (user.company_ID === 'CHANG' || user.company_ID === 'DAEGU') {
					sLocalID = searchFilters.govtId;
				}
			} else {
				finalGovtId = searchFilters.govtId;
			}
			//alert(finalGovtId);
				
			// 회원사가 로그인 했을때 1개만 있는 경우
			if (companyList && companyList.length === 1) {
		        searchFilters.companyID = companyList[0].COMPANY_ID;
		    }

		    const params = {
                WORK_CD: searchFilters.workCD,
				COMPANY_ID: cleanParam(searchFilters.companyID),
				GOVT_ID: finalGovtId,
				USER_NM: searchFilters.userNM,
				CAR_NO: searchFilters.carNo,
				BASE_GUBUN: searchFilters.baseGubun, 				
				START_DT: searchFilters.startDate.replace(/-/g, ''),
				END_DT: searchFilters.endDate.replace(/-/g, ''),
				PROC_ST: cleanParam(searchFilters.processStatus),
				PAY_ST: searchFilters.PAY_ST,
				PAY_TP: searchFilters.PAY_TP,
				LOCAL_ID : sLocalID
            };

            const response = await axios.post('/api/payment/list', params);
            if (response.data.success) {
                setRowData(response.data.list);
                setTotalCount(response.data.list.length);
            }
        } catch (error) {
            console.error('납부현황 조회 실패:', error);
            setToastMessage('데이터 조회에 실패했습니다.');
            setTimeout(() => setToastMessage(''), 2500);
        }
    };



	
    const formatCode = (groupId, value) => {
        return codeMap[groupId] && codeMap[groupId][value] ? codeMap[groupId][value] : value;
    };

	const handleWorkCdChange = (e) => {
	    const selectedWorkCd = e.target.value;
	    		
	    // 상태 업데이트 (화면 표시용)
	    setSearchFilters(prev => ({ ...prev, workCD: selectedWorkCd }));
	    
		if (user.member_GB.substring(0, 1) === 'C' || user.member_GB.substring(0, 1) === 'R') {
			// 일반 회사인 경우엔 하면 안되므로.
			return;	
		}
		
	    // 2. 바뀐 값을 파라미터로 넘겨서 즉시 재조회
	    // fetchCompanies 함수가 인자를 받도록 설계되어 있어야 합니다.
	    fetchCompanies(selectedWorkCd); 
	};
	
    // UA 권한 컬럼정의
	const UA_ColumnDefs = [
		{ headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 33, cellClass: 'ag-right-aligned-cell', 
					valueGetter: params => {
				        if (params.node.isRowPinned()) {
				            return "합계"; // 고정 행에는 '합계' 글자 표시
				        }
				        return params.node.rowIndex + 1;
				    } },
	    { 
	        headerName: '업무구분', 
	        field: 'WORK_CD', 
	        width: 54, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('SGB', params.value) 
	    },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '차대번호', field: 'CARID_NO', width: 134, cellClass: 'ag-center-aligned-cell'},
	    { 
	        headerName: '차량번호', 
	        field: 'CAR_NO', 
	        width: 129, 
	        cellClass: 'ag-center-aligned-cell',
	        valueGetter: params => {
				// 💡 중요: 합계 행(pinned)일 경우 계산 로직을 타지 않고 빈 값을 반환하거나 특정 텍스트 출력
		        if (params.node.isRowPinned()) {
		            return ""; // 합계 행의 차량번호 칸은 비워둠
		        }
	            const { CAR_NO, MORT_COUNT } = params.data;
	            return MORT_COUNT !== 0 ? `${CAR_NO} 외 ${MORT_COUNT}건` : CAR_NO;
	        }
	    },
	    { 
	        headerName: '신청상태', 
	        field: 'PROC_ST', 
	        width: 70, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('PR_ST', params.value) 
	    },
	    { 
	        headerName: '처리관청', 
	        field: 'GOVT_ID', 
	        width: 87, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('GOVT', params.value) 
	    },
	    { 
	        headerName: '업무구분(중복)', 
	        field: 'TASK_CD', 
	        width: 61, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('TASK', params.value) 
	    },
	    { 
	        headerName: '납부상태', 
	        field: 'PAY_ST', 
	        width: 61, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('PAYST', params.value) 
	    },
	    { 
	        headerName: '정산', 
	        field: 'PAY_TP', 
	        width: 74, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('PAYTP', params.value) 
	    },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0'},
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '수수료', field: 'FEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대', field: 'NUMP_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대행', field: 'NUMP_PROXY_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '변경등록세', field: 'TMAN_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '이전등록대행비', field: 'TPROX_AMT', width: 96, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '계약번호', field: 'CONFIRM_NO', width: 94 },
	    { headerName: '회사명', field: 'COMPANY_NM', width: 94 }
	];
	
	// CU 권한 컬럼정의
	const CU_ColumnDefs = [
	    { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 33, cellClass: 'ag-center-aligned-cell',
			valueGetter: params => {
		        if (params.node.isRowPinned()) {
		            return "합계"; // 고정 행에는 '합계' 글자 표시
		        }
		        return params.node.rowIndex + 1;
		    } },
	    { 
	        headerName: '업무구분', 
	        field: 'WORK_CD', 
	        width: 54, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('SGB', params.value) 
	    },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '차대번호', field: 'CARID_NO', width: 134, cellClass: 'ag-center-aligned-cell'},
	    { 
	        headerName: '차량번호', 
	        field: 'CAR_NO', 
	        width: 129, 
	        cellClass: 'ag-center-aligned-cell',
			valueGetter: params => {
				// 💡 중요: 합계 행(pinned)일 경우 계산 로직을 타지 않고 빈 값을 반환하거나 특정 텍스트 출력
		        if (params.node.isRowPinned()) {
		            return ""; // 합계 행의 차량번호 칸은 비워둠
		        }
	            const { CAR_NO, MORT_COUNT } = params.data;
	            return MORT_COUNT !== 0 ? `${CAR_NO} 외 ${MORT_COUNT}건` : CAR_NO;
	        }	        
	    },
	    { 
	        headerName: '신청상태', 
	        field: 'PROC_ST', 
	        width: 70, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('PR_ST', params.value) 
	    },
	    { 
	        headerName: '처리관청', 
	        field: 'GOVT_ID', 
	        width: 87, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('GOVT', params.value) 
	    },
	    { 
	        headerName: '업무구분', 
	        field: 'TASK_CD', 
	        width: 61, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('TASK', params.value) 
	    },
	    { 
	        headerName: '납부상태', 
	        field: 'PAY_ST', 
	        width: 61, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('PAYST', params.value) 
	    },
	    { 
	        headerName: '정산', 
	        field: 'PAY_TP', 
	        width: 74, 
	        cellClass: 'ag-center-aligned-cell',
	        valueFormatter: params => formatCode('PAYTP', params.value) 
	    },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0'},
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '수수료', field: 'FEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대', field: 'NUMP_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대행', field: 'NUMP_PROXY_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '변경등록세', field: 'TMAN_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '이전등록대행비', field: 'TPROX_AMT', width: 96, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell'},
	    { headerName: '계약번호', field: 'CONFIRM_NO', width: 94 },
	    { headerName: '회사명', field: 'COMPANY_NM', width: 94 }
	];	
	
	const NH_ColumnDefs = [
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차량번호', field: 'CAR_NO', width: 95, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "" : params.data?.CAR_NO },
	    { headerName: '고객명', field: 'REQUEST_NM', width: 98, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '계약번호', field: 'CONFIRM_NO', width: 110, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청상태', field: 'PROC_ST', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '납부상태', field: 'PAY_ST', width: 61, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYST', params.value) },
	    { headerName: '정산', field: 'PAY_TP', width: 53, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYTP', params.value) },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '매도관리비', field: 'TMAN_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell' }
	];
	
	const AutoPlus_ColumnDefs = [
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차량번호', field: 'CAR_NO', width: 95, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "" : params.data?.CAR_NO },
	    { headerName: '신청상태', field: 'PROC_ST', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '납부상태', field: 'PAY_ST', width: 61, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYST', params.value) },
	    { headerName: '정산', field: 'PAY_TP', width: 53, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYTP', params.value) },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '이전등록대행비', field: 'TPROX_AMT', width: 90, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell' }
	];

	const GU_ColumnDefs = [
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '차량번호', field: 'CAR_NO', width: 110, cellClass: 'ag-center-aligned-cell', valueGetter: params => {
	        if (params.node.isRowPinned()) return "";
	        const { CAR_NO, MORT_COUNT } = params.data || {};
	        return (MORT_COUNT && MORT_COUNT !== '0' && MORT_COUNT !== 0) ? `${CAR_NO} 외 ${MORT_COUNT}건` : CAR_NO;
	    }},
	    { headerName: '민원인', field: 'REQUEST_NM', width: 85, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청기업', field: 'COMPANY_NM', width: 85, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청상태', field: 'PROC_ST', width: 67, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부상태', field: 'PAY_ST', width: 53, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 69, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 56, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 56, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세번호', field: 'INJI_NO', width: 125, cellClass: 'ag-right-aligned-cell' },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell' }
	];
	
	const KB_ColumnDefs = [
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 126, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차량번호', field: 'CAR_NO', width: 74, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "" : params.data?.CAR_NO },
	    { headerName: '차대번호', field: 'CARID_NO', width: 130, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청상태', field: 'PROC_ST', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '처리관청', field: 'GOVT_ID', width: 87, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('Govt', params.value) },
	    { headerName: '납부상태', field: 'PAY_ST', width: 61, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYST', params.value) },
	    { headerName: '정산', field: 'PAY_TP', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYTP', params.value) },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', 
	      cellStyle: params => (!params.node.isRowPinned() && params.data && params.data.PRE_ACQ_AMT !== params.data.ACQ_AMT) ? { backgroundColor: 'yellow' } : null,
	      valueFormatter: params => params.value?.toLocaleString() 
	    },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '수수료', field: 'FEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대', field: 'NUMP_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대행', field: 'NUMP_PROXY_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '이전등록대행비', field: 'TPROX_AMT', width: 96, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '계약번호', field: 'CONFIRM_NO', width: 94, cellClass: 'ag-center-aligned-cell' }
	];
	
	const Obs_ColumnDefs = [
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차량번호', field: 'CAR_NO', width: 95, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "" : params.data?.CAR_NO },
	    { headerName: '신청상태', field: 'PROC_ST', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '납부상태', field: 'PAY_ST', width: 61, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYST', params.value) },
	    { headerName: '정산', field: 'PAY_TP', width: 53, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYTP', params.value) },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '수수료', field: 'FEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대', field: 'NUMP_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대행', field: 'NUMP_PROXY_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '고객명', field: 'CU_NAME', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차명', field: 'CAR_NM', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차대번호', field: 'CARID_NO', width: 119, cellClass: 'ag-right-aligned-cell' },
	    { headerName: '비고', field: 'GOVT_TX', width: 94, cellClass: 'ag-center-aligned-cell' }
	];
	
	const AJ_ColumnDefs = [
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차량번호', field: 'CAR_NO', width: 95, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "" : params.data?.CAR_NO },
	    { headerName: '신청상태', field: 'PROC_ST', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '납부상태', field: 'PAY_ST', width: 61, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYST', params.value) },
	    { headerName: '정산', field: 'PAY_TP', width: 53, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYTP', params.value) },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대', field: 'NUMP_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대행', field: 'NUMP_PROXY_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '고객명', field: 'CU_NAME', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차대번호', field: 'CARID_NO', width: 119, cellClass: 'ag-right-aligned-cell' }
	];
	
	const SOCARSCAR_ColumnDefs = [
	    { 
	      headerName: '', field: 'CHK', width: 27, 
	      checkboxSelection: params => !params.node.isRowPinned() && (params.data?.PROC_ST === 'END'), // 마이플랫폼 로직 대응 (PROC_ST가 'END'일때만 활성화)
	      headerCheckboxSelection: true,
	      cellClass: 'ag-center-aligned-cell'
	    },
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차량번호', field: 'CAR_NO', width: 95, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "" : params.data?.CAR_NO },
	    { headerName: '신청상태', field: 'PROC_ST', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '납부상태', field: 'PAY_ST', width: 61, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYST', params.value) },
	    { headerName: '정산', field: 'PAY_TP', width: 53, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYTP', params.value) },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대', field: 'NUMP_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대행', field: 'NUMP_PROXY_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호(취득세)', field: 'EPAY_NO', width: 147, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호(등록세)', field: 'UREG_EPAY_NO', width: 152, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '고객명', field: 'CU_NAME', width: 94, cellClass: 'ag-center-aligned-cell' }
	];
	
	const AutoRego_ColumnDefs = [
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차량번호', field: 'CAR_NO', width: 95, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "" : params.data?.CAR_NO },
	    { headerName: '신청상태', field: 'PROC_ST', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '납부상태', field: 'PAY_ST', width: 61, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYST', params.value) },
	    { headerName: '정산', field: 'PAY_TP', width: 53, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYTP', params.value) },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '수수료', field: 'FEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대', field: 'NUMP_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대행', field: 'NUMP_PROXY_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '고객명', field: 'CU_NAME', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차명', field: 'CAR_NM', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차대번호', field: 'CARID_NO', width: 119, cellClass: 'ag-right-aligned-cell' },
	    { headerName: '비고', field: 'GOVT_TX', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '사용본거지', field: 'BASE_ADDRESS', width: 74, cellClass: 'ag-left-aligned-cell' }
	];
	
	const IMS_ColumnDefs = [
	    { headerName: '순번', width: 33, cellClass: 'ag-center-aligned-cell', valueGetter: params => params.node.isRowPinned() ? "합계" : params.node.rowIndex + 1 },
	    { headerName: '업무구분', field: 'WORK_CD', width: 54, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('SGB', params.value) },
	    { headerName: '접수번호', field: 'SERVICE_ID', width: 134, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '차량번호', field: 'CAR_NO', width: 130, cellClass: 'ag-center-aligned-cell', valueGetter: params => {
	        if (params.node.isRowPinned()) return "";
	        const { CAR_NO, MORT_COUNT } = params.data || {};
	        return (MORT_COUNT && MORT_COUNT !== '0' && MORT_COUNT !== 0) ? `${CAR_NO} 외 ${MORT_COUNT}건` : CAR_NO;
	    }},
	    { headerName: '입금총액', field: 'TOTAL_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value ? Number(params.value).toLocaleString() : '0' },
	    { headerName: '가상계좌', field: 'VBANK_NO', width: 113, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청상태', field: 'PROC_ST', width: 70, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PR_ST', params.value) },
	    { headerName: '납부상태', field: 'PAY_ST', width: 61, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYST', params.value) },
	    { headerName: '정산', field: 'PAY_TP', width: 53, cellClass: 'ag-center-aligned-cell', valueFormatter: params => formatCode('PAYTP', params.value) },
	    { headerName: '취득세', field: 'ACQ_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '등록면허세', field: 'REGIS_AMT', width: 74, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '증지대', field: 'STAMP_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '인지세', field: 'INJI_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권금액', field: 'BOND_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '채권수수료', field: 'BFEE_AMT', width: 72, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대', field: 'NUMP_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '번호판대행', field: 'NUMP_PROXY_AMT', width: 79, cellClass: 'ag-right-aligned-cell', valueFormatter: params => params.value?.toLocaleString() },
	    { headerName: '소속명', field: 'BRANCH_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청자명', field: 'MEMBER_NM', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '신청일자', field: 'REQUEST_DT', width: 72, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '심사일자', field: 'JUDGE_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '납부일자', field: 'PAY_DT', width: 74, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '전자납부번호', field: 'EPAY_NO', width: 94, cellClass: 'ag-center-aligned-cell' },
	    { headerName: '고객명', field: 'CU_NAME', width: 94, cellClass: 'ag-center-aligned-cell' }
	];
	
	
    // user ID에 따라 컬럼 속성 분기
    const columnDefs = React.useMemo(() => {
		if (user.member_GB.substring(0, 1) === 'U' || user.member_GB === 'GU') {
			return UA_ColumnDefs;					
		}
			
		
		
		
        if (user && user.userId === 'number03') {
            //return number03ColumnDefs;
        }
        // 기본적으로 defaultColumnDefs 반환
        return UA_ColumnDefs;
    }, [user, codeMap]);

    const handleRowDoubleClicked = (event) => {
        if (event.data && event.data.SERVICE_ID) {
            navigate('/newcar/newcar-request', { state: { receiptNo: event.data.SERVICE_ID } });
        }
    };

    const handleSearchClick = () => {
        fetchPaymentList();
    };

    const handleResetClick = () => {
		// 1. 기본적으로 초기화할 값들을 세팅합니다.
	    const resetValues = {
	        workCD: '',
	        companyID: '',
	        govtId: '',
	        userNM: '',
	        clientName: '',
	        carNo: '',
	        baseGubun: 'PROC_DT',
	        startDate: getFormattedDateOffset(0),
	        endDate: getFormattedDateOffset(0),
	        PAY_ST: '',
	        PAY_TP: '',
	        processStatus: 'END'
	    };

	    // 2. 회사(Company) 목록이 1개뿐이라면 초기화 시에도 해당 값을 유지
	    if (companyList && companyList.length === 1) {
	        resetValues.companyID = companyList[0].COMPANY_ID;
	    }

	    // 3. 관청(GOVT) 목록이 1개뿐이라면 초기화 시에도 해당 값을 유지
	    const govtList = codeListMap['GOVT'];
	    if (govtList && govtList.length === 1) {
	        resetValues.govtId = govtList[0].CODE_ID; // CODE_ID가 식별자인 경우
	    }

	    // 4. 상태 업데이트
	    setSearchFilters(resetValues);
    };

    const handleExportExcel = () => {
        if (gridRef.current && gridRef.current.api) {
            // AG-Grid Community 버전은 CSV 내보내기를 기본 지원합니다.
            gridRef.current.api.exportDataAsCsv({ fileName: `납부현황_${new Date().toISOString().split('T')[0]}.csv` });
        }
    };

    const handleCellClicked = (event) => {
        const copyAllowedFields = ['CARID_NO', 'CAR_NO'];

        // 클릭한 셀의 컬럼 필드명이 배열에 포함되어 있고 값이 존재할 때
        if (copyAllowedFields.includes(event.colDef.field) && event.value) {
            navigator.clipboard.writeText(event.value)
                .then(() => {
                    // 알림창 대신 커스텀 토스트 메시지로 출력
                    setToastMessage(`"${event.value}" 복사되었습니다.`);
                    setTimeout(() => setToastMessage(''), 2500);
                })
                .catch(err => {
                    console.error('클립보드 복사 실패:', err);
                });
        }
    };

    const handleCloseClick = () => {
        navigate('/home');
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            switch (e.key) {
                case 'F2':
                    e.preventDefault();
                    handleSearchClick();
                    break;
                case 'F7':
                    e.preventDefault();
                    handleExportExcel();
                    break;
                case 'F8':
                    e.preventDefault();
                    handleResetClick();
                    break;
                case 'F9':
                    e.preventDefault();
                    handleCloseClick();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchFilters]);
	
	const [pinnedBottomRowData, setPinnedBottomRowData] = useState([
	    { NO: '합계', ACQ_AMT: 0, REGIS_AMT: 0, TOTAL_AMT: 0 } // 초기값
	]);
	
	const updateSummary = (params) => {
	    let totalAcq = 0;
	    let totalRegis = 0;
	    let totalAmt = 0;
	    let rowCount = 0;

	    // 필터링된 결과만 순회하며 합산
	    params.api.forEachNodeAfterFilter((node) => {
	        if (node.data) {
	            totalAcq += Number(node.data.ACQ_AMT || 0);
	            totalRegis += Number(node.data.REGIS_AMT || 0);
	            totalAmt += Number(node.data.TOTAL_AMT || 0);
	            rowCount++;
	        }
	    });

	    setPinnedBottomRowData([
	        {
	            NO: '합계',
	            WORK_CD: `${rowCount}건`, // 마이플랫폼의 CaseCount 유사 구현
	            ACQ_AMT: totalAcq,
	            REGIS_AMT: totalRegis,
	            TOTAL_AMT: totalAmt,
	        }
	    ]);
	};

    return (
        <div className="status-container">
            {/* 토스트 메시지 영역 */}
            {toastMessage && (
                <div className="toast-notification">
                    {toastMessage}
                </div>
            )}

            {/* 상단 툴바 부분(버튼) */}
            <div className="status-toolbar">
                <div className="toolbar-left">
                    <span className="title-count">{totalCount}</span> 건
                </div>
                <div className="toolbar-right">
                    <button className="btn-status" onClick={handleSearchClick}>조회[F2]</button>
                    <button className="btn-status" onClick={handleExportExcel}>엑셀[F7]</button>
                    <button className="btn-status" onClick={handleResetClick}>초기화[F8]</button>
                    <button className="btn-status" onClick={handleCloseClick}>닫기[F9]</button>
                </div>
            </div>

            {/* 검색 조건 부분 */}
            <ErpSection isHeader={true}>
                <div className="erp-row">
                    <ErpField label="신청구분" span={5}>
						<select className="erp-input" value={searchFilters.workCD} onChange={handleWorkCdChange}>
                            <option value="">전체</option>
                            {codeListMap['WORK_CD'] && codeListMap['WORK_CD'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                        <select className="erp-input" value={searchFilters.companyID} onChange={e => setSearchFilters({ ...searchFilters, companyID: e.target.value })}>
							{/* 리스트가 2개 이상일 때만 '전체' 문구를 보여줌 */}
						    {companyList.length !== 1 && <option value="">전체 (회사)</option>}
						    {companyList.map(comp => (
						        <option key={comp.COMPANY_ID} value={comp.COMPANY_ID}>{comp.COMPANY_NM}</option>
						    ))}
                        </select>
                        <select style={{ visibility: bGovtVisible ? 'visible' : 'hidden' }} className="erp-input" value={searchFilters.govtId} onChange={e => setSearchFilters({ ...searchFilters, govtId: e.target.value })}>
							{/* 관청 리스트가 2개 이상일 때만 '전체' 문구를 보여줌 */}
						    {codeListMap['GOVT']?.length !== 1 && <option value="">전체 (관청)</option>}
						    {codeListMap['GOVT']?.map(code => (
						        <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
						    ))}						
                        </select>						
                    </ErpField>
                    <ErpField label="신청자명" span={3}>
                        <input type="text" className="erp-input" value={searchFilters.userNM} onChange={e => setSearchFilters({ ...searchFilters, userNM: e.target.value })} />
                    </ErpField>
                    <ErpField label="차량/차대번호" span={3} fontSize="11px">
                        <input type="text" className="erp-input" value={searchFilters.carNo} onChange={e => setSearchFilters({ ...searchFilters, carNo: e.target.value })} />
                    </ErpField>
                </div>
                <div className="erp-row">					
					<select className="erp-input" value={searchFilters.baseGubun} onChange={e => setSearchFilters({ ...searchFilters, baseGubun: e.target.value })}>
				        {codeListMap['BASE_GUBUN'] && codeListMap['BASE_GUBUN'].map(code => (
				        	<option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
				        ))}
				    </select>
                    <input type="date" className="erp-input" value={searchFilters.startDate} onChange={e => setSearchFilters({ ...searchFilters, startDate: e.target.value })} />
                    <span>~</span>
                    <input type="date" className="erp-input" value={searchFilters.endDate} onChange={e => setSearchFilters({ ...searchFilters, endDate: e.target.value })} />                    
                    <ErpField label="신청상태" span={4}>
                        <select className="erp-input" value={searchFilters.processStatus} onChange={e => setSearchFilters({ ...searchFilters, processStatus: e.target.value })}>
                            <option value="">전체</option>
                            {codeListMap['PR_ST'] && codeListMap['PR_ST'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                    <ErpField label="납부상태" span={3}>
                        <select className="erp-input" value={searchFilters.PAY_ST} onChange={e => setSearchFilters({ ...searchFilters, PAY_ST: e.target.value })}>
							<option value="">전체</option>
							{codeListMap['PAYST'] && codeListMap['PAYST'].map(code => (
						    	<option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
						    ))}
						</select>                    
                        <select className="erp-input" value={searchFilters.PAY_TP} onChange={e => setSearchFilters({ ...searchFilters, PAY_TP: e.target.value })}>
							<option value="">전체</option>
							{codeListMap['PAYTP'] && codeListMap['PAYTP'].map(code => (
								<option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
							))}
                        </select>
                    </ErpField>
                </div>
            </ErpSection>

            {/* 데이터 그리드 영역 */}
            <div className="grid-container ag-theme-alpine" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, width: '100%' }}>
                    {/* 💡 AG-Grid 컴포넌트: 기본 높이 및 속성들은 'NewcarList.css' 파일의 .ag-theme-alpine 에서 변경하실 수 있습니다. */}
                    <AgGridReact
                        ref={gridRef}
                        rowData={rowData}
                        columnDefs={columnDefs}
                        // 기본적으로 모든 컬럼에 적용될 공통 속성: 정렬 가능, 열 너비 조절 가능
                        defaultColDef={{ sortable: true, resizable: true }}
                        rowSelection="multiple"
                        onRowDoubleClicked={handleRowDoubleClicked}
                        onCellClicked={handleCellClicked}
						pinnedBottomRowData={pinnedBottomRowData} // 하단 고정 행 연결
					    onGridReady={(params) => updateSummary(params)}
					    onFilterChanged={(params) => updateSummary(params)}
					    onRowDataUpdated={(params) => updateSummary(params)}
						// 합계 행 스타일 지정 (선택)
					    getRowStyle={params => {
					        if (params.node.rowPinned === 'bottom') {
					            return { fontWeight: 'bold', backgroundColor: '#f8f9fa' };
					        }
					    }}
                    />
                </div>
            </div>
        </div>
    );
};

export default PayInfo;
