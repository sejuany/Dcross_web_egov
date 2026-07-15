import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
	// 차량번호
	const [carNo, setCarNo] = useState('');
	// 서비스 아이디
	const [serviceId, setServiceId] = useState('');
	// 매니저 전화번호
	const [managerTel, setManagerTel] = useState('');
	
	
	log("token : " + token);
	
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

	    try {
			
			const res = await axios.post('/api/customer/getToken', {
			    TOKEN: token
			});

	        console.log(res.data);

			const info = res.data.info;

			if (!info) {
			    await gf.alert('해당 건이 조회되지 않습니다.');

			    navigate('/customer/CustomerResult', {
			        state: { success: false }
			    });

			    return;
			}

			// 서명이 필요 없는 경우 바로 첨부파일 페이지 이동
			if (info.SIGN_YN === 'N') {
			    navigate(`/customer/CustomerUpload?t=${token}`);
			    return;
			}
			
			// 서명이 필요한 경우
			setCarNo(info.CAR_NO);
			setServiceId(info.SERVICE_ID);
			setManagerTel(info.MANAGER_TEL ?? '');
	    }

	    catch (e) {

	        console.error(e);

	        gf.alert('정보 조회 중 오류가 발생했습니다.');
			
			navigate('/customer/CustomerResult', {
			    state: { success: false }
			});

	    }

	};
	
	
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
	        "서명을 완료하시겠습니까?\n확인을 누르면 첨부파일 업로드 페이지로 이동합니다."
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

		formData.append("serviceId", serviceId);
		formData.append("code", SIGN_DOC.SIGN.code);
		formData.append("gubun", SIGN_DOC.SIGN.gubun);
		formData.append("file", file);
		formData.append("token", token);

	    try {

			await axios.post("/api/customer/file/upload", formData, {
			    headers: {
			        "Content-Type": "multipart/form-data"
			    }
			});

	        navigate(`/customer/CustomerUpload?t=${token}`);

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
	    <div className="customer-page">

	        <div className="customer-card">

	            <h3>추가 제출 서류</h3>

	            <p className="customer-description">
					안녕하세요. 폴스타코리아 신규등록 대행업체입니다.<br />
	                감면 신청을 위해 <span className="text-primary">확인 서명</span> 부탁드립니다.<br />
					관련 문의는 담당 스페셜리스트(<b>{managerTel}</b>)에게 연락 부탁드립니다.
	            </p>

	            <hr className="customer-divider" />

	            {/* 신청인 */}
	            <div className="customer-form-group">
	                <label>
	                    <b>[{carNo}]</b> 신청인의 성함을 입력해 주세요.
	                </label>

	                <input
	                    className="customer-input"
	                    type="text"
	                    placeholder="홍길동"
	                />
	            </div>

	            {/* 서명 */}
	            <div className="customer-form-group">

	                <label>
	                    <b>[{carNo}]</b> 차량의 감면 신청을 위해 아래 서명란에 <b>정자로 서명</b>해 주세요.<br />
						해당 서명은 감면신청서에 포함됩니다.
	                </label>

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
	);
};

export default CustomerSign;