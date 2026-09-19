import { registerWebModule, NativeModule } from 'expo';

/** Nothing counts reels on the web, so it counts nothing and shows nothing. */
class ReelCounterModule extends NativeModule<{}> {
  isCounting(): boolean {
    return false;
  }
  drain(): { date: string; app: string; reels: number }[] {
    return [];
  }
  setTotal(): void {}
  hideOverlay(): void {}
}

export default registerWebModule(ReelCounterModule, 'ReelCounterModule');
