import { MongoClient, type Db, type Collection, ObjectId } from 'mongodb';
import dns from 'dns';

// Prefer IPv4 addresses for DNS resolution — Atlas TLS connects in ~9s via IPv4
// vs 45s+ via IPv6 link-local on this network. setDefaultResultOrder only changes
// result preference, NOT the DNS server used (safe, unlike setServers).
try { dns.setDefaultResultOrder('ipv4first'); } catch {}

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

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

function createClient(): MongoClient {
  return new MongoClient(uri, {
    maxPoolSize: 25,
    minPoolSize: 2,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    tls: true,
    family: 4,
  });
}

export async function getClient(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      const cli = createClient();
      global._mongoClientPromise = cli.connect().catch((err) => {
        global._mongoClientPromise = undefined;
        throw err;
      });
    }
    const cli = await global._mongoClientPromise;
    if (!cli) {
      global._mongoClientPromise = undefined;
      throw new Error('MongoClient is undefined');
    }
    return cli;
  }

  if (!clientPromise) {
    const cli = createClient();
    clientPromise = cli.connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  const cli = await clientPromise;
  if (!cli) {
    clientPromise = null;
    throw new Error('MongoClient is undefined');
  }
  return cli;
}

async function ensureIndexes(db: Db) {
  if (global._indexesCreated) return;
  global._indexesCreated = true;
  try {
    db.collection('attendance').createIndex({ date: -1, employeeId: 1 }, { background: true }).catch(() => {});
    db.collection('attendance').createIndex({ employeeId: 1, date: -1 }, { background: true }).catch(() => {});
    db.collection('attendance').createIndex({ status: 1, date: -1 }, { background: true }).catch(() => {});
    db.collection('attendance').createIndex({ approved: 1, date: -1 }, { background: true }).catch(() => {});
    db.collection('attendance').createIndex({ inPlant: 1, date: -1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ employeeId: 1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ active: 1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ aadhaarNumber: 1 }, { background: true }).catch(() => {});
    db.collection('employees').createIndex({ mobileNumber: 1 }, { background: true }).catch(() => {});
    db.collection('leaveRequests').createIndex({ employeeId: 1, status: 1 }, { background: true }).catch(() => {});
    db.collection('leaveRequests').createIndex({ status: 1, fromDate: -1 }, { background: true }).catch(() => {});
    db.collection('notifications').createIndex({ employeeId: 1, createdAt: -1 }, { background: true }).catch(() => {});
    db.collection('notifications').createIndex({ createdAt: -1 }, { background: true }).catch(() => {});
    db.collection('plants').createIndex({ active: 1 }, { background: true }).catch(() => {});
  } catch {}
}

export async function getDb(): Promise<Db> {
  try {
    if (global._mongoDb) {
      return global._mongoDb;
    }
    const cli = await getClient();
    const db = cli.db(dbName);
    global._mongoDb = db;
    ensureIndexes(db);
    return db;
  } catch (err) {
    global._mongoClientPromise = undefined;
    global._mongoDb = undefined;
    clientPromise = null;
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
