import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
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

const PayInfo = () => {
    const navigate = useNavigate();
    const gridRef = useRef(null);
    const { user } = useAuth(); // 로그인 사용자 정보 가져오기

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
        processStatus: '',
        PAY_ST: '',
		PAY_TP: ''
    });

    const fetchPaymentList = async () => {
        try {
            const cleanParam = (val) => (val === '전체' || val === '전체 (회사)' || val === '전체 (관청)') ? '' : val;
			
            const params = {
                WORK_CD: searchFilters.workCD,
				COMPANY_ID: cleanParam(searchFilters.companyID),
				GOVT_ID: cleanParam(searchFilters.govtId),
				USER_NM: searchFilters.userNM,
				CAR_NO: searchFilters.carNo,
				BASE_GUBUN: searchFilters.baseGubun, 				
				START_DT: searchFilters.startDate.replace(/-/g, ''),
				END_DT: searchFilters.endDate.replace(/-/g, ''),
				PROC_ST: cleanParam(searchFilters.processStatus),
				PAY_ST: searchFilters.PAY_ST,
				PAY_TP: searchFilters.PAY_TP
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

    const fetchCodes = async () => {
        try {
            const groupIds = ['SGB', 'BANK', 'PAYST', 'PR_ST', 'PAYME', 'DSIGB', 'GOVT', 'PAYTP', 'LOCAL', 'TRNGB', 'TASK'];
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
            setCodeMap(newCodeMap);
            setCodeListMap(newCodeListMap);
            console.log(newCodeListMap);
        } catch (error) {
            console.error('공통 코드 조회 실패:', error);
        }
    };

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
	
    const formatCode = (groupId, value) => {
        return codeMap[groupId] && codeMap[groupId][value] ? codeMap[groupId][value] : value;
    };

    useEffect(() => {
        fetchCodes();
        //fetchPaymentList();
    }, []);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                // 사용자의 요청에 따라 관청(govtId) 조건 없이 WORK_CD='010'에 해당하는 
                // 전체 회사 목록을 한 번만 불러와서 리스트에 넣어줍니다.
                const response = await axios.get('/api/companies', {
                    params: {
                        workCd: '010' // 업무구분 신규등록 고정
                    }
                });
                if (response.data.success) {
                    setCompanyList(response.data.list);
                }
            } catch (error) {
                console.error('회사 목록 갱신 실패:', error);
            }
        };
        fetchCompanies();
    }, []); // 의존성 배열을 비워 컴포넌트 마운트 시 최초 1회만 불러옵니다.

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

    // user ID에 따라 컬럼 속성 분기
    const columnDefs = React.useMemo(() => {
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
        setSearchFilters({
            workCD: '',
            companyID: '',
            govtId: '',
            userNM: '',
            clientName: '',
            carNo: '',
			baseGubun: '',
            startDate: getFormattedDateOffset(0),
            endDate: getFormattedDateOffset(0),
            PAYST: '전체',
            processStatus: '전체'
        });
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
				<div className="toolbar-center">
					<button className="btn-status">납부영수증</button>
				    <button className="btn-status" style={{ marginLeft: '10px' }}>통합영수증</button>
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
						<select className="erp-input" value={searchFilters.workCD} onChange={e => setSearchFilters({ ...searchFilters, workCD: e.target.value })}>
                            <option value="">전체</option>
                            {codeListMap['WORK_CD'] && codeListMap['WORK_CD'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                        <select className="erp-input" value={searchFilters.companyID} onChange={e => setSearchFilters({ ...searchFilters, companyID: e.target.value })}>
                            <option value="">전체 (회사)</option>
                            {companyList.map(comp => (
                                <option key={comp.COMPANY_ID} value={comp.COMPANY_ID}>{comp.COMPANY_NM}</option>
                            ))}
                        </select>
                        <select className="erp-input" value={searchFilters.govtId} onChange={e => setSearchFilters({ ...searchFilters, govtId: e.target.value })}>
                            <option value="">전체 (관청)</option>
                            {codeListMap['GOVT'] && codeListMap['GOVT'].map(code => (
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
                            <option value="전체">전체</option>
                            {codeListMap['PR_ST'] && codeListMap['PR_ST'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                    <ErpField label="납부상태" span={3}>
                        <select className="erp-input" value={searchFilters.PAYST} onChange={e => setSearchFilters({ ...searchFilters, PAYST: e.target.value })}>
							<option value="전체">전체</option>
							{codeListMap['PAYST'] && codeListMap['PAYST'].map(code => (
						    	<option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
						    ))}
						</select>                    
                        <select className="erp-input" value={searchFilters.PAYTP} onChange={e => setSearchFilters({ ...searchFilters, PAYTP: e.target.value })}>
							<option value="전체">전체</option>
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
