import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Employee from '@/models/Employee';
import Attendance from '@/models/Attendance';
import Plant from '@/models/Plant';
import { authorizeSystemUser, getScopedPlantContext } from '@/lib/rbac';
import { processAutoMarkOut } from '@/lib/autoMarkOut';
import { normalizeAttendance } from '@/lib/normalize';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const auth = await authorizeSystemUser(request, 'dashboard');
  if (!auth.authorized) return auth.response;

  try {
    await connectToDatabase();
    await processAutoMarkOut();

    const plantScope = await getScopedPlantContext(auth.session);

    // Build plant filtering criteria for Attendance and Employees
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

    // 1. Total Active Employees in user's scope
    const employeeBaseQuery = {
      $or: [{ status: 'Active' }, { active: true }, { active: { $exists: false }, status: { $exists: false } }],
    };
    const employeeQuery = employeePlantCondition
      ? { $and: [employeeBaseQuery, employeePlantCondition] }
      : employeeBaseQuery;

    const totalActiveEmployees = await Employee.countDocuments(employeeQuery);

    // 2. Present Employees Today
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

    let scopedTodayFilter = todayFilter;
    if (attendancePlantCondition) {
      scopedTodayFilter = { $and: [todayFilter, attendancePlantCondition] };
    }

    const presentEmployeeIds = await Attendance.distinct('employeeId', scopedTodayFilter);
    const presentEmployeesCount = presentEmployeeIds.length;

    // 3. Absent Employees: Total Active - Present
    const absentEmployeesCount = Math.max(0, totalActiveEmployees - presentEmployeesCount);

    // 4. Active Plants Count
    let totalActivePlants = 0;
    if (plantScope.isAllPlants) {
      totalActivePlants = await Plant.countDocuments({
        $or: [{ status: 'Active' }, { active: true }],
      });
    } else {
      totalActivePlants = plantScope.plantNames.length || plantScope.plants.length || 1;
    }

    // 5. Currently on shift in user's scope
    const shiftBase = {
      $or: [{ status: 'ACTIVE' }, { status: 'Open' }, { status: 'OPEN' }],
    };
    const currentlyOnShiftCount = await Attendance.countDocuments(
      attendancePlantCondition ? { $and: [shiftBase, attendancePlantCondition] } : shiftBase
    );

    // 6. Pending Approvals in user's scope
    const approvalBase = {
      $or: [{ approvalStatus: 'PENDING' }, { approved: false }],
    };
    const pendingApprovalsCount = await Attendance.countDocuments(
      attendancePlantCondition ? { $and: [approvalBase, attendancePlantCondition] } : approvalBase
    );

    // 7. Recent attendance activities for today
    const rawRecent = await Attendance.find(scopedTodayFilter)
      .sort({ markInAt: -1, inDateTime: -1, createdAt: -1 })
      .limit(6);

    const recentActivity = rawRecent.map(normalizeAttendance);

    return NextResponse.json({
      success: true,
      data: {
        totalActiveEmployees,
        presentEmployees: presentEmployeesCount,
        absentEmployees: absentEmployeesCount,
        totalActivePlants,
        currentlyOnShift: currentlyOnShiftCount,
        pendingApprovals: pendingApprovalsCount,
        recentActivity,
        plantScope: {
          isAllPlants: plantScope.isAllPlants,
          plantNames: plantScope.plantNames,
        },
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard statistics' }, { status: 500 });
  }
}
