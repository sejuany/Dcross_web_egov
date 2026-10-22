import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import NewcarRequest_W from './NewcarRequest_W';
import { gf } from '../../utils/utils';
import ErpField from '../common/ErpField';
import { AgGridReact } from 'ag-grid-react';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const mockNavigate = jest.fn();
const mockAddTab = jest.fn();
const mockLocation = { pathname: '/newcar/newcar-request-w', state: { receiptNo: 'TEST-SERVICE' } };
jest.mock('react-router-dom', () => ({ useLocation: () => mockLocation, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../../context/TabContext', () => ({ useTabs: () => ({ tabs: [], activeTabId: 'test', removeTab: jest.fn(), addTab: mockAddTab, switchTab: jest.fn() }) }));
jest.mock('../../utils/utils', () => ({ gf: {
    getCodes: jest.fn(() => Promise.resolve({ NUMGB: [{ CODE_ID: 'F', CODE_NM: '필름' }], TASK: [{ CODE_ID: 'NORML', CODE_NM: '일반' }] })),
    formatDateFields: value => value, confirm: jest.fn(() => Promise.resolve(true))
} }));
jest.mock('../common/AddressSearchModal', () => ({ isOpen, onSelect }) => isOpen ? <button type="button" onClick={() => onSelect({ ADDR: 'TEST-ADDRESS', ADDR_DT: 'TEST-DETAIL', POST_NO: '12345', BUBJUNG_CD: 'TEST-CODE' })}>테스트 주소 선택</button> : null);
jest.mock('./NumPlateSelectModal', () => ({ isOpen, onSelect }) => isOpen ? <button type="button" onClick={() => onSelect(true, 'TEST-PLATE')}>테스트 번호 선택 완료</button> : null);
jest.mock('./NewCarReceiptModal', () => () => null);
jest.mock('./BondReceiptModal', () => () => null);
jest.mock('../../wa/pages/newcar/WaNewcarAttachModal', () => () => null);
jest.mock('ag-grid-community', () => ({ ModuleRegistry: { registerModules: jest.fn() }, AllCommunityModule: {} }));
jest.mock('ag-grid-react', () => ({ AgGridReact: jest.fn(() => <div role="grid" aria-label="결제 세부 비용" />) }));

const original = () => ({ dsUserInfo: { COMPANY_ID: 'WB001' },
    dsService: { SERVICE_ID: 'TEST-SERVICE', PROC_ST: 'SAV', LINK_ID: 'ORDER001' },
    dsNewCar: { CARID_NO: 'AAAAAAAAAAAAAAAAA', NUMPLATE_GB: 'F', CAR_NM: 'OLD-MODEL', RATIO_NO: '100', CARP_MAIL: '', LOW_POLLUTION_KD: 'TYPE', LOW_POLLUTION_NO: 'NUMBER' },
    dsPaymentList: [{ PAY_KD: 'FEE', PAY_AMT: 27500, PRE_PAY_AMT: 27500 }] });
const file = () => new File(['%PDF-test'], 'production.pdf', { type: 'application/pdf' });
const renderReady = async () => {
    const view = render(<NewcarRequest_W />);
    await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toBeEnabled());
    return view;
};
const readBlob = blob => new Promise(resolve => {
    const reader = new FileReader(); reader.onload = () => resolve(JSON.parse(reader.result)); reader.readAsText(blob);
});

beforeEach(() => {
    jest.clearAllMocks();
    AgGridReact.mockImplementation(() => <div role="grid" aria-label="결제 세부 비용" />);
    gf.getCodes.mockResolvedValue({ NUMGB: [{ CODE_ID: 'F', CODE_NM: '필름' }], TASK: [{ CODE_ID: 'NORML', CODE_NM: '일반' }] });
    gf.confirm.mockResolvedValue(true);
    axios.get.mockResolvedValue({ data: { success: true, data: original() } });
    axios.post.mockImplementation(url => Promise.resolve({ data: url.endsWith('/pdf-extract')
        ? { success: true, data: { carIdNo: 'AAAAAAAAAAAAAAAAA', carName: 'PDF-MODEL', ownerName: 'PDF-OWNER' } }
        : { success: true, data: { SERVICE_ID: 'TEST-SERVICE', RESULT_CD: '0' } } }));
});

test('삭제 항목·배송탭을 제거하고 툴바 버튼과 조회 전용 항목을 표시한다', async () => {
    const { container } = await renderReady();
    expect(container.querySelector('.erp-label.req')).toBeNull();
    for (const label of ['차대번호', '차 명', '형 식', '공급가액(VAT별도)', '대표소유자명', '등록번호', '소유자주소', '등록구분']) {
        for (const input of screen.getAllByLabelText(label)) expect(input).toHaveClass('w-auto');
    }
    expect(screen.getByLabelText('계약자명')).not.toHaveClass('w-auto');
    for (const label of container.querySelectorAll('.erp-label')) {
        expect(label.style.width).toBe('');
        expect(label.style.minWidth).toBe('');
        expect(label.style.flex).toBe('');
    }
    expect(Array.from(container.querySelectorAll('.toolbar-left button')).map(button => button.textContent)).toEqual(['목록', '첨부서류', '제작증 업로드']);
    for (const label of ['임시번호판 상태', '용도구분', '등록관청', '차령만료일', '신규등록 구분', '업무 구분', '입금구분', '등록비용사전조회', '신규등록일자', '채권금액', '채권납부계좌']) {
        expect(screen.queryByText(label, { exact: true })).toBeNull();
    }
    expect(screen.queryByRole('tab', { name: '배송정보' })).toBeNull();
    for (const label of ['접수번호', '신청일자', '등록비용', '환급금액', '저공해발급 종류', '저공해발급 번호']) {
        expect(screen.getByLabelText(label)).toHaveAttribute('readonly');
    }
    expect(screen.getByLabelText('사용연료')).toBeDisabled();
    expect(screen.getByLabelText('접수번호').closest('.tab-content')).toBeNull();
    expect(screen.getByLabelText('차대번호').closest('.tab-content')).toBeNull();
    expect(screen.getByRole('tab', { name: '결제정보' }).closest('.tab-content')).toBeNull();
    expect(screen.getByLabelText('저공해발급 종류')).toHaveValue('TYPE');
    expect(screen.getByLabelText('등록증 이메일 아이디')).toHaveValue('');
    expect(screen.getByLabelText('소유자주소').closest('.field-group')).toContainElement(screen.getByLabelText('소유자주소 상세'));
    expect(screen.getByLabelText('등록번호').closest('.field-group')).toContainElement(screen.getByLabelText('등록구분'));
    expect(screen.getByLabelText('번호판지정 요구사항').closest('.field-group')).toContainElement(screen.getByLabelText('천공 여부'));
    expect(screen.getByLabelText('환급계좌').closest('.field-group')).toContainElement(screen.getByLabelText('환급은행'));
    fireEvent.click(screen.getByRole('button', { name: '목록' }));
    expect(mockAddTab).toHaveBeenCalledWith('newcar-list-w', '신규신청현황(W)', '/newcar/newcar-list-w');
});
test('사용본거지·등록증 배송지에 소유자주소와 상세주소·우편번호를 복사해 저장한다', async () => {
    const record = original();
    Object.assign(record.dsNewCar, { ADDRESS: 'OWNER-ADDRESS', ADDRESS_DT: 'OWNER-DETAIL', POST_NO: '54321', BUBJUNG_CD: 'OWNER-CODE', ADDR_INFO: 'OWNER-INFO' });
    axios.get.mockResolvedValue({ data: { success: true, data: record } });
    await renderReady();
    for (const label of ['사용본거지', '등록증 배송지']) {
        const checkbox = screen.getByRole('checkbox', { name: `${label}를 소유자주소와 동일하게` });
        fireEvent.click(checkbox);
        expect(screen.getByLabelText(label)).toHaveValue('OWNER-ADDRESS');
        expect(screen.getByLabelText(`${label} 상세`)).toHaveValue('OWNER-DETAIL');
        fireEvent.click(checkbox);
        expect(screen.getByLabelText(label)).toHaveValue('OWNER-ADDRESS');
    }
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장되었습니다.');
    const request = await readBlob(axios.post.mock.calls.find(([url]) => url.endsWith('/w/process'))[1].get('request'));
    expect(request.dsNewCar).toMatchObject({ BASE_ADDRESS: 'OWNER-ADDRESS', BASE_ADDRESS_DT: 'OWNER-DETAIL', BASE_POST_NO: '54321', BASE_BUBJUNG_CD: 'OWNER-CODE', ADDR_INFO2: 'OWNER-INFO',
        CARP_ADDRESS: 'OWNER-ADDRESS', CARP_ADDRESS_DT: 'OWNER-DETAIL', CARP_POST_NO: '54321' });
});

test('주소 검색 버튼은 상세주소 뒤 맨 오른쪽에 배치하고 해당 주소에 검색 결과를 반영한다', async () => {
    await renderReady();
    for (const label of ['소유자주소', '사용본거지', '등록증 배송지']) {
        const field = screen.getByLabelText(label).closest('.field-group');
        const button = field.querySelector('button');
        expect(button).toHaveTextContent(/^주소 검색$/);
        expect(button.parentElement.lastElementChild).toBe(button);
        fireEvent.click(button);
        fireEvent.click(screen.getByRole('button', { name: '테스트 주소 선택' }));
        expect(screen.getByLabelText(label)).toHaveValue('TEST-ADDRESS');
        expect(screen.getByLabelText(`${label} 상세`)).toHaveValue('TEST-DETAIL');
    }
});

test('공통 필드의 기존 기본 폭·명시한 폭을 유지하고 null일 때만 CSS에 맡긴다', () => {
    const { container, rerender } = render(<ErpField label="테스트" />);
    expect(container.querySelector('.erp-label').style.minWidth).toBe('95px');
    rerender(<ErpField label="테스트" labelWidth="120px" />);
    expect(container.querySelector('.erp-label').style.minWidth).toBe('120px');
    rerender(<ErpField label="테스트" labelWidth={null} />);
    expect(container.querySelector('.erp-label').style.cssText).toBe('');
});

test('등록정보는 소유자·등록 및 추가정보를 2열로 배치하고 탭 전환 후에도 메모를 유지한다', async () => {
    await renderReady(); fireEvent.change(screen.getByLabelText('메모'), { target: { value: 'TEST-MEMO' } });
    const registrationPanel = screen.getByRole('tabpanel', { name: '등록정보' });
    const layout = registrationPanel.querySelector('.owner-split-layout');
    expect(layout.children).toHaveLength(4);
    expect(layout.children[0]).toContainElement(screen.getByLabelText('대표소유자명'));
    expect(layout.children[1]).toContainElement(screen.getByLabelText('공동소유자명'));
    expect(layout.children[2]).toContainElement(screen.getByLabelText('결제자명'));
    expect(layout.children[3]).toContainElement(screen.getByLabelText('메모'));
    const registrationTab = screen.getByRole('tab', { name: '등록정보' });
    const paymentTab = screen.getByRole('tab', { name: '결제정보' });
    expect(registrationTab.parentElement).toHaveClass('tab-button-group');
    expect(paymentTab.parentElement).toBe(registrationTab.parentElement);
    fireEvent.click(screen.getByRole('tab', { name: '결제정보' }));
    expect(paymentTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: '결제정보' })).toBeVisible();
    expect(screen.queryByText('추가 정보')).toBeNull();
    expect(screen.queryByLabelText('메모')).toBeNull();
    expect(screen.queryByLabelText('등록증 이메일 아이디')).toBeNull();
    expect(screen.queryByRole('button', { name: '등록증 확인' })).toBeNull();
    for (const label of ['납부상태', '납부방법']) expect(screen.getByLabelText(label)).toBeDisabled();
    for (const label of ['가상계좌', '총 금액']) expect(screen.getByLabelText(label)).toHaveAttribute('readonly');
    expect(screen.getByRole('grid', { name: '결제 세부 비용' })).toBeVisible();
    const grid = AgGridReact.mock.calls.at(-1)[0];
    expect(grid.columnDefs.map(column => column.field)).toEqual(['PAY_KD', 'VBANK_NO', 'PAY_OP', 'PRE_PAY_AMT', 'PAY_AMT', 'PAY_ST', 'PAY_DT']);
    expect(grid.defaultColDef.editable).toBe(false);
    expect(grid.columnDefs.some(column => column.editable)).toBe(false);
    fireEvent.click(registrationTab);
    expect(screen.getByRole('tabpanel', { name: '등록정보' })).toContainElement(screen.getByLabelText('메모'));
    expect(screen.getByLabelText('메모')).toHaveValue('TEST-MEMO');
});

