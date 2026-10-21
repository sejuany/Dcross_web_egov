import { useEffect, useRef } from 'react';
import axios from 'axios';

const ENDPOINT = '/api/customer/numplate-selection/diagnostics';
const BUILD_VERSION = process.env.REACT_APP_BUILD_ID || 'numplate-diag-20261019-2';
const uuid = () => window.crypto?.randomUUID?.()
    || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
        const value = Math.floor(Math.random() * 16);
        return (character === 'x' ? value : (value & 3) | 8).toString(16);
    });
const errorName = error => ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
    'URIError', 'EvalError', 'AxiosError', 'CanceledError'].includes(error?.name) ? error.name : 'UnknownError';

const CONTROLS = new Set(['NUMBER_OPTION', 'PRIMARY_BUTTON', 'TYPE_OPTION', 'TYPE_BUTTON',
    'TYPE_CONFIRM', 'TYPE_CANCEL', 'TYPE_CONSENT', 'LOOKUP_CONFIRM', 'LOOKUP_CANCEL',
    'LOOKUP_CONSENT', 'SELECTION_CONFIRM', 'SELECTION_CANCEL',
    'TYPE_BACKDROP', 'LOOKUP_BACKDROP', 'SELECTION_BACKDROP']);
const controlElement = target => target instanceof Element ? target.closest('[data-numplate-control]') : null;
const controlName = target => {
    const name = controlElement(target)?.getAttribute('data-numplate-control');
    return CONTROLS.has(name) ? name : 'OTHER';
};
const targetTag = target => ['INPUT', 'BUTTON', 'LABEL', 'SPAN', 'DIV', 'SECTION', 'SVG', 'PATH']
    .includes(target?.tagName?.toUpperCase()) ? target.tagName.toUpperCase() : 'OTHER';
const optionIndex = target => {
    const value = controlElement(target)?.getAttribute('data-numplate-index');
    return value != null && /^\d{1,3}$/.test(value) ? Number(value) : -1;
};

// 실제 DOM과 React 상태를 비교한다. 텍스트, 번호 값, 임의의 클래스/속성은 읽지 않는다.
const inspectDom = () => {
    try {
        const page = document.querySelector('.numplate-customer-page');
        const primary = page?.querySelector('[data-numplate-control="PRIMARY_BUTTON"]');
        const radios = Array.from(page?.querySelectorAll('input[name="carNo"]') || []);
        const confirm = page?.querySelector('[data-numplate-control="SELECTION_CONFIRM"]');
        const detail = {
            domPrimaryPresent: Boolean(primary), domPrimaryDisabled: Boolean(primary?.disabled),
            domRadioCount: radios.length, domCheckedCount: radios.filter(input => input.checked).length,
            domCheckedIndex: radios.findIndex(input => input.checked),
            domDisabledRadioCount: radios.filter(input => input.disabled).length,
            domConfirmPresent: Boolean(confirm), domConfirmDisabled: Boolean(confirm?.disabled),
            domOverlayCount: page?.querySelectorAll('.numplate-consent-backdrop').length || 0,
            viewportWidth: window.innerWidth, viewportHeight: window.innerHeight
        };
        if (primary) {
            const box = primary.getBoundingClientRect();
            const style = window.getComputedStyle(primary);
            const x = box.left + box.width / 2, y = box.top + box.height / 2;
            detail.domPrimaryVisible = box.width > 0 && box.height > 0
                && style.display !== 'none' && style.visibility !== 'hidden';
            detail.domPrimaryInViewport = x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
            detail.domPrimaryPointerBlocked = style.pointerEvents === 'none';
            detail.domPrimaryOpacity = Number(style.opacity);
            // 화면 밖이거나 지원하지 않는 환경에서는 덮임을 단정하지 않고 검사 여부를 남긴다.
            detail.domHitTested = detail.domPrimaryVisible && detail.domPrimaryInViewport
                && typeof document.elementFromPoint === 'function';
            if (detail.domHitTested) {
                const top = document.elementFromPoint(x, y);
                detail.domPrimaryCovered = Boolean(top && !primary.contains(top));
                detail.coverControl = controlName(top);
                detail.coverTag = targetTag(top);
            }
        }
        if (confirm) {
            const box = confirm.getBoundingClientRect();
            const x = box.left + box.width / 2, y = box.top + box.height / 2;
            detail.domConfirmPointerBlocked = window.getComputedStyle(confirm).pointerEvents === 'none';
            detail.domConfirmHitTested = box.width > 0 && box.height > 0
                && x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight
                && typeof document.elementFromPoint === 'function';
            if (detail.domConfirmHitTested) {
                const top = document.elementFromPoint(x, y);
                detail.domConfirmCovered = Boolean(top && !confirm.contains(top));
                detail.confirmCoverControl = controlName(top);
                detail.confirmCoverTag = targetTag(top);
            }
        }
        return detail;
    } catch {
        return { domReadFailed: true };
    }
};

