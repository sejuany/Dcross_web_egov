import { useCallback, useEffect, useRef, useState } from 'react';

import { Search } from 'lucide-react';

import useAddressSearch from '../../../hooks/useAddressSearch';

// 연속 입력이 잠시 멈춘 뒤 상위 화면 state에 값을 반영한다.
const DEFERRED_INPUT_SYNC_DELAY = 220;

/**
 * 주소 입력 중에는 AddressSearch의 로컬 draft만 변경한다.
 * 한글 조합 완료, 포커스 이탈 또는 debounce 시점에만 기존 handleChange로 값을 전달한다.
 */
const useDeferredInput = ({
	value,
	name,
	dataType,
	handleChange
}) => {
	const externalValue = String(value ?? '');
	const [draftValue, setDraftValue] = useState(externalValue);
	const latestValueRef = useRef(externalValue);
	const composingRef = useRef(false);

	// 조회 결과 선택이나 초기화로 외부 값이 바뀌면 로컬 입력값도 동기화한다.
	useEffect(() => {
		latestValueRef.current = externalValue;
		setDraftValue(currentValue => (
			currentValue === externalValue ? currentValue : externalValue
		));
	}, [externalValue]);

	const commitValue = useCallback((nextValue = latestValueRef.current) => {
		if (nextValue === externalValue) {
			return;
		}

		// 기존 공통 handleChange가 사용하는 event.target 계약을 그대로 유지한다.
		handleChange?.({
			target: {
				name,
				value: nextValue,
				dataset: { type: dataType }
			}
		});
	}, [dataType, externalValue, handleChange, name]);

	useEffect(() => {
		if (composingRef.current || draftValue === externalValue) {
			return undefined;
		}

		const timer = window.setTimeout(() => {
			if (!composingRef.current) {
				commitValue(latestValueRef.current);
			}
		}, DEFERRED_INPUT_SYNC_DELAY);

		return () => window.clearTimeout(timer);
	}, [commitValue, draftValue, externalValue]);

	const onChange = useCallback((event) => {
		const nextValue = event.target.value;
		latestValueRef.current = nextValue;
		setDraftValue(nextValue);
	}, []);

	const onCompositionStart = useCallback(() => {
		composingRef.current = true;
	}, []);

	const onCompositionEnd = useCallback((event) => {
		const nextValue = event.currentTarget.value;
		composingRef.current = false;
		latestValueRef.current = nextValue;
		setDraftValue(nextValue);
		commitValue(nextValue);
	}, [commitValue]);

	const onBlur = useCallback(() => {
		commitValue(latestValueRef.current);
	}, [commitValue]);

	return {
		value: draftValue,
		onChange,
		onCompositionStart,
		onCompositionEnd,
		onBlur
	};
};

