import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTabs } from '../../context/TabContext'; // 전역 탭 
import axios from 'axios';
import './NewcarList.css';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useAuth } from '../../context/AuthContext';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import CommonMultiSelect from '../common/CommonMultiSelect';

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

const timeOptions = [
	{ label: '8시', value: '08' },
    { label: '9시', value: '09' },
    { label: '10시', value: '10' },
    { label: '11시', value: '11' },
    { label: '12시', value: '12' },
    { label: '13시', value: '13' },
    { label: '14시', value: '14' },
    { label: '15시', value: '15' },
    { label: '16시', value: '16' },
    { label: '17시', value: '17' },
];

const NewcarList = () => {
    const navigate = useNavigate();
	const { tabs, activeTabId, removeTab } = useTabs(); // 탭 관리
    const gridRef = useRef(null);
	const waitGridRef = useRef(null);
	const fileInputRef = useRef(null);
    const { user } = useAuth(); // 로그인 사용자 정보 가져오기
    const [codeMap, setCodeMap] = useState({});
    const [codeListMap, setCodeListMap] = useState({});
    const [companyList, setCompanyList] = useState([]);
    const [toastMessage, setToastMessage] = useState('');
    const [rowData, setRowData] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
	const [waitRowData, setWaitRowData] = useState([]);
	const [showWaitPopup, setShowWaitPopup] = useState(false);
    const [searchFilters, setSearchFilters] = useState({
        workCode: '010',
        companyID: '',
        govtId: '',
        userNM: '',
        customerNM: '',
        carNo: '',
        startDate: getFormattedDateOffset(-14),
        endDate: getFormattedDateOffset(0),
        nullOpt: '',
        processStatus: '전체',
        deliveryType: '',
        deliveryStatus: '전체',
		selectedTimes: [],
		selectedDeliveryGb: []
    });
	
	const dlvOptions =
	  (codeListMap['DLVGB'] || []).map(code => ({
	    label: code.CODE_NM,
	    value: code.CODE_ID,
    }));

    const fetchNewCarList = async () => {
        try {
            const cleanParam = (val) => (val === '전체' || val === '전체 (회사)' || val === '전체 (관청)') ? '' : val;

            const params = {
                WORK_CD: searchFilters.workCode,
                COMPANY_ID: cleanParam(searchFilters.companyID),
                GOVT_ID: cleanParam(searchFilters.govtId),
                USER_NM: searchFilters.userNM,
                CUSTOMER_NM: searchFilters.customerNM,
                CAR_NO: searchFilters.carNo,
                START_DT: searchFilters.startDate.replace(/-/g, ''),
                END_DT: searchFilters.endDate.replace(/-/g, ''),
                NULL_OPT: searchFilters.nullOpt,
                PROC_ST: cleanParam(searchFilters.processStatus),
                NUM_PROC_ST: cleanParam(searchFilters.deliveryStatus),
				TIME_DVSN: searchFilters.selectedTimes.join(','),
				DELIVERY_GB: searchFilters.selectedDeliveryGb.join(',')
            };

            const response = await axios.post('/api/newcar/list', params);
            if (response.data.success) {
                setRowData(response.data.list);
                setTotalCount(response.data.list.length);
            }
        } catch (error) {
            console.error('신규신청현황 조회 실패:', error);
            setToastMessage('데이터 조회에 실패했습니다.');
            setTimeout(() => setToastMessage(''), 2500);
        }
    };
	
	const fetchWaitList = async () => {

	    try {
			const cleanParam = (val) => (val === '전체' || val === '전체 (회사)' || val === '전체 (관청)') ? '' : val;

	        const response = await axios.post(
	            '/api/newcar/list',
	            {
	                WORK_CD: '010',
					COMPANY_ID: cleanParam(searchFilters.companyID),
					START_DT: searchFilters.startDate.replace(/-/g, ''),
	                END_DT: searchFilters.endDate.replace(/-/g, ''),
					PROC_ST: 'WAIT'
	            }
	        );

	        if (response.data.success) {
	            setWaitRowData(response.data.list);
	        }

	    } catch (error) {
	        console.error(error);
	    }
	};

    const fetchCodes = async () => {
        try {
            const groupIds = ['SGB', 'PR_ST', 'PAYST', 'FUEL', 'IMPST', 'DELIV', 'CARKD', 'GOVT', 'NUMST', 'DLVGB'];
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

    const formatCode = (groupId, value) => {
        return codeMap[groupId] && codeMap[groupId][value] ? codeMap[groupId][value] : value;
    };

    useEffect(() => {
        fetchCodes();
        fetchNewCarList();
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

    // 기본 사용자 항목 (24개)
    const defaultColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40 },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 40, textAlign: 'center' },
        { headerName: '접수번호', field: 'SERVICE_ID', width: 145 },
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
        { headerName: '차량번호', field: 'CAR_NO', width: 110 },
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
        { headerName: '취득가액', field: 'BUY_AMT', width: 100 },
        { headerName: '소유자명', field: 'OWNER_NM', width: 90 },
        { headerName: '회사명', field: 'COMPANY_NM', width: 120 },
        { headerName: '신청인', field: 'MEMBER_NM', width: 90 },
        { headerName: '관청', field: 'GOVT_ID', width: 90, valueFormatter: params => formatCode('GOVT', params.value) },
    ];

	// 신규등록대기
    const waitColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40 },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 40, textAlign: 'center' },
        { headerName: '신청상태', field: 'PROC_ST', width: 90, valueFormatter: params => formatCode('PR_ST', params.value) },
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
        { headerName: '고객명', field: 'CUSTOMER_NM', width: 90 },
        { headerName: '차량명', field: 'CAR_NM', width: 150, flex: 1 },
        { headerName: '차량번호', field: 'CAR_NO', width: 110 },
        { headerName: '임판여부', field: 'IMSINUM_YN', width: 90, valueFormatter: params => formatCode('IMPST', params.value) },
        { headerName: '요청일자', field: 'REQUEST_DT', width: 120 },
    ];

    // number03 사용자 전용 항목 (21개)
    const number03ColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40, pinned: 'left' },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 40 }, // 순번 (내장 rowIndex 사용)
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
        { headerName: '차량번호', field: 'CAR_NO', width: 110 },
        { headerName: '배송구분', field: 'DELIVERY_GB', width: 90, valueFormatter: params => formatCode('DLVGB', params.value) },
        { headerName: '신청상태', field: 'PROC_ST', width: 90, valueFormatter: params => formatCode('PR_ST', params.value) }, // PROC_ST 가 신청/진행상태
        { headerName: '배송지', field: 'DELIVERY_ADDR', width: 250 },
        { headerName: '차량명', field: 'CAR_NM', width: 150 },
        { headerName: '사용연료', field: 'FUEL_CD', width: 90, valueFormatter: params => formatCode('FUEL', params.value) },
        { headerName: '신청일자', field: 'REQUEST_DT', width: 120 },
        { headerName: '고객명', field: 'CUSTOMER_NM', width: 90 },
        { headerName: '업무구분', field: 'WORK_CD', width: 90, valueFormatter: params => formatCode('SGB', params.value) },
        { headerName: '임판여부', field: 'IMSINUM_YN', width: 90, valueFormatter: params => formatCode('IMPST', params.value) },
        { headerName: '접수번호', field: 'SERVICE_ID', width: 110 }, // 기존 접수번호는 백엔드 쿼리에 없으므로 SERVICE_ID로 사용
        { headerName: '전자납부번호', field: 'TAX_VBANK_NO', width: 120 },
        { headerName: '심사일자', field: 'JUDGE_DT', width: 100 },
        { headerName: '납부상태', field: 'PAY_ST', width: 90, valueFormatter: params => formatCode('PAYST', params.value) },
        { headerName: '배송상태', field: 'NUM_PROC_ST', width: 120, valueFormatter: params => formatCode('NUMST', params.value) }, // 쿼리 기준 배송상태 대신 활용할 필드 (NUM_PROC_ST 혹은 DELIVERY_GB 의존)
        { headerName: '차종', field: 'CAR_KD', width: 90, valueFormatter: params => formatCode('CARKD', params.value) },
        { headerName: '회사명', field: 'COMPANY_NM', width: 120 },
        { headerName: '신청인', field: 'MEMBER_NM', width: 90 },
    ];

    // user ID에 따라 컬럼 속성 분기
    const columnDefs = React.useMemo(() => {
        if (user && user.userId === 'number03') {
            return number03ColumnDefs;
        }
        // 기본적으로 defaultColumnDefs 반환
        return defaultColumnDefs;
    }, [user, codeMap]);

    const handleRowDoubleClicked = (event) => {
        if (event.data && event.data.SERVICE_ID) {
            navigate('/newcar/newcar-request', { state: { receiptNo: event.data.SERVICE_ID } });
        }
    };

    const handleWaitClick = async () => {
		await fetchWaitList();

	    setShowWaitPopup(true);
    };

    const handleRegistClick = () => {
		navigate('/newcar/newcar-request');
    };

    const handleSearchClick = () => {
        fetchNewCarList();
    };
	
	const handleWaitRequestClick = async () => {
		if (!waitGridRef.current) return;

	    const selectedRows =
	        waitGridRef.current.api.getSelectedRows();

	    if (selectedRows.length === 0) {
	        setToastMessage('선택된 항목이 없습니다.');
	        setTimeout(() => setToastMessage(''), 2500);
	        return;
	    }

		// SAV 아닌 항목 존재 여부 확인
	    const hasInvalidRow = selectedRows.some(
	        row => row.PROC_ST !== 'SAV'
	    );

		if (hasInvalidRow) {
	        setToastMessage('저장상태만 신청 가능합니다.');
	        setTimeout(() => setToastMessage(''), 2500);
	        return;
	    }
		
		// 저장상태 -> 신청대기 상태 변경
		try {

		     // SERVICE_ID 목록 추출
		     const serviceIds = selectedRows.map(
		         row => row.SERVICE_ID
		     );
			 
			 const params = {
				 SERVICE_IDS: serviceIds,
	             PROC_ST: 'W_REQ'
             };
			 
		     const response = await axios.post('/api/newcar/change-proc-st', params);

		     if (response.data.success) {
		         setToastMessage('신청 처리되었습니다.');

		         // 팝업 재조회
		         await fetchWaitList();

		         // 메인도 재조회
		         await fetchNewCarList();
		     } else {
		         setToastMessage(
		             response.data.message || '처리 실패'
		         );
		     }
		 } catch (error) {
		     console.error(error);
		     setToastMessage('신청 처리 중 오류 발생');
		 }

		 setTimeout(() => setToastMessage(''), 2500);
    };
	
	const handleExcelClick = () => {
	    fileInputRef.current.click();
	};
	
	const handleExcelUpload = async (e) => {
	    const file = e.target.files[0];

	    if (!file) return;

	    const formData = new FormData();
	    formData.append('file', file);

	    try {

	        const res = await axios.post(
	            '/api/newcar/excel-upload',
	            formData,
	            {
	                headers: {
	                    'Content-Type': 'multipart/form-data'
	                }
	            }
	        );

	        if (res.data.success) {

	            setToastMessage(
	                `업로드 완료 (${res.data.insertCount})건`
	            );

	            fetchNewCarList();

	        } else {
	            setToastMessage('업로드 실패');
	        }

	    } catch (err) {

	        console.error(err);

	        setToastMessage('업로드 중 오류 발생');
	    }

	    setTimeout(() => setToastMessage(''), 2500);

	    // 같은 파일 재업로드 가능하게 초기화
	    e.target.value = '';
	};

    const handleResetClick = () => {
        setSearchFilters({
            workCode: '010',
            companyID: '',
            govtId: '',
            userNM: '',
            customerNM: '',
            carNo: '',
            startDate: getFormattedDateOffset(-14),
            endDate: getFormattedDateOffset(0),
            nullOpt: '',
            processStatus: '전체',
            deliveryType: '',
            deliveryStatus: '전체',
			selectedTimes: [],
			selectedDeliveryGb: []
        });
    };

    const handleExportExcel = () => {
        if (gridRef.current && gridRef.current.api) {
            // AG-Grid Community 버전은 CSV 내보내기를 기본 지원합니다.
            gridRef.current.api.exportDataAsCsv({ fileName: `신규신청현황_${new Date().toISOString().split('T')[0]}.csv` });
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
		if (!activeTabId) return;
	    removeTab(activeTabId);
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
				case 'F10':
                    e.preventDefault();
                    handleRegistClick();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchFilters]);

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
                    <button className="btn-status" onClick={handleRegistClick}>등록[F10]</button>
                    <span className="title-count">{totalCount}</span> 건
					<button className="btn-status blue" onClick={handleWaitClick} style={{ marginLeft: '10px' }}>신규등록 대기</button>
					<button className="btn-status red" onClick={handleExcelClick} style={{ marginLeft: '10px' }}>Excel 업로드</button>
					<input
					    type="file"
					    ref={fileInputRef}
					    style={{ display: 'none' }}
					    accept=".xlsx,.xls"
					    onChange={handleExcelUpload}
					/>
					{/*
                    <button className="btn-status blue" style={{ marginLeft: '10px' }}>배송구분 변경</button>
					*/}
                </div>
                <div className="toolbar-right">
                    {/*<button className="btn-status">통합영수증</button>
                    <button className="btn-status red">세금계산서</button>
                    <button className="btn-status grey">입금처리</button>*/}
                    <button className="btn-status" onClick={handleSearchClick}>조회[F2]</button>
                    <button className="btn-status" >엑셀[F7]</button>
                    <button className="btn-status" onClick={handleResetClick}>초기화[F8]</button>
                    <button className="btn-status" onClick={handleCloseClick}>닫기[F9]</button>
                </div>
            </div>

            {/* 검색 조건 부분 */}
            <ErpSection isHeader={true}>
                <div className="erp-row">
                    <ErpField label="신청구분" span={5}>
                        {/* 업무구분은 '010' (신규등록)으로 고정 */}
                        <select className="erp-input" value={searchFilters.workCode} disabled>
                            <option value="010">신규등록</option>
                        </select>
                        <select className="erp-input" value={searchFilters.companyID} onChange={e => setSearchFilters({ ...searchFilters, companyID: e.target.value })} disabled={user.company_ID !== 'dacos'}>
                            <option value="">전체</option>
                            {companyList.map(comp => (
                                <option key={comp.COMPANY_ID} value={comp.COMPANY_ID}>{comp.COMPANY_NM}</option>
                            ))}
                        </select>
                        <select className="erp-input" value={searchFilters.govtId} onChange={e => setSearchFilters({ ...searchFilters, govtId: e.target.value })}>
                            <option value="">전체</option>
                            {codeListMap['GOVT'] && codeListMap['GOVT'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                    <ErpField label="신청자명" span={2}>
                        <input type="text" className="erp-input" value={searchFilters.userNM} onChange={e => setSearchFilters({ ...searchFilters, userNM: e.target.value })} />
                    </ErpField>
                    <ErpField label="고객명" span={2}>
                        <input type="text" className="erp-input" value={searchFilters.customerNM} onChange={e => setSearchFilters({ ...searchFilters, customerNM: e.target.value })} />
                    </ErpField>
                    <ErpField label="차량/차대번호" span={3} fontSize="11px">
                        <input type="text" className="erp-input" value={searchFilters.carNo} onChange={e => setSearchFilters({ ...searchFilters, carNo: e.target.value })} />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="신청일자" span={5}>
                        <input type="date" className="erp-input" value={searchFilters.startDate} onChange={e => setSearchFilters({ ...searchFilters, startDate: e.target.value })} style={{ width: '40%', display: 'flex'}}/>
                        <span>~</span>
                        <input type="date" className="erp-input" value={searchFilters.endDate} onChange={e => setSearchFilters({ ...searchFilters, endDate: e.target.value })}  style={{ width: '40%', display: 'flex'}}/>
						<CommonMultiSelect
						    options={timeOptions}
						    selectedValues={searchFilters.selectedTimes || []}
						    setSelectedValues={(newTimes) => {
						        // newTimes가 배열인지 확인하고 상태 업데이트
						        setSearchFilters(prev => ({
						            ...prev,
						            selectedTimes: typeof newTimes === 'function' ? newTimes(prev.selectedTimes) : newTimes
						        }));
						    }}
						/>
                    </ErpField>
                    <ErpField label="처리상태" span={2}>
                        <select className="erp-input" value={searchFilters.processStatus} onChange={e => setSearchFilters({ ...searchFilters, processStatus: e.target.value })}>
                            <option value="전체">전체</option>
                            {codeListMap['PR_ST'] && codeListMap['PR_ST'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                    <ErpField label="배송구분" span={2}>
						<CommonMultiSelect
						    options={dlvOptions}
						    selectedValues={searchFilters.selectedDeliveryGb || []}
						    setSelectedValues={(newDeliGbs) => {
						        // newTimes가 배열인지 확인하고 상태 업데이트
						        setSearchFilters(prev => ({
						            ...prev,
						            selectedDeliveryGb: typeof newDeliGbs === 'function' ? newDeliGbs(prev.selectedDeliveryGb) : newDeliGbs
						        }));
						    }}
						/>
                    </ErpField>
                    <ErpField label="배송상태" span={3}>
						<select className="erp-input" value={searchFilters.deliveryStatus} onChange={e => setSearchFilters({ ...searchFilters, deliveryStatus: e.target.value })}>
                            <option value="전체">전체</option>
                            {codeListMap['NUMST'] && codeListMap['NUMST'].map(code => (
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
                    />
                </div>
            </div>
			{showWaitPopup && (
			    <div className="wait-popup-overlay">

			        <div className="wait-popup">

			            {/* 헤더 */}
			            <div className="wait-popup-header">
							<div className="wait-popup-header-left">
							    <span>신규등록대기</span>
	
							    <button
							        className="btn-status blue"
							        style={{ marginLeft: '10px' }}
							        onClick={handleWaitRequestClick}
							    >
							        신청
							    </button>
							</div>
	
							<div className="wait-popup-header-right">
							    <button
							        className="btn-status"
							        onClick={() => setShowWaitPopup(false)}
							    >
							        닫기
							    </button>
							</div>
			            </div>

			            {/* GRID */}
			            <div
							className="ag-theme-alpine"
						    style={{
						        flex: 1,
						        width: '100%',
						    }}
			            >

			                <AgGridReact
								ref={waitGridRef}
			                    rowData={waitRowData}
			                    columnDefs={waitColumnDefs}
			                    defaultColDef={{
			                        sortable: true,
			                        resizable: true,
			                    }}
			                    rowSelection="multiple"
			                    onRowDoubleClicked={
			                        handleRowDoubleClicked
			                    }
			                />

			            </div>

			        </div>

			    </div>
			)}
        </div>
    );
};

export default NewcarList;
