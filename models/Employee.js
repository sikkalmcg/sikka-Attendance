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
      unique: true,
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
    },
    aadhaarNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{12}$/, 'Aadhaar must be a 12-digit number'],
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, 'Mobile must be a 10-digit number'],
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
    passwordHash: {
      type: String,
      required: true,
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
  },
  {
    timestamps: true,
    strict: false,
  }
);

export default mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
