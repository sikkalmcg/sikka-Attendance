import { NextResponse } from 'next/server';
// Import path ko root folder (jahan AttendanceApprovalService hai) tak point kiya gaya hai
import { processAttendanceApproval } from './AttendanceApprovalService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recordId, firmId, employeeId, attendanceDate, approvedBy, status, remarks, isVirtual, virtualData, updateData } = body;

    // Approval service ko trigger karein
    await processAttendanceApproval({
      recordId,
      firmId,
      employeeId,
      attendanceDate,
      approvedBy,
      status, 
      remarks,
      isVirtual,
      virtualData,
      updateData
    });

    return NextResponse.json({ 
      message: `Attendance ${status} successfully within 1 second! Ledger updated.` 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Approval Error:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}