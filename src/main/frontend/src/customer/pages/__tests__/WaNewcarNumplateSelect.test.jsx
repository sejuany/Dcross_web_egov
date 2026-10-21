import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import html2canvas from 'html2canvas';
import WaNewcarNumplateSelect from '../WaNewcarNumplateSelect';

jest.mock('axios', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('html2canvas', () => jest.fn());
jest.mock('react-router-dom', () => ({
    useSearchParams: () => [new URLSearchParams('t=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')]
}), { virtual: true });

const result = () => ({
    serviceId: 'TEST-SERVICE', selectionStarted: true, canStart: false, selectCount: 1,
    selectedCarNo: '', expiresAt: new Date(Date.now() + 300000).toISOString(),
    carNos: [{ CAR_NO: 'TEST-PLATE', USE_YN: 'P' }]
});
const actionEvents = () => axios.mock.calls
    .filter(([config]) => config.url.endsWith('/actions')).map(([config]) => config.data.EVENT_CD);

beforeEach(() => {
    jest.clearAllMocks();
    html2canvas.mockReset();
    axios.mockImplementation(config => Promise.resolve({
        status: 200, data: { result: config.url.endsWith('/actions') ? true : result() }
    }));
});
afterEach(() => jest.useRealTimers());

test('선택/확인창 열림/취소만 기록하고 화면 이벤트·타이머·종료 시 진단을 보내지 않는다', async () => {
    jest.useFakeTimers();
    const view = render(<WaNewcarNumplateSelect />);
    fireEvent.click(await screen.findByRole('radio', { name: 'TEST-PLATE' }));
    expect(screen.getByRole('button', { name: 'TEST-PLATE 선택하기' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'TEST-PLATE 선택하기' }));
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(actionEvents()).toEqual(['NUMBER_CLICK', 'CONFIRM_OPEN', 'CONFIRM_CANCEL']);
    const calls = axios.mock.calls.length;
    act(() => {
        jest.advanceTimersByTime(10000);
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('online'));
        document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByRole('button', { name: '오류제출' })).toBeEnabled();
    view.unmount();
    expect(axios).toHaveBeenCalledTimes(calls);
    expect(axios.mock.calls.some(([config]) => /diagnostics|report/.test(config.url))).toBe(false);
});

test('확정 대기나 실패에도 자동 진단과 업무 재요청 없이 선택 상태를 유지한다', async () => {
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
    act(() => jest.advanceTimersByTime(10000));
    await act(async () => rejectConfirm({ response: { status: 500 } }));
    expect(screen.getByRole('button', { name: 'TEST-PLATE 선택하기' })).toBeEnabled();
    expect(axios.mock.calls.filter(([config]) => config.url.endsWith('/confirm'))).toHaveLength(1);
    expect(actionEvents()).toEqual(['NUMBER_CLICK', 'CONFIRM_OPEN']);
    expect(axios.mock.calls.some(([config]) => /diagnostics|report/.test(config.url))).toBe(false);
});

test('고객이 오류제출을 누르면 축소 영역 밖 팝업에서 캡쳐와 내용을 전송한다', async () => {
    const image = 'data:image/png;base64,test-only';
    html2canvas.mockResolvedValue({ toDataURL: () => image });
    render(<WaNewcarNumplateSelect />);
    fireEvent.click(await screen.findByRole('radio', { name: 'TEST-PLATE' }));
    fireEvent.click(screen.getByRole('button', { name: '오류제출' }));
    const dialog = screen.getByRole('dialog', { name: '오류 제출' });
    expect(dialog.closest('.numplate-card-content')).toBeNull();
    expect(dialog.closest('.numplate-customer-card')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('어떤 현상인가요?'), { target: { value: 'TEST-SYMPTOM' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    const success = await screen.findByRole('dialog', { name: '오류 접수 완료' });
    expect(success.closest('.numplate-card-content')).toBeNull();
    expect(axios.mock.calls.filter(([config]) => config.url.endsWith('/report')).map(([config]) => config.data))
        .toEqual([{ TOKEN: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', CAR_NO: 'TEST-PLATE', SYMPTOM: 'TEST-SYMPTOM', FEATURE: '', IMAGE: image }]);
    expect(html2canvas.mock.calls[0][1].ignoreElements(dialog.parentElement)).toBe(true);
    expect(axios.mock.calls.some(([config]) => config.url.endsWith('/diagnostics'))).toBe(false);
});

test('캡쳐 실패 시 입력을 유지하고 자동 진단 없이 오류제출을 재시도한다', async () => {
    html2canvas.mockRejectedValue(new Error('test-only'));
    render(<WaNewcarNumplateSelect />);
    await screen.findByRole('radio', { name: 'TEST-PLATE' });
    fireEvent.click(screen.getByRole('button', { name: '오류제출' }));
    fireEvent.change(screen.getByLabelText('어떤 현상인가요?'), { target: { value: 'TEST-SYMPTOM' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    await screen.findByText('화면을 캡쳐하지 못했습니다. 새로고침 후 다시 제출해 주세요.');
    expect(screen.getByRole('button', { name: '제출' })).toBeEnabled();
    expect(screen.getByLabelText('어떤 현상인가요?')).toHaveValue('TEST-SYMPTOM');
    expect(axios.mock.calls.some(([config]) => /diagnostics|report/.test(config.url))).toBe(false);
    html2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,test-only' });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    await screen.findByRole('dialog', { name: '오류 접수 완료' });
    expect(axios.mock.calls.filter(([config]) => config.url.endsWith('/report'))).toHaveLength(1);
    expect(axios.mock.calls.some(([config]) => config.url.endsWith('/diagnostics'))).toBe(false);
});
