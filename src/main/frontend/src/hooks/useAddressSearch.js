// ====================================
// * 주소검색 모달 전용
// ====================================

import { useMemo, useState } from 'react';
import axios from 'axios';

import { gf } from '../utils/utils';

const PAGE_SIZE = 5;

const useAddressSearch = ({
    value,
    type,
    onSelect
}) => {

    // 주소 목록
    const [addressList, setAddressList] = useState([]);

    // 현재 페이지
    const [page, setPage] = useState(1);

    // 조회중
    const [loading, setLoading] = useState(false);

    // 주소 조회
    const handleSearch = async () => {
		
        const oAddr = gf.createAddrParam(value);

        if (!oAddr.ROAD_NM) {
            gf.alert('도로명 또는 지번 주소를 입력해주세요.');
            return;
        }

        try {

            setLoading(true);

            const res = await axios.post('/api/common/search/address', oAddr);

            setAddressList(res.data.list || []);
            setPage(1);

        } catch (e) {

            console.error(e);
            gf.alert('주소 조회 중 오류가 발생했습니다.');

        } finally {

            setLoading(false);

        }

    };

    // 주소 선택
	const handleSelect = (item) => {

		if (onSelect) {
		    onSelect(type, {
		        ADDR: item.ROAD_AD,
		        POST_NO: item.POST_NO,
		        BUBJUNG_CD: item.BUBJUNG_CD,
		        ROAD_CD: item.ROAD_CD,
		        HJD_CD: item.HJD_CD,
		        JIHA_YN: item.JIHA_YN,
		        BUILDB_NO: item.BUILDB_NO,
		        BUILDS_NO: item.BUILDS_NO
		    });
		} 

	    setAddressList([]);

	};

    // Enter 조회
    const handleKeyDown = (e) => {

        if (e.key !== 'Enter') {
            return;
        }

        e.preventDefault();

        handleSearch();

    };

    // 현재 페이지 목록
    const currentList = useMemo(() => {

        const start = (page - 1) * PAGE_SIZE;

        return addressList.slice(start, start + PAGE_SIZE);

    }, [addressList, page]);

    // 전체 페이지
    const totalPage = Math.ceil(addressList.length / PAGE_SIZE);

    return {
        loading,
        page,
        setPage,
        addressList,
        currentList,
        totalPage,
        handleSearch,
        handleSelect,
        handleKeyDown
    };

};

export default useAddressSearch;