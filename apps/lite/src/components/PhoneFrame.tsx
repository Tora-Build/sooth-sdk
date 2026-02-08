import { ReactNode } from 'react';

interface PhoneFrameProps {
  children: ReactNode;
}

/**
 * iPhone-style phone frame for desktop showcase.
 * On mobile, this component is not rendered — the app goes fullscreen.
 */
export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="relative">
      {/* Glow Effect */}
      <div className="absolute -inset-6 bg-gradient-to-b from-[#00d4aa]/15 via-[#00d4aa]/5 to-transparent rounded-[60px] blur-2xl pointer-events-none" />

      {/* Phone Body */}
      <div
        className="relative bg-[#1a1a1a] rounded-[50px] p-2.5"
        style={{
          boxShadow: '0 20px 60px -12px rgba(0, 0, 0, 0.7), inset 0 0 0 2px #2a2a2a',
        }}
      >
        {/* Screen */}
        <div className="rounded-[42px] overflow-hidden w-[360px] h-[780px] border-[8px] border-black shadow-2xl bg-[#1a1a1b] relative">
          {/* Dynamic Island */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[120px] h-[34px] bg-black rounded-[20px] z-20" />

          {/* Status Bar — signal & battery */}
          <div className="absolute top-0 left-0 right-0 h-12 z-30 flex items-center justify-between px-6 pt-3">
            <div className="text-[11px] font-semibold text-white/80 pl-1">
              {/* Left side intentionally empty */}
            </div>
            <div className="flex items-center gap-1.5 pr-1">
              <svg className="w-[14px] h-[14px] text-white/80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <svg className="w-[14px] h-[14px] text-white/80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 22h20V2z M12 12V2.1L2 22h20L12 12z" opacity="0" />
                <rect x="1" y="6" width="3" height="12" rx="0.5" opacity="0.3" />
                <rect x="6" y="4" width="3" height="14" rx="0.5" opacity="0.5" />
                <rect x="11" y="2" width="3" height="16" rx="0.5" opacity="0.7" />
                <rect x="16" y="0" width="3" height="18" rx="0.5" opacity="1" />
              </svg>
              <div className="flex items-center">
                <div className="w-[22px] h-[11px] border-[1.5px] border-white/80 rounded-[3px] relative">
                  <div className="absolute inset-[1.5px] right-[2px] bg-[#00d4aa] rounded-[1px]" />
                </div>
                <div className="w-[1.5px] h-[5px] bg-white/80 rounded-r-full ml-[0.5px]" />
              </div>
            </div>
          </div>

          {/* App Content — transform creates new stacking context so fixed children stay inside */}
          <div className="w-full h-full overflow-hidden phone-frame-content pt-12 pb-2" style={{ transform: 'translateZ(0)' }}>
            {children}
          </div>

          {/* Home Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-[5px] bg-white/30 rounded-full z-10" />
        </div>
      </div>
    </div>
  );
}
