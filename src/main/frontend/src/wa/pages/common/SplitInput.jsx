import React, { Fragment, useEffect, useRef, useState } from 'react';
import { splitValue, mergeValue } from '../../../utils/formUtil';

const DEFAULT_DEBOUNCE_MS = 220;

const applyFixedValues = (sourceValues, fixedValues) => sourceValues.map((item, index) => (
    fixedValues[index] !== undefined ? String(fixedValues[index]) : item
));

const isSameArray = (left = [], right = []) => (
    left.length === right.length
    && left.every((item, index) => item === right[index])
);

const SplitInput = ({
    value = '',
    lengths = [],
    placeholders = [],
    separator = '-',
    inputClassName = '',
    readOnly = false,
    fixedValues = [],
    onlyNumber = true,
    deferred = false,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    onChange,
    ...props
}) => {

    // 각 입력칸 Ref (자동 포커스 이동)
    const inputRefs = useRef([]);

    // debounce가 이전 렌더의 값을 참조하지 않도록 항상 최신 입력값을 Ref에 보관한다.
    const commitTimerRef = useRef(null);
    const latestMergedValueRef = useRef('');
    const hasPendingValueRef = useRef(false);
    const isComposingRef = useRef(false);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // 부모 값과 입력 구조가 실제로 바뀐 경우만 로컬 입력값을 동기화한다.
    const externalStateRef = useRef({
        value,
        lengths: [...lengths],
        fixedValues: [...fixedValues]
    });

    // 분리 입력값
    const [values, setValues] = useState(() => {
        const initialValues = applyFixedValues(splitValue(value || '', lengths), fixedValues);
        latestMergedValueRef.current = mergeValue(...initialValues);
        return initialValues;
    });

    const clearCommitTimer = () => {

        if (commitTimerRef.current !== null) {
            clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
        }
    };

    // 지연 중인 최신 전체 값을 부모에 한 번만 전달한다.
    const commitLatestValue = () => {

        clearCommitTimer();

        if (!hasPendingValueRef.current) {
            return;
        }

        hasPendingValueRef.current = false;
        onChangeRef.current?.(latestMergedValueRef.current);
    };

    const scheduleCommit = () => {

        clearCommitTimer();

        const parsedDelay = Number(debounceMs);
        const delay = Number.isFinite(parsedDelay)
            ? Math.max(0, parsedDelay)
            : DEFAULT_DEBOUNCE_MS;

        commitTimerRef.current = setTimeout(commitLatestValue, delay);
    };

    // 부모에서 값이 변경되면 진행 중인 draft보다 외부 값을 우선한다.
    useEffect(() => {

        const previous = externalStateRef.current;
        const hasExternalChange = (
            previous.value !== value
            || !isSameArray(previous.lengths, lengths)
            || !isSameArray(previous.fixedValues, fixedValues)
        );

        if (!hasExternalChange) {
            return;
        }

        externalStateRef.current = {
            value,
            lengths: [...lengths],
            fixedValues: [...fixedValues]
        };

        clearCommitTimer();
        hasPendingValueRef.current = false;

        const nextValues = applyFixedValues(splitValue(value || '', lengths), fixedValues);
        latestMergedValueRef.current = mergeValue(...nextValues);
        setValues(current => (isSameArray(current, nextValues) ? current : nextValues));

    }, [value, lengths, fixedValues]);

    // 언마운트 뒤 debounce callback이 실행되지 않도록 정리한다.
    useEffect(() => () => {

        if (commitTimerRef.current !== null) {
            clearTimeout(commitTimerRef.current);
        }
    }, []);

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
        latestMergedValueRef.current = merged;

        if (deferred) {
            hasPendingValueRef.current = true;

            // 한글 조합 중에는 중간 문자열을 부모에 반영하지 않는다.
            if (!isComposingRef.current) {
                scheduleCommit();
            }
        } else {
            onChangeRef.current?.(merged);
        }

        // 입력 완료 시 다음 입력칸 이동
        if (
            next.length === lengths[index] &&
            index < lengths.length - 1
        ) {
            inputRefs.current[index + 1]?.focus();
            inputRefs.current[index + 1]?.select();
        }
    };

    const handleBlur = (event) => {

        if (deferred) {
            const nextTarget = event.relatedTarget;
            const staysInGroup = inputRefs.current.some(input => (
                input === nextTarget
            ));

            // SplitInput 전체를 벗어날 때만 즉시 확정한다.
            if (!staysInGroup) {
                commitLatestValue();
            }
        }

        props.onBlur?.(event);
    };

    const handleCompositionStart = (event) => {

        isComposingRef.current = true;

        if (deferred) {
            clearCommitTimer();
        }

        props.onCompositionStart?.(event);
    };

    const handleCompositionEnd = (event) => {

        isComposingRef.current = false;

        if (deferred && hasPendingValueRef.current) {
            scheduleCommit();
        }

        props.onCompositionEnd?.(event);
    };

    return (
        <>
            {values.map((item, index) => (
                <Fragment key={index}>
                    <input
                        {...props}
                        autoComplete="off"
                        ref={el => inputRefs.current[index] = el}
                        className={`wa-input ${inputClassName}`}
                        value={fixedValues[index] !== undefined ? fixedValues[index] : item}
                        maxLength={lengths[index]}
                        readOnly={readOnly || fixedValues[index] !== undefined}
                        placeholder={placeholders[index] || ''}
                        onChange={e => handleChange(index, e.target.value)}
                        onBlur={handleBlur}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
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