const AddressSearch = ({
	label,
	placeholder,
	type,
	dsNewCar,
	detailName,
	postName,
	handleChange,
	onSelect,
	onClear,
	showSameCheckbox = false,
	onSameChange,
	sameLabel,
	data,
	dataType = 'newcar'
}) => {
	
	const formData = data || dsNewCar;
	const addressInput = useDeferredInput({
		value: formData[type],
		name: type,
		dataType,
		handleChange
	});
	const detailInput = useDeferredInput({
		value: formData[detailName],
		name: detailName,
		dataType,
		handleChange
	});
	
	const address = useAddressSearch({
		// 검색 버튼과 Enter 조회는 아직 상위 state에 반영되기 전이어도 최신 draft를 사용한다.
	    value: addressInput.value,
	    type,
	    onSelect
	});

	// 선택 버튼 클릭시 상세주소로 이동
	const detailRef = useRef(null); 
	
    return (
        <div className="wa-form-row"
			style={{ alignItems: 'flex-start' }}
		>

            <label className="wa-form-label"
				   style={{ marginTop: '10px' }}
			>
                {label}
				
				{showSameCheckbox && (
				    <label className="wa-form-sub-label">
				        {sameLabel}와 동일
				        <input
				            type="checkbox"
				            onChange={onSameChange}
				        />
				    </label>
				)}
            </label>
			

            <div className="wa-form-control">

                {/* 주소 입력 */}
				<div className="wa-address-wrap">

				    <input
						className="wa-input"
						name={type}
						data-type={dataType}
						value={addressInput.value}
						onChange={addressInput.onChange}
						onCompositionStart={addressInput.onCompositionStart}
						onCompositionEnd={addressInput.onCompositionEnd}
						onBlur={addressInput.onBlur}
						onKeyDown={address.handleKeyDown}
						placeholder={placeholder}
				    />

					{!!addressInput.value && (
				        <button
				            type="button"
				            className="wa-clear-btn"
							onClick={() => onClear?.(type)}
				        >
				            ×
				        </button>
				    )}

				    <button
				        type="button"
				        className="wa-search-btn"
						onClick={address.handleSearch}
				    >
				        <Search size={18} />
				    </button>

				</div>
				
				{address.showGuide && (
				    <div className="addr-guide-box">

				        <div className="guide-title">
				            Tip
				        </div>

				        <div className="guide-item">
				            <strong>전체 주소 검색 가능</strong>
				            <p>서울특별시 중구 세종대로 110</p>
				            <p>경기도 성남시 분당구 판교역로 166</p>
				        </div>

				        <div className="guide-item">
				            <strong>간단 검색도 가능</strong>
				            <p>판교역로 235</p>
				            <p>호계동 898-0</p>
				        </div>

				    </div>
				)}
				
                {/* 검색 결과 */}
				{address.searched && (

				    <div className="wa-address-result">
						{address.addressList.length === 0 ? (
	
						    <div className="wa-address-empty">
						        조회 결과가 없습니다.
						    </div>
	
						) : (
							<>
					        {address.currentList.map((item, idx) => (
	
					            <div
					                key={`${item.POST_NO}-${idx}`}
					                className="wa-address-item"
					            >
	
					                <div className="wa-address-info">
	
					                    <div className="wa-address-row">
					                        <span className="label">우편번호 </span>
					                        <span className="addr-span">{item.POST_NO}</span>
					                    </div>
	
					                    <div className="wa-address-row">
					                        <span className="label">도로명 </span>
					                        <span className="addr-span">{item.ROAD_AD}</span>
					                    </div>
	
					                    <div className="wa-address-row">
					                        <span className="label">구주소 </span>
					                        <span className="addr-span">{item.JIBUN_AD}</span>
					                    </div>
	
					                </div>
	
					                <button
					                    type="button"
					                    className="wa-address-select-btn"
	
										onClick={() => {
										    address.handleSelect(item);
	
										    setTimeout(() => {
										        detailRef.current?.focus();
										    }, 0);
										}}
					                >
					                    선택
					                </button>
	
					            </div>
	
					        ))}
							</>
						)}
						
						{/* 페이징처리 */}
						{address.totalPage > 1 && (() => {

						    const current = address.page;
						    const total = address.totalPage;

						    let start = Math.max(1, current - 2);
						    let end = Math.min(total, start + 4);

						    if (end - start < 4) {
						        start = Math.max(1, end - 4);
						    }

						    const pages = [];
						    for (let i = start; i <= end; i++) {
						        pages.push(i);
						    }

						    return (
						        <div className="wa-address-pagination">

						            <button
						                type="button"
						                disabled={current === 1}
						                onClick={() => address.setPage(current - 1)}
						            >
						                &lt;
						            </button>

						            {start > 1 && (
						                <>
						                    <button
						                        type="button"
						                        onClick={() => address.setPage(1)}
						                    >
						                        1
						                    </button>

						                    {start > 2 && <span>...</span>}
						                </>
						            )}

						            {pages.map(pageNo => (
						                <button
						                    key={pageNo}
						                    type="button"
						                    className={current === pageNo ? 'active' : ''}
						                    onClick={() => address.setPage(pageNo)}
						                >
						                    {pageNo}
						                </button>
						            ))}

						            {end < total && (
						                <>
						                    {end < total - 1 && <span>...</span>}

						                    <button
						                        type="button"
						                        onClick={() => address.setPage(total)}
						                    >
						                        {total}
						                    </button>
						                </>
						            )}

						            <button
						                type="button"
						                disabled={current === total}
						                onClick={() => address.setPage(current + 1)}
						            >
						                &gt;
						            </button>

						        </div>
						    );

						})()}

				    </div>

				)}

				<div className="wa-inline-group">

				    <input
				        ref={detailRef}
				        className="wa-input wa-flex"
						style={{ flex: 2 }}
				        name={detailName}
				        data-type={dataType}
				        value={detailInput.value}
				        onChange={detailInput.onChange}
						onCompositionStart={detailInput.onCompositionStart}
						onCompositionEnd={detailInput.onCompositionEnd}
						onBlur={detailInput.onBlur}
				        placeholder="상세주소 입력"
				    />

				    {postName && (
				        <input
				            className="wa-input"
				            style={{ flex: 1 }}
				            name={postName}
				            data-type={dataType}
				            value={formData[postName] ?? ''}
							placeholder="우편번호"
				            readOnly
				        />
				    )}

				</div>
            </div>

        </div>
    );

};

export default AddressSearch;
