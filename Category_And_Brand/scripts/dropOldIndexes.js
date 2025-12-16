/**
 * Script to drop old unique indexes from the brands collection
 * Run this once to clean up old indexes that might be causing conflicts
 * 
 * Usage: node Category_And_Brand/scripts/dropOldIndexes.js
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/multi_vendor';

async function dropOldIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('brands');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    // Drop indexes that might cause conflicts
    const indexesToDrop = [
      'name_1', // Old unique index on name field
      'name_1_categoryId_1', // Old compound unique index
      'brandName_1', // If there's a unique index on brandName alone
    ];

    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✓ Dropped index: ${indexName}`);
      } catch (err) {
        if (err.code === 27) {
          console.log(`- Index ${indexName} does not exist, skipping...`);
        } else {
          console.log(`✗ Error dropping ${indexName}:`, err.message);
        }
      }
    }

    // List remaining indexes
    const remainingIndexes = await collection.indexes();
    console.log('\nRemaining indexes:', remainingIndexes);

    console.log('\n✓ Index cleanup complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

dropOldIndexes();

