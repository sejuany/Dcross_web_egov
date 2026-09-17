import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import EPayInfo from './EPayInfo';
import { exportRowsWithSummaryToXlsx } from '../../utils/xlsxExport';
let mockUser={member_GB:'UA',company_ID:'dacos'};
jest.mock('axios',()=>({get:jest.fn(),post:jest.fn()}));
jest.mock('react-router-dom',()=>({useLocation:()=>({pathname:'/payment/epay-info'})}),{virtual:true});
jest.mock('../../context/AuthContext',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('../../context/TabContext',()=>({
    useTabs:()=>({activeTabId:'epay',removeTab:jest.fn()}),
    useTabPageState:(key,initial)=>require('react').useState(initial)
}));
jest.mock('../../utils/xlsxExport',()=>({exportRowsWithSummaryToXlsx:jest.fn()}));
jest.mock('ag-grid-community',()=>({ModuleRegistry:{registerModules:jest.fn()},AllCommunityModule:{}}));
jest.mock('ag-grid-react',()=>{
    const React=require('react');
    return {AgGridReact:React.forwardRef((props,ref)=>{
        const nodes=props.rowData.map((data,rowIndex)=>({data,rowIndex}));
        const api={
            forEachNodeAfterFilter:fn=>nodes.forEach(fn),forEachNodeAfterFilterAndSort:fn=>nodes.forEach(fn),
            getPinnedBottomRow:()=>({data:props.pinnedBottomRowData[0],rowPinned:'bottom'}),
            getAllDisplayedColumns:()=>props.columnDefs.map(def=>({getColDef:()=>def,getColId:()=>def.field})),
            getValue:(column,node)=>column.getColDef().valueGetter?.({node,data:node.data}) ?? node.data[column.getColId()],
            setFilterModel:jest.fn()
        };
        React.useImperativeHandle(ref,()=>({api}));
        React.useEffect(()=>{props.onRowDataUpdated({api});},[props.rowData]);
        return <div data-testid="summary">{JSON.stringify(props.pinnedBottomRowData)}</div>;
    })};
});
beforeEach(()=>{
    jest.clearAllMocks();
    mockUser={member_GB:'UA',company_ID:'dacos'};
    axios.get.mockImplementation(url=>Promise.resolve({data:url==='/api/companies'
        ?{success:true,list:[]}
        :{success:true,codes:url==='/api/codes/GOVT'
            ?[{CODE_ID:'CHANG',CODE_NM:'창원시'}]
            :[{CODE_ID:'J_REQ',CODE_NM:'지방세 요청'}]}}));
    axios.post.mockResolvedValue({data:{success:true,list:[
        {SERVICE_ID:'N001',REGIS_AMT:100,STAMP_AMT:20,FEE_AMT:30,TOTAL_AMT:150,EPAY_NO:'0012345678901234567'},
        {SERVICE_ID:'N002',REGIS_AMT:'200',STAMP_AMT:40,FEE_AMT:60,TOTAL_AMT:300}
    ]}});
});
test('search sends legacy conditions and computes distinct amount totals; Excel preserves identifier and includes summary',async()=>{
    render(<EPayInfo/>);
    fireEvent.change(screen.getByLabelText('시작일'),{target:{value:'2026-09-01'}});
    fireEvent.change(screen.getByLabelText('종료일'),{target:{value:'2026-09-09'}});
    fireEvent.change(screen.getByLabelText('접수번호'),{target:{value:'N001'}});
    fireEvent.click(screen.getByText('조회[F2]'));
    await waitFor(()=>expect(axios.post).toHaveBeenCalledWith('/api/payment/epay/list',expect.objectContaining({START_DT:'20260901',END_DT:'20260909',SERVICE_ID:'N001'})));
    await waitFor(()=>expect(screen.getByTestId('summary').textContent).toContain('"REGIS_AMT":300'));
    expect(screen.getByTestId('summary').textContent).toContain('"STAMP_AMT":60');
    expect(screen.getByTestId('summary').textContent).toContain('"FEE_AMT":90');
    fireEvent.click(screen.getByText('엑셀[F7]'));
    const options=exportRowsWithSummaryToXlsx.mock.calls[0][0];
    expect(options.rows).toHaveLength(3);
    expect(options.isSummaryRow(options.rows[2])).toBe(true);
    expect(options.getCellValue(options.rows[0],options.columns.find(c=>c.key==='EPAY_NO'))).toBe('0012345678901234567');
    fireEvent.click(screen.getByText('초기화[F8]'));
    expect(screen.getByLabelText('접수번호').value).toBe('');
});
test('invalid date range prevents request',()=>{
    render(<EPayInfo/>);
    fireEvent.change(screen.getByLabelText('시작일'),{target:{value:'2026-10-01'}});
    fireEvent.change(screen.getByLabelText('종료일'),{target:{value:'2026-09-01'}});
    fireEvent.click(screen.getByText('조회[F2]'));
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('조회 시작일과 종료일');
});
test('legacy GU code constrains the same GU web user to its government',async()=>{
    mockUser={member_GB:'GU',company_ID:'CHANG'};
    render(<EPayInfo/>);
    await waitFor(()=>expect(screen.getByLabelText('관청')).toHaveValue('CHANG'));
    expect(screen.getByLabelText('관청')).toBeDisabled();
    expect(screen.getByLabelText('신청구분')).toHaveValue('001');
    await waitFor(()=>expect(axios.get).toHaveBeenCalledWith('/api/companies', {params:{workCd:'001',govtId:'CHANG'}}));
    fireEvent.click(screen.getByText('조회[F2]'));
    await waitFor(()=>expect(axios.post).toHaveBeenCalledWith('/api/payment/epay/list',expect.objectContaining({GOVT_ID:'CHANG',WORK_CD:'001'})));
});
