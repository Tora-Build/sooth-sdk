import { Composition } from 'remotion';
import { PitchVideo } from './PitchVideo';
import { IntroVideo, INTRO_VIDEO_DURATION_SECONDS } from './IntroVideo';
import { VIDEO } from './brand';

export const RemotionRoot = () => {
  return (
    <>
      {/* Full pitch video (60s) */}
      <Composition
        id="PitchVideo"
        component={PitchVideo}
        durationInFrames={VIDEO.fps * VIDEO.durationInSeconds}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />

      {/* Intro video (90s) */}
      <Composition
        id="IntroVideo"
        component={IntroVideo}
        durationInFrames={VIDEO.fps * INTRO_VIDEO_DURATION_SECONDS}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />

      {/* Square format for social (90s, 1080x1080) */}
      <Composition
        id="IntroVideoSquare"
        component={IntroVideo}
        durationInFrames={VIDEO.fps * INTRO_VIDEO_DURATION_SECONDS}
        fps={VIDEO.fps}
        width={1080}
        height={1080}
      />

      {/* Vertical format for TikTok/Reels (90s, 1080x1920) */}
      <Composition
        id="IntroVideoVertical"
        component={IntroVideo}
        durationInFrames={VIDEO.fps * INTRO_VIDEO_DURATION_SECONDS}
        fps={VIDEO.fps}
        width={1080}
        height={1920}
      />
    </>
  );
};
