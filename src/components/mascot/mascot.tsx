import { Image, type ImageProps } from 'expo-image';
import { type StyleProp, type ImageStyle } from 'react-native';

import { MascotArt, MascotAspect, type MascotState } from '@/constants/stages';

type MascotProps = {
  stage: MascotState;
  /** Width in points. Height follows the art proportion. */
  width: number;
  /**
   * How he dissolves into the next state. Pass a longer one where the change
   * itself is the point rather than a side effect.
   */
  transition?: ImageProps['transition'];
  style?: StyleProp<ImageStyle>;
};

export function Mascot({ stage, width, transition = 220, style }: MascotProps) {
  return (
    <Image
      source={MascotArt[stage]}
      style={[{ width, height: width * MascotAspect }, style]}
      contentFit="contain"
      transition={transition}
    />
  );
}
