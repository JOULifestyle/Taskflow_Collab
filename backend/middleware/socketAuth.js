// backend/middleware/socketAuth.js
const jwt = require("jsonwebtoken");

function authSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication error: Token required"));
    }

    // Verify JWT (same secret as your REST auth)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to socket for later use
    socket.userId = decoded.id;

    next();
  } catch (err) {
    console.error("❌ Socket auth error:", err.message);
    next(new Error("Authentication error"));
  }
}

module.exports = authSocket;
