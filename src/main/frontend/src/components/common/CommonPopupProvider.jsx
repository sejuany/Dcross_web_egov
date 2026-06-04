import React, { useEffect, useRef, useState } from 'react';
import { commonPopup } from '../../utils/utils';
import './CommonPopup.css';

const CommonPopupProvider = ({ children }) => {
    const [popupState, setPopupState] = useState({
        visible: false,
        type: 'alert',
        title: '알림',
        message: '',
        okText: '확인',
        cancelText: '취소',
        width: 420,
    });

    const resolverRef = useRef(null);
    const okButtonRef = useRef(null);

    useEffect(() => {
        commonPopup.bind((options) => {
            return new Promise((resolve) => {
                resolverRef.current = resolve;

                setPopupState({
                    visible: true,
                    type: options.type || 'alert',
                    title: options.title || '알림',
                    message: options.message || '',
                    okText: options.okText || '확인',
                    cancelText: options.cancelText || '취소',
                    width: options.width || 420,
                });
            });
        });

        return () => {
            commonPopup.unbind();
        };
    }, []);

    useEffect(() => {
        if (popupState.visible) {
            setTimeout(() => {
                okButtonRef.current?.focus();
            }, 0);
        }
    }, [popupState.visible]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!popupState.visible) {
                return;
            }

            if (e.key === 'Enter') {
                close(true);
            }

            if (e.key === 'Escape') {
                close(popupState.type === 'alert');
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [popupState.visible, popupState.type]);

    const close = (result) => {
        setPopupState(prev => ({
            ...prev,
            visible: false,
        }));

        const resolver = resolverRef.current;
        resolverRef.current = null;

        if (resolver) {
            resolver(result);
        }
    };

    return (
        <>
            {children}

            {popupState.visible && (
                <div className="common-popup-overlay">
                    <div
                        className="common-popup-box"
                        style={{ width: popupState.width }}
                    >
                        <div className="common-popup-header">
                            {popupState.title}
                        </div>

                        <div className="common-popup-body">
                            {String(popupState.message)
                                .split('\n')
                                .map((line, index) => (
                                    <p key={index}>{line}</p>
                                ))}
                        </div>

                        <div className="common-popup-footer">
                            {popupState.type === 'confirm' && (
                                <button
                                    type="button"
                                    className="common-popup-btn cancel"
                                    onClick={() => close(false)}
                                >
                                    {popupState.cancelText}
                                </button>
                            )}

                            <button
                                type="button"
                                ref={okButtonRef}
                                className="common-popup-btn ok"
                                onClick={() => close(true)}
                            >
                                {popupState.okText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CommonPopupProvider;