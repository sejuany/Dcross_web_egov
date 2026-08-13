import React, { useState, useEffect } from 'react';
import { ChevronRight, FileText, X } from 'lucide-react';

// 첨부서류 모달
import WaNewcarAttachModal from './WaNewcarAttachModal';

// 파일 업로드 정책 가져오기
import {
    getAttachPolicy,
    getNtaxAttachPolicy,
	NTAX_POLICY
} from '../../../policy/attachPolicy';

const ConfirmInfo = ({
	dsService,
	dsNewCar,
	dsCarNoDetach,
	setDsCarNoDetach,
	dsUserInfo,
	saveProcess,
	dsDLVGB,
	dsNUMGB,
	dsBANK,
	dsNTTCD,
	dsNTTGR,
	dsOwnerInfo,
	dsTaxReceipt,
	dsBaseList,
	dsPaymentList,
	onAttachClose,
	onMoveStep
}) => {
	// 첨부서류 모달
	const [attachModalOpen, setAttachModalOpen] = useState(false);
	const [showAttachButton, setShowAttachButton] = useState(false);
	const [rejectModalOpen, setRejectModalOpen] = useState(false);
	const isRejected = String(dsService?.PROC_ST ?? '').trim() === 'RET';
	const rejectReason = String(dsService?.RETURN_TX ?? '');

	// 반려 상세를 처음 열었을 때 전체 반려 사유를 한 번 보여준다.
	useEffect(() => {
		if (isRejected) {
			setRejectModalOpen(true);
		}
	}, [dsService?.SERVICE_ID, isRejected]);
	
	// 첨부파일 버튼 보이는 조건
	useEffect(() => {

	    // 일반 첨부 정책
	    const attachPolicy = getAttachPolicy(dsNewCar, dsOwnerInfo);
		
	    // 비과세 첨부 정책
	    const ntaxPolicy = getNtaxAttachPolicy(dsNewCar, dsOwnerInfo);
		
	    setShowAttachButton(
	        attachPolicy.needSign || attachPolicy.needUpload || ntaxPolicy.needUpload
	    );

	}, [dsNewCar]);
			
		
	const taxReciptNm =
	    dsTaxReceipt?.GUBUN === 'TAX'
	        ? '세금계산서'
	        : dsTaxReceipt?.GUBUN === 'CASH'
	            ? '현금영수증'
	            : '없음';
				
	const ownerType =
	    dsNewCar.PROC_CD === 'C'
	            ? 'C'
		   : dsNewCar.TASK_CD === 'LEASE'
		        ? 'L'
		            : dsNewCar.REG_GB === 'R' || dsNewCar.REG_GB === 'F'
		                ? 'R'
							: dsNewCar.REG_GB === 'B'
							? 'B'
			               		 : '';
	const selectedLeaseBase = dsBaseList?.find(item => (
		String(item.BASE_ID) === String(dsNewCar.BASE_BRANCH_ID)
	));
	const selectedLeaseName = String(selectedLeaseBase?.BASE_NM ?? '')
		.replace(/주식회사/g, '')
		.replace(/\((본점|창원)\)$/, '')
		.trim();
	const isDirectLeaseCompany = selectedLeaseName === '직접입력';
	const leaseCompanyName = isDirectLeaseCompany
		? (ownerType === 'L' ? dsNewCar.OWNER_NM : dsOwnerInfo.DEBTOR_NM)
		: selectedLeaseName;

    return (
        <>
			<div className="wa-confirm-body">
				{isRejected && (
					<div className="wa-reject-summary">
						<span className="wa-reject-summary-label">반려 사유</span>
						<button
							type="button"
							className="wa-reject-summary-box"
							onClick={() => setRejectModalOpen(true)}
						>
							{rejectReason || '반려 사유가 등록되지 않았습니다.'}
						</button>
					</div>
				)}
		
		        {/* 소유자 정보 */}
				<div className="wa-confirm-card">
				    <div className="wa-confirm-title"
						onClick={() => onMoveStep?.(1)}>
				        소유자 정보
				        <ChevronRight size={18} />
				    </div>
				    <div className="wa-owner-wrap">

				        {/* 대표소유자 */}
				        <div className="wa-owner-box">
							{/* 개인 */}
						    {ownerType === 'R' && (
						        <>
					            <div className="wa-confirm-item">
					                <span>대표소유자명</span>
					                <strong>{dsNewCar.OWNER_NM}</strong>
					            </div>
	
					            <div className="wa-confirm-item">
					                <span>등록번호</span>
					                <strong>{dsNewCar.REG_NO}</strong>
					            </div>
	
					            <div className="wa-confirm-item">
					                <span>등본상 주소</span>
					                <strong>{dsNewCar.BASE_ADDRESS} {dsNewCar.BASE_ADDRESS_DT}</strong>
					            </div>
	
					            <div className="wa-confirm-item">
					                <span>대표소유비율</span>
					                <strong>{dsNewCar.RATIO_NO}%</strong>
					            </div>
	
					            <div className="wa-confirm-item">
					                <span>휴대폰번호</span>
					                <strong>{dsNewCar.MPHONE_NO}</strong>
					            </div>

								</>
							)}

							{/* 법인 */}
						    {ownerType === 'B' && (
						        <>
					            <div className="wa-confirm-item">
					                <span>대표소유자 상호명</span>
					                <strong>{dsNewCar.OWNER_NM}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>법인등록번호</span>
					                <strong>{dsNewCar.REG_NO}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>사업자등록번호</span>
					                <strong>{dsNewCar.BIZ_NO}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>휴대폰번호</span>
					                <strong>{dsNewCar.MPHONE_NO}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>본점 소재지</span>
					                <strong>{dsNewCar.ADDRESS} {dsNewCar.ADDRESS_DT}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>사업장 주소</span>
					                <strong>{dsNewCar.BASE_ADDRESS} {dsNewCar.BASE_ADDRESS_DT}</strong>
					            </div>
								</>
							)}

							{/* 리스 */}
						    {ownerType === 'L' && (
						        <>
					            <div className="wa-confirm-item">
					                <span>리스사명</span>
									<strong>{leaseCompanyName}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>법인등록번호</span>
					                <strong>{dsNewCar.REG_NO}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>사업자등록번호</span>
					                <strong>{dsNewCar.BIZ_NO}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>본점 주소</span>
					                <strong>{dsNewCar.ADDRESS} {dsNewCar.ADDRESS_DT}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>사용본거지</span>
					                <strong>{dsNewCar.BASE_ADDRESS} {dsNewCar.BASE_ADDRESS_DT}</strong>
					            </div>
								</>
							)}

							{/* 이용자명의리스 */}
						    {ownerType === 'C' && (
						        <>
					            <div className="wa-confirm-item">
					                <span>리스 종료일</span>
					                <strong>{dsNewCar.IMSIGV_DT}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>대표 소유자명</span>
					                <strong>{dsNewCar.OWNER_NM}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>등록번호</span>
					                <strong>{dsNewCar.REG_NO}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>휴대폰번호</span>
					                <strong>{dsNewCar.MPHONE_NO}</strong>
					            </div>
								<div className="wa-confirm-item">
					                <span>등본상 주소/본점소재지</span>
					                <strong>{dsNewCar.ADDRESS} {dsNewCar.ADDRESS_DT}</strong>
					            </div>
					            <div className="wa-confirm-item">
					                <span>사용본거지(법인)</span>
					                <strong>{dsNewCar.BASE_ADDRESS} {dsNewCar.BASE_ADDRESS_DT}</strong>
					            </div>
								</>
							)}
				        </div>

						{ownerType === 'L' && (
							<div className="wa-owner-box">
								<div className="wa-confirm-item">
									<span>리스 계약자명</span>
									<strong>{dsOwnerInfo.DEBTOR_NM}</strong>
								</div>
								<div className="wa-confirm-item">
									<span>리스 계약자 등록번호</span>
									<strong>
										{dsOwnerInfo.DEBTOR_GB === 'C'
											? dsOwnerInfo.DEBTOR_BIZ_NO
											: dsOwnerInfo.DEBTOR_REG_NO}
									</strong>
								</div>
								<div className="wa-confirm-item">
									<span>리스 계약자 휴대폰번호</span>
									<strong>{dsOwnerInfo.DEBTOR_TEL_NO}</strong>
								</div>
							</div>
						)}

						{ownerType === 'C' && (
							<div className="wa-owner-box">
								<div className="wa-confirm-item">
									<span>리스사명</span>
									<strong>{leaseCompanyName}</strong>
								</div>
								<div className="wa-confirm-item">
									<span>법인등록번호</span>
									<strong>{dsOwnerInfo.DEBTOR_REG_NO}</strong>
								</div>
								<div className="wa-confirm-item">
									<span>사업자등록번호</span>
									<strong>{dsOwnerInfo.DEBTOR_BIZ_NO}</strong>
								</div>
								<div className="wa-confirm-item">
									<span>본점 주소</span>
									<strong>{dsOwnerInfo.DEBTOR_ADDR} {dsOwnerInfo.DEBTOR_ADDR_DT}</strong>
								</div>
								{dsOwnerInfo.DEBTOR_TEL_NO && (
									<div className="wa-confirm-item">
										<span>리스 담당자 연락처</span>
										<strong>{dsOwnerInfo.DEBTOR_TEL_NO}</strong>
									</div>
								)}
							</div>
						)}

				        {/* 공동소유자 */}
				        {Number(dsNewCar.RATIO_NO) !== 100 && dsOwnerInfo && Number(dsOwnerInfo.DEBTOR_RATIO) !== 0 && (
				            <div className="wa-owner-box">

				                <div className="wa-confirm-item">
				                    <span>공동소유자명</span>
				                    <strong>{dsOwnerInfo.DEBTOR_NM}</strong>
				                </div>

				                <div className="wa-confirm-item">
				                    <span>등록번호</span>
				                    <strong>{dsOwnerInfo.DEBTOR_REG_NO}</strong>
				                </div>

				                <div className="wa-confirm-item">
				                    <span>공동소유비율</span>
				                    <strong>{dsOwnerInfo.DEBTOR_RATIO}%</strong>
				                </div>
				            </div>
				        )}

				    </div>

				</div>
						
		        {/* 자동차 정보 */}
		        <div className="wa-confirm-card">
		
		            <div className="wa-confirm-title"
						 onClick={() => onMoveStep?.(2)}
					>
		                자동차 정보
		                <ChevronRight size={18} />
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>차량명</span>
		                <strong>{dsNewCar.CAR_NM}</strong>
		            </div>

		            <div className="wa-confirm-item">
		                <span>공급가액</span>
		                <strong>{Number(dsNewCar.BUY_AMT).toLocaleString()} 원</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>다목적 차량 여부</span>
		                <strong>{dsNewCar.VH_TY_CD === '3' ? '해당' : '미해당'}</strong>
		            </div>
		
		
					<div className="wa-confirm-item">
					    <span>번호판 종류</span>
					    <strong>
					        {
					            dsNUMGB
					                ?.find(item => item.CODE_ID === dsNewCar.NUMPLATE_GB)
					                ?.CODE_NM
					                ?.replace('긴', '페인트') ?? ''
					        }
					    </strong>
					</div>
		
		            <div className="wa-confirm-item">
		                <span>선택 번호</span>
		                <strong>{dsNewCar.REQ_CAR_NO}</strong>
		            </div>
					
		            <div className="wa-confirm-item">
		                <span>SPACE</span>
		                <strong>{dsDLVGB?.find(item => item.CODE_ID === dsCarNoDetach.DELIVERY_GB)?.CODE_NM ?? ''}</strong>
		            </div>
		
		        </div>
		
		        {/* 신규등록 정보 */}
		        <div className="wa-confirm-card">
		
		            <div className="wa-confirm-title"
						onClick={() => onMoveStep?.(3)}
					>
		                신규등록 정보
		                <ChevronRight size={18} />
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>채권처리</span>
		                <strong>{dsNewCar.BOND_DC === 'SELL' ? '매도' : '매입'}</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>감면여부</span>
		                <strong>						
						{dsNewCar.NTAX_TRGET_CD === '00' || dsNewCar.NTAX_TRGET_CD == null || dsNewCar.NTAX_TRGET_CD === ''
						  ? '비감면'
						  : '감면'}
						{' '}
						{dsNewCar.NTAX_TRGET_CD === '00'
						  ? ''
						  : dsNTTCD?.find(item => item.CODE_ID === dsNewCar.NTAX_TRGET_CD)?.CODE_NM ?? ''}
						{' '}
						{dsNewCar.NTAX_TRGET_GR_CD === '0'
						  ? ''
						  : dsNTTGR?.find(item => item.CODE_ID === dsNewCar.NTAX_TRGET_GR_CD)?.CODE_NM ?? ''}
						</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>취득세 카드납부</span>
		                <strong>{dsNewCar.CARD_YN === 'Y' ? '선택' : '미선택'}
						{dsNewCar.CARD_YN === 'Y' && (
				            <span className="wa-confirm-guide">
				                ※ 신규등록 당일 오후 3시까지 취득세를 납부해야 합니다.
				            </span>
				        )}
						</strong>
		            </div>
					
					{dsNewCar.CARD_YN === 'Y' && (
			            <div className="wa-confirm-item">
			                <span>카드납부 금액</span>
			                <strong>{Number(dsPaymentList?.find(item => item.PAY_KD === 'ACQ')?.PAY_AMT).toLocaleString() ?? ''} 원</strong>
			            </div>
					)}
					
		            <div className="wa-confirm-item">
		                <span>납부총액</span>
		                <strong>{Number(dsNewCar.TOTAL_AMT).toLocaleString()} 원
						{dsNewCar.CARD_YN === 'Y' && (
				            <span className="wa-confirm-guide">
				                ※ 취득세 제외한 등록비용
				            </span>
				        )}
						</strong>
		            </div>
					

		            <div className="wa-confirm-item">
		                <span>결제자 연락처</span>
		                <strong>{dsNewCar.PAY_HP_NO}</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>수수료 증빙</span>
		                <strong>{taxReciptNm}</strong>
		            </div>
		
		            <div className="wa-confirm-item">
		                <span>환불정보</span>
		                <strong>{dsBANK?.find(item => item.CODE_ID === dsNewCar.RT_BANK_CD)?.CODE_NM ?? ''} {dsNewCar.RETURN_NO} {dsNewCar.RETURN_NM}</strong>
		            </div>
		        </div>
				
				{/* 첨부 서류 */}
				{showAttachButton && (
				    <button
				        type="button"
				        className="wa-attach-btn"
				        onClick={() => setAttachModalOpen(true)}
				    >
				        <FileText size={18} />
				        첨부 서류 업로드
				    </button>
				)}
				
				<WaNewcarAttachModal
				    open={attachModalOpen}
				    dsService={dsService}
				    dsNewCar={dsNewCar}
					dsOwnerInfo={dsOwnerInfo}
					dsUserInfo={dsUserInfo}
					dsCarNoDetach={dsCarNoDetach}
					setDsCarNoDetach={setDsCarNoDetach}
					saveProcess={saveProcess}
					onClose={() => {
					    setAttachModalOpen(false);
					    onAttachClose?.();
					}}
				/>

				{rejectModalOpen && (
					<div className="wa-attach-modal-backdrop" onClick={() => setRejectModalOpen(false)}>
						<div
							className="wa-attach-modal wa-reject-modal"
							role="dialog"
							aria-modal="true"
							aria-labelledby="wa-reject-modal-title"
							onClick={event => event.stopPropagation()}
						>
							<div className="wa-attach-modal-header">
								<h3 id="wa-reject-modal-title">반려 확인</h3>
								<button
									type="button"
									className="wa-attach-modal-close"
									aria-label="반려 확인 닫기"
									onClick={() => setRejectModalOpen(false)}
								>
									<X size={22} />
								</button>
							</div>
							<div className="wa-attach-modal-body wa-reject-modal-body">
								<p>
									반려 사유 확인하여 내용 수정 후 재요청해 주세요.
									<br />
									요청 시 바로 등록요청으로 넘어갑니다.
									{' '}
									<span>(Admin 확인 생략)</span>
								</p>
								<strong>반려 사유</strong>
								<div className="wa-reject-modal-reason">
									{rejectReason || '반려 사유가 등록되지 않았습니다.'}
								</div>
								<button
									type="button"
									className="wa-reject-modal-confirm"
									onClick={() => setRejectModalOpen(false)}
								>
									확인
								</button>
							</div>
						</div>
					</div>
				)}
		    </div>
        </>
    );

};

export default ConfirmInfo;
