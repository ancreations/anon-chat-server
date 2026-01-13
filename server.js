const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

let waitingUser = null;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('find_partner', () => {
    if (waitingUser) {
      // Pair users
      const roomName = waitingUser.id + '#' + socket.id;
      socket.join(roomName);
      waitingUser.join(roomName);

      // Notify both
      io.to(roomName).emit('partner_found');
      
      waitingUser = null;
    } else {
      waitingUser = socket;
      socket.emit('waiting', 'Searching for a stranger...');
    }
  });

  socket.on('chat_message', (msg) => {
    const rooms = Array.from(socket.rooms);
    const chatRoom = rooms.find(room => room !== socket.id);
    if (chatRoom) {
      socket.to(chatRoom).emit('chat_message', msg);
    }
  });

  // NEW: Handle user leaving
  socket.on('disconnecting', () => {
    // Find the room they were in
    const rooms = Array.from(socket.rooms);
    const chatRoom = rooms.find(room => room !== socket.id);
    
    // Notify the partner in that room
    if (chatRoom) {
      socket.to(chatRoom).emit('stranger_disconnected');
    }
    
    // If they were waiting, remove from waitlist
    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});

