import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { POST as handleSubscribe } from './subscribe/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes for ACTIVE status

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '15', 10)));
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 503 });
    }

    // 1. Fetch all employees (Master List) and all registered devices from MongoDB
    const [employees, rawDevices, rawTokens] = await Promise.all([
      db.collection('employees').find({}).sort({ employeeId: 1, name: 1, _id: 1 }).toArray().catch(() => []),
      db.collection('employee_devices').find({}).sort({ lastActiveAt: -1, updatedAt: -1, _id: -1 }).toArray().catch(() => []),
      db.collection('device_tokens').find({}).sort({ updatedAt: -1, _id: -1 }).toArray().catch(() => []),
    ]);

    // 2. Index devices by employeeId and all known aliases
    const deviceMap = new Map<string, any[]>();
    const allDeviceDocs = [...rawDevices];

    // Also bring in device_tokens if not already present
    const existingTokens = new Set(allDeviceDocs.map((d: any) => d.deviceId || d.token || d.deviceToken).filter(Boolean));
    for (const t of rawTokens) {
      const tokId = t.token || t.deviceToken || t.deviceId;
      if (tokId && !existingTokens.has(tokId)) {
        allDeviceDocs.push({
          ...t,
          deviceId: tokId,
          fcmToken: t.token || t.deviceToken,
        });
      }
    }

    for (const dev of allDeviceDocs) {
      const empId = String(dev.employeeId || dev.employee_id || '').trim();
      if (empId) {
        const key = empId.toUpperCase();
        if (!deviceMap.has(key)) {
          deviceMap.set(key, []);
        }
        deviceMap.get(key)!.push(dev);
      }
    }

    const now = Date.now();
    const processedEmployeeIds = new Set<string>();

    // 3. Perform Left-Join: Employees -> Registered Devices
    const mergedList: any[] = [];

    for (const emp of employees) {
      const empId = String(emp.employeeId || emp.id || '').trim();
      const empIdUpper = empId.toUpperCase();
      processedEmployeeIds.add(empIdUpper);

      const empFullName = emp.firstName
        ? `${emp.firstName} ${emp.lastName || ''}`.trim()
        : (emp.name || emp.fullName || 'Employee');

      // Check device aliases
      const candidateDevices =
        deviceMap.get(empIdUpper) ||
        (emp.mobile ? deviceMap.get(String(emp.mobile).toUpperCase()) : null) ||
        (emp.username ? deviceMap.get(String(emp.username).toUpperCase()) : null) ||
        (emp.aadhaar ? deviceMap.get(String(emp.aadhaar).toUpperCase()) : null) ||
        [];

      // Sort candidate devices to pick the most active/latest one as current device
      const sortedDevices = [...candidateDevices].sort((a, b) => {
        const timeA = new Date(a.lastActiveAt || a.lastHeartbeatAt || a.lastTokenUpdatedAt || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.lastActiveAt || b.lastHeartbeatAt || b.lastTokenUpdatedAt || b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      const currentDev = sortedDevices[0] || null;

      if (currentDev) {
        // Employee has at least 1 registered device
        const lastActiveTime = currentDev.lastActiveAt || currentDev.lastHeartbeatAt || currentDev.lastTokenUpdatedAt || currentDev.updatedAt || null;
        const lastActiveMs = lastActiveTime ? new Date(lastActiveTime).getTime() : 0;
        const diffMs = now - lastActiveMs;

        const isPermissionDenied =
          currentDev.notificationPermission === 'denied' ||
          currentDev.permission === 'denied' ||
          currentDev.permission === 'Denied';

        const isPermissionAllowed =
          currentDev.notificationPermission === 'granted' ||
          currentDev.permission === 'granted' ||
          currentDev.permission === 'Allowed';

        let deviceStatus: 'ACTIVE' | 'INACTIVE' | 'PERMISSION_DISABLED' | 'NOT_REGISTERED' = 'ACTIVE';
        if (isPermissionDenied) {
          deviceStatus = 'PERMISSION_DISABLED';
        } else if (!lastActiveMs || diffMs > ACTIVE_THRESHOLD_MS) {
          deviceStatus = 'INACTIVE';
        } else {
          deviceStatus = 'ACTIVE';
        }

        const rawFcm =
          currentDev.fcmToken ||
          currentDev.deviceToken ||
          currentDev.token ||
          currentDev.pushSubscription?.endpoint ||
          currentDev.subscription?.endpoint ||
          '';

        const permissionDisplay = isPermissionAllowed
          ? 'Allowed'
          : isPermissionDenied
          ? 'Denied'
          : 'Not Determined';

        const backgroundStatus = isPermissionDenied
          ? 'Restricted'
          : (deviceStatus === 'ACTIVE' ? 'Active' : 'Standby');

        const deviceName =
          currentDev.deviceName ||
          (currentDev.model ? `${currentDev.manufacturer || ''} ${currentDev.model}`.trim() : '') ||
          (currentDev.platform === 'android' || currentDev.platform === 'Android' ? 'Android Device' : 'Authorized Web Node');

        mergedList.push({
          id: currentDev.id || currentDev._id?.toString() || `dev_${empId}`,
          employeeId: emp.employeeId || empId,
          employeeName: empFullName,
          role: emp.role || currentDev.role || 'EMPLOYEE',
          department: emp.department || currentDev.department || 'General',
          designation: emp.designation || currentDev.designation || 'Staff',
          plantName: emp.plantName || emp.plant || 'Main Plant',

          // Device Details
          isRegistered: true,
          deviceId: currentDev.deviceId || currentDev.token || 'DEVICE_ID_ACTIVE',
          deviceName,
          platform: currentDev.platform ? String(currentDev.platform).toUpperCase() : 'ANDROID',
          manufacturer: currentDev.manufacturer || '',
          model: currentDev.model || '',
          osVersion: currentDev.osVersion || '',
          appVersion: currentDev.appVersion || '1.0.0',

          // Tokens & Subscriptions
          fcmToken: rawFcm || 'Registered',
          rawToken: rawFcm,
          hasPushSubscription: Boolean(currentDev.pushSubscription?.endpoint || currentDev.subscription?.endpoint),

          // Permissions & Statuses
          notificationPermission: permissionDisplay,
          locationPermission: currentDev.locationPermission || 'Allowed',
          backgroundEnabled: currentDev.backgroundEnabled ?? !isPermissionDenied,
          backgroundStatus,
          deviceStatus,

          // Timestamps
          deviceRegisteredAt: currentDev.createdAt || currentDev.deviceRegisteredAt || currentDev.registeredAt || null,
          lastTokenUpdatedAt: currentDev.lastTokenUpdatedAt || currentDev.lastTokenUpdated || null,
          lastActiveAt: lastActiveTime,
          lastHeartbeatAt: currentDev.lastHeartbeatAt || null,

          // Multi-Device Registry History
          deviceCount: sortedDevices.length,
          deviceHistory: currentDev.deviceHistory || sortedDevices.map((d: any) => ({
            deviceId: d.deviceId || d.token,
            deviceName: d.deviceName || d.model || 'Device',
            platform: d.platform || 'Android',
            lastActiveAt: d.lastActiveAt || d.updatedAt,
          })),
        });
      } else {
        // Employee has NO registered device
        mergedList.push({
          id: `unreg_${empId}`,
          employeeId: emp.employeeId || empId,
          employeeName: empFullName,
          role: emp.role || 'EMPLOYEE',
          department: emp.department || 'General',
          designation: emp.designation || 'Staff',
          plantName: emp.plantName || emp.plant || 'Main Plant',

          // Device Details
          isRegistered: false,
          deviceId: '—',
          deviceName: '—',
          platform: '—',
          manufacturer: '—',
          model: '—',
          osVersion: '—',
          appVersion: '—',

          // Tokens & Subscriptions
          fcmToken: 'Not Registered',
          rawToken: '',
          hasPushSubscription: false,

          // Permissions & Statuses
          notificationPermission: 'Not Determined',
          locationPermission: '—',
          backgroundEnabled: false,
          backgroundStatus: 'Not Registered',
          deviceStatus: 'NOT_REGISTERED',

          // Timestamps
          deviceRegisteredAt: null,
          lastTokenUpdatedAt: null,
          lastActiveAt: null,
          lastHeartbeatAt: null,

          deviceCount: 0,
          deviceHistory: [],
        });
      }
    }

    // 4. Also append non-employee device registrations (e.g. Admin / Super Admin devices)
    for (const dev of allDeviceDocs) {
      const devEmpId = String(dev.employeeId || '').trim().toUpperCase();
      if (devEmpId && !processedEmployeeIds.has(devEmpId)) {
        processedEmployeeIds.add(devEmpId);

        const lastActiveTime = dev.lastActiveAt || dev.lastHeartbeatAt || dev.lastTokenUpdatedAt || dev.updatedAt || null;
        const lastActiveMs = lastActiveTime ? new Date(lastActiveTime).getTime() : 0;
        const diffMs = now - lastActiveMs;
        const isPermissionDenied = dev.notificationPermission === 'denied' || dev.permission === 'denied';

        let deviceStatus: 'ACTIVE' | 'INACTIVE' | 'PERMISSION_DISABLED' | 'NOT_REGISTERED' = 'ACTIVE';
        if (isPermissionDenied) {
          deviceStatus = 'PERMISSION_DISABLED';
        } else if (!lastActiveMs || diffMs > ACTIVE_THRESHOLD_MS) {
          deviceStatus = 'INACTIVE';
        } else {
          deviceStatus = 'ACTIVE';
        }

        mergedList.push({
          id: dev.id || dev._id?.toString() || `dev_${devEmpId}`,
          employeeId: dev.employeeId || devEmpId,
          employeeName: dev.employeeName || dev.fullName || dev.username || 'Administrator',
          role: dev.role || 'ADMIN',
          department: dev.department || 'Management',
          designation: dev.designation || 'Admin Node',
          plantName: 'Headquarters',

          isRegistered: true,
          deviceId: dev.deviceId || dev.token || 'DEVICE_ID_ACTIVE',
          deviceName: dev.deviceName || 'Admin Terminal',
          platform: dev.platform ? String(dev.platform).toUpperCase() : 'WEB',
          manufacturer: dev.manufacturer || '',
          model: dev.model || '',
          osVersion: dev.osVersion || '',
          appVersion: dev.appVersion || '1.0.0',

          fcmToken: dev.fcmToken || dev.token || dev.pushSubscription?.endpoint || 'Registered',
          rawToken: dev.fcmToken || dev.token || dev.pushSubscription?.endpoint || '',
          hasPushSubscription: Boolean(dev.pushSubscription?.endpoint || dev.subscription?.endpoint),

          notificationPermission: isPermissionDenied ? 'Denied' : 'Allowed',
          locationPermission: 'Allowed',
          backgroundEnabled: !isPermissionDenied,
          backgroundStatus: isPermissionDenied ? 'Restricted' : (deviceStatus === 'ACTIVE' ? 'Active' : 'Standby'),
          deviceStatus,

          deviceRegisteredAt: dev.createdAt || dev.deviceRegisteredAt || null,
          lastTokenUpdatedAt: dev.lastTokenUpdatedAt || null,
          lastActiveAt: lastActiveTime,
          lastHeartbeatAt: dev.lastHeartbeatAt || null,

          deviceCount: 1,
          deviceHistory: [],
        });
      }
    }

    // 5. Calculate Global Statistics before filtering
    const totalEmployees = mergedList.length;
    const registeredCount = mergedList.filter((item) => item.isRegistered).length;
    const notRegisteredCount = totalEmployees - registeredCount;
    const activeCount = mergedList.filter((item) => item.deviceStatus === 'ACTIVE').length;
    const inactiveCount = mergedList.filter((item) => item.deviceStatus === 'INACTIVE').length;
    const permissionDisabledCount = mergedList.filter((item) => item.deviceStatus === 'PERMISSION_DISABLED').length;

    // 6. Apply Search Filtering across all fields
    let filteredList = mergedList;
    if (search) {
      filteredList = mergedList.filter((item) => {
        return (
          item.employeeName.toLowerCase().includes(search) ||
          item.employeeId.toLowerCase().includes(search) ||
          item.department.toLowerCase().includes(search) ||
          item.designation.toLowerCase().includes(search) ||
          item.role.toLowerCase().includes(search) ||
          item.deviceName.toLowerCase().includes(search) ||
          item.deviceId.toLowerCase().includes(search) ||
          item.platform.toLowerCase().includes(search) ||
          item.fcmToken.toLowerCase().includes(search) ||
          item.rawToken.toLowerCase().includes(search) ||
          item.deviceStatus.toLowerCase().includes(search) ||
          item.notificationPermission.toLowerCase().includes(search) ||
          item.backgroundStatus.toLowerCase().includes(search)
        );
      });
    }

    // 7. Paginate the filtered list
    const filteredTotal = filteredList.length;
    const totalPages = Math.ceil(filteredTotal / limit) || 1;
    const paginatedData = filteredList.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      data: paginatedData,
      stats: {
        totalEmployees,
        registeredCount,
        notRegisteredCount,
        activeCount,
        inactiveCount,
        permissionDisabledCount,
      },
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/device-registry:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch device registry records' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return handleSubscribe(req);
}
