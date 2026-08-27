package com.sikka.attendance.permissions

import android.Manifest
import android.app.Dialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.LayoutInflater
import android.view.Window
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.ActivityResultLauncher
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.sikka.attendance.R

/**
 * Coordinates the sequential First-Launch Permission Flow:
 * App Launch -> Location Permission -> Gallery/Photo Permission -> Notification Permission -> App Home
 */
class PermissionFlowManager(
    private val activity: AppCompatActivity,
    private val permissionLauncher: ActivityResultLauncher<Array<String>>,
    private val onFlowCompleted: () -> Unit
) {

    enum class PermissionStep {
        LOCATION,
        PHOTO_CAMERA,
        NOTIFICATION,
        COMPLETED
    }

    private var currentStep = PermissionStep.LOCATION

    /**
     * Starts the first launch sequential permission flow if not previously completed.
     */
    fun startPermissionFlow() {
        val prefs = activity.getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        val hasCompletedFlow = prefs.getBoolean("first_launch_flow_completed", false)

        if (hasCompletedFlow) {
            onFlowCompleted()
            return
        }

        currentStep = PermissionStep.LOCATION
        processNextStep()
    }

    private fun processNextStep() {
        when (currentStep) {
            PermissionStep.LOCATION -> {
                if (hasLocationPermission()) {
                    currentStep = PermissionStep.PHOTO_CAMERA
                    processNextStep()
                } else {
                    showLocationPermissionDialog()
                }
            }

            PermissionStep.PHOTO_CAMERA -> {
                if (hasPhotoCameraPermission()) {
                    currentStep = PermissionStep.NOTIFICATION
                    processNextStep()
                } else {
                    showPhotoPermissionDialog()
                }
            }

            PermissionStep.NOTIFICATION -> {
                if (hasNotificationPermission()) {
                    completeFlow()
                } else {
                    showNotificationPermissionDialog()
                }
            }

            PermissionStep.COMPLETED -> {
                completeFlow()
            }
        }
    }

    // ==========================================
    // 1. LOCATION PERMISSION STEP
    // ==========================================

    fun hasLocationPermission(): Boolean {
        val fineGranted = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val coarseGranted = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        return fineGranted || coarseGranted
    }

    private fun showLocationPermissionDialog() {
        showCustomPermissionDialog(
            badge = "PERMISSION SETUP (1/3)",
            title = activity.getString(R.string.permission_location_title),
            description = activity.getString(R.string.permission_location_desc),
            onAllow = {
                permissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            },
            onSkip = {
                currentStep = PermissionStep.PHOTO_CAMERA
                processNextStep()
            }
        )
    }

    // ==========================================
    // 2. PHOTO & CAMERA PERMISSION STEP
    // ==========================================

    fun hasPhotoCameraPermission(): Boolean {
        val cameraGranted = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        val storageGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.READ_MEDIA_IMAGES
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
        }

        return cameraGranted && storageGranted
    }

    private fun showPhotoPermissionDialog() {
        val requiredPerms = mutableListOf<String>().apply {
            add(Manifest.permission.CAMERA)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.READ_MEDIA_IMAGES)
            } else {
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }.toTypedArray()

        showCustomPermissionDialog(
            badge = "PERMISSION SETUP (2/3)",
            title = activity.getString(R.string.permission_photo_title),
            description = activity.getString(R.string.permission_photo_desc),
            onAllow = {
                permissionLauncher.launch(requiredPerms)
            },
            onSkip = {
                currentStep = PermissionStep.NOTIFICATION
                processNextStep()
            }
        )
    }

    // ==========================================
    // 3. NOTIFICATION PERMISSION STEP
    // ==========================================

    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Automatically granted on Android 12 and below
        }
    }

    private fun showNotificationPermissionDialog() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            showCustomPermissionDialog(
                badge = "PERMISSION SETUP (3/3)",
                title = activity.getString(R.string.permission_notification_title),
                description = activity.getString(R.string.permission_notification_desc),
                onAllow = {
                    permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
                },
                onSkip = {
                    completeFlow()
                }
            )
        } else {
            completeFlow()
        }
    }

    // ==========================================
    // PERMISSION RESULTS HANDLER
    // ==========================================

    fun onPermissionsResult(results: Map<String, Boolean>) {
        when (currentStep) {
            PermissionStep.LOCATION -> {
                val fine = results[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
                val coarse = results[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
                if (!fine && !coarse && isPermanentlyDenied(Manifest.permission.ACCESS_FINE_LOCATION)) {
                    showPermanentDenialDialog(
                        title = "Location Permission Required",
                        message = activity.getString(R.string.permission_denied_location)
                    ) {
                        currentStep = PermissionStep.PHOTO_CAMERA
                        processNextStep()
                    }
                } else {
                    currentStep = PermissionStep.PHOTO_CAMERA
                    processNextStep()
                }
            }

            PermissionStep.PHOTO_CAMERA -> {
                val camera = results[Manifest.permission.CAMERA] ?: false
                val storage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    results[Manifest.permission.READ_MEDIA_IMAGES] ?: false
                } else {
                    results[Manifest.permission.READ_EXTERNAL_STORAGE] ?: false
                }

                if (!camera && !storage && isPermanentlyDenied(Manifest.permission.CAMERA)) {
                    showPermanentDenialDialog(
                        title = "Photos & Camera Required",
                        message = activity.getString(R.string.permission_denied_photo)
                    ) {
                        currentStep = PermissionStep.NOTIFICATION
                        processNextStep()
                    }
                } else {
                    currentStep = PermissionStep.NOTIFICATION
                    processNextStep()
                }
            }

            PermissionStep.NOTIFICATION -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    val notif = results[Manifest.permission.POST_NOTIFICATIONS] ?: false
                    if (!notif && isPermanentlyDenied(Manifest.permission.POST_NOTIFICATIONS)) {
                        showPermanentDenialDialog(
                            title = "Notifications Disabled",
                            message = activity.getString(R.string.permission_denied_notification)
                        ) {
                            completeFlow()
                        }
                    } else {
                        completeFlow()
                    }
                } else {
                    completeFlow()
                }
            }

            PermissionStep.COMPLETED -> {
                completeFlow()
            }
        }
    }

    private fun completeFlow() {
        val prefs = activity.getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("first_launch_flow_completed", true).apply()
        onFlowCompleted()
    }

    private fun isPermanentlyDenied(permission: String): Boolean {
        return !ActivityCompat.shouldShowRequestPermissionRationale(activity, permission) &&
                ContextCompat.checkSelfPermission(activity, permission) != PackageManager.PERMISSION_GRANTED
    }

    // ==========================================
    // DIALOG HELPERS
    // ==========================================

    private fun showCustomPermissionDialog(
        badge: String,
        title: String,
        description: String,
        onAllow: () -> Unit,
        onSkip: () -> Unit
    ) {
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val view = LayoutInflater.from(activity).inflate(R.layout.dialog_permission_request, null)
        dialog.setContentView(view)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.setCancelable(false)

        view.findViewById<TextView>(R.id.tvStepBadge).text = badge
        view.findViewById<TextView>(R.id.tvPermissionTitle).text = title
        view.findViewById<TextView>(R.id.tvPermissionDescription).text = description

        view.findViewById<Button>(R.id.btnAllow).setOnClickListener {
            dialog.dismiss()
            onAllow()
        }

        view.findViewById<Button>(R.id.btnSkip).setOnClickListener {
            dialog.dismiss()
            onSkip()
        }

        dialog.show()
    }

    fun showPermanentDenialDialog(
        title: String,
        message: String,
        onDismiss: () -> Unit
    ) {
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val view = LayoutInflater.from(activity).inflate(R.layout.dialog_permission_denied, null)
        dialog.setContentView(view)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.setCancelable(true)

        view.findViewById<TextView>(R.id.tvDeniedTitle).text = title
        view.findViewById<TextView>(R.id.tvDeniedDescription).text = message

        view.findViewById<Button>(R.id.btnOpenSettings).setOnClickListener {
            dialog.dismiss()
            openAppSettings()
            onDismiss()
        }

        view.findViewById<Button>(R.id.btnCancel).setOnClickListener {
            dialog.dismiss()
            onDismiss()
        }

        dialog.show()
    }

    fun openAppSettings() {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", activity.packageName, null)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            activity.startActivity(intent)
        } catch (e: Exception) {
            android.util.Log.e("PermissionManager", "Error opening app settings", e)
        }
    }
}
