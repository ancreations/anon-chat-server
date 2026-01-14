const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100MB വരെ ഫയൽ അയക്കാൻ സമ്മതിക്കും
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingUsers = [];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.partner = null;

    socket.on('find_partner', () => {
        if (socket.partner) return;

        if (waitingUsers.length > 0) {
            let partner = waitingUsers.pop();
            
            if (partner.id === socket.id) {
                waitingUsers.push(socket);
                return;
            }

            // Connect them
            socket.partner = partner;
            partner.partner = socket;

            // Notify both
            socket.emit('partner_found');
            partner.emit('partner_found');

        } else {
            waitingUsers.push(socket);
            socket.emit('waiting', "Searching for someone...");
        }
    });

    socket.on('chat_message', (msg) => {
        if (socket.partner) {
            socket.partner.emit('chat_message', msg);
        }
    });

    // --- NEW: Image Sending ---
    socket.on('send_image', (imgData) => {
        if (socket.partner) {
            socket.partner.emit('receive_image', imgData);
        }
    });

    // --- NEW: Block/Skip ---
    socket.on('block_partner', () => {
        if (socket.partner) {
            socket.partner.emit('partner_blocked'); // അപ്പുറത്തുള്ള ആൾക്ക് മെസേജ് കൊടുക്കും
            socket.partner.partner = null; // ബന്ധം വിച്ഛേദിക്കുന്നു
            socket.partner = null;
        }
    });

    socket.on('disconnect', () => {
        if (socket.partner) {
            socket.partner.emit('stranger_disconnected');
            socket.partner.partner = null;
        } else {
            waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
