package expo.modules.reelcounter

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The count, floating over whatever app you are in.
 *
 * Drawn in native views rather than React, because it has to appear over
 * Instagram while this app is not running at all, and React Native has no
 * process at that point. That is also why the style and the position are read
 * from `ReelStore` instead of being passed in: nobody is alive to pass them.
 *
 * This runs on the scroll path, so it is written to do as little as possible
 * per reel. One text change, no allocation, and the mascot decoded once per
 * stage rather than once per reel.
 *
 * It takes touches now, so it can be dragged somewhere it is not in the way
 * and tapped to open the board. That means it also swallows whatever tap lands
 * on it, which is the price of both.
 */
object CounterOverlay {
  private var pill: View? = null
  private var count: TextView? = null
  private var face: ImageView? = null
  private val main = Handler(Looper.getMainLooper())

  /** What is currently on screen, so a changed setting rebuilds and nothing else does. */
  private var styleShown: String? = null
  private var stageShown: String? = null
  private var totalShown = -1

  /** The live window position, kept here so a drag can move it without a lookup. */
  private var params: WindowManager.LayoutParams? = null

  /**
   * Asking the system whether we may draw is a call into another process, and
   * the answer only changes when someone visits Settings, so it is remembered
   * for a while rather than asked once per reel.
   */
  private var mayDraw = false
  private var mayDrawCheckedAt = 0L
  private const val RecheckMs = 30_000L

  /**
   * The pill follows the scrolling, not the app. Leaving a reels app takes it
   * away at once, but backgrounding the phone mid scroll does not, so this is
   * the backstop that stops it holding a window open all day.
   */
  private const val IdleMs = 20_000L
  private val retire = Runnable { removeNow() }

  /** Every hundred reels sinks him one stage. Matches `stageFor` in the app. */
  private val Stages = listOf("fresh", "buzzed", "dizzy", "fried", "cooked")
  private const val ReelsPerStage = 100

  /** Decoded once per stage and kept, because a scroll must not touch the disk. */
  private var faceArt: Bitmap? = null
  private var faceArtStage: String? = null

  private fun allowed(context: Context): Boolean {
    val now = System.currentTimeMillis()
    if (now - mayDrawCheckedAt > RecheckMs) {
      mayDraw = Settings.canDrawOverlays(context)
      mayDrawCheckedAt = now
    }
    return mayDraw
  }

  fun show(context: Context, total: Int) {
    main.post {
      /**
       * Every scroll comes through here, not just every reel, because a scroll
       * is what keeps the pill alive. Almost all of them find it already up
       * showing the right number, so that case does nothing but push the
       * retirement back rather than setting text and laying out sixty times a
       * second under a flick.
       */
      if (pill != null && total == totalShown && ReelStore.style(context) == styleShown) {
        main.removeCallbacks(retire)
        main.postDelayed(retire, IdleMs)
        return@post
      }

      if (!allowed(context)) {
        return@post
      }

      val windows = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return@post

      val style = ReelStore.style(context)
      val stage = stageFor(total)

      /** A style chosen since the last reel means the view on screen is the wrong one. */
      if (pill != null && style != styleShown) {
        removeNow()
      }

      if (pill == null && !attach(context, windows, style, stage, total)) {
        return@post
      }

      count?.text = total.toString()
      totalShown = total
      if (stage != stageShown) {
        stageShown = stage
        face?.setImageBitmap(artFor(context, stage))
      }

      /** Each reel pushes the retirement back, so it only fires once you stop. */
      main.removeCallbacks(retire)
      main.postDelayed(retire, IdleMs)
    }
  }

  /**
   * Called when the style is chosen, so the change shows over Instagram on the
   * next reel rather than whenever the pill happens to be rebuilt.
   */
  fun restyle(context: Context) {
    main.post {
      if (pill == null) {
        return@post
      }
      val total = ReelStore.total(context)
      removeNow()
      show(context, total)
    }
  }

  private fun attach(
    context: Context,
    windows: WindowManager,
    style: String,
    stage: String,
    total: Int,
  ): Boolean {
    val view = build(context, style, stage, total)

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    /**
     * Focusable would steal the keyboard from the app underneath. Touchable it
     * has to be, or it can be neither dragged nor tapped.
     */
    var flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL

    /** Real blur behind the glass, on the phones that will actually give it. */
    val lit = style == "glass" && blurred(context)
    if (lit) {
      flags = flags or WindowManager.LayoutParams.FLAG_BLUR_BEHIND
    }

    val metrics = context.resources.displayMetrics
    val layout = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      flags,
      android.graphics.PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = (metrics.widthPixels * ReelStore.positionX(context)).toInt() - dp(context, 56)
      y = (metrics.heightPixels * ReelStore.positionY(context)).toInt()
      if (lit && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        blurBehindRadius = dp(context, 16)
      }
    }

