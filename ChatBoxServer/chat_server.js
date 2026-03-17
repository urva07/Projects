const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
    }
});
const PORT = 3000;

io.on('connection', (socket) => {
    console.log(`\nUser connected: ${socket.id}`);

    socket.on('join_room', (room, sendAck) => {
        sendAck(`Joined room with RoomId: ${room.roomId}`);
        socket.join(room.roomId);
        console.log(`\nUser ${socket.id} joined room ${room.roomId}`);
    });

    socket.on('send_message', async (data, callback) => {
        callback('Message sent to server');
        const { to, from, message, time } = data;
        console.log("\nmsg: ", data)

        const roomExists = io.sockets.adapter.rooms.has(to);
        if (roomExists) {
            const clients = await io.in(to).fetchSockets(); // get all sockets in the room

            clients.forEach(async (clientSocket) => {
                if (clientSocket.id !== socket.id) {
                    clientSocket.emit('receive_message', {
                        to,
                        from,
                        message
                    }, (ackFromClient) => {
                        console.log(`\nClient ${clientSocket.id} acknowledged:`, ackFromClient);
                        socket.emit('msg_seen_ack', {
                            from,
                            to,
                            message
                        })
                    });
                } 
            });
            // io.to(to).emit('receive_message', {
            //     to,
            //     from,
            //     message: message
            // }, (ackFromClient) => {
            //     console.log(`Client ${socket.id} acknowledged:`, ackFromClient);
            // });
        } else {
            console.error(`\n❌ Room doesnot exist: ${to}.`);
        }
    });

    socket.on('is_typing', (data) => {
        const { to, from, message } = data;
        const roomExists = io.sockets.adapter.rooms.has(to);
        if (roomExists) {
            io.to(to).emit('is_typing', {
                to,
                from,
                message: message
            });
        } else {
            console.error(`\n❌ Room doesnot exist: ${to}.`)
        }
    });

    socket.on('disconnect', () => {
        console.log(`\nUser disconnected: ${socket.id}`);
    });
});

 httpServer.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
});