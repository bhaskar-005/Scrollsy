package expo.modules.reelcounter

import android.content.Context
import android.content.SharedPreferences
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Where counts live between the service seeing a reel and the app reading it.
 *
 * The service runs whether or not the app is alive, so it cannot hand a number
 * to JavaScript directly. It tallies here instead, and the app collects the
 * tally into its own store the next time it is opened. Collecting clears what
 * it took, so nothing is counted twice.
 *
 * Counts are kept per day, not just per app. Someone can scroll all week
 * without opening this app once, and when they finally do, Tuesday's reels
 * have to land on Tuesday rather than all of it piling onto the day they
 * happened to open it.
 *
 * Small and synchronous on purpose: this is written on a scroll, which happens
 * a lot, and read once on resume.
 */
object ReelStore {
  private const val FILE = "reel_counter"

  /** `count|<date>|<app>`, one per day per app. */
  private const val COUNT = "count|"

  /** `total|<date>`, what the floating pill shows for that day. */
  private const val TOTAL = "total|"

  /**
   * How the pill looks and where it sits. Chosen in the app, drawn by a
   * service that the app is not running alongside, so it is left here for the
   * service to find rather than handed over.
   */
  private const val STYLE = "style"
  private const val SIZE = "size"
  private const val POSITION_X = "position|x"
  private const val POSITION_Y = "position|y"

  /** The packages worth counting, and the name each one is stored under. */
  val Apps = mapOf(
    "com.instagram.android" to "instagram",
    "com.zhiliaoapp.musically" to "tiktok",
    "com.ss.android.ugc.trill" to "tiktok",
    "com.google.android.youtube" to "youtube",
    "com.snapchat.android" to "snapchat",
  )

  /**
   * The device's own calendar day, in the phone's timezone, formatted the way
   * `localDateKey` in the app formats it. A day is whatever the person was
   * living in, so this is deliberately local rather than UTC.
   */
  private fun today(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  private fun prefs(context: Context): SharedPreferences =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  /** One more reel for this app today, and one more on the day's running total. */
  fun add(context: Context, app: String) {
    val store = prefs(context)
    val date = today()
    val countKey = "$COUNT$date|$app"
    val totalKey = "$TOTAL$date"

    store.edit()
      .putInt(countKey, store.getInt(countKey, 0) + 1)
      .putInt(totalKey, store.getInt(totalKey, 0) + 1)
      .apply()
  }

  /**
   * Everything counted since the last collection, as one row per day per app,
   * then cleared. Days the app slept through come back as their own rows, so
   * the app can write each one to the day it belongs to.
   */
  fun drain(context: Context): List<Map<String, Any>> {
    val store = prefs(context)
    val counted = mutableListOf<Map<String, Any>>()
    val editor = store.edit()
    val date = today()

    for ((key, value) in store.all) {
      if (key.startsWith(COUNT) && value is Int && value > 0) {
        val parts = key.removePrefix(COUNT).split("|")
        if (parts.size == 2) {
          counted.add(mapOf("date" to parts[0], "app" to parts[1], "reels" to value))
        }
        editor.remove(key)
      } else if (key.startsWith(TOTAL) && key != "$TOTAL$date") {
        /** Yesterday's pill total is nobody's business now. Kept from growing forever. */
        editor.remove(key)
      }
    }

    editor.apply()
    return counted
  }

  /**
   * What the floating pill shows. Kept apart from the drained tally, because
   * the pill has to keep showing today's number after the app has taken it.
   */
  fun total(context: Context): Int = prefs(context).getInt("$TOTAL${today()}", 0)

  fun setTotal(context: Context, total: Int) {
    prefs(context).edit().putInt("$TOTAL${today()}", total).apply()
  }

  /* ----------------------------------------------------------------------
   * How the pill looks, and where
   * ------------------------------------------------------------------- */

  /** Matches `CounterStyles` in the app. Anything unknown falls back to the pill. */
  fun style(context: Context): String = prefs(context).getString(STYLE, "pill") ?: "pill"

  fun setStyle(context: Context, style: String) {
    prefs(context).edit().putString(STYLE, style).apply()
  }

  /** Matches `CounterSizes` in the app. Medium is the size it has always been. */
  fun size(context: Context): String = prefs(context).getString(SIZE, "medium") ?: "medium"

  fun setSize(context: Context, size: String) {
    prefs(context).edit().putString(SIZE, size).apply()
  }

  /**
   * Where it sits, as a fraction of the screen, so a position dragged on one
   * screen size still makes sense on another. The default corner matches
   * `DefaultProfile` in the app.
   */
  fun positionX(context: Context): Float = prefs(context).getFloat(POSITION_X, 0.86f)

  fun positionY(context: Context): Float = prefs(context).getFloat(POSITION_Y, 0.08f)

  fun setPosition(context: Context, x: Float, y: Float) {
    prefs(context).edit()
      .putFloat(POSITION_X, x)
      .putFloat(POSITION_Y, y)
      .apply()
  }
}
