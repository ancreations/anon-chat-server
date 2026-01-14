const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);

// 👇 മാറ്റം വരുത്തിയത് ഇവിടെയാണ് (Socket Settings)
const io = new Server(server, {
    maxHttpBufferSize: 1e8, // 100MB വരെ ഫയൽ അയക്കാൻ സമ്മതിക്കും
    pingTimeout: 60000,     // 60 Seconds (1 മിനിറ്റ് വരെ വെയിറ്റ് ചെയ്യും - Disconnect ആകാതിരിക്കാൻ)
    pingInterval: 25000     // 25 Seconds (25 സെക്കൻഡ് കൂടുമ്പോൾ ചെക്ക് ചെയ്യും)
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

    socket.on('send_image', (imgData) => {
        if (socket.partner) {
            socket.partner.emit('receive_image', imgData);
        }
    });

    socket.on('block_partner', () => {
        if (socket.partner) {
            socket.partner.emit('partner_blocked'); 
            socket.partner.partner = null; 
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
