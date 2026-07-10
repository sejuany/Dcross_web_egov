import React, { useState } from 'react';
import './NewcarRequest.css';

const REQUIRED_DOCS = [
    {
        id: 'owner_id',
        title: '소유자 본인 서류',
        items: [
            { key: 'OWNER_ID_FRONT', label: '외국인 등록증' },
            { key: 'OWNER_ID_BACK', label: '장애인 증명서(복지카드)' },
        ],
    },
    {
        id: 'joint_owner',
        title: '공동소유자 서류',
        items: [
            { key: 'JOINT_OWNER_ID', label: '외국인 등록증' },
        ],
    },
    {
        id: 'car_docs',
        title: '차량 관련 서류',
        items: [
            { key: 'CAR_PROOF', label: '가족관계증명서(상세)' },
        ],
    },
];

const NewcarAttachModal = ({
    open,
    dsService,
    dsNewCar,
    onClose,
    onOpenSmsModal,
}) => {
    const [selectedFiles, setSelectedFiles] = useState({});

    if (!open) {
        return null;
    }

    const serviceId = dsService?.SERVICE_ID || '';
    const ownerName = dsNewCar?.OWNER_NM || '';
    const carIdNo = dsNewCar?.CARID_NO || '';

    const handleFileChange = (docKey, event) => {
        const file = event.target.files?.[0] || null;

        setSelectedFiles(prev => ({
            ...prev,
            [docKey]: file,
        }));
    };

    const handleDummyUpload = () => {
        alert('우선 팝업 테스트 단계입니다. 실제 업로드 API는 다음 단계에서 연결하면 됩니다.');
    };

    return (
        <div className="newcar-attach-overlay">
            <div className="newcar-attach-modal">
                <div className="newcar-attach-header">
                    <div>
                        <h3>첨부 서류 업로드</h3>
                        <p>
                            접수번호 {serviceId || '-'}
                            {ownerName ? ` / ${ownerName}` : ''}
                            {carIdNo ? ` / ${carIdNo}` : ''}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="newcar-attach-close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="newcar-attach-body">
                    <div className="newcar-attach-left">
                        {REQUIRED_DOCS.map(group => (
                            <section className="newcar-attach-group" key={group.id}>
                                <div className="newcar-attach-group-title">
                                    {group.title}
                                    <span className="newcar-attach-check">✓</span>
                                </div>

                                <div className="newcar-attach-doc-grid">
                                    {group.items.map(item => (
                                        <label
                                            className="newcar-attach-doc-card"
                                            key={item.key}
                                        >
                                            <input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={(event) => handleFileChange(item.key, event)}
                                            />

                                            <div className="newcar-attach-thumb">
                                                {selectedFiles[item.key] ? (
                                                    <span className="newcar-attach-file-name">
                                                        {selectedFiles[item.key].name}
                                                    </span>
                                                ) : (
                                                    <span className="newcar-attach-empty">
                                                        첨부
                                                    </span>
                                                )}
                                            </div>

                                            <strong>{item.label}</strong>
                                            <span className="newcar-attach-select-btn">
                                                파일선택
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </section>
                        ))}

                        <button
                            type="button"
                            className="newcar-attach-mail-btn"
                            onClick={handleDummyUpload}
                        >
                            첨부 서류 저장
                        </button>
                    </div>

                    <div className="newcar-attach-right">
                        <section className="newcar-attach-sms-panel">
                            <div className="newcar-attach-sms-title">
                                서명 및 파일 업로드 링크 발송
                            </div>

                            <p>
                                고객 휴대폰번호로 서명 및 첨부서류 업로드 링크를 발송합니다.
                                실제 문자 발송 기능은 다음 단계에서 API와 연결하면 됩니다.
                            </p>

                            <button
                                type="button"
                                className="newcar-attach-sms-open-btn"
                                onClick={onOpenSmsModal}
                            >
                                문자발송 팝업 열기
                            </button>
                        </section>
                    </div>
                </div>

                <div className="newcar-attach-footer">
                    <button
                        type="button"
                        className="btn-erp light"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewcarAttachModal;