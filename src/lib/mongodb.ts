import { MongoClient, type Db, type Collection, ObjectId } from 'mongodb';

let clientPromise: Promise<MongoClient> | undefined;

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI as string;
  if (!uri) {
    throw new Error('Missing environment variable: MONGODB_URI');
  }
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      // helps in serverless/next usage
      maxPoolSize: 10,
    });
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const dbName = process.env.MONGODB_DB as string;
  if (!dbName) {
    throw new Error('Missing environment variable: MONGODB_DB');
  }
  const client = await getClient();
  return client.db(dbName);
}



export async function getCollection<TSchema extends Record<string, any> = Record<string, any>>(collectionName: string): Promise<Collection<TSchema>> {
  const db = await getDb();
  return db.collection<TSchema>(collectionName);
}


export function toObjectId(id: string): ObjectId {
  if (!id) throw new Error('Missing id');
  return new ObjectId(id);
}
