import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  CalculateMetadataFunction,
} from 'remotion';

export interface PostVideoProps {
  caption: string;
  mediaUrls: string[];
  author: string;
  pageTitle: string;
}

const FRAMES_PER_SLIDE = 90; // 3 s at 30 fps
const MAX_SLIDES = 6;

export const calculateMetadata: CalculateMetadataFunction<PostVideoProps> = ({ props }) => {
  const count = Math.min(Math.max(props.mediaUrls.length, 1), MAX_SLIDES);
  return { durationInFrames: count * FRAMES_PER_SLIDE };
};

export const InstagramSlideshow: React.FC<PostVideoProps> = ({ caption, mediaUrls, author }) => {
  const { durationInFrames } = useVideoConfig();
  const slides = mediaUrls.slice(0, MAX_SLIDES);
  const slideCount = Math.max(slides.length, 1);
  const framesPerSlide = Math.floor(durationInFrames / slideCount);

  return (
    <AbsoluteFill style={{ backgroundColor: '#111' }}>
      {slides.map((url, i) => (
        <Sequence key={i} from={i * framesPerSlide} durationInFrames={framesPerSlide}>
          <SlideFrame url={url} index={i} framesPerSlide={framesPerSlide} />
        </Sequence>
      ))}

      {slides.length === 0 && (
        <AbsoluteFill
          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        />
      )}

      <CaptionOverlay caption={caption} author={author} totalFrames={durationInFrames} />
      {slides.length > 1 && <SlideDots total={slideCount} framesPerSlide={framesPerSlide} />}
    </AbsoluteFill>
  );
};

/* ── Slide with Ken Burns zoom ── */
function SlideFrame({ url, index, framesPerSlide }: { url: string; index: number; framesPerSlide: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoomDir = index % 2 === 0 ? 1 : -1;
  const scale = interpolate(frame, [0, framesPerSlide], [1, 1 + 0.04 * zoomDir], {
    extrapolateRight: 'clamp',
  });

  const fadeIn = spring({ frame, fps, config: { damping: 200, stiffness: 120 }, durationInFrames: 18 });
  const opacity = interpolate(fadeIn, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={url}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
      />
    </AbsoluteFill>
  );
}

/* ── Caption bar at the bottom ── */
function CaptionOverlay({ caption, author, totalFrames }: { caption: string; author: string; totalFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 180, stiffness: 180 }, durationInFrames: 22 });
  const exitStart = totalFrames - 22;
  const exit = frame >= exitStart
    ? interpolate(frame, [exitStart, totalFrames], [0, 1], { extrapolateRight: 'clamp' })
    : 0;

  const translateY = interpolate(enter, [0, 1], [72, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]) * (1 - exit);
  const short = caption.length > 180 ? `${caption.slice(0, 177)}…` : caption;

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 0 0' }}>
      <div
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 70%, transparent 100%)',
          padding: '60px 44px 40px',
          transform: `translateY(${translateY}px)`,
          opacity,
        }}
      >
        {author ? (
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 22, fontWeight: 700, marginBottom: 10, fontFamily: 'system-ui, sans-serif', letterSpacing: 0.5 }}>
            @{author}
          </div>
        ) : null}
        <div style={{ color: '#fff', fontSize: 30, lineHeight: 1.45, fontFamily: 'system-ui, sans-serif', fontWeight: 500 }}>
          {short}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ── Dot indicators ── */
function SlideDots({ total, framesPerSlide }: { total: number; framesPerSlide: number }) {
  const frame = useCurrentFrame();
  const active = Math.min(Math.floor(frame / framesPerSlide), total - 1);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 24, flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === active ? 28 : 10,
              height: 10,
              borderRadius: 5,
              background: i === active ? '#fff' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}
