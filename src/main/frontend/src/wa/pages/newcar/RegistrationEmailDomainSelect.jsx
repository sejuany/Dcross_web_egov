import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import '../../styles/RegistrationEmail.css';

// 기본 select는 글자별 색상 지정이 불가능하므로 이메일 목록에서 @만 분리해 표시한다.
const RegistrationEmailDomainSelect = ({ id, label, value, options, onChange, disabled = false }) => {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [opensAbove, setOpensAbove] = useState(false);
    const wrapperRef = useRef(null);
    const listRef = useRef(null);
    const choices = [{ CODE_ID: '', LABEL: '@이메일 선택' }, ...options];
    const selectedIndex = Math.max(0, choices.findIndex(option => option.CODE_ID === value));
    const listId = `${id}-options`;
    const renderLabel = text => <><span className="wa-registration-email-at">@</span>{text.slice(1)}</>;

    useEffect(() => {
        if (disabled) setOpen(false);
    }, [disabled]);

    useEffect(() => {
        if (!open) return undefined;
        const closeOutside = event => {
            if (!wrapperRef.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => document.removeEventListener('pointerdown', closeOutside);
    }, [open]);

    useEffect(() => {
        if (open) listRef.current.children[activeIndex].scrollIntoView({ block: 'nearest' });
    }, [open, activeIndex]);

    const openOptions = (index = selectedIndex) => {
        const bounds = wrapperRef.current.getBoundingClientRect();
        setOpensAbove(window.innerHeight - bounds.bottom < 240 && bounds.top > 240);
        setActiveIndex(index);
        setOpen(true);
    };
    const chooseOption = index => {
        onChange({ target: { value: choices[index].CODE_ID } });
        setOpen(false);
    };
    const handleKeyDown = event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) openOptions();
            else setActiveIndex(index => Math.max(0, Math.min(choices.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const index = event.key === 'Home' ? 0 : choices.length - 1;
            if (open) setActiveIndex(index);
            else openOptions(index);
        } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open) chooseOption(activeIndex);
            else openOptions();
        } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
        } else if (event.key === 'Tab') setOpen(false);
    };

    return <div ref={wrapperRef} className="wa-registration-email-select"
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <button type="button" className="wa-select wa-registration-email-trigger" role="combobox"
            aria-label={`${label} 도메인 선택`} aria-expanded={open} aria-haspopup="listbox"
            aria-controls={listId} aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
            disabled={disabled} onClick={() => open ? setOpen(false) : openOptions()} onKeyDown={handleKeyDown}>
            <span>{renderLabel(choices[selectedIndex].LABEL)}</span><ChevronDown size={14} aria-hidden="true" />
        </button>
        {open && <div ref={listRef} id={listId} role="listbox" aria-label={`${label} 도메인 목록`}
            className={`wa-registration-email-options${opensAbove ? ' above' : ''}`}>
            {choices.map((option, index) => <button type="button" role="option" tabIndex={-1}
                id={`${listId}-${index}`} key={option.CODE_ID} aria-label={option.LABEL} aria-selected={value === option.CODE_ID}
                className={`wa-registration-email-option${index === activeIndex ? ' active' : ''}`}
                onPointerDown={event => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseOption(index)}>
                {renderLabel(option.LABEL)}
            </button>)}
        </div>}
    </div>;
};

export default RegistrationEmailDomainSelect;
