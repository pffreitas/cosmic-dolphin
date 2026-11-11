package expo.modules.sharequeue

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/** Android deliveries have identities, so rerenders/recreation cannot invent shares. */
class ShareQueueModule : Module() {
  companion object {
    private const val deliveryKey = "com.cosmicdolphin.share.delivery"
    internal var notifyArrival: (() -> Unit)? = null

    /** Activity creation can occur without recreating the React/native module. */
    internal fun receive(activity: Activity?, intent: Intent?) {
      if (activity == null || !activity.isTaskRoot || intent == null ||
        intent.type?.startsWith("text/") != true || intent.action != Intent.ACTION_SEND) return
      val id = intent.getStringExtra(deliveryKey) ?: UUID.randomUUID().toString().also { intent.putExtra(deliveryKey, it) }
      synchronized(ShareQueueModule::class.java) {
        val preferences = activity.getSharedPreferences("android-share-arrivals", Context.MODE_PRIVATE)
        val entries = JSONArray(preferences.getString("pending", "[]"))
        if ((0 until entries.length()).none { entries.getJSONObject(it).getString("id") == id }) {
          val connectivity = activity.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
          val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
          entries.put(JSONObject().put("id", id)
            .put("text", intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() ?: "")
            .put("queuedAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date()))
            .put("offline", capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) != true))
          check(preferences.edit().putString("pending", entries.toString()).commit()) { "Share arrival could not be retained" }
        }
      }
      activity.intent = intent
      notifyArrival?.invoke()
    }
  }
  private val preferences get() = requireNotNull(appContext.reactContext)
    .getSharedPreferences("android-share-arrivals", Context.MODE_PRIVATE)
  private fun snapshot() = JSONArray(preferences.getString("pending", "[]"))
  private fun write(entries: JSONArray) {
    check(preferences.edit().putString("pending", entries.toString()).commit()) { "Share arrival could not be retained" }
  }
  override fun definition() = ModuleDefinition {
    Name("ShareQueue")
    Events("onAndroidShare")
    OnCreate {
      notifyArrival = { sendEvent("onAndroidShare") }
      receive(appContext.currentActivity, appContext.currentActivity?.intent)
    }
    OnDestroy { notifyArrival = null }
    OnNewIntent { receive(appContext.currentActivity, it) }
    AsyncFunction("readAndroidShares") {
      synchronized(ShareQueueModule::class.java) { snapshot().toString() }
    }
    AsyncFunction("removeAndroidShares") { ids: List<String> ->
      synchronized(ShareQueueModule::class.java) {
        val entries = snapshot()
        val kept = JSONArray()
        for (index in 0 until entries.length()) {
          val entry = entries.getJSONObject(index)
          if (!ids.contains(entry.getString("id"))) kept.put(entry)
        }
        write(kept)
        // A recreation must not redeliver the already consumed launch intent.
        appContext.currentActivity?.intent?.let { intent ->
          if (ids.contains(intent.getStringExtra(deliveryKey))) {
            intent.type = null
            intent.action = Intent.ACTION_MAIN
            intent.removeExtra(Intent.EXTRA_TEXT)
          }
        }
      }
    }
  }
}
