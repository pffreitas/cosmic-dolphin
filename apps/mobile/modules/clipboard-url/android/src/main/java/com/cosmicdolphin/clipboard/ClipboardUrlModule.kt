package com.cosmicdolphin.clipboard

import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.view.textclassifier.TextClassifier
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Detect only OS metadata. Never read a clipboard item before the user's Paste tap. */
class ClipboardUrlModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CosmicClipboardUrl")
    AsyncFunction("hasUrl") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
      val description = clipboard?.primaryClipDescription ?: return@AsyncFunction false
      description.hasMimeType(ClipDescription.MIMETYPE_TEXT_URILIST) ||
        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
          description.classificationStatus == ClipDescription.CLASSIFICATION_COMPLETE &&
          description.getConfidenceScore(TextClassifier.TYPE_URL) > 0f)
    }
  }
}
