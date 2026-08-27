package com.sikka.attendance.webview

import android.net.Uri
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.ProgressBar
import com.sikka.attendance.MainActivity

/**
 * WebChromeClient handling Geolocation prompts, modern Photo Picker, and file uploads.
 */
class AttendanceWebChromeClient(
    private val activity: MainActivity,
    private val progressBar: ProgressBar?
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        progressBar?.let {
            if (newProgress < 100) {
                it.visibility = View.VISIBLE
                it.progress = newProgress
            } else {
                it.visibility = View.GONE
            }
        }
    }

    /**
     * Automatically grants Geolocation permissions to the WebView application.
     */
    override fun onGeolocationPermissionsShowPrompt(
        origin: String?,
        callback: GeolocationPermissions.Callback?
    ) {
        if (activity.permissionManager.hasLocationPermission()) {
            callback?.invoke(origin, true, false)
        } else {
            activity.requestNativePermission("LOCATION")
            callback?.invoke(origin, true, false)
        }
    }

    /**
     * Handles <input type="file"> photo/media uploads with Android Photo Picker & Camera fallback.
     */
    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
    ): Boolean {
        return activity.openPhotoFileChooser(filePathCallback, fileChooserParams)
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        Log.d("WebViewConsole", "${consoleMessage?.message()} -- line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
        return super.onConsoleMessage(consoleMessage)
    }
}
