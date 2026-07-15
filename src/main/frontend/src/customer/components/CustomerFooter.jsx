import React from 'react';
import '../styles/Customer.css';


const CustomerFooter = () => {

    return (
        <footer className="customer-footer">

            <div className="customer-footer-top">
                <a
                    href="/PrivacyPolicy.do"
                    className="customer-footer-link"
                >
                    개인정보처리방침
                </a>
            </div>
			{/*
			
            <div className="customer-footer-main">

                <div className="customer-footer-info">
                    <p><strong>주식회사</strong> 다코스</p>
                    <p><strong>대표이사</strong> 전노호</p>
                    <p><strong>사업자등록번호</strong> 594-87-00530</p>
                    <p>서울특별시 은평구 증산로 453 경보빌딩 7층</p>
                </div>

                <div className="customer-footer-copy">
                    <p>
                        <strong>
                            COPYRIGHT © 2016 DACOS Co., Ltd.
                            <br className="mobile-break" />
                            ALL RIGHTS RESERVED.
                        </strong>
                    </p>
                </div>

                <div className="customer-footer-contact">
                    <a href="tel:1688-6112">
                        고객센터 <span>:</span> <span>1688-6112</span>
                    </a>
                </div>
            </div>
				*/}

        </footer>
    );

};


export default CustomerFooter;