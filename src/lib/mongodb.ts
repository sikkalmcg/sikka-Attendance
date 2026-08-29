import { MongoClient, type Db, type Collection, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
const dbName = (process.env.MONGODB_DB as string) || 'sikka_database';

if (!uri) {
  throw new Error('Missing environment variable: MONGODB_URI');
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoDb: Db | undefined;
  var _indexesCreated: boolean | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 50,
      minPoolSize: 5,
      maxIdleTimeMS: 300000,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      tls: true,
      retryWrites: true,
    });
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  const client = new MongoClient(uri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxIdleTimeMS: 300000,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    tls: true,
    retryWrites: true,
  });
  clientPromise = client.connect();
}

async function ensureIndexes(db: Db) {
  if (global._indexesCreated) return;
  global._indexesCreated = true;
  try {
    // Background index creation to make lookups and sorts instant (< 10ms)
    db.collection('attendance').createIndex({ date: -1 }, { background: true }).catch(() => {});
    db.collection('attendance').createIndex({ employeeId: 1, date: -1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ employeeId: 1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ aadhaar: 1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ mobile: 1 }, { background: true }).catch(() => {});
    db.collection('leaveRequests').createIndex({ employeeId: 1, status: 1 }, { background: true }).catch(() => {});
    db.collection('notifications').createIndex({ createdAt: -1 }, { background: true }).catch(() => {});
  } catch {}
}

export async function getClient(): Promise<MongoClient> {
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  if (global._mongoDb) {
    return global._mongoDb;
  }
  const client = await clientPromise;
  const db = client.db(dbName);
  global._mongoDb = db;
  ensureIndexes(db);
  return db;
}

export async function getCollection<TSchema extends Record<string, any> = Record<string, any>>(
  collectionName: string
): Promise<Collection<TSchema>> {
  const db = await getDb();
  return db.collection<TSchema>(collectionName);
}

export function toObjectId(id: string): ObjectId {
  if (!id) throw new Error('Missing id');
  return new ObjectId(id);
}
