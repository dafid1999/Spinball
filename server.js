const { log } = require('console');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('frontend'));

const boardWidth = 700;
const boardHeight = 700;
const maxPlayers = 4;
const minPlayers = 2;
let users = [];
const userLives = 3;
let movementData = {};

let gameStarted = false;
let intervalMain;

const playerSize = [
    { x: boardWidth / 40, y: boardHeight / 4 },
    { x: boardWidth / 4, y: boardHeight / 40 }
];

let positions = [
    { x: 0, y: (boardHeight - playerSize[0].y) / 2 },    // Position for the 1st player
    { x: boardWidth - playerSize[0].x, y: (boardHeight - playerSize[0].y) / 2 },  // Position for the 2nd player
    { x: (boardWidth - playerSize[1].x) / 2, y: 0 },    // Position for the 3rd player
    { x: (boardWidth - playerSize[1].x) / 2, y: boardHeight - playerSize[1].y }   // Position for the 4th player
];

const colors = [
    'blue',
    'red',
    'green',
    'yellow'
];

const angles = [
    -90,
    90,
    0,
    0
];

const ball = {
    x: boardWidth / 2,
    y: boardHeight / 2,
    radius: 10,
    speed: 5,
    dx: 0,
    dy: 0
};

function resetBall() {
    ball.x = boardWidth / 2;
    ball.y = boardHeight / 2;
    users.forEach((user, index) => {
        if (index < positions.length) {
            user.position = { ...positions[index] };
        }
        log('User position: x i y ' + user.position.x, user.position.y);
    });
    io.sockets.emit('currentPlayers', users);
    // Losowanie losowych wartości kierunkowych dx i dy w zakresie od -1 do 1
    let dx = (Math.random() * 2) - 1;
    let dy = (Math.random() * 2) - 1;
    // Normalizacja kierunku, aby uzyskać wektor jednostkowy
    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length;
    dy /= length;
    ball.dx = dx * ball.speed;
    ball.dy = dy * ball.speed;
    io.sockets.emit('ballMoved', ball);
    log('Ball reset: x i y ' + ball.x, ball.y +  ' | dx i dy ' + ball.dx, ball.dy);
}

function bounceFromWallWithMinValue() {
    const minValue = 0.3;

    if (Math.abs(ball.dx) < minValue) {
        ball.dx = ball.dx + Math.sign(ball.dx) * minValue;
    }
    if (Math.abs(ball.dy) < minValue) {
        ball.dy = ball.dy + Math.sign(ball.dy) * minValue;
    }
}

