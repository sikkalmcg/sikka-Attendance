const { MongoClient, ServerApiVersion } = require('mongodb');

// Password ke @ ko %40 se encode kar diya hai
const uri = "mongodb+srv://sikkapanindia_db_user:Sikka%40lmc2105@cluster0.hfmiky2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    // Admin database ko ping karke connection check kar rahe hain
    await client.db("admin").command({ ping: 1 });
    console.log("🚀 Pinged your deployment. You successfully connected to MongoDB Cloud!");
  } finally {
    await client.close();
  }
}
run().catch(console.dir);