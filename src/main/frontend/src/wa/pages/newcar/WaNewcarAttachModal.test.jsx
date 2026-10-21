import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import WaNewcarAttachModal from './WaNewcarAttachModal';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('./WaSendSmsModal', () => () => null);
jest.mock('../../../utils/imageCompression', () => ({ compressImage: jest.fn() }));
jest.mock('../../../utils/utils', () => ({ gf: {} }));
jest.mock('../../../policy/attachPolicy', () => ({
    getAttachPolicy: () => ({ requiredDocs: [], duplicateMinorCodes: new Set(), needSign: false, needMinorDocs: false }),
    getNtaxAttachPolicy: () => ({ requiredDocs: [], optionalDocs: [], duplicateMinorCodes: new Set(), needSign: false }),
    NTAX_POLICY: {}, ETC_DOCS: [{ code: 'ETC', name: '기타 서류', gubun: 'ETC', seq: 1 }]
}));

beforeEach(() => { jest.clearAllMocks(); axios.get.mockResolvedValue({ data: { list: [] } }); });
const props = { open: true, dsService: { SERVICE_ID: 'TEST-SERVICE', PROC_ST: 'SAV' }, dsNewCar: {}, dsOwnerInfo: {}, dsCarNoDetach: {}, dsUserInfo: {}, onClose: jest.fn() };

test('W 조회 전용 모드는 첨부 조회를 유지하고 파일 변경·문자 발송을 막는다', async () => {
    const { container } = render(<WaNewcarAttachModal {...props} readOnly allowSms={false} />);
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    const file = document.body.querySelector('input[type=file]');
    expect(file).toBeDisabled();
    fireEvent.change(file, { target: { files: [new File(['test'], 'test.pdf', { type: 'application/pdf' })] } });
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.queryByText('관련 신청서 서명 및 파일업로드 링크 문자 발송')).toBeNull();
    expect(container).toBeDefined();
});
test('기존 호출은 기본값으로 업로드와 문자 버튼을 유지한다', async () => {
    render(<WaNewcarAttachModal {...props} />);
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(document.body.querySelector('input[type=file]')).toBeEnabled();
    expect(screen.getByText('관련 신청서 서명 및 파일업로드 링크 문자 발송')).toBeInTheDocument();
});
