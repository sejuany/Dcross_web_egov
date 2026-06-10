import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabs, useTabPageState } from '../../context/TabContext'; // 전역 탭
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

const getInitialSearchFilters = (user) => ({
    workCode: '010',
    companyID: user.company_ID === 'dacos' ? '' : user.company_ID,
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

const NewcarList = () => {
    const location = useLocation();
	const { activeTabId, addTab, removeTab } = useTabs(); // 탭 관리
    const gridRef = useRef(null);
	const fileInputRef = useRef(null);
    const { user } = useAuth(); // 로그인 사용자 정보 가져오기
    const [codeMap, setCodeMap] = useState({});
    const [codeListMap, setCodeListMap] = useState({});
    const [companyList, setCompanyList] = useState([]);
    const [toastMessage, setToastMessage] = useState('');
    const [rowData, setRowData] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
	const [showReqModal, setShowReqModal] = useState(false);
	const [selectedRows, setSelectedRows] = useState([]);
    const [searchFilters, setSearchFilters] = useTabPageState('searchFilters', () => getInitialSearchFilters(user));

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
			if (error.response?.status === 401 || error.response?.status === 403) {
	            setToastMessage('세션이 만료되었습니다. 다시 로그인해주세요.');
				setTimeout(() => {window.location.href = '/login';}, 2000); // 2초 후 이동
				return;
	        }
	        setToastMessage('데이터 조회에 실패했습니다.');
            setTimeout(() => setToastMessage(''), 2500);
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

    // SA 사용자 전용 항목 (21개)
	const saColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 20 },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 40, textAlign: 'center' },
        { headerName: '처리상태', field: 'PROC_ST', width: 90, valueFormatter: params => formatCode('PR_ST', params.value) },
        { headerName: '등록 예정일자', field: 'REGIST_DATE', width: 120 },
        { headerName: '주문번호', field: 'LINK_ID', width: 145 },
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
        { headerName: '차량번호', field: 'CAR_NO', width: 110 },
        { headerName: '소유자명', field: 'OWNER_NM', width: 90 },
        { headerName: '공급가액', field: 'BUY_AMT', width: 100 },
        { headerName: '납부상태', field: 'PAY_ST', width: 90, valueFormatter: params => formatCode('PAYST', params.value) },
        { headerName: '입력일자', field: 'REQUEST_DT', width: 120 },
        { headerName: '차량비용 납부일자', field: 'BPAY_DT', width: 120 },
        { headerName: '등록비용 납부일자', field: 'PAY_DT', width: 120 },
        { headerName: '등록일자', field: 'JUDGE_DT', width: 100 },
		{ headerName: '공급가액', field: 'BUY_AMT', width: 100 },
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
		{ headerName: '주문번호', field: 'LINK_ID', width: 145 },
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
		{ headerName: '고객명', field: 'OWNER_NM', width: 120 },
        { headerName: '입력일자', field: 'REQUEST_DT', width: 120 },
		{ headerName: '등록 예정일자', field: 'REGIST_DATE', width: 120 },
		{ headerName: '공급가액', field: 'BUY_AMT', width: 100 },
		{ headerName: 'Space',  field: 'DELIVERY_GB', width: 150, valueFormatter: params => {
		    const value = params.value;
	        if (value === 'null' || value == null) {
	            return '';
	        }
	        return formatCode('DLVGB', value);
	    }},
        { headerName: '접수번호', field: 'SERVICE_ID', flex: 1 },
    ];

    // user ID에 따라 컬럼 속성 분기
    const columnDefs = React.useMemo(() => {
        if (user.member_GB === 'SA') {
            return saColumnDefs;
        } else if (user.member_GB === 'SU') {
            return suColumnDefs;
		}
        // 기본적으로 defaultColumnDefs 반환
        return defaultColumnDefs;
    }, [user, codeMap]);

    const handleRowDoubleClicked = (event) => {
        if (event.data && event.data.SERVICE_ID) {
            addTab('newcar-request', '신규등록', '/newcar/newcar-request', {
                state: {
                    receiptNo: event.data.SERVICE_ID,
                    detailOpenKey: Date.now()
                }
            });
        }
    };

    const handleRegistClick = () => {
		addTab('newcar-request', '신규등록', '/newcar/newcar-request');
    };

    const handleSearchClick = () => {
		fetchNewCarList();

	    gridRef.current?.api?.deselectAll();
	    setSelectedRows([]);
    };

	const handleExcelClick = () => {
	    fileInputRef.current.click();
	};

	const handleReqClick = () => {
	    const rows = gridRef.current?.api?.getSelectedRows() || [];
	    if (rows.length === 0) {
			setToastMessage('선택된 건이 없습니다.');
		    setTimeout(() => setToastMessage(''), 2500);
		    return;
	    }

	    const invalidRows = rows.filter(row => row.PROC_ST !== 'W_REQ');

	    if (invalidRows.length > 0) {
			setToastMessage('처리상태가 신청대기인 건만 신청 가능합니다.');
		    setTimeout(() => setToastMessage(''), 2500);
		    gridRef.current?.api?.deselectAll();
		    setSelectedRows([]);
	        return;
	    }

	    setSelectedRows(rows);
	    setShowReqModal(true);
	};

	const handleReqConfirm = async () => {
	    try {
			const payload = selectedRows.map(row => ({SERVICE_ID: row.SERVICE_ID}));
			const res = await axios.post('/api/newcar/request-process', payload);

	        // 성공
	        if (res.data.success) {
				setToastMessage('신청이 완료되었습니다.');
				// 선택 상태 초기화
	            setSelectedRows([]);
	            gridRef.current?.api?.deselectAll();
	            await fetchNewCarList();
	        } else {
	            alert(res.data.message || '신청 실패');
	        }

	    } catch (err) {
	        setToastMessage('신청 중 오류가 발생했습니다.');
	    } finally {
	        setShowReqModal(false);
	    }
	};

	const handlePbEndClick = async () => {
		try {
	        const rows = gridRef.current?.api?.getSelectedRows() || [];

	        if (rows.length === 0) {
	            setToastMessage('선택된 건이 없습니다.');
	            setTimeout(() => setToastMessage(''), 2500);
	            return;
	        }

	        // 상태 검증
	        const invalidRows = rows.filter(
	            row => row.PROC_ST !== 'P_REQ' && row.PROC_ST !== 'PREND'
	        );

	        if (invalidRows.length > 0) {
	            setToastMessage('납부요청 또는 등록비용 납부 상태만 처리 가능합니다.');
	            setTimeout(() => setToastMessage(''), 2500);
	            return;
	        }

	        // 상태 변경
	        const payload = rows.map(row => {
	            let nextStatus = '';

	            if (row.PROC_ST === 'P_REQ') {
	                nextStatus = 'PBEND'; // 차량비용 납부
	            } else if (row.PROC_ST === 'PREND') {
	                nextStatus = 'P_END'; // 납부완료
	            }

	            return {
	                SERVICE_ID: row.SERVICE_ID,
	                PROC_ST: nextStatus
	            };
	        });

	        const res = await axios.post('/api/newcar/payment-process', payload);

	        if (res.data.success) {
	            setToastMessage('차량비용 납부 처리가 완료되었습니다.');
	            setTimeout(() => setToastMessage(''), 2500);

	            gridRef.current?.api?.deselectAll();
	            setSelectedRows([]);
	            await fetchNewCarList();
	        } else {
	            setToastMessage(res.data.message || '처리 실패!');
	            setTimeout(() => setToastMessage(''), 2500);
	        }

	    } catch (err) {
			if (err.response?.status === 401 || err.response?.status === 403) {
	            setToastMessage('세션이 만료되었습니다. 다시 로그인해주세요.');
				setTimeout(() => {window.location.href = '/login';}, 2000); // 2초 후 이동
				return;
	        }
	        setToastMessage('납부 처리 중 오류가 발생했습니다.');
	        setTimeout(() => setToastMessage(''), 2500);
	    }
	}

	const handleExcelUpload = async () => {
	    try {
	        const fileInput = fileInputRef.current;
	        const file = fileInput?.files?.[0];

	        if (!file) {
	            setToastMessage('파일이 없습니다.');
	            return;
	        }

	        const formData = new FormData();
	        formData.append('file', file);

	        const res = await axios.post('/api/newcar/excel-upload', formData);

			if (res.data?.data?.success) {
			    const insertCount = res.data.data?.insertCount ?? 0;
			    setToastMessage('업로드 완료 ' + insertCount + '건');
			    fetchNewCarList();
			} else {
				// 로그인 만료 처리
				if (res.data?.message === '로그인 정보 없음') {
					setToastMessage('세션이 만료되었습니다. 다시 로그인해주세요.');
					setTimeout(() => {window.location.href = '/login';}, 2000);
					return;
				}

				const msg =	res.data?.message || res.data?.data?.message || (res.data?.data?.errors?.length ? res.data.data.errors.map(e => `${e.row}행: ${e.errors.join(', ')}`).join('\n') : '');
				setToastMessage(msg || '등록 실패');
	        }
	    } catch (err) {
			if (err.response?.status === 401 || err.response?.status === 403) {
	            setToastMessage('세션이 만료되었습니다. 다시 로그인해주세요.');
				setTimeout(() => {window.location.href = '/login';}, 2000); // 2초 후 이동
				return;
	        }
	        setToastMessage('등록 중 오류 발생');
	    } finally {
           fileInputRef.current.value = '';
		   setTimeout(() => setToastMessage(''), 2500);
		}
	};

    const handleResetClick = () => {
        setSearchFilters(getInitialSearchFilters(user));
		gridRef.current?.api?.deselectAll();
    };

    const handleExportExcel = () => {
        if (gridRef.current && gridRef.current.api) {
            // AG-Grid Community 버전은 CSV 내보내기를 기본 지원합니다.
            gridRef.current.api.exportDataAsCsv({ fileName: `신규신청현황_${new Date().toISOString().split('T')[0]}.csv` });
        }
    };

    const handleCellClicked = (event) => {
        const copyAllowedFields = ['SERVICE_ID', 'CARID_NO', 'CAR_NO'];

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
            if (location.pathname !== '/newcar/newcar-list') return;

            switch (e.key) {
                case 'F2':
                    e.preventDefault();
                    handleSearchClick();
                    break;
                case 'F3':
                    e.preventDefault();
                    handleReqClick();
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
    }, [location.pathname, searchFilters]);

    return (
        <div className="status-container">
            {/* 토스트 메시지 영역 */}
            {toastMessage && (
                <div className="toast-notification">
					{toastMessage.split('\n').map((line, idx) => (
				        <React.Fragment key={idx}>
				            {line}
				            <br />
				        </React.Fragment>
				    ))}
                </div>
            )}

            {/* 상단 툴바 부분(버튼) */}
            <div className="status-toolbar">
                <div className="toolbar-left">
                    {/*<button className="btn-status" onClick={handleRegistClick}>등록[F10]</button>*/}
					{/* SA만 보이게 */}
					{user.member_GB === 'SA' && (
						<>
							<button className="btn-status blue" onClick={handleReqClick} style={{ marginLeft: '10px' }}>신청[F3]</button>
						</>
					)}
                    <span className="title-count">{totalCount}</span> 건
					{/* SA만 보이게 */}
					{user.member_GB === 'SA' && (
						<>
							<button className="btn-status red" onClick={handleExcelClick} style={{ marginLeft: '10px' }}>Excel 업로드</button>
							<input
							    type="file"
							    ref={fileInputRef}
							    style={{ display: 'none' }}
							    accept=".xlsx,.xls"
							    onChange={handleExcelUpload}
							/>
							<button className="btn-status yellow" onClick={handlePbEndClick} style={{ marginLeft: '10px' }}>차량비용 납부</button>
						</>
					)}
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
						        // newDeliGbs가 배열인지 확인하고 상태 업데이트
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
                    {/* AG-Grid 컴포넌트: 기본 높이 및 속성들은 NewcarList.css에서 변경할 수 있습니다. */}
                    <AgGridReact
                        ref={gridRef}
                        rowData={rowData}
                        columnDefs={columnDefs}
                        // 기본적으로 모든 컬럼에 적용될 공통 속성: 정렬 가능, 열 너비 조절 가능
                        defaultColDef={{ sortable: true, resizable: true }}
                        rowSelection="multiple"
                        onRowDoubleClicked={handleRowDoubleClicked}
                        onCellClicked={handleCellClicked}
						suppressRowClickSelection={false}
					    onRowDataUpdated={() => {
					        gridRef.current?.api?.deselectAll();
					    }}
                    />
                </div>
            </div>
			{showReqModal && (
			    <div className="modal-overlay">
			        <div className="modal-box">
			            <div className="modal-title">
			                신규등록 신청
			            </div>

			            <div className="modal-content">
			                {selectedRows.length} 건 차량을 신규등록 신청하시겠습니까?
			            </div>

			            <div className="modal-footer">
			                <button
			                    className="btn-status grey"
			                    onClick={() => setShowReqModal(false)}
			                >
			                    취소
			                </button>

			                <button
			                    className="btn-status blue"
			                    onClick={handleReqConfirm}
			                >
			                    신청
			                </button>
			            </div>
			        </div>
			    </div>
			)}
        </div>
    );
};

export default NewcarList;
