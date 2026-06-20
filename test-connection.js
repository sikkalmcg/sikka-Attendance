const { MongoClient, ServerApiVersion } = require('mongodb');

// Humne 'replicaSet' parameter hata diya hai taaki koi mismatch na ho
const uri = "mongodb://sikkapanindia_db_user:Sikkalmc2105@ac-ngps0di-shard-00-00.hfmiky2.mongodb.net:27017,ac-ngps0di-shard-00-01.hfmiky2.mongodb.net:27017,ac-ngps0di-shard-00-02.hfmiky2.mongodb.net:27017/?ssl=true&authSource=admin";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Connection failed:", error);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);