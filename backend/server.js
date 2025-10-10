require("dotenv").config();
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cron = require("node-cron");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const webpush = require("web-push");

// Routes
const authRoutes = require("./routes/auth");
const subscriptionRoutes = require("./routes/subscriptions");
const vapidRoutes = require("./routes/vapid");
const listRoutes = require("./routes/lists");
const listTasksRoutes = require("./routes/listTasks");

// Models
const Task = require("./models/Task");
const List = require("./models/List");
const Subscription = require("./models/Subscription");
const NotificationLog = require("./models/NotificationLog");

// Socket handlers
const registerTaskHandlers = require("./sockets/tasks");

const app = express();
const server = http.createServer(app);

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- REST Routes ---
app.use("/auth", authRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/vapid", vapidRoutes);
app.use("/lists", listRoutes);
app.use("/lists/:listId/tasks", listTasksRoutes);

// --- Web Push ---
webpush.setVapidDetails(
  "mailto:youremail@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Note: WNS credentials would be needed for native Windows apps,
// but for PWAs, FCM works on all Chromium-based browsers including Edge
console.log("🔑 VAPID keys configured for FCM push notifications");

// --- Socket.IO ---
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] } });
app.set("io", io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Unauthorized"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.id;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(`⚡ User connected: ${socket.userId}`);
  // Join user-specific room
  socket.join(socket.userId);
  registerTaskHandlers(io, socket);
});

// --- Helper: calculate next due date ---
function getNextDueDate(current, repeat) {
  const d = new Date(current);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  if (repeat === "weekly") d.setDate(d.getDate() + 7);
  if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  return d;
}

// --- CRON job ---
cron.schedule("* * * * *", async () => {
  console.log("⏰ Cron running every minute...");
  const now = new Date();

  try {
    // --- Notifications ---
    const tasks = await Task.find({ due: { $ne: null }, completed: false });
    console.log("Found tasks:", tasks.length);

    for (const t of tasks) {
      const diffMin = Math.floor((new Date(t.due) - now) / 60000);
      console.log(`Task "${t.text}" diffMin = ${diffMin}, due = ${t.due}, now = ${now}`);

      let stage = null;
      if (diffMin === 15) stage = "15min";
      else if (diffMin === 5) stage = "5min";
      else if (diffMin === 0) stage = "0min";

      if (!stage) continue;
      console.log(`➡️ Stage hit: ${stage} for task ${t._id}`);

      const log = await NotificationLog.findOneAndUpdate(
        { taskId: t._id, stage, due: t.due },
        { $setOnInsert: { sentAt: new Date() } },
        { upsert: true, new: false }
      );
      if (log) {
    console.log(`⚠️ Already sent before for stage=${stage}, task=${t._id}`);
    continue;
  }

      // Get the list to find all members
      const list = await List.findById(t.listId);
      if (!list) {
        console.log(`⚠️ List not found for task ${t._id}, skipping notification`);
        continue;
      }

      // Get all member user IDs (including the owner)
      const memberIds = [list.owner, ...list.members.map(m => m.userId)];

      // Send WebSocket notifications to all members
      memberIds.forEach(memberId => {
        io.to(memberId.toString()).emit("task:reminder", {
          task: t,
          stage,
          diffMin,
          message: stage === "0min"
            ? `⏰ ${t.text} is due now`
            : `⏳ ${t.text} is due in ${diffMin} minutes`
        });
      });

      // Send push notifications to all members
      const subs = await Subscription.find({ userId: { $in: memberIds } });
      console.log(`📢 Found ${subs.length} subscriptions for ${memberIds.length} list members`);
      const payload = JSON.stringify({
        title: "Task Reminder",
        body:
          stage === "0min"
            ? `⏰ ${t.text} is due now`
            : `⏳ ${t.text} is due in ${diffMin} minutes`,
      });

      for (const s of subs) {
        try {
          const endpoint = s.subscription.endpoint || "";
          const isFCM = endpoint.includes('fcm.googleapis.com');
          const isWNS = endpoint.includes('notify.windows.com');
          console.log(`📤 Sending reminder to ${s.userId} via ${isFCM ? 'FCM' : isWNS ? 'WNS' : 'Unknown'}: ${endpoint}`);

          await webpush.sendNotification(s.subscription, payload);
          console.log("✅ Reminder sent to", s.userId);
        } catch (err) {
          console.error(`❌ Push error for ${s.userId}:`, err.statusCode || err.message, err.body || '');
        }
      }
    }

    // --- Recurring tasks ---
    const recurring = await Task.find({ repeat: { $ne: null } });
    for (const r of recurring) {
      const dueTime = new Date(r.due);
      if (r.completed === true || dueTime < now) {
        const newDue = getNextDueDate(r.due, r.repeat);
        r.due = newDue;
        r.completed = false;
        await r.save();
        console.log(`⟳ Recurring task "${r.text}" moved to next due: ${newDue}`);
        // 🔥 Emit socket update to the task owner
    io.to(r.userId.toString()).emit("task:updated", r);
      }
    }
  } catch (err) {
    console.error("Cron job error:", err);
  }
});

// --- DB + Start Server ---
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch((err) => console.error(err));
