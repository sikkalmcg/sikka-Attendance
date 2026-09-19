import mongoose from 'mongoose';

const EmployeeSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.Mixed,
      default: () => new mongoose.Types.ObjectId(),
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
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
    aadhaar: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    mobile: {
      type: String,
      trim: true,
    },
    plantId: {
      type: String,
      trim: true,
      default: '',
    },
    plantName: {
      type: String,
      trim: true,
      default: '',
    },
    unitIds: {
      type: [String],
      default: [],
    },
    passwordHash: {
      type: String,
      default: '',
    },
    attendanceAuthorized: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    // Soft-delete / deactivation fields (never physically delete the document)
    isActive: {
      type: Boolean,
      default: true,
    },
    loginEnabled: {
      type: Boolean,
      default: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivatedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export default mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
