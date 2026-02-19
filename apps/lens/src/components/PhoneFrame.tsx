import { ReactNode, useRef, createContext } from 'react';

/** Ref to the phone frame content container — used to portal modals/drawers inside the frame */
export const PhoneFrameContainerContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

interface PhoneFrameProps {
  children: ReactNode;
}

/**
 * iPhone-style phone frame for desktop showcase.
 * On mobile, this component is not rendered — the app goes fullscreen.
 */
export function PhoneFrame({ children }: PhoneFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[90px] h-[24px] bg-black rounded-full z-20" />

          {/* Status Bar — Wi-Fi & battery */}
          <div className="absolute top-0 left-0 right-0 h-10 z-30 flex items-center justify-end px-6 pt-2.5">
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <div className="flex items-center">
                <div className="w-[20px] h-[10px] border-[1.5px] border-white/80 rounded-[2.5px] relative">
                  <div className="absolute inset-[1.5px] right-[2px] bg-[#00d4aa] rounded-[1px]" />
                </div>
                <div className="w-[1px] h-[4px] bg-white/80 rounded-r-full ml-[0.5px]" />
              </div>
            </div>
          </div>

          {/* App Content — transform creates new stacking context so fixed children stay inside */}
          <div ref={containerRef} className="w-full h-full overflow-hidden phone-frame-content pt-12 relative" style={{ transform: 'translateZ(0)' }}>
            <PhoneFrameContainerContext.Provider value={containerRef}>
              {children}
            </PhoneFrameContainerContext.Provider>
          </div>
        </div>
      </div>
    </div>
  );
}
