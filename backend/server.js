require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");
const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const Task = require("./models/Task");
const webpush = require("web-push");
const subscriptionRoutes = require("./routes/subscriptions");
const Subscription = require("./models/Subscription");
const vapidRoutes = require("./routes/vapid");
const NotificationLog = require("./models/NotificationLog");


const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/tasks", taskRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/vapid", vapidRoutes);

webpush.setVapidDetails(
  "mailto:youremail@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);



// Helper: calculate next due date
function getNextDueDate(current, repeat) {
  const d = new Date(current);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  if (repeat === "weekly") d.setDate(d.getDate() + 7);
  if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  return d;
}

// CRON job: run every minute
cron.schedule("* * * * *", async () => {
  console.log("⏰ Cron running every minute...");
  const now = new Date();

  try {
    // --- Notifications ---
    const tasks = await Task.find({ due: { $ne: null }, completed: false });
console.log("Found tasks:", tasks.length);

for (const t of tasks) {
  const diffMin = Math.floor((new Date(t.due) - now) / 60000);
  console.log(`Task ${t.text}: diffMin = ${diffMin}, due = ${t.due}`);

  let stage = null;
  if (diffMin === 15) stage = "15min";
  else if (diffMin === 5) stage = "5min";
  else if (diffMin === 0) stage = "0min";

  if (!stage) continue;

  // Atomically check + insert
  const log = await NotificationLog.findOneAndUpdate(
    { taskId: t._id, stage },
    { $setOnInsert: { sentAt: new Date() } },
    { upsert: true, new: false } // new:false = return old doc if exists
  );

  // If log already existed, skip (notification already sent)
  if (log) continue;

  // Otherwise, send notification
  const subs = await Subscription.find({ userId: t.userId });
  console.log("Subs found for", t.userId, subs.length);

  const payload = JSON.stringify({
    title: "Task Reminder",
    body:
      stage === "0min"
        ? `⏰ ${t.text} is due now`
        : `⏳ ${t.text} is due in ${diffMin} minutes`,
  });

  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, payload);
      console.log("Notification sent to", s.userId);
    } catch (err) {
      console.error("Push error:", err.statusCode || err.message);
    }
  }
}

    // --- Recurring tasks ---
    const recurring = await Task.find({ repeat: { $ne: null } });
    console.log("Recurring tasks found:", recurring.length);

    for (const r of recurring) {
      const dueTime = new Date(r.due);

      if (r.completed === true || dueTime < now) {
        const newDue = getNextDueDate(r.due, r.repeat);
        r.due = newDue;
        r.completed = false;

        await r.save();

        console.log(
          `⟳ Recurring task "${r.text}" moved to next due: ${newDue}`
        );
      }
    }
  } catch (err) {
    console.error("Cron job error:", err);
  }
});





// DB connect and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error(err));
