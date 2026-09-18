import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class AppAccessModule extends NativeModule<{}> {
  hasUsageAccess(): boolean;
  hasOverlay(): boolean;
}

/**
 * Null in Expo Go, on the web, and in any build made before this module
 * existed, so every caller has to answer for that rather than crash a screen.
 */
export default requireOptionalNativeModule<AppAccessModule>('AppAccess');
