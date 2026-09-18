import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import Attendance from '@/models/Attendance';
import Plant from '@/models/Plant';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { normalizeAttendance } from '@/lib/normalize';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'dashboard');
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // totalEmployees | present | absent | plants | pendingApprovals

  try {
    await connectToDatabase();
    const plantScope = await getScopedPlantContext(auth.session);

    let attendancePlantCondition = null;
    let employeePlantCondition = null;

    if (!plantScope.isAllPlants) {
      attendancePlantCondition = {
        $or: [
          { plantId: { $in: plantScope.plantIds } },
          { markInPlantId: { $in: plantScope.plantIds } },
          { inPlant: { $in: plantScope.plantNames } },
          { plantName: { $in: plantScope.plantNames } },
          { markInPlantName: { $in: plantScope.plantNames } },
        ],
      };
      employeePlantCondition = {
        $or: [
          { unitIds: { $in: plantScope.plantIds } },
          { plantId: { $in: plantScope.plantIds } },
          { plantName: { $in: plantScope.plantNames } },
        ],
      };
    }

    const employeeBaseQuery = {
      $or: [{ status: 'Active' }, { active: true }, { active: { $exists: false }, status: { $exists: false } }],
    };
    const employeeQuery = employeePlantCondition
      ? { $and: [employeeBaseQuery, employeePlantCondition] }
      : employeeBaseQuery;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const todayDateStr = new Date().toISOString().slice(0, 10);

    const todayFilter = {
      $or: [
        { markInAt: { $gte: startOfToday, $lte: endOfToday } },
        { inDateTime: { $gte: startOfToday, $lte: endOfToday } },
        { createdAt: { $gte: startOfToday, $lte: endOfToday } },
        { date: todayDateStr },
        { inDate: todayDateStr },
      ],
    };
    const scopedTodayFilter = attendancePlantCondition
      ? { $and: [todayFilter, attendancePlantCondition] }
      : todayFilter;

    if (type === 'totalEmployees') {
      const employees = await Employee.find(employeeQuery)
        .select('employeeId fullName name designation status attendanceAuthorized')
        .sort({ fullName: 1, name: 1 })
        .lean();

      const list = employees.map((e) => ({
        employeeId: e.employeeId || e.id || '—',
        name: e.fullName || e.name || '—',
        designation: e.designation || '—',
        status: e.status || 'Active',
        authorized: e.attendanceAuthorized !== false,
      }));
      return NextResponse.json({ success: true, type, count: list.length, list });
    }

    if (type === 'present') {
      const records = await Attendance.find(scopedTodayFilter)
        .sort({ markInAt: -1, inDateTime: -1 })
        .lean();
      const seen = new Set();
      const list = [];
      for (const r of records) {
        const n = normalizeAttendance(r);
        if (!seen.has(n.employeeId)) {
          seen.add(n.employeeId);
          list.push({
            employeeId: n.employeeId || '—',
            name: n.employeeName || '—',
            designation: n.designation || '—',
            plantName: n.plantName || n.markInPlantName || '—',
            markInAt: n.markInAt || null,
            status: n.status || '—',
          });
        }
      }
      return NextResponse.json({ success: true, type, count: list.length, list });
    }

    if (type === 'absent') {
      // All active employees minus those who marked attendance today
      const presentIds = await Attendance.distinct('employeeId', scopedTodayFilter);
      const absentQuery = presentIds.length > 0
        ? { $and: [employeeQuery, { employeeId: { $nin: presentIds } }] }
        : employeeQuery;

      const employees = await Employee.find(absentQuery)
        .select('employeeId fullName name designation status')
        .sort({ fullName: 1, name: 1 })
        .lean();

      const list = employees.map((e) => ({
        employeeId: e.employeeId || '—',
        name: e.fullName || e.name || '—',
        designation: e.designation || '—',
        status: e.status || 'Active',
      }));
      return NextResponse.json({ success: true, type, count: list.length, list });
    }

    if (type === 'plants') {
      let query = { $or: [{ status: 'Active' }, { active: true }] };
      if (!plantScope.isAllPlants) {
        query = {
          $and: [
            query,
            {
              $or: [
                { plantId: { $in: plantScope.plantIds } },
                { name: { $in: plantScope.plantNames } },
                { plantName: { $in: plantScope.plantNames } },
              ],
            },
          ],
        };
      }
      const plants = await Plant.find(query)
        .select('plantId plantName name location radiusMeters status')
        .sort({ plantName: 1, name: 1 })
        .lean();

      const list = plants.map((p) => ({
        plantId: p.plantId || '—',
        plantName: p.plantName || p.name || '—',
        location: p.location || '—',
        radiusMeters: p.radiusMeters ?? '—',
        status: p.status || 'Active',
      }));
      return NextResponse.json({ success: true, type, count: list.length, list });
    }

    if (type === 'pendingApprovals') {
      const approvalBase = { $or: [{ approvalStatus: 'PENDING' }, { approved: false }] };
      const query = attendancePlantCondition
        ? { $and: [approvalBase, attendancePlantCondition] }
        : approvalBase;

      const records = await Attendance.find(query)
        .sort({ markInAt: -1, inDateTime: -1, createdAt: -1 })
        .limit(200)
        .lean();

      const list = records.map((r) => {
        const n = normalizeAttendance(r);
        return {
          employeeId: n.employeeId || '—',
          name: n.employeeName || '—',
          designation: n.designation || '—',
          plantName: n.plantName || n.markInPlantName || '—',
          markInAt: n.markInAt || null,
          markOutAt: n.markOutAt || null,
          status: n.status || '—',
          attendanceDate: n.attendanceDate || '—',
        };
      });
      return NextResponse.json({ success: true, type, count: list.length, list });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch detail data' }, { status: 500 });
  }
}
