import React, { useMemo, useState } from 'react';
import { Send, X } from 'lucide-react';
import '../../styles/WaNewcarRequest.css';

const splitPhone = (value) => {
    const onlyNumber = String(value || '').replace(/\D/g, '');

    return {
        hp1: onlyNumber.substring(0, 3),
        hp2: onlyNumber.substring(3, 7),
        hp3: onlyNumber.substring(7, 11),
    };
};

const WaSendSmsModal = ({
    open,
    dsNewCar,
    onClose,
}) => {
    const initialPhone = useMemo(() => splitPhone(dsNewCar?.MPHONE_NO), [dsNewCar?.MPHONE_NO]);

    const [phone, setPhone] = useState(initialPhone);

    if (!open) {
        return null;
    }

    const handleChange = (name, value) => {
        const onlyNumber = value.replace(/\D/g, '');

        setPhone(prev => ({
            ...prev,
            [name]: onlyNumber,
        }));
    };

    const handleSend = () => {
        const fullPhone = `${phone.hp1}${phone.hp2}${phone.hp3}`;

        if (fullPhone.length < 10) {
            alert('휴대폰번호를 확인해주세요.');
            return;
        }

        alert('우선 문자발송 팝업 테스트입니다. 실제 문자 API는 다음 단계에서 연결하면 됩니다.');
    };

    return (
        <div className="wa-sms-modal-backdrop">
            <div className="wa-sms-modal">
                <div className="wa-sms-modal-header">
                    <div>
                        <h3>서명 및 파일 업로드 링크 발송</h3>
                        <p>아래 번호로 서명 및 파일 업로드 링크를 발송합니다.</p>
                    </div>

                    <button
                        type="button"
                        className="wa-sms-modal-close"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="wa-sms-modal-body">
                    <div className="wa-sms-phone-row">
                        <input
                            value={phone.hp1}
                            maxLength={3}
                            onChange={(event) => handleChange('hp1', event.target.value)}
                        />
                        <span>-</span>
                        <input
                            value={phone.hp2}
                            maxLength={4}
                            onChange={(event) => handleChange('hp2', event.target.value)}
                        />
                        <span>-</span>
                        <input
                            value={phone.hp3}
                            maxLength={4}
                            onChange={(event) => handleChange('hp3', event.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        className="wa-sms-send-btn"
                        onClick={handleSend}
                    >
                        <Send size={16} />
                        발송
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WaSendSmsModal;