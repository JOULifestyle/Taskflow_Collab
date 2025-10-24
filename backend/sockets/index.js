const { Server } = require("socket.io");
const registerTaskHandlers = require("./registerTaskHandlers");
const registerListHandlers = require("./registerListHandlers");
const authSocket = require("../middleware/socketAuth"); 

function setupSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use(authSocket);

  io.on("connection", (socket) => {
   

    // register handlers
    registerTaskHandlers(io, socket);
    registerListHandlers(io, socket);

    socket.on("disconnect", () => {
      
    });
  });

  return io;
}

module.exports = setupSockets;
