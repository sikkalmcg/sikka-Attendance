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

function initMongoClient(): Promise<MongoClient> {
  const client = new MongoClient(uri, {
    maxPoolSize: 50,
    minPoolSize: 1,
    maxIdleTimeMS: 300000,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    retryWrites: true,
  });

  return client.connect().catch((err) => {
    global._mongoClientPromise = undefined;
    global._mongoDb = undefined;
    throw err;
  });
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = initMongoClient();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = initMongoClient();
}

async function ensureIndexes(db: Db) {
  if (global._indexesCreated) return;
  global._indexesCreated = true;
  try {
    // Background index creation to make lookups and sorts instant (< 10ms)
    db.collection('attendance').createIndex({ date: -1 }, { background: true }).catch(() => {});
    db.collection('attendance').createIndex({ employeeId: 1, date: -1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ employeeId: 1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ aadhaarNumber: 1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ mobileNumber: 1 }, { background: true }).catch(() => {});
    db.collection('leaveRequests').createIndex({ employeeId: 1, status: 1 }, { background: true }).catch(() => {});
    db.collection('notifications').createIndex({ createdAt: -1 }, { background: true }).catch(() => {});
  } catch {}
}

export async function getClient(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = initMongoClient();
    }
    return global._mongoClientPromise;
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  try {
    if (global._mongoDb) {
      return global._mongoDb;
    }
    const client = await getClient();
    const db = client.db(dbName);
    global._mongoDb = db;
    ensureIndexes(db);
    return db;
  } catch (err) {
    global._mongoClientPromise = undefined;
    global._mongoDb = undefined;
    throw err;
  }
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
