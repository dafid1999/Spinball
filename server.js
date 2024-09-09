const { log } = require('console');
const express = require('express');
const { read } = require('fs');
const { get } = require('http');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('frontend'));

const boardWidth = 800;
const boardHeight = 800;
const maxPlayers = 4;
const minPlayers = 2;
const users = [];
const userLives = 3;
const movementData = {};

let userSpeed = 24;
let gameStarted = false;
let counterBouncesWithWalls = 0;
let intervalUpdateBallPosition, intervalUpdatePositions;

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
    minSpeed: 5,
    maxSpeed: 20,
    dx: 0,
    dy: 0,
    lastCollisionUser: null
};

function resetBall() {
    counterBouncesWithWalls = 0;
    ball.x = boardWidth / 2;
    ball.y = boardHeight / 2;
    // const angle = Math.random() * 2 * Math.PI; // Random direction
    // ball.dx = Math.cos(angle) * ball.speed;
    // ball.dy = Math.sin(angle) * ball.speed;
    // Losowanie losowych wartości kierunkowych dx i dy w zakresie od -1 do 1
    let dx = (Math.random() * 2) - 1;
    let dy = (Math.random() * 2) - 1;
    // Normalizacja kierunku, aby uzyskać wektor jednostkowy
    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length;
    dy /= length;
    ball.dx = dx * ball.minSpeed;
    ball.dy = dy * ball.minSpeed;
    users.forEach((user, index) => {
        if (index < positions.length) {
            user.position = { ...positions[index] };
        }
    });
    io.sockets.emit('ballMoved', ball);
    io.sockets.emit('currentPlayers', users);
    log('Ball reset', ball.dx, ball.dy);
}

// Function to handle ball bouncing logic
function handleBallBounce(position, radius, limit, velocity) {
    if (position + radius > limit || position - radius < 0) {
        if (counterBouncesWithWalls >= 5) {
            bounceFromWallWithMinValue();
            counterBouncesWithWalls = 0;
        } else {
            velocity *= -1;
            counterBouncesWithWalls++;
        }
        log("counterBouncesWithWalls: ", counterBouncesWithWalls);
    }
    return { velocity };
}

function bounceFromWallWithMinValue() {
    const minValue = 0.2;

    if (Math.abs(ball.dx) < minValue) {
        ball.dx = Math.sign(ball.dx) * minValue;
    }
    if (Math.abs(ball.dy) < minValue) {
        ball.dy = Math.sign(ball.dy) * minValue;
    }
    // We ensure that the speed of the ball does not decrease to zero or exceed a certain value
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    if (speed < ball.minSpeed) {
        const factor = ball.minSpeed / speed;
        ball.dx *= factor;
        ball.dy *= factor;
    } else if (speed > ball.maxSpeed) {
        const factor = ball.maxSpeed / speed;
        ball.dx *= factor;
        ball.dy *= factor;
    }
}

function updateBallPosition() {
    ball.x += ball.dx;
    ball.y += ball.dy;
    // Handle horizontal bounce
    let result = handleBallBounce(ball.x, ball.radius, boardWidth, ball.dx);
    ball.dx = result.velocity;

    // Handle vertical bounce
    result = handleBallBounce(ball.y, ball.radius, boardHeight, ball.dy);
    ball.dy = result.velocity;

    // Ball collision with players and walls behind players
    users.forEach(user => {
        // Check collision with player
        if (
            ball.x + ball.radius > user.position.x &&
            ball.x - ball.radius < user.position.x + user.width &&
            ball.y + ball.radius > user.position.y &&
            ball.y - ball.radius < user.position.y + user.height
        ) {
            // Calculate impact point
            const impactX = Math.max(user.position.x, Math.min(ball.x, user.position.x + user.width));
            const impactY = Math.max(user.position.y, Math.min(ball.y, user.position.y + user.height));

            // Calculate the relative impact distance (normalized between -1 and 1)
            const relativeImpactX = (impactX - (user.position.x + user.width / 2)) / (user.width / 2);
            const relativeImpactY = (impactY - (user.position.y + user.height / 2)) / (user.height / 2);

            const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy) + 1; // Preserve speed
            log('Speed: ', speed);
            if(user.isMoving) {
                userSpeed = 24;
            } else {
                userSpeed = 0;
            }
            ball.dx = (relativeImpactX * 0.5 + (ball.dx / speed) * 0.5) * speed * 0.75 + userSpeed * 0.2; // Striking the side and adding the effect of pallet speed
            ball.dy = (relativeImpactY * 0.5 + (ball.dy / speed) * 0.5) * speed * 0.75 + userSpeed * 0.2; // Striking up/down and adding a pallet speed effect

            // We maintain total ball speed
            const newSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
            const speedAdjustmentFactor = speed / newSpeed; // In order not to change speed
            ball.dx *= speedAdjustmentFactor;
            ball.dy *= speedAdjustmentFactor;
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
            users.splice(users.indexOf(user), 1); // Remove player
            io.sockets.emit('playerLostLife', { id: user.id, lives: user.lives });
            io.sockets.emit('currentPlayers', users);
            if (users.length < minPlayers && gameStarted) {
                io.sockets.emit('gameOver', 'Not enough players to continue the game.');
                clearInterval(intervalUpdateBallPosition);
                clearInterval(intervalUpdatePositions);
                gameStarted = false;
            }
        } else {
            io.sockets.emit('playerLostLife', { id: user.id, lives: user.lives });
        }
        user.isMoving = false;
    });
    io.sockets.emit('ballMoved', ball);
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
                isMoving: false,
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
            user.ready = true;

            const readyUsers = users.filter(user => user.ready).length;

            if (readyUsers >= minPlayers && readyUsers === users.length) {
                io.sockets.emit('allPlayersReady', 'All players are ready! The game will now start.');
                gameStarted = true;
                resetBall(); // Reset the ball at the start of the game
                // Update ball position periodically
                intervalUpdateBallPosition = setInterval(updateBallPosition, 1000 / 60);
                // Activation of the interval to update players' positions
                intervalUpdatePositions = setInterval(updatePositions, 1000 / 60);
            } else if (readyUsers >= minPlayers && readyUsers < users.length) {
                socket.emit('waiting', `Waiting for ${users.length - readyUsers} more players to be ready.`);
            } else if (readyUsers < minPlayers) {
                socket.emit('waiting', `Waiting for ${minPlayers - readyUsers} more players `);
            }
        }
    });

    socket.on('playerMovement', function (data) {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            movementData[user.id] = data; // Movement data update for the player
            user.isMoving = true;
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
    // // Activation of the interval to update players' positions
    // setInterval(updatePositions, 1000 / 60);

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

