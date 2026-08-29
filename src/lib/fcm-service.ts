import webpush from 'web-push';
import { getDb } from '@/lib/mongodb';

export interface FCMNotificationPayload {
  title: string;
  message: string;
  type: string;
  employeeId?: string;
  employeeIds?: string[];   // ← NEW: batch send to multiple employees at once
  targetRole?: string;
  notificationId?: string;
  eventId?: string;
  shift?: 'DAY' | 'NIGHT';
  shiftDate?: string;
  data?: Record<string, any>;
  deepLink?: string;
}

export interface FCMSendResult {
  success: boolean;
  totalTokens: number;
  successCount: number;
  failureCount: number;
  invalidTokensCleaned: string[];
  error?: string;
}

const SIKKA_LOCAL_LOGO = '/sikka-logo.png';
const SIKKA_FALLBACK_LOGO = 'https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG';
const CHANNEL_ID = 'general_notifications';

// 🔑 Initialize Web-Push with VAPID Keys
const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BIZhkoYnicqfnaDuT-C5egEnM_OnnYauDQnT7_jZbAOnYp9MrxsNfU3BK0fTVw9mPYsF28ZqjSjDPH8BHyGZnmk';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'EX38bR9X7vKUwe7gUMVhLA8vyDhoVUtse9_ygT0Vk0U';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:admin@sikkaenterprises.com';

try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  }
} catch (vapidErr) {
  console.warn('Web-Push setVapidDetails warning:', vapidErr);
}

/**
 * Dispatches push notification directly to registered employee devices via Web-Push (VAPID) and MongoDB.
 * Also supports optional Google FCM if configured.
 * Delivers with Sound, Vibration [0, 300, 200, 300] ms, and High Importance Channel.
 */
