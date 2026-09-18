import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({
  userId: String,
  fullName: String,
  username: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  role: { type: String, default: 'Admin' },
  permissions: [String],
  status: { type: String, default: 'Active' },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seed() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Ensure Initial Administrator: ajaysomra / Mayank@2012
  const adminUsername = 'ajaysomra';
  const existingAdmin = await User.findOne({ username: adminUsername });
  
  const adminPasswordHash = await bcrypt.hash('Mayank@2012', 10);
  const adminPermissions = [
    'dashboard',
    'plant',
    'approval',
    'report',
    'employee',
    'user-management'
  ];

  if (!existingAdmin) {
    await User.create({
      userId: 'USR-ADMIN-01',
      fullName: 'Ajay Somra (Admin)',
      username: adminUsername,
      passwordHash: adminPasswordHash,
      role: 'Admin',
      permissions: adminPermissions,
      status: 'Active',
    });
    console.log('✅ Initial Admin configured: ajaysomra / Mayank@2012');
  } else {
    console.log('ℹ️ Admin user ajaysomra exists. Ensuring full admin permissions & active status.');
    existingAdmin.permissions = adminPermissions;
    existingAdmin.status = 'Active';
    await existingAdmin.save();
  }

  console.log('🎉 Administrator initialization completed.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
