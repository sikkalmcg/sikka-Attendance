package com.sikka.attendance.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import com.sikka.attendance.MainActivity
import com.sikka.attendance.notifications.AttendanceNotificationManager

/**
 * JavaScript Interface bridge exposed to the Next.js attendance webview as `window.AndroidBridge`.
 */
class AndroidBridgeInterface(
    private val activity: MainActivity
) {

    @JavascriptInterface
    fun postNotification(title: String, message: String, type: String, employeeId: String, role: String) {
        activity.runOnUiThread {
            AttendanceNotificationManager.showNotification(
                context = activity,
                title = title,
                message = message,
                notifType = type,
                employeeId = employeeId
            )
        }
    }

    @JavascriptInterface
    fun updateBadgeCount(count: Int) {
        activity.runOnUiThread {
            activity.updateLauncherBadgeCount(count)
        }
    }

    @JavascriptInterface
    fun registerUser(employeeId: String, role: String, fullName: String) {
        val prefs = activity.getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("employee_id", employeeId)
            .putString("user_role", role)
            .putString("user_full_name", fullName)
            .apply()
        android.util.Log.d("AndroidBridge", "Registered active user: $employeeId, Role: $role, Name: $fullName")
    }

    @JavascriptInterface
    fun logoutUser() {
        val prefs = activity.getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        prefs.edit()
            .remove("employee_id")
            .remove("user_role")
            .remove("user_full_name")
            .apply()
        android.util.Log.d("AndroidBridge", "User logged out from native bridge")
    }

    @JavascriptInterface
    fun requestNativePermission(permissionType: String) {
        activity.runOnUiThread {
            activity.requestNativePermission(permissionType)
        }
    }

    @JavascriptInterface
    fun openAppSettings() {
        activity.runOnUiThread {
            activity.openAppSettings()
        }
    }

    @JavascriptInterface
    fun getPlatform(): String {
        return "android-native"
    }
}
