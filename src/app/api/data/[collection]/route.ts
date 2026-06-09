import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// 1. GET HANDLER: Saari collections ka data read karne ke liye
export async function GET(
  req: Request,
  { params }: { params: { collection: string } }
) {
  try {
    const { collection } = params;
    const db = await getDb();
    
    const data = await db.collection(collection).find({}).toArray();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`GET Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

// 2. POST HANDLER: Naya data insert karne ke liye
export async function POST(
  req: Request,
  { params }: { params: { collection: string } }
) {
  try {
    const { collection } = params;
    const body = await req.json();
    const db = await getDb();

    const result = await db.collection(collection).insertOne(body);
    return NextResponse.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error(`POST Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to insert data" }, { status: 500 });
  }
}

// 3. PUT HANDLER: YAHI MISSING THA JISSE 405 AA RAHA THA!
export async function PUT(
  req: Request,
  { params }: { params: { collection: string } }
) {
  try {
    const { collection } = params;
    
    // URL se ?id=JZvVOQ8R3... nikalne ke liye
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
    }

    const body = await req.json();
    const db = await getDb();

    // MongoDB ke IDs ke formats (_id as string vs ObjectId) ko match karne ke liye safe query
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = {
        $or: [
          { _id: id },
          { _id: new ObjectId(id) },
          { id: id }
        ]
      };
    }

    // Body se internal _id ya id remove karenge taaki Mongo schema structural crash na ho
    const updateData = { ...body };
    delete updateData._id;
    delete updateData.id;

    const result = await db.collection(collection).updateOne(
      query,
      { $set: updateData }
    );

    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error(`PUT Error in collection ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to update data" }, { status: 500 });
  }
}

// 4. DELETE HANDLER: Record delete karne ke liye
export async function DELETE(
  req: Request,
  { params }: { params: { collection: string } }
) {
  try {
    const { collection } = params;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
    }

    const db = await getDb();
    let query: any = { _id: id };
    if (ObjectId.isValid(id)) {
      query = { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
    }

    await db.collection(collection).deleteOne(query);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE Error in ${params.collection}:`, error);
    return NextResponse.json({ error: "Failed to delete data" }, { status: 500 });
  }
}