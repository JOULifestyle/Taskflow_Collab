const List = require("../models/List");

function registerListHandlers(io, socket) {
  
  socket.on("list:join", (listId) => {
    socket.join(`list:${listId}`);
   
  });

  socket.on("list:leave", (listId) => {
    socket.leave(`list:${listId}`);
    
  });

  // broadcast when list is updated 
  socket.on("list:update", async ({ listId, updates }) => {
    try {
      const list = await List.findByIdAndUpdate(listId, updates, { new: true });
      if (!list) return;
      io.to(`list:${listId}`).emit("list:updated", list);
    } catch (err) {
      console.error("list:update error:", err);
    }
  });

  // sharing event 
  socket.on("list:share", async ({ listId, userId, role }) => {
    try {
      const list = await List.findById(listId);
      if (!list) return;

      const exists = list.members.find(m => String(m.userId) === String(userId));
      if (exists) {
        exists.role = role; // update role
      } else {
        list.members.push({ userId, role });
      }
      await list.save();

      io.to(`list:${listId}`).emit("list:shared", {
        listId,
        userId,
        role,
      });
    } catch (err) {
      console.error("list:share error:", err);
    }
  });
}

module.exports = registerListHandlers;
