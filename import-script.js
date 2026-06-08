const { MongoClient } = require('mongodb');
const fs = require('fs');

// Srv string ke sath connectTimeoutMS add kiya hai taaki slow network par fail na ho
const url = "mongodb+srv://sikkapanindia_db_user:Sikkalmc2105@cluster0.hfmiky2.mongodb.net/";
const dbName = "sikka_database"; // Yeh aapke local machine par is naam ka database bana dega

// Baki ka insert wala code niche bilkul same rahega...


async function importToMongo() {
  const client = new MongoClient(url);
  
  try {
    await client.connect();
    console.log('🔌 Connected successfully to MongoDB server');
    const db = client.db(dbName);

    // 2. backup.json file ko read kar rahe hain
    if (!fs.existsSync('backup.json')) {
      console.error("❌ Error: 'backup.json' file nahi mili! Pehle export script run karein.");
      return;
    }
    const rawData = fs.readFileSync('backup.json', 'utf8');
    const backupData = JSON.parse(rawData);

    console.log("🚀 MongoDB Import Started...");

    // 3. Har ek Firestore collection ko loop karke MongoDB mein daal rahe hain
    for (const collectionName in backupData) {
      const documentsObj = backupData[collectionName];
      const documentsArray = [];

      // Firestore ke key-value pair object ko array format mein convert kar rahe hain
      for (const docId in documentsObj) {
        documentsArray.push({
          _id: docId, // Firestore ki Document ID ko MongoDB ki primary key (_id) bana diya
          ...documentsObj[docId]
        });
      }

      // Agar us collection mein data hai toh MongoDB mein insert karein
      if (documentsArray.length > 0) {
        console.log(`📥 Importing ${documentsArray.length} documents into MongoDB collection: ${collectionName}`);
        
        // Data insert karne se pehle agar purana data clear karna ho toh deleteMany() use kar sakte hain
        await db.collection(collectionName).insertMany(documentsArray);
      }
    }

    console.log('✅ Success! Saara data MongoDB database mein sahi se import ho gaya hai.');

  } catch (error) {
    console.error('❌ Import ke dauran error aaya:', error);
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed.');
  }
}

importToMongo();