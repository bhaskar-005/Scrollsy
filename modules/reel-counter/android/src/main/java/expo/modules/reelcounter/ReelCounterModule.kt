package expo.modules.reelcounter

import android.content.Context
import android.provider.Settings
import android.text.TextUtils
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * What the app can ask of the counter.
 *
 * The counting itself happens in a service that outlives this module, so
 * nothing here counts anything. This is the hatch the app opens on resume to
 * take what was counted while it was closed.
 */
class ReelCounterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReelCounter")

    /**
     * Whether the counting service is switched on for this app, asked of
     * Android rather than remembered, because it can be revoked at any time
     * from Settings without telling us.
     */
    Function("isCounting") {
      val context = appContext.reactContext ?: return@Function false
      enabled(context)
    }

    /** Everything counted since the last call, then cleared. */
    Function("drain") {
      val context = appContext.reactContext ?: return@Function emptyMap<String, Int>()
      ReelStore.drain(context)
    }

    /**
     * Tells the pill what today's real total is. The app knows it, the service
     * only knows what it has added, so after a drain or a new day the app puts
     * the two back in step.
     */
    Function("setTotal") { total: Int ->
      val context = appContext.reactContext ?: return@Function
      ReelStore.setTotal(context, total)
    }

    /**
     * How the pill should look. Left where the service will find it, because
     * the service is what draws it and the app is not running by then. If the
     * pill happens to be on screen right now, it changes under the choice.
     */
    Function("setStyle") { style: String ->
      val context = appContext.reactContext ?: return@Function
      ReelStore.setStyle(context, style)
      CounterOverlay.restyle(context)
    }

    /** How big it floats. Same reasoning as the style above. */
    Function("setSize") { size: String ->
      val context = appContext.reactContext ?: return@Function
      ReelStore.setSize(context, size)
      CounterOverlay.restyle(context)
    }

    /**
     * Where it was last dragged to, as a fraction of the screen, so the app
     * can keep the profile in step with what the person actually did.
     */
    Function("position") {
      val context = appContext.reactContext ?: return@Function null
      mapOf("x" to ReelStore.positionX(context), "y" to ReelStore.positionY(context))
    }

    /** Takes the pill off the screen, for turning the counter off. */
    Function("hideOverlay") {
      CounterOverlay.hide()
    }
  }

  /**
   * Reads the list of enabled accessibility services and looks for ours.
   * `AccessibilityManager` would only say whether any service is on, which is
   * not the question.
   */
  private fun enabled(context: Context): Boolean {
    val wanted = "${context.packageName}/${ReelCounterService::class.java.name}"
    val on = Settings.Secure.getInt(
      context.contentResolver,
      Settings.Secure.ACCESSIBILITY_ENABLED,
      0,
    )
    if (on != 1) {
      return false
    }

    val enabledServices = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
    ) ?: return false

    val splitter = TextUtils.SimpleStringSplitter(':')
    splitter.setString(enabledServices)
    for (service in splitter) {
      if (service.equals(wanted, ignoreCase = true)) {
        return true
      }
    }
    return false
  }
}
