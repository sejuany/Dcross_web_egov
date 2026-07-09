import { React } from 'react';

import '../../styles/WaReceipt.css';

const WaPaymentReceipt = (
	
	 
) => {
	
	return (
		<div className="receipt-wrapper">
		    <div className="receipt-page">

			<div className="receipt-page">
			    <div className="receipt-title-top">DACOS</div>
			    <div className="receipt-title-main">통합 납부 영수증</div>

			    <div className="receipt-blue-box">
			        <div className="receipt-blue-box-inner">
			            <div className="receipt-info-text">
			                <div>고객명(상호): 폴스타오토모티브코리아</div>
			                <div>
			                    차량번호: 18고1757
			                    <span className="receipt-vin-text">
			                        (차대번호: YSM4ZPAA3VF425082)
			                    </span>
			                </div>
			            </div>

			            <div className="receipt-total-section">
			                <div className="receipt-total-label">최종 정산 합계</div>
			                <div className="receipt-total-value">4,659,388 원</div>
			            </div>
			        </div>
			    </div>

			    <div className="receipt-section-title">1. 세금 내역</div>

			    <table className="receipt-table">
			        <thead>
			            <tr>
			                <th>항목별</th>
			                <th>금액</th>
			                <th>비고</th>
			            </tr>
			        </thead>

			        <tbody>
			            <tr>
			                <td>취득세</td>
			                <td>3,766,940 원</td>
			                <td>차량 공급가액(53,813,448원) × 7%</td>
			            </tr>

			            <tr>
			                <td>등록면허세</td>
			                <td>0 원</td>
			                <td>차량 등록에 따른 법정 면허세</td>
			            </tr>

			            <tr>
			                <td>인지세</td>
			                <td>3,000 원</td>
			                <td>국가 수입인지 (법정 고정 금액)</td>
			            </tr>

			            <tr>
			                <td>증지대</td>
			                <td>2,500 원</td>
			                <td>지자체 등록 수수료 (법정 고정 금액)</td>
			            </tr>

			            <tr className="receipt-row-total">
			                <td>세금 합계 (A)</td>
			                <td>3,772,440 원</td>
			                <td>취득세 + 등록면허세 + 인지세 + 증지대</td>
			            </tr>
			        </tbody>
			    </table>

			    <div className="receipt-section-title">
			        2. 수수료 내역 (세금계산서/현금영수증 발행)
			    </div>

			    <table className="receipt-table">
			        <thead>
			            <tr>
			                <th>항목별</th>
			                <th>금액</th>
			                <th>비고 (VAT 포함)</th>
			            </tr>
			        </thead>

			        <tbody>
			            <tr>
			                <td>등록 대행 수수료</td>
			                <td>33,000 원</td>
			                <td></td>
			            </tr>

			            <tr>
			                <td>번호판 비용</td>
			                <td>28,600 원</td>
			                <td>필름 번호판</td>
			            </tr>

			            <tr>
			                <td>채권 처리 대행 수수료</td>
			                <td>8,670 원</td>
			                <td></td>
			            </tr>

			            <tr className="receipt-row-total">
			                <td>수수료 합계 (B)</td>
			                <td>70,670 원</td>
			                <td>등록 대행 수수료 + 번호판비용 + 채권 처리 대행 수수료</td>
			            </tr>
			        </tbody>
			    </table>

			    <div className="receipt-section-title">3. 채권 내역 (신한은행)</div>

			    <table className="receipt-table">
			        <thead>
			            <tr>
			                <th>항목별</th>
			                <th>금액</th>
			                <th>비고</th>
			            </tr>
			        </thead>

			        <tbody>
			            <tr>
			                <td>채권 매입 금액</td>
			                <td>2,690,000 원</td>
			                <td>의무 매입 채권 등급</td>
			            </tr>

			            <tr>
			                <td>채권 매도 금액</td>
			                <td>2,278,968 원</td>
			                <td>채권 즉시 매도 금액</td>
			            </tr>

			            <tr>
			                <td>선급 이자</td>
			                <td>2,063 원</td>
			                <td>채권 즉시 매도 선급이자</td>
			            </tr>

			            <tr className="receipt-row-total">
			                <td>채권 합계 (C)</td>
			                <td>413,095 원</td>
			                <td>매입금액 - 매도금액 + 선급이자</td>
			            </tr>
			        </tbody>
			    </table>

			    <div className="receipt-section-title">4. 최종 정산 내역</div>

			    <div className="receipt-final-box">
			        <div className="receipt-final-row">
			            <span>고객 입금 금액</span>
			            <span>4,800,000 원</span>
			        </div>

			        <div className="receipt-final-row">
			            <span>등록 금액</span>
			            <span>4,256,205 원</span>
			        </div>

			        <div className="receipt-final-row receipt-refund-amount">
			            <span>환불 금액</span>
			            <span>543,795 원</span>
			        </div>

			        <div className="receipt-refund-date">
			            ※ 환불 처리 날짜 : 2026.07.01
			        </div>
			    </div>

			    <div className="receipt-footer">
			        <div>전자납부번호로 각 세금 항목의 납부 여부를 확인할 수 있습니다.</div>
			        <div>취득세(등록면허세) 납부 확인은 위택스(www.wetax.go.kr)에서 전자납부번호로 확인 및 출력이 가능합니다.</div>
			    </div>
			</div>
			
			
			</div>
		</div>
	);
};

export default WaPaymentReceipt;