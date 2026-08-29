# Sikka HRMS Attendance

Enterprise Attendance & HRMS system for Sikka Industries & Logistics.

---

## 🔔 Push Notification Setup (Background & Closed App Delivery)

The application delivers attendance reminders via **Web-Push (VAPID)** — the same mechanism used by WhatsApp Web. Notifications are delivered even when the app is completely closed.

### Architecture

```
Server Background Scheduler (Node.js instrumentation.ts)
            ↓
Shift Reminder API (/api/notifications/shift-reminders)
            ↓
Web-Push (VAPID) via web-push library
            ↓
Browser Push Service (Google FCM infrastructure)
            ↓
Device Service Worker (public/sw.js) — always alive
            ↓
System Notification Panel (Android/iOS/Desktop)
            ↓
Employee taps notification → App opens → Mark Attendance
```

### Scheduled Notification Times (IST)

| Time (IST) | Event |
|---|---|
| 06:00 AM | Night Shift — Mark OUT reminder |
| 10:00 AM | Day Shift — Mark IN reminder |
| 06:00 PM | Day Shift — Mark OUT reminder |
| 08:00 PM | Night Shift — Mark IN reminder |

---

## ⚙️ Environment Variables

Create `.env.local` with:

```env
# MongoDB
MONGODB_URI=mongodb://...
MONGODB_DB=sikka_database

# Web-Push VAPID Keys (generate with: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
VAPID_SUBJECT=mailto:admin@yourcompany.com

# Optional: Protect cron endpoint from unauthorized calls
CRON_SECRET=your_strong_random_secret

# Optional: Firebase Cloud Messaging (for native Android APK push)
FCM_SERVER_KEY=your_fcm_server_key
```

---

## 🕐 External Cron Configuration

The built-in Node.js scheduler runs automatically when the server is running.
For additional reliability (especially on serverless deployments), configure an external cron:

### Option 1 — Vercel (Automatic)

`vercel.json` is already configured. Cron jobs will run automatically on Vercel Pro/Enterprise.

### Option 2 — cron-job.org (Free, Recommended for VPS/Firebase)

1. Go to [cron-job.org](https://cron-job.org)
2. Create 4 cron jobs hitting your deployment URL:

| URL | Cron Expression (UTC) | IST Time |
|---|---|---|
| `https://your-app.com/api/cron/shift-reminders` | `30 0 * * *` | 06:00 AM |
| `https://your-app.com/api/cron/shift-reminders` | `30 4 * * *` | 10:00 AM |
| `https://your-app.com/api/cron/shift-reminders` | `30 12 * * *` | 06:00 PM |
| `https://your-app.com/api/cron/shift-reminders` | `30 14 * * *` | 08:00 PM |

If `CRON_SECRET` is set, add header: `Authorization: Bearer YOUR_CRON_SECRET`

### Option 3 — Google Cloud Scheduler (Firebase App Hosting)

```bash
gcloud scheduler jobs create http sikka-shift-10am \
  --location=asia-south1 \
  --schedule="30 4 * * *" \
  --uri="https://your-app.com/api/cron/shift-reminders" \
  --http-method=POST
```

---

## 📱 Testing Push Notifications

### Step 1 — Register device
1. Open the app and log in
2. Click "Allow Notifications" in the banner
3. Check browser console for: `[PushSync] Auto-subscribe: VAPID subscription synced`

### Step 2 — Verify MongoDB has subscription
Check `device_tokens` or `employee_devices` collection — should have a `subscription.endpoint` field.

### Step 3 — Test push delivery
```bash
curl -X POST https://your-app.com/api/notifications/test-push \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "EMP001", "title": "Test", "message": "Test notification"}'
```

### Step 4 — Test when app is closed
1. Log in, allow notifications, close the app completely
2. Run the curl command above
3. Notification should appear in the Android notification panel

---

## 🚀 Development

```bash
npm install
npm run dev
```

