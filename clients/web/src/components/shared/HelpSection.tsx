import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { createPortal } from 'react-dom';

interface HelpSectionProps {
  titleId: string;
  items: string[];
}

export const HelpSection = ({ titleId, items }: HelpSectionProps) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 120);
  };

  useEffect(() => () => clearCloseTimeout(), []);

  useEffect(() => {
    if (!open) return;

    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      const panelWidth = panelRect?.width || 320;
      const panelHeight = panelRect?.height || 140;

      const padding = 12;
      const leftTarget = triggerRect.right + 8;
      const leftMax = window.innerWidth - panelWidth - padding;
      const left = Math.min(Math.max(leftTarget, padding), leftMax);

      const topTarget = triggerRect.top + triggerRect.height / 2;
      const topMin = padding + panelHeight / 2;
      const topMax = window.innerHeight - padding - panelHeight / 2;
      const top = Math.min(Math.max(topTarget, topMin), topMax);

      setPanelStyle({
        left,
        top,
        transform: 'translateY(-50%)'
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <div className="help-popover">
      <button
        type="button"
        className="help-trigger"
        onMouseEnter={() => {
          clearCloseTimeout();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => {
          clearCloseTimeout();
          setOpen(true);
        }}
        onBlur={(event) => {
          const nextFocus = event.relatedTarget as Node | null;
          if (panelRef.current?.contains(nextFocus)) return;
          scheduleClose();
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={intl.formatMessage({ id: titleId })}
        ref={triggerRef}
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            className="help-panel"
            role="dialog"
            ref={panelRef}
            tabIndex={-1}
            style={panelStyle ?? undefined}
            onMouseEnter={clearCloseTimeout}
            onMouseLeave={scheduleClose}
            onBlur={(event) => {
              const nextFocus = event.relatedTarget as Node | null;
              if (triggerRef.current?.contains(nextFocus)) return;
              if (panelRef.current?.contains(nextFocus)) return;
              scheduleClose();
            }}
          >
            <div className="help-title">{intl.formatMessage({ id: titleId })}</div>
            <ul className="help-list">
              {items.map((id) => (
                <li key={id}>{intl.formatMessage({ id })}</li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
};
