import React, { useEffect, useState } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';

import './NewCarReceiptModal.css';

const BondReceiptModal = ({
    dsService,
    dsNewCar,
    dsPaymentList,
	dsCompanyInfo,
	gf,
    onClose
}) => {
	
	// 채권 조회용
	const [dsBondInfo, setDsBondInfo] = useState({});

	// 채권정보 조회
	const loadBondInfo = async () => {

	    if (!dsService.SERVICE_ID) {
	        return;
	    }

	    try {
			
			// TODO : 채권처리기업은 나중에 추가함
			const bondRes = await axios.post('/api/common/query', {
			    QUERY_ID: 'selectBondInfo',
			    SERVICE_ID: dsService.SERVICE_ID
			});

			setDsBondInfo(bondRes.data.data || {});

	    } catch (e) {
	        console.error('채권정보 조회 실패', e);
	    }
	};
	

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
                filename: `채권매입확인증_${dsService.SERVICE_ID}_${dsNewCar.CAR_NO}.pdf`,
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
					    채 권 매 입 확 인 증 [{dsNewCar.CAR_NO ?? ''}]
					</div>
	
					{/* 채권 매입 확인증 */}
					<table className="receipt-table">
					    <tbody>
					        <tr>
					            <th>증서번호</th>
					            <td>{dsBondInfo.BND_MNG_NO}</td>
	
					            <th>자동차 등록번호</th>
					            <td>{dsNewCar.CAR_NO}</td>
					        </tr>
	
					        <tr>
					            <th>성명(상호)</th>
					            <td>{dsNewCar.OWNER_NM}</td>
	
					            <th>주민(사업자)번호</th>
					            <td>{gf.formatRegNo(dsNewCar.REG_NO)}</td>
					        </tr>
	
					        <tr>
					            <th>납부일시</th>
					            <td>{dsBondInfo.NAPBU_DT}</td>
	
					            <th>매입구분</th>
								<td>
								    {{
								        SELL: '매도',
								        BUY: '매입'
								    }[dsNewCar.BOND_DC] || dsNewCar.BOND_DC}
								</td>
					        </tr>
	
					        <tr>
					            <th>채권금액</th>
					            <td className="amount">
					                {Number(dsBondInfo.FIELD16 || 0).toLocaleString()}원
					            </td>
	
					            <th>용도구분</th>
					            <td>신규등록</td>
					        </tr>
	
					        <tr>
					            <th>선급이자</th>
					            <td className="amount">
					                {Number(dsBondInfo.FIELD24 || 0).toLocaleString()}원
					            </td>
	
					            <th>주민세</th>
					            <td className="amount">
					                {Number(dsBondInfo.FIELD26 || 0).toLocaleString()}원
					            </td>
					        </tr>
	
					        <tr>
					            <th>채권수수료</th>
					            <td className="amount">
					                {Number(dsBondInfo.FIELD27 || 0).toLocaleString()}원
					            </td>
	
					            <th>소득(법인)세</th>
					            <td className="amount">
					                {Number(dsBondInfo.FIELD25 || 0).toLocaleString()}원
					            </td>
					        </tr>
	
					        <tr>
					            <th>금융수수료</th>
					            <td className="amount">
					                {Number(dsBondInfo.FIELD18 || 0).toLocaleString()}원
					            </td>
	
					            <th>공채발행번호</th>
					            <td>{dsBondInfo.BND_ISU_NO}</td>
					        </tr>
					    </tbody>
					</table>
					
					
					{/* 즉시 매도 내역 */}
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

					            <th>본인부담액</th>
					            <td className="amount">
					                {Number(dsBondInfo.FIELD28 || 0).toLocaleString()}원
					            </td>
					        </tr>

					        <tr>
					            <th>채권발행여부</th>
					            <td>입금완료</td>

					            <th>채권취급수수료</th>
					            <td className="amount">
					                {getPayAmt('BFEE').toLocaleString()}원
					            </td>
					        </tr>

					        <tr>
					            <th>채권납부계좌번호</th>
					            <td>
					                {dsPaymentList.find(x => x.PAY_KD === 'BOND')?.VBANK_NO}
					            </td>

					            <th>총 입금액</th>
					            <td className="amount">
					                {
					                    (
					                        Number(dsBondInfo.FIELD28 || 0)
					                        +
					                        getPayAmt('BFEE')
					                    ).toLocaleString()
					                }원
					            </td>
					        </tr>

					    </tbody>
					</table>
	
					<div className="receipt-note">
					    위와 같이 영수하였음을 증명합니다.
					</div>
	
					<div className="receipt-footer">
					    <div style={{fontWeight:'bold'}}>
					        주식회사 다코스
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

export default BondReceiptModal;