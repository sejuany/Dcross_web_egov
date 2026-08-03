import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';

import axios from 'axios';

import '../styles/CustomerPage.css';

// 공통
import { gf, log } from '../../utils/utils';

import {
	getAttachPolicy,
	getNtaxAttachPolicy
} from '../../policy/attachPolicy';


const CustomerUpload = () => {

	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const token = searchParams.get('t');
	
	// 신청 정보
	const [info, setInfo] = useState(null);

	// 서비스 아이디
	const [serviceId, setServiceId] = useState('');

	// 차량번호
	const [carNo, setCarNo] = useState('');

	// 담당자 연락처
	const [managerTel, setManagerTel] = useState('');

	// 업로드 대상
	const [uploadList, setUploadList] = useState([]);
	
	// 업로드된 첨부파일 목록
	const [attachFiles, setAttachFiles] = useState([]);
	
	// 파일 input 참조
	const fileInputRefs = useRef({});
	
	// 이미지 모달
	const [previewFile, setPreviewFile] = useState(null);
	
	
	useEffect(() => {
	    loadData();
	}, []);
	

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
	    const fileUrl = file?.FILE_URL;
	    const fileName = file?.ATCHFILE_NM;

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

	    try {

	        const res = await axios.post(
	            '/api/customer/file/upload',
	            formData,
	            {
	                headers: {
	                    'Content-Type': 'multipart/form-data'
	                }
	            }
	        );

	        // 업로드 후 목록 다시 저장
	        setAttachFiles(res.data.list ?? []);

	    } catch (e) {

	        console.error(e);

	        gf.alert('첨부파일 업로드 중 오류가 발생했습니다.');
	    }
	};
	
	/* =========================================================
	 * 신청 정보 조회
	 ========================================================= */
	const loadData = async () => {

	    try {

	        const res = await axios.post('/api/customer/getToken', {
	            TOKEN: token
	        });

			log(res.data.result);
			
	        const info = res.data.result.info;
			const owner = res.data.result.owner;

			console.log(info);
			console.log(owner);

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
			setServiceId(info.SERVICE_ID);
			setCarNo(info.CAR_NO);
			setManagerTel(info.MANAGER_TEL ?? '');
			
			// 첨부파일 정책 조회
			const attachPolicy = getAttachPolicy(info, owner);
			const ntaxPolicy = getNtaxAttachPolicy(info);

			// 일반 첨부 + 감면 첨부 합치기
			const docs = [
			    ...attachPolicy.requiredDocs,
			    ...ntaxPolicy.requiredDocs
			];

			// CODE 기준 중복 제거 후 순서대로 정렬
			const uploadList = Array.from(
			    new Map(docs.map(doc => [doc.code, doc])).values()
			).sort((a, b) => a.seq - b.seq);

			// 화면에 표시할 첨부 목록 저장
			setUploadList(uploadList);

			// 업로드된 파일 조회
			const res2 = await axios.get('/api/customer/file/list', {
			    params: {
			        serviceId: info.SERVICE_ID,
					token: token
			    }
			});

			const attachFiles = Array.isArray(res2.data?.list)
			    ? res2.data.list
			    : [];
				

			setAttachFiles(attachFiles);

	    } catch (e) {

	        console.error(e);

	        gf.alert('정보 조회 중 오류가 발생했습니다.');

	        navigate('/customer/CustomerResult', {
	            state: { success: false }
	        });
	    }
	};

    return (
		<div className="customer-page customer-upload-page">

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
					
					console.log(doc.code, file);
					
				    return (
				        <div
				            key={doc.code}
				            className={`customer-upload-item ${file ? 'uploaded' : ''}`}
				        >

				            {!file ? (

				                <>
				                    <div className="customer-upload-title">
				                        {doc.name}
				                    </div>

				                    <button
				                        type="button"
				                        className="customer-btn-upload"
				                        onClick={() => fileInputRefs.current[doc.code]?.click()}
				                    >
				                        업로드
				                    </button>
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

				                    <button
				                        type="button"
				                        className="customer-btn-upload outline"
				                        onClick={() => fileInputRefs.current[doc.code]?.click()}
				                    >
				                        재업로드
				                    </button>
				                </>

				            )}
							

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
    );
};

export default CustomerUpload;