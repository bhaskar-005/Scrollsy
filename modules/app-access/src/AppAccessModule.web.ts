import { registerWebModule, NativeModule } from 'expo';

/** No special access on the web, so both answers are a flat no. */
class AppAccessModule extends NativeModule<{}> {
  hasUsageAccess(): boolean {
    return false;
  }
  hasOverlay(): boolean {
    return false;
  }
}

export default registerWebModule(AppAccessModule, 'AppAccessModule');
