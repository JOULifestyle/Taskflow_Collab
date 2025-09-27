const Task = require("../models/Task");
const List = require("../models/List");

// Helper: check if user has required role
async function userHasRole(userId, listId, role = "editor") {
  const list = await List.findById(listId);
  if (!list) return false;
  const member = list.members.find((m) => String(m.userId) === String(userId));
  if (!member) return false;

  const roles = ["viewer", "editor", "owner"];
  return roles.indexOf(member.role) >= roles.indexOf(role);
}

function registerTaskHandlers(io, socket) {
  console.log("✅ Socket connected:", socket.userId);

  // Join list room
  socket.on("join-list", (listId) => {
    socket.join(`list:${listId}`);
  });

  socket.on("leave-list", (listId) => {
    socket.leave(`list:${listId}`);
  });

  // Create task
  socket.on("task:create", async (payload) => {
    try {
      const { listId, text } = payload;
      if (!(await userHasRole(socket.userId, listId, "editor"))) {
        return socket.emit("error", { message: "Not authorized" });
      }
      const task = await Task.create({
        userId: socket.userId,
        listId,
        text,
        completed: false,
      });
      io.to(`list:${listId}`).emit("task:created", task);
    } catch (err) {
      console.error("task:create error:", err);
    }
  });

  // Update task
  socket.on("task:update", async (payload) => {
    try {
      const { listId, taskId, updates } = payload;
      if (!(await userHasRole(socket.userId, listId, "editor"))) {
        return socket.emit("error", { message: "Not authorized" });
      }
      const task = await Task.findOneAndUpdate(
        { _id: taskId, listId },
        updates,
        { new: true }
      );
      io.to(`list:${listId}`).emit("task:updated", task);
    } catch (err) {
      console.error("task:update error:", err);
    }
  });

  // Delete task
  socket.on("task:delete", async (payload) => {
    try {
      const { listId, taskId } = payload;
      if (!(await userHasRole(socket.userId, listId, "editor"))) {
        return socket.emit("error", { message: "Not authorized" });
      }
      await Task.deleteOne({ _id: taskId, listId });
      io.to(`list:${listId}`).emit("task:deleted", { taskId });
    } catch (err) {
      console.error("task:delete error:", err);
    }
  });
}

module.exports = registerTaskHandlers;
