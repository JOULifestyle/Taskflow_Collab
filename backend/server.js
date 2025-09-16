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
  try {
    const now = new Date();

    const tasks = await Task.find({
      repeat: { $ne: null },
      due: { $lte: now },
    });

    console.log("Found", tasks.length, "tasks to update");

    if (tasks.length > 0) {
      const subs = await Subscription.find(); // get all user subscriptions

      for (const t of tasks) {
        const nextDue = getNextDueDate(t.due, t.repeat);

        await Task.findByIdAndUpdate(t._id, {
          lastCompletedAt: t.completed ? now : t.lastCompletedAt,
          due: nextDue,
          completed: false,
        });

        console.log(`♻️ Updated: ${t.text} → next due ${nextDue}`);

        // Send notification
        const payload = JSON.stringify({
          title: "Task Reminder",
          body: `It's time for: ${t.text}`,
        });

        for (const s of subs) {
          try {
            await webpush.sendNotification(s, payload);
          } catch (err) {
            console.error("Push error:", err);
          }
        }
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
