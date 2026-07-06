import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { Workbook } from 'exceljs';
import { LeaveRequest, Employee } from '@/lib/types';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const db = await getDb();
    const leaveRequestsCol = db.collection<LeaveRequest>('leaveRequests');
    const employeesCol = db.collection<Employee>('employees');

    // सभी लीव रिक्वेस्ट और कर्मचारी डेटा प्राप्त करें
    const allLeaveRequests = await leaveRequestsCol.find({}).toArray();
    const allEmployees = await employeesCol.find({}).toArray();

    // कर्मचारियों को उनके ID द्वारा मैप करें ताकि जल्दी से जानकारी मिल सके
    const employeeMap = new Map(allEmployees.map(e => [e.employeeId, e]));

    // लीव रिक्वेस्ट को कर्मचारी विवरण के साथ समृद्ध करें
    const enrichedLeaveRequests = allLeaveRequests.map(l => {
      const employee = employeeMap.get(l.employeeId);
      const status = String(l.status).toUpperCase();
      const isHistory = status === 'APPROVED' || status === 'REJECTED' || status === 'EXPIRED';

      if (!isHistory) return null;

      return {
        ...l,
        department: employee?.department || 'N/A',
        designation: employee?.designation || 'N/A',
        remark: l.remark,
        processedAt: l.processedAt,
        processedByUserId: l.processedByUserId,
      };
    }).filter(Boolean);

    // एक नई एक्सेल वर्कबुक बनाएँ
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Leave History');

    // कॉलम हेडर सेट करें
    worksheet.columns = [
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Designation', key: 'designation', width: 20 },
      { header: 'Leave Type', key: 'purpose', width: 20 },
      { header: 'From Date', key: 'fromDate', width: 15 },
      { header: 'To Date', key: 'toDate', width: 15 },
      { header: 'Days', key: 'days', width: 10 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Remark', key: 'remark', width: 30 },
      { header: 'Processed At', key: 'processedAt', width: 20 },
      { header: 'Processed By', key: 'processedByUserId', width: 25 },
    ];

    // डेटा पंक्तियाँ जोड़ें
    enrichedLeaveRequests.forEach(leave => {
      if (leave) {
        worksheet.addRow({
          employeeId: leave.employeeId,
          employeeName: leave.employeeName,
          department: leave.department,
          designation: leave.designation,
          purpose: leave.purpose,
          fromDate: leave.fromDate ? format(new Date(leave.fromDate), 'dd-MMM-yyyy') : '-',
          toDate: leave.toDate ? format(new Date(leave.toDate), 'dd-MMM-yyyy') : '-',
          days: leave.days,
          status: leave.status,
          remark: leave.remark || '-',
          processedAt: leave.processedAt ? format(new Date(leave.processedAt), 'dd-MMM-yyyy HH:mm') : '-',
          processedByUserId: leave.processedByUserId || '-',
        });
      }
    });

    // फ़ाइल डाउनलोड के लिए रिस्पांस तैयार करें
    const buffer = await workbook.xlsx.writeBuffer();
    const today = format(new Date(), 'yyyy-MM-dd');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="leave_history_${today}.xlsx"`,
      },
    });

  } catch (error) {
    console.error('Failed to export leave history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}