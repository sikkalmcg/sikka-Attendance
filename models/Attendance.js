import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.Mixed,
      default: () => new mongoose.Types.ObjectId(),
    },
    employeeId: {
      type: String,
      index: true,
      trim: true,
    },
    employeeName: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
      default: 'Staff',
    },
    aadhaarNumber: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },

    // Plant / Location Identifiers
    plantId: {
      type: String,
      index: true,
      default: null,
    },
    plantName: {
      type: String,
      trim: true,
      default: '',
    },
    markInPlantId: {
      type: String,
      default: null,
    },
    markInPlantName: {
      type: String,
      default: '',
    },
    markInLocationType: {
      type: String,
      enum: ['PLANT', 'WORK_FROM_HOME', 'FIELD_WORK', 'OUTSIDE_PLANT'],
      default: 'PLANT',
    },

    // Mark In Details (supports both new markInAt and existing inDateTime)
    markInAt: {
      type: Date,
      index: true,
    },
    markInLatitude: {
      type: Number,
    },
    markInLongitude: {
      type: Number,
    },
    markInAccuracy: {
      type: Number,
      default: null,
    },
    // Plant-radius result captured at the exact Mark IN action time.
    markInWithinPlantRadius: { type: Boolean, default: null },
    markInDistanceMeters: { type: Number, default: null },
    markInAllowedRadiusMeters: { type: Number, default: null },

    // Mark Out Details (supports both new markOutAt and existing outDateTime)
    markOutAt: {
      type: Date,
      default: null,
    },
    markOutLatitude: {
      type: Number,
      default: null,
    },
    markOutLongitude: {
      type: Number,
      default: null,
    },
    markOutAccuracy: {
      type: Number,
      default: null,
    },
    // Plant-radius result captured at the exact Mark OUT action time.
    markOutWithinPlantRadius: { type: Boolean, default: null },
    markOutDistanceMeters: { type: Number, default: null },
    markOutAllowedRadiusMeters: { type: Number, default: null },
    markOutPlantId: {
      type: String,
      default: null,
    },
    markOutPlantName: {
      type: String,
      default: '',
    },
    markOutType: {
      type: String,
      enum: ['Self', 'Auto', 'Manual', 'SELF', 'AUTO', 'AUTO_OUT', 'MANUAL', 'Manual Mark-Out', 'Auto-Out', 'Auto Mark-Out'],
      default: 'Manual Mark-Out',
    },
    markOutByUserId: {
      type: String,
      default: null,
    },
    markOutByUserName: {
      type: String,
      default: null,
    },

    // Duration and Status
    workingMinutes: {
      type: Number,
    },
    status: {
      type: String,
      default: 'ACTIVE',
      index: true,
    },
    autoMarkOut: {
      type: Boolean,
      default: false,
    },

    // Approval Workflow
    approvalStatus: {
      type: String,
      default: 'PENDING',
      index: true,
    },
    approvedBy: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      default: '',
    },

    // Manual Attendance Tracking
    manualAttendanceBy: {
      type: String,
      default: null,
    },
    markInManualBy: {
      type: String,
      default: null,
    },
    markOutManualBy: {
      type: String,
      default: null,
    },

    // Attendance Date (IST yyyy-MM-dd, derived from Mark IN time, not Mark OUT)
    attendanceDate: {
      type: String,
      default: null,
      index: true,
    },

    // Audit Trail
    editedBy: {
      type: String,
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    restoredBy: {
      type: String,
      default: null,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
    auditHistory: [
      {
        editedBy: String,
        editedAt: Date,
        previousMarkIn: Date,
        previousMarkOut: Date,
        newMarkIn: Date,
        newMarkOut: Date,
        remarks: String,
      },
    ],
  },
  {
    timestamps: true,
    strict: false,
    collection: 'attendance',
  }
);

// Indexes
AttendanceSchema.index({ employeeId: 1, attendanceDate: 1 });
AttendanceSchema.index({ employeeId: 1, attendanceDate: -1 });
AttendanceSchema.index({ employeeId: 1, inDate: -1 });
AttendanceSchema.index({ employeeId: 1, markInAt: -1 });
AttendanceSchema.index({ plantId: 1, markInAt: -1 });
AttendanceSchema.index({ status: 1, markInAt: -1 });
AttendanceSchema.index({ approvalStatus: 1, markInAt: -1 });
AttendanceSchema.index({ approved: 1, markInAt: -1 });

export default mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema, 'attendance');

