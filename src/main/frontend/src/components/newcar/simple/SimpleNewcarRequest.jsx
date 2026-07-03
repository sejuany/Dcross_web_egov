import React, { useState, useEffect } from 'react';

import './SimpleNewcarRequest.css';


const NewcarRequestSimple = () => {
	
	// 첫번째 진행단계 step 설정
	const [step, setStep] = useState(1);
	// hocer 했을 때 파란 선 움직이는 효과
	const [hoverStep, setHoverStep] = useState(null);
	// 표시할 밑줄 위치
	const current = hoverStep ?? step;
	// 소유자 유형 (R:개인, B:법인, L:리스, C:이용자명의 리스)
	const [ownerType, setOwnerType] = useState('R');
	
	
	useEffect(() => {
		// 간편 화면 전용 CSS 적용
		document.body.classList.add('simple-page');

		const mainContent = document.querySelector('.main-content');
		mainContent?.classList.add('simple-page');

		return () => {
		    document.body.classList.remove('simple-page');
		    mainContent?.classList.remove('simple-page');
		};
	}, []);

	
	return(
		<div className="simple-newcar-page">
		    <div className="simple-newcar-container">
			
				<div className="simple-header">
					{/* 진행 단계 */}
				    <div className="simple-step-wrap">
				        <div 
							className={`simple-step ${step === 1 ? 'active' : ''}`}
					        onMouseEnter={() => setHoverStep(1)}
					        onMouseLeave={() => setHoverStep(null)}
					        onClick={() => setStep(1)}
					    >
				            <div className="step-circle">1</div>
				            <span>소유자 정보 입력</span>
				        </div>

						<div
						    className={`simple-step ${step === 2 ? 'active' : ''}`}
						    onMouseEnter={() => setHoverStep(2)}
						    onMouseLeave={() => setHoverStep(null)}
						    onClick={() => setStep(2)}
						>
				            <div className="step-circle">2</div>
				            <span>번호판 정보 입력</span>
				        </div>

						<div
						    className={`simple-step ${step === 3 ? 'active' : ''}`}
						    onMouseEnter={() => setHoverStep(3)}
						    onMouseLeave={() => setHoverStep(null)}
						    onClick={() => setStep(3)}
						>
				            <div className="step-circle">3</div>
				            <span>신규등록 정보 입력</span>
				        </div>

						<div
						    className={`simple-step ${step === 4 ? 'active' : ''}`}
						    onMouseEnter={() => setHoverStep(4)}
						    onMouseLeave={() => setHoverStep(null)}
						    onClick={() => setStep(4)}
						>
				            <div className="step-circle">4</div>
				            <span>최종 확인</span>
				        </div>
						
						{/* 밑줄 하나만 추가 */}
						<div
						    className="step-indicator"
						    style={{
						            transform: `translateX(${(current - 1) * 100}%)`
						    }}
						/>
				    </div>

				    {/* 차량 정보 */}
				    <div className="simple-summary">

				        <div className="summary-item">
				            <div className="icon-placeholder" />
				            <div>
				                <div className="summary-label">주문번호</div>
				                <div className="summary-value">13550355</div>
				            </div>
				        </div>

				        <div className="summary-item">
				            <div className="icon-placeholder" />
				            <div>
				                <div className="summary-label">차대번호</div>
				                <div className="summary-value">YSM4ZPAA1VF424979</div>
				            </div>
				        </div>

				        <div className="summary-item">
				            <div className="icon-placeholder" />
				            <div>
				                <div className="summary-label">계약자명</div>
				                <div className="summary-value">홍길동</div>
				            </div>
				        </div>

				        <div className="summary-item">
				            <div className="icon-placeholder" />
				            <div>
				                <div className="summary-label">등록 예정일자</div>
				                <div className="summary-value">2026-06-17</div>
				            </div>
				        </div>

				    </div>
				</div>
			
				<div className="simple-body">
					{step === 1 && (
		                <>
							<h2 className="simple-title">소유자 정보</h2>
	
							{/* 소유자 유형 */}
							<div className="simple-owner-tabs">
							    <button
							        className={`owner-tab ${ownerType === 'R' ? 'active' : ''}`}
							        onClick={() => setOwnerType('R')}
							    >
							        개인
							    </button>

							    <button
							        className={`owner-tab ${ownerType === 'B' ? 'active' : ''}`}
							        onClick={() => setOwnerType('B')}
							    >
							        법인
							    </button>

							    <button
							        className={`owner-tab ${ownerType === 'L' ? 'active' : ''}`}
							        onClick={() => setOwnerType('L')}
							    >
							        리스
							    </button>

							    <button
							        className={`owner-tab ${ownerType === 'C' ? 'active' : ''}`}
							        onClick={() => setOwnerType('C')}
							    >
							        이용자명의 리스
							    </button>
							</div>
	
							{/* 내용 영역 */}
							<div className="simple-content">
								
								<div className="simple-form-row">
	
								    <div className="simple-label-wrap">
								        <label className="simple-label">
								            대표소유자 성명
								        </label>
	
								        <label className="same-contract">
								            계약자와 동일
								            <input type="checkbox" />
								        </label>
								    </div>
	
								    <input
								        className="simple-input"
								        placeholder="이름을 입력하세요."
								    />
	
								</div>
								
							</div>
		                </>
		            )}

		            {step === 2 && (
		                <>
		                    <h2 className="simple-title">번호판 정보</h2>

		                    <div className="simple-content">
		                    </div>
		                </>
		            )}

		            {step === 3 && (
		                <>
		                    <h2 className="simple-title">신규등록 정보</h2>

		                    <div className="simple-content">
		                    </div>
		                </>
		            )}

		            {step === 4 && (
		                <>
		                    <h2 className="simple-title">최종 확인</h2>

		                    <div className="simple-content">
		                    </div>
		                </>
		            )}

				
				</div>
				
		    </div>
		</div>
	);
}

export default NewcarRequestSimple;