test('공통 CSS의 select 화살표와 작은 여백은 필수·자동입력·비활성 표시에서도 유지된다', async () => {
    const style = document.createElement('style');
    style.textContent = require('fs').readFileSync(`${__dirname}/NewcarRequest.css`, 'utf8');
    document.head.appendChild(style);
    try {
        await renderReady();
        const select = screen.getByLabelText('업무구분');
        for (const className of ['erp-input', 'erp-input w-required', 'erp-input w-required w-auto']) {
            select.className = className;
            for (const disabled of [false, true]) {
                select.disabled = disabled;
                const computed = getComputedStyle(select);
                expect(computed.backgroundImage).toContain('data:image/svg+xml');
                expect(computed.paddingLeft).toBe('4px');
                expect(computed.paddingRight).toBe('14px');
                expect(computed.margin).toBe('1px');
            }
        }
    } finally { style.remove(); }
});

test.each(['B', 'R'])('등록구분 %s에서도 공통 행·소유자 배치를 사용하고 12칸을 넘지 않는다', async registrationType => {
    const record = original(); record.dsNewCar.REG_GB = registrationType;
    axios.get.mockResolvedValue({ data: { success: true, data: record } });
    const { container } = await renderReady();
    expect(container.querySelector('.new-reg-container .tab-container > .tab-content')).not.toBeNull();
    expect(container.querySelector('.owner-split-layout .owner-main-panel')).not.toBeNull();
    expect(container.querySelector('.owner-split-layout .owner-co-panel')).not.toBeNull();
    expect(container.querySelector('.fixed-reg-info-section')).not.toBeNull();
    expect(container.querySelector('.w-fields, .w-owner-grid, .w-scroll')).toBeNull();
    const checkRows = () => {
        for (const row of container.querySelectorAll('.erp-row')) {
            const columns = Array.from(row.children).map(child => Number(child.className.match(/\bcol-(\d+)\b/)?.[1] || 0));
            if (columns.some(Boolean)) expect(columns.reduce((sum, span) => sum + span, 0)).toBeLessThanOrEqual(12);
        }
    };
    checkRows();
    fireEvent.click(screen.getByRole('button', { name: '세금계산서/현금영수증 정보' }));
    fireEvent.change(screen.getByLabelText('증빙 종류'), { target: { value: 'TAX' } });
    checkRows();
});
test('제작증 확인·취소는 접수를 저장하지 않고 반영한 PDF만 저장 시 전송한다', async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText('제작증 PDF'), { target: { files: [file()] } });
    await screen.findByRole('dialog', { name: '제작증 반영 내용 확인' });
    fireEvent.click(screen.getByRole('button', { name: '취소' })); expect(screen.getByLabelText('차 명')).toHaveTextContent('OLD-MODEL');
    expect(axios.post.mock.calls.some(([url]) => url.endsWith('/w/process'))).toBe(false);
    fireEvent.change(screen.getByLabelText('제작증 PDF'), { target: { files: [file()] } });
    await screen.findByRole('dialog', { name: '제작증 반영 내용 확인' }); fireEvent.click(screen.getByRole('button', { name: '반영' }));
    expect(screen.getByLabelText('차 명')).toHaveTextContent('PDF-MODEL'); expect(screen.getByLabelText('차 명')).toHaveClass('w-auto');
    expect(screen.getByLabelText('소유자주소')).toHaveClass('w-auto');
    expect(axios.post.mock.calls.some(([url]) => url.endsWith('/w/process'))).toBe(false);
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: 'TEST-MEMO' } });
    fireEvent.change(screen.getByLabelText('등록증 이메일 아이디'), { target: { value: 'registration' } });
    fireEvent.change(screen.getByLabelText('등록증 이메일 도메인'), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장되었습니다.');
    const [, body] = axios.post.mock.calls.find(([url]) => url.endsWith('/w/process'));
    expect(body.get('productionCertificate').name).toBe('production.pdf');
    const request = await readBlob(body.get('request'));
    expect(request.dsNewCar).toMatchObject({ MEMO_TX: 'TEST-MEMO', CARP_MAIL: 'registration@example.com' });
    expect(mockNavigate).toHaveBeenCalledWith('/newcar/newcar-request-w', { replace: true, state: { receiptNo: 'TEST-SERVICE' } });
});
test('다른 차대번호 PDF를 반영하지 않고 신청 필수 오류를 해당 입력으로 안내한다', async () => {
    await renderReady();
    axios.post.mockResolvedValueOnce({ data: { success: true, data: { carIdNo: 'BBBBBBBBBBBBBBBBB' } } });
    fireEvent.change(screen.getByLabelText('제작증 PDF'), { target: { files: [file()] } });
    await screen.findByText('현재 신청과 제작증의 차대번호가 다릅니다.');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByLabelText('차 명')).toHaveTextContent('OLD-MODEL');
    fireEvent.click(screen.getByRole('button', { name: '신청' }));
    await screen.findByText('등록예정일자를(을) 입력해 주세요.');
    expect(axios.post.mock.calls.some(([url]) => url.endsWith('/w/process'))).toBe(false);
});
test('저장 실패 후 입력과 저장 대기 PDF를 유지해 재시도할 수 있다', async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText('제작증 PDF'), { target: { files: [file()] } });
    await screen.findByRole('dialog', { name: '제작증 반영 내용 확인' }); fireEvent.click(screen.getByRole('button', { name: '반영' }));
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: 'KEEP-ME' } });
    axios.post.mockRejectedValueOnce({ response: { data: { message: 'TEST-SAVE-FAILED' } } });
    fireEvent.click(screen.getByRole('button', { name: '저장' })); await screen.findByText('TEST-SAVE-FAILED');
    expect(screen.getByLabelText('메모')).toHaveValue('KEEP-ME'); expect(screen.getByText('저장 대기 제작증: production.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
});
test('신청·심사 상태는 공동소유자 비율에 상관없이 편집과 업로드를 차단한다', async () => {
    const data = original(); data.dsService.PROC_ST = 'P_REQ'; data.dsNewCar.RATIO_NO = '99';
    axios.get.mockResolvedValue({ data: { success: true, data } });
    render(<NewcarRequest_W />); await waitFor(() => expect(screen.getByLabelText('차 명')).toHaveTextContent('OLD-MODEL'));
    expect(screen.getByLabelText('공동소유자명')).toHaveAttribute('readonly');
    expect(screen.getByRole('checkbox', { name: '등록증 배송지를 소유자주소와 동일하게' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '제작증 업로드' })).toBeDisabled(); expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});
