import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTabs, useTabPageState } from '../../context/TabContext'; // 전역 탭 
import axios from 'axios';
import './NumberPlateList.css';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
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
    workCode: '',
    companyID: user.company_ID === 'dacos' ? '' : user.company_ID,
    govtId: '',
    useYn: '전체',
    numGb: '전체',
    holeYn: '전체',
    sealYn: '전체',
    specialYn: '전체',
    carNo: '',
    endCarNo: '',
    assignCd: user.company_ID === 'dacos' ? '' : user.company_ID + '1',
    area: '전체',
    startDate: getFormattedDateOffset(0),
    endDate: getFormattedDateOffset(0),
    processStatus: '전체',
    deliveryType: '',
    deliveryStatus: '전체',
    dateCd: 'USE_DT',
    selectedTimes: []
});

const NumberPlateList = () => {
    const navigate = useNavigate();
    const location = useLocation();
	const { tabs, activeTabId, removeTab } = useTabs(); // 탭 관리
    const gridRef = useRef(null);
    const { user } = useAuth(); // 로그인 사용자 정보 가져오기
    const [codeMap, setCodeMap] = useState({});
    const [codeListMap, setCodeListMap] = useState({});
    const [companyList, setCompanyList] = useState([]);
    const [numplateAssignList, setNumplateAssignList] = useState([]);
    const [toastMessage, setToastMessage] = useState('');
    const [rowData, setRowData] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [dsSpecial, setDsSpecial] = useState([]);
    const [dsYn, setDsYn] = useState([]);
    const [searchFilters, setSearchFilters] = useTabPageState('searchFilters', () => getInitialSearchFilters(user));

    const fetchNumberPlateList = async () => {
        try {
            const cleanParam = (val) => (val === '전체' || val === '전체 (회사)' || val === '전체 (관청)') ? '' : val;

            const params = {
                WORK_CD: searchFilters.workCode,
                COMPANY_ID: cleanParam(searchFilters.companyID),
                GOVT_ID: cleanParam(searchFilters.govtId),
                USE_YN: cleanParam(searchFilters.useYn),
                NUM_KIND: cleanParam(searchFilters.numGb),
                HOLE_YN: cleanParam(searchFilters.holeYn),
                SEAL_YN: cleanParam(searchFilters.sealYn),
                SPECIAL_YN: cleanParam(searchFilters.specialYn),
                CAR_NO: searchFilters.carNo,
                END_CAR_NO: searchFilters.endCarNo,
                ASSIGN_CD: cleanParam(searchFilters.assignCd),
                DELIVERY_ADDR: cleanParam(searchFilters.area),
                START_DT: searchFilters.startDate.replace(/-/g, ''),
                END_DT: searchFilters.endDate.replace(/-/g, ''),
                PROC_ST: cleanParam(searchFilters.processStatus),
                DELIVERY_GB: searchFilters.deliveryType,
                DELIVERY_ST: cleanParam(searchFilters.deliveryStatus),
                DATE_CD: searchFilters.dateCd,
                TIME_DVSN: searchFilters.selectedTimes.join(',')
            };

            const response = await axios.post('/api/numplate/list', params);
            if (response.data.success) {
                setRowData(response.data.list);
                setTotalCount(response.data.list.length);
            }
        } catch (error) {
            console.error('번호판목록 조회 실패:', error);
            setToastMessage('데이터 조회에 실패했습니다.');
            setTimeout(() => setToastMessage(''), 2500);
        }
    };

    const fetchCodes = async () => {
        try {
            const groupIds = ['GOVT', 'NUMST', 'NUMGB', 'NPUSE', 'DLVGB', 'AREA', 'IMPST', 'RTIME', 'NHOLE', 'NSEAL', 'USEYN'];
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
        fetchNumberPlateList();
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

		const fetchAssignList = async () => {
            try {
                // 배송자 목록 조회
                const response = await axios.post('/api/company/assign/list', {
					params: {
		                COMPANY_ID: searchFilters.companyID,
		                BRANCH_ID: "",
		                AREA: ""
		            }
				});
                if (response.data.success) {
                    setNumplateAssignList(response.data.list);
                }
            } catch (error) {
                console.error('배송자 목록 갱신 실패:', error);
            }
        };
		
		// dsSpecial 데이터셋 세팅
	    const fetchDsSpecial = async () => {
	        try {
	            const specialData = [
	                { CODE_ID: 'Y', CODE_NM: '유보' },
	                { CODE_ID: 'N', CODE_NM: '미유보' }
	            ];
	            
	            // 상태 업데이트 (데이터셋에 값 채우기)
	            setDsSpecial(specialData);
	            
	        } catch (error) {
	            console.error('dsSpecial 데이터 세팅 실패:', error);
	        }
	    };

		// dsYn 데이터셋 세팅
	    const fetchDsYn = async () => {
	        try {
	            const YnData = [
	                { CODE_ID: 'Y', CODE_NM: '사용' },
	                { CODE_ID: 'N', CODE_NM: '미사용' },
	                { CODE_ID: 'D', CODE_NM: '삭제' },
	                { CODE_ID: 'P', CODE_NM: '표시중' },
	                { CODE_ID: 'S', CODE_NM: '신청' },
	                { CODE_ID: 'R', CODE_NM: '반려' }
	            ];
	            
	            // 상태 업데이트 (데이터셋에 값 채우기)
	            setDsYn(YnData);
	            
	        } catch (error) {
	            console.error('dsYn 데이터 세팅 실패:', error);
	        }
	    };
		
		
        fetchCompanies();
		fetchAssignList();
		fetchDsSpecial();
		fetchDsYn();
    }, []); // 의존성 배열을 비워 컴포넌트 마운트 시 최초 1회만 불러옵니다.

    // 기본 사용자 항목 (24개)
    const defaultColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40 },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 50, textAlign: 'center' },
        { headerName: '차량번호', field: 'CAR_NO', width: 90 },
        { headerName: '번호판 종류', field: 'NUM_KIND', width: 100, valueFormatter: params => formatCode('NUMGB', params.value) },
        { headerName: '처리상태', field: 'PROC_ST', width: 90, valueFormatter: params => formatCode('NUMST', params.value) },
		{ headerName: '사용여부', field: 'USE_YN', width: 90, valueFormatter: params => {
            if (!params.value) return '';
            // 리스트에서 현재 코드와 일치하는 항목 찾기
            const found = dsYn.find(item => item.CODE_ID === params.value);
            return found ? found.CODE_NM : params.value; // 찾으면 명칭, 없으면 코드 표시
        } },
        { headerName: '천공여부', field: 'HOLE_YN', width: 90, valueFormatter: params => formatCode('NHOLE', params.value) },
        { headerName: '봉인여부', field: 'SEAL_YN', width: 90, valueFormatter: params => formatCode('NSEAL', params.value) },
        { headerName: '일련번호', field: 'SERIAL_NO', width: 120 },
        { headerName: '사용날짜', field: 'USE_DT', width: 90 },
        { headerName: '제작날짜', field: 'MAKE_DT', width: 90 },
        { headerName: '입력날짜', field: 'INPUT_DT', width: 90 },
        { headerName: '배송구분', field: 'DELIVERY_GB', width: 90, valueFormatter: params => formatCode('DLVGB', params.value) },
        { headerName: '배송지', field: 'DELIVERY_ADDR', width: 250 },
        { headerName: '임판여부', field: 'IMSINUM_YN', width: 90, valueFormatter: params => formatCode('IMPST', params.value) },
        { headerName: '차대번호', field: 'CARID_NO', width: 120 },
        { headerName: '고객명', field: 'CUSTOMER_NM', width: 90 },
        { headerName: 'SMS', field: 'SMS_NO', width: 120 },
        { headerName: '배송자명', field: 'INSTALL_NM', width: 90 },
        { headerName: '배송자 연락처', field: 'INSTALL_TEL_NO', width: 120 },
        { headerName: '연결ID', field: 'SERVICE_ID', width: 120 },
        { headerName: '등록관청', field: 'GOVT_ID', width: 90, valueFormatter: params => formatCode('GOVT', params.value) },
        { headerName: '차명', field: 'CAR_NM', width: 120 },
        { headerName: '유보지정', field: 'SPECIAL_YN', width: 90, valueFormatter: params => {
            if (!params.value) return '';
            // 리스트에서 현재 코드와 일치하는 항목 찾기
            const found = dsSpecial.find(item => item.CODE_ID === params.value);
            return found ? found.CODE_NM : params.value; // 찾으면 명칭, 없으면 코드 표시
        } },
        { headerName: '배정', field: 'ASSIGN_CD', width: 90, valueFormatter: params => {
	        if (!params.value) return '';
	        // 리스트에서 현재 코드와 일치하는 항목 찾기
	        const found = numplateAssignList.find(item => item.CODE_ID === params.value);
	        return found ? found.BRANCH_NM : params.value; // 찾으면 명칭, 없으면 코드 표시
	    } }
    ];
	
	/*
    // number03 사용자 전용 항목 (21개)
    const number03ColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40, pinned: 'left' },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 40 }, // 순번 (내장 rowIndex 사용)
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
        { headerName: '차량번호', field: 'CAR_NO', width: 110 },
        { headerName: '배송구분', field: 'DELIVERY_GB', width: 90 },
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
        { headerName: '배송상태', field: 'NUM_PROC_ST', width: 120, valueFormatter: params => formatCode('DELIV', params.value) }, // 쿼리 기준 배송상태 대신 활용할 필드 (NUM_PROC_ST 혹은 DELIVERY_GB 의존)
        { headerName: '차종', field: 'CAR_KD', width: 90, valueFormatter: params => formatCode('CARKD', params.value) },
        { headerName: '회사명', field: 'COMPANY_NM', width: 120 },
        { headerName: '신청인', field: 'MEMBER_NM', width: 90 },
    ];
	*/
	
    // user ID에 따라 컬럼 속성 분기
    const columnDefs = React.useMemo(() => {
		/*
        if (user && user.userId === 'number03') {
            return number03ColumnDefs;
        }
		*/
        // 기본적으로 defaultColumnDefs 반환
        return defaultColumnDefs;
    }, [user, codeMap]);

    const handleRowDoubleClicked = (event) => {
        if (event.data && event.data.SERVICE_ID) {
            navigate('/newcar/newcar-request', { state: { receiptNo: event.data.SERVICE_ID } });
        }
    };

    const handleSearchClick = () => {
        fetchNumberPlateList();
    };

    const handleResetClick = () => {
        setSearchFilters(getInitialSearchFilters(user));
    };

    const handleExportExcel = () => {
        if (gridRef.current && gridRef.current.api) {
            // AG-Grid Community 버전은 CSV 내보내기를 기본 지원합니다.
            gridRef.current.api.exportDataAsCsv({ fileName: `번호판목록_${new Date().toISOString().split('T')[0]}.csv` });
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
            if (location.pathname !== '/numplate/number-plate-list') return;

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
    }, [location.pathname, searchFilters]);

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
                </div>
                <div className="toolbar-right">
                    <span className="title-count">{totalCount}</span> 건
                    <button className="btn-status" onClick={handleSearchClick}>조회[F2]</button>
                    <button className="btn-status" onClick={handleExportExcel}>엑셀[F7]</button>
                    <button className="btn-status" onClick={handleResetClick}>초기화[F8]</button>
                    <button className="btn-status" onClick={handleCloseClick}>닫기[F9]</button>
                </div>
            </div>

            {/* 검색 조건 부분 */}
            <ErpSection isHeader={true}>
                <div className="erp-row">
                    <ErpField label="신청구분" span={4}>
                        {/* 업무구분은 '010' (신규등록)으로 고정 */}
                        <select className="erp-input" value={searchFilters.workCode} disabled>
                            <option value="">번호판목록</option>
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
					<ErpField label="처리상태" span={2}>
                        <select className="erp-input" value={searchFilters.processStatus} onChange={e => setSearchFilters({ ...searchFilters, processStatus: e.target.value })}>
                            <option value="전체">전체</option>
                            {codeListMap['NUMST'] && codeListMap['NUMST'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                    <ErpField label="사용여부" span={2}>
						<select className="erp-input" value={searchFilters.useYn} onChange={e => setSearchFilters({ ...searchFilters, useYn: e.target.value })}>
	                        <option value="전체">전체</option>
	                        {codeListMap['NPUSE'] && codeListMap['NPUSE'].map(code => (
	                            <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
	                        ))}
	                    </select>   
                    </ErpField>
                    <ErpField label="번호판종류" span={4} fontSize="11px">
						<select className="erp-input" value={searchFilters.numGb} onChange={e => setSearchFilters({ ...searchFilters, numGb: e.target.value })}>
	                        <option value="전체">전체</option>
	                        {codeListMap['NUMGB'] && codeListMap['NUMGB'].map(code => (
	                            <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
	                        ))}
	                    </select>
						<select className="erp-input" value={searchFilters.holeYn} onChange={e => setSearchFilters({ ...searchFilters, holeYn: e.target.value })}>
	                        <option value="전체">전체</option>
	                        {codeListMap['NHOLE'] && codeListMap['NHOLE'].map(code => (
	                            <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
	                        ))}
	                    </select>
						<select className="erp-input" value={searchFilters.sealYn} onChange={e => setSearchFilters({ ...searchFilters, sealYn: e.target.value })}>
	                        <option value="전체">전체</option>
	                        {codeListMap['NSEAL'] && codeListMap['NSEAL'].map(code => (
	                            <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
	                        ))}
	                    </select>
						<select className="erp-input" value={searchFilters.specialYn} onChange={e => setSearchFilters({ ...searchFilters, specialYn: e.target.value })}>
	                        <option value="전체">전체</option>
							{dsSpecial?.map(code => (
						        <option key={code.CODE_ID} value={code.CODE_ID}>
						            {code.CODE_NM}
						        </option>
						    ))}
	                    </select>
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="차량번호" span={3}>
                        <input type="text" className="erp-input" value={searchFilters.carNo} onChange={e => setSearchFilters({ ...searchFilters, carNo: e.target.value })} />
                        <span>~</span>
                        <input type="text" className="erp-input" value={searchFilters.endCarNo} onChange={e => setSearchFilters({ ...searchFilters, endCarNo: e.target.value })} />
                    </ErpField>
					{/* 
                    <ErpField label="배송구분" span={2}>
                        <select className="erp-input" value={searchFilters.deliveryType} onChange={e => setSearchFilters({ ...searchFilters, deliveryType: e.target.value })}></select>
                    </ErpField>
					*/}
                    <ErpField label="배송지" span={9}>
						<select className="erp-input" value={searchFilters.area} onChange={e => setSearchFilters({ ...searchFilters, area: e.target.value })}>
	                        <option value="전체">전체</option>
	                        {codeListMap['AREA'] && codeListMap['AREA'].map(code => (
	                            <option key={code.CODE_ID} value={code.CODE_NM}>{code.CODE_NM}</option>
	                        ))}
	                    </select>
						<select className="erp-input" value={searchFilters.assignCd} onChange={e => setSearchFilters({ ...searchFilters, assignCd: e.target.value })} disabled={user.company_ID !== 'dacos'}>
                            <option value="">전체</option>
                            {numplateAssignList.map(comp => (
                                <option key={comp.CODE_ID} value={comp.CODE_ID}>{comp.BRANCH_NM}</option>
                            ))}
                        </select>
                        <select className="erp-input" value={searchFilters.dateCd} onChange={e => setSearchFilters({ ...searchFilters, dateCd: e.target.value })}>
                            <option value="INPUT_DT">입력날짜</option>
                            <option value="MAKE_DT">제작날짜</option>
                            <option value="USE_DT">사용날짜</option>
                        </select>
						<input type="date" className="erp-input" value={searchFilters.startDate} onChange={e => setSearchFilters({ ...searchFilters, startDate: e.target.value })} />
                        	<span>~</span>
                        <input type="date" className="erp-input" value={searchFilters.endDate} onChange={e => setSearchFilters({ ...searchFilters, endDate: e.target.value })} />
                        
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
        </div>
    );
};

export default NumberPlateList;
