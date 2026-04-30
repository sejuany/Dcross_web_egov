import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './NewcarList.css';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useAuth } from '../../context/AuthContext';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';

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

const NewcarList = () => {
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
        deliveryStatus: '전체'
    });

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
                DELIVERY_GB: searchFilters.deliveryType,
                DELIVERY_ST: cleanParam(searchFilters.deliveryStatus)
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

    const fetchCodes = async () => {
        try {
            const groupIds = ['SGB', 'PR_ST', 'PAYST', 'FUEL', 'IMPST', 'DELIV', 'CARKD', 'GOVT'];
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

    // 전체 항목 (50여개)
    const wholeColumnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40, pinned: 'left' },
        { headerName: '접수번호', field: 'SERVICE_ID', width: 100 },
        { headerName: '업무코드', field: 'WORK_CD', width: 90, valueFormatter: params => formatCode('SGB', params.value) },
        { headerName: '회사ID', field: 'COMPANY_ID', width: 90 },
        { headerName: '사원ID', field: 'MEMBER_ID', width: 90 },
        { headerName: '요청차량번호', field: 'REQ_CAR_NO', width: 110 },
        { headerName: '신청일시', field: 'REQUEST_DT', width: 120 },
        { headerName: '처리일자', field: 'PROC_DT', width: 100 },
        { headerName: '심사일자', field: 'JUDGE_DT', width: 100 },
        { headerName: '진행상태', field: 'PROC_ST', width: 90, valueFormatter: params => formatCode('PR_ST', params.value) },
        { headerName: '심사상태', field: 'JUDGE_ST', width: 90 },
        { headerName: '공채금액', field: 'BOND_AMT', width: 100 },
        { headerName: '결제구분', field: 'PAY_GB', width: 90 },
        { headerName: '지점명', field: 'COMPANY_NM', width: 120 },
        { headerName: '사원명', field: 'MEMBER_NM', width: 90 },
        { headerName: '납부상태', field: 'PAY_ST', width: 90, valueFormatter: params => formatCode('PAYST', params.value) },
        { headerName: '지정상태', field: 'DSIGN_ST', width: 90 },
        { headerName: '차대번호', field: 'CARID_NO', width: 160 },
        { headerName: '처리코드', field: 'PROC_CD', width: 90 },
        { headerName: '업무코드(상세)', field: 'TASK_CD', width: 110 },
        { headerName: '공채할인', field: 'BOND_DC', width: 90 },
        { headerName: '차량번호', field: 'CAR_NO', width: 110 },
        { headerName: '배송주소', field: 'DELIVERY_ADDR', width: 250 },
        { headerName: '배송구분', field: 'DELIVERY_GB', width: 90 },
        { headerName: '번호판처리상태', field: 'NUM_PROC_ST', width: 120, valueFormatter: params => formatCode('DELIV', params.value) },
        { headerName: '고객명', field: 'CUSTOMER_NM', width: 90 },
        { headerName: '임판여부', field: 'IMSINUM_YN', width: 90, valueFormatter: params => formatCode('IMPST', params.value) },
        { headerName: '임판일자', field: 'IMSINUM_DT', width: 120 },
        { headerName: '연료코드', field: 'FUEL_CD', width: 90, valueFormatter: params => formatCode('FUEL', params.value) },
        { headerName: '차량명', field: 'CAR_NM', width: 150 },
        { headerName: '차종', field: 'CAR_KD', width: 90, valueFormatter: params => formatCode('CARKD', params.value) },
        { headerName: '면세적용코드', field: 'NTAX_APPLC_CD', width: 110 },
        { headerName: '관청세금', field: 'GOVT_TX', width: 90 },
        { headerName: '소유자명', field: 'OWNER_NM', width: 90 },
        { headerName: '저공해여부', field: 'LOW_POLLUTION_YN', width: 100 },
        { headerName: '관청ID', field: 'GOVT_ID', width: 90, valueFormatter: params => formatCode('GOVT', params.value) },
        { headerName: '번호판구분', field: 'NUMPLATE_GB', width: 100 },
        { headerName: '기본주소', field: 'BASE_ADDRESS', width: 200 },
        { headerName: '상세주소', field: 'BASE_ADDRESS_DT', width: 200 },
        { headerName: '취득금액', field: 'BUY_AMT', width: 100 },
        { headerName: '환급세금', field: 'RETURN_TX', width: 90 },
        { headerName: '세금가상계좌', field: 'TAX_VBANK_NO', width: 120 },
        { headerName: 'CHK', field: 'CHK', width: 60 },
        { headerName: 'T가상계좌ID', field: 'T_VBANK_ID', width: 100 },
        { headerName: '총금액', field: 'TOTAL_AMT', width: 100 },
        { headerName: '인지대', field: 'INJI_AMT', width: 100 },
        { headerName: '증지대', field: 'STAMP_AMT', width: 100 },
        { headerName: '번호판대', field: 'TNUM_AMT', width: 100 },
        { headerName: '취득세', field: 'ACQ_AMT', width: 100 },
        { headerName: '등록면허세', field: 'UREG_AMT', width: 100 },
        { headerName: '대행수수료', field: 'BFEE_AMT', width: 100 },
        { headerName: '실공채금액', field: 'REAL_BOND_AMT', width: 100 },
        { headerName: '수령인명', field: 'RECEIVE_NM', width: 90 },
        { headerName: '수령인연락처', field: 'RECEIVE_TEL_NO', width: 120 },
        { headerName: '시리얼번호', field: 'SERIAL_NO', width: 100 },
    ];


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
        { headerName: '비고', field: 'REMARK', width: 120 },
        { headerName: '배송지', field: 'DELIVERY_ADDR', width: 250 },
        { headerName: '고객명', field: 'CUSTOMER_NM', width: 90 },
        { headerName: '전자납부번호', field: 'TAX_VBANK_NO', width: 120 },
        { headerName: '신청일자', field: 'REQUEST_DT', width: 120 },
        { headerName: '심사일자', field: 'JUDGE_DT', width: 100 },
        { headerName: '배송상태', field: 'NUM_PROC_ST', width: 120, valueFormatter: params => formatCode('DELIV', params.value) },
        { headerName: '배송구분', field: 'DELIVERY_GB', width: 90 },
        { headerName: '차량명', field: 'CAR_NM', width: 150 },
        { headerName: '차종', field: 'CAR_KD', width: 90, valueFormatter: params => formatCode('CARKD', params.value) },
        { headerName: '취득가액', field: 'BUY_AMT', width: 100 },
        { headerName: '소유자명', field: 'OWNER_NM', width: 90 },
        { headerName: '회사명', field: 'COMPANY_NM', width: 120 },
        { headerName: '신청인', field: 'MEMBER_NM', width: 90 },
        { headerName: '관청', field: 'GOVT_ID', width: 90, valueFormatter: params => formatCode('GOVT', params.value) },
    ];

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

    const handleSearchClick = () => {
        fetchNewCarList();
    };

    const handleResetClick = () => {
        setSearchFilters({
            workCode: '010',
            companyID: '',
            govtId: '',
            userNM: '',
            clientName: '',
            carNo: '',
            startDate: getFormattedDateOffset(-14),
            endDate: getFormattedDateOffset(0),
            nullOpt: '',
            processStatus: '전체',
            deliveryType: '',
            deliveryStatus: '전체'
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
                    <span className="toolbar-title">등록[F10]</span>
                    <span className="title-count">{totalCount}</span> 건
                    <button className="btn-status blue" style={{ marginLeft: '10px' }}>배송구분 변경</button>
                </div>
                <div className="toolbar-right">
                    <button className="btn-status">통합영수증</button>
                    <button className="btn-status red">세금계산서</button>
                    <button className="btn-status grey">입금처리</button>
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
                        {/* 업무구분은 '010' (신규등록)으로 고정 */}
                        <select className="erp-input" value={searchFilters.workCode} disabled>
                            <option value="010">신규등록</option>
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
                    <ErpField label="신청자명" span={2}>
                        <input type="text" className="erp-input" value={searchFilters.userNM} onChange={e => setSearchFilters({ ...searchFilters, userNM: e.target.value })} />
                    </ErpField>
                    <ErpField label="고객명" span={2}>
                        <input type="text" className="erp-input" value={searchFilters.clientName} onChange={e => setSearchFilters({ ...searchFilters, clientName: e.target.value })} />
                    </ErpField>
                    <ErpField label="차량/차대번호" span={3} fontSize="11px">
                        <input type="text" className="erp-input" value={searchFilters.carNo} onChange={e => setSearchFilters({ ...searchFilters, carNo: e.target.value })} />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="신청일자" span={5}>
                        <input type="date" className="erp-input" value={searchFilters.startDate} onChange={e => setSearchFilters({ ...searchFilters, startDate: e.target.value })} />
                        <span>~</span>
                        <input type="date" className="erp-input" value={searchFilters.endDate} onChange={e => setSearchFilters({ ...searchFilters, endDate: e.target.value })} />
                        <select className="erp-input" value={searchFilters.nullOpt} onChange={e => setSearchFilters({ ...searchFilters, nullOpt: e.target.value })}></select>
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
                        <select className="erp-input" value={searchFilters.deliveryType} onChange={e => setSearchFilters({ ...searchFilters, deliveryType: e.target.value })}></select>
                    </ErpField>
                    <ErpField label="배송상태" span={3}>
                        <select className="erp-input" value={searchFilters.deliveryStatus} onChange={e => setSearchFilters({ ...searchFilters, deliveryStatus: e.target.value })}>
                            <option value="전체">전체</option>
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
        </div>
    );
};

export default NewcarList;
