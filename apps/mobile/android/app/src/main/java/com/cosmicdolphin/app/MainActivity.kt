package com.cosmicdolphin.app
import expo.modules.splashscreen.SplashScreenManager

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView

import com.facebook.react.bridge.ReactMarker
import com.facebook.react.bridge.ReactMarkerConstants
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private var fullScreenSplashOverlay: ImageView? = null

  private val fullScreenSplashListener = ReactMarker.MarkerListener { name, _, _ ->
    if (name == ReactMarkerConstants.CONTENT_APPEARED) {
      hideFullScreenSplashOverlay()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    configureSplashSystemBars()
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
    showFullScreenSplashOverlay()
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  private fun configureSplashSystemBars() {
    window.statusBarColor = Color.rgb(0, 2, 31)
    window.navigationBarColor = Color.rgb(0, 1, 15)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      window.decorView.systemUiVisibility =
        window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      window.decorView.systemUiVisibility =
        window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
    }
  }

  private fun showFullScreenSplashOverlay() {
    val decorView = window.decorView as? ViewGroup ?: return
    val overlay = ImageView(this).apply {
      setBackgroundColor(Color.rgb(0, 2, 31))
      setImageResource(R.drawable.splashscreen_full)
      scaleType = ImageView.ScaleType.CENTER_CROP
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    }

    fullScreenSplashOverlay = overlay
    decorView.addView(overlay)
    ReactMarker.addListener(fullScreenSplashListener)

    // Android 12+ platform splash screens are icon-based. Hide that layer once
    // our full-screen launch artwork is mounted, then remove the overlay when
    // React Native reports first content.
    SplashScreenManager.hide()
  }

  private fun hideFullScreenSplashOverlay() {
    ReactMarker.removeListener(fullScreenSplashListener)
    val overlay = fullScreenSplashOverlay ?: return

    runOnUiThread {
      overlay
        .animate()
        .alpha(0.0f)
        .setDuration(180)
        .withEndAction {
          (overlay.parent as? ViewGroup)?.removeView(overlay)
          if (fullScreenSplashOverlay === overlay) {
            fullScreenSplashOverlay = null
          }
        }
        .start()
    }
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
