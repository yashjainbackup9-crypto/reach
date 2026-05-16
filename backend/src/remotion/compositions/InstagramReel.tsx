import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  CalculateMetadataFunction,
} from 'remotion';
import { PostVideoProps } from './InstagramSlideshow';

const DURATION_FRAMES = 270; // 9 s at 30 fps

export const calculateMetadata: CalculateMetadataFunction<PostVideoProps> = () => ({
  durationInFrames: DURATION_FRAMES,
  width: 1080,
  height: 1920,
});

export const InstagramReel: React.FC<PostVideoProps> = ({ caption, mediaUrls, author }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const coverUrl = mediaUrls[0];

  // Slow Ken Burns zoom in
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], { extrapolateRight: 'clamp' });

  const short = caption.length > 220 ? `${caption.slice(0, 217)}…` : caption;

  // Caption slide-up
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 140 }, durationInFrames: 28 });
  const translateY = interpolate(enter, [0, 1], [100, 0]);
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Background image */}
      {coverUrl ? (
        <AbsoluteFill>
          <Img
            src={coverUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
          />
          {/* Vignette */}
          <AbsoluteFill
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{ background: 'linear-gradient(160deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' }}
        />
      )}

      {/* Bottom overlay with caption */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 35%, transparent 65%)',
        }}
      />

      {/* Text content */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          padding: '0 50px 100px',
          transform: `translateY(${translateY}px)`,
          opacity,
        }}
      >
        {author ? (
          <div
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 34,
              fontWeight: 700,
              marginBottom: 14,
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: 0.5,
            }}
          >
            @{author}
          </div>
        ) : null}
        <div
          style={{
            color: '#fff',
            fontSize: 38,
            lineHeight: 1.5,
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 500,
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}
        >
          {short}
        </div>

        {/* Media count badge */}
        {mediaUrls.length > 1 && (
          <div
            style={{
              marginTop: 24,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(8px)',
              borderRadius: 40,
              padding: '10px 20px',
              width: 'fit-content',
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
            <span style={{ color: '#fff', fontSize: 26, fontFamily: 'system-ui, sans-serif' }}>
              +{mediaUrls.length - 1} more
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
