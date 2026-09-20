package expo.modules.reelcounter

import android.accessibilityservice.AccessibilityService
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Counts reels by watching the apps that serve them.
 *
 * Counting scrolls counted almost everything. A home feed, a comment sheet, a
 * thumb resting on the screen and a real flip to the next reel all arrive as
 * the same event, so the number ran up on its own.
 *
 * A reel is counted only when four separate things agree, and each one throws
 * out something the others cannot.
 *
 * - `onReelSurface` asks whether a reel feed scrolled at all. A pager shows
 *   one video, a home feed shows several cards and says so. YouTube's home and
 *   Instagram's home never get past here.
 * - The feed's own position, `pageNow`, has to have moved. Holding a reel and
 *   dragging it uncovers the one below without ever leaving the one you are
 *   on, and only the position knows the difference.
 * - The screen has to read as one no reel has been counted on, which is what
 *   stops a reel watched earlier counting again when it is swiped back to.
 * - And the feed has to have held still for a moment first, so one flick is
 *   one reel rather than the burst of events it really is.
 *
 * What it reads is never kept. The labels on screen are folded into a single
 * number inside `fingerprint`, that number is checked against the reels
 * already counted, and the text is gone before the method returns. Nothing is
 * stored, nothing is sent, and the number cannot be turned back into what it
 * came from.
 */
class ReelCounterService : AccessibilityService() {
  private val main = Handler(Looper.getMainLooper())

  /**
   * The reels counted so far, oldest first, as the numbers their screens
   * folded to.
   *
   * Remembering only the reel before this one was not enough. Swiping back up
   * through the feed lands on reels already watched, and each one read as a
   * change from the one before it, so going back over five reels counted five
   * more. A reel is only new if it is not in here.
   */
  private val watched = LinkedHashSet<Int>()

  /**
   * How far back a swipe up is still recognised. Past this the oldest is
   * forgotten and would count again, which is far enough that nobody scrolls
   * back through it by hand.
   */
  private val remembered = 64

  /**
   * Which reel the feed is on, and which one was on when the last one was
   * counted. A pager gives its position away in every scroll event.
   *
   * This is what tells a held drag from a real flip, and it is the only thing
   * that can. Dragging the reel halfway up uncovers the next one, so the
   * screen really is showing something new and no amount of reading it says
   * otherwise. The position does: it snaps back to the reel it started on, and
   * a reel that was never left was never watched twice.
   */
  private var pageNow = -1
  private var pageCounted = -1

  /**
   * Whether this feed's position is worth believing, which is only true once
   * it has been seen to move.
   *
   * Not every feed reports one. Some report the same number forever, and a
   * number that never changes, trusted, would mean no reel ever counts again
   * and a person scrolling all evening sees zero. A count that runs high is a
   * bug, a count stuck at nothing is a dead app, so the position is given no
   * say at all until it proves it is a position.
   */
  private var pageMoves = false

  private var lastApp: String? = null
  private var lastCountedAt = 0L

  /**
   * How long the feed has to hold still before it is read.
   *
   * This is the single most important number here. A flick does not end when
   * the finger leaves the glass, it ends when the snap animation finishes, and
   * reading during that animation catches two reels on screen at once. Two
   * reels read as a change from one, which is how a drag that snapped back to
   * where it started was counted as a new reel.
   *
   * So it waits out the animation, not just the finger. Long enough to be at
   * rest, short enough that the number still moves while someone watches it.
   */
  private val settleMs = 400L

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

    /**
     * Being in YouTube is not being in Shorts, and being in Instagram is not
     * being in reels. The home feed of either scrolls just as vertically, and
     * counting it was counting things nobody watched.
     */
    if (!onReelSurface(seen)) {
      return
    }

    /** Where the feed is now, read at every twitch, judged once it settles. */
    val page = seen.fromIndex
    if (page >= 0 && pageNow >= 0 && page != pageNow) {
      pageMoves = true
    }
    pageNow = page

    /**
     * Scrolling is what the pill follows, so any scroll on the feed keeps it
     * alive, whether or not the screen turns out to have changed. Counting is
     * the slower question answered below, and the pill must not vanish while
     * it is being asked.
     */
    CounterOverlay.show(this, ReelStore.total(this))

