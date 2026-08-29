import { getDb } from '@/lib/mongodb';

export interface FCMNotificationPayload {
  title: string;
  message: string;
  type: string; // 'DAY_IN_REMINDER' | 'DAY_OUT_REMINDER' | 'NIGHT_IN_REMINDER' | 'NIGHT_OUT_REMINDER' | 'MARK_IN' | 'MARK_OUT' | string
  employeeId?: string;
  targetRole?: string;
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

/**
 * Sends a push notification to registered Android devices via Firebase Cloud Messaging.
 * Automatically handles:
 * - Multi-device support per employee
 * - Role validation
 * - Invalid/expired token cleanup from MongoDB
 * - Audit logging in `notification_logs` collection
 */
export async function sendFCMPushNotification(payload: FCMNotificationPayload): Promise<FCMSendResult> {
  const {
    title,
    message,
    type,
    employeeId = '',
    targetRole = 'EMPLOYEE',
    eventId = '',
    shift = 'DAY',
    shiftDate = new Date().toISOString().split('T')[0],
    data = {},
    deepLink = '/dashboard/attendance',
  } = payload;

  const result: FCMSendResult = {
    success: false,
    totalTokens: 0,
    successCount: 0,
    failureCount: 0,
    invalidTokensCleaned: [],
  };

  try {
    const db = await getDb();
    if (!db) {
      result.error = 'Database unavailable';
      return result;
    }

    // 1. Resolve target employee aliases if employeeId is specified
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
          emp.aadhaar,
          emp.username,
          employeeId,
        ].filter(Boolean);
      }
    }

    // 2. Query both device_tokens and employee_devices collections
    const tokensSet = new Set<string>();

    const queryDT: any = { active: { $ne: false } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'GLOBAL') {
      queryDT.employeeId = { $in: targetIds };
    } else if (targetRole) {
      queryDT.role = targetRole.toUpperCase();
    }

    const deviceTokens = await db.collection('device_tokens').find(queryDT).toArray();
    deviceTokens.forEach((d: any) => {
      const t = String(d.token || '').trim();
      if (t.length > 10) tokensSet.add(t);
    });

    const queryED: any = { isActive: { $ne: false } };
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'GLOBAL') {
      queryED.employeeId = { $in: targetIds };
    }

    const empDevices = await db.collection('employee_devices').find(queryED).toArray();
    empDevices.forEach((d: any) => {
      const t = String(d.deviceToken || '').trim();
      if (t.length > 10) tokensSet.add(t);
    });

    const tokensList: string[] = Array.from(tokensSet);

    if (tokensList.length === 0) {
      result.success = true;
      result.totalTokens = 0;
      // Log as skipped (no devices registered)
      await logNotificationAudit(db, {
        eventId: eventId || `${employeeId}_${shiftDate}_${type}`,
        employeeId,
        notificationType: type,
        shift,
        shiftDate,
        scheduledAt: new Date(),
        sentAt: new Date(),
        tokensSent: 0,
        tokensSuccess: 0,
        tokensFailed: 0,
        invalidTokensCleaned: [],
        status: 'SKIPPED',
        failureReason: 'No registered target device tokens found',
      });
      return result;
    }

    result.totalTokens = tokensList.length;

    const fcmServerKey =
      process.env.FCM_SERVER_KEY ||
      process.env.FIREBASE_SERVER_KEY ||
      process.env.FIREBASE_MESSAGING_KEY;

    if (!fcmServerKey) {
      console.warn('FCM Server Key not configured in environment variables (FCM_SERVER_KEY). Native push deferred.');
      result.success = true;
      await logNotificationAudit(db, {
        eventId: eventId || `${employeeId}_${shiftDate}_${type}`,
        employeeId,
        notificationType: type,
        shift,
        shiftDate,
        scheduledAt: new Date(),
        sentAt: new Date(),
        tokensSent: tokensList.length,
        tokensSuccess: 0,
        tokensFailed: 0,
        invalidTokensCleaned: [],
        status: 'PENDING_SERVER_KEY',
        failureReason: 'FCM_SERVER_KEY not configured in .env',
      });
      return result;
    }

    // 3. Dispatch FCM Push Request with High Priority
    const fcmPayload = {
      registration_ids: tokensList,
      priority: 'high',
      notification: {
        title: title || 'Sikka ERP - Attendance Notification',
        body: message || '',
        sound: 'default',
        badge: '1',
        channel_id: 'sikka_attendance_channel',
        click_action: 'OPEN_ATTENDANCE_PAGE',
      },
      data: {
        title: title || 'Sikka ERP',
        message: message || '',
        body: message || '',
        notificationId: eventId || `notif_${Date.now()}`,
        eventId: eventId || '',
        employeeId: employeeId || '',
        type,
        notificationType: type,
        shift,
        shiftDate,
        action: type.includes('IN') ? 'MARK_IN' : type.includes('OUT') ? 'MARK_OUT' : 'OPEN_APP',
        deepLink: deepLink || '/dashboard/attendance',
        url: deepLink || '/dashboard/attendance',
        timestamp: new Date().toISOString(),
        ...data,
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'sikka_attendance_channel',
          sound: 'default',
          notification_priority: 'PRIORITY_MAX',
          visibility: 'PUBLIC',
        },
      },
    };

    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${fcmServerKey}`,
      },
      body: JSON.stringify(fcmPayload),
    });

    const responseBody = await fcmResponse.json().catch(() => null);

    if (fcmResponse.ok && responseBody) {
      result.success = true;
      result.successCount = responseBody.success || 0;
      result.failureCount = responseBody.failure || 0;

      // 3. Detect and clean invalid/unregistered tokens
      if (Array.isArray(responseBody.results)) {
        const tokensToClean: string[] = [];

        responseBody.results.forEach((resItem: any, index: number) => {
          if (resItem?.error) {
            const err = String(resItem.error);
            if (
              err === 'NotRegistered' ||
              err === 'InvalidRegistration' ||
              err === 'MismatchSenderId'
            ) {
              const badToken = tokensList[index];
              if (badToken) {
                tokensToClean.push(badToken);
              }
            }
          }
        });

        if (tokensToClean.length > 0) {
          result.invalidTokensCleaned = tokensToClean;
          await db
            .collection('device_tokens')
            .deleteMany({ token: { $in: tokensToClean } })
            .catch((cleanErr) => console.warn('Failed cleaning invalid tokens:', cleanErr));
          console.log(`Cleaned ${tokensToClean.length} invalid FCM tokens from database.`);
        }
      }
    } else {
      result.failureCount = tokensList.length;
      result.error = `FCM API returned status ${fcmResponse.status}`;
    }

    // 4. Record Audit Log
    await logNotificationAudit(db, {
      eventId: eventId || `${employeeId}_${shiftDate}_${type}`,
      employeeId,
      notificationType: type,
      shift,
      shiftDate,
      scheduledAt: new Date(),
      sentAt: new Date(),
      tokensSent: tokensList.length,
      tokensSuccess: result.successCount,
      tokensFailed: result.failureCount,
      invalidTokensCleaned: result.invalidTokensCleaned,
      fcmResponse: responseBody,
      status: result.success ? 'SENT' : 'FAILED',
      failureReason: result.error || null,
    });

    return result;
  } catch (error: any) {
    console.error('sendFCMPushNotification error:', error);
    result.error = error?.message || 'Push sending failed';
    return result;
  }
}

/**
 * Log notification audit record in `notification_logs` collection.
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
