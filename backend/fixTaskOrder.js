require("dotenv").config();
const mongoose = require("mongoose");
const Task = require("./models/Task"); // adjust path if needed

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/yourDB";

async function fixTaskOrder() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    const users = await Task.distinct("userId");

    for (const userId of users) {
      const tasks = await Task.find({ userId }).sort({ createdAt: 1 });
      for (let i = 0; i < tasks.length; i++) {
        tasks[i].order = i;
        await tasks[i].save();
      }
      console.log(`Fixed order for user ${userId}`);
    }

    console.log("All task orders fixed!");
    process.exit(0);
  } catch (err) {
    console.error("Error fixing task order:", err);
    process.exit(1);
  }
}

fixTaskOrder();
