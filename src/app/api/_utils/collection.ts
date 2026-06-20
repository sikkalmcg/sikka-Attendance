import { getCollection } from '@/lib/mongodb';

export async function listCollection<T = any>(collectionName: string): Promise<(T & { id: string })[]> {
  const col = await getCollection<any>(collectionName);
  const docs = await col.find({}).toArray();
  return docs.map((d) => ({
    ...(d as T),
    id: String(d._id),
  }));
}

export async function findOneById<T = any>(collectionName: string, id: string): Promise<(T & { id: string }) | null> {
  const col = await getCollection<any>(collectionName);
  const doc = await col.findOne({ _id: id });
  if (!doc) return null;
  return { ...(doc as T), id: String((doc as any)._id) };
}

