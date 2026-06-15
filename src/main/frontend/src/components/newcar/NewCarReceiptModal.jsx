import React, { useEffect, useState } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';

import './NewCarReceiptModal.css';

const NewCarReceiptModal = ({
    dsService,
    dsNewCar,
    dsPaymentList,
    dsCompanyInfo,
    gf,
    onClose
}) => {
	
	// 채권 조회용
	const [dsBondInfo, setDsBondInfo] = useState({});
	// 관청명 조회
	const [govtNm, setGovtNm] = useState('');

	// 채권정보 조회
	const loadBondInfo = async () => {

	    if (!dsService.SERVICE_ID) {
	        return;
	    }

	    try {

	        const [bondRes, govtRes] = await Promise.all([
	            axios.get(
	                `/api/newcar/bond-info/${dsService.SERVICE_ID}`
	            ),
	            axios.post('/api/common/query', {
	                QUERY_ID: 'getGovtNM',
	                SERVICE_ID: dsService.SERVICE_ID
	            })
	        ]);

	        // 채권정보
	        setDsBondInfo(bondRes.data.data || {});

	        // 관청명
	        setGovtNm(
	            govtRes.data.data?.GOVT_NM || ''
	        );

	    } catch (e) {
	        console.error('채권정보 조회 실패', e);
	    }
	};

	// 모달 오픈 시 채권정보 조회
	useEffect(() => {
	    loadBondInfo();
	}, []);
    
    // 인쇄
    const handlePrint = () => {
        window.print();
    };

    // PDF 저장
    const handlePdfDownload = () => {

        const element = document.querySelector('.receipt-modal-body');

        html2pdf()
            .from(element)
            .set({
                margin: 10,
                filename: `납부영수증_${dsService.SERVICE_ID}_${dsNewCar.CAR_NO}.pdf`,
                image: { type: 'jpeg', quality: 1 },
                html2canvas: { scale: 2 },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait'
                }
            })
            .save();
    }; 
	

	// 결제종류(PAY_KD)로 결제금액(PAY_AMT) 조회
	// 예)
	// ACQ   : 취득세
	// INJI  : 인지세
	// STAMP : 증지대
	// TNUM  : 번호판대
	// FEE   : 등록수수료
	// BOND  : 채권
	// BFEE  : 채권취급수수료
	const getPayAmt = (payKd) => {
	    return Number(
	        dsPaymentList.find(item => item.PAY_KD === payKd)?.PAY_AMT || 0
	    );
	};
	
	// 결제목록 전체 금액 합계 계산
	const totalAmt = dsPaymentList.reduce(
	    (sum, item) => sum + Number(item.PAY_AMT || 0),
	    0
	);

    return (
        <div className="receipt-modal-overlay">

            <div className="receipt-modal-container">

                <div className="receipt-modal-header">
                    <h3>통합 납부 영수증</h3>
                    <button
                        className="receipt-modal-close-btn"
                        onClick={onClose}
                    >✕</button>
                </div>

                <div className="receipt-modal-body">
				

				<div className="receipt-title">
				    통 합 납 부 영 수 증 [{dsNewCar.CAR_NO ?? ''}]
				</div>
				
				<table className="receipt-table">
				    <tbody>
				        <tr>
				            <th>접수번호</th>
				            <td>{dsService.SERVICE_ID}</td>

				            <th>납부총액</th>
				            <td className="amount">
				                {totalAmt.toLocaleString()}원
				            </td>
				        </tr>

				        <tr>
				            <th>납부방법</th>
				            <td>{{
								    B: '선납금',
								    P: '계좌이체'
								}[dsNewCar.PAY_ME] || ''}
							</td>

				            <th>가상계좌</th>
				            <td>{dsNewCar.VBANK_NO}</td>
				        </tr>

				        <tr>
				            <th>전자납부번호</th>
				            <td>
				                {dsPaymentList.find(x => x.PAY_KD === 'ACQ')?.VBANK_NO}
				            </td>
							<th>취득세(등록면허세)액</th>
				            <td className="amount">
				                {getPayAmt('ACQ').toLocaleString()}원
				            </td>
				        </tr>

				        <tr>
							<th>인지세 고유번호</th>
							<td>{dsNewCar.INJI_NO}</td>
							
				            <th>인지세</th>
				            <td className="amount">
				                {getPayAmt('INJI').toLocaleString()}원
				            </td>
				        </tr>

				        <tr>
							<th>등록관청</th>
							<td>{govtNm}</td>
						
				            <th>증지대</th>
				            <td className="amount">
				                {getPayAmt('STAMP').toLocaleString()}원
				            </td>
				        </tr>

				        <tr>
				            <th>번호판 비용</th>
				            <td className="amount">
				                {getPayAmt('TNUM').toLocaleString()}원
				            </td>

				            <th>배송(탈부착)비용</th>
				            <td className="amount">
				                {getPayAmt('UNUM').toLocaleString()}원
				            </td>
				        </tr>

				        <tr>
							<th>납부일시</th>
							<td>
							    {dsPaymentList.find(x => x.PAY_KD === 'ACQ')?.PAY_DT}
							</td>
							
				            <th>등록수수료(VAT포함)</th>
				            <td className="amount">
				                {getPayAmt('FEE').toLocaleString()}원
				            </td>
				        </tr>

				        <tr>
				            <th>등록유형</th>
				            <td>{dsNewCar.TASK_CD_NM}</td>

				            <th>신청업체</th>
				            <td>{dsCompanyInfo.COMPANY_NM}</td>
				        </tr>

				        <tr>
				            <th>차량번호</th>
				            <td>{dsNewCar.CAR_NO}</td>

				            <th>차대번호</th>
				            <td>{dsNewCar.CARID_NO}</td>
				        </tr>

				        <tr>
				            <th>취득가액</th>
				            <td className="amount">
				                {Number(dsNewCar.BUY_AMT || 0).toLocaleString()}원
				            </td>

				            <th>과세표준액</th>
				            <td className="amount">
				                {Number(dsNewCar.T_VBANK_ID || 0).toLocaleString()}원
				            </td>
				        </tr>
				    </tbody>
				</table>
				
				{/* 채권 부분 */}
				{Object.keys(dsBondInfo).length > 0 && (
				    <>
						<div className="receipt-section-title">
						    채 권 매 입
						</div>
	
						<table className="receipt-table">
						    <tbody>
	
						        <tr>
						            <th>접수번호</th>
						            <td>{dsService.SERVICE_ID}</td>
	
						            <th>자동차등록번호</th>
						            <td>{dsNewCar.CAR_NO}</td>
						        </tr>
	
						        <tr>
						            <th>성명(상호)</th>
						            <td>{dsNewCar.OWNER_NM}</td>
	
						            <th>주민(사업자)번호</th>
						            <td>{dsNewCar.REG_NO}</td>
						        </tr>
	
						        <tr>
						            <th>매입구분</th>
						            <td>즉시매도</td>
	
						            <th>증서번호</th>
						            <td>{dsBondInfo.BND_MNG_NO}</td>
						        </tr>
	
						        <tr>
						            <th>채권금액</th>
						            <td>{Number(dsBondInfo.FIELD16 || 0).toLocaleString()}원</td>
	
						            <th>선급이자</th>
						            <td>{Number(dsBondInfo.FIELD24 || 0).toLocaleString()}원</td>
						        </tr>
	
						        <tr>
						            <th>소득(법인)세</th>
						            <td>{Number(dsBondInfo.FIELD25 || 0).toLocaleString()}원</td>
	
						            <th>주민세</th>
						            <td>{Number(dsBondInfo.FIELD26 || 0).toLocaleString()}원</td>
						        </tr>
	
						        <tr>
						            <th>수수료</th>
						            <td>{Number(dsBondInfo.FIELD27 || 0).toLocaleString()}원</td>
	
						            <th>차감지급액</th>
						            <td>{Number(dsBondInfo.FIELD23 || 0).toLocaleString()}원</td>
						        </tr>
	
						        <tr>
						            <th>채권매입용도</th>
						            <td>신규등록</td>
	
						            <th>납부일자</th>
						            <td>{dsBondInfo.NAPBU_DT}</td>
						        </tr>
	
						    </tbody>
						</table>
					    
						<div className="receipt-section-title">
					        {dsBondInfo.BK_NM || '즉 시 매 도 내 역'}
					    </div>
					    <table className="receipt-table">
					        <tbody>
	
					            <tr>
					                <th>매도금액</th>
					                <td className="amount">
					                    {Number(dsBondInfo.FIELD23 || 0).toLocaleString()}원
					                </td>
	
					                <th>채권취급수수료</th>
					                <td className="amount">
					                    {getPayAmt('BFEE').toLocaleString()}원
					                </td>
					            </tr>
	
					            <tr>
					                <th>지급금액</th>
					                <td className="amount">
					                    {Number(dsBondInfo.FIELD23 || 0).toLocaleString()}원
					                </td>
	
					                <th>본인부담금액</th>
					                <td className="amount">
					                    {Number(dsBondInfo.FIELD28 || 0).toLocaleString()}원
					                </td>
					            </tr>
	
					        </tbody>
					    </table>
					</>
				)}
				
					<table className="receipt-table">
					    <tbody>
		
					        <tr className="receipt-total-row">
					            <th>입금하신 금액</th>
					            <td className="amount">
					                {Number(dsNewCar.PREREG_AMT || 0).toLocaleString()}원
					            </td>
		
					            <th>환불 금액</th>
					            <td className="amount">
					                {Number(dsNewCar.RT_AMT || 0).toLocaleString()}원
					            </td>
					        </tr>
		
					    </tbody>
					</table>
					

					<div className="receipt-note">
					    전자납부번호로 취득세 납부 여부를 확인할 수 있습니다.<br />
					    납부 관련 문의는 고객센터로 문의 바랍니다.
					</div>

					<div className="receipt-footer">
					    <div className="receipt-call">
					        고객센터 1688-6112 (내선 3)
					    </div>

					    <div className="receipt-print-date">
					        {new Date().getFullYear()}년
					        {String(new Date().getMonth() + 1).padStart(2, '0')}월
					        {String(new Date().getDate()).padStart(2, '0')}일
					    </div>
					</div>
                </div>

                <div className="receipt-modal-footer">
                    <button
                        className="btn-erp light"
                        onClick={handlePdfDownload}
                        >
                        PDF 저장
                    </button>
                    <button className="btn-erp light"
                        onClick={handlePrint} >
                        인쇄
                    </button>

                    <button
                        className="btn-erp"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>

            </div>

        </div>
    );
};

export default NewCarReceiptModal;