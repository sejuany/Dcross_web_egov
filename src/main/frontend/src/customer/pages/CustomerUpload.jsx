import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, LoaderCircle } from 'lucide-react';

import axios from 'axios';

import '../styles/CustomerPage.css';

// 공통
import { gf, log } from '../../utils/utils';

import {
	getAttachPolicy,
	getNtaxAttachPolicy,
	ETC_DOCS
} from '../../policy/attachPolicy';


const CustomerUpload = () => {

	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const token = searchParams.get('t');
	
	// 신청 정보
	const [info, setInfo] = useState(null);
	// 공동 소유자 정보
	const [ownerInfo, setOwnerInfo] = useState({});
	
	// 서비스 아이디
	const [serviceId, setServiceId] = useState('');

	// 차량번호
	const [carNo, setCarNo] = useState('');

	// 담당자 연락처
	const [managerTel, setManagerTel] = useState('');

	// 업로드된 첨부파일 목록
	const [attachFiles, setAttachFiles] = useState([]);
	
	// 파일 input 참조
	const fileInputRefs = useRef({});
	
	// 이미지 모달
	const [previewFile, setPreviewFile] = useState(null);
	
	// 로딩 상태
	const [loading, setLoading] = useState(false);
	
	// 썸네일 버전 (이미지 변경 시 갱신)
	const [thumbVersion, setThumbVersion] = useState(0);
	
	useEffect(() => {
	    loadData();
	}, []);
	
	const attachPolicy = useMemo(
	    () => getAttachPolicy(info, ownerInfo),
	    [info, ownerInfo]
	);

	const ntaxPolicy = useMemo(
	    () => getNtaxAttachPolicy(info, ownerInfo),
	    [info, ownerInfo]
	);

	// 필수/선택 첨부서류 목록 생성
	const uploadList = useMemo(() => {

		// 일반 첨부서류와 비과세 첨부서류의 필수/선택 서류를 모두 포함
	    const docs = [
	        ...attachPolicy.requiredDocs,
	        ...ntaxPolicy.requiredDocs,
			...ntaxPolicy.optionalDocs,
			ETC_DOCS[0]
	    ];

		// 동일한 서류는 CODE 기준으로 중복 제거 후 표시 순서대로 정렬
	    return Array.from(
	        new Map(docs.map(doc => [doc.code, doc])).values()
	    ).sort((a, b) => a.seq - b.seq);

	}, [attachPolicy, ntaxPolicy]);

	const getValue = (row, ...keys) => {
	    if (!row) return '';

	    for (const key of keys) {
	        if (row[key] !== undefined && row[key] !== null) {
	            return row[key];
	        }
	    }

	    return '';
	};

	// CODE 기준으로 빠르게 조회하기 위한 Map
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
	
	const isImageFile = (fileName = '') => {
	    return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
	};

	// 첨부파일 썸네일 표시
	const renderThumb = (doc) => {

	    const file = attachFileMap[doc.code];

	    if (!file) {
	        return <FileText size={28} />;
	    }

	    const fileName = file.ATCHFILE_NM || '';

	    // FILE_URL에 이미 ?가 있으면 &v=, 없으면 ?v=
	    const fileUrl = file.FILE_URL
	        ? `${file.FILE_URL}${file.FILE_URL.includes('?') ? '&' : '?'}v=${thumbVersion}`
	        : '';

	    if (!fileUrl) {
	        return <FileText size={28} />;
	    }

	    if (isImageFile(fileName)) {
	        return (
	            <img
	                src={fileUrl}
	                alt={doc.name}
	                className="wa-attach-preview-img"
	                onError={(e) => {
	                    console.error('이미지 로드 실패', fileUrl);
	                    e.target.style.display = 'none';
	                }}
	            />
	        );
	    }

	    return <FileText size={28} />;
	};
	
	// 첨부파일 목록 조회
	const loadAttachFiles = async (currentServiceId = serviceId) => {

	    const res = await axios.get('/api/customer/file/list', {
	        params: {
	            serviceId: currentServiceId,
	            token
	        }
	    });

		console.log("attachFiles", res.data.list);
		
	    const attachFiles = Array.isArray(res.data?.list)
	        ? res.data.list
	        : [];

	    setAttachFiles(attachFiles);
	};

	// 첨부파일 업로드
	const handleFileChange = async (doc, event) => {

	    const file = event.target.files?.[0];

	    event.target.value = '';

	    if (!file) {
	        return;
	    }

	    const formData = new FormData();

	    formData.append('serviceId', serviceId);
	    formData.append('code', doc.code);
	    formData.append('gubun', doc.gubun);
	    formData.append('file', file);
		formData.append('token', token);
		
		// 한글 파일명을 같이 보냄
		formData.append('docName', doc.name);
		
		// 미성년자 확인서류 PDF 병합을 위해 MINOR로도 저장해야 하는지 여부
		const duplicateMinor =
		    attachPolicy.duplicateMinorCodes.has(doc.code) ||
		    ntaxPolicy.duplicateMinorCodes.has(doc.code);

		formData.append('duplicateMinor', duplicateMinor ? 'Y' : 'N');
		
		setLoading(true);
		
		try {

			console.log(gf);
			console.log(gf.delay);
			
		    await gf.delay(1500, async () => {

		        const res = await axios.post(
		            '/api/customer/file/upload',
		            formData,
		            {
		                headers: {
		                    'Content-Type': 'multipart/form-data'
		                }
		            }
		        );

				// 업로드 후 목록만 다시 조회
			    await loadAttachFiles();
				setThumbVersion(Date.now());
		    });

		} catch (e) {

			console.error(e);
			console.error(e.response);
			console.error(e.response?.data);
		    gf.alert('첨부파일 업로드 중 오류가 발생했습니다.');

		} finally {
		    setLoading(false);
		}
		
	};
	
	// 양식 다운로드
	const handleDownloadForm = async (doc) => {

	    try {

	        const res = await axios.post(
	            '/api/attach/form',
	            { 
					CODE: doc.code,
					NAME: doc.name
				 },
	            { responseType: 'blob' }
	        );

	        const blob = new Blob([res.data]);
	        const url = window.URL.createObjectURL(blob);

	        const link = document.createElement('a');
	        link.href = url;
	        link.download = `${doc.name}.pdf`;
	        link.click();

	        window.URL.revokeObjectURL(url);

	    } catch (e) {

	        console.error(e);

	        gf.alert(
	            e.response?.data?.message || '양식 다운로드 중 오류가 발생했습니다.'
	        );
	    }
	};
	
	/* =========================================================
	 * 신청 정보 조회
	 ========================================================= */
	const loadData = async () => {

		const startTime = Date.now();
		setLoading(true);
		
	    try {

	        const res = await axios.post('/api/customer/getToken', {
	            TOKEN: token
	        });

			log(res.data.result);
			
	        const info = res.data.result.info;
			const owner = res.data.result.owner;

			console.log('여기 통과');

	        if (!info) {

	            await gf.alert('해당 건이 조회되지 않습니다.');

	            navigate('/customer/CustomerResult', {
	                state: { success: false }
	            });

	            return;
	        }
			
			console.log('1');

			// 신청 정보 저장
			setInfo(info);
			setOwnerInfo(owner ?? {});

			setServiceId(info.SERVICE_ID);
			setCarNo(info.CAR_NO);
			setManagerTel(info.MANAGER_TEL ?? '');

			// 첨부파일 목록 조회
			await loadAttachFiles(info.SERVICE_ID);

	    } catch (e) {

	        console.error(e);

	        gf.alert('정보 조회 중 오류가 발생했습니다.');

	        navigate('/customer/CustomerResult', {
	            state: { success: false }
	        });
	    } finally {
	        gf.loadingDelay(startTime, () => setLoading(false), 1000);
	    }
	};

    return (
		<>
		<div className="customer-page customer-upload-page">
			{loading && (
			    <div className="customer-loading">
			        <LoaderCircle size={24} className="customer-spin" />
			        <span>잠시만 기다려주세요</span>
			    </div>
			)}

		    <div className="customer-card customer-upload-card">
				<h3>추가 제출 서류</h3>
	
				<p className="customer-description">
				    감면을 위해 필요한 서류를 등록해 주세요.
				</p>
	
				<div className="customer-upload-guide">
	
				    <div className="text-primary">
				        ※ 유의사항
				    </div>
	
				    <p>· 아래 기준에 적합하지 않은 경우, 재등록을 요청할 수 있습니다.</p>
				    <p>· 전체 내용이 잘리지 않고 프레임 안에 포함되어야 합니다.</p>
				    <p>· 밝기와 초점이 맞아 모든 정보가 선명하게 확인 가능해야 합니다.</p>
	
				</div>
	
				<p className="customer-upload-notice">
				    · 사진을 클릭하면 확대되며, 다시 클릭하면 원래 크기로 돌아옵니다.
				</p>
	
				<div className="customer-upload-list">

				{uploadList.map(doc => {

				    const file = attachFileMap[doc.code];

				    return (
				        <div
				            key={doc.code}
				            className={`customer-upload-item ${file ? 'uploaded' : ''}`}
				        >

				            {!file ? (
				                <>
									<div className="customer-upload-before">
									    <div className="customer-upload-title">
									        <span>{doc.name}</span>
	
									        {doc.choice === 'Y' && (
									            <span className="customer-upload-choice">
									                [선택]
									            </span>
									        )}
									    </div>
									</div>
				                </>
				            ) : (
				                <>
				                    <div className="customer-upload-file">

				                        <button
				                            type="button"
				                            className="customer-upload-thumb"
				                            onClick={() => setPreviewFile(file)}
				                        >
				                            {renderThumb(doc)}
				                        </button>

				                        <span className="customer-upload-name">
				                            {doc.name}
				                        </span>

				                    </div>
				                </>
				            )}

							{/* 버튼 영역 */}
							<div className={`customer-upload-btn-group ${!file ? 'before-upload' : ''}`}>

							    {doc.formYn === 'Y' && (
							        <button
							            type="button"
							            className="customer-btn-form"
							            onClick={() => handleDownloadForm(doc)}
							        >
							            양식 다운로드
							        </button>
							    )}

							    <button
							        type="button"
							        className={`customer-btn-upload ${file ? 'outline' : ''}`}
							        onClick={() => fileInputRefs.current[doc.code]?.click()}
							    >
							        {file ? '재업로드' : '업로드'}
							    </button>

							</div>

				            <input
				                type="file"
				                hidden
				                ref={el => (fileInputRefs.current[doc.code] = el)}
				                onChange={(e) => handleFileChange(doc, e)}
				            />
				        </div>
				    );

				})}

				</div>
	
				<hr className="customer-upload-divider" />
	
				<div className="customer-btn-group">
	
				    <button 
						className="customer-btn customer-btn-outline"
						onClick={() => navigate(`/customer/CustomerSign?t=${token}`)}
					>
				        이전 화면
				    </button>
	
				    <button className="customer-btn customer-btn-primary"
						onClick={() => navigate(`/customer/CustomerResult?t=${token}&managerTel=${managerTel}`)}
					>
				        등록 완료
				    </button>
	
				</div>

		    </div>

			
			{/* 이미지 확대 모달 */}
			{previewFile && (

			    <div
			        className="customer-preview-backdrop"
			        onClick={() => setPreviewFile(null)}
			    >

			        <div
			            className="customer-preview-modal"
			            onClick={e => e.stopPropagation()}
			        >

			            <img
			                src={previewFile.FILE_URL}
			                alt=""
			                className="customer-preview-image"
			            />

			            <div className="customer-preview-name">
			                {previewFile.ATCHFILE_NM}
			            </div>

			            <button
			                className="customer-btn customer-btn-primary"
			                onClick={() => setPreviewFile(null)}
			            >
			                닫기
			            </button>

			        </div>

			    </div>

			)}
		</div>
	</>
    );
};

export default CustomerUpload;