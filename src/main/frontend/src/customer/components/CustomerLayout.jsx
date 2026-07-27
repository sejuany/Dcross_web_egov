import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import CustomerFooter from './CustomerFooter';

const CustomerLayout = () => {
	
	useEffect(() => {
	    document.body.classList.add('customer-body-page');

	    return () => {
	        document.body.classList.remove('customer-body-page');
	    };
	}, []);
	
	return (
	    <div className="customer-layout">

			<div className="customer-body">

			    <Outlet />

			    <CustomerFooter />

			</div>

	    </div>
	);

};

export default CustomerLayout;