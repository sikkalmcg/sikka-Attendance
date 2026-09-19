import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { normalizeAttendance } from '@/lib/normalize';

export async function POST(request) {
  const auth = await authorizeSystemUser(request, 'approval');
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    const { id, employeeId, attendanceDate } = await request.json();

    if (!id && (!employeeId || !attendanceDate)) {
      return NextResponse.json({ error: 'Attendance record ID is required.' }, { status: 400 });
    }

    await connectToDatabase();

    let record = null;

    if (id) {
      const cleanId = String(id).trim();
      const queryIds = [{ _id: cleanId }, { id: cleanId }];
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        queryIds.push({ _id: new mongoose.Types.ObjectId(cleanId) });
      }

      record = await Attendance.findOne({ $or: queryIds });

      // Handle synthetic absent ID: absent_${empId}_${date}
      if (!record && cleanId.startsWith('absent_')) {
        const parts = cleanId.replace(/^absent_/, '').split('_');
        const date = parts.pop();
        const empId = parts.join('_');
        record = await Attendance.findOne({
          $and: [
            { $or: [{ employeeId: empId }, { employeeId: empId.toUpperCase() }] },
            { $or: [{ attendanceDate: date }, { inDate: date }, { date: date }] },
          ],
        });
      }
    }

    // Secondary fallback: lookup by employeeId and attendanceDate
    if (!record && employeeId && attendanceDate) {
      record = await Attendance.findOne({
        $and: [
          { $or: [{ employeeId: String(employeeId).trim() }, { employeeId: String(employeeId).trim().toUpperCase() }] },
          { $or: [{ attendanceDate: attendanceDate }, { inDate: attendanceDate }, { date: attendanceDate }] },
        ],
      });
    }

    if (!record) {
      return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
    }

    // Plant-Level Data Security: verify logged in user has access to this plant
    const plantScope = await getScopedPlantContext(session);
    if (!plantScope.isAllPlants) {
      const recPlantId = record.plantId || record.markInPlantId;
      const recPlantName = record.plantName || record.markInPlantName || record.inPlant;
      const hasPlantAccess =
        (recPlantId && plantScope.plantIds.includes(String(recPlantId))) ||
        (recPlantName && plantScope.plantNames.map((n) => n.toLowerCase()).includes(String(recPlantName).toLowerCase()));
      if (!hasPlantAccess) {
        return NextResponse.json({ error: 'Access denied: You do not have permission to restore records for this plant.' }, { status: 403 });
      }
    }

    const now = new Date();
    record.approvalStatus = 'PENDING';
    record.approved = false;
    record.restoredBy = session.fullName || session.username;
    record.restoredAt = now;

    await record.save();

    return NextResponse.json({
      success: true,
      message: 'Attendance successfully restored back to Pending Approval.',
      attendance: normalizeAttendance(record),
    });
  } catch (error) {
    console.error('Restore attendance error:', error);
    return NextResponse.json({ error: error.message || 'Failed to restore attendance record' }, { status: 500 });
  }
}
