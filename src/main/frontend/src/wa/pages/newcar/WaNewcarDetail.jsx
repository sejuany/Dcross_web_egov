import  React, {useState} from 'react';

import axios from 'axios';
import { CalendarDays, CarFront, FileText, LoaderCircle, UserRound, Search } from 'lucide-react';
import { gf, log, mapData, toast } from '../../../utils/utils';
import { useSearchParams } from 'react-router-dom';

import '../../styles/WaNewcarDetail.css';
// 첨부서류 모달
import WaNewcarAttachModal from './WaNewcarAttachModal';
import WaTaxReceiptModal from './WaTaxReceiptModal';

// 결제관리 코드명 변환
const paymentInfo = {
    ACQ:   { order: 1, name: '취득세' },
    UREG:  { order: 2, name: '등록면허세' },
    INJI:  { order: 3, name: '인지세' },
    STAMP: { order: 4, name: '증지대' },
    BOND:  { order: 5, name: '채권' },
    BFEE:  { order: 6, name: '채권취급수수료' },
    FEE:   { order: 7, name: '등록수수료' },
    TNUM:  { order: 8, name: '번호판대' },
    SPARE:  { order: 9, name: '취득세 카드납부 ' },
    UNUM: { order: 10, name: '입금 합계' }
};

// 결제정보 행 스타일
const getPaymentRowClass = (payKd) => {

    if (['BFEE', 'FEE', 'TNUM'].includes(payKd)) {
        return 'payment-gray';
    }

    if (['UNUM', 'SPARE'].includes(payKd)) {
        return 'payment-blue';
    }

    return '';
};