function updateBallPosition() {
if(gameStarted) {
    ball.x += ball.dx;
    ball.y += ball.dy;
    // Ball collision with the game board edges
    if (ball.x + ball.radius > boardWidth || ball.x - ball.radius < 0) {
        ball.dx *= -1;
        bounceFromWallWithMinValue();
    }
    if (ball.y + ball.radius > boardHeight || ball.y - ball.radius < 0) {
        ball.dy *= -1;
        bounceFromWallWithMinValue();
    }
    // Ball collision with players and walls behind players
    users.forEach(user => {
        // Check collision with player
        if (
            ball.x + ball.radius > user.position.x &&
            ball.x - ball.radius < user.position.x + user.width &&
            ball.y + ball.radius > user.position.y &&
            ball.y - ball.radius < user.position.y + user.height
        ) {
            if(user.color === 'blue' || user.color === 'red') {
                ball.dx = -(ball.dx * 1.2);
                ball.dy = (ball.dy * 1.2);
            } else if(user.color === 'green' || user.color === 'yellow') {
                ball.dx = (ball.dy * 1.2);
                ball.dy = -(ball.dy * 1.2);
            }
        }
        // Check collision with the wall behind the player
        if (user.color === 'blue' && ball.x - ball.radius < user.position.x) { // Left wall collision
            user.lives -= 1;
            resetBall(); // Reset ball position after collision
        } else if (user.color === 'red' && ball.x + ball.radius > user.position.x + user.width) { // Right wall collision
            user.lives -= 1;
            resetBall(); // Reset ball position after collision
        } else if (user.color === 'green' && ball.y - ball.radius < user.position.y) { // Top wall collision
            user.lives -= 1;
            resetBall(); // Reset ball position after collision
        } else if (user.color === 'yellow' && ball.y + ball.radius > user.position.y + user.height) { // Bottom wall collision
            user.lives -= 1;
            resetBall(); // Reset ball position after collision
        }
        // Check for game over
        if (user.lives <= 0) {
            // users.splice(users.indexOf(user), 1); // Remove player
            user.ready = false;
            io.sockets.emit('playerLostLife', { id: user.id, lives: user.lives });
            io.sockets.emit('currentPlayers', users);
            if (users.filter(user => !user.ready).length < minPlayers && gameStarted) {
                io.sockets.emit('gameOver', 'Not enough players to continue the game.');
                movementData = {};
                clearInterval(intervalMain);
                gameStarted = false;
            }
        } else {
            io.sockets.emit('playerLostLife', { id: user.id, lives: user.lives });
        }
    });
    io.sockets.emit('ballMoved', ball);
}
}
io.on('connection', function (socket) {
    console.log('A user connected #', socket.id);

    if (users.length >= maxPlayers) {
        socket.emit('lobbyFull', 'The lobby is full. Please try again later.');
        socket.disconnect();
        return;
    }

    socket.on('setUsername', function (data) {
        if (users.find(user => user.username === data)) {
            socket.emit('userExists', data + ' username is taken! Try another username.');
        } else {
            let width = playerSize[0].x;
            let height = playerSize[0].y;
            const userIndex = users.length;
            if (userIndex === 2 || userIndex === 3) {
                width = playerSize[1].x;
                height = playerSize[1].y;
            }

            const newUser = {
                id: socket.id,
                username: data,
                position: positions[userIndex],
                ready: false,
                color: colors[userIndex],
                angle: angles[userIndex],
                width: width,
                height: height,
                lives: userLives
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

    socket.on('playerReady', function () {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            if(!gameStarted) {
                user.ready = true;
                const readyUsers = users.filter(user => user.ready).length;
                log('users ready' + readyUsers);
                if (readyUsers >= minPlayers && readyUsers === users.length) {
                    io.sockets.emit('allPlayersReady', 'All players are ready! The game will now start.');
                    setTimeout(function() {
                        gameStarted = true;
                        resetBall(); // Reset the ball at the start of the game
                        // Update ball position periodically
                        intervalMain = setInterval(function() {
                            updateBallPosition();
                            updatePositions();
                        }, 1000 / 60);
                    }, 5000);                
                } else if (readyUsers >= minPlayers && readyUsers < users.length) {
                    socket.emit('waiting', `Waiting for ${users.length - readyUsers} more players to be ready.`);
                } else if (readyUsers < minPlayers) {
                    socket.emit('waiting', `Waiting for ${minPlayers - readyUsers} more players `);
                }
            } else {
                user.ready = false;
                io.sockets.emit('gameIsStarted', 'Game started! You can not join now.');
            }
        }
    });

    socket.on('playerMovement', function (data) {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            movementData[user.id] = data; // Movement data update for the player
        }
    });
    // Function to update the positions of players on the server
    function updatePositions() {
        users.forEach(user => {
            const data = movementData[user.id];
            if (data) {
                // Movement for ‘blue’ and ‘red’ players (up and down)
                if (user.color === 'blue' || user.color === 'red') {
                    user.position.y += data.y;
                    user.position.y = Math.max(0, Math.min(user.position.y, boardHeight - user.height));
                }
                // Movement for ‘green’ and ‘yellow’ players (left-right)
                if (user.color === 'green' || user.color === 'yellow') {
                    user.position.x += data.x;
                    user.position.x = Math.max(0, Math.min(user.position.x, boardWidth - user.width));
                }
                // Issuing an updated position to all customers
                io.sockets.emit('playerMoved', user);
            }
        });
    }

    socket.on('disconnect', function () {
        const index = users.findIndex(user => user.id === socket.id);
        if (index !== -1) {
            console.log(`${users[index].username} has disconnected.`);
            users.splice(index, 1);
            io.sockets.emit('currentPlayers', users);
        }
    });
});

http.listen(3000, function () {
    console.log('listening on localhost:3000');
});

