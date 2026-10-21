import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import WaNewcarNumplateSelect from '../WaNewcarNumplateSelect';
import { createNumplateDiagnostics } from '../numplateDiagnostics';

jest.mock('axios', () => ({
    __esModule: true,
    default: Object.assign(jest.fn(), { post: jest.fn() })
}));
jest.mock('react-router-dom', () => ({
    useSearchParams: () => [new URLSearchParams('t=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')]
}), { virtual: true });
const ID = '11111111-1111-4111-8111-111111111111';
const localDate = date => [
    date.getFullYear(), '-', String(date.getMonth() + 1).padStart(2, '0'), '-',
    String(date.getDate()).padStart(2, '0'), ' ',
    String(date.getHours()).padStart(2, '0'), ':', String(date.getMinutes()).padStart(2, '0'),
    ':', String(date.getSeconds()).padStart(2, '0')
].join('');
const result = () => ({
    serviceId: 'TEST-SERVICE', selectionStarted: true, canStart: false, selectCount: 1,
    selectedCarNo: '', expiresAt: localDate(new Date(Date.now() + 300000)),
    carNos: [{ CAR_NO: 'TEST-PLATE', USE_YN: 'P' }],
    diagnostics: { diagnosticId: ID, serverTimeMs: Date.now() - 48000, dbTimeMs: Date.now() - 49000 }
});
const events = event => axios.post.mock.calls
    .filter(([url, body]) => url.endsWith('/diagnostics') && body.EVENT_CD === event)
    .map(([, body]) => body.DETAIL);

beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ status: 204 });
    axios.mockImplementation(config => Promise.resolve({
        status: 200, data: { result: config.url.endsWith('/actions') ? true : result() }
    }));
});
afterEach(() => { jest.useRealTimers(); });

test('선택 상태 반영 뒤 활성화 상태를 남기고 매초 로그를 쌓지 않는다', async () => {
    jest.useFakeTimers();
    render(<WaNewcarNumplateSelect />);
    const option = await screen.findByRole('radio', { name: 'TEST-PLATE' });
    expect(screen.getByRole('button', { name: '번호를 선택해 주세요' })).toBeDisabled();
    fireEvent.click(option);
    await waitFor(() => expect(screen.getByRole('button', { name: 'TEST-PLATE 선택하기' })).toBeEnabled());
    expect(events('NUMBER_STATE').at(-1)).toMatchObject({ hasSelected: true, disabled: false, loading: false });
    const count = events('BUTTON_STATE').length;
    act(() => { jest.advanceTimersByTime(5000); });
    expect(events('BUTTON_STATE')).toHaveLength(count);
    expect(JSON.stringify(axios.post.mock.calls)).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(events('API_END').some(event => event.responseDbTimeMs && event.responseServerTimeMs)).toBe(true);
});

test('브라우저 기준 조기 만료의 원문/파싱 시각과 사유를 남긴다', async () => {
    const expired = result();
    expired.expiresAt = localDate(new Date(Date.now() - 1000));
    axios.mockResolvedValue({ status: 200, data: { result: expired } });
    render(<WaNewcarNumplateSelect />);
    await screen.findByText('차량 번호가 선택되지 않았습니다');
    const state = events('BUTTON_STATE').find(event => event.expired);
    expect(state.disabledReasons).toContain('EXPIRED');
    expect(state.expiresAtRaw).toBe(expired.expiresAt);
    expect(state.expiresAtEpochMs).toBeLessThan(Date.now());
});

test('확정 요청 대기 시 선택 상태와 LOADING, 10초 지연을 기록한다', async () => {
    jest.useFakeTimers();
    let rejectConfirm;
    axios.mockImplementation(config => config.url.endsWith('/confirm')
        ? new Promise((resolve, reject) => { rejectConfirm = reject; })
        : Promise.resolve({ status: 200, data: { result: config.url.endsWith('/actions') ? true : result() } }));
    render(<WaNewcarNumplateSelect />);
    fireEvent.click(await screen.findByRole('radio', { name: 'TEST-PLATE' }));
    fireEvent.click(screen.getByRole('button', { name: 'TEST-PLATE 선택하기' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '처리 중' })).toBeDisabled());
    expect(events('BUTTON_STATE').at(-1)).toMatchObject({ loading: true, hasSelected: true, disabled: true });
    expect(events('BUTTON_STATE').at(-1).disabledReasons).toContain('LOADING');
    act(() => { jest.advanceTimersByTime(10000); });
    expect(events('API_PENDING').some(event => event.operation === 'CONFIRM')).toBe(true);
    await act(async () => { rejectConfirm({ name: 'AxiosError', response: { status: 500 } }); });
    expect(screen.getByRole('button', { name: 'TEST-PLATE 선택하기' })).toBeEnabled();
    expect(events('API_ERROR').at(-1)).toMatchObject({ operation: 'CONFIRM', httpStatus: 500 });
});

test('진단 전송 실패와 오류 원문이 업무 응답에 영향을 주지 않는다', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    axios.post.mockRejectedValue(new Error('test-only'));
    const diagnostics = createNumplateDiagnostics();
    const cleanup = diagnostics.listen();
    const response = await diagnostics.request('LOAD', { method: 'get', url: '/test-business' });
    expect(response.status).toBe(200);
    diagnostics.updateSnapshot({ loading: false });
    window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('secret-test-only'), message: 'secret-test-only' }));
    await Promise.resolve();
    expect(events('CLIENT_ERROR').at(-1)).toMatchObject({ errorName: 'TypeError', errorKind: 'SCRIPT_ERROR' });
    expect(JSON.stringify(axios.post.mock.calls)).not.toContain('secret-test-only');
    axios.post.mockImplementation(() => { throw new Error('synchronous-test-only'); });
    expect((await diagnostics.request('START', { method: 'post', url: '/test-business' })).status).toBe(200);
    cleanup();
    await Promise.resolve();
    warning.mockRestore();
});
