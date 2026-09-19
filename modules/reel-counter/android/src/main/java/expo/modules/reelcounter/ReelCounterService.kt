package expo.modules.reelcounter

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.view.accessibility.AccessibilityEvent

/**
 * Counts reels by watching the apps that serve them.
 *
 * Android gives no API for "a reel went past", so this infers it. A reel feed
 * is a vertical pager: one swipe replaces the whole screen with the next video.
 * That shows up as a scroll event from the app in the foreground, so a scroll
 * is counted as a reel.
 *
 * Two things keep that honest:
 *
 * - A gap, because one flick produces a burst of scroll events as the list
 *   settles, and all of them are the same reel.
 * - A vertical test, because sideways movement is a carousel or a tab change,
 *   never the next reel.
 *
 * It reads no text, no images and nothing about what was on screen. The only
 * thing kept is that a reel happened, and which app it was in.
 */
class ReelCounterService : AccessibilityService() {
  private var lastCountedAt = 0L
  private var lastPackage: String? = null

  /**
   * One flick settles well inside this. Anything sooner is the same reel
   * still moving, anything later is a new one.
   */
  private val quietMs = 450L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val scrolled = event ?: return
    if (scrolled.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) {
      return
    }

    val app = ReelStore.Apps[scrolled.packageName?.toString() ?: return] ?: return

    /** Sideways is a carousel or a tab. Only a vertical move is the next reel. */
    if (!movedVertically(scrolled)) {
      return
    }

    val now = System.currentTimeMillis()
    if (app == lastPackage && now - lastCountedAt < quietMs) {
      return
    }

    lastCountedAt = now
    lastPackage = app

    ReelStore.add(this, app)
    CounterOverlay.show(this, ReelStore.total(this))
  }

  /**
   * True when the event carries more vertical movement than horizontal.
   *
   * The deltas only exist from API 28, and some feeds report them as zero even
   * then. Either way the answer is yes: a scroll inside a reel app with
   * nothing else to go on is far more often a reel than not, and the gap above
   * is what stops that counting the same one twice.
   */
  private fun movedVertically(event: AccessibilityEvent): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return true
    }
    val dy = kotlin.math.abs(event.scrollDeltaY)
    val dx = kotlin.math.abs(event.scrollDeltaX)
    if (dy == 0 && dx == 0) {
      return true
    }
    return dy >= dx
  }

  override fun onInterrupt() {
    // Nothing to stop. The count is written as it happens.
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    running = true
  }

  override fun onDestroy() {
    running = false
    CounterOverlay.hide()
    super.onDestroy()
  }

  companion object {
    /** Whether this service is live in this process. See `isCounting` in the module. */
    @Volatile
    var running = false
      private set
  }
}
