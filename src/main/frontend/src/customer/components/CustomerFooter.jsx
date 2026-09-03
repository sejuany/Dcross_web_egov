import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Customer.css';


const CustomerFooter = () => {

	// 모바일 브라우저에서는 문자 링크 등을 통해 진입한 경우
	// 새 창(target="_blank") 열기가 브라우저 정책에 의해 제한될 수 있으므로
	// 모바일은 현재 창(_self), PC는 새 창(_blank)으로 개인정보처리방침을 연다.
	const isMobile = window.matchMedia('(max-width: 768px)').matches;
	
    return (
        <footer className="customer-footer">

            <div className="customer-footer-top">
				{isMobile ? (
				    <Link
				        to="/customer/CustomerPrivacyPolicy"
				        className="footer5-link"
				    >
				        개인정보처리방침
				    </Link>
				) : (
				    <a
				        href="/customer/CustomerPrivacyPolicy"
				        target="_blank"
				        rel="noopener noreferrer"
				        className="footer5-link"
				    >
				        개인정보처리방침
				    </a>
				)}
            </div>

        </footer>
    );

};


export default CustomerFooter;