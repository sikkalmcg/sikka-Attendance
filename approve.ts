import { NextApiRequest, NextApiResponse } from 'next';
import { processAttendanceApproval } from "./AttendanceApprovalService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // FIXED: Destructured 'recordId' directly from req.body to bridge frontend telemetry parameters
    const { recordId, firmId, employeeId, attendanceDate, approvedBy, status, remarks, isVirtual, virtualData, updateData } = req.body;

    const normalizedStatus = String(status || '').toUpperCase();

    await processAttendanceApproval({
      recordId, // Injected parameter cleanly into the database engine
      firmId,
      employeeId,
      attendanceDate,
      approvedBy,
      status: normalizedStatus as any, 
      remarks,
      isVirtual,
      virtualData,
      updateData
    });

    return res.status(200).json({ message: `Attendance ${status} successfully within 1 second! Ledger updated.` });
  } catch (error: any) {
    console.error('Attendance Approval Error:', error);
    return res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
}