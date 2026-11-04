import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';

export default function PushNotice({ notice, onDismiss, headerHeight = 58 }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [direction, setDirection] = useState(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const closing = useRef(false);

  const dismiss = useCallback((nextDirection = 'up') => {
    if (closing.current) return;
    closing.current = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) onDismiss();
    else setDirection(nextDirection);
  }, [onDismiss]);

  useEffect(() => {
    if (pressed || hovered || focused || direction) return;
    const timer = window.setTimeout(() => dismiss(), 7000);
    return () => window.clearTimeout(timer);
  }, [pressed, hovered, focused, direction, dismiss]);

  useEffect(() => {
    if (!direction) return;
    const timer = window.setTimeout(onDismiss, 160);
    return () => window.clearTimeout(timer);
  }, [direction, onDismiss]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      dismiss();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [dismiss]);

  const startPointer = (event) => {
    if (closing.current || event.isPrimary === false || event.button > 0) return;
    suppressClick.current = false;
    if (event.target.closest('button')) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    setPressed(true);
  };

  const movePointer = (event) => {
    const gesture = pointer.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    if (!gesture.moved && Math.max(Math.abs(x), Math.abs(y)) > 8) {
      gesture.moved = true;
      suppressClick.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    if (gesture.moved) setOffset({ x, y: Math.min(y, 0) });
  };

  const finishPointer = (event, cancelled = false) => {
    const gesture = pointer.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPressed(false);
    setDragging(false);
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    if (cancelled || Math.max(Math.abs(x), Math.abs(y)) > 8) suppressClick.current = true;
    if (!cancelled && Math.abs(x) >= 64 && Math.abs(x) > Math.abs(y)) dismiss(x < 0 ? 'left' : 'right');
    else if (!cancelled && y <= -48 && Math.abs(y) >= Math.abs(x)) dismiss('up');
    else setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="numplate-push-layer">
      <div className="numplate-push-notice" style={{ top: headerHeight + 8 }}>
        <div
          className={`numplate-push-card${dragging ? ' is-dragging' : ''}${direction ? ' is-closing' : ''}`}
          style={{ '--push-x': `${offset.x}px`, '--push-y': `${offset.y}px` }}
          data-dismiss-direction={direction || undefined}
          role="status" aria-live="polite" aria-atomic="true"
          onPointerDown={startPointer}
          onPointerMove={movePointer}
          onPointerUp={finishPointer}
          onPointerCancel={(event) => finishPointer(event, true)}
          onLostPointerCapture={(event) => { if (event.target === event.currentTarget) finishPointer(event, true); }}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setHovered(false);
            if (pointer.current && !pointer.current.moved) finishPointer(event, true);
          }}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') suppressClick.current = false; }}
          onClickCapture={(event) => {
            if (!suppressClick.current && !closing.current) return;
            suppressClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <Link className="numplate-push-content" to="/numplateapp/notifications" onClick={onDismiss} draggable={false}>
            <span className="numplate-push-icon"><BellRing aria-hidden="true" /></span>
            <span className="numplate-push-copy">
              <small className="numplate-push-eyebrow">DACOS · 새 알림</small>
              <strong className="numplate-push-title">{notice.title}</strong>
              <span className="numplate-push-body">{notice.body}</span>
            </span>
          </Link>
          <button type="button" className="numplate-push-close" onClick={() => dismiss()} aria-label="알림 닫기">
            <X aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