// 로그에는 URL, 토큰, 고객/차량 객체, 오류 원문을 전달하지 않는다.
export const createNumplateDiagnostics = () => {
    const pageSessionId = uuid();
    const script = Array.from(document.scripts).map(item => item.src)
        .find(source => /\/main\.[a-z0-9]+\.js(?:$|\?)/i.test(source));
    const bundleVersion = script?.match(/main\.[a-z0-9]+\.js/i)?.[0] || 'development';
    let timeZone = 'unknown';
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'; } catch { /* 진단만 생략 */ }
    const agent = navigator.userAgent || '';
    const browserFamily = /Edg\//.test(agent) ? 'EDGE' : /SamsungBrowser/.test(agent) ? 'SAMSUNG'
        : /Firefox|FxiOS/.test(agent) ? 'FIREFOX' : /Chrome|CriOS/.test(agent) ? 'CHROME'
            : /Safari/.test(agent) ? 'SAFARI' : 'OTHER';
    const osFamily = /Android/.test(agent) ? 'ANDROID' : /iPhone|iPad|iPod/.test(agent) ? 'IOS'
        : /Windows/.test(agent) ? 'WINDOWS' : /Macintosh/.test(agent) ? 'MAC' : 'OTHER';
    let context = null;
    let snapshot = {};
    let sequence = 0;
    let droppedEvents = 0;
    let stopped = false;
    let enabled = true;
    let activeInteraction = null;
    let gesture = null;
    let lastTouchAt = -Infinity;
    const afterClicks = new Map();
    const queue = [];
    const retryQueue = [];
    const timers = new Set();

    const send = (payload, keepalive = false) => {
        const body = { ...payload, DIAGNOSTIC_ID: context.diagnosticId };
        if (keepalive && navigator.sendBeacon) {
            try {
                if (navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(body)], { type: 'application/json' }))) return;
            } catch { /* 일반 전송으로 처리 */ }
        }
        const failed = error => {
            droppedEvents += 1;
            if ([400, 429].includes(error?.response?.status)) stopped = true;
            // 업무 API는 재요청하지 않는다. 연결 복구 때 진단 행만 제한적으로 다시 보낸다.
            if (!error?.response && !stopped && enabled) {
                if (retryQueue.length >= 20) retryQueue.shift();
                retryQueue.push({ payload, diagnosticId: body.DIAGNOSTIC_ID });
            }
            console.warn('번호판 진단 이력 전송 실패');
        };
        try {
            axios.post(ENDPOINT, body, { timeout: 4000 }).catch(failed);
        } catch (error) {
            failed(error);
        }
    };
    const flushRetry = () => {
        if (!navigator.onLine || !enabled || stopped || !context?.diagnosticId) return;
        retryQueue.splice(0).forEach(item => {
            if (item.diagnosticId === context.diagnosticId) send(item.payload);
        });
    };
    const emit = (event, detail = {}, requestId = uuid(), keepalive = false, includeSnapshot = true) => {
        if (!enabled || stopped || sequence >= 200) return;
        const payload = {
            EVENT_CD: event, REQUEST_ID: requestId,
            DETAIL: {
                ...(includeSnapshot ? snapshot : {}), ...detail, buildVersion: BUILD_VERSION, bundleVersion, timeZone,
                online: navigator.onLine, pageVisible: !document.hidden, hasFocus: document.hasFocus(), browserFamily, osFamily,
                clientTimeMs: Date.now(), clientMonotonicMs: Math.round(performance.now()),
                timeZoneOffsetMinutes: new Date().getTimezoneOffset(),
                responseServerTimeMs: context?.serverTimeMs, responseDbTimeMs: context?.dbTimeMs,
                clientSeq: ++sequence, droppedEvents
            }
        };
        if (context?.diagnosticId) send(payload, keepalive);
        else if (queue.length < 30) queue.push(payload);
        else droppedEvents += 1;
    };
    const record = (event, detail = {}, requestId = activeInteraction || uuid(), keepalive = false) => {
        emit(event, detail, requestId, keepalive);
        if (['BUTTON_STATE', 'NUMBER_STATE', 'UI_TAP', 'UI_AFTER_CLICK', 'PAGE_VISIBLE', 'PAGE_RESTORE'].includes(event)) {
            // DOM은 별도 행으로 나눠 DETAIL_TX 크기 제한으로 상태/시각이 누락되는 것을 줄인다.
            emit('DOM_STATE', { relatedEvent: event, ...inspectDom() }, requestId, keepalive, false);
        }
    };
    const headers = requestId => ({
        'X-Numplate-Page': pageSessionId,
        'X-Numplate-Request': requestId,
        ...(context?.diagnosticId ? { 'X-Numplate-Diagnostic': context.diagnosticId } : {})
    });
    const request = async (operation, config) => {
        const requestId = activeInteraction || uuid();
        const started = performance.now();
        record('API_BEGIN', { operation }, requestId);
        const pending = window.setTimeout(() => {
            record('API_PENDING', { operation, elapsedMs: Math.round(performance.now() - started) }, requestId);
            timers.delete(pending);
        }, 10000);
        timers.add(pending);
        try {
            const response = await axios({ ...config, headers: { ...config.headers, ...headers(requestId) } });
            const result = response.data?.result;
            if (result?.diagnostics?.diagnosticId) {
                if (context?.diagnosticId !== result.diagnostics.diagnosticId) stopped = false;
                context = result.diagnostics;
                queue.splice(0).forEach(payload => send(payload));
            }
            record('API_END', {
                operation, elapsedMs: Math.round(performance.now() - started), httpStatus: response.status,
                ...(result && operation !== 'ACTION' ? {
                    selectionStarted: result.selectionStarted, canStart: result.canStart,
                    selectCount: result.selectCount, candidateCount: result.carNos?.length,
                    expiresAtRaw: result.expiresAt, hasSelected: Boolean(result.selectedCarNo),
                    lookupFailed: result.lookupFailed
                } : {})
            }, requestId);
            return response;
        } catch (error) {
            record('API_ERROR', {
                operation, elapsedMs: Math.round(performance.now() - started),
                httpStatus: error.response?.status || 0, errorName: errorName(error),
                errorCode: ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED',
                    'ERR_BAD_REQUEST', 'ERR_BAD_RESPONSE'].includes(error.code) ? error.code : 'OTHER'
            }, requestId);
            throw error;
        } finally {
            window.clearTimeout(pending);
            timers.delete(pending);
        }
    };
    const listen = () => {
        enabled = true;
        const onError = event => record('CLIENT_ERROR', {
            errorKind: 'SCRIPT_ERROR', errorName: errorName(event.error),
            errorLine: event.lineno, errorColumn: event.colno
        });
        const onRejection = event => record('CLIENT_ERROR', {
            errorKind: 'UNHANDLED_REJECTION', errorName: errorName(event.reason)
        });
        const onVisibility = () => record(document.hidden ? 'PAGE_HIDDEN' : 'PAGE_VISIBLE', {}, uuid(), document.hidden);
        const onNetwork = () => { flushRetry(); record('NETWORK_STATE'); };
        const onRestore = event => { flushRetry(); record('PAGE_RESTORE', { persisted: Boolean(event.persisted) }); };
        const onFocus = () => { flushRetry(); record('PAGE_FOCUS'); };
        // capture 단계의 수동 관찰만 수행한다. preventDefault/상태 변경/업무 재요청은 하지 않는다.
        const onInteraction = event => {
            try {
                const page = document.querySelector('.numplate-customer-page');
                if (!page) return;
                const point = event.changedTouches?.[0] || event;
                if (!page.contains(event.target)) {
                    const box = page.getBoundingClientRect();
                    if (!Number.isFinite(point.clientX) || !Number.isFinite(point.clientY)
                        || point.clientX < box.left || point.clientX > box.right
                        || point.clientY < box.top || point.clientY > box.bottom) return;
                }
                if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
                const now = performance.now();
                // touchstart를 지원하지 않는 pointer 환경도 기록하되 두 이벤트를 중복 저장하지 않는다.
                if (event.type === 'touchstart') {
                    lastTouchAt = now;
                    if (gesture && now - gesture.at < 100 && gesture.pointerType === 'touch') return;
                }
                if (event.type === 'pointerdown' && event.pointerType === 'touch' && now - lastTouchAt < 100) return;
                const control = controlName(event.target);
                const index = optionIndex(event.target);
                const input = controlElement(event.target)?.querySelector('input');
                const actual = event.target instanceof HTMLInputElement ? event.target : input;
                const detail = {
                    control, optionIndex: index, targetTag: targetTag(event.target),
                    targetDisabled: Boolean(event.target.disabled || actual?.disabled),
                    targetChecked: Boolean(actual?.checked),
                    pointerType: ['mouse', 'touch', 'pen'].includes(event.pointerType) ? event.pointerType
                        : event.type === 'touchstart' ? 'touch' : event.type === 'keydown' ? 'keyboard' : 'unknown'
                };
                if (typeof document.elementsFromPoint === 'function' && Number.isFinite(point.clientX)) {
                    const beneath = document.elementsFromPoint(point.clientX, point.clientY)
                        .find(element => ['NUMBER_OPTION', 'PRIMARY_BUTTON', 'SELECTION_CONFIRM'].includes(controlName(element)));
                    detail.underlyingControl = controlName(beneath);
                    detail.underlyingIndex = optionIndex(beneath);
                }
                if (Number.isFinite(point.clientX) && Number.isFinite(point.clientY)) {
                    // pointer-events:none인 항목은 hit test에서 빠질 수 있어 위치로도 대조한다.
                    const intended = Array.from(page.querySelectorAll(
                        '[data-numplate-control="NUMBER_OPTION"], [data-numplate-control="PRIMARY_BUTTON"], [data-numplate-control="SELECTION_CONFIRM"]'
                    )).find(element => {
                        const box = element.getBoundingClientRect();
                        return box.width > 0 && box.height > 0 && point.clientX >= box.left
                            && point.clientX <= box.right && point.clientY >= box.top && point.clientY <= box.bottom;
                    });
                    detail.geometricControl = controlName(intended);
                    detail.geometricIndex = optionIndex(intended);
                    if (intended) detail.geometricPointerBlocked = window.getComputedStyle(intended).pointerEvents === 'none';
                }
                const isTap = ['pointerdown', 'touchstart', 'keydown'].includes(event.type);
                if (isTap || !gesture || now - gesture.at > 1500
                    || gesture.control !== control || gesture.index !== index) {
                    gesture = { id: uuid(), at: now, control, index, pointerType: detail.pointerType };
                }
                const requestId = gesture.id;
                const eventName = isTap ? 'UI_TAP' : event.type === 'click' ? 'UI_CLICK'
                    : event.type === 'change' ? 'UI_CHANGE' : 'UI_CANCEL';
                // 클릭 핸들러가 같은 JS 작업에서 시작한 업무 API와 요청 ID를 공유한다.
                if (event.type === 'click' || event.type === 'change') {
                    activeInteraction = requestId;
                    const reset = window.setTimeout(() => {
                        timers.delete(reset);
                        if (activeInteraction === requestId) activeInteraction = null;
                    }, 0);
                    timers.add(reset);
                }
                emit(eventName, detail, requestId, false, false);
                if (isTap) emit('DOM_STATE', { relatedEvent: eventName, ...inspectDom() }, requestId, false, false);
                if (event.type === 'click' || event.type === 'change') {
                    const previous = afterClicks.get(requestId);
                    if (previous) { window.clearTimeout(previous); timers.delete(previous); }
                    const timer = window.setTimeout(() => {
                        afterClicks.delete(requestId); timers.delete(timer);
                        record('UI_AFTER_CLICK', { control, optionIndex: index }, requestId);
                    }, 50);
                    afterClicks.set(requestId, timer); timers.add(timer);
                }
            } catch { /* 진단 실패는 사용자 입력에 영향을 주지 않는다. */ }
        };
        const inputEvents = ['pointerdown', 'touchstart', 'click', 'change', 'pointercancel', 'keydown'];
        inputEvents.forEach(name => document.addEventListener(name, onInteraction, { capture: true, passive: true }));
        window.addEventListener('online', onNetwork);
        window.addEventListener('offline', onNetwork);
        window.addEventListener('pageshow', onRestore);
        window.addEventListener('focus', onFocus);
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            record('PAGE_HIDDEN', {}, uuid(), true);
            enabled = false;
            timers.forEach(timer => window.clearTimeout(timer));
            timers.clear();
            afterClicks.clear();
            inputEvents.forEach(name => document.removeEventListener(name, onInteraction, true));
            window.removeEventListener('online', onNetwork);
            window.removeEventListener('offline', onNetwork);
            window.removeEventListener('pageshow', onRestore);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    };
    return { record, request, listen, updateSnapshot: value => { snapshot = value; } };
};

export const useNumplateDiagnostics = token => {
    // 링크가 바뀌면 다른 화면 방문으로 구분한다. 토큰 값 자체는 기록하지 않는다.
    const current = useRef(null);
    if (!current.current || current.current.token !== token) {
        current.current = { token, diagnostics: createNumplateDiagnostics() };
    }
    const diagnostics = current.current.diagnostics;
    useEffect(() => diagnostics.listen(), [diagnostics]);
    return diagnostics;
};