const WaNewcarDetail = ({
    dsService,
    dsNewCar,
    dsOwnerInfo,
    dsOwnerInfo1,
    dsPaymentList,
    dsCarNoDetach,
    dsCompanyInfo,
    dsWorkCp,
    dsUserInfo,
	loading,
	dsTaxReceipt,
	saveProcess,
	setDsCarNoDetach,
	dsBaseList,
	onClose,
	dsPR_ST,
	dsFUEL,
	dsNUMGB,
	dsDLVGB,
	dsBANK,
	dsNTTCD,
	dsNTTGR
}) => {
	// 첨부서류 모달
	const [attachModalOpen, setAttachModalOpen] = useState(false);
	const [receiptModalOpen, setReceiptModalOpen] = useState(false);
	const [searchParams] = useSearchParams();
	const serviceId = searchParams.get('serviceId');
	
	// 영수증
	const handleReceipt = () => {
		window.open(
		    `/wa/newcar/receipt/${dsService.SERVICE_ID}`,
		    'paymentReceipt',
		    'width=1000,height=1200,left=200,top=50,resizable=yes,scrollbars=yes'
		);
	};
	console.log(dsPaymentList);
	// 결제정보 정렬
	const detailPaymentList = dsPaymentList.filter(item => dsNewCar.CARD_YN === 'Y' || item.PAY_KD !== 'SPARE').map(item => {
	    if (item.PAY_KD === 'SPARE') {
	        return {
	            ...item,
	            PAY_AMT: dsPaymentList.find(v => v.PAY_KD === 'ACQ')?.PAY_AMT ?? 0,
	            PRE_PAY_AMT: dsPaymentList.find(v => v.PAY_KD === 'ACQ')?.PRE_PAY_AMT ?? 0,
	        };
	    }

		if (item.PAY_KD === 'UNUM') {
		    const paymentList =
		        dsNewCar.CARD_YN === 'Y'
		            ? dsPaymentList.filter(v => v.PAY_KD !== 'ACQ')
		            : dsPaymentList;

		    const { totalPayAmt, totalPrePayAmt } = paymentList.reduce(
		        (acc, v) => {
		            acc.totalPayAmt += Number(v.PAY_AMT || 0);
		            acc.totalPrePayAmt += Number(v.PRE_PAY_AMT || 0);
		            return acc;
		        },
		        {
		            totalPayAmt: 0,
		            totalPrePayAmt: 0,
		        }
		    );

		    return {
		        ...item,
		        PAY_AMT: totalPayAmt,
		        PRE_PAY_AMT: totalPrePayAmt,
		    };
		}

	    return item;
	}).sort(
	    (a, b) =>
	        (paymentInfo[a.PAY_KD]?.order ?? 999) -
	        (paymentInfo[b.PAY_KD]?.order ?? 999)
	);
	
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
	
	const handleDeliverySearch = () => {
	    const songjangNo = (dsCarNoDetach?.SONGJANG_NO || '').replace(/-/g, '');

	    if (!songjangNo) {
	        gf.alert('송장번호가 없습니다.');
	        return;
	    }

	    window.open(
	        `https://service.epost.go.kr/trace.RetrieveRegiPrclDeliv.postal?sid1=${songjangNo}`,
	        '_blank'
	    );
	};
	
	const showAttachButton =
	    dsNewCar.REG_GB === 'F' || // 외국인
	    Number(dsNewCar.RATIO_NO) !== 100 || // 공동소유자 있는 경우
	    dsNewCar.NTAX_TRGET_CD !== '00'; // 비과세 대상자
		
	const handleOpenAttachModal = () => {
		console.log('클릭', showAttachButton, dsNewCar);
	    if (!showAttachButton) {
	        gf.alert('서류 확인 대상건이 아닙니다.');
	        return;
	    }

	    setAttachModalOpen(true);
	};
	
	const handleReceiptInfo = () => {
	    if (taxReciptNm === '없음') {
	        gf.alert('수수료 증빙 정보가 없습니다.');
	        return;
	    }

	    setReceiptModalOpen(true);
	};
	
	// 등록증
	const handleRegistCert = async () => {
	    try {
			
			if (!dsService.JUDGE_DT) {
		        gf.alert("등록이 완료되면 등록증 다운로드가 가능합니다.");
		        return;
		    }

		    const judgeDt = dsService.JUDGE_DT
		        .replace(/[^0-9]/g, '')   // 숫자만
		        .slice(2);                // 앞의 20 제거 → 260715

	        const response = await axios.get(
	            `/api/newcar/carpaper/download?date=${judgeDt}&carNo=${encodeURIComponent(dsNewCar.CAR_NO)}`,
	            {
	                responseType: 'blob'
	            }
	        );

	        const url = window.URL.createObjectURL(response.data);

	        const link = document.createElement('a');
	        link.href = url;
	        link.download = `${dsNewCar.CAR_NO}.pdf`;
	        link.click();

	        window.URL.revokeObjectURL(url);

	    } catch (error) {
	        if (error.response?.status === 404) {
	            gf.alert('해당 등록증 파일을 찾을 수 없습니다.');
	            return;
	        }

	        gf.alert('등록증 다운로드 중 오류가 발생했습니다.');
	    }
	};
	
	
	const handleCancel = async () => {
		const ok = await gf.confirm("등록을 취소하시겠습니까?");

		if (!ok) return;
		
		// 등록취소 알림 띄우기
		try {
	        await axios.post("/api/common/procedure/board", {
	            SERVICE_ID: dsService.SERVICE_ID,
	            CONTENT_TX: "[신차사업] 등록 취소!! 관청에 확인 필요",
	            GUBUN: "2"
	        });

	        gf.alert("등록 취소 요청이 완료되었습니다.");

	        // 필요 시 화면 닫기
	        // onClose();

	    } catch (error) {
	        console.error(error);
	        gf.alert("등록 취소 중 오류가 발생했습니다.");
	    }
	};
					
    return (
		<div className="wa-request-page">

			{loading && (
			    <div className="wa-loading">
			        <LoaderCircle size={24} className="wa-spin" />
			        <span>불러오는 중</span>
			    </div>
			)}
			
			<div className="wa-request-card detail">
	
				{/* 처리상태 / 반려사유 */}
				<div className="wa-detail-header">
	
				    <div className="wa-detail-status">
				        <span className="wa-detail-type">
				            {dsNewCar.PROC_CD === 'C'
							? '이용자명의리스'
								:dsNewCar.REG_GB === 'R' || dsNewCar.REG_GB === 'F'
			                	? '개인'
			                		: dsNewCar.TASK_CD === 'LEASE'
		                    		? '리스'
										: dsNewCar.REG_GB === 'B'
									    ? '법인'
			                   				 : ''}
				        </span>
						
				        <span>처리상태</span>
		                <span className="wa-detail-arrow">&gt;</span>
		                <span>{dsPR_ST?.find(item => item.CODE_ID === dsService.PROC_ST)?.CODE_NM ?? ''}</span>
				    </div>
	
				    {dsService.PROC_ST === 'RET' && (
				        <div className="wa-detail-reason">
				            <span className="wa-detail-label">반려 사유 :</span>
				            <span>{dsService.RETURN_TX}</span>
				        </div>
				    )}
	
				</div>
				

				{/* 차량 정보 */}
				<div className="simple-summary detail">

					<div className="summary-item">
						<div className="summary-icon">
							<FileText size={16} />
						</div>

						<div>
							<div className="summary-label">주문번호</div>
							<div className="summary-value">
								{dsService.LINK_ID || '-'}
							</div>
						</div>
					</div>

					<div className="summary-item">
						<div className="summary-icon">
							<CarFront size={16} />
						</div>

						<div>
							<div className="summary-label">차대번호</div>
							<div className="summary-value">
								{dsNewCar.CARID_NO || '-'}
							</div>
						</div>
					</div>

					<div className="summary-item">
						<div className="summary-icon">
							<UserRound size={16} />
						</div>

						<div>
							<div className="summary-label">계약자명</div>
							<div className="summary-value">
								{dsNewCar.OWNER_NM || '-'}
							</div>
						</div>
					</div>

					<div className="summary-item">
						<div className="summary-icon">
							<CalendarDays size={16} />
						</div>

						<div>
							<div className="summary-label">등록 예정일</div>
							<div className="summary-value">
								{dsNewCar.REGIST_DATE || '-'}
							</div>
						</div>
					</div>

				</div>

				{/* 소유자 정보 */}
				<div className="wa-detail-box">

				    <div className="wa-detail-grid two">

				        <div className="wa-detail-col">
							{/* 개인 */}
						    {ownerType === 'R' && (
								<>
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">대표소유자명</span>
					                <span>{dsNewCar.OWNER_NM || '-'}</span>
					            </div>
	
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">등록번호</span>
					                <span>{dsNewCar.REG_NO || '-'}</span>
					            </div>
	
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">등본상 주소</span>
					                <span>
					                    {`${dsNewCar.BASE_ADDRESS || ''} ${dsNewCar.BASE_ADDRESS_DT || ''}`}
					                </span>
					            </div>
	
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">대표소유비율</span>
					                <span>{dsNewCar.RATIO_NO || '-'}%</span>
					            </div>
	
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">휴대폰번호</span>
					                <span>{dsNewCar.MPHONE_NO || '-'}</span>
					            </div>
								</>
							)}
							
							{/* 법인 */}
							{ownerType === 'B' && (
								<>
								<div className="wa-detail-row">
					                <span className="wa-detail-name">대표소유자 상호명</span>
					                <span>{dsNewCar.OWNER_NM || '-'}</span>
					            </div>

					            <div className="wa-detail-row">
					                <span className="wa-detail-name">법인등록번호</span>
					                <span>{dsNewCar.REG_NO || '-'}</span>
					            </div>

					            <div className="wa-detail-row">
					                <span className="wa-detail-name">사업자등록번호</span>
					                <span>{dsNewCar.BIZ_NO || '-'}</span>
					            </div>

					            <div className="wa-detail-row">
					                <span className="wa-detail-name">휴대폰번호</span>
					                <span>{dsNewCar.MPHONE_NO || '-'}</span>
					            </div>

					            <div className="wa-detail-row">
					                <span className="wa-detail-name">본점 소재지</span>
					                <span>
					                    {`${dsNewCar.ADDRESS || ''} ${dsNewCar.ADDRESS_DT || ''}`}
					                </span>
					            </div>

					            <div className="wa-detail-row">
					                <span className="wa-detail-name">사업장 주소</span>
					                <span>
					                    {`${dsNewCar.BASE_ADDRESS || ''} ${dsNewCar.BASE_ADDRESS_DT || ''}`}
					                </span>
					            </div>
								</>
							)}
							
							{/* 리스 */}
							{ownerType === 'L' && (
								<>
								<div className="wa-detail-row">
					                <span className="wa-detail-name">리스사명</span>
					                <span>{dsBaseList?.find(item => String(item.BASE_ID) === String(dsNewCar.BASE_BRANCH_ID))?.BASE_NM || '-'}</span>
					            </div>
								<div className="wa-detail-row">
					                <span className="wa-detail-name">리스 계약자명</span>
					                <span>{dsNewCar.OWNER_NM || '-'}</span>
					            </div>
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">리스 계약자 등록번호</span>
					                <span>{dsNewCar.REG_NO || '-'}</span>
					            </div>
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">리스 계약자 휴대폰번호</span>
					                <span>{dsNewCar.MPHONE_NO || '-'}</span>
					            </div>
								</>
							)}

							{/* 이용자명의리스 */}
							{ownerType === 'C' && (
								<>
								<div className="wa-detail-row">
					                <span className="wa-detail-name">리스사명</span>
					                <span>{dsBaseList?.find(item => String(item.BASE_ID) === String(dsNewCar.BASE_BRANCH_ID))?.BASE_NM || '-'}</span>
					            </div>
								<div className="wa-detail-row">
					                <span className="wa-detail-name">리스 종료일</span>
					                <span>{dsNewCar.IMSIGV_DT || '-'}</span>
					            </div>
								<div className="wa-detail-row">
					                <span className="wa-detail-name">대표 소유자명</span>
					                <span>{dsNewCar.OWNER_NM || '-'}</span>
					            </div>
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">등록번호</span>
					                <span>{dsNewCar.REG_NO || '-'}</span>
					            </div>
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">휴대폰번호</span>
					                <span>{dsNewCar.MPHONE_NO || '-'}</span>
					            </div>
								<div className="wa-detail-row">
					                <span className="wa-detail-name">등본상 주소/본점소재지</span>
					                <span>
					                    {`${dsNewCar.ADDRESS || ''} ${dsNewCar.ADDRESS_DT || ''}`}
					                </span>
					            </div>

					            <div className="wa-detail-row">
					                <span className="wa-detail-name">사용본거지(법인)</span>
					                <span>
					                    {`${dsNewCar.BASE_ADDRESS || ''} ${dsNewCar.BASE_ADDRESS_DT || ''}`}
					                </span>
					            </div>
								</>
							)}
				        </div>
						
						{/* 공동소유자 */}
				        {Number(dsNewCar.RATIO_NO) !== 100 && dsOwnerInfo && Number(dsOwnerInfo.DEBTOR_RATIO) !== 0 && (
					        <div className="wa-detail-col">
	
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">공동소유자명</span>
					                <span>{dsOwnerInfo.DEBTOR_NM || '-'}</span>
					            </div>
	
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">등록번호</span>
					                <span>{dsOwnerInfo.DEBTOR_REG_NO || dsOwnerInfo.DEBTOR_BIZ_NO || '-'}</span>
					            </div>
	
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">등본상 주소</span>
					                <span>
					                    {`${dsOwnerInfo.DEBTOR_ADDR || ''} ${dsOwnerInfo.DEBTOR_ADDR_DT || ''}`}
					                </span>
					            </div>
	
					            <div className="wa-detail-row">
					                <span className="wa-detail-name">공동소유비율</span>
					                <span>{dsOwnerInfo.DEBTOR_RATIO || '-'}%</span>
					            </div>
	
					        </div>
						)}

				    </div>

				</div>
				
				{/* 자동차 제원 */}
				<div className="wa-detail-box">

				    <div className="wa-detail-grid two">

				        <div className="wa-detail-col">

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">공급가액</span>
				                <span>{dsNewCar.BUY_AMT ? `${gf.formatAmount(dsNewCar.BUY_AMT)} 원` : '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">차량명</span>
				                <span>{dsNewCar.CAR_NM || '-'} </span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">차종</span>
				                <span>{dsNewCar.CAR_KD || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">배기량</span>
				                <span>{dsNewCar.CAR_CC ? `${dsNewCar.CAR_CC} cc` : '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">승차정원</span>
				                <span>{dsNewCar.GETIN_NO ? `${dsNewCar.GETIN_NO} 인승` : '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">사용연료</span>
				                <span>{dsFUEL?.find(item => item.CODE_ID === dsNewCar.FUEL_CD)?.CODE_NM ?? '-'}</span>
				            </div>

				        </div>

				        <div className="wa-detail-col">
				            <div className="wa-detail-row">
				                <span className="wa-detail-name">형식명</span>
				                <span>{dsNewCar.COLOR_GB || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">원동기형식명</span>
				                <span>{dsNewCar.FM_NM || '-'}</span>
				            </div>

				        </div>

				    </div>

				</div>
				
				{/* 자동차 정보 */}
				<div className="wa-detail-box">
				    <div className="wa-detail-info">
				        <div className="wa-detail-left">

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">다목적 차량 여부</span>
				                <span>{dsNewCar.VH_TY_CD === '3' ? '해당' : '미해당'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">번호판 종류</span>
				                <span>{dsNUMGB?.find(item => item.CODE_ID === dsNewCar.NUMPLATE_GB)?.CODE_NM ?? '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">선택 번호</span>
				                <span>{dsNewCar.REQ_CAR_NO || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">SPACE</span>
				                <span>{dsDLVGB?.find(item => item.CODE_ID === dsCarNoDetach.DELIVERY_GB)?.CODE_NM ?? '-'}</span>
				            </div>

				        </div>

				        <div className="wa-detail-right">

							<button type="button" className="wa-detail-delivery-btn" onClick={handleDeliverySearch}>
						    	<Search size={20} strokeWidth={2.5} />
				                <span>배송현황</span>
				            </button>

				        </div>
				    </div>
				</div>
				
				
				{/* 신규등록 정보 */}
				<div className="wa-detail-box">

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">채권처리</span>
				        <span>{dsNewCar.BOND_DC === 'SELL' ? '매도' : '매입'}</span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">감면여부</span>
				        <span>
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
				        </span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">취득세 카드납부</span>

				        <span>
				            {dsNewCar.CARD_YN === 'Y' ? '선택' : '미선택'}
				        </span>
						{dsNewCar.CARD_YN === 'Y' && (
					        <span className="wa-detail-desc">
					            ※ 신규등록 당일 오후 3시까지 취득세를 납부해야 합니다.
					        </span>
						)}
				    </div>
					
					{dsNewCar.CARD_YN === 'Y' && (
					    <div className="wa-detail-row">
					        <span className="wa-detail-name">카드납부 금액</span>
					        <span>{Number(dsPaymentList?.find(item => item.PAY_KD === 'ACQ')?.PAY_AMT).toLocaleString() ?? '-'} 원</span>
					    </div>
					)}

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">납부총액</span>

				        <span>
				            {gf.formatAmount(dsNewCar.TOTAL_AMT) || '-'} 원
				        </span>
						{dsNewCar.CARD_YN === 'Y' && (
					        <span className="wa-detail-desc">
					            ※ 취득세 제외한 등록비용
					        </span>
						)}
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">결제자 연락처</span>
				        <span>{gf.formatPhoneNo(dsNewCar.PAY_HP_NO) || '-'}</span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">수수료 증빙</span>
				        <span>{taxReciptNm}</span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">환불정보</span>

				        <span>
				            {dsBANK?.find(item => item.CODE_ID === dsNewCar.RT_BANK_CD)?.CODE_NM ?? ''} {dsNewCar.RETURN_NO} {dsNewCar.RETURN_NM}
				        </span>
				    </div>
				</div>
				
				{/* 첨부서류 */}
				<div className="wa-detail-file-buttons">
				    <button
				        type="button"
				        className="wa-detail-file-btn"
				        onClick={handleOpenAttachModal}
				    >
				        첨부 서류 확인
				    </button>

				    <button
				        type="button"
				        className="wa-detail-file-btn"
				        onClick={handleReceiptInfo}
				    >
				        수수료 증빙 정보
				    </button>

				    <button
				        type="button"
				        className="wa-detail-file-btn"
				        onClick={handleReceipt}
				    >
				        영수증
				    </button>

				    <button
				        type="button"
				        className="wa-detail-file-btn"
				        onClick={handleRegistCert}
				    >
				        등록증
				    </button>

				</div>
				
				{/* 결제 정보 */}
				<table className="wa-payment-table">
				    <thead>
				        <tr>
				            <th>결제종류</th>
				            <th>예상금액</th>
				            <th>최종금액</th>
				        </tr>
				    </thead>

				    <tbody>
				        {detailPaymentList.map(item => (
				            <tr key={item.PAY_KD} className={getPaymentRowClass(item.PAY_KD)}>
				                <td>{paymentInfo[item.PAY_KD]?.name}</td>
				                <td>{gf.formatAmount(item.PRE_PAY_AMT)}</td>
				                <td>{gf.formatAmount(item.PAY_AMT)}</td>
				            </tr>
				        ))}
				    </tbody>
				</table>
				
				{/* 하단 버튼 */}
				<div className="wa-detail-bottom-btns">
					<button
	                    type="button"
	                    className="wa-btn-primary"
	                    onClick={onClose}
	                >
	                    닫기
	                </button>

				    <button
				        type="button"
				        className="wa-btn-secondary"
				        onClick={handleCancel}
				    >
				        등록 취소
				    </button>
				</div>
				
				<WaNewcarAttachModal
				    open={attachModalOpen}
				    dsService={dsService}
				    dsNewCar={dsNewCar}
					dsUserInfo={dsUserInfo}
					dsCarNoDetach={dsCarNoDetach}
					setDsCarNoDetach={setDsCarNoDetach}
					saveProcess={saveProcess}
				    onClose={() => setAttachModalOpen(false)}
				/>
				
				<WaTaxReceiptModal
				    open={receiptModalOpen}
				    onClose={() => setReceiptModalOpen(false)}
				    dsTaxReceipt={dsTaxReceipt}
				/>
				
			</div>
		</div>
    );
};

export default WaNewcarDetail;