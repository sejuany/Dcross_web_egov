import { React } from 'react';

import { CalendarDays, CarFront, FileText, LoaderCircle, UserRound, Search } from 'lucide-react';
import { gf, log, mapData, toast } from '../../../utils/utils';
import { useSearchParams } from 'react-router-dom';

import '../../styles/WaNewcarDetail.css';

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
    UNUM:  { order: 9, name: '취득세 카드납부' },
    SPARE: { order: 10, name: '입금 합계' }
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

// 첨부서류 확인
const handleAttachFile = () => {
    gf.alert('준비중입니다.');
};

// 수수료 증빙 정보
const handleReceiptInfo = () => {
    gf.alert('준비중입니다.');
};

// 등록증
const handleRegistCert = () => {
    gf.alert('준비중입니다.');
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
}) => {
	
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
	
	// 결제정보 정렬
	const detailPaymentList = [...dsPaymentList].sort(
	    (a, b) =>
	        (paymentInfo[a.PAY_KD]?.order ?? 999) -
	        (paymentInfo[b.PAY_KD]?.order ?? 999)
	);
	
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
				            {dsNewCar.REG_GB === 'R'
				                ? '개인'
				                : dsNewCar.TASK_CD === 'LEASE'
				                    ? '리스'
				                    : '법인'}
				        </span>
	
				        <span className="wa-detail-arrow">&gt;</span>
	
				        <span>{dsService.PROC_ST_NM || dsService.PROC_ST}</span>
	
				        {dsService.JUDGE_ST && (
				            <>
				                <span className="wa-detail-arrow">&gt;</span>
				                <span>{dsService.JUDGE_ST_NM || dsService.JUDGE_ST}</span>
				            </>
				        )}
				    </div>
	
				    {dsService.PROC_ST === 'RET' && (
				        <div className="wa-detail-reason">
				            <span className="wa-detail-label">반려 사유 :</span>
				            <span>{dsService.RETURN_MSG || '-'}</span>
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

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">대표소유자명</span>
				                <span>{dsNewCar.REG_GB === 'R' ? '개인' : '법인'}</span>
				                <span>{dsNewCar.OWNER_NM || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">등록번호</span>
				                <span>{dsNewCar.REG_NO || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">등본상 주소</span>
				                <span>
				                    {`${dsNewCar.ADDRESS || ''} ${dsNewCar.ADDRESS_DT || ''}`}
				                </span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">공동소유비율</span>
				                <span>{dsOwnerInfo.RATIO_NO || '-'}%</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">휴대폰번호</span>
				                <span>{dsNewCar.MPHONE_NO || '-'}</span>
				            </div>

				        </div>

				        <div className="wa-detail-col">

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">공동소유자명</span>
				                <span>{dsOwnerInfo.DEBTOR_GB === 'R' ? '개인' : '법인'}</span>
				                <span>{dsOwnerInfo.DEBTOR_NM || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">등록번호</span>
				                <span>{dsOwnerInfo.DEBTOR_REG_NO || dsOwnerInfo.DEBTOR_BIZ_NO || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">등본상 주소</span>
				                <span>
				                    {`${dsOwnerInfo.DEBTOR_ADDRESS || ''} ${dsOwnerInfo.DEBTOR_ADDRESS_DT || ''}`}
				                </span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">공동소유비율</span>
				                <span>{dsOwnerInfo.DEBTOR_RATIO_NO || '-'}%</span>
				            </div>

				        </div>

				    </div>

				</div>
				
				{/* 자동차 제원 */}
				<div className="wa-detail-box">

				    <div className="wa-detail-grid two">

				        <div className="wa-detail-col">

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">공급가액</span>
				                <span>{gf.formatAmount(dsNewCar.BUY_AMT) || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">차량명</span>
				                <span>{dsNewCar.CAR_NM || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">차종</span>
				                <span>{dsNewCar.CAR_TYPE || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">배기량</span>
				                <span>{dsNewCar.CC || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">승차정원</span>
				                <span>{dsNewCar.PASSENGER || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">사용연료</span>
				                <span>{dsNewCar.FUEL_NM || '-'}</span>
				            </div>

				        </div>

				        <div className="wa-detail-col">

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">차체길이</span>
				                <span>{dsNewCar.LENGTH || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">차체너비</span>
				                <span>{dsNewCar.WIDTH || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">차체높이</span>
				                <span>{dsNewCar.HEIGHT || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">최대적재량</span>
				                <span>{dsNewCar.LOAD_QTY || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">차량총중량</span>
				                <span>{dsNewCar.TOTAL_WEIGHT || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">형식명</span>
				                <span>{dsNewCar.TYPE_NM || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">원동기형식명</span>
				                <span>{dsNewCar.ENGINE_TYPE || '-'}</span>
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
				                <span>{dsNewCar.MULTI_YN_NM || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">번호판 종류</span>
				                <span>{dsNewCar.NUMPLATE_GB_NM || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">선택 번호</span>
				                <span>{dsService.CAR_NO || '-'}</span>
				            </div>

				            <div className="wa-detail-row">
				                <span className="wa-detail-name">SPACE</span>
				                <span>{dsWorkCp.SPACE_NM || '-'}</span>
				            </div>

				        </div>

				        <div className="wa-detail-right">

							<button type="button" className="wa-detail-delivery-btn">
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
				        <span>{dsNewCar.BOND_YN_NM || '-'}</span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">감면여부</span>
				        <span>
				            {[
				                dsNewCar.EXEMPT_DISABLED === 'Y' && '장애인',
				                dsNewCar.EXEMPT_VETERAN === 'Y' && '국가유공자',
				                dsNewCar.EXEMPT_MULTI === 'Y' && '다자녀'
				            ].filter(Boolean).join(' | ') || '-'}
				        </span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">취득세 카드납부</span>

				        <span>
				            {dsNewCar.CARD_PAY_YN === 'Y' ? '선택' : '미선택'}
				        </span>

				        <span className="wa-detail-desc">
				            ※ 신규등록 당일 오후 3시까지 취득세를 납부해야 합니다.
				        </span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">카드납부 금액</span>
				        <span>{gf.formatAmount(dsNewCar.CARD_PAY_AMT) || '-'} 원</span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">납부총액</span>

				        <span>
				            {gf.formatAmount(dsNewCar.TOTAL_AMT) || '-'} 원
				        </span>

				        <span className="wa-detail-desc">
				            ※ 취득세 제외한 등록비용
				        </span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">결제자 연락처</span>
				        <span>{gf.formatPhoneNo(dsNewCar.MPHONE_NO) || '-'}</span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">수수료 증빙</span>
				        <span>{dsNewCar.RECEIPT_GB_NM || '-'}</span>
				    </div>

				    <div className="wa-detail-row">
				        <span className="wa-detail-name">환불정보</span>

				        <span>
				            {[
				                dsNewCar.RT_BANK_NM,
				                dsNewCar.RT_ACC_NO,
				                dsNewCar.RT_ACC_NM
				            ].filter(Boolean).join('   ')}
				        </span>
				    </div>
				</div>
				
				{/* 첨부서류 */}
				<div className="wa-detail-file-buttons">

				    <button
				        type="button"
				        className="wa-detail-file-btn"
				        onClick={handleAttachFile}
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
				
				
				
				
			</div>
		</div>
    );
};

export default WaNewcarDetail;