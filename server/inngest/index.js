import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connection.js";
import Story from "../models/Story.js";
import Message from "../models/Message.js";
import sendEmail from "../configs/nodeMailer.js";

// Create Inngest client
export const inngest = new Inngest({ id: "socialmedia-app" });

/* Inngest functio to save user data to db*/
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;
    let username = email_addresses[0].email_address.split("@")[0];

    // Check if username is available
    const user = await User.findOne({ username });

    if (user) {
      username += Math.floor(Math.random() * 10000);
    }

    const userData = {
      _id: id,
      email: email_addresses[0].email_address,
      full_name: `${first_name} ${last_name}`,
      profile_picture: image_url,
      username,
    }
    await User.create(userData);
  }
);

/*Ingest function to update the userData in db */
export const syncUserUpdation = inngest.createFunction(
  { id: "update-user-from-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const { id, first_name, last_name, email_addresses, image_url } = event.data;


    const updatedUserData = {
      email: email_addresses[0].email_address,
      full_name: `${first_name} ${last_name}`,
      profile_picture: image_url,
    };

    await User.findByIdAndUpdate(id, updatedUserData);
  }
);

/* Sync user deletion*/
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    const { id } = event.data;
    await User.findByIdAndDelete(id);
  }
);

/* Send connection request reminder */
const sendNewConnectionRequestReminder = inngest.createFunction(
  { id: "send-new-connection-request-reminder" },
  { event: "app/connection-request" },
  async ({ event, step }) => {
    const { connectionId } = event.data;
    await step.run('send-connection-request-mail', async () => {
      const connection = await Connection.findById(connectionId).populate("from_user_id to_user_id");

      const subject = "👋 New Connection Request";
      const body = `<div style="font-family:Arial,sans-serif;padding:20px;">
          <h2>Hi ${connection.to_user_id.full_name},</h2>
          <p>You have a new connection request from ${connection.from_user_id.full_name} - @${connection.from_user_id.username}</p>
          <p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color:#10b981;">here</a> to accept or reject</p>
        </div>`;

      await sendEmail({
        to: connection.to_user_id.email,
        subject,
        body
      })
    })


    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await step.sleepUntil("wait-for-24-hours", in24Hours);
    await step.run('send-connection-request-reminder', async () => {
      const connection = await Connection.findById(connectionId).populate("from_user_id to_user_id");

      if (!updated || updated.status === "accepted") {
        return { message: "already accepted" };
      }

      const subject = "👋 Reminder: Connection Request Pending";
      const body = `<div style="font-family:Arial,sans-serif;         padding:20px;"><h2>Hi ${updated.to_user_id.full_name},</h2><p>This is a reminder you still have a pending connection request from ${updated.from_user_id.full_name} - @${updated.from_user_id.username}</p><p>Click <a href="${process.env.FRONTEND_URL}/connections" style="color:#10b981;">here</a> to accept or reject</p></div>`

      await sendEmail({
        to: connection.to_user_id.email,
        subject,
        body
      });
    });
  }
);

// Delete story after 24 hours
const deleteStory = inngest.createFunction(
  { id: "story-delete" },
  { event: "app/story-delete" },
  async ({ event, step }) => {
    const { storyId } = event.data;
    const in24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await step.sleepUntil("wait-for-24-hours", in24Hours);

    await step.run("delete-story", async () => {
      await Story.findByIdAndDelete(storyId);
      return { message: "story deleted" }
    });

  }
);

/*Send unseen messages notification */
const sendNotificationOfUnseenMessages = inngest.createFunction(
  { id: "send-unseen-messages-notification" },
  { cron: "TZ=America/New_York 0 9 * * *" }, // every day at 9 AM
  async () => {
    const messages = await Message.find({ seen: false }).populate("to_user_id");
    const unseenCount = {};

    messages.map(message => {
      unseenCount[message.to_user_id._id] = (unseenCount[message.to_user_id._id] || 0) + 1;
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

      await sendEmail({
        to: user.email,
        subject,
        body
      });
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
