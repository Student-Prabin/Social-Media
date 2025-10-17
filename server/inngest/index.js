import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import Story from "../models/Story.js";
import Message from "../models/Message.js";
import sendEmail from "../configs/nodeMailer.js";

// Create Inngest client
export const inngest = new Inngest({ id: "socialmedia-app" });

/** 1️⃣ Sync user creation */
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;
    let username = email_addresses[0].email_address.split("@")[0];

    // Check availability
    const existing = await User.findOne({ username });
    if (existing) username += Math.floor(Math.random() * 10000);

    await User.create({
      _id: id,
      email: email_addresses[0].email_address,
      full_name: `${first_name} ${last_name}`,
      profile_picture: image_url,
      username,
    });
  }
);

/*Sync user update */
const syncUserUpdation = inngest.createFunction(
  { id: "update-user-from-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;

    await User.findByIdAndUpdate(id, {
      email: email_addresses[0].email_address,
      full_name: `${first_name} ${last_name}`,
      profile_picture: image_url,
    });
  }
);

/* Sync user deletion */
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await User.findByIdAndDelete(event.data.id);
  }
);

/* Send connection request reminder */
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
    if (updated.status === "accepted") return;

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

/* Delete story after 24 hours */
const deleteStory = inngest.createFunction(
  { id: "story-delete" },
  { event: "app/story.delete" },
  async ({ event, step }) => {
    const { storyId } = event.data;
    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await step.sleepUntil("wait-for-24-hours", in24Hours);

    await Story.findByIdAndDelete(storyId);
  }
);

/* Send unseen messages notification */
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
