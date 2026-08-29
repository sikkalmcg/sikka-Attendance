import { MongoClient, type Db, type Collection, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
const dbName = (process.env.MONGODB_DB as string) || 'sikka_database';

if (!uri) {
  throw new Error('Missing environment variable: MONGODB_URI');
}

let cachedClient: MongoClient | null = (global as any)._mongoClient || null;
let cachedDb: Db | null = (global as any)._mongoDb || null;

export async function getClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 25,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    connectTimeoutMS: 10000,
  });

  await client.connect();
  cachedClient = client;
  (global as any)._mongoClient = client;
  return client;
}

export async function getDb(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }
  const client = await getClient();
  cachedDb = client.db(dbName);
  (global as any)._mongoDb = cachedDb;
  return cachedDb;
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
