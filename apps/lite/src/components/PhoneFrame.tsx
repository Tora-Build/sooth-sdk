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
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-7 bg-black rounded-full z-20" />

        {/* Screen */}
        <div className="rounded-[42px] overflow-hidden w-[360px] h-[780px] border-[8px] border-black shadow-2xl bg-[#1a1a1b] relative">
          {/* Status Bar */}
          <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm z-10 flex items-end justify-between px-7 pb-1">
            <span className="text-white text-xs font-medium">9:41</span>
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <div className="w-5 h-2.5 border border-white rounded-sm">
                <div className="w-3 h-full bg-[#00d4aa] rounded-sm" />
              </div>
            </div>
          </div>

          {/* App Content */}
          <div className="w-full h-full overflow-hidden">
            {children}
          </div>

          {/* Home Indicator */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/30 rounded-full z-10" />
        </div>
      </div>
    </div>
  );
}
