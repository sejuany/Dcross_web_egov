import React from 'react';
import '../styles/Customer.css';


const CustomerFooter = () => {

    return (
        <footer className="customer-footer">

            <div className="customer-footer-top">
			    <a
			        href="/customer/CustomerPrivacyPolicy"
			        target="_blank"
			        rel="noopener noreferrer"
			        className="footer5-link"
			    >
			        개인정보처리방침
			    </a>
            </div>

        </footer>
    );

};


export default CustomerFooter;