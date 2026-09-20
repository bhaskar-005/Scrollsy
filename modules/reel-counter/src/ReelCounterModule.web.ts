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
  setStyle(): void {}
  setSize(): void {}
  position(): { x: number; y: number } | null {
    return null;
  }
  hideOverlay(): void {}
}

export default registerWebModule(ReelCounterModule, 'ReelCounterModule');
