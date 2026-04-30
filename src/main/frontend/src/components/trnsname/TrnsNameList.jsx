import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './TrnsNameList.css';
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

const TrnsNameList = () => {
    const navigate = useNavigate();
    const gridRef = useRef(null);
    const { user } = useAuth();

    const [codeMap, setCodeMap] = useState({});
    const [codeListMap, setCodeListMap] = useState({});
    const [companyList, setCompanyList] = useState([]);
    const [toastMessage, setToastMessage] = useState('');
    const [rowData, setRowData] = useState([]);
    const [totalCount, setTotalCount] = useState(0);

    const [searchFilters, setSearchFilters] = useState({
        workCode: 'TRNS',
        companyID: '',
        govtId: '',
        userNM: '',
        customerNM: '',
        carNo: '',
        startDate: getFormattedDateOffset(-14),
        endDate: getFormattedDateOffset(0),
        processStatus: '전체'
    });

    const fetchTrnsNameList = async () => {
        try {
            const cleanParam = (val) => (val === '전체' || val === '전체 (회사)' || val === '전체 (관청)') ? '' : val;

            const params = {
                WORK_CD: searchFilters.workCode,
                COMPANY_ID: cleanParam(searchFilters.companyID),
                GOVT_ID: cleanParam(searchFilters.govtId),
                CAR_NO: searchFilters.carNo,
                START_DT: searchFilters.startDate.replace(/-/g, ''),
                END_DT: searchFilters.endDate.replace(/-/g, ''),
                PROC_ST: cleanParam(searchFilters.processStatus),
                CUSTOMER_NM: searchFilters.customerNM
            };

            const response = await axios.post('/api/trnsname/list', params);
            if (response.data.success) {
                setRowData(response.data.list);
                setTotalCount(response.data.list.length);
            }
        } catch (error) {
            console.error('이전등록현황 조회 실패:', error);
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
        } catch (error) {
            console.error('공통 코드 조회 실패:', error);
        }
    };

    const formatCode = (groupId, value) => {
        return codeMap[groupId] && codeMap[groupId][value] ? codeMap[groupId][value] : value;
    };

    useEffect(() => {
        fetchCodes();
        fetchTrnsNameList();
    }, []);

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await axios.get('/api/companies', {
                    params: { workCd: 'TRNS' }
                });
                if (response.data.success) {
                    setCompanyList(response.data.list);
                }
            } catch (error) {
                console.error('회사 목록 조회 실패:', error);
            }
        };
        fetchCompanies();
    }, []);

    const columnDefs = [
        { headerCheckboxSelection: true, checkboxSelection: true, width: 40, pinned: 'left' },
        { headerName: '순번', valueGetter: 'node.rowIndex + 1', width: 60, textAlign: 'center' },
        { headerName: '접수번호', field: 'SERVICE_ID', width: 150 },
        { headerName: '차량번호', field: 'CAR_NO', width: 120 },
        { headerName: '업무구분', field: 'WORK_CD', width: 100, valueFormatter: params => formatCode('SGB', params.value) },
        { headerName: '진행상태', field: 'PROC_ST', width: 100, valueFormatter: params => formatCode('PR_ST', params.value) },
        { headerName: '회사명', field: 'COMPANY_NM', width: 150 },
        { headerName: '신청인', field: 'MEMBER_NM', width: 100 },
        { headerName: '신청일시', field: 'REQUEST_DT', width: 130 },
        { headerName: '처리일자', field: 'PROC_DT', width: 110 },
        { headerName: '관청', field: 'GOVT_ID', width: 100, valueFormatter: params => formatCode('GOVT', params.value) }
    ];

    const handleSearchClick = () => fetchTrnsNameList();

    const handleResetClick = () => {
        setSearchFilters({
            workCode: 'TRNS',
            companyID: '',
            govtId: '',
            userNM: '',
            customerNM: '',
            carNo: '',
            startDate: getFormattedDateOffset(-14),
            endDate: getFormattedDateOffset(0),
            processStatus: '전체'
        });
    };

    const handleExportExcel = () => {
        if (gridRef.current && gridRef.current.api) {
            gridRef.current.api.exportDataAsCsv({ fileName: `이전등록현황_${new Date().toISOString().split('T')[0]}.csv` });
        }
    };

    const handleCloseClick = () => navigate('/home');

    return (
        <div className="status-container">
            {toastMessage && <div className="toast-notification">{toastMessage}</div>}

            <div className="status-toolbar">
                <div className="toolbar-left">
                    <span className="toolbar-title">이전등록현황</span>
                    <span className="title-count">{totalCount}</span> 건
                </div>
                <div className="toolbar-right">
                    <button className="btn-status" onClick={handleSearchClick}>조회[F2]</button>
                    <button className="btn-status" onClick={handleExportExcel}>엑셀[F7]</button>
                    <button className="btn-status" onClick={handleResetClick}>초기화[F8]</button>
                    <button className="btn-status" onClick={handleCloseClick}>닫기[F9]</button>
                </div>
            </div>

            <ErpSection isHeader={true}>
                <div className="erp-row">
                    <ErpField label="신청구분" span={5}>
                        <select className="erp-input" value={searchFilters.workCode} onChange={e => setSearchFilters({...searchFilters, workCode: e.target.value})}>
                            <option value="TRNS">이전등록 (전체)</option>
                            <option value="TRNS_1">일반이전</option>
                            <option value="TRNS_2">공매이전</option>
                        </select>
                        <select className="erp-input" value={searchFilters.companyID} onChange={e => setSearchFilters({...searchFilters, companyID: e.target.value})}>
                            <option value="">전체 (회사)</option>
                            {companyList.map(comp => (
                                <option key={comp.COMPANY_ID} value={comp.COMPANY_ID}>{comp.COMPANY_NM}</option>
                            ))}
                        </select>
                        <select className="erp-input" value={searchFilters.govtId} onChange={e => setSearchFilters({...searchFilters, govtId: e.target.value})}>
                            <option value="">전체 (관청)</option>
                            {codeListMap['GOVT'] && codeListMap['GOVT'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                    <ErpField label="고객명" span={2}>
                        <input type="text" className="erp-input" value={searchFilters.customerNM} onChange={e => setSearchFilters({...searchFilters, customerNM: e.target.value})} />
                    </ErpField>
                    <ErpField label="차량번호" span={3}>
                        <input type="text" className="erp-input" value={searchFilters.carNo} onChange={e => setSearchFilters({...searchFilters, carNo: e.target.value})} />
                    </ErpField>
                </div>
                <div className="erp-row">
                    <ErpField label="신청일자" span={5}>
                        <input type="date" className="erp-input" value={searchFilters.startDate} onChange={e => setSearchFilters({...searchFilters, startDate: e.target.value})} />
                        <span>~</span>
                        <input type="date" className="erp-input" value={searchFilters.endDate} onChange={e => setSearchFilters({...searchFilters, endDate: e.target.value})} />
                    </ErpField>
                    <ErpField label="처리상태" span={2}>
                        <select className="erp-input" value={searchFilters.processStatus} onChange={e => setSearchFilters({...searchFilters, processStatus: e.target.value})}>
                            <option value="전체">전체</option>
                            {codeListMap['PR_ST'] && codeListMap['PR_ST'].map(code => (
                                <option key={code.CODE_ID} value={code.CODE_ID}>{code.CODE_NM}</option>
                            ))}
                        </select>
                    </ErpField>
                </div>
            </ErpSection>

            <div className="grid-container ag-theme-alpine" style={{ height: 'calc(100% - 180px)', width: '100%' }}>
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={{ sortable: true, resizable: true, filter: true }}
                    rowSelection="multiple"
                    onRowDoubleClicked={(e) => navigate('/trnsname/trnsname-request', { state: { receiptNo: e.data.SERVICE_ID } })}
                />
            </div>
        </div>
    );
};

export default TrnsNameList;
