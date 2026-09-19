package expo.modules.reelcounter

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.TextView

/**
 * The count, floating over whatever app you are in.
 *
 * Drawn in native views rather than React, because it has to appear over
 * Instagram while this app is not running at all, and React Native has no
 * process at that point.
 *
 * This runs on the scroll path, so it is written to do as little as possible
 * per reel: one text change, no allocation, no trip to the system server.
 */
object CounterOverlay {
  private var pill: TextView? = null
  private val main = Handler(Looper.getMainLooper())

  /** Where it sits, as a fraction of the screen. Matches the profile's default. */
  private const val X = 0.86f
  private const val Y = 0.08f

  /**
   * Asking the system whether we may draw is a call into another process, and
   * the answer only changes when someone visits Settings, so it is remembered
   * for a while rather than asked once per reel.
   */
  private var mayDraw = false
  private var mayDrawCheckedAt = 0L
  private const val RecheckMs = 30_000L

  /**
   * The pill follows the scrolling, not the app. Left alone it would sit over
   * the home screen for the rest of the day, holding a window open for
   * nothing, so it takes itself away once the reels stop.
   */
  private const val IdleMs = 20_000L
  private val retire = Runnable { removeNow() }

  private fun allowed(context: Context): Boolean {
    val now = System.currentTimeMillis()
    if (now - mayDrawCheckedAt > RecheckMs) {
      mayDraw = Settings.canDrawOverlays(context)
      mayDrawCheckedAt = now
    }
    return mayDraw
  }

  fun show(context: Context, count: Int) {
    main.post {
      if (!allowed(context)) {
        return@post
      }

      val windows = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return@post

      if (pill == null && !attach(context, windows)) {
        return@post
      }

      pill?.text = count.toString()

      /** Each reel pushes the retirement back, so it only fires once you stop. */
      main.removeCallbacks(retire)
      main.postDelayed(retire, IdleMs)
    }
  }

  private fun attach(context: Context, windows: WindowManager): Boolean {
    val view = TextView(context).apply {
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      typeface = android.graphics.Typeface.DEFAULT_BOLD
      setPadding(dp(context, 14), dp(context, 7), dp(context, 14), dp(context, 7))
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(context, 20).toFloat()
        setColor(Color.parseColor("#5B4BE8"))
      }
    }

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      /** Never takes focus, so it cannot swallow a tap meant for the app underneath. */
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
      android.graphics.PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      val metrics = context.resources.displayMetrics
      x = (metrics.widthPixels * X).toInt() - dp(context, 56)
      y = (metrics.heightPixels * Y).toInt()
    }

    return try {
      windows.addView(view, params)
      pill = view
      true
    } catch (error: Exception) {
      /** Permission pulled between the cached answer and here. Ask again sooner. */
      mayDrawCheckedAt = 0L
      false
    }
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
  }

  private fun dp(context: Context, value: Int): Int =
    (value * context.resources.displayMetrics.density).toInt()
}
