const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('frontend'));

const boardWidth = 800;
const boardHeight = 800;
const maxPlayers = 1;
const users = [];

let positions = [
    { x: 0, y: 350 },    // Position for the 1st player
    { x: 800, y: 350 },  // Position for the 2nd player
    { x: 350, y: 0 },    // Position for the 3rd player
    { x: 350, y: 800 }   // Position for the 4th player
];

let colors = [
    'blue',
    'red',
    'green',
    'yellow'
];

let angles = [
    -90,
    90,
    0,
    180
];

io.on('connection', function(socket) {
    console.log('A user connected #', socket.id);


    if (users.length >= maxPlayers) {
        socket.emit('lobbyFull', 'The lobby is full. Please try again later.');
        socket.disconnect();
        return;
    }

    socket.on('setUsername', function(data) {
        if (users.find(user => user.username === data)) {
            socket.emit('userExists', data + ' username is taken! Try another username.');
        } else {
            let width = 20;
            let height = 200;
            const positionIndex = users.length;
            if (positionIndex === 2 || positionIndex === 3) {
                width = 200;
                height = 20;
            }

            const newUser = {
                id: socket.id,
                username: data,
                position: positions[positionIndex],
                ready: false,
                color: colors[positionIndex],
                angle: angles[positionIndex],
                width: width,
                height: height
            };

            users.push(newUser);

            socket.emit('userSet', {
                username: data,
                position: newUser.position
            });

            io.sockets.emit('currentPlayers', users);
            console.log(`${data} has joined`);
        }
    });

    io.sockets.emit('currentPlayers', users);

    socket.on('playerReady', function() {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            user.ready = true;

            const readyUsers = users.filter(user => user.ready).length;
            if (readyUsers === maxPlayers) {
                io.sockets.emit('allPlayersReady', 'All players are ready! The game will now start.');
            } else {
                socket.emit('waiting', `Waiting for ${maxPlayers - readyUsers} more players to be ready.`);
            }
        }
    });

    socket.on('playerMovement', function(data) {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            if(user.color === 'blue' || user.color === 'red') {
                if(user.position.y > 0 && user.position.y < boardHeight){
                    user.position.y += data.y;
                }
            }
            if(user.color === 'green' || user.color === 'yellow') {
                if(user.position.x > 0 && user.position.x < boardWidth){
                    user.position.x += data.x;
                }
            }
            io.sockets.emit('playerMoved', user);
        }
    });

    socket.on('disconnect', function() {
        const index = users.findIndex(user => user.id === socket.id);
        if (index !== -1) {
            console.log(`${users[index].username} has disconnected.`);
            users.splice(index, 1);
            io.sockets.emit('currentPlayers', users);
        }
    });
});

http.listen(3000, function() {
    console.log('listening on localhost:3000');
});

