import { Check, X } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';

import '../styles/CustomerPage.css';

const CustomerResult = () => {

    const { state } = useLocation();
	
	// state가 없으면 성공으로 처리
	const success = state?.success !== false;
	
	const [searchParams] = useSearchParams();
	const token = searchParams.get('t');
	const managerTel = searchParams.get('managerTel');
	
    return (
        <div className="customer-page">

            <div className="customer-card customer-result-card">

                <div
                    className="customer-result-icon"
                    style={{
                        background: success ? '#2196F3' : '#e53935'
                    }}
                >
                    {success
                        ? <Check size={44} strokeWidth={3} />
                        : <X size={44} strokeWidth={3} />
                    }
                </div>

                <h3 className="customer-result-title">
                    {success ? '요청이 완료되었습니다.' : '진행 불가'}
                </h3>

                <hr className="customer-result-divider" />

                <p className="customer-result-description">
                    {success ? (
                        <>
                            요청이 정상적으로 접수되었습니다.<br />
                            담당자가 확인 후 순차적으로 처리해 드릴 예정입니다.<br />
                            수정 및 문의사항은 담당 스페셜리스트 <span className="text-primary">({managerTel})</span>에게 연락 부탁드립니다. 
                        </>
                    ) : (
                        <>
                            유효하지 않은 접근이거나 신청 정보를 확인할 수 없습니다.<br />
							문자로 전달받은 주소로 다시 접속해 주세요.<br />
							문제가 계속되면 문자에 안내된 담당자에게 문의해 주시기 바랍니다.
                        </>
                    )}
                </p>

            </div>

        </div>
    );
};

export default CustomerResult;