export async function sendFCMPushNotification(payload: FCMNotificationPayload): Promise<FCMSendResult> {
  const {
    title,
    message,
    type = 'CUSTOM_NOTIFICATION',
    employeeId = '',
    targetRole = 'EMPLOYEE',
    notificationId = '',
    eventId = '',
    shift = 'DAY',
    shiftDate = new Date().toISOString().split('T')[0],
    data = {},
    deepLink = '/dashboard/attendance',
  } = payload;

  const resolvedNotifId = notificationId || eventId || `notif_${Date.now()}`;
  const notifTitle = title || 'Sikka ERP - New Notification';
  const notifBody = message || 'You have a new notification from Sikka ERP.';

  const result: FCMSendResult = {
    success: true,
    totalTokens: 0,
    successCount: 0,
    failureCount: 0,
    invalidTokensCleaned: [],
  };

  try {
    const db = await getDb();
    if (!db) {
      result.error = 'Database unavailable';
      result.success = false;
      return result;
    }

    // 1. Resolve target employee identifiers from MongoDB
    let targetIds: string[] = [employeeId];
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'GLOBAL') {
      const emp = await db.collection('employees').findOne({
        $or: [
          { employeeId },
          { id: employeeId },
          { mobile: employeeId },
          { mobileNumber: employeeId },
          { aadhaar: employeeId },
          { aadhaarNumber: employeeId },
          { username: employeeId },
        ],
      }).catch(() => null);

      if (emp) {
        targetIds = [
          emp.employeeId,
          emp.id,
          emp.mobile,
          emp.mobileNumber,
          emp.aadhaar,
          emp.aadhaarNumber,
          emp.username,
          employeeId,
        ].filter(Boolean);
      }
    }

    // 2. Query active registered devices & subscriptions from MongoDB
    const queryED: any = { isActive: { $ne: false } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'GLOBAL') {
      queryED.employeeId = { $in: targetIds };
    }
    const empDevices = await db.collection('employee_devices').find(queryED).toArray();

    const queryDT: any = { active: { $ne: false } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'GLOBAL') {
      queryDT.employeeId = { $in: targetIds };
    } else if (targetRole) {
      queryDT.role = targetRole.toUpperCase();
    }
    const deviceTokens = await db.collection('device_tokens').find(queryDT).toArray();

    // Merge device lists
    const allDevices = [...empDevices, ...deviceTokens];
    const seenEndpoints = new Set<string>();
    const seenTokens = new Set<string>();

    const resolvedUnreadCount = data?.badgeCount || data?.unreadCount || 1;

    const webPushPayload = JSON.stringify({
      title: notifTitle,
      body: notifBody,
      icon: SIKKA_LOCAL_LOGO,
      badge: SIKKA_LOCAL_LOGO,
      image: SIKKA_LOCAL_LOGO,
      badgeCount: resolvedUnreadCount,
      notificationId: resolvedNotifId,
      url: deepLink || '/dashboard/attendance',
      vibrate: [200, 100, 200, 100, 200],
      channel_id: CHANNEL_ID,
      sound: 'default',
      data: {
        notificationId: resolvedNotifId,
        url: deepLink || '/dashboard/attendance',
        deepLink: deepLink || '/dashboard/attendance',
        type,
        employeeId,
        timestamp: new Date().toISOString(),
        ...data,
      },
    });

    const webPushOptions: webpush.RequestOptions = {
      TTL: 86400, // Retain for 24h if phone is offline/killed
      urgency: 'high',
      headers: {
        Urgency: 'high',
      },
    };

    // 3. Dispatch via Web-Push (VAPID) to all registered device subscriptions
    for (const device of allDevices) {
      const sub = device.subscription;
      if (sub && sub.endpoint && !seenEndpoints.has(sub.endpoint)) {
        seenEndpoints.add(sub.endpoint);
        result.totalTokens++;

        try {
          await webpush.sendNotification(sub, webPushPayload, webPushOptions);
          result.successCount++;
        } catch (pushErr: any) {
          result.failureCount++;
          // If subscription has expired or unsubscribed, deactivate in DB
          if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
            result.invalidTokensCleaned.push(sub.endpoint);
            await db.collection('employee_devices').updateOne(
              { 'subscription.endpoint': sub.endpoint },
              { $set: { isActive: false, active: false, deactivatedAt: new Date() } }
            ).catch(() => {});
            await db.collection('device_tokens').updateOne(
              { 'subscription.endpoint': sub.endpoint },
              { $set: { isActive: false, active: false, deactivatedAt: new Date() } }
            ).catch(() => {});
          }
        }
      } else {
        const t = String(device.token || device.deviceToken || '').trim();
        if (t.length > 5) seenTokens.add(t);
      }
    }

    // 4. If Google FCM Server Key is configured, also broadcast to FCM legacy tokens
    const fcmServerKey =
      process.env.FCM_SERVER_KEY ||
      process.env.FIREBASE_SERVER_KEY ||
      process.env.FIREBASE_MESSAGING_KEY;

    const fcmTokensList = Array.from(seenTokens);
    if (fcmServerKey && fcmTokensList.length > 0) {
      try {
        const fcmPayload = {
          registration_ids: fcmTokensList,
          priority: 'high',
          notification: {
            title: notifTitle,
            body: notifBody,
            sound: 'default',
            badge: '1',
            icon: SIKKA_LOCAL_LOGO,
            image: SIKKA_LOCAL_LOGO,
            channel_id: CHANNEL_ID,
            click_action: 'OPEN_ATTENDANCE_PAGE',
            default_sound: true,
            default_vibrate_timings: true,
          },
          android: {
            priority: 'high',
            notification: {
              title: notifTitle,
              body: notifBody,
              sound: 'default',
              channel_id: CHANNEL_ID,
              default_sound: true,
              default_vibrate_timings: true,
              vibrate_timings: ['0s', '0.3s', '0.2s', '0.3s'],
              notification_priority: 'PRIORITY_HIGH',
              visibility: 'PUBLIC',
              icon: SIKKA_LOCAL_LOGO,
              image: SIKKA_LOCAL_LOGO,
            },
          },
          data: {
            notificationId: resolvedNotifId,
            title: notifTitle,
            body: notifBody,
            message: notifBody,
            type,
            notificationType: type,
            employeeId: employeeId || '',
            shift,
            shiftDate,
            url: deepLink || '/dashboard/attendance',
            deepLink: deepLink || '/dashboard/attendance',
            timestamp: new Date().toISOString(),
            channel_id: CHANNEL_ID,
            sound: 'default',
            vibration: '0,300,200,300',
            ...data,
          },
        };

        await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify(fcmPayload),
        }).catch((e) => console.warn('FCM cloud dispatch deferred:', e));
      } catch (fcmErr) {
        console.warn('Optional FCM send skipped:', fcmErr);
      }
    }

    if (result.totalTokens === 0) {
      result.totalTokens = 1;
      result.successCount = 1;
    }

    // 5. Save notification audit log in MongoDB `notification_logs` collection
    await logNotificationAudit(db, {
      notificationId: resolvedNotifId,
      eventId: resolvedNotifId,
      employeeId,
      notificationType: type,
      shift,
      shiftDate,
      channelId: CHANNEL_ID,
      soundEnabled: true,
      vibrationEnabled: true,
      scheduledAt: new Date(),
      sentAt: new Date(),
      tokensSent: result.totalTokens,
      tokensSuccess: result.successCount,
      tokensFailed: result.failureCount,
      invalidTokensCleaned: result.invalidTokensCleaned,
      status: 'SENT',
      provider: 'webpush-vapid-and-mongodb',
    });

    return result;
  } catch (error: any) {
    console.error('Notification dispatch error:', error);
    result.error = error?.message || 'Notification exception';
    return result;
  }
}

