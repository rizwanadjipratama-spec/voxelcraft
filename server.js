const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const players = {};

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    players[socket.id] = { pos: { x: 7.5, y: 60, z: 7.5 }, rot: 0 };

    socket.emit('init', { id: socket.id, players });
    socket.broadcast.emit('playerJoin', { id: socket.id });

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].pos = data.pos;
            players[socket.id].rot = data.rot;
            socket.broadcast.emit('playerMove', { id: socket.id, pos: data.pos, rot: data.rot });
        }
    });

    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', { id: socket.id, msg });
    });

    socket.on('blockUpdate', (data) => {
        socket.broadcast.emit('blockUpdate', data);
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerLeave', socket.id);
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`VoxelCraft Multiplayer Server running on port ${PORT}`);
});
