// server/resyncClerkUsers.js
import 'dotenv/config'; // Load .env variables
import mongoose from "mongoose";
import User from "./models/User.js";
import { inngest } from "./inngest/index.js";

async function main() {
  // 1️⃣ Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }

  // 2️⃣ Fetch all users from your DB
  const users = await User.find();
  console.log(`Fetched ${users.length} users from MongoDB`);

  // 3️⃣ Trigger Inngest function for each user
  for (const u of users) {
    try {
      await inngest.runFunction("sync-user-from-clerk", {
        event: {
          data: {
            id: u._id,
            first_name: u.full_name.split(" ")[0] || "",
            last_name: u.full_name.split(" ").slice(1).join(" ") || "",
            email_addresses: [{ email_address: u.email }],
            image_url: u.profile_picture || "",
          },
        },
      });

      console.log(`✅ Triggered Inngest for user: ${u._id}`);
    } catch (err) {
      console.error(`❌ Failed to trigger Inngest for user ${u._id}:`, err);
    }
  }

  console.log("🎉 All users processed");
  process.exit(0);
}

main();
