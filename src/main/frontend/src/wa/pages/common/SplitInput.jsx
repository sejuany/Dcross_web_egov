import React, { Fragment, useEffect, useRef, useState } from 'react';
import { splitValue, mergeValue } from '../../../utils/formUtil';

const SplitInput = ({
    value = '',
    lengths = [],
    placeholders = [],
    separator = '-',
    inputClassName = '',
    readOnly = false,
    onlyNumber = true,
    onChange,
    ...props
}) => {

    // 각 입력칸 Ref (자동 포커스 이동)
    const inputRefs = useRef([]);

    // 부모에서 전달된 값 저장
    const prevValue = useRef(value);

    // 분리 입력값
    const [values, setValues] = useState(
        splitValue(value || '', lengths)
    );

    // 부모에서 값이 변경된 경우만 화면 갱신
    useEffect(() => {

        if (prevValue.current === value) {
            return;
        }

        prevValue.current = value;
        setValues(splitValue(value || '', lengths));

    }, [value, lengths]);

    // 입력 처리
    const handleChange = (index, inputValue) => {

        let next = inputValue;

        // 숫자만 입력
        if (onlyNumber) {
            next = next.replace(/\D/g, '');
        }

        // 자리수 제한
        next = next.slice(0, lengths[index]);

        const newValues = [...values];
        newValues[index] = next;

        // 화면 먼저 갱신
        setValues(newValues);

        // 부모에 합친 값 전달
        const merged = mergeValue(...newValues);
        prevValue.current = merged;
        onChange?.(merged);

        // 입력 완료 시 다음 입력칸 이동
        if (
            next.length === lengths[index] &&
            index < lengths.length - 1
        ) {
            inputRefs.current[index + 1]?.focus();
            inputRefs.current[index + 1]?.select();
        }
    };

    return (
        <>
            {values.map((item, index) => (
                <Fragment key={index}>
                    <input
                        {...props}
                        ref={el => inputRefs.current[index] = el}
                        className={`wa-input ${inputClassName}`}
                        value={item}
                        maxLength={lengths[index]}
                        readOnly={readOnly}
                        placeholder={placeholders[index] || ''}
                        onChange={e => handleChange(index, e.target.value)}
                    />

                    {index < values.length - 1 && (
                        <span className="wa-dash">{separator}</span>
                    )}
                </Fragment>
            ))}
        </>
    );
};

export default SplitInput;