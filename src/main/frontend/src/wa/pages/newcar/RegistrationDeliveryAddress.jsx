import React from 'react';
import AddressSearch from '../common/AddressSearch';

const RegistrationDeliveryAddress = ({ dsNewCar, setDsNewCar, handleChange, onSelect, onClear }) => {
	const isCorporate = dsNewCar.REG_GB === 'B';

	const handleSameAddress = (e) => {
	    setDsNewCar(prev => ({
	        ...prev,
	        CARP_ADDRESS: e.target.checked ? prev.ADDRESS : '',
	        CARP_ADDRESS_DT: e.target.checked ? prev.ADDRESS_DT : '',
	        CARP_POST_NO: e.target.checked ? prev.POST_NO : ''
	    }));
	};

	const handleBaseAddressChange = (e) => {
	    setDsNewCar(prev => ({
	        ...prev,
	        CARP_ADDRESS: e.target.checked ? prev.BASE_ADDRESS : '',
	        CARP_ADDRESS_DT: e.target.checked ? prev.BASE_ADDRESS_DT : '',
	        CARP_POST_NO: e.target.checked ? prev.BASE_POST_NO : ''
	    }));
	};

	return (
		<AddressSearch
			label="등록증 수령지"
			sameLabel={isCorporate ? '본점 소재지' : '소유자 주소'}
			placeholder="건물, 지번 또는 도로명 검색"
			type="CARP_ADDRESS"
			detailName="CARP_ADDRESS_DT"
			postName="CARP_POST_NO"
			dsNewCar={dsNewCar}
			handleChange={handleChange}
			onSelect={onSelect}
			onClear={onClear}
			showSameCheckbox
			onSameChange={handleSameAddress}
			showBaseAddressCheckbox={isCorporate}
			onBaseAddressChange={handleBaseAddressChange}
		/>
	);
};

export default RegistrationDeliveryAddress;
