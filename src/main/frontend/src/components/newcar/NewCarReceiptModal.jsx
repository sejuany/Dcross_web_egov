import React from 'react';
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

    return (
        <div className="receipt-modal-overlay">

            <div className="receipt-modal-container">

                <div className="receipt-modal-header">
                    <h3>납부영수증</h3>
                    <button
                        className="receipt-modal-close-btn"
                        onClick={onClose}
                    >✕</button>
                </div>

                <div className="receipt-modal-body">

                    <div className="receipt-section-title">
                        통합납부영수증
                    </div>

                    <table className="receipt-table">
                        <tbody>
                            <tr>
                                <th>접수번호</th>
                                <td>{dsService.SERVICE_ID}</td>

                                <th>납부총액</th>
                                <td className="amount">
                                    {Number(dsNewCar.TOTAL_AMT || 0).toLocaleString()}원
                                </td>
                            </tr>

                            <tr>
                                <th>납부방법</th>
                                <td>{dsNewCar.PAY_GB_NM}</td>

                                <th>전자납부번호</th>
                                <td>{dsNewCar.EPAY_NO}</td>
                            </tr>

                            <tr>
                                <th>신청업체</th>
                                <td>{dsCompanyInfo.COMPANY_NM}</td>

                                <th>등록관청</th>
                                <td>{dsNewCar.REG_OFFICE_NM}</td>
                            </tr>

                            <tr>
                                <th>차량번호</th>
                                <td>{dsNewCar.CAR_NO}</td>

                                <th>차대번호</th>
                                <td>{dsNewCar.CAR_IDNO}</td>
                            </tr>

                            <tr>
                                <th>취득가액</th>
                                <td>{Number(dsNewCar.CAR_AMT || 0).toLocaleString()}원</td>

                                <th>과세표준액</th>
                                <td>{Number(dsNewCar.TAX_STD_AMT || 0).toLocaleString()}원</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="receipt-section-title">
                        납부내역
                    </div>

                    <table className="receipt-table">
                        <tbody>
                            <tr>
                                <th>취득세</th>
                                <td className="amount">
                                    {Number(dsNewCar.TAX_AMT || 0).toLocaleString()}원
                                </td>
                            </tr>

                            <tr>
                                <th>인지세</th>
                                <td className="amount">
                                    {Number(dsNewCar.STAMP_AMT || 0).toLocaleString()}원
                                </td>
                            </tr>

                            <tr>
                                <th>증지대</th>
                                <td className="amount">
                                    {Number(dsNewCar.STICKER_AMT || 0).toLocaleString()}원
                                </td>
                            </tr>

                            <tr>
                                <th>번호판비용</th>
                                <td className="amount">
                                    {Number(dsNewCar.PLATE_AMT || 0).toLocaleString()}원
                                </td>
                            </tr>

                            <tr>
                                <th>등록수수료</th>
                                <td className="amount">
                                    {Number(dsNewCar.REG_FEE || 0).toLocaleString()}원
                                </td>
                            </tr>
                            
                            <tr className="receipt-total-row">
                                <th>총 납부금액</th>
                                <td colSpan="3" className="amount">
                                    {Number(dsNewCar.TOTAL_AMT || 0).toLocaleString()}원
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="receipt-note">
                        전자납부번호로 취득세 납부 여부를 확인할 수 있습니다.<br />
                        납부 관련 문의는 고객센터로 문의 바랍니다.
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