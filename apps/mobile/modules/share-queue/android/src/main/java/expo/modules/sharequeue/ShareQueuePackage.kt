package expo.modules.sharequeue

import android.app.Activity
import android.content.Context
import android.os.Bundle
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class ShareQueuePackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(object : ReactActivityLifecycleListener {
      override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
        ShareQueueModule.receive(activity, activity.intent)
      }
      override fun onResume(activity: Activity) {
        // Also observe the task-root activity after the share dependency rehomes it.
        ShareQueueModule.receive(activity, activity.intent)
      }
    })
}
