import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: React.ReactNode;
    className?: string;
    maxWidth?: string; // e.g. "max-w-2xl"
}

export const Dialog: React.FC<DialogProps> = ({
    isOpen,
    onClose,
    children,
    title,
    className,
    maxWidth = "max-w-md"
}) => {
    const titleId = useId();
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);
    const lastActiveElRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            lastActiveElRef.current = document.activeElement as HTMLElement | null;
            document.body.style.overflow = 'hidden';
            // Move focus into the dialog for keyboard users
            setTimeout(() => closeBtnRef.current?.focus(), 0);
        } else {
            document.body.style.overflow = 'unset';
            // Restore focus back to the trigger (best-effort)
            setTimeout(() => lastActiveElRef.current?.focus?.(), 0);
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
            }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Dialog Panel */}
            <div
                className={cn(
                    "relative w-full bg-slate-950/70 border border-slate-800/70 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col backdrop-blur-xl",
                    maxWidth,
                    className
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800/70 bg-slate-900/30 rounded-t-2xl">
                    {title ? (
                        <h2 id={titleId} className="text-base font-heading font-semibold text-slate-100 tracking-tight">
                            {title}
                        </h2>
                    ) : (
                        <div />
                    )}
                    <button
                        onClick={onClose}
                        ref={closeBtnRef}
                        className="p-2 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        aria-label="Close dialog"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto custom-scrollbar">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
