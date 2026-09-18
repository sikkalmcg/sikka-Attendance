import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import { authorizeSystemUser } from '@/lib/rbac';
import {
  getAttendanceDateString,
  isFutureKolkataDate,
  isFutureKolkataDateTime,
} from '@/lib/timezone';

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

    const objId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
    let record = await Attendance.findOne({
      $or: [
        { _id: id },
        ...(objId ? [{ _id: objId }] : []),
        { id: id },
      ],
    });

    if (!record) {
      return NextResponse.json({ error: 'Attendance record not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      const recDate = getAttendanceDateString(record);
      if (
        isFutureKolkataDate(recDate) ||
        (record.markInAt && isFutureKolkataDateTime(record.markInAt)) ||
        (record.markOutAt && isFutureKolkataDateTime(record.markOutAt))
      ) {
        return NextResponse.json(
          { error: 'Future date or time is not allowed. Please select the current or past date and time.' },
          { status: 400 }
        );
      }

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
