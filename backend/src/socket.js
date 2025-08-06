// src/socket.js
const { Server } = require("socket.io");

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173", // Дозволяємо з'єднання з фронтенду
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('✅ Користувач підключився через WebSocket:', socket.id);
    socket.on('disconnect', () => {
      console.log('❌ Користувач відключився:', socket.id);
    });
  });

  console.log('✅ Socket.IO ініціалізовано');
  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io не ініціалізовано!");
  }
  return io;
}

module.exports = { initSocket, getIO };