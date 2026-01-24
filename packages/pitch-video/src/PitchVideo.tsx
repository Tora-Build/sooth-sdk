import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

import { Background } from './components/Background';
import { Scene1LogoReveal } from './scenes/Scene1LogoReveal';
import { Scene2Problem } from './scenes/Scene2Problem';
import { Scene3Solution } from './scenes/Scene3Solution';
import { Scene4Features } from './scenes/Scene4Features';
import { Scene5Traction } from './scenes/Scene5Traction';
import { Scene6CTA } from './scenes/Scene6CTA';
import { VIDEO, SCENE_TIMING } from './brand';

const { fps } = VIDEO;

// Convert seconds to frames
const toFrames = (seconds: number) => Math.round(seconds * fps);

// Scene durations in frames
const SCENES = {
  logoReveal: toFrames(SCENE_TIMING.logoReveal.duration),
  problem: toFrames(SCENE_TIMING.problem.duration),
  solution: toFrames(SCENE_TIMING.solution.duration),
  features: toFrames(SCENE_TIMING.features.duration),
  traction: toFrames(SCENE_TIMING.traction.duration),
  cta: toFrames(SCENE_TIMING.cta.duration),
};

// Transition duration
const TRANSITION_FRAMES = 20;

export const PitchVideo = () => {
  return (
    <AbsoluteFill>
      {/* Background layer - always visible */}
      <Background />

      {/* Scene transitions */}
      <TransitionSeries>
        {/* Scene 1: Logo Reveal (8s) */}
        <TransitionSeries.Sequence durationInFrames={SCENES.logoReveal}>
          <Scene1LogoReveal />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 2: Problem (10s) */}
        <TransitionSeries.Sequence durationInFrames={SCENES.problem}>
          <Scene2Problem />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-right' })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 3: Solution (10s) */}
        <TransitionSeries.Sequence durationInFrames={SCENES.solution}>
          <Scene3Solution />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 4: Features (14s) */}
        <TransitionSeries.Sequence durationInFrames={SCENES.features}>
          <Scene4Features />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-bottom' })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 5: Traction (10s) */}
        <TransitionSeries.Sequence durationInFrames={SCENES.traction}>
          <Scene5Traction />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {/* Scene 6: CTA (8s) */}
        <TransitionSeries.Sequence durationInFrames={SCENES.cta}>
          <Scene6CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
