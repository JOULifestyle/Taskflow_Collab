const { Server } = require("socket.io");
const registerTaskHandlers = require("./registerTaskHandlers");
const registerListHandlers = require("./registerListHandlers");
const authSocket = require("../middleware/socketAuth"); // 👈 if you have JWT check for sockets

function setupSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use(authSocket); // 👈 authenticate user before connect

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.userId);

    // register handlers
    registerTaskHandlers(io, socket);
    registerListHandlers(io, socket);

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.userId);
    });
  });

  return io;
}

module.exports = setupSockets;
