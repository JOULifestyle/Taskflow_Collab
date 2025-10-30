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
const inviteRoutes = require("./routes/invites");
const tasksRoutes = require("./routes/tasks");

// Models
const Task = require("./models/Task");
const List = require("./models/List");
const Subscription = require("./models/Subscription");
const NotificationLog = require("./models/NotificationLog");

// Socket handlers
const registerTaskHandlers = require("./sockets/tasks");

const app = express();
const server = http.createServer(app);

// Export app for testing
module.exports = app;

// Middleware 
app.use(cors());
app.use(express.json());

// REST Routes
app.use("/auth", authRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/vapid", vapidRoutes);
app.use("/lists", listRoutes);
app.use("/lists/:listId/tasks", listTasksRoutes);
app.use("/invites", inviteRoutes);
app.use("/tasks", tasksRoutes);

// Web Push
if (process.env.NODE_ENV !== "test") {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    // Fix for iOS Safari: Use proper domain instead of localhost/example.com
    const vapidSubject = process.env.VAPID_SUBJECT || (process.env.NODE_ENV === 'production'
      ? `https://${process.env.DOMAIN || 'yourdomain.com'}`
      : 'mailto:admin@localhost');
    
    webpush.setVapidDetails(
      vapidSubject,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    
    console.log("✅ WebPush configured with VAPID subject:", vapidSubject);
  } else {
    console.warn("⚠️ VAPID keys missing, push will not work");
  }
} else {
  console.log(" Test Mode: Skipping WebPush setup");
}

//  Socket.IO (Skip in test mode) 
let io = null;
if (process.env.NODE_ENV !== "test") {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
  });
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
    
    socket.join(socket.userId);
    registerTaskHandlers(io, socket);
  });
} else {
  console.log(" Test Mode: Skipping Socket.IO");
}

//  Helper: calculate next due date 
function getNextDueDate(current, repeat) {
  const d = new Date(current);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  if (repeat === "weekly") d.setDate(d.getDate() + 7);
  if (repeat === "monthly") d.setMonth(d.getMonth() + 1);
  return d;
}

