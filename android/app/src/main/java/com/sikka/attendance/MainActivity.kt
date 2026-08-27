package com.sikka.attendance

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.sikka.attendance.bridge.AndroidBridgeInterface
import com.sikka.attendance.databinding.ActivityMainBinding
import com.sikka.attendance.notifications.AttendanceNotificationManager
import com.sikka.attendance.permissions.PermissionFlowManager
import com.sikka.attendance.webview.AttendanceWebChromeClient
import com.sikka.attendance.worker.PeriodicShiftReminderWorker
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Main Activity hosting the WebView Attendance Portal and managing Native Permissions,
 * File Chooser / Photo Picker, and Background Notification Integration.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    lateinit var permissionManager: PermissionFlowManager
        private set

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var currentPhotoPath: String? = null

    // Default Web Portal URL (configurable via preferences)
    // 10.0.2.2 is Android Emulator localhost, 127.0.0.1 or domain for production
    private val defaultPortalUrl = "http://10.0.2.2:3000"

    // Multi-permission launcher for sequential first launch flow
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        permissionManager.onPermissionsResult(results)
    }

    // Photo Chooser / Camera launcher
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val intentData = result.data
            val results: Array<Uri>? = when {
                intentData?.data != null -> arrayOf(intentData.data!!)
                intentData?.clipData != null -> {
                    val count = intentData.clipData!!.itemCount
                    Array(count) { i -> intentData.clipData!!.getItemAt(i).uri }
                }
                currentPhotoPath != null -> {
                    val file = File(currentPhotoPath!!)
                    if (file.exists()) arrayOf(Uri.fromFile(file)) else null
                }
                else -> null
            }
            fileUploadCallback?.onReceiveValue(results)
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize Android 8+ Notification Channels
        AttendanceNotificationManager.createNotificationChannel(this)

        // Initialize Native Permission Flow Manager
        permissionManager = PermissionFlowManager(
            activity = this,
            permissionLauncher = permissionLauncher,
            onFlowCompleted = {
                setupWebView()
                loadPortal()
            }
        )

        // Setup Back Button navigation in WebView
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // Retry connection button
        binding.btnRetry.setOnClickListener {
            binding.errorView.visibility = View.GONE
            loadPortal()
        }

        // Start first launch permission flow or load WebView directly
        permissionManager.startPermissionFlow()

        // Schedule periodic background worker for shift reminders
        scheduleBackgroundShiftWorker()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webSettings = binding.webView.settings
        webSettings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = "${webSettings.userAgentString} SikkaAttendanceNativeApp/1.0"
        }

        // Enable Cookies & Storage
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(binding.webView, true)
        }

        // Add JavaScript Interface Bridge
        val bridge = AndroidBridgeInterface(this)
        binding.webView.addJavascriptInterface(bridge, "AndroidBridge")
        binding.webView.addJavascriptInterface(bridge, "Android")

        // Set WebChromeClient for Geolocation and File Chooser
        binding.webView.webChromeClient = AttendanceWebChromeClient(this, binding.progressBar)

        // Set WebViewClient
        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                binding.errorView.visibility = View.GONE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    binding.errorView.visibility = View.VISIBLE
                    binding.tvErrorMessage.text = "Could not load portal (${error?.description ?: "Network error"})."
                }
            }
        }
    }

    private fun loadPortal() {
        val prefs = getSharedPreferences("sikka_app_prefs", Context.MODE_PRIVATE)
        val portalUrl = prefs.getString("server_url", defaultPortalUrl) ?: defaultPortalUrl
        binding.webView.loadUrl(portalUrl)
    }

    /**
     * File Chooser with modern Camera & Photo Picker support.
     */
    fun openPhotoFileChooser(
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: WebChromeClient.FileChooserParams?
    ): Boolean {
        fileUploadCallback?.onReceiveValue(null)
        fileUploadCallback = filePathCallback

        val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        var photoFile: File? = null
        try {
            photoFile = createImageFile()
            currentPhotoPath = photoFile.absolutePath
        } catch (ex: IOException) {
            Log.e("MainActivity", "Unable to create Image File", ex)
        }

        if (photoFile != null) {
            val photoURI: Uri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                photoFile
            )
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI)
        }

        val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }

        val intentArray: Array<Intent?> = if (photoFile != null) arrayOf(takePictureIntent) else arrayOfNulls(0)

        val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
            putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
            putExtra(Intent.EXTRA_TITLE, "Select Photo or Take Picture")
            putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray)
        }

        fileChooserLauncher.launch(chooserIntent)
        return true
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir: File? = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile("JPEG_${timeStamp}_", ".jpg", storageDir)
    }

    fun requestNativePermission(type: String) {
        when (type.uppercase()) {
            "LOCATION" -> permissionLauncher.launch(
                arrayOf(
                    android.Manifest.permission.ACCESS_FINE_LOCATION,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
            "PHOTO" -> {
                val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    arrayOf(android.Manifest.permission.CAMERA, android.Manifest.permission.READ_MEDIA_IMAGES)
                } else {
                    arrayOf(android.Manifest.permission.CAMERA, android.Manifest.permission.READ_EXTERNAL_STORAGE)
                }
                permissionLauncher.launch(perms)
            }
            "NOTIFICATION" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    permissionLauncher.launch(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS))
                }
            }
        }
    }

    fun openAppSettings() {
        permissionManager.openAppSettings()
    }

    fun updateLauncherBadgeCount(count: Int) {
        try {
            // Android OS launchers handle badge dots automatically via NotificationChannel.setShowBadge(true).
            // For custom OEM launchers (e.g. Samsung, Xiaomi, Huawei, Sony), broadcast standard intents:
            val intent = Intent("android.intent.action.BADGE_COUNT_UPDATE").apply {
                putExtra("badge_count", count)
                putExtra("badge_count_package_name", packageName)
                putExtra("badge_count_class_name", MainActivity::class.java.name)
            }
            sendBroadcast(intent)
        } catch (e: Exception) {
            Log.w("MainActivity", "Badge count broadcast ignored by launcher: ${e.message}")
        }
    }

    private fun scheduleBackgroundShiftWorker() {
        val workRequest = PeriodicWorkRequestBuilder<PeriodicShiftReminderWorker>(15, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(applicationContext).enqueueUniquePeriodicWork(
            "PeriodicShiftReminderWorker",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    override fun onDestroy() {
        binding.webView.destroy()
        super.onDestroy()
    }
}
