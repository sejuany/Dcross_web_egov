import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { X, FileText, Mail, RefreshCw } from 'lucide-react';
import '../../styles/WaNewcarRequest.css';

// 용량 및 해상도 조절 
import { compressImage } from '../../../utils/imageCompression';
import { gf } from '../../../utils/utils';

// 문자전송 모달
import WaSendSmsModal from './WaSendSmsModal';

// 파일 업로드 정책 가져오기
import {
    getAttachPolicy,
    getNtaxAttachPolicy,
	NTAX_POLICY
} from '../../../policy/attachPolicy';


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
	dsCarNoDetach,
	setDsCarNoDetach,
	dsUserInfo,
    onClose,
    onOpenSmsModal,
	saveProcess
}) => {
    const fileInputRefs = useRef({});
    const [attachFiles, setAttachFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    // 파일 업로드 코드 
	const [uploadingCode, setUploadingCode] = useState(null);
	// 문자 전송 모달  
	const [smsModalOpen, setSmsModalOpen] = useState(false);
	// 서비스 아이디 
    const serviceId = dsService?.SERVICE_ID || dsService?.serviceId || '';
	
	
	// 일반 첨부 정책
	const attachPolicy = useMemo(
	    () => getAttachPolicy(dsNewCar),
	    [dsNewCar]
	);
	
	// 지방세 감면 신청서 서명 여부
	const { needSign, needUpload } = attachPolicy;
	
	// 소유자 확인 서류 리스트(화면용) 
	const ownerDocs = useMemo(
	    () => attachPolicy.requiredDocs,
	    [attachPolicy]
	);

	// 비과세 정책
	const ntaxPolicy = useMemo(
	    () => getNtaxAttachPolicy(dsNewCar),
	    [dsNewCar]
	);
	
	// 감면 서류 리스트(화면용)
	const ntaxDocs = useMemo(
	    () => ntaxPolicy.requiredDocs,
	    [ntaxPolicy]
	);

	// 화면에 보여줄 전체 서류(순서 유지용)
	const displayDocs = useMemo(
	    () => [...ownerDocs, ...ntaxDocs].sort((a, b) => a.seq - b.seq),
	    [ownerDocs, ntaxDocs]
	);

	// 코드별 업로드 파일 조회용 Map 생성
	const attachFileMap = useMemo(() => {
	    const map = {};

	    attachFiles.forEach(file => {
	        const code = getValue(file, 'CODE', 'code');
		
	        if (code) {
	            map[code] = file;
	        }
	    });

	    return map;
	}, [attachFiles]);

	// 전자서명 완료 여부
	const hasSign = useMemo(() => {
	    return attachFiles.some(file => file.CODE === 'SIGN');
	}, [attachFiles]);
	
	// 첨부파일 목록 조회
	const loadAttachFiles = useCallback(async () => {
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

			console.log("attachFiles", list);
			console.log("attachFiles.length", list.length);
        } catch (error) {
            console.error('[WaNewcarAttachModal] 첨부파일 조회 실패:', error);
            alert('첨부파일 조회 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [serviceId]);

	// 팝업이 열리면 첨부파일 조회
	useEffect(() => {
	    if (!open) return;
	    loadAttachFiles();
	}, [open, loadAttachFiles]);

    if (!open) {
        return null;
    }

	// 파일 선택창 열기
    const handleSelectFile = (code) => {
        if (!serviceId) {
            alert('저장 후 첨부파일을 등록할 수 있습니다.');
            return;
        }

        fileInputRefs.current[code]?.click();
    };

	// 첨부파일 업로드
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

		// 업로드 중 표시
		setUploadingCode(doc.code);
		
		// 이미지 압축(PDF는 원본 사용)
		const uploadFile = await compressImage(file);
		
        const formData = new FormData();
        formData.append('serviceId', serviceId);
		
		// req 대신 파일 코드명을 보낸다
		// ex. {서비스아이디}_{파일코드명}.{확장자}
		formData.append('code', doc.code);
		formData.append('gubun', doc.gubun);
		
		// 한글 파일명을 같이 보냄
		formData.append('docName', doc.name);
		
		// 압축된 파일 업로드
		formData.append('file', uploadFile);
		
        try {
            const res = await axios.post('/api/newcar/wa-attach-upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const list = Array.isArray(res.data?.list)
                ? res.data.list
                : [];

            setAttachFiles(list);
			
			await gf.alert('첨부파일 업로드가 완료되었습니다.');
			
        } catch (error) {
            console.error('[WaNewcarAttachModal] 첨부파일 업로드 실패:', error);

            const message =
                error.response?.data?.message ||
                error.response?.data?.error ||
                '첨부파일 업로드 중 오류가 발생했습니다.';

            alert(message);
        } finally {
            setUploadingCode(null);
        }
    };

	// 업로드된 파일 열기
    const handleOpenFile = (file) => {
        const fileUrl = getValue(file, 'FILE_URL', 'fileUrl');

        if (!fileUrl) {
            return;
        }

        window.open(fileUrl, '_blank');
    };

	// 첨부파일 썸네일 표시
    const renderThumb = (doc) => {
        const file = attachFileMap[doc.code];
        const fileUrl = getValue(file, 'FILE_URL', 'fileUrl');
        const fileName = getValue(file, 'ATCHFILE_NM', 'atchFileNm');

		if (!fileUrl) {
		    return <FileText size={28} />;
		}

		if (isImageFile(fileName)) {
		    return (
		        <img
		            src={`${fileUrl}&t=${Date.now()}`}
		            alt={doc.name}
		            className="wa-attach-preview-img"
		        />
		    );
		}

		return <FileText size={28} />;
    };

	// PDF 재생성 버튼
	const handleMergePdf = async () => {

	    const target =
	        attachPolicy.needSign && attachPolicy.needMinorDocs
	            ? '감면신청서와 미성년자 확인서류를'
	            : attachPolicy.needSign
	                ? '감면신청서를'
	                : '미성년자 확인서류를';

	    const ok = await gf.confirm(
	        `${target} 다시 생성하시겠습니까?`,
	        'PDF 재생성'
	    );

	    if (!ok) {
	        return;
	    }

	    const startTime = Date.now();
	    setLoading(true);

	    try {

	        let dsExemption = null;

	        // 감면신청서 데이터 생성
	        if (attachPolicy.needSign) {

	            const ntaxReason =
	                NTAX_POLICY[dsNewCar.NTAX_TRGET_CD]?.NAME || '';

	            const ntaxDocuments =
	                (ntaxPolicy.requiredDocs || [])
	                    .map(doc => doc.name)
	                    .join(', ');

	            dsExemption = {
	                REASON: ntaxReason,
	                DOCUMENT: ntaxDocuments
	            };

	            await axios.post('/api/attach/merge-pdf', {
	                SERVICE_ID: dsService.SERVICE_ID,
	                EXEMPTION: dsExemption
	            });
	        }

	        // 미성년자 확인서류 병합
	        if (attachPolicy.needMinorDocs) {
	            await axios.post('/api/attach/minor-merge-pdf', {
	                SERVICE_ID: dsService.SERVICE_ID
	            });
	        }

	        gf.alert(`${target} 다시 생성했습니다.`);

	    } finally {
	        gf.loadingDelay(startTime, () => setLoading(false));
	    }
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
		
						{// 제출해야 하는 서류 목록
						 displayDocs.map((doc, index) => {
	
							// 현재 서류 업로드 여부
						    const file = attachFileMap[doc.code];
						    const hasFile = !!file;
							// 이전 서류(감면 서류 제목 출력용)
						    const prevDoc = displayDocs[index - 1];
	
						    return (
						        <div
						            key={doc.code}
						            className={`wa-attach-doc-line ${hasFile ? 'uploaded' : ''}`}
						        >
						            <span className="wa-attach-doc-label">
						                {index === 0 && '소유자 확인 서류'}
	
						                {index > 0 &&
						                    doc.gubun === 'MERGE' &&
						                    prevDoc?.gubun !== 'MERGE' &&
						                    '감면 증빙 서류'}
						            </span>
	
						            <span className="wa-attach-doc-state">
						                {doc.name}
						            </span>
	
						            <span className="wa-attach-doc-check">
						                {hasFile && '✓'}
						            </span>
									
						        </div>
						    );
						})}
						
						{/* 감면 증빙 안내 */}
						{(ntaxDocs.length > 0 || needSign) && (
							<div
							    className={`wa-attach-doc-line sub ${hasSign ? 'uploaded' : 'blue'}`}
							>
							    <span></span>

							    <span className="wa-attach-doc-state">
							        지방세 감면 신청사항 확인 서명 필요
							    </span>

							    <span className="wa-attach-doc-check">
							        {hasSign && '✓'}
							    </span>
							</div>
						)}
						
						<hr className="wa-divider upload" />
						
                        <p className="wa-attach-guide">
                            ※ 첨부는 사진을 클릭하여 업로드할 수 있습니다.
                        </p>

                        {loading && (
                            <div className="wa-attach-loading">
                                첨부파일 조회 중...
                            </div>
                        )}

                        <div className="wa-attach-doc-grid">
                            {// 첨부파일 업로드 영역
							 displayDocs.map((doc) => {
								
                                const file = attachFileMap[doc.code];
                                const fileName = getValue(file, 'ATCHFILE_NM', 'atchFileNm');
                                const hasFile = !!file;

                                return (
                                    <div className="wa-attach-doc-card" key={doc.code}>
                                        <input
                                            ref={(el) => {
												fileInputRefs.current[doc.code] = el;
                                            }}
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={(event) => handleFileChange(doc, event)}
                                        />

                                        <button
                                            type="button"
                                            className={`wa-attach-doc-thumb ${hasFile ? 'has-file' : ''}`}
                                            onClick={() => hasFile ? handleOpenFile(file) : handleSelectFile(doc.code)}
                                        >
                                            {renderThumb(doc)}
                                        </button>

                                        <strong>{doc.name}</strong>

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
											onClick={() => handleSelectFile(doc.code)}
                                            disabled={uploadingCode === doc.code}
                                        >
                                            {uploadingCode === doc.code ? '업로드중' : hasFile ? '파일변경' : '파일첨부'}
                                        </button>
                                    </div>
                                );
                            })}

                        </div>
						<div className="wa-attach-btn-div">
							<button
	                            type="button"
	                            className="wa-attach-link-btn"
								onClick={() => setSmsModalOpen(true)}
	                        >
	                            <Mail size={16} />
	                            관련 신청서 서명 및 파일업로드 링크 문자 발송
	                        </button>
							
							{((attachPolicy.needSign || attachPolicy.needMinorDocs) &&
								// 필요한 경우 더 추가 
							    ['END', 'W_REQ', 'REQ', 'S_REQ', 'S_END'].includes(dsService.PROC_ST)) && (
							    <button
							        type="button"
							        className="wa-attach-merge-btn"
							        onClick={handleMergePdf}
							    >
							        <RefreshCw size={15} style={{ marginRight: '3px' }} />
							        {attachPolicy.needSign && attachPolicy.needMinorDocs
							            ? 'PDF 재생성'
							            : attachPolicy.needSign
							                ? '감면신청서 재생성'
							                : '미성년자 확인서류 재생성'}
							    </button>
							)}
						</div>
                        
						<WaSendSmsModal
							dsService={dsService}
						    dsNewCar={dsNewCar}
							dsCarNoDetach={dsCarNoDetach}
							setDsCarNoDetach={setDsCarNoDetach}
							dsUserInfo={dsUserInfo}
							saveProcess={saveProcess}
						    open={smsModalOpen}
						    onClose={() => setSmsModalOpen(false)}
						/>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default WaNewcarAttachModal;