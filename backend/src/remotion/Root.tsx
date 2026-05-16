import React from 'react';
import { Composition } from 'remotion';
import {
  InstagramSlideshow,
  calculateMetadata as slideshowMeta,
  PostVideoProps,
} from './compositions/InstagramSlideshow';
import { InstagramReel, calculateMetadata as reelMeta } from './compositions/InstagramReel';

const defaultProps: PostVideoProps = {
  caption: 'Your Instagram caption will appear here.',
  mediaUrls: [],
  author: 'username',
  pageTitle: '',
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="InstagramSlideshow"
      component={InstagramSlideshow}
      calculateMetadata={slideshowMeta}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1080}
      defaultProps={defaultProps}
    />
    <Composition
      id="InstagramReel"
      component={InstagramReel}
      calculateMetadata={reelMeta}
      durationInFrames={270}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  </>
);
