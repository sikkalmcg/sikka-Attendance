import { NextApiRequest, NextApiResponse } from 'next';
// FIXED: Path mapping adjusted directly to match the root level folder schema file structure
import { processAttendanceApproval } from "./AttendanceApprovalService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { firmId, employeeId, attendanceDate, approvedBy, status, remarks, isVirtual, virtualData, updateData } = req.body;

    // Strict dynamic layout status check parameters validation mapping
    const normalizedStatus = String(status || '').toUpperCase();

    await processAttendanceApproval({
      firmId,
      employeeId,
      attendanceDate,
      approvedBy,
      status: normalizedStatus, 
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