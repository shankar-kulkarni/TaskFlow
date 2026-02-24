import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: ReactNode
  className?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export const Tooltip = ({ content, children, className, placement = 'top' }: TooltipProps) => {
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const measureRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const [effectivePlacement, setEffectivePlacement] = useState<TooltipProps['placement']>(placement)
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null)
  const tooltipId = useId()

  useEffect(() => {
    setEffectivePlacement(placement)
  }, [placement])

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  const scheduleClose = () => {
    clearCloseTimeout()
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false)
    }, 120)
  }

  useEffect(() => () => clearCloseTimeout(), [])

  useEffect(() => {
    if (!open) return

    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsidePointer)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const resolvePlacement = () => {
    if (!wrapperRef.current || !measureRef.current || typeof window === 'undefined') return

    const wrapperRect = wrapperRef.current.getBoundingClientRect()
    const tooltipRect = measureRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const gap = 8
    const margin = 6

    const fitsTop = wrapperRect.top - gap - tooltipRect.height >= margin
    const fitsBottom = wrapperRect.bottom + gap + tooltipRect.height <= viewportHeight - margin
    const fitsLeft = wrapperRect.left - gap - tooltipRect.width >= margin
    const fitsRight = wrapperRect.right + gap + tooltipRect.width <= viewportWidth - margin

    let nextPlacement = placement

    if (placement === 'top' && !fitsTop && fitsBottom) nextPlacement = 'bottom'
    else if (placement === 'bottom' && !fitsBottom && fitsTop) nextPlacement = 'top'
    else if ((placement === 'left' && !fitsLeft) || (placement === 'right' && !fitsRight)) {
      if (fitsTop || fitsBottom) nextPlacement = fitsTop ? 'top' : 'bottom'
    }

    setEffectivePlacement(nextPlacement)
  }

  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return

    const updatePosition = () => {
      if (!wrapperRef.current) return

      resolvePlacement()

      const wrapperRect = wrapperRef.current.getBoundingClientRect()
      const panelRect = panelRef.current?.getBoundingClientRect()
      const panelWidth = panelRect?.width || 220
      const panelHeight = panelRect?.height || 40
      const gap = 8
      const margin = 8

      let left = wrapperRect.left + wrapperRect.width / 2 - panelWidth / 2
      let top = wrapperRect.top - panelHeight - gap

      if (effectivePlacement === 'bottom') {
        top = wrapperRect.bottom + gap
      } else if (effectivePlacement === 'left') {
        left = wrapperRect.left - panelWidth - gap
        top = wrapperRect.top + wrapperRect.height / 2 - panelHeight / 2
      } else if (effectivePlacement === 'right') {
        left = wrapperRect.right + gap
        top = wrapperRect.top + wrapperRect.height / 2 - panelHeight / 2
      }

      left = Math.min(Math.max(left, margin), window.innerWidth - panelWidth - margin)
      top = Math.min(Math.max(top, margin), window.innerHeight - panelHeight - margin)

      setPanelStyle({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [effectivePlacement, open])

  return (
    <span
      ref={wrapperRef}
      className={['tooltip-wrap', className, open ? 'tooltip-open' : ''].filter(Boolean).join(' ')}
      data-placement={effectivePlacement}
      onMouseEnter={() => {
        clearCloseTimeout()
        resolvePlacement()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
      onFocusCapture={() => {
        clearCloseTimeout()
        resolvePlacement()
        setOpen(true)
      }}
      onBlurCapture={(event) => {
        const nextFocus = event.relatedTarget as Node | null
        if (wrapperRef.current?.contains(nextFocus)) return
        if (panelRef.current?.contains(nextFocus)) return
        scheduleClose()
      }}
      aria-describedby={open ? tooltipId : undefined}
    >
      <span ref={measureRef} className="tooltip-measure" aria-hidden="true">
        {content}
      </span>
      {children}

      {open &&
        createPortal(
          <div
            id={tooltipId}
            ref={panelRef}
            role="tooltip"
            className="tooltip-content"
            data-placement={effectivePlacement}
            style={panelStyle ?? undefined}
            onMouseEnter={clearCloseTimeout}
            onMouseLeave={scheduleClose}
          >
            <span className="tooltip-content-text">{content}</span>
            <span className="tooltip-arrow" aria-hidden="true" />
          </div>,
          document.body,
        )}
    </span>
  )
}
