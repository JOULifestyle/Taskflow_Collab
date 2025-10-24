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
 

  // Join list room
  socket.on("join-list", (listId) => {
    if (!listId) return;
    socket.join(`list:${listId}`);
   
  });

  // Leave list room
  socket.on("leave-list", (listId) => {
    if (!listId) return;
    socket.leave(`list:${listId}`);
    
  });

  // Create task
  socket.on("task:create", async ({ listId, text, ...rest }) => {
    try {
      if (!listId || !text) {
        return socket.emit("error", { message: "listId and text required" });
      }

      if (!(await userHasRole(socket.userId, listId, "editor"))) {
        return socket.emit("error", { message: "Not authorized" });
      }

      const task = await Task.create({
        userId: socket.userId,
        listId,
        text,
        completed: false,
        ...rest, // allow optional fields like due, priority, etc.
      });

      io.to(`list:${listId}`).emit("task:created", task);
    } catch (err) {
      console.error("task:create error:", err);
      socket.emit("error", { message: "Failed to create task" });
    }
  });

  // Update task
  socket.on("task:update", async ({ listId, taskId, updates }) => {
    try {
      if (!listId || !taskId || !updates) {
        return socket.emit("error", { message: "listId, taskId and updates required" });
      }

      if (!(await userHasRole(socket.userId, listId, "editor"))) {
        return socket.emit("error", { message: "Not authorized" });
      }

      const task = await Task.findOneAndUpdate(
        { _id: taskId, listId },
        updates,
        { new: true }
      );

      if (!task) {
        return socket.emit("error", { message: "Task not found" });
      }

      io.to(`list:${listId}`).emit("task:updated", task);
    } catch (err) {
      console.error("task:update error:", err);
      socket.emit("error", { message: "Failed to update task" });
    }
  });

  // Delete task
  socket.on("task:delete", async ({ listId, taskId }) => {
    try {
      if (!listId || !taskId) {
        return socket.emit("error", { message: "listId and taskId required" });
      }

      if (!(await userHasRole(socket.userId, listId, "editor"))) {
        return socket.emit("error", { message: "Not authorized" });
      }

      const deleted = await Task.deleteOne({ _id: taskId, listId });
      if (deleted.deletedCount === 0) {
        return socket.emit("error", { message: "Task not found" });
      }

      io.to(`list:${listId}`).emit("task:deleted", { taskId });
    } catch (err) {
      console.error("task:delete error:", err);
      socket.emit("error", { message: "Failed to delete task" });
    }
  });
}

module.exports = registerTaskHandlers;
