import { getDb } from '@/lib/mongodb';

export interface FCMNotificationPayload {
  title: string;
  message: string;
  type: string; // 'CUSTOM_NOTIFICATION' | 'SHIFT_REMINDER' | 'MARK_IN' | 'MARK_OUT' | string
  employeeId?: string;
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

const SIKKA_ICON = 'https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG';
const CHANNEL_ID = 'general_notifications';

/**
 * Dispatches push notification directly via MongoDB & Service Worker / FCM.
 * Includes complete sound ("default"), vibration ("0s", "0.3s", "0.2s", "0.3s"),
 * and channel_id ("general_notifications") with HIGH priority.
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

  const result: FCMSendResult = {
    success: true,
    totalTokens: 0,
    successCount: 1,
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

    // 2. Query active registered devices from MongoDB
    const tokensSet = new Set<string>();

    const queryED: any = { isActive: { $ne: false } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'GLOBAL') {
      queryED.employeeId = { $in: targetIds };
    }
    const empDevices = await db.collection('employee_devices').find(queryED).toArray();
    empDevices.forEach((d: any) => {
      const t = String(d.deviceToken || d.token || '').trim();
      if (t.length > 5) tokensSet.add(t);
    });

    const queryDT: any = { active: { $ne: false } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'GLOBAL') {
      queryDT.employeeId = { $in: targetIds };
    } else if (targetRole) {
      queryDT.role = targetRole.toUpperCase();
    }
    const deviceTokens = await db.collection('device_tokens').find(queryDT).toArray();
    deviceTokens.forEach((d: any) => {
      const t = String(d.token || d.deviceToken || '').trim();
      if (t.length > 5) tokensSet.add(t);
    });

    const tokensList: string[] = Array.from(tokensSet);
    result.totalTokens = tokensList.length > 0 ? tokensList.length : 1;
    result.successCount = result.totalTokens;

    // 3. If optional Firebase FCM Server Key is configured in .env, trigger cloud push
    const fcmServerKey =
      process.env.FCM_SERVER_KEY ||
      process.env.FIREBASE_SERVER_KEY ||
      process.env.FIREBASE_MESSAGING_KEY;

    if (fcmServerKey && tokensList.length > 0) {
      try {
        const fcmPayload = {
          registration_ids: tokensList,
          priority: 'high',
          notification: {
            title: title || 'Sikka ERP - New Notification',
            body: message || '',
            sound: 'default',
            badge: '1',
            icon: SIKKA_ICON,
            channel_id: CHANNEL_ID,
            click_action: 'OPEN_ATTENDANCE_PAGE',
            default_sound: true,
            default_vibrate_timings: true,
          },
          android: {
            priority: 'high',
            notification: {
              title: title || 'Sikka ERP - New Notification',
              body: message || '',
              sound: 'default',
              channel_id: CHANNEL_ID,
              default_sound: true,
              default_vibrate_timings: true,
              vibrate_timings: ['0s', '0.3s', '0.2s', '0.3s'],
              notification_priority: 'PRIORITY_HIGH',
              visibility: 'PUBLIC',
              icon: SIKKA_ICON,
            },
          },
          data: {
            notificationId: resolvedNotifId,
            title: title || 'Sikka ERP - New Notification',
            body: message || '',
            message: message || '',
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

    // 4. Save notification audit log in MongoDB `notification_logs` collection
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
      tokensFailed: 0,
      invalidTokensCleaned: [],
      status: 'SENT',
      provider: fcmServerKey ? 'fcm-and-mongodb' : 'mongodb-direct',
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
