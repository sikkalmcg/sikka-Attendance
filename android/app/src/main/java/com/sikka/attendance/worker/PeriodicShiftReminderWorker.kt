package com.sikka.attendance.worker

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.sikka.attendance.notifications.AttendanceNotificationManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Background WorkManager Worker providing a periodic fallback for shift attendance reminders
 * when the app is terminated or in the background.
 */
class PeriodicShiftReminderWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val prefs = applicationContext.getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
            val serverBaseUrl = prefs.getString("server_url", "http://10.0.2.2:3000") ?: "http://10.0.2.2:3000"
            val currentRole = prefs.getString("user_role", "EMPLOYEE") ?: "EMPLOYEE"

            // Only employees receive shift reminder notifications
            if (currentRole.uppercase() != "EMPLOYEE") {
                return@withContext Result.success()
            }

            val url = URL("$serverBaseUrl/api/notifications/shift-reminders")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            val responseCode = conn.responseCode
            if (responseCode == HttpURLConnection.HTTP_OK) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val response = reader.readText()
                reader.close()

                val json = JSONObject(response)
                val newRemindersCount = json.optInt("newRemindersCount", 0)
                if (newRemindersCount > 0) {
                    val remindersArray = json.optJSONArray("newReminders")
                    if (remindersArray != null) {
                        for (i in 0 until remindersArray.length()) {
                            val item = remindersArray.getJSONObject(i)
                            val message = item.optString("message", "")
                            val reminderType = item.optString("reminderType", "MARK_IN")
                            val employeeId = item.optString("employeeId", "")

                            if (message.isNotBlank()) {
                                val notifTitle = item.optString("title", if (reminderType == "MARK_IN") "Attendance Reminder" else "Attendance Reminder")
                                val notifType = item.optString("type", "SHIFT_REMINDER")
                                AttendanceNotificationManager.showNotification(
                                    context = applicationContext,
                                    title = notifTitle,
                                    message = message,
                                    notifType = notifType,
                                    employeeId = employeeId
                                )
                            }
                        }
                    }
                }
            }
            conn.disconnect()
            Result.success()
        } catch (e: Exception) {
            Log.w("ShiftReminderWorker", "Background check failed: ${e.message}")
            Result.retry()
        }
    }
}
