import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';

// 통신
import axios from 'axios';
// 사인 기능
import SignatureCanvas from 'react-signature-canvas';
// 예시 이미지
import signEx1 from '../img/signEx1.png';
import signEx2 from '../img/signEx2.png';
import signEx3 from '../img/signEx3.png';
// style
import '../styles/CustomerPage.css';
import { gf, log } from '../../utils/utils';
// 정책 가져오기

import {
	getAttachPolicy,
	getNtaxAttachPolicy,
	SIGN_DOC
} from '../../policy/attachPolicy';


const CustomerSign = () => {
	// 페이지 이동
	const navigate = useNavigate();
	// 사인 기능
	const sigRef = useRef(null);
	// 토큰 불러오기
	const [searchParams] = useSearchParams();
	// 토큰
	let token = searchParams.get('t');
	const [info, setInfo] = useState({});
	const [codes, setCodes] = useState({});
	// 로딩 상태
	const [loading, setLoading] = useState(false);
	
	// 공통코드 데이터 로딩
	useEffect(() => {

		const loadCodes = async () => {
		    const result = await gf.getCodes(['NTTCD', 'NTTGR', 'NTACD', 'NTWHO']);
		    setCodes(result);
		};

		loadCodes();
	}, [setCodes]);
	
	const nType = (codes.NTTCD || []).find(
	    item => item.CODE_ID === info.NTAX_TRGET_CD
	);

	const nGrade = (codes.NTTGR || []).find(
	    item => item.CODE_ID === info.NTAX_TRGET_GR_CD
	);
	
	/* =========================================================
	 * 화면 진입 시 데이터 조회
	 * - 토큰으로 신청 정보를 조회한다.
	========================================================= */
	useEffect(() => {

	    loadData();

	}, []);

	
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

			console.log("1");
	        console.log(res);

			const info = res.data.result.info;

			if (!info) {
			    await gf.alert('해당 건이 조회되지 않습니다.');

			    navigate('/customer/CustomerResult', {
			        state: { success: false }
			    });

			    return;
			}

			console.log("2");
			console.log(info);
			
			// 서명이 필요 없는 경우 바로 첨부파일 페이지 이동
			if (info.SIGN_YN === 'N') {
			    navigate(`/customer/CustomerUpload?t=${token}`);
			    return;
			}
			
			console.log("3");
			console.log(info);

			if (!info) {
			    return;
			}

			setInfo(info);
			console.log(info);
	    }

	    catch (e) {

	        console.error(e);

	        gf.alert('정보 조회 중 오류가 발생했습니다.');
			
			navigate('/customer/CustomerResult', {
			    state: { success: false }
			});

	    } finally {
	        gf.loadingDelay(startTime, () => setLoading(false), 1000);
	    }

	};
	
	
	// 일반 첨부 정책	
	const attachPolicy = getAttachPolicy(info);
	// 비과세 첨부 정책
	const ntaxPolicy = getNtaxAttachPolicy(info);
	
	/* =========================================================
	 * 사인 이벤트
	========================================================= */
	// 사인 한 획 지우기 기능
	const handleUndo = () => {

	    const pad = sigRef.current.getSignaturePad();

	    const data = pad.toData();

	    if (data.length === 0) {
	        return;
	    }

	    data.pop();

	    pad.fromData(data);

	};

	// 사인 전체 지우기 기능
	const handleClear = () => {

	    sigRef.current.clear();

	};
	
	// 서명 완료
	const handleComplete = async () => {

	    const pad = sigRef.current.getSignaturePad();

	    if (pad.isEmpty()) {
	        gf.alert("서명을 입력해주세요.");
	        return;
	    }

	    const strokeCount = pad.toData().length;

	    if (strokeCount < 3) {
	        gf.alert("서명을 3획 이상 입력해주세요.");
	        return;
	    }

	    const ok = await gf.confirm(
	        "서명을 완료하시겠습니까?\n확인을 누르면 완료됩니다."
	    );

	    if (!ok) {
	        return;
	    }

	    // Canvas → File
	    const canvas = sigRef.current.getCanvas();
		
		// 서명 편집(서명 영역만 잘라내고 50% 축소)
		const file = await createSignFile(canvas);

	    // 용량 체크 (100KB)
	    const sizeBytes = file.size;

	    log("sizeBytes : " + sizeBytes);

	    if (sizeBytes > 102400) {
	        gf.alert("이미지 용량이 100KB를 초과했습니다.\n서명을 다시 작성해주세요.");
	        return;
	    }

		const formData = new FormData();

		console.log("SERVICE_ID >>" + info.SERVICE_ID);
		formData.append("serviceId", info.SERVICE_ID);
		formData.append("code", SIGN_DOC.SIGN.code);
		formData.append("gubun", SIGN_DOC.SIGN.gubun);
		formData.append("file", file);
		formData.append("token", token);
		// 한글 파일명을 같이 보냄
		formData.append('docName', '감면신청서 서명');

	    try {

			await axios.post("/api/customer/file/upload", formData, {
			    headers: {
			        "Content-Type": "multipart/form-data"
			    }
			});

			// 2. 전자서명 이력 생성
			await axios.post('/api/common/insertDsign', {
			    SERVICE_ID: info.SERVICE_ID,
				CAR_NO: info.CAR_NO,
				DSIGN_GB: 'WSIGN',
				DSIGN_ST: 'END',
				INS_USER: info.LOGIN_ID
			});
			
				
			if(attachPolicy.needUpload || ntaxPolicy.needUpload) {
		        navigate(`/customer/CustomerUpload?t=${token}`);
			} else {
				// 서명만
				navigate(`/customer/CustomerResult?t=${token}&managerTel=${info.MANAGER_TEL}`);
			}

	    } catch (e) {

	        console.error(e);

	        gf.alert("서명 저장 중 오류가 발생했습니다.");

	    }
	};
	
	// 서명 편집(서명 영역만 잘라내고 1/3 축소)
	const createSignFile = async (canvas) => {

	    const ctx = canvas.getContext("2d");
	    const { width, height } = canvas;

	    const imageData = ctx.getImageData(0, 0, width, height).data;

	    let top = height;
	    let left = width;
	    let right = 0;
	    let bottom = 0;

	    // 서명 영역 찾기
	    for (let y = 0; y < height; y++) {
	        for (let x = 0; x < width; x++) {

	            const alpha = imageData[(y * width + x) * 4 + 3];

	            if (alpha > 0) {
	                top = Math.min(top, y);
	                left = Math.min(left, x);
	                right = Math.max(right, x);
	                bottom = Math.max(bottom, y);
	            }
	        }
	    }

	    // 여백 10px
	    const padding = 10;

	    left = Math.max(0, left - padding);
	    top = Math.max(0, top - padding);
	    right = Math.min(width - 1, right + padding);
	    bottom = Math.min(height - 1, bottom + padding);

	    const cropWidth = right - left + 1;
	    const cropHeight = bottom - top + 1;

		// 1/3 축소
		const SCALE = 3;

		const outputCanvas = document.createElement("canvas");
		outputCanvas.width = Math.max(1, Math.round(cropWidth / SCALE));
		outputCanvas.height = Math.max(1, Math.round(cropHeight / SCALE));

		outputCanvas
		    .getContext("2d")
		    .drawImage(
		        canvas,
		        left,
		        top,
		        cropWidth,
		        cropHeight,
		        0,
		        0,
		        outputCanvas.width,
		        outputCanvas.height
		    );

	    return await new Promise(resolve => {

	        outputCanvas.toBlob(blob => {

				resolve(
	                new File(
	                    [blob],
	                    `sign.png`,
	                    { type: "image/png" }
	                )
	            );

	        }, "image/png");

	    });
	};


	return (
		<>
	    <div className="customer-page">
			{loading && (
			    <div className="customer-loading">
			        <LoaderCircle size={24} className="customer-spin" />
			        <span>잠시만 기다려주세요</span>
			    </div>
			)}

	        <div className="customer-card">

	            <h3>감면 서명</h3>
				
				<p className="customer-description">
				    안녕하세요. 폴스타코리아 신규등록 대행업체입니다.
				    <br /><br />

				    감면자명 : <strong>{info.OWNER_NM}</strong><br />
					감면대상 : <strong>{nType?.CODE_NM}</strong><br />
					감면등급 : <strong>{nGrade?.CODE_NM || '-'}</strong>
				    <br /><br />

				    위 내용으로 <strong>[{info.CAR_NO}]</strong> 차량의 취득세 감면 신청에 동의하시면,
				    아래 서명란에 정자로 성명을 기재하여 주시기 바랍니다.
				    <br />
				    해당 서명은 취득세 감면 신청서에 포함됩니다.
				    <br /><br />

				    관련 문의는 담당 스페셜리스트<strong>({gf.formatPhoneNo(info.MANAGER_TEL)})</strong>에게 연락해 주시기 바랍니다.
				</p>

	            {/* 서명 */}
	            <div className="customer-form-group">

	                <div className="customer-sign-example">

	                    <p className="customer-sign-guide">
	                        아래 예시를 참고하여 서명을 입력해 주세요.
	                    </p>

	                    <p className="customer-example-title">
	                        올바른 서명 예시 )
	                    </p>

	                    <div className="customer-correct-sign">
	                        <img
	                            src={signEx1}
	                            alt=""
	                        />

	                        <span>
	                            신청인의 성함이 모두 또박또박 입력된 서명
	                        </span>
	                    </div>

	                    <p className="customer-example-title">
	                        잘못된 서명 예시 )
	                    </p>

	                    <div className="customer-wrong-sign-wrap">

	                        <div className="customer-wrong-sign">
	                            <img
	                                src={signEx2}
	                                alt=""
	                            />
	                            <span>성 또는 이름 누락 / 사인</span>
	                        </div>

	                        <div className="customer-wrong-sign">
	                            <img
	                                src={signEx3}
	                                alt=""
	                            />
	                            <span>흘려 쓴 서명</span>
	                        </div>

	                    </div>

	                </div>

	                <div className="customer-sign-title">
	                    ▼ 본인의 성명 전체를 <b>정자</b>로 입력해 주세요.
	                </div>

					<div className="customer-sign-box">

					    <SignatureCanvas
					        ref={sigRef}
					        penColor="#000000"
							minWidth={2.5}
							maxWidth={5}
					        canvasProps={{
					            className: 'customer-sign-canvas'
					        }}
					    />

					</div>

	            </div>

	            <div className="customer-btn-group">

	                <button
	                    className="customer-btn customer-btn-outline"
						onClick={handleUndo}
	                >
	                    한획 지우기
	                </button>

	                <button
	                    className="customer-btn customer-btn-outline"
						onClick={handleClear}
	                >
	                    전체 지우기
	                </button>

	                <button
	                    className="customer-btn customer-btn-primary"
						onClick={handleComplete}
	                >
	                    서명완료
	                </button>

	            </div>

	        </div>

	    </div>
		</>
	);
};

export default CustomerSign;