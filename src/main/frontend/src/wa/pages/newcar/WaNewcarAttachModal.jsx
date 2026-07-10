import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { X, FileText, Mail } from 'lucide-react';
import '../../styles/WaNewcarRequest.css';

const ATTACH_DOCS = [
    { seq: 0, key: 'FOREIGN_ID', label: '외국인 등록증' },
    { seq: 1, key: 'DISABILITY_CERT', label: '장애인 증명서(복지카드)' },
    { seq: 2, key: 'RESIDENT_CERT', label: '주민등록등본' },
    { seq: 3, key: 'FAMILY_CERT', label: '가족관계증명서' },
];

const getValue = (row, ...keys) => {
    if (!row) return '';

    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
            return row[key];
        }
    }

    return '';
};

const isImageFile = (fileName = '') => {
    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
};

const WaNewcarAttachModal = ({
    open,
    dsService,
    dsNewCar,
    onClose,
    onOpenSmsModal,
}) => {
    const fileInputRefs = useRef({});
    const [attachFiles, setAttachFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadingSeq, setUploadingSeq] = useState(null);

    const serviceId = dsService?.SERVICE_ID || dsService?.serviceId || '';

    const attachFileMap = useMemo(() => {
        const map = {};

        attachFiles.forEach(file => {
            const seq = String(getValue(file, 'SEQ', 'seq'));
            map[seq] = file;
        });

        return map;
    }, [attachFiles]);

    const loadAttachFiles = async () => {
        if (!serviceId) {
            setAttachFiles([]);
            return;
        }

        setLoading(true);

        try {
            const res = await axios.get('/api/newcar/wa-attach-files', {
                params: { serviceId },
            });

            const list = Array.isArray(res.data?.list)
                ? res.data.list
                : [];

            setAttachFiles(list);
        } catch (error) {
            console.error('[WaNewcarAttachModal] 첨부파일 조회 실패:', error);
            alert('첨부파일 조회 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        loadAttachFiles();
    }, [open, serviceId]);

    if (!open) {
        return null;
    }

    const handleSelectFile = (seq) => {
        if (!serviceId) {
            alert('저장 후 첨부파일을 등록할 수 있습니다.');
            return;
        }

        fileInputRefs.current[seq]?.click();
    };

    const handleFileChange = async (doc, event) => {
        const file = event.target.files?.[0];

        event.target.value = '';

        if (!file) {
            return;
        }

        if (!serviceId) {
            alert('저장 후 첨부파일을 등록할 수 있습니다.');
            return;
        }

        const formData = new FormData();
        formData.append('serviceId', serviceId);
        formData.append('seq', doc.seq);
        formData.append('file', file);

        setUploadingSeq(doc.seq);

        try {
            const res = await axios.post('/api/newcar/wa-attach-file', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const list = Array.isArray(res.data?.list)
                ? res.data.list
                : [];

            setAttachFiles(list);
        } catch (error) {
            console.error('[WaNewcarAttachModal] 첨부파일 업로드 실패:', error);

            const message =
                error.response?.data?.message ||
                error.response?.data?.error ||
                '첨부파일 업로드 중 오류가 발생했습니다.';

            alert(message);
        } finally {
            setUploadingSeq(null);
        }
    };

    const handleOpenFile = (file) => {
        const fileUrl = getValue(file, 'FILE_URL', 'fileUrl');

        if (!fileUrl) {
            return;
        }

        window.open(fileUrl, '_blank');
    };

    const renderThumb = (doc) => {
        const file = attachFileMap[String(doc.seq)];
        const fileUrl = getValue(file, 'FILE_URL', 'fileUrl');
        const fileName = getValue(file, 'ATCHFILE_NM', 'atchFileNm');

        if (fileUrl && isImageFile(fileName)) {
            return (
                <img
                    src={fileUrl}
                    alt={doc.label}
                    className="wa-attach-preview-img"
                />
            );
        }

        if (fileUrl) {
            return <FileText size={28} />;
        }

        return <FileText size={28} />;
    };

    return (
        <div className="wa-attach-modal-backdrop">
            <div className="wa-attach-modal">
                <div className="wa-attach-modal-header">
                    <div>
                        <h3>첨부 서류 업로드</h3>
                    </div>

                    <button
                        type="button"
                        className="wa-attach-modal-close"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="wa-attach-modal-body single">
                    <section className="wa-attach-doc-section">
                        <div className="wa-attach-doc-line">
                            <span className="wa-attach-doc-label">소유자 확인 서류</span>
                            <span className="wa-attach-doc-state">외국인 등록증</span>
                            <span className="wa-attach-doc-check">✓</span>
                        </div>

                        <div className="wa-attach-doc-line">
                            <span className="wa-attach-doc-label">감면 증빙 서류</span>
                            <span className="wa-attach-doc-state">장애인 증명서(복지카드)</span>
                            <span className="wa-attach-doc-check">✓</span>
                        </div>

                        <div className="wa-attach-doc-line sub">
                            <span></span>
                            <span>주민등록등본</span>
                        </div>

                        <div className="wa-attach-doc-line sub blue">
                            <span></span>
                            <strong>가족관계증명서(상세) {'{주민번호 표시, 3개월 이내 발급분}'}</strong>
                        </div>

                        <div className="wa-attach-doc-line sub blue">
                            <span></span>
                            <strong>자동차 감면 신청서류 확인 사항 필요</strong>
                        </div>

                        <p className="wa-attach-guide">
                            ※ 첨부는 사진을 클릭하여 업로드할 수 있습니다.
                        </p>

                        {loading && (
                            <div className="wa-attach-loading">
                                첨부파일 조회 중...
                            </div>
                        )}

                        <div className="wa-attach-doc-grid">
                            {ATTACH_DOCS.map((doc) => {
                                const file = attachFileMap[String(doc.seq)];
                                const fileName = getValue(file, 'ATCHFILE_NM', 'atchFileNm');
                                const hasFile = !!file;

                                return (
                                    <div className="wa-attach-doc-card" key={doc.key}>
                                        <input
                                            ref={(el) => {
                                                fileInputRefs.current[doc.seq] = el;
                                            }}
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={(event) => handleFileChange(doc, event)}
                                        />

                                        <button
                                            type="button"
                                            className={`wa-attach-doc-thumb ${hasFile ? 'has-file' : ''}`}
                                            onClick={() => hasFile ? handleOpenFile(file) : handleSelectFile(doc.seq)}
                                        >
                                            {renderThumb(doc)}
                                        </button>

                                        <strong>{doc.label}</strong>

                                        {hasFile && (
                                            <span
                                                className="wa-attach-file-name"
                                                title={fileName}
                                            >
                                                {fileName}
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            className="wa-attach-file-btn"
                                            onClick={() => handleSelectFile(doc.seq)}
                                            disabled={uploadingSeq === doc.seq}
                                        >
                                            {uploadingSeq === doc.seq ? '업로드중' : hasFile ? '파일변경' : '파일첨부'}
                                        </button>
                                    </div>
                                );
                            })}

                            <div className="wa-attach-doc-card empty-card">
                                <div className="wa-attach-doc-thumb empty">
                                    첨부
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="wa-attach-link-btn"
                            onClick={onOpenSmsModal}
                        >
                            <Mail size={16} />
                            관련 신청서 서명 및 파일업로드 링크 문자 발송
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default WaNewcarAttachModal;