const { MongoClient } = require('mongodb');
const fs = require('fs');

// 👇 UPDATED: Is direct URL se aapke internet ka DNS/SRV block bypass ho jayega
const uri = "mongodb+srv://sikkapanindia_db_user:Sikkalmc2105@cluster0.hfmiky2.mongodb.net/";
const dbName = "sikka_database";

async function runImport() {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
  });

  try {
    await client.connect();
    console.log("🔌 Connected to MongoDB Cloud (Atlas Cluster) successfully!");
    const db = client.db(dbName);

    // backup.json file ko read karein
    if (!fs.existsSync('./backup.json')) {
      console.error("❌ Error: './backup.json' file nahi mili!");
      return;
    }
    const backupData = JSON.parse(fs.readFileSync('./backup.json', 'utf8'));

    for (const collectionName of Object.keys(backupData)) {
      const collectionData = backupData[collectionName];
      const collection = db.collection(collectionName);

      // Firebase Data (Objects) ko MongoDB format (Array) mein convert karein
      const docsToInsert = Object.keys(collectionData).map(key => {
        const doc = collectionData[key];
        return {
          _id: key, 
          ...doc
        };
      });

      if (docsToInsert.length > 0) {
        console.log(`📥 Inserting ${docsToInsert.length} records into '${collectionName}'...`);
        
        // Bulk write/upsert use kar rahe hain
        const operations = docsToInsert.map(doc => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: doc },
            upsert: true 
          }
        }));

        await collection.bulkWrite(operations);
        console.log(`✅ Successfully imported '${collectionName}'!`);
      }
    }
    console.log("\n🚀 BOOM! All data successfully migrated to MongoDB Atlas Cloud Cluster!");
  } catch (err) {
    console.error("❌ Error during import:", err);
  } finally {
    await client.close();
    console.log("🔌 MongoDB connection closed.");
  }
}

runImport();