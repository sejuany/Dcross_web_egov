import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useAuth } from '../../context/AuthContext';
import { useTabs, useTabPageState } from '../../context/TabContext';
import ErpSection from '../common/ErpSection';
import ErpField from '../common/ErpField';
import { exportRowsWithSummaryToXlsx } from '../../utils/xlsxExport';
import './PayInfo.css';

ModuleRegistry.registerModules([AllCommunityModule]);
const dateOffset = days => {
    const date = new Date(); date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
const isGovtMember = user => user?.member_GB === 'GU';
const usesLegacyUFlow = user => (user?.member_GB || '').startsWith('U') || isGovtMember(user);
const initialFilters = user => ({ WORK_CD: usesLegacyUFlow(user) ? '001' : '010',
    COMPANY_ID: '', GOVT_ID: isGovtMember(user) ? (user?.company_ID || '') : '', SERVICE_ID: '', CAR_NO: '', GUBUN: '', BASE_GUBUN: 'REQUEST_DT',
    START_DT: dateOffset(-14), END_DT: dateOffset(0), PROC_ST: 'J_REQ', PAY_ST: '' });
const workCodes = [['000','저당설정'],['001','저당말소'],['010','신규등록'],['011','이전등록'],['030','변경등록'],['032','변경(이전)'],['040','설정(건기)'],['041','말소(건기)'],['004','설정(공동)'],['002','저당권변경'],['003','저당권이전'],['013','신규(등록)'],['031','등록증재발급']];
const amounts = [['REGIS_AMT','등록면허세/취득세'],['STAMP_AMT','증지대'],['FEE_AMT','수수료'],['INJI_AMT','인지세'],['BOND_AMT','채권금액'],['BFEE_AMT','채권수수료'],['TOTAL_AMT','입금총액']];
const number = value => Number(value || 0);
const dateFormat = value => /^\d{8}$/.test(String(value || '')) ? `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}` : (value || '');

export default function EPayInfo() {
    const { user } = useAuth();
    const { activeTabId, removeTab } = useTabs();
    const location = useLocation();
    const gridRef = useRef(null);
    const requestId = useRef(0);
    const [filters, setFilters] = useTabPageState('epayFilters', () => initialFilters(user));
    const [rows, setRows] = useState([]);
    const [codes, setCodes] = useState({});
    const [companies, setCompanies] = useState([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [summary, setSummary] = useState([]);
    const [count, setCount] = useState(0);
    const isStaff = (user?.member_GB || '').startsWith('U');
    const isGovt = isGovtMember(user);
    const canChooseCompany = isStaff || isGovt;
    const set = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
    useEffect(() => {
        let live = true;
        Promise.all(['SGB','PR_ST','PAYST','GOVT'].map(async group => {
            const { data } = await axios.get(`/api/codes/${group}`);
            if (!data.success) throw new Error('공통코드 조회 실패');
            return [group, data.codes || []];
        })).then(result => { if(live) setCodes(Object.fromEntries(result)); })
          .catch(() => { if(live) setMessage('검색 공통코드를 불러오지 못했습니다. 화면을 다시 열어 주세요.'); });
        return () => { live = false; requestId.current++; };
    }, []);
    useEffect(() => {
        if (!canChooseCompany) return;
        let live = true;
        axios.get('/api/companies', { params: {
            workCd: filters.WORK_CD || '',
            // Legacy GU loaded companies with its own CompanyID as GOVT_ID.
            govtId: isGovt ? (user?.company_ID || '') : ''
        } }).then(({data}) => {
            if (!data.success) throw new Error();
            if(live) setCompanies(Array.from(new Map((data.list || []).map(item => [item.COMPANY_ID,item])).values()));
        }).catch(() => { if(live) { setCompanies([]); setMessage('회사 목록을 불러오지 못했습니다.'); } });
        return () => { live = false; };
    }, [filters.WORK_CD, canChooseCompany, isGovt, user?.company_ID]);
    const search = useCallback(async (criteria = filters) => {
        if(!criteria.START_DT || !criteria.END_DT || criteria.START_DT > criteria.END_DT) {
            setMessage('조회 시작일과 종료일을 확인해 주세요.'); return;
        }
        const id = ++requestId.current;
        setBusy(true); setMessage('');
        try {
            const {data} = await axios.post('/api/payment/epay/list', {...criteria,
                START_DT: criteria.START_DT.replaceAll('-',''), END_DT: criteria.END_DT.replaceAll('-','') });
            if(!data.success || !Array.isArray(data.list)) throw new Error(data.message || '조회에 실패했습니다.');
            if(id === requestId.current) { setRows(data.list); if(!data.list.length) setMessage('조회 결과가 없습니다.'); }
        } catch(error) {
            if(id === requestId.current) { setRows([]); setMessage(error.response?.data?.message || error.message || '조회에 실패했습니다.'); }
        } finally { if(id === requestId.current) setBusy(false); }
    }, [filters]);
    const reset = useCallback(() => {
        requestId.current++; setBusy(false); setFilters(initialFilters(user)); setRows([]); setMessage('');
        gridRef.current?.api?.setFilterModel(null);
    }, [setFilters, user]);
    const exportExcel = useCallback(() => {
        const api = gridRef.current?.api;
        const nodes = [];
        api?.forEachNodeAfterFilterAndSort(node => { if(node.data) nodes.push(node); });
        if(!nodes.length) { setMessage('내보낼 데이터가 없습니다.'); return; }
        const total = api.getPinnedBottomRow(0);
        if(total) nodes.push(total);
        exportRowsWithSummaryToXlsx({
            columns: api.getAllDisplayedColumns().map(column => ({key:column.getColId(),label:column.getColDef().headerName,column,
                excelAlign:amounts.some(([field])=>field===column.getColId())?'right':'center'})),
            rows:nodes, fileName:`지방세납부현황_${dateOffset(0)}.xlsx`, sheetName:'지방세납부현황',
            isSummaryRow:node=>!!node.rowPinned,
            getCellValue:(node,item)=>{
                const colDef=item.column.getColDef();
                const value=typeof colDef.valueGetter==='function'
                    ? colDef.valueGetter({api,node,data:node.data,colDef,column:item.column})
                    : node.data?.[colDef.field];
                return typeof colDef.valueFormatter==='function' ? colDef.valueFormatter({api,node,data:node.data,value,colDef,column:item.column}) : value ?? '';
            }
        });
    }, []);
    const close = useCallback(() => { if(activeTabId) removeTab(activeTabId); }, [activeTabId, removeTab]);
    useEffect(() => {
        const handler = event => {
            if(location.pathname !== '/payment/epay-info') return;
            const actions = {F2: () => { if(!busy) search(); }, F7: exportExcel, F8: reset, F9: close};
            if(actions[event.key]) { event.preventDefault(); actions[event.key](); }
        };
        window.addEventListener('keydown',handler);
        return () => window.removeEventListener('keydown',handler);
    }, [location.pathname, busy, search, exportExcel, reset, close]);
    const formatCode = useCallback((group, value) => codes[group]?.find(code => code.CODE_ID === value)?.CODE_NM || value || '', [codes]);
    const columns = useMemo(() => [
        {field:'NO',headerName:'순번',width:75,pinned:'left',filter:false,valueGetter:p => p.node.rowPinned ? '합계' : p.node.rowIndex+1},
        {field:'WORK_CD',headerName:'업무구분',width:110,valueFormatter:p => p.node?.rowPinned ? p.value : formatCode('SGB',p.value)},
        {field:'SERVICE_ID',headerName:'접수번호',width:180},
        {field:'CAR_NO',headerName:'차량번호',width:150,valueFormatter:p => p.value ? `${p.value}${number(p.data?.MORT_COUNT)>0 ? ` 외 ${p.data.MORT_COUNT}건` : ''}` : ''},
        {field:'PROC_ST',headerName:'신청상태',width:130,valueFormatter:p=>formatCode('PR_ST',p.value)},
        {field:'GOVT_ID',headerName:'처리관청',width:110,valueFormatter:p=>formatCode('GOVT',p.value)},
        {field:'PAY_ST',headerName:'납부상태',width:100,valueFormatter:p=>formatCode('PAYST',p.value)},
        {field:'COMPANY_NM',headerName:'회사명',width:180},
        ...amounts.map(([field,headerName])=>({field,headerName,width:145,filter:'agNumberColumnFilter',cellStyle:{textAlign:'right'},valueGetter:p=>number(p.data?.[field]),valueFormatter:p=>number(p.value).toLocaleString('ko-KR')})),
        {field:'BRANCH_NM',headerName:'소속명',width:130}, {field:'MEMBER_NM',headerName:'신청자명',width:110},
        ...[['REQUEST_DT','신청일자'],['JUDGE_DT','심사일자'],['PAY_DT','납부일자']].map(([field,headerName])=>({field,headerName,width:120,valueFormatter:p=>dateFormat(p.value)})),
        {field:'VBANK_NO',headerName:'가상계좌',width:190}, {field:'EPAY_NO',headerName:'전자납부번호',width:210}, {field:'CONFIRM_NO',headerName:'계약번호',width:160}
    ], [formatCode]);
    const updateSummary = useCallback(({api}) => {
        const result = {NO:'합계'}; amounts.forEach(([field])=>{result[field]=0;});
        let total = 0;
        api.forEachNodeAfterFilter(node => { if(node.data) {total++; amounts.forEach(([field])=>{result[field]+=number(node.data[field]);});} });
        result.WORK_CD = `${total}건`; setCount(total);
        setSummary(previous => JSON.stringify(previous[0])===JSON.stringify(result) ? previous : [result]);
    }, []);
    const select = (key, label, options) => <select className="erp-input" aria-label={label} value={filters[key]} onChange={e=>set(key,e.target.value)}>
        <option value="">전체</option>{options.map(([value,text])=><option key={value} value={value}>{text}</option>)}
    </select>;
    const codeOptions = group => (codes[group] || []).filter(c=>c.CODE_ID && c.CODE_ID !== 'X').map(c=>[c.CODE_ID,c.CODE_NM]);
    return <div className="status-container">
        <div className="status-toolbar"><div className="toolbar-left"><span className="title-count">{count}</span> 건</div>
            <div className="toolbar-right"><button className="btn-status" disabled={busy} onClick={()=>search()}>{busy?'조회 중…':'조회[F2]'}</button>
                <button className="btn-status" disabled={busy} onClick={exportExcel}>엑셀[F7]</button><button className="btn-status" onClick={reset}>초기화[F8]</button><button className="btn-status" onClick={close}>닫기[F9]</button></div></div>
        <ErpSection isHeader={true}>
            <div className="erp-row">
                <ErpField label="신청구분" span={4}>{select('WORK_CD','신청구분',workCodes)}
                    {canChooseCompany && <select className="erp-input" aria-label="회사" value={filters.COMPANY_ID} onChange={e=>set('COMPANY_ID',e.target.value)}><option value="">전체 (회사)</option>{companies.map(c=><option key={c.COMPANY_ID} value={c.COMPANY_ID}>{c.COMPANY_NM}</option>)}</select>}
                    {canChooseCompany && <select className="erp-input" aria-label="관청" value={filters.GOVT_ID} onChange={e=>set('GOVT_ID',e.target.value)} disabled={isGovt}><option value="">전체</option>{codeOptions('GOVT').map(([value,text])=><option key={value} value={value}>{text}</option>)}</select>}</ErpField>
                <ErpField label="접수번호" span={4}><input className="erp-input" aria-label="접수번호" value={filters.SERVICE_ID} onChange={e=>set('SERVICE_ID',e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!busy) search();}}/>{select('GUBUN','홀짝 구분',[['Odd','홀수'],['Even','짝수']])}</ErpField>
                <ErpField label="차량번호" span={4}><input className="erp-input" aria-label="차량번호" value={filters.CAR_NO} onChange={e=>set('CAR_NO',e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!busy) search();}}/></ErpField>
            </div>
            <div className="erp-row">
                <ErpField label="조회기간" span={4}><select className="erp-input" aria-label="날짜 구분" value={filters.BASE_GUBUN} onChange={e=>set('BASE_GUBUN',e.target.value)}><option value="REQUEST_DT">신청일</option><option value="PROC_DT">처리일</option></select>
                    <input className="erp-input" type="date" aria-label="시작일" value={filters.START_DT} onChange={e=>set('START_DT',e.target.value)}/><span>~</span><input className="erp-input" type="date" aria-label="종료일" value={filters.END_DT} onChange={e=>set('END_DT',e.target.value)}/></ErpField>
                <ErpField label="신청상태" span={4}>{select('PROC_ST','신청상태',codeOptions('PR_ST'))}</ErpField>
                <ErpField label="납부상태" span={4}>{select('PAY_ST','납부상태',codeOptions('PAYST'))}</ErpField>
            </div>
        </ErpSection>
        {message && <div role="status" style={{padding:'8px 12px',color:'#9b3021'}}>{message}</div>}
        <div className="ag-theme-alpine" style={{flex:1,minHeight:320}}>
            <AgGridReact ref={gridRef} theme="legacy" rowData={rows} columnDefs={columns}
                defaultColDef={{sortable:true,resizable:true,filter:true}} loading={busy}
                rowHeight={28} headerHeight={32} pinnedBottomRowData={summary}
                onRowDataUpdated={updateSummary} onFilterChanged={updateSummary}
                overlayNoRowsTemplate="<span>조회 결과가 없습니다.</span>" getRowStyle={p=>p.node.rowPinned?{fontWeight:'bold',backgroundColor:'#f1f5f9'}:undefined}/>
        </div>
    </div>;
}