test('증빙 입력은 별도 팝업에서 작성하고 저장 시 기존 데이터셋으로 전달한다', async () => {
    await renderReady(); fireEvent.click(screen.getByRole('button', { name: '세금계산서/현금영수증 정보' }));
    fireEvent.change(screen.getByLabelText('증빙 종류'), { target: { value: 'CASH' } });
    fireEvent.change(screen.getByLabelText('현금영수증 휴대폰번호'), { target: { value: '01000000000' } });
    fireEvent.click(screen.getByRole('dialog').querySelector('button'));
    fireEvent.click(screen.getByRole('button', { name: '저장' })); await screen.findByText('저장되었습니다.');
    const request = await readBlob(axios.post.mock.calls.find(([url]) => url.endsWith('/w/process'))[1].get('request'));
    expect(request.dsTaxReceipt).toMatchObject({ GUBUN: 'CASH', PHONE_NO: '01000000000' });
    expect(request.dsNewCar.CARP_MAIL).toBe('');
});
test('등록증은 접수번호 권한 API로 조회하고 닫으면 임시 URL을 해제한다', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:test-paper'); URL.revokeObjectURL = jest.fn();
    await renderReady();
    axios.get.mockResolvedValueOnce({ data: new Blob(['%PDF-test'], { type: 'application/pdf' }) });
    fireEvent.click(screen.getByRole('button', { name: '등록증 확인' }));
    await screen.findByRole('dialog', { name: '등록증 확인' });
    expect(axios.get).toHaveBeenLastCalledWith('/api/newcar/w/carpaper', { params: { serviceId: 'TEST-SERVICE' }, responseType: 'blob' });
    expect(screen.getByTitle('자동차 등록증 PDF')).toHaveAttribute('src', 'blob:test-paper');
    fireEvent.click(screen.getByRole('dialog').querySelector('button'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-paper');
});
test('번호선택 후 저장할 때 작성 중인 메모도 보존한다', async () => {
    await renderReady(); fireEvent.change(screen.getByLabelText('메모'), { target: { value: 'UNSAVED-MEMO' } });
    fireEvent.click(screen.getByRole('button', { name: '번호선택' }));
    fireEvent.click(screen.getByRole('button', { name: '테스트 번호 선택 완료' }));
    await screen.findByText('저장되었습니다.');
    const request = await readBlob(axios.post.mock.calls.find(([url]) => url.endsWith('/w/process'))[1].get('request'));
    expect(request.dsNewCar).toMatchObject({ REQ_CAR_NO: 'TEST-PLATE', MEMO_TX: 'UNSAVED-MEMO' });
});
test('새 접수 저장 후 재조회 실패 시 생성된 접수번호를 유지한다', async () => {
    const view = original(); view.dsService.SERVICE_ID = '';
    axios.get.mockResolvedValueOnce({ data: { success: true, data: view } });
    await renderReady();
    axios.get.mockRejectedValueOnce(new Error('TEST-RELOAD-FAILED'));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('처리는 완료됐지만 다시 조회하지 못했습니다. 새로고침해 주세요.');
    expect(screen.getByLabelText('접수번호')).toHaveValue('TEST-SERVICE');
});
test('기존 접수도 제작증 대상 강조를 유지하고 잘못된 이메일 입력으로 이동한다', async () => {
    const view = original(); view.dsCarNoDetach = { FILENAME1: 'existing.pdf' };
    axios.get.mockResolvedValueOnce({ data: { success: true, data: view } });
    await renderReady();
    expect(screen.getByLabelText('차대번호')).toHaveClass('w-auto');
    fireEvent.change(screen.getByLabelText('등록증 이메일 아이디'), { target: { value: 'incomplete' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.getByLabelText('등록증 이메일 아이디')).toHaveFocus());
    expect(axios.post).not.toHaveBeenCalled();
});
