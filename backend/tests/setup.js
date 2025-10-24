process.env.NODE_ENV = 'test';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let mongoServer;

// Define a permanent cache directory to prevent re-downloading of MongoDB binaries
const cacheDir = path.resolve(__dirname, '../.cache/mongo-binaries');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`📁 Created MongoDB binary cache directory at: ${cacheDir}`);
} else {
  console.log(`📦 Using existing MongoDB binary cache at: ${cacheDir}`);
}

// Setup before running tests
beforeAll(async () => {
  

  try {
    
    mongoServer = await MongoMemoryServer.create({
      instance: { dbName: 'testdb' },
      binary: {
        version: '7.0.3',      // 
        skipMD5: true,        // 
        downloadDir: cacheDir // 
      },
    });
   

    const mongoUri = mongoServer.getUri();
    

    //  Override real environment values to ensure isolation
    process.env.MONGO_URI = mongoUri;
    process.env.JWT_SECRET = 'test-secret';
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';

    
    // Connect once using recommended Mongoose config
    await mongoose.connect(mongoUri, {
      dbName: 'testdb',
      // useNewUrlParser: true,  // <-- not needed on latest Mongoose
      // useUnifiedTopology: true,
    });
    console.log('🔗 mongoose.connect completed.');

    console.log('✅ MongoMemoryServer ready & connected (cached)');
  } catch (error) {
    console.error('❌ MongoMemoryServer setup error:', error);
    throw error;
  }
}, 120000); //  Extended timeout for debugging

//  Cleanup database between each test (ensures isolation)
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    try {
      await collections[key].deleteMany({});
    } catch (err) {
      console.warn(`⚠️ Skipped cleanup for collection: ${key}`);
    }
  }
});

//  Full cleanup after all tests finish
afterAll(async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('🧹 MongoMemoryServer instance stopped & cleaned up.');
  } catch (err) {
    console.error('⚠️ Error during teardown:', err);
  }
});