    /** Each event pushes the look back, so the screen is read once it holds still. */
    main.removeCallbacks(settled)
    main.postDelayed(settled, settleMs)
  }

  /**
   * Whether the thing that scrolled is a reel feed rather than a list.
   *
   * The difference is how many items it is showing. A reel feed is a pager:
   * one video fills the window, so the first visible item and the last visible
   * item are the same item. A home feed, in YouTube or Instagram, has several
   * cards on screen at once and says so. That one fact separates them without
   * knowing anything about either app's insides, which matters because the
   * view names those apps use change with every release.
   *
   * Feeds that report no indices at all are let through, since the older test
   * is all there is for them, and the screen check afterwards still has to
   * agree before anything is counted.
   *
   * The size test throws out the small scrollers, a comment sheet or a row of
   * suggestions, which are nested inside the player and scroll while the reel
   * behind them never changes.
   */
  private fun onReelSurface(event: AccessibilityEvent): Boolean {
    if (event.fromIndex >= 0 && event.toIndex >= 0) {
      /**
       * The feed said what it is showing, which settles it without asking
       * anything further. Worth keeping cheap: this runs on every twitch of
       * every scroll, and the question below costs a trip to the other app.
       */
      return event.fromIndex == event.toIndex
    }

    val source = event.source ?: return true
    val bounds = Rect()
    source.getBoundsInScreen(bounds)
    if (bounds.height() <= 0 || bounds.width() <= 0) {
      return true
    }

    val screen = resources.displayMetrics
    return bounds.height() >= screen.heightPixels * 0.6 &&
      bounds.width() >= screen.widthPixels * 0.9
  }

  /**
   * Something else came to the front. Only an actual app switch takes the pill
   * away, which is a narrower thing than this event.
   *
   * The volume panel, the notification shade, a toast and the keyboard all
   * raise a window under their own package name while you carry on scrolling
   * underneath them. Hiding on the event alone took the pill off the screen
   * mid feed, so the window in front is checked before anything is believed.
   */
  private fun switchedTo(app: String) {
    if (ReelStore.Apps.containsKey(app) || app == packageName) {
      return
    }

    /** Unknown means unknown. The idle timer is what catches a real departure. */
    val inFront = rootInActiveWindow?.packageName?.toString() ?: return
    if (ReelStore.Apps.containsKey(inFront)) {
      return
    }

    main.removeCallbacks(settled)
    /**
     * A feed opened again starts counting its own items from the top, so a
     * position held from last time means nothing now. The watched screens
     * stay, and they are what stops the same reels counting twice.
     */
    pageNow = -1
    pageCounted = -1
    pageMoves = false
    CounterOverlay.hide()
  }

  /**
   * The screen has stopped moving. If it is showing a reel that has not been
   * counted before, the feed moved on to a new one.
   *
   * What was already watched stays remembered across a trip to another app, so
   * coming back to Instagram and swiping through the same reels does not count
   * them twice either.
   */
  private fun countIfChanged() {
    val root = rootInActiveWindow ?: return
    val app = ReelStore.Apps[root.packageName?.toString() ?: return] ?: return

    /**
     * A different app is a different feed, numbering its own items its own way
     * and maybe not numbering them at all. Nothing learned about the last
     * one's positions carries over to this one.
     */
    if (app != lastApp) {
      pageCounted = -1
      pageMoves = false
    }

    /**
     * Back on the reel it started on. The finger moved, the feed did not, and
     * a drag that snapped back is not a reel however much it uncovered on the
     * way. Feeds that report no position fall through to the screen test.
     */
    val positioned = pageMoves && pageNow >= 0
    if (positioned && pageNow == pageCounted) {
      return
    }

    val screen = fingerprint(root)
    if (screen == 0) {
      /**
       * Nothing readable on screen. Plenty of reels carry no caption and no
       * handle the filter will take, and refusing to count those would lose
       * them all. The position is the second opinion, and above it has already
       * said this is not the reel the last one was counted on.
       */
      if (!positioned) {
        return
      }
    } else if (watched.contains(screen)) {
      return
    }

    val now = System.currentTimeMillis()
    if (app == lastApp && now - lastCountedAt < quietMs) {
      return
    }

    /**
     * Only a real reading is filed. Zero is the absence of one, and filing it
     * would make the next unreadable reel look like one already watched.
     */
    if (screen != 0) {
      remember(screen)
    }
    pageCounted = pageNow
    lastApp = app
    lastCountedAt = now

    ReelStore.add(this, app)
    CounterOverlay.show(this, ReelStore.total(this))
  }

  /**
   * Files a reel as watched, and drops the oldest once there are more than the
   * swipe back is meant to reach. Insertion ordered, so the first one out is
   * the one watched longest ago.
   */
  private fun remember(screen: Int) {
    watched.add(screen)
    if (watched.size > remembered) {
      watched.remove(watched.iterator().next())
    }
  }

  /**
   * One number standing for what is on screen, folded from the labels the feed
   * hangs on its own views. A different reel carries a different caption and a
   * different handle, so it folds to a different number.
   *
   * Breadth first and capped at `maxNodes`, because what tells two reels apart
   * is near the top of the tree and the rest is chrome that never changes.
   *
   * Only what is actually on screen counts towards it. A feed keeps the reel
   * above and the reel below built and waiting just out of sight, and folding
   * those in made the number depend on what was coming rather than on what is
   * here, so it changed while the reel did not.
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

      /**
       * Off screen, or behind something, so its label is not part of this
       * reel. Its children are still walked: a container can report itself
       * invisible while what it holds is plainly on screen, and skipping the
       * branch would throw away the caption with it.
       */
      val onScreen = node.isVisibleToUser

      if (onScreen) {
        node.text?.let { folded = folded * 31 + worth(it) }
        node.contentDescription?.let { folded = folded * 31 + worth(it) }
      }

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
