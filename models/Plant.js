import mongoose from 'mongoose';

const PlantSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.Mixed,
      default: () => new mongoose.Types.ObjectId(),
    },
    plantId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    plantName: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    radiusMeters: {
      type: Number,
      required: true,
      default: 200,
      min: 1,
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

export default mongoose.models.Plant || mongoose.model('Plant', PlantSchema);
