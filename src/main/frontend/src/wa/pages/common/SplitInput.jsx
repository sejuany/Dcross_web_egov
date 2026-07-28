import React, { Fragment, useEffect, useRef, useState } from 'react';
import { splitValue, mergeValue } from '../../../utils/formUtil';

const applyFixedValues = (sourceValues, fixedValues) => sourceValues.map((item, index) => (
    fixedValues[index] !== undefined ? String(fixedValues[index]) : item
));

const SplitInput = ({
    value = '',
    lengths = [],
    placeholders = [],
    separator = '-',
    inputClassName = '',
    readOnly = false,
    fixedValues = [],
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
        applyFixedValues(splitValue(value || '', lengths), fixedValues)
    );

    // 부모에서 값이 변경된 경우만 화면 갱신
    useEffect(() => {

        if (prevValue.current === value) {
            return;
        }

        prevValue.current = value;
        setValues(applyFixedValues(splitValue(value || '', lengths), fixedValues));

    }, [value, lengths, fixedValues]);

    // 입력 처리
    const handleChange = (index, inputValue) => {

        // 고정값이 설정된 칸은 사용자가 변경할 수 없다.
        if (fixedValues[index] !== undefined) {
            return;
        }

        let next = inputValue;

        // 숫자만 입력
        if (onlyNumber) {
            next = next.replace(/\D/g, '');
        }

        // 자리수 제한
        next = next.slice(0, lengths[index]);

        // 병합할 때도 고정값을 다시 적용해 onChange 결과에 반드시 포함한다.
        const newValues = applyFixedValues([...values], fixedValues);
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
                        value={fixedValues[index] !== undefined ? fixedValues[index] : item}
                        maxLength={lengths[index]}
                        readOnly={readOnly || fixedValues[index] !== undefined}
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