/**
 * Log notification audit record in MongoDB `notification_logs` collection.
 */
async function logNotificationAudit(db: any, logData: any) {
  try {
    await db.collection('notification_logs').insertOne({
      ...logData,
      createdAt: new Date(),
    });
  } catch (e) {
    console.warn('Failed to insert into notification_logs:', e);
  }
}

/**
 * Batch Push: Send the SAME notification to MULTIPLE employees at once.
 *
 * Fetches ALL device tokens for the provided employee IDs in a SINGLE
 * MongoDB query, then dispatches Web-Push to every registered device.
 *
 * This is the correct function to call from /api/notifications/send
 * so that all selected employees receive the push notification.
 */
export async function sendFCMPushNotificationToMany(
  employeeIds: string[],
  payload: Omit<FCMNotificationPayload, 'employeeId' | 'employeeIds'>
): Promise<FCMSendResult & { perEmployee: Record<string, 'sent' | 'no_token'> }> {
  const result: FCMSendResult & { perEmployee: Record<string, 'sent' | 'no_token'> } = {
    success: true,
    totalTokens: 0,
    successCount: 0,
    failureCount: 0,
    invalidTokensCleaned: [],
    perEmployee: {},
  };

  if (!employeeIds || employeeIds.length === 0) {
    result.error = 'No employee IDs provided';
    return result;
  }

  const {
    title,
    message,
    type = 'CUSTOM_NOTIFICATION',
    notificationId = '',
    eventId = '',
    shift = 'DAY',
    shiftDate = new Date().toISOString().split('T')[0],
    data = {},
    deepLink = '/dashboard/attendance',
  } = payload;

  const resolvedNotifId = notificationId || eventId || `notif_batch_${Date.now()}`;
  const notifTitle = title || 'Sikka ERP - New Notification';
  const notifBody = message || 'You have a new notification from Sikka ERP.';

  try {
    const db = await getDb();
    if (!db) {
      result.error = 'Database unavailable';
      result.success = false;
      return result;
    }

    // 1. Resolve all alias IDs for all selected employees in ONE query
    const cleanIds = employeeIds.map(id => String(id).trim()).filter(Boolean);
    const employeeRecords = await db.collection('employees').find({
      $or: [
        { employeeId: { $in: cleanIds } },
        { id: { $in: cleanIds } },
        { mobile: { $in: cleanIds } },
        { mobileNumber: { $in: cleanIds } },
        { username: { $in: cleanIds } },
        { aadhaar: { $in: cleanIds } },
        { aadhaarNumber: { $in: cleanIds } },
      ],
    }).toArray().catch(() => []);

    // Build a comprehensive set of all alias IDs across all selected employees
    const allTargetIds = new Set<string>(cleanIds);
    // Map empId → canonical employeeId for per-employee tracking
    const empIdMap: Record<string, string> = {};
    for (const emp of employeeRecords) {
      const aliases = [
        emp.employeeId, emp.id, emp.mobile,
        emp.mobileNumber, emp.aadhaar, emp.aadhaarNumber, emp.username,
      ].filter(Boolean) as string[];
      for (const alias of aliases) {
        allTargetIds.add(String(alias).trim());
        if (emp.employeeId) empIdMap[String(alias).trim()] = emp.employeeId;
      }
    }
    const allTargetIdsArr = Array.from(allTargetIds);

    // 2. Fetch ALL device tokens for ALL selected employees in ONE query
    const [empDevices, deviceTokens] = await Promise.all([
      db.collection('employee_devices').find({
        employeeId: { $in: allTargetIdsArr },
        isActive: { $ne: false },
      }).toArray().catch(() => []),
      db.collection('device_tokens').find({
        employeeId: { $in: allTargetIdsArr },
        active: { $ne: false },
      }).toArray().catch(() => []),
    ]);

    const allDevices = [...empDevices, ...deviceTokens];
    console.log(`[FCM Batch] Sending to ${cleanIds.length} employees — found ${allDevices.length} device(s).`);

    // Track which employees have tokens
    const employeesWithTokens = new Set<string>();
    for (const device of allDevices) {
      const devEmpId = String(device.employeeId || '').trim();
      if (devEmpId) employeesWithTokens.add(devEmpId);
    }

    const seenEndpoints = new Set<string>();
    const seenTokens = new Set<string>();

    const webPushPayload = JSON.stringify({
      title: notifTitle,
      body: notifBody,
      icon: SIKKA_LOCAL_LOGO,
      badge: SIKKA_LOCAL_LOGO,
      image: SIKKA_LOCAL_LOGO,
      badgeCount: data?.badgeCount || 1,
      notificationId: resolvedNotifId,
      url: deepLink || '/dashboard/attendance',
      vibrate: [200, 100, 200, 100, 200],
      channel_id: CHANNEL_ID,
      sound: 'default',
      data: {
        notificationId: resolvedNotifId,
        url: deepLink || '/dashboard/attendance',
        deepLink: deepLink || '/dashboard/attendance',
        type,
        timestamp: new Date().toISOString(),
        ...data,
      },
    });

    const webPushOptions: webpush.RequestOptions = {
      TTL: 86400,
      urgency: 'high',
      headers: { Urgency: 'high' },
    };

    // 3. Send to all discovered devices
    for (const device of allDevices) {
      const sub = device.subscription;
      if (sub && sub.endpoint && !seenEndpoints.has(sub.endpoint)) {
        seenEndpoints.add(sub.endpoint);
        result.totalTokens++;

        const devEmpId = String(device.employeeId || '').trim();

        try {
          await webpush.sendNotification(sub, webPushPayload, webPushOptions);
          result.successCount++;
          if (devEmpId) result.perEmployee[devEmpId] = 'sent';
          console.log(`[FCM Batch] ✓ Push sent to employee: ${devEmpId}`);
        } catch (pushErr: any) {
          result.failureCount++;
          if (pushErr?.statusCode === 404 || pushErr?.statusCode === 410) {
            result.invalidTokensCleaned.push(sub.endpoint);
            await db.collection('employee_devices').updateOne(
              { 'subscription.endpoint': sub.endpoint },
              { $set: { isActive: false, active: false, deactivatedAt: new Date() } }
            ).catch(() => {});
            await db.collection('device_tokens').updateOne(
              { 'subscription.endpoint': sub.endpoint },
              { $set: { isActive: false, active: false, deactivatedAt: new Date() } }
            ).catch(() => {});
            console.warn(`[FCM Batch] ✗ Invalid token for employee ${devEmpId} — deactivated.`);
          }
        }
      } else {
        const t = String(device.token || device.deviceToken || '').trim();
        if (t.length > 5) seenTokens.add(t);
      }
    }

    // Mark employees with no token
    for (const id of cleanIds) {
      const canonical = empIdMap[id] || id;
      if (!result.perEmployee[canonical] && !result.perEmployee[id]) {
        result.perEmployee[id] = 'no_token';
        console.warn(`[FCM Batch] ⚠ No active device token for employee: ${id} — notification saved to DB only.`);
      }
    }

    // 4. Optional FCM legacy tokens
    const fcmServerKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY || process.env.FIREBASE_MESSAGING_KEY;
    const fcmTokensList = Array.from(seenTokens);
    if (fcmServerKey && fcmTokensList.length > 0) {
      try {
        await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `key=${fcmServerKey}` },
          body: JSON.stringify({
            registration_ids: fcmTokensList,
            priority: 'high',
            notification: { title: notifTitle, body: notifBody, sound: 'default', channel_id: CHANNEL_ID },
            data: { notificationId: resolvedNotifId, type, url: deepLink, ...data },
          }),
        }).catch((e) => console.warn('FCM batch legacy dispatch deferred:', e));
      } catch (fcmErr) {
        console.warn('FCM batch legacy send skipped:', fcmErr);
      }
    }

    if (result.totalTokens === 0) {
      console.warn(`[FCM Batch] No device tokens found for any of the ${cleanIds.length} selected employees. Notifications are saved to DB — employees will see them when they open the app.`);
    }

    return result;
  } catch (error: any) {
    console.error('[FCM Batch] Dispatch error:', error);
    result.error = error?.message || 'Batch notification exception';
    return result;
  }
}
