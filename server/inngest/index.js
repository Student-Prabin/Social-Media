import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import Story from "../models/Story.js";
import Message from "../models/Message.js";
import sendEmail from "../configs/nodeMailer.js";

// Create Inngest client
export const inngest = new Inngest({ id: "socialmedia-app" });

/* 1️⃣ Sync user creation - idempotent */
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;
    let username = email_addresses[0].email_address.split("@")[0];

    // Ensure username is unique
    const existingUserWithUsername = await User.findOne({ username });
    if (existingUserWithUsername && existingUserWithUsername._id.toString() !== id) {
      username += Math.floor(Math.random() * 10000);
    }

    // Upsert: create if not exists, do nothing if exists
    await User.updateOne(
      { _id: id },
      {
        $set: {
          _id: id,
          email: email_addresses[0].email_address,
          full_name: `${first_name} ${last_name}`,
          profile_picture: image_url,
          username,
        },
      },
      { upsert: true }
    );
  }
);

/* 2️⃣ Sync user update - idempotent */
export const syncUserUpdation = inngest.createFunction(
  { id: "update-user-from-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;

    if (!id) {
      console.warn("Skipped update: no user ID in event", event.data);
      return;
    }

    if (!email_addresses || !email_addresses[0]?.email_address) {
      console.warn(`Skipped update for user ${id}: no email address`);
      return;
    }

    const updateData = {
      email: email_addresses[0].email_address,
      full_name: `${first_name || ""} ${last_name || ""}`.trim(),
      profile_picture: image_url || "",
    };

    // Use upsert to ensure user exists
    const result = await User.updateOne({ _id: id }, { $set: updateData }, { upsert: true });

    if (result.upsertedCount > 0) {
      console.log(`User ${id} did not exist; created new user.`);
    } else if (result.matchedCount > 0) {
      console.log(`User ${id} updated successfully.`);
    } else {
      console.warn(`Update did not match any user: ${id}`);
    }
  }
);

/* 3️⃣ Sync user deletion - idempotent */
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    const { id } = event.data;
    await User.deleteOne({ _id: id }); // safe if user does not exist
  }
);

/* 4️⃣ Send connection request reminder */
const sendNewConnectionRequestReminder = inngest.createFunction(
  { id: "send-new-connection-request-reminder" },
  { event: "app/connection-request" },
  async ({ event, step }) => {
    const { connectionId } = event.data;
    const connection = await Connection.findById(connectionId).populate(
      "from_user_id to_user_id"
    );
    if (!connection) return;

    // Send initial email
    await sendEmail({
      to: connection.to_user_id.email,
      subject: "👋 New Connection Request",
      body: `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2>Hi ${connection.to_user_id.full_name},</h2>
          <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p>
          <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color:#10b981;">here</a> to accept or reject</p>
        </div>
      `,
    });

    // Wait 24 hours and send reminder if still pending
    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await step.sleepUntil("wait-for-24-hours", in24Hours);

    const updated = await Connection.findById(connectionId).populate(
      "from_user_id to_user_id"
    );
    if (!updated || updated.status === "accepted") return;

    await sendEmail({
      to: updated.to_user_id.email,
      subject: "👋 Reminder: Connection Request Pending",
      body: `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2>Hi ${updated.to_user_id.full_name},</h2>
          <p>This is a reminder you still have a pending connection request from ${updated.from_user_id.full_name} - @${updated.from_user_id.username}</p>
          <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color:#10b981;">here</a> to accept or reject</p>
        </div>
      `,
    });
  }
);

/* 5️⃣ Delete story after 24 hours */
const deleteStory = inngest.createFunction(
  { id: "story-delete" },
  { event: "app/story.delete" },
  async ({ event, step }) => {
    const { storyId } = event.data;
    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await step.sleepUntil("wait-for-24-hours", in24Hours);

    await Story.deleteOne({ _id: storyId }); // safe if story already deleted
  }
);

/* 6️⃣ Send unseen messages notification */
const sendNotificationOfUnseenMessages = inngest.createFunction(
  { id: "send-unseen-messages-notification" },
  { cron: "TZ=America/New_York 0 9 * * *" }, // every day at 9 AM
  async () => {
    const messages = await Message.find({ seen: false }).populate("to_user_id");
    const unseenCount = {};

    messages.forEach((msg) => {
      unseenCount[msg.to_user_id._id] = (unseenCount[msg.to_user_id._id] || 0) + 1;
    });

    for (const userId in unseenCount) {
      const user = await User.findById(userId);
      if (!user) continue;

      const subject = `You have ${unseenCount[userId]} unseen messages`;
      const body = `
        <div style="font-family:Arial,sans-serif;padding:20px">
          <h2>Hi ${user.full_name}</h2>
          <p>You have ${unseenCount[userId]} unseen messages</p>
          <p>Click <a href="${process.env.FRONTEND_URL}/messages" style="color:#10b981">here</a> to view</p>
        </div>
      `;

      await sendEmail({ to: user.email, subject, body });
    }
  }
);

export const functions = [
  syncUserCreation,
  syncUserUpdation,
  syncUserDeletion,
  sendNewConnectionRequestReminder,
  deleteStory,
  sendNotificationOfUnseenMessages,
];
