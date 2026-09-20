/**
 * Normalizes an employee record from MongoDB regardless of whether it uses
 * existing fields (aadhaar, mobile, firstName, lastName, active) or new fields.
 */
export function normalizeEmployee(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;

  const employeeId = String(raw.employeeId || raw.id || raw._id || '').trim();
  const rawFirstLast = `${raw.firstName || ''} ${raw.lastName || ''}`.trim();
  const rawFullName = raw.name || raw.fullName || (rawFirstLast ? rawFirstLast : '');
  const fullName = (rawFullName && rawFullName.toLowerCase() !== 'employee') ? rawFullName : (employeeId || '');
  const aadhaarNumber = String(raw.aadhaar || raw.aadhaarNumber || '').trim().replace(/\s+/g, '');
  const mobileNumber = String(raw.mobile || raw.mobileNumber || '').trim().replace(/\D/g, '');

  const status = raw.status
    ? raw.status
    : raw.active === false
    ? 'Inactive'
    : 'Active';

  const attendanceAuthorized =
    raw.attendanceAuthorized !== undefined
      ? Boolean(raw.attendanceAuthorized)
      : true;

  return {
    _id: raw._id ? raw._id.toString() : raw.id,
    id: raw._id ? raw._id.toString() : raw.id,
    employeeId,
    fullName,
    firstName: raw.firstName || '',
    lastName: raw.lastName || '',
    designation: raw.designation || 'Staff',
    department: raw.department || '',
    aadhaarNumber,
    aadhaar: aadhaarNumber,
    mobileNumber,
    mobile: mobileNumber,
    plantId: raw.plantId || (Array.isArray(raw.unitIds) ? raw.unitIds[0] : '') || '',
    plantName: raw.plantName || '',
    attendanceAuthorized,
    status,
    active: status === 'Active',
    passwordHash: raw.passwordHash || null,
    password: raw.password || null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Normalizes a plant record from MongoDB supporting (lat, lng, radius, name) and (latitude, longitude, radiusMeters, plantName)
 */
export function normalizePlant(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;

  const plantId = String(raw.plantId || raw.id || raw._id || '').trim();
  const plantName = raw.plantName || raw.name || 'Plant';
  const location = raw.location || raw.address || plantName;
  const latitude = Number(raw.latitude !== undefined ? raw.latitude : raw.lat ?? 0);
  const longitude = Number(raw.longitude !== undefined ? raw.longitude : raw.lng ?? 0);
  const radiusMeters = Number(raw.radiusMeters !== undefined ? raw.radiusMeters : raw.radius ?? 200);

  const status = raw.status
    ? raw.status
    : raw.active === false
    ? 'Inactive'
    : 'Active';

  return {
    _id: raw._id ? raw._id.toString() : raw.id,
    id: raw._id ? raw._id.toString() : raw.id,
    plantId,
    plantName,
    name: plantName,
    location,
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    radiusMeters,
    radius: radiusMeters,
    status,
    active: status === 'Active',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Normalizes a system user record from MongoDB
 */
export function normalizeUser(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;

  const userId = String(raw.userId || raw.id || raw._id || '').trim();
  const username = String(raw.username || '').trim().toLowerCase();
  const fullName = raw.fullName || raw.name || username;
  const role = raw.role || 'User';

  const status = raw.status
    ? raw.status
    : raw.active === false
    ? 'Inactive'
    : 'Active';

  let permissions = raw.permissions || [];
  if (!Array.isArray(permissions)) permissions = [];

  // Normalize case for permissions
  permissions = permissions.map((p) => String(p).toLowerCase());

  const plantIds = Array.isArray(raw.plantIds)
    ? raw.plantIds
    : raw.plantId
    ? [raw.plantId]
    : [];

  return {
    _id: raw._id ? raw._id.toString() : raw.id,
    id: raw._id ? raw._id.toString() : raw.id,
    userId,
    username,
    fullName,
    role,
    permissions,
    plantIds,
    status,
    active: status === 'Active',
    password: raw.password || null,
    passwordHash: raw.passwordHash || null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

import {
  getAttendanceDateString,
  parseKolkataDateTime,
  calculateWorkingMinutes,
  getRecordMarkInDateTime,
  getRecordMarkOutDateTime,
} from './timezone.js';

/**
 * Normalizes an attendance record from MongoDB supporting both new schema
 * and existing Atlas schema (inDateTime, outDateTime, inPlant, hours, status 'Open'/'Closed'/'Auto OUT', approved boolean)
 */
export function normalizeAttendance(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;

  const id = raw._id ? raw._id.toString() : raw.id || '';
  const employeeId = String(raw.employeeId || raw.empId || '').trim();
  const rawFirstLast = `${raw.firstName || ''} ${raw.lastName || ''}`.trim();
  const rawName = raw.employeeName || raw.name || raw.fullName || (rawFirstLast ? rawFirstLast : '');
  const employeeName = (rawName && rawName.toLowerCase() !== 'employee') ? rawName : (employeeId || '');
  const aadhaarNumber = String(raw.aadhaarNumber || raw.aadhaar || '').trim();
  const mobileNumber = String(raw.mobileNumber || raw.mobile || '').trim();
  const cleanPlantValue = (val) => {
    if (!val || typeof val !== 'string') return '';
    const t = val.trim();
    return (t === 'Manufacturing Plant' || t === '-' || t.toLowerCase() === 'n/a') ? '' : t;
  };

  const rawStatus = String(raw.status || '').toUpperCase();
  const rawType = String(raw.attendanceType || '').toUpperCase();
  const hasActualMarkInOrOut = Boolean(
    raw.markInAt || raw.inDateTime || raw.inTime || raw.mark_in_datetime ||
    raw.markOutAt || raw.outDateTime || raw.outTime || raw.mark_out_datetime
  );
  const isExplicitAbsent = !hasActualMarkInOrOut && (rawStatus === 'ABSENT' || rawType === 'ABSENT');

  // Mark In time (authoritative Date object from database)
  let markInAt = isExplicitAbsent ? null : getRecordMarkInDateTime(raw);

  // Mark Out time (authoritative Date object from database)
  let markOutAt = isExplicitAbsent ? null : getRecordMarkOutDateTime(raw);

  // Status mapping
  let status = 'COMPLETED';
  if ((isExplicitAbsent || (!markInAt && !markOutAt)) && rawStatus !== 'ACTIVE' && rawStatus !== 'OPEN') {
    status = 'ABSENT';
  } else if (rawStatus === 'OPEN' || rawStatus === 'ACTIVE' || (!markOutAt && markInAt)) {
    status = 'ACTIVE';
  } else if (
    rawStatus.includes('AUTO') ||
    raw.autoMarkOut ||
    raw.autoCheckout ||
    String(raw.outType || '').toLowerCase().includes('auto') ||
    String(raw.markOutType || '').toLowerCase().includes('auto') ||
    raw.markOutPlantName === 'Auto-Out'
  ) {
    status = 'AUTO_COMPLETED';
  } else if (rawStatus === 'CLOSED' || rawStatus === 'COMPLETED') {
    status = 'COMPLETED';
  }

  // Working minutes: always calculate from actual markInAt and markOutAt if available
  let workingMinutes = 0;
  if (status === 'ABSENT' || status === 'ACTIVE') {
    workingMinutes = 0;
  } else if (markInAt && markOutAt) {
    workingMinutes = calculateWorkingMinutes(markInAt, markOutAt);
  } else if (Number(raw.workingMinutes) > 0) {
    workingMinutes = Number(raw.workingMinutes);
  } else if (raw.hours) {
    workingMinutes = Math.round(Number(raw.hours) * 60);
  }

  // Approval status
  let approvalStatus = 'PENDING';
  if (raw.approvalStatus === 'APPROVED' || raw.approved === true) {
    approvalStatus = 'APPROVED';
  } else if (raw.approvalStatus) {
    approvalStatus = String(raw.approvalStatus).toUpperCase();
  } else if (raw.approved === false) {
    approvalStatus = 'PENDING';
  }

  const approved = approvalStatus === 'APPROVED';

  // Mark Out Type
  let markOutType = 'SELF';
  if (isExplicitAbsent || status === 'ABSENT' || status === 'ACTIVE') {
    markOutType = '-';
  } else if (
    status === 'AUTO_COMPLETED' ||
    raw.autoMarkOut ||
    raw.autoCheckout ||
    String(raw.outType || '').toLowerCase().includes('auto') ||
    String(raw.markOutType || '').toLowerCase().includes('auto') ||
    raw.markOutPlantName === 'Auto-Out'
  ) {
    markOutType = 'AUTO_OUT';
  } else if (
    String(raw.markOutType || '').toUpperCase() === 'MANUAL' ||
    String(raw.markOutType || '').toLowerCase() === 'manual mark-out' ||
    Boolean(raw.markOutManualBy) ||
    Boolean(raw.markOutByUserName)
  ) {
    markOutType = 'MANUAL';
  } else if (raw.markOutType) {
    const rawUpper = String(raw.markOutType).toUpperCase();
    if (rawUpper === 'SELF') markOutType = 'SELF';
    else if (rawUpper === 'AUTO' || rawUpper === 'AUTO_OUT') markOutType = 'AUTO_OUT';
    else if (rawUpper === 'MANUAL') markOutType = 'MANUAL';
    else markOutType = raw.markOutType;
  }

  const markOutByUserId = raw.markOutByUserId || null;
  const markOutByUserName =
    raw.markOutByUserName ||
    raw.markOutManualBy ||
    (markOutType === 'MANUAL' ? (raw.manualAttendanceBy || raw.editedBy) : null) ||
    null;

  // Mark In Location Types & Names
  let markInLocationType = raw.markInLocationType || 'PLANT';
  let markInPlantName = '-';
  if (isExplicitAbsent || status === 'ABSENT') {
    markInPlantName = '-';
  } else if (markInLocationType === 'WORK_FROM_HOME' || raw.workType === 'WORK_FROM_HOME') {
    markInPlantName = 'Outside Plant - WFM';
    markInLocationType = 'WORK_FROM_HOME';
  } else if (markInLocationType === 'FIELD_WORK' || raw.workType === 'FIELD_WORK') {
    markInPlantName = 'Outside Plant - Field Work';
    markInLocationType = 'FIELD_WORK';
  } else {
    markInPlantName =
      cleanPlantValue(raw.markInPlantName) ||
      cleanPlantValue(raw.inPlant) ||
      cleanPlantValue(raw.plantName) ||
      cleanPlantValue(raw.street) ||
      '-';
    if (!raw.markInLocationType && markInPlantName.toLowerCase().includes('outside')) {
      markInLocationType = 'OUTSIDE_PLANT';
    }
  }

  // Mark Out Plant Name
  let markOutPlantName = '-';
  if (isExplicitAbsent || status === 'ABSENT') {
    markOutPlantName = '-';
  } else if (status === 'ACTIVE') {
    markOutPlantName = 'Under Process';
  } else if (
    status === 'AUTO_COMPLETED' ||
    markOutType === 'Auto-Out' ||
    raw.autoMarkOut ||
    raw.markOutPlantName === 'Auto-Out'
  ) {
    markOutPlantName = 'Auto-Out';
  } else if (
    raw.markOutWithinPlantRadius === false ||
    raw.markOutPlantName === 'Outside-Out' ||
    String(raw.outPlant || '').toLowerCase() === 'outside-out'
  ) {
    markOutPlantName = 'Outside-Out';
  } else {
    markOutPlantName =
      cleanPlantValue(raw.markOutPlantName) ||
      cleanPlantValue(raw.outPlant) ||
      cleanPlantValue(raw.markInPlantName) ||
      cleanPlantValue(raw.plantName) ||
      cleanPlantValue(raw.street) ||
      '-';
  }

  const attendanceDate = getAttendanceDateString(raw);
  const plantId = raw.plantId || raw.markInPlantId || null;

  return {
    _id: id,
    id,
    employeeId,
    employeeName,
    designation: raw.designation || 'Staff',
    aadhaarNumber,
    mobileNumber,
    attendanceDate,
    inDate: raw.inDate || raw.date || null,
    inTime: raw.inTime || null,
    outDate: raw.outDate || null,
    outTime: raw.outTime || null,
    hours: raw.hours !== undefined ? raw.hours : null,
    plantId,
    plantName: markInPlantName,
    markInPlantId: raw.markInPlantId || plantId,
    markInPlantName,
    markInLocationType,
    markInAt: markInAt ? markInAt.toISOString() : null,
    markOutAt: markOutAt ? markOutAt.toISOString() : null,
    markInLatitude: Number(raw.markInLatitude !== undefined ? raw.markInLatitude : raw.lat ?? 0),
    markInLongitude: Number(raw.markInLongitude !== undefined ? raw.markInLongitude : raw.lng ?? 0),
    markInWithinPlantRadius: raw.markInWithinPlantRadius ?? null,
    markInDistanceMeters: raw.markInDistanceMeters ?? null,
    markInAllowedRadiusMeters: raw.markInAllowedRadiusMeters ?? null,
    markOutLatitude: raw.markOutLatitude !== undefined ? Number(raw.markOutLatitude) : (raw.latOut !== undefined ? Number(raw.latOut) : null),
    markOutLongitude: raw.markOutLongitude !== undefined ? Number(raw.markOutLongitude) : (raw.lngOut !== undefined ? Number(raw.lngOut) : null),
    markOutPlantId: raw.markOutPlantId || null,
    markOutWithinPlantRadius: raw.markOutWithinPlantRadius ?? null,
    markOutDistanceMeters: raw.markOutDistanceMeters ?? null,
    markOutAllowedRadiusMeters: raw.markOutAllowedRadiusMeters ?? null,
    markOutPlantName,
    markOutType,
    markOutByUserId,
    markOutByUserName,
    workingMinutes,
    status,
    autoMarkOut: Boolean(raw.autoMarkOut || raw.autoCheckout || status === 'AUTO_COMPLETED' || markOutType === 'AUTO_OUT' || markOutType === 'Auto'),
    approvalStatus,
    approved,
    approvedBy: raw.approvedBy || null,
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt).toISOString() : null,
    editedBy: raw.editedBy || null,
    editedAt: raw.editedAt ? new Date(raw.editedAt).toISOString() : null,
    restoredBy: raw.restoredBy || null,
    restoredAt: raw.restoredAt ? new Date(raw.restoredAt).toISOString() : null,
    auditHistory: Array.isArray(raw.auditHistory) ? raw.auditHistory : [],
    remarks: raw.remarks || raw.remark || '',
    manualAttendanceBy: raw.manualAttendanceBy || null,
    markInManualBy: raw.markInManualBy || null,
    markOutManualBy: raw.markOutManualBy || null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

