package com.sikka.attendance.bridge

import android.content.Context
import android.webkit.JavascriptInterface
import com.google.firebase.messaging.FirebaseMessaging
import com.sikka.attendance.MainActivity
import com.sikka.attendance.notifications.AttendanceNotificationManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

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

        // Immediately fetch and register FCM token with the backend server
        syncCurrentFCMToken(employeeId, role)
    }

    @JavascriptInterface
    fun syncCurrentFCMToken(employeeId: String = "", role: String = "EMPLOYEE") {
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful && task.result != null) {
                    val token = task.result
                    val prefs = activity.getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
                    prefs.edit().putString("fcm_token", token).apply()
                    sendRegistrationToServer(token, employeeId, role)
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("AndroidBridge", "Error fetching FCM token", e)
        }
    }

    private fun sendRegistrationToServer(token: String, employeeId: String, role: String) {
        val prefs = activity.getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        val empId = if (employeeId.isNotBlank()) employeeId else prefs.getString("employee_id", "") ?: ""
        val userRole = if (role.isNotBlank()) role else prefs.getString("user_role", "EMPLOYEE") ?: "EMPLOYEE"
        val serverBaseUrl = prefs.getString("server_url", "http://10.0.2.2:3000") ?: "http://10.0.2.2:3000"

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("$serverBaseUrl/api/notifications/register-device")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.doOutput = true
                conn.connectTimeout = 8000
                conn.readTimeout = 8000

                val payload = JSONObject().apply {
                    put("token", token)
                    put("employeeId", empId)
                    put("role", userRole)
                    put("deviceName", android.os.Build.MODEL)
                    put("platform", "android")
                    put("appVersion", "1.0.0")
                }

                conn.outputStream.use { os ->
                    val input = payload.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = conn.responseCode
                android.util.Log.d("AndroidBridge", "FCM Device Token Registered: Response $responseCode for $empId")
                conn.disconnect()
            } catch (e: Exception) {
                android.util.Log.w("AndroidBridge", "Failed to register FCM token with server: ${e.message}")
            }
        }
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
