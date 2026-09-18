import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import { authorizeSystemUser } from '@/lib/rbac';

export async function POST(request, { params }) {
  const auth = await authorizeSystemUser(request, 'approval');
  if (!auth.authorized) return auth.response;

  const { session } = auth;

  try {
    const { id } = await params;
    const { action, remarks } = await request.json(); // action: 'approve' | 'cancel'

    if (!['approve', 'cancel'].includes(action)) {
      return NextResponse.json({ error: "Action must be either 'approve' or 'cancel'." }, { status: 400 });
    }

    await connectToDatabase();

    let record = null;
    try {
      record = await Attendance.findById(id);
    } catch (e) {}

    if (!record) {
      record = await Attendance.findOne({ $or: [{ _id: id }, { id: id }] });
    }

    if (!record) {
      return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      record.approvalStatus = 'APPROVED';
      record.approved = true;
      record.approvedBy = session.fullName;
      record.approvedAt = new Date();
      if (remarks) record.remarks = remarks;
    } else {
      record.approvalStatus = 'CANCELLED';
      record.approved = false;
      record.approvedBy = session.fullName;
      record.approvedAt = new Date();
      if (remarks) record.remarks = remarks;
    }

    await record.save();

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Attendance Approved Successfully' : 'Attendance Cancelled',
      attendance: record,
    });
  } catch (error) {
    console.error('Error updating approval status:', error);
    return NextResponse.json({ error: error.message || 'Failed to update approval' }, { status: 500 });
  }
}
