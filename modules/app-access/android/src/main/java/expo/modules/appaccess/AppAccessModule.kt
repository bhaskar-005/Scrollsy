package expo.modules.appaccess

import android.app.AppOpsManager
import android.content.Context
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The two Android special accesses the counter needs. Neither has an Expo API,
 * and neither can be asked for with a dialog: the only route is the Settings
 * page, so the app has to be able to read back what came of the trip.
 */
class AppAccessModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppAccess")

    /** Usage access, which is granted per app through an app op rather than a permission. */
    Function("hasUsageAccess") {
      val context = appContext.reactContext ?: return@Function false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
        ?: return@Function false

      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context.packageName,
        )
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context.packageName,
        )
      }

      /**
       * DEFAULT means the op falls back to the manifest permission, which for
       * usage stats is never held outright, so only an explicit allow counts.
       */
      mode == AppOpsManager.MODE_ALLOWED
    }

    /** Drawing the counter over other apps. */
    Function("hasOverlay") {
      val context = appContext.reactContext ?: return@Function false
      Settings.canDrawOverlays(context)
    }
  }
}
