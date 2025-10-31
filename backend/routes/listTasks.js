const express = require("express");
const router = express.Router({ mergeParams: true });
const Task = require("../models/Task");
const List = require("../models/List");
const auth = require("../middleware/auth");
const authorizeList = require("../middleware/authorizeList");
const mongoose = require("mongoose");

const Subscription = require("../models/Subscription");
const webpush = require("web-push");

// Get all tasks in a list
router.get("/", auth, authorizeList("viewer"), async (req, res) => {
  try {
    const listId = new mongoose.Types.ObjectId(req.params.listId);
    const tasks = await Task.find({ listId });
    res.json(tasks);
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Add a task
router.post("/", auth, authorizeList("editor"), async (req, res) => {
  try {

    const listId = new mongoose.Types.ObjectId(req.params.listId);

    const repeat =
      req.body.repeat && req.body.repeat.trim() !== "" ? req.body.repeat : null;

    // Strip listId if frontend sends it
    const { listId: ignoreListId, ...body } = req.body;

    const lastTask = await Task.findOne({ listId }).sort({ order: -1 }).exec();
    const nextOrder = lastTask ? lastTask.order + 1 : 1;

    const task = new Task({
      ...body,
      repeat,
      listId, 
      userId: req.user.id,
      order: nextOrder,
    });

    await task.save();

    // Get the list to find all members for notifications
    const list = await List.findById(listId);
    if (list) {
      // Get all member user IDs
      const memberIds = [list.owner, ...list.members.map(m => m.userId)];

      //  Emit event via WebSocket to the list room 
      const io = req.app.get("io");
      if (io) {
        io.to(`list:${listId}`).emit("task:created", task);
      }

      //  Send push notifications to ALL list members
      const subs = await Subscription.find({ userId: { $in: memberIds } });
      const basePayload = {
        title: "New Task Added",
        body: `📝 ${task.text} was added to the list`,
        icon: "/logo192.png",
        badge: "/logo192.png",
        data: {
          url: `/`,
          taskId: task._id.toString(),
          listId: listId.toString(),
          type: "task_created"
        }
      };

      for (const s of subs) {
        try {
          const endpoint = s.subscription.endpoint || "";
          const isFCM = endpoint.includes('fcm.googleapis.com');
          const isWNS = endpoint.includes('notify.windows.com');
          const isSafari = endpoint.includes('webkit');
          const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : isSafari ? 'Safari' : 'Unknown';
  
          // Create browser-specific payload
          let payload;
          if (isFCM || isWNS) {
            payload = JSON.stringify({
              ...basePayload,
              actions: [
                { action: "view", title: "View Task" }
              ],
              requireInteraction: false,
              silent: false
            });
          } else if (isSafari) {
            payload = JSON.stringify({
              ...basePayload,
              actions: undefined,
              requireInteraction: undefined,
              badge: undefined
            });
          } else {
            payload = JSON.stringify(basePayload);
          }
  
          const startTime = Date.now();
          await webpush.sendNotification(s.subscription, payload);
          const duration = Date.now() - startTime;
  
        } catch (err) {
          const endpoint = s.subscription.endpoint || "";
          const isFCM = endpoint.includes('fcm.googleapis.com');
          const isWNS = endpoint.includes('notify.windows.com');
          const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : 'Unknown';
  
          console.error(`❌ Push error for ${s.userId} (${browserType}):`, {
            statusCode: err.statusCode,
            message: err.message,
            body: err.body || '',
            endpoint: endpoint.substring(0, 100) + '...'
          });
  
          // Log specific error patterns for debugging
          if (err.statusCode === 400) {
            console.error(`🚨 Bad Request (400) - likely malformed subscription for ${browserType}`);
          } else if (err.statusCode === 401) {
            console.error(`🚨 Unauthorized (401) - VAPID keys issue for ${browserType}`);
          } else if (err.statusCode === 403) {
            console.error(`🚨 Forbidden (403) - endpoint blocked or invalid for ${browserType}`);
          } else if (err.statusCode === 404) {
            console.error(`🚨 Not Found (404) - subscription expired for ${browserType}, cleaning up...`);
            // Clean up expired subscription
            await Subscription.findOneAndDelete({
              userId: s.userId,
              "subscription.endpoint": endpoint
            });
          } else if (err.statusCode === 410) {
            console.error(`🚨 Gone (410) - subscription permanently invalid for ${browserType}, cleaning up...`);
            // Clean up permanently invalid subscription
            await Subscription.findOneAndDelete({
              userId: s.userId,
              "subscription.endpoint": endpoint
            });
          }
        }
      }
    }

    res.json(task);
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update task
router.put("/:taskId", auth, authorizeList("editor"), async (req, res) => {
  try {
    const listId = new mongoose.Types.ObjectId(req.params.listId);

    // Strip listId if frontend sends it
    const { listId: ignoreListId, ...updateData } = req.body;

    // Normalize repeat if provided
    if (
      Object.prototype.hasOwnProperty.call(updateData, "repeat") &&
      (!updateData.repeat || updateData.repeat.trim() === "")
    ) {
      updateData.repeat = null;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.taskId, listId }, // enforce listId filter
      updateData,
      { new: true }
    );

    if (!task) return res.status(404).json({ error: "Task not found" });

    // Get the list to find all members
    const list = await List.findById(listId);
    if (!list) return res.status(404).json({ error: "List not found" });

    // Get all member user IDs (including the owner)
    const memberIds = [list.owner, ...list.members.map(m => m.userId)];

    //  Emit event via WebSocket to the list room (all connected members)
    const io = req.app.get("io");
    if (io) {
      io.to(`list:${listId}`).emit("task:updated", task);
    }

    //  Send push notifications to ALL list members
    const subs = await Subscription.find({ userId: { $in: memberIds } });
    const basePayload = {
      title: "Task Updated",
      body: `✏️ ${task.text} was updated`,
      icon: "/logo192.png",
      badge: "/logo192.png",
      data: {
        url: `/`,
        taskId: task._id.toString(),
        listId: listId.toString(),
        type: "task_updated"
      }
    };

    for (const s of subs) {
      try {
        const endpoint = s.subscription.endpoint || "";
        const isFCM = endpoint.includes('fcm.googleapis.com');
        const isWNS = endpoint.includes('notify.windows.com');
        const isSafari = endpoint.includes('webkit');
        const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : isSafari ? 'Safari' : 'Unknown';

        // Skip Edge on iOS as it doesn't support push notifications
        if (isWNS && s.browserType === 'Edge (WNS)' && endpoint.includes('notify.windows.com')) {
          continue;
        }

        // Skip Edge on iOS as it doesn't support push notifications
        if (isWNS && s.browserType === 'Edge (WNS)' && endpoint.includes('notify.windows.com')) {
          
          continue;
        }

        // Skip Edge on iOS as it doesn't support push notifications
        if (isWNS && s.browserType === 'Edge (WNS)' && endpoint.includes('notify.windows.com')) {
         
          continue;
        }

        // Create browser-specific payload
        let payload;
        if (isFCM || isWNS) {
          payload = JSON.stringify({
            ...basePayload,
            actions: [
              { action: "view", title: "View Task" }
            ],
            requireInteraction: false,
            silent: false
          });
        } else if (isSafari) {
          payload = JSON.stringify({
            ...basePayload,
            actions: undefined,
            requireInteraction: undefined,
            badge: undefined
          });
        } else {
          payload = JSON.stringify(basePayload);
        }

        const startTime = Date.now();
        
        // Add timeout for iOS Safari
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Push notification timeout')), 10000);
        });
        
        try {
          await Promise.race([
            webpush.sendNotification(s.subscription, payload),
            timeoutPromise
          ]);
        } catch (timeoutError) {
          console.error(`⏰ Push timeout for ${s.userId} (${browserType}):`, timeoutError.message);
        }
        
        const duration = Date.now() - startTime;

      } catch (err) {
        const endpoint = s.subscription.endpoint || "";
        const isFCM = endpoint.includes('fcm.googleapis.com');
        const isWNS = endpoint.includes('notify.windows.com');
        const isSafari = endpoint.includes('webkit');
        const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : isSafari ? 'Safari' : 'Unknown';

        console.error(`❌ Push error for ${s.userId} (${browserType}):`, {
          statusCode: err.statusCode,
          message: err.message,
          body: err.body || '',
          endpoint: endpoint.substring(0, 100) + '...'
        });

        // Enhanced error handling for iOS Safari
        if (err.statusCode === 400) {
          console.error(`🚨 Bad Request (400) - likely malformed subscription for ${browserType}`);
        } else if (err.statusCode === 401) {
          console.error(`🚨 Unauthorized (401) - VAPID keys issue for ${browserType}`);
          
          // For Safari, this might indicate the VAPID subject issue we fixed
          if (browserType === 'Safari') {
            console.error(`🍎 iOS Safari VAPID error detected - subscription might need refresh`);
          }
        } else if (err.statusCode === 403) {
          console.error(`🚨 Forbidden (403) - endpoint blocked or invalid for ${browserType}`);
        } else if (err.statusCode === 404) {
          console.error(`🚨 Not Found (404) - subscription expired for ${browserType}, cleaning up...`);
          // Clean up expired subscription
          await Subscription.findOneAndDelete({
            userId: s.userId,
            "subscription.endpoint": endpoint
          });
        } else if (err.statusCode === 410) {
          console.error(`🚨 Gone (410) - subscription permanently invalid for ${browserType}, cleaning up...`);
          // Clean up permanently invalid subscription
          await Subscription.findOneAndDelete({
            userId: s.userId,
            "subscription.endpoint": endpoint
          });
        } else if (err.message && err.message.includes('timeout')) {
          console.error(`⏰ Push timeout for ${browserType} - might be iOS Safari specific`);
        }
        
        // Special cleanup for Safari subscriptions that fail with auth errors
        if (browserType === 'Safari' && (err.statusCode === 401 || err.statusCode === 403)) {
          console.log(`🧹 Cleaning up potentially invalid Safari subscription due to auth error...`);
          try {
            await Subscription.findOneAndDelete({
              userId: s.userId,
              "subscription.endpoint": endpoint
            });
            console.log(`✅ Cleaned up Safari subscription for user ${s.userId}`);
          } catch (cleanupError) {
            console.error(`❌ Failed to cleanup Safari subscription:`, cleanupError);
          }
        }
      }
    }

    res.json(task);
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete task
router.delete("/:taskId", auth, authorizeList("editor"), async (req, res) => {
  try {
    const listId = new mongoose.Types.ObjectId(req.params.listId);

    const task = await Task.findOneAndDelete({
      _id: req.params.taskId,
      listId, // enforce correct listId
    });

    if (!task) return res.status(404).json({ error: "Task not found" });

    // Get the list to find all members for notifications
    const list = await List.findById(listId);
    if (list) {
      // Get all member user IDs (including the owner)
      const memberIds = [list.owner, ...list.members.map(m => m.userId)];

      //  Emit event via WebSocket to the list room (all connected members)
      const io = req.app.get("io");
      if (io) {
        
        io.to(`list:${listId}`).emit("task:deleted", task._id);
      }

      //  Send push notifications to ALL list members
      const subs = await Subscription.find({ userId: { $in: memberIds } });
      const basePayload = {
        title: "Task Deleted",
        body: `🗑️ ${task.text} was removed from the list`,
        icon: "/logo192.png",
        badge: "/logo192.png",
        data: {
          url: `/`,
          taskId: task._id.toString(),
          listId: listId.toString(),
          type: "task_deleted"
        }
      };

      for (const s of subs) {
        try {
          const endpoint = s.subscription.endpoint || "";
          const isFCM = endpoint.includes('fcm.googleapis.com');
          const isWNS = endpoint.includes('notify.windows.com');
          const isSafari = endpoint.includes('webkit');
          const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : isSafari ? 'Safari' : 'Unknown';

          // Create browser-specific payload
          let payload;
          if (isFCM || isWNS) {
            payload = JSON.stringify({
              ...basePayload,
              actions: [
                { action: "view", title: "View List" }
              ],
              requireInteraction: false,
              silent: false
            });
          } else if (isSafari) {
            payload = JSON.stringify({
              ...basePayload,
              actions: undefined,
              requireInteraction: undefined,
              badge: undefined
            });
          } else {
            payload = JSON.stringify(basePayload);
          }

         

          const startTime = Date.now();
          await webpush.sendNotification(s.subscription, payload);
          const duration = Date.now() - startTime;

         
        } catch (err) {
          const endpoint = s.subscription.endpoint || "";
          const isFCM = endpoint.includes('fcm.googleapis.com');
          const isWNS = endpoint.includes('notify.windows.com');
          const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : 'Unknown';

          console.error(`❌ Push error for ${s.userId} (${browserType}):`, {
            statusCode: err.statusCode,
            message: err.message,
            body: err.body || '',
            endpoint: endpoint.substring(0, 100) + '...'
          });

          // Log specific error patterns for debugging
          if (err.statusCode === 400) {
            console.error(`🚨 Bad Request (400) - likely malformed subscription for ${browserType}`);
          } else if (err.statusCode === 401) {
            console.error(`🚨 Unauthorized (401) - VAPID keys issue for ${browserType}`);
          } else if (err.statusCode === 403) {
            console.error(`🚨 Forbidden (403) - endpoint blocked or invalid for ${browserType}`);
          } else if (err.statusCode === 404) {
            console.error(`🚨 Not Found (404) - subscription expired for ${browserType}, cleaning up...`);
            // Clean up expired subscription
            await Subscription.findOneAndDelete({
              userId: s.userId,
              "subscription.endpoint": endpoint
            });
          } else if (err.statusCode === 410) {
            console.error(`🚨 Gone (410) - subscription permanently invalid for ${browserType}, cleaning up...`);
            // Clean up permanently invalid subscription
            await Subscription.findOneAndDelete({
              userId: s.userId,
              "subscription.endpoint": endpoint
            });
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Reorder tasks
router.put("/reorder", auth, authorizeList("editor"), async (req, res) => {
  try {
    console.log("Reorder request received:", {
      listId: req.params.listId,
      body: req.body,
      userId: req.user.id
    });
    
    const listId = new mongoose.Types.ObjectId(req.params.listId);
    const { orderedIds } = req.body;

    console.log("Processed data:", { listId: listId.toString(), orderedIds });

    if (!orderedIds || !Array.isArray(orderedIds)) {
      console.log("Invalid orderedIds:", orderedIds);
      return res.status(400).json({ error: "orderedIds must be an array" });
    }

    // Update the order field for each task
    const bulkOps = orderedIds.map((taskId, index) => ({
      updateOne: {
        filter: { _id: taskId, listId },
        update: { $set: { order: index + 1 } }
      }
    }));

    console.log("Bulk operations prepared:", bulkOps.length);

    if (bulkOps.length > 0) {
      const result = await Task.bulkWrite(bulkOps);
      console.log("Bulk write result:", result);
    } else {
      console.log("No bulk operations to perform");
    }

    // Get the updated tasks
    const updatedTasks = await Task.find({ listId }).sort({ order: 1 });
    console.log("Updated tasks count:", updatedTasks.length);

    // Emit event via WebSocket to the list room
    const io = req.app.get("io");
    if (io) {
      io.to(`list:${listId}`).emit("tasks:reordered", updatedTasks);
      console.log("WebSocket event emitted");
    }

    res.json(updatedTasks);
  } catch (err) {
    console.error("Reorder tasks error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Update task
router.put("/:taskId", auth, authorizeList("editor"), async (req, res) => {
  try {
    const listId = new mongoose.Types.ObjectId(req.params.listId);

    // Strip listId if frontend sends it
    const { listId: ignoreListId, ...updateData } = req.body;

    // Normalize repeat if provided
    if (
      Object.prototype.hasOwnProperty.call(updateData, "repeat") &&
      (!updateData.repeat || updateData.repeat.trim() === "")
    ) {
      updateData.repeat = null;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.taskId, listId }, // enforce listId filter
      updateData,
      { new: true }
    );

    if (!task) return res.status(404).json({ error: "Task not found" });

    // Get the list to find all members
    const list = await List.findById(listId);
    if (!list) return res.status(404).json({ error: "List not found" });

    // Get all member user IDs (including the owner)
    const memberIds = [list.owner, ...list.members.map(m => m.userId)];

    //  Emit event via WebSocket to the list room (all connected members)
    const io = req.app.get("io");
    if (io) {
      io.to(`list:${listId}`).emit("task:updated", task);
    }

    //  Send push notifications to ALL list members
    const subs = await Subscription.find({ userId: { $in: memberIds } });
    const basePayload = {
      title: "Task Updated",
      body: `✏️ ${task.text} was updated`,
      icon: "/logo192.png",
      badge: "/logo192.png",
      data: {
        url: `/`,
        taskId: task._id.toString(),
        listId: listId.toString(),
        type: "task_updated"
      }
    };

    for (const s of subs) {
      try {
        const endpoint = s.subscription.endpoint || "";
        const isFCM = endpoint.includes('fcm.googleapis.com');
        const isWNS = endpoint.includes('notify.windows.com');
        const isSafari = endpoint.includes('webkit');
        const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : isSafari ? 'Safari' : 'Unknown';

        // Skip Edge on iOS as it doesn't support push notifications
        if (isWNS && s.browserType === 'Edge (WNS)' && endpoint.includes('notify.windows.com')) {
          continue;
        }

        // Skip Edge on iOS as it doesn't support push notifications
        if (isWNS && s.browserType === 'Edge (WNS)' && endpoint.includes('notify.windows.com')) {
          
          continue;
        }

        // Skip Edge on iOS as it doesn't support push notifications
        if (isWNS && s.browserType === 'Edge (WNS)' && endpoint.includes('notify.windows.com')) {
         
          continue;
        }

        // Create browser-specific payload
        let payload;
        if (isFCM || isWNS) {
          payload = JSON.stringify({
            ...basePayload,
            actions: [
              { action: "view", title: "View Task" }
            ],
            requireInteraction: false,
            silent: false
          });
        } else if (isSafari) {
          payload = JSON.stringify({
            ...basePayload,
            actions: undefined,
            requireInteraction: undefined,
            badge: undefined
          });
        } else {
          payload = JSON.stringify(basePayload);
        }

        const startTime = Date.now();
        
        // Add timeout for iOS Safari
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Push notification timeout')), 10000);
        });
        
        try {
          await Promise.race([
            webpush.sendNotification(s.subscription, payload),
            timeoutPromise
          ]);
        } catch (timeoutError) {
          console.error(`⏰ Push timeout for ${s.userId} (${browserType}):`, timeoutError.message);
        }
        
        const duration = Date.now() - startTime;

      } catch (err) {
        const endpoint = s.subscription.endpoint || "";
        const isFCM = endpoint.includes('fcm.googleapis.com');
        const isWNS = endpoint.includes('notify.windows.com');
        const isSafari = endpoint.includes('webkit');
        const browserType = isFCM ? 'Chrome/Edge/Firefox' : isWNS ? 'Edge (WNS)' : isSafari ? 'Safari' : 'Unknown';

        console.error(`❌ Push error for ${s.userId} (${browserType}):`, {
          statusCode: err.statusCode,
          message: err.message,
          body: err.body || '',
          endpoint: endpoint.substring(0, 100) + '...'
        });

        // Enhanced error handling for iOS Safari
        if (err.statusCode === 400) {
          console.error(`🚨 Bad Request (400) - likely malformed subscription for ${browserType}`);
        } else if (err.statusCode === 401) {
          console.error(`🚨 Unauthorized (401) - VAPID keys issue for ${browserType}`);
          
          // For Safari, this might indicate the VAPID subject issue we fixed
          if (browserType === 'Safari') {
            console.error(`🍎 iOS Safari VAPID error detected - subscription might need refresh`);
          }
        } else if (err.statusCode === 403) {
          console.error(`🚨 Forbidden (403) - endpoint blocked or invalid for ${browserType}`);
        } else if (err.statusCode === 404) {
          console.error(`🚨 Not Found (404) - subscription expired for ${browserType}, cleaning up...`);
          // Clean up expired subscription
          await Subscription.findOneAndDelete({
            userId: s.userId,
            "subscription.endpoint": endpoint
          });
        } else if (err.statusCode === 410) {
          console.error(`🚨 Gone (410) - subscription permanently invalid for ${browserType}, cleaning up...`);
          // Clean up permanently invalid subscription
          await Subscription.findOneAndDelete({
            userId: s.userId,
            "subscription.endpoint": endpoint
          });
        } else if (err.message && err.message.includes('timeout')) {
          console.error(`⏰ Push timeout for ${browserType} - might be iOS Safari specific`);
        }
        
        // Special cleanup for Safari subscriptions that fail with auth errors
        if (browserType === 'Safari' && (err.statusCode === 401 || err.statusCode === 403)) {
          console.log(`🧹 Cleaning up potentially invalid Safari subscription due to auth error...`);
          try {
            await Subscription.findOneAndDelete({
              userId: s.userId,
              "subscription.endpoint": endpoint
            });
            console.log(`✅ Cleaned up Safari subscription for user ${s.userId}`);
          } catch (cleanupError) {
            console.error(`❌ Failed to cleanup Safari subscription:`, cleanupError);
          }
        }
      }
    }

    res.json(task);
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
