import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

export default mongoose.models.Counter || mongoose.model('Counter', CounterSchema, 'counters');
