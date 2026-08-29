package com.sikka.attendance.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.sikka.attendance.MainActivity
import com.sikka.attendance.R
import java.util.concurrent.atomic.AtomicInteger

/**
 * Handles Android 8+ Notification Channels, Sound, Vibration, Badge/Dot,
 * Unique Notification IDs, and Role-Based Employee Targeting.
 */
object AttendanceNotificationManager {

    const val CHANNEL_ID = "sikka_attendance_channel"
    const val CHANNEL_NAME = "Attendance Notifications"
    const val GROUP_KEY_ATTENDANCE = "com.sikka.attendance.ATTENDANCE_NOTIFS"

    private val notificationIdCounter = AtomicInteger(1000)

    /**
     * Initializes the Android 8+ Notification Channel.
     * Guaranteed: setShowBadge(true), High Importance, Default Sound, and Vibration.
     */
    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val existingChannel = notificationManager.getNotificationChannel(CHANNEL_ID)
            if (existingChannel == null) {
                val importance = NotificationManager.IMPORTANCE_HIGH
                val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                    description = "Notifications for Employee Mark IN, Mark OUT, and Shift Reminders"
                    enableLights(true)
                    lightColor = Color.parseColor("#C59D2E")
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 250, 100, 250)
                    setShowBadge(true) // Explicitly enabled: DO NOT USE setShowBadge(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC

                    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                    val audioAttributes = AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .build()
                    setSound(soundUri, audioAttributes)
                }

                notificationManager.createNotificationChannel(channel)
            }
        }
    }

    /**
     * Posts a notification to the Android system notification tray.
     *
     * @param context Application Context
     * @param title Title of the notification (e.g. "Mark IN Successful")
     * @param message Message body
     * @param notifType Type (e.g. 'MARK_IN', 'MARK_OUT', 'SHIFT_REMINDER')
     * @param employeeId Optional Employee ID
     * @param customNotifId Optional unique notification ID
     */
    fun showNotification(
        context: Context,
        title: String,
        message: String,
        notifType: String = "ATTENDANCE",
        employeeId: String = "",
        customNotifId: Int? = null
    ) {
        createNotificationChannel(context)

        // Strict Role Check: Mark IN / OUT / Shift Reminders are for Employee only!
        if (!isEmployeeNotificationAllowed(context, notifType)) {
            android.util.Log.d("AttendanceNotif", "Notification blocked for non-employee role. Type: $notifType")
            return
        }

        val notificationId = customNotifId ?: generateUniqueNotificationId(notifType, employeeId, message)

        // PendingIntent to launch/resume MainActivity when tapped
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("EXTRA_NOTIF_TYPE", notifType)
            putExtra("EXTRA_EMPLOYEE_ID", employeeId)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setColor(Color.parseColor("#C59D2E"))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(Notification.DEFAULT_ALL)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 250, 100, 250))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setGroup(GROUP_KEY_ATTENDANCE)
            .setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        try {
            val notificationManager = NotificationManagerCompat.from(context)
            notificationManager.notify(notificationId, builder.build())
        } catch (e: SecurityException) {
            android.util.Log.e("AttendanceNotif", "POST_NOTIFICATIONS permission not granted", e)
        } catch (e: Exception) {
            android.util.Log.e("AttendanceNotif", "Error posting notification", e)
        }
    }

    /**
     * Verifies if the currently logged-in user is eligible to receive this notification.
     * Rule:
     * - IF notifType in ['MARK_IN', 'MARK_OUT', 'AUTO_OUT', 'SHIFT_REMINDER']
     *   -> ALLOW only if stored user role == 'EMPLOYEE'
     */
    fun isEmployeeNotificationAllowed(context: Context, notifType: String?): Boolean {
        val typeUpper = (notifType ?: "").uppercase().trim()
        val isEmployeeOnlyType = typeUpper in listOf(
            "MARK_IN",
            "MARK_OUT",
            "AUTO_OUT",
            "SHIFT_REMINDER",
            "DAY_IN_REMINDER",
            "DAY_OUT_REMINDER",
            "NIGHT_IN_REMINDER",
            "NIGHT_OUT_REMINDER"
        )

        if (!isEmployeeOnlyType) {
            return true
        }

        val prefs = context.getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        val currentRole = prefs.getString("user_role", "EMPLOYEE")?.uppercase()?.trim() ?: "EMPLOYEE"

        return currentRole == "EMPLOYEE"
    }

    /**
     * Generates a unique notification ID so notifications do not overwrite one another.
     */
    private fun generateUniqueNotificationId(notifType: String, employeeId: String, message: String): Int {
        val key = "${notifType}_${employeeId}_${System.currentTimeMillis() % 100000}_${message.hashCode()}"
        return Math.abs(key.hashCode())
    }
}