    view.setOnTouchListener(dragger(context, windows))

    return try {
      windows.addView(view, layout)
      pill = view
      params = layout
      styleShown = style
      stageShown = stage
      true
    } catch (error: Exception) {
      /** Permission pulled between the cached answer and here. Ask again sooner. */
      mayDrawCheckedAt = 0L
      pill = null
      params = null
      false
    }
  }

  /**
   * Drag to move it, tap to open the board.
   *
   * The two are told apart the way Android tells them apart everywhere else:
   * a finger that travelled less than the system's own slop was a tap, and
   * anything further was a drag.
   */
  private fun dragger(context: Context, windows: WindowManager): View.OnTouchListener {
    val slop = ViewConfiguration.get(context).scaledTouchSlop
    var downX = 0f
    var downY = 0f
    var startX = 0
    var startY = 0
    var dragged = false

    return View.OnTouchListener { view, event ->
      val layout = params ?: return@OnTouchListener false

      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          downX = event.rawX
          downY = event.rawY
          startX = layout.x
          startY = layout.y
          dragged = false
          /** Nothing retires under a finger. */
          main.removeCallbacks(retire)
          true
        }

        MotionEvent.ACTION_MOVE -> {
          val movedX = (event.rawX - downX).toInt()
          val movedY = (event.rawY - downY).toInt()
          if (!dragged && kotlin.math.abs(movedX) < slop && kotlin.math.abs(movedY) < slop) {
            return@OnTouchListener true
          }
          dragged = true

          /**
           * Kept on screen. The floors are `coerceAtLeast(0)` rather than the
           * bare difference because `coerceIn` throws when the low bound passes
           * the high one, and a pill wider than the screen would do exactly
           * that in the middle of a gesture.
           */
          val metrics = context.resources.displayMetrics
          val farX = (metrics.widthPixels - view.width).coerceAtLeast(0)
          val farY = (metrics.heightPixels - view.height).coerceAtLeast(0)
          layout.x = (startX + movedX).coerceIn(0, farX)
          layout.y = (startY + movedY).coerceIn(0, farY)
          try {
            windows.updateViewLayout(view, layout)
          } catch (error: Exception) {
            // The window went away mid drag. Nothing to move.
          }
          true
        }

        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
          if (dragged) {
            remember(context, view, layout)
          } else if (event.action == MotionEvent.ACTION_UP) {
            openBoard(context)
          }
          main.postDelayed(retire, IdleMs)
          true
        }

        else -> false
      }
    }
  }

  /**
   * Where it was let go, as a fraction of the screen, so it lands in the same
   * corner on a phone of another size. The app reads this back into the
   * profile the next time it opens.
   */
  private fun remember(context: Context, view: View, layout: WindowManager.LayoutParams) {
    val metrics = context.resources.displayMetrics
    if (metrics.widthPixels == 0 || metrics.heightPixels == 0) {
      return
    }
    val x = (layout.x + dp(context, 56)).toFloat() / metrics.widthPixels
    val y = layout.y.toFloat() / metrics.heightPixels
    ReelStore.setPosition(context, x.coerceIn(0f, 1f), y.coerceIn(0f, 1f))
  }

  /** Straight to the board, which is the only reason to tap a number mid scroll. */
  private fun openBoard(context: Context) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("scrollsy://battle")).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    try {
      context.startActivity(intent)
    } catch (error: Exception) {
      // No activity to take it, which only happens if the app is being removed.
    }
  }

  /* -------------------------------------------------------------------------
   * The five looks
   *
   * He is in every one of them, because the number on its own is a statistic
   * and the number with him on it is the thing people came back for. Only the
   * chrome around the pair changes.
   * ---------------------------------------------------------------------- */

  private fun build(context: Context, style: String, stage: String, total: Int): View {
    val row = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val art = ImageView(context).apply {
      setImageBitmap(artFor(context, stage))
      layoutParams = LinearLayout.LayoutParams(dp(context, 30), dp(context, 30))
    }
    face = art
    row.addView(art)

    val number = TextView(context).apply {
      text = total.toString()
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 19f)
      typeface = android.graphics.Typeface.DEFAULT_BOLD
      setPadding(dp(context, 7), 0, 0, 0)
      setTextColor(textFor(style))
    }
    count = number
    row.addView(number)

    dress(context, row, style)
    return row
  }

  private fun textFor(style: String): Int = when (style) {
    "outline" -> Color.parseColor("#5B4BE8")
    else -> Color.WHITE
  }

  /** The background, which is the only thing the style really decides. */
  private fun dress(context: Context, row: LinearLayout, style: String) {
    val padX = dp(context, 14)
    val padY = dp(context, 8)
    val radius = dp(context, 24).toFloat()

    when (style) {
      "plain", "mascot" -> {
        /** No chrome at all. Him, the number, and whatever is behind them. */
        row.setPadding(0, 0, 0, 0)
        row.background = null
        /** A white number on a bright reel needs its own edge to stay readable. */
        count?.setShadowLayer(dp(context, 3).toFloat(), 0f, 1f, Color.BLACK)
      }

      "outline" -> {
        row.setPadding(padX, padY, padX, padY)
        row.background = GradientDrawable().apply {
          shape = GradientDrawable.RECTANGLE
          cornerRadius = radius
          setColor(Color.TRANSPARENT)
          setStroke(dp(context, 2), Color.parseColor("#5B4BE8"))
        }
      }

      "glass" -> {
        /**
         * Liquid glass, built out of what a window can actually do.
         *
         * A real blur behind it is a bonus, not the effect, because most phones
         * quietly refuse it: before Android 12 there is no such thing, and on
         * phones that have it the whole feature is off under battery saver or
         * when the person turned it off. Leaning on it left a white film nobody
         * could see and a white number nobody could read.
         *
         * So the glass is drawn: light along the top edge where a curved
         * surface would catch the light, darker at the bottom, a bright rim all
         * the way round. That reads as glass over any reel on any phone, and
         * where the blur does land it sits underneath and makes it better.
         */
        val lit = blurred(context)
        val top = if (lit) "#59FFFFFF" else "#7A4A4761"
        val bottom = if (lit) "#26FFFFFF" else "#8C17151F"

        row.setPadding(padX, padY, padX, padY)
        row.background = GradientDrawable(
          GradientDrawable.Orientation.TOP_BOTTOM,
          intArrayOf(Color.parseColor(top), Color.parseColor(bottom)),
        ).apply {
          shape = GradientDrawable.RECTANGLE
          cornerRadius = radius
          setStroke(dp(context, 1), Color.parseColor("#73FFFFFF"))
        }
        count?.setShadowLayer(dp(context, 3).toFloat(), 0f, 1f, Color.parseColor("#B3000000"))
      }

      else -> {
        row.setPadding(padX, padY, padX, padY)
        row.background = GradientDrawable().apply {
          shape = GradientDrawable.RECTANGLE
          cornerRadius = radius
          setColor(Color.parseColor("#5B4BE8"))
        }
      }
    }
  }

  /**
   * Whether this phone is really going to blur behind the window, which is a
   * different question from whether it is new enough to know the word. It is
   * off under battery saver, off when the person turned it off, and off on
   * hardware that cannot afford it.
   */
  private fun blurred(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return false
    }
    val windows = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return false
    return windows.isCrossWindowBlurEnabled
  }

  private fun stageFor(total: Int): String =
    Stages[(total / ReelsPerStage).coerceIn(0, Stages.size - 1)]

  /**
   * His art at the size the pill needs it, decoded once per stage. The files
   * are 512 squares and this draws them at 22dp, so they come back quartered
   * rather than whole.
   */
  private fun artFor(context: Context, stage: String): Bitmap? {
    if (faceArtStage == stage) {
      faceArt?.let { return it }
    }

    val id = context.resources.getIdentifier("mascot_$stage", "drawable", context.packageName)
    if (id == 0) {
      return null
    }

    val options = BitmapFactory.Options().apply { inSampleSize = 4 }
    val art = BitmapFactory.decodeResource(context.resources, id, options)
    faceArt = art
    faceArtStage = stage
    return art
  }

  fun hide() {
    main.post { removeNow() }
  }

  /**
   * Drops the window and the view with it. A view kept in a singleton holds the
   * context that made it, so this is what stops the service leaking itself.
   */
  private fun removeNow() {
    val view = pill ?: return
    main.removeCallbacks(retire)
    try {
      val windows = view.context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
      windows?.removeView(view)
    } catch (error: Exception) {
      // Already gone, which is the state we wanted.
    }
    pill = null
    params = null
    count = null
    face = null
    styleShown = null
    stageShown = null
    totalShown = -1
  }

  private fun dp(context: Context, value: Int): Int =
    (value * context.resources.displayMetrics.density).toInt()
}
