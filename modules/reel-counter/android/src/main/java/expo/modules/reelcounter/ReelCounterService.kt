package expo.modules.reelcounter

import android.accessibilityservice.AccessibilityService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Counts reels by watching the apps that serve them.
 *
 * Counting scrolls counted far too many. A nudge that snaps back, a flick
 * through comments and a real page flip all arrive as the same event, so a
 * thumb resting on the screen ran the number up on its own.
 *
 * This waits for the scrolling to settle and then asks what is on screen. A
 * screen that reads differently from the one the last reel was counted on is
 * the next reel. Nudging leaves the screen as it was, and nothing is counted.
 *
 * What it reads is never kept. The labels on screen are folded into a single
 * number inside `fingerprint`, that number is compared with the one before it,
 * and the text is gone before the method returns. Nothing is stored, nothing
 * is sent, and the number cannot be turned back into what it came from.
 */
class ReelCounterService : AccessibilityService() {
  private val main = Handler(Looper.getMainLooper())

  /** The screen as it read when the last reel was counted. Zero means unknown. */
  private var lastScreen = 0
  private var lastApp: String? = null
  private var lastCountedAt = 0L

  /** One flick keeps firing while the list settles. This waits that burst out. */
  private val settleMs = 250L

  /** No feed serves two different reels faster than this. */
  private val quietMs = 350L

  /** The caption and the handle sit near the top. Deeper costs more than it finds. */
  private val maxNodes = 120

  private val settled = Runnable { countIfChanged() }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val seen = event ?: return
    val from = seen.packageName?.toString() ?: return

    if (seen.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      switchedTo(from)
      return
    }
    if (seen.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) {
      return
    }
    if (!ReelStore.Apps.containsKey(from)) {
      return
    }

    /** Sideways is a carousel or a tab. Only a vertical move is the next reel. */
    if (!movedVertically(seen)) {
      return
    }

    /** Each event pushes the look back, so the screen is read once it holds still. */
    main.removeCallbacks(settled)
    main.postDelayed(settled, settleMs)
  }

  /**
   * Somewhere else is now in front. The pill follows the reels, so anywhere
   * that is not a reels app is somewhere it has no business floating over.
   */
  private fun switchedTo(app: String) {
    if (ReelStore.Apps.containsKey(app) || app == packageName) {
      return
    }

    main.removeCallbacks(settled)
    /** A different app was on screen, so the next reel is a new one either way. */
    lastScreen = 0
    CounterOverlay.hide()
  }

  /**
   * The screen has stopped moving. If it reads differently from the screen the
   * last reel was counted on, the feed moved on and this is the next one.
   */
  private fun countIfChanged() {
    val root = rootInActiveWindow ?: return
    val app = ReelStore.Apps[root.packageName?.toString() ?: return] ?: return

    val screen = fingerprint(root)
    if (screen == 0 || screen == lastScreen) {
      return
    }

    val now = System.currentTimeMillis()
    if (app == lastApp && now - lastCountedAt < quietMs) {
      return
    }

    lastScreen = screen
    lastApp = app
    lastCountedAt = now

    ReelStore.add(this, app)
    CounterOverlay.show(this, ReelStore.total(this))
  }

  /**
   * One number standing for what is on screen, folded from the labels the feed
   * hangs on its own views. A different reel carries a different caption and a
   * different handle, so it folds to a different number.
   *
   * Breadth first and capped at `maxNodes`, because what tells two reels apart
   * is near the top of the tree and the rest is chrome that never changes.
   *
   * The text exists inside this method and nowhere else. What leaves is an int.
   */
  private fun fingerprint(root: AccessibilityNodeInfo): Int {
    var folded = 0
    var seen = 0
    val queue = ArrayDeque<AccessibilityNodeInfo>()
    queue.addLast(root)

    while (queue.isNotEmpty() && seen < maxNodes) {
      val node = queue.removeFirst()
      seen++

      node.text?.let { folded = folded * 31 + worth(it) }
      node.contentDescription?.let { folded = folded * 31 + worth(it) }

      for (child in 0 until node.childCount) {
        queue.addLast(node.getChild(child) ?: continue)
      }
    }

    return folded
  }

  /**
   * What a label is worth to the fingerprint, which is nothing unless it names
   * the reel rather than measures it.
   *
   * A running time, a like count and a view count all sit on screen changing
   * while the same reel plays, and folding those in counted a reel every time
   * a second ticked past under a resting thumb. So anything carrying a digit
   * is passed over, and so is anything too short to be a handle or a caption.
   *
   * The cost is a caption with a number in it, which contributes nothing. The
   * rest of the screen still tells the two reels apart.
   */
  private fun worth(label: CharSequence): Int {
    var letters = 0
    for (character in label) {
      if (character.isDigit()) {
        return 0
      }
      if (character.isLetter()) {
        letters++
      }
    }
    return if (letters >= 4) label.toString().hashCode() else 0
  }

  /**
   * True when the event carries more vertical movement than horizontal.
   *
   * The deltas only exist from API 28, and some feeds report them as zero even
   * then. Either way the answer is yes, because the screen is read afterwards
   * and that is what decides whether anything is counted.
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
    main.removeCallbacks(settled)
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