//  CRON job 
if (process.env.NODE_ENV !== "test") {
  cron.schedule("* * * * *", async () => {
    console.log("⏰ Cron running every minute...");
    const now = new Date();

    try {
      //  Notifications
      const tasks = await Task.find({ due: { $ne: null }, completed: false });
      console.log("Found tasks:", tasks.length);

      for (const t of tasks) {
        const diffMin = Math.floor((new Date(t.due) - now) / 60000);
        console.log(
          `Task "${t.text}" diffMin = ${diffMin}, due = ${t.due}, now = ${now}`
        );

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
          console.log(
            `⚠️ Already sent before for stage=${stage}, task=${t._id}`
          );
          continue;
        }

        // Get list & members
        const list = await List.findById(t.listId);
        if (!list) {
          console.log(
            `⚠️ List not found for task ${t._id}, skipping notification`
          );
          continue;
        }

        const memberIds = [list.owner, ...list.members.map((m) => m.userId)];

        // WebSocket notification
        memberIds.forEach((memberId) => {
          io.to(memberId.toString()).emit("task:reminder", {
            task: t,
            stage,
            diffMin,
            message:
              stage === "0min"
                ? `⏰ ${t.text} is due now`
                : `⏳ ${t.text} is due in ${diffMin} minutes`,
          });
        });

        // Push Notifications
        const subs = await Subscription.find({
          userId: { $in: memberIds },
        });

        console.log(
          `📢 Found ${subs.length} subscriptions for ${memberIds.length} list members`
        );

        // Create base payload
        const basePayload = {
          title: "Task Reminder",
          body:
            stage === "0min"
              ? `⏰ ${t.text} is due now`
              : `⏳ ${t.text} is due in ${diffMin} minutes`,
          icon: "/logo192.png",
          badge: "/logo192.png",
          data: {
            url: "/",
            taskId: t._id.toString(),
            type: "reminder",
            stage,
          },
        };

        for (const s of subs) {
          try {
            const endpoint = s.subscription.endpoint || "";
            const isFCM = endpoint.includes("fcm.googleapis.com");
            const isWNS = endpoint.includes("notify.windows.com");
            const isSafari = endpoint.includes("webkit");
            const browserType = isFCM
              ? "Chrome/Edge/Firefox"
              : isWNS
              ? "Edge (WNS)"
              : isSafari
              ? "Safari"
              : "Unknown";

            if (isWNS) {
              console.log(
                `ℹ️ WNS endpoint detected (Edge on Windows): ${endpoint.substring(
                  0,
                  50
                )}...`
              );
            }

            let payload;
            if (isFCM || isWNS) {
              payload = JSON.stringify({
                ...basePayload,
                actions:
                  stage === "0min"
                    ? [
                        { action: "view", title: "View Task" },
                        { action: "snooze", title: "Snooze 5min" },
                      ]
                    : [{ action: "view", title: "View Task" }],
                requireInteraction: stage === "0min",
                silent: false,
              });
            } else if (isSafari) {
              payload = JSON.stringify({
                ...basePayload,
                actions: undefined,
                requireInteraction: undefined,
                badge: undefined,
              });
            } else {
              payload = JSON.stringify(basePayload);
            }

            let attempts = 0;
            const maxAttempts = 3;
            let lastError;
            let finalError = null;

            while (attempts < maxAttempts) {
              try {
                await webpush.sendNotification(s.subscription, payload);
                console.log(
                  `✅ Reminder sent successfully to ${s.userId} (${browserType}) (attempt ${
                    attempts + 1
                  })`
                );
                break;
              } catch (err) {
                attempts++;
                lastError = err;
                finalError = err;
                
                // Log specific errors for iOS debugging
                if (err.statusCode === 401 || err.statusCode === 403) {
                  console.error(`🚨 VAPID Authentication Error for ${browserType}:`, {
                    statusCode: err.statusCode,
                    message: err.message,
                    endpoint: s.subscription.endpoint?.substring(0, 100) + '...'
                  });
                } else if (err.statusCode === 404 || err.statusCode === 410) {
                  console.error(`🚨 Subscription expired for ${browserType}, cleaning up...`);
                  // Clean up expired subscription
                  await Subscription.findOneAndDelete({
                    userId: s.userId,
                    "subscription.endpoint": s.subscription.endpoint
                  });
                  break; // Don't retry expired subscriptions
                }
                
                if (attempts < maxAttempts) {
                  const delay = Math.min(
                    1000 * Math.pow(2, attempts - 1),
                    5000
                  );
                  console.log(
                    `⏳ Retry ${attempts}/${maxAttempts} for ${s.userId} (${browserType}) in ${delay}ms`
                  );
                  await new Promise((resolve) =>
                    setTimeout(resolve, delay)
                  );
                }
              }
            }

            if (attempts >= maxAttempts) {
              console.error(`❌ Failed to send notification after ${maxAttempts} attempts:`, finalError?.message);
              
              // For iOS Safari specific issues, try cleanup
              if (finalError?.statusCode === 401 && s.browserType === 'Safari') {
                console.log('🧹 Cleaning up potentially invalid Safari subscription...');
                await Subscription.findOneAndDelete({
                  userId: s.userId,
                  "subscription.endpoint": s.subscription.endpoint
                });
              }
            }
          } catch (err) {
            console.error(
              `❌ Push error for ${s.userId}:`,
              err.message || err
            );
          }
        }
      }

      // Recurring tasks 
      const recurring = await Task.find({ repeat: { $ne: null } });
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
          io.to(`list:${r.listId}`).emit("task:updated", r);
        }
      }
    } catch (err) {
      console.error("Cron job error:", err);
    }
  });
}

//  DB + Start Server 
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
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
} else {
  console.log("🧪 Test Mode: Skipping real MongoDB + HTTP server start");
}
