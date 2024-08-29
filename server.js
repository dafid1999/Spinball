const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('frontend'));

const maxPlayers = 4;
const minPlayers = 2;
const users = [];

let ball = {
    x: 800,
    y: 450,
    radius: 10,
    color: 'black',
    dx: 0,
    dy: 0
};

let positions = [
    { x: 0, y: 350 },    // Position for the 1st player
    { x: 800, y: 350 },  // Position for the 2nd player
    { x: 350, y: 0 },    // Position for the 3rd player
    { x: 350, y: 800 }   // Position for the 4th player
];

io.on('connection', function(socket) {
    console.log('A user connected');

    if (users.length >= maxPlayers) {
        socket.emit('lobbyFull', 'The lobby is full. Please try again later.');
        socket.disconnect();
        return;
    }

    socket.on('setUsername', function(data) {
        if (users.find(user => user.username === data)) {
            socket.emit('userExists', data + ' username is taken! Try another username.');
        } else {
            const positionIndex = users.length;
            const position = positions[positionIndex];

            const newUser = {
                id: socket.id,
                username: data,
                position: position,
                ready: false
            };

            users.push(newUser);

            socket.emit('userSet', {
                username: data,
                position: newUser.position
            });

            console.log(`${data} has joined`);
        }
    });

    socket.on('playerReady', function() {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            user.ready = true;

            const readyUsers = users.filter(user => user.ready).length;

            if (readyUsers >= minPlayers && readyUsers === users.length) {
                io.sockets.emit('allPlayersReady', 'All players are ready! The game will now start.');
                initializeBall();
            } else if (readyUsers >= minPlayers && readyUsers < users.length) {
                socket.emit('waiting', `Waiting for ${users.length - readyUsers} more players to be ready.`);
            } else if (readyUsers < minPlayers) {
                socket.emit('waiting', `Waiting for ${minPlayers - readyUsers} more players`);
            }
        }
    });

    socket.on('playerMove', function(data) {
        const user = users.find(u => u.id === socket.id);
        if (user) {
            // Handle player movement
            const speed = 10;
            if (data.key === 'ArrowUp' && user.position.y > 0) user.position.y -= speed;
            if (data.key === 'ArrowDown' && user.position.y < 600) user.position.y += speed;
            if (data.key === 'ArrowLeft' && user.position.x > 0) user.position.x -= speed;
            if (data.key === 'ArrowRight' && user.position.x < 600) user.position.x += speed;
        }
    });

    socket.on('disconnect', function() {
        const index = users.findIndex(user => user.id === socket.id);
        if (index !== -1) {
            console.log(`${users[index].username} has disconnected.`);
            users.splice(index, 1);
        }
    });
});

function initializeBall() {
    const speed = 8;
    const angle = Math.random() * Math.PI * 2;

    ball.dx = speed * Math.cos(angle);
    ball.dy = speed * Math.sin(angle);

    io.emit('startBall', ball);
}

function updateBallPosition() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x + ball.radius > 1600 || ball.x - ball.radius < 0) ball.dx = -ball.dx;
    if (ball.y + ball.radius > 900 || ball.y - ball.radius < 0) ball.dy = -ball.dy;
}

setInterval(() => {
    updateBallPosition();
    io.emit('updateGameState', {
        users: users.map(user => ({
            id: user.id,
            position: user.position,
            ready: user.ready
        })),
        ball: ball
    });
}, 1000 / 15); // 60 FPS

http.listen(3000, function() {
    console.log('listening on localhost:3000');
});

