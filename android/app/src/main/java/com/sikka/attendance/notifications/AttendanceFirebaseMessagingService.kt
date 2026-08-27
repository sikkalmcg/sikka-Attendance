package com.sikka.attendance.notifications

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Firebase Cloud Messaging Service for handling background and terminated push notifications.
 */
class AttendanceFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "From: ${remoteMessage.from}")

        // 1. Extract data payload
        val data = remoteMessage.data
        var title = data["title"]
        var message = data["message"] ?: data["body"]
        val notifType = data["type"] ?: "ATTENDANCE"
        val employeeId = data["employeeId"] ?: ""
        val targetRole = data["targetRole"] ?: "EMPLOYEE"

        // 2. Fallback to notification payload if present
        remoteMessage.notification?.let {
            if (title.isNullOrBlank()) title = it.title
            if (message.isNullOrBlank()) message = it.body
        }

        if (title.isNullOrBlank()) {
            title = when (notifType.uppercase()) {
                "MARK_IN" -> "Mark IN Successful"
                "MARK_OUT" -> "Mark OUT Successful"
                "SHIFT_REMINDER" -> "Shift Attendance Reminder"
                "AUTO_OUT" -> "Auto OUT Notification"
                else -> "Attendance Alert"
            }
        }

        if (!message.isNullOrBlank()) {
            // Strict Role Validation: Ensure Employee notifications are only delivered to Employee logins
            if (AttendanceNotificationManager.isEmployeeNotificationAllowed(applicationContext, notifType)) {
                AttendanceNotificationManager.showNotification(
                    context = applicationContext,
                    title = title ?: "Attendance Notification",
                    message = message ?: "",
                    notifType = notifType,
                    employeeId = employeeId
                )
            } else {
                Log.d(TAG, "Ignored push notification for non-employee user. Type: $notifType")
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Refreshed FCM Token: $token")

        // Save token in SharedPreferences
        val prefs = getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()

        // Sync token to backend server
        sendRegistrationToServer(token)
    }

    private fun sendRegistrationToServer(token: String) {
        val prefs = getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        val employeeId = prefs.getString("employee_id", "") ?: ""
        val userRole = prefs.getString("user_role", "EMPLOYEE") ?: "EMPLOYEE"
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
                    put("employeeId", employeeId)
                    put("role", userRole)
                    put("deviceName", android.os.Build.MODEL)
                    put("platform", "android")
                }

                conn.outputStream.use { os ->
                    val input = payload.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = conn.responseCode
                Log.d(TAG, "Token registration response: $responseCode")
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "Failed to register FCM token with server: ${e.message}")
            }
        }
    }

    companion object {
        private const val TAG = "AttendanceFCM"
    }
}
