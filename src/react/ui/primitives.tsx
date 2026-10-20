import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** Outcome styling: YES solid, NO outlined. */
  outcome?: 'yes' | 'no';
}

export interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'md' | 'sm';
  className?: string;
}

/** Radio-group segmented control with roving focus (arrows, Home, End). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((i) => i >= 0);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusIndex =
    selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : enabled[0];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabled.length === 0) return;
    const current = enabled.indexOf(focusIndex ?? -1);
    let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = enabled[(current + 1) % enabled.length];
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = enabled[(current - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    const option = next === undefined ? undefined : options[next];
    if (next === undefined || !option) return;
    event.preventDefault();
    buttons.current[next]?.focus();
    if (option.value !== value) onChange(option.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={['s-seg', size === 'sm' ? 's-seg-sm' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          type="button"
          role="radio"
          className="s-seg-btn"
          aria-checked={option.value === value}
          tabIndex={index === focusIndex ? 0 : -1}
          disabled={option.disabled}
          data-outcome={option.outcome}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface ChipOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface ChipsProps {
  label: string;
  options: readonly ChipOption[];
  /** Currently matching chip, if any. */
  value?: string | null;
  onSelect: (value: string) => void;
}

/** Preset amount chips. */
export function Chips({ label, options, value, onSelect }: ChipsProps) {
  return (
    <div role="group" aria-label={label} className="s-chips">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="s-chip"
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

/** Label/value cell; render inside a `<dl className="s-stats">`. */
export function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="s-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint !== undefined && <span className="s-stat-hint">{hint}</span>}
    </div>
  );
}

export interface BadgeProps {
  tone?: 'default' | 'strong' | 'outline' | 'live';
  children: ReactNode;
}

export function Badge({ tone = 'default', children }: BadgeProps) {
  return (
    <span className="s-badge" data-tone={tone}>
      {children}
    </span>
  );
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, className }: SkeletonProps) {
  const style: CSSProperties = { width, height };
  return (
    <span aria-hidden="true" className={`s-skeleton ${className ?? ''}`.trim()} style={style} />
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      className="s-spinner"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export interface NoticeProps {
  tone?: 'info' | 'warn' | 'error';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}

/** Inline message; errors are announced assertively (`role=alert`), others politely. */
export function Notice({ tone = 'info', title, children, action }: NoticeProps) {
  return (
    <div className="s-notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="s-notice-icon" aria-hidden="true">
        {tone === 'info' ? 'i' : '!'}
      </span>
      <div className="s-notice-body">
        {title !== undefined && <span className="s-notice-title">{title}</span>}
        {children}
        {action}
      </div>
    </div>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal bottom sheet positioned inside the nearest positioned ancestor (the widget root),
 * never against the viewport. Escape and the scrim close it; focus is trapped while open
 * and returned to the previously focused element on close.
 */
export function Sheet({ open, onClose, title, closeLabel, children, footer }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const root = panel.current?.getRootNode();
    const owner = root instanceof ShadowRoot || root instanceof Document ? root : document;
    const previous = owner.activeElement instanceof HTMLElement ? owner.activeElement : null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeRef.current();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = (panel.current.getRootNode() as Document | ShadowRoot).activeElement;
    if (event.shiftKey && (active === first || active === panel.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="s-sheet-layer" onKeyDown={onKeyDown}>
      <div className="s-sheet-scrim" aria-hidden="true" onClick={() => closeRef.current()} />
      <div
        ref={panel}
        className="s-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <span className="s-sheet-grip" aria-hidden="true" />
        <div className="s-sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="s-icon-btn"
            aria-label={closeLabel}
            onClick={() => closeRef.current()}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3.5 3.5l9 9m0-9l-9 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

export interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Disclosure({ summary, children, defaultOpen = false }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className="s-disclosure">
      <button
        type="button"
        className="s-disclosure-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {summary}
      </button>
      <div id={panelId} className="s-disclosure-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
