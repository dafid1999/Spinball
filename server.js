const { log } = require('console');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('frontend'));

const boardWidth = 700;
const boardHeight = 700;
const maxPlayers = 4;
const minPlayers = 2;
const userLives = 3;
const obstacles = [];
let users = [];
let movementData = {};
let gameStarted = false;
let intervalMain;

const playerSize = [
    { x: boardWidth / 40, y: boardHeight / 4 },
    { x: boardWidth / 4, y: boardHeight / 40 }
];

const positions = [
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

let ball = {
    x: boardWidth / 2,
    y: boardHeight / 2,
    radius: 10,
    speed: 5,
    maxSpeed: 20,
    dx: 0,
    dy: 0
};

function generateObstacles() {
    obstacles.length = 0;
    for (let i = 0; i < 3; i++) {
        obstacles.push({
            x: Math.random() * (boardWidth - 100),
            y: Math.random() * (boardHeight - 100),
            width: 50 + Math.random() * 50,
            height: 50 + Math.random() * 50,
            cornerRadius: 10
        });
    }
}

function resetBall() {
    ball.x = boardWidth / 2;
    ball.y = boardHeight / 2;
    users.forEach((user, index) => {
        if (index < positions.length) {
            user.position = { ...positions[index] };
        }
    });
    io.sockets.emit('currentPlayers', users);
    // Generating random direction values for dx and dy in the range from -1 to 1
    let dx = (Math.random() * 2) - 1;
    let dy = (Math.random() * 2) - 1;
    // Normalizing the direction to obtain a unit vector
    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length;
    dy /= length;
    ball.dx = dx * ball.speed;
    ball.dy = dy * ball.speed;
    io.sockets.emit('ballMoved', ball);
    // Generating obstacles
    generateObstacles();
    io.sockets.emit('obstaclesUpdated', obstacles);
    log('Ball reset: dx i dy ' + ball.dx, ball.dy);
}

function bounceFromWallWithMinValue() {
    const minValue = 0.5;
    if (Math.abs(ball.dx) < minValue) {
        ball.dx += Math.sign(ball.dx) * minValue;
    }
    if (Math.abs(ball.dy) < minValue) {
        ball.dy += Math.sign(ball.dy) * minValue;
    }
}

function updateBallPosition() {
    if (!gameStarted) return;

    ball.x += ball.dx;
    ball.y += ball.dy;

    handleBoardCollisions();
    handlePlayerCollisions();

    io.sockets.emit('ballMoved', ball);
}

function handleBoardCollisions() {
    if (ball.x + ball.radius > boardWidth || ball.x - ball.radius < 0) {
        ball.dx *= -1;
        bounceFromWallWithMinValue();
    }
    if (ball.y + ball.radius > boardHeight || ball.y - ball.radius < 0) {
        ball.dy *= -1;
        bounceFromWallWithMinValue();
    }
}

function handlePlayerCollisions() {
    users.forEach(user => {
        if (!user.ready) return;

        if (isBallCollidingWithPlayer(user)) {
            adjustBallVelocityOnPlayerCollision(user);
        }

        if (isBallCollidingWithPlayerWall(user)) {
            user.lives -= 1;
            resetBall();
            checkGameOver(user);
        }
    });
}

function isBallCollidingWithPlayer(user) {
    return (
        ball.x + ball.radius > user.position.x &&
        ball.x - ball.radius < user.position.x + user.width &&
        ball.y + ball.radius > user.position.y &&
        ball.y - ball.radius < user.position.y + user.height
    );
}

function limitSpeed(speed, maxSpeed) {
    if (speed > maxSpeed) {
        return maxSpeed;
    } else if (speed < -maxSpeed) {
        return -maxSpeed;
    }
    return speed;
}

function adjustBallVelocityOnPlayerCollision(user) {
    if (user.color === 'blue' || user.color === 'red') {
        ball.dx = -(ball.dx * 1.2);
        ball.dy = (ball.dy * 1.2);
    } else if (user.color === 'green' || user.color === 'yellow') {
        ball.dx = (ball.dx * 1.2);
        ball.dy = -(ball.dy * 1.2);
    }
    // Limit the speed to ball.maxSpeed
    ball.dx = limitSpeed(ball.dx, ball.maxSpeed);
    ball.dy = limitSpeed(ball.dy, ball.maxSpeed);
}

function isBallCollidingWithPlayerWall(user) {
    return (
        (user.color === 'blue' && ball.x - ball.radius < user.position.x) ||
        (user.color === 'red' && ball.x + ball.radius > user.position.x + user.width) ||
        (user.color === 'green' && ball.y - ball.radius < user.position.y) ||
        (user.color === 'yellow' && ball.y + ball.radius > user.position.y + user.height)
    );
}

function resetReadyStatus() {
    users.forEach(user => {
        user.ready = false;
        user.lives = userLives;
    });
}

function checkGameOver(user) {
    io.sockets.emit('playerLostLife', { id: user.id, lives: user.lives });
    io.sockets.emit('currentPlayers', users);
    

    if (user.lives <= 0) {
        user.ready = false;
        if (users.filter(user => user.ready).length < minPlayers && gameStarted) {
            const winner = users.find(user => user.ready);
            movementData = {};
            clearInterval(intervalMain);
            gameStarted = false;
            resetReadyStatus();
            io.sockets.emit('gameOver', 'Game over. The winner is ' + winner.username);
            
        }
    }
    io.sockets.emit('playerStateChanged', users);
}

function reorganizeUsers() {
    users.forEach((user, index) => {
        user.position = positions[index];
        user.color = colors[index];
        user.angle = angles[index];
        if (index === 2 || index === 3) {
            user.width = playerSize[1].x;
            user.height = playerSize[1].y;
        } else {
            user.width = playerSize[0].x;
            user.height = playerSize[0].y;
        }
    });
    io.sockets.emit('currentPlayers', users);
    io.sockets.emit('playerStateChanged', users);
}

io.on('connection', function (socket) {
    console.log('A user connected #', socket.id);

    if (users.length >= maxPlayers) {
        socket.emit('lobbyFull', 'The lobby is full. Please try again later.');
        socket.disconnect();
        return;
    }

    socket.on('setUsername', function (data) {
        const username = data.trim();
        if (username.length > 16) {
            socket.emit('invalidUsername', 'Username is too long. Please choose a username with 16 characters or less.');
        } else if (!/^[a-zA-Z0-9]+$/.test(username)) {
            socket.emit('invalidUsername', 'Username can only contain letters and numbers.');
        } else if (users.find(user => user.username === username)) {
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
            io.sockets.emit('playerStateChanged', users);
        }
    });

    socket.on('playerReady', function () {
        let user = users.find(user => user.id === socket.id);
        if (!user) return;

        if (gameStarted) {
            user.ready = false;
            io.sockets.emit('gameIsStarted', 'Game started! You cannot join now.');
            return;
        }

        user.ready = true;
        const readyUsersCount = users.filter(user => user.ready).length;
        log('users total: ' + users.length +' users ready: ' + readyUsersCount);
        io.sockets.emit('playerStateChanged', users);
        if(!gameStarted) {
            if (readyUsersCount >= minPlayers) {
                if (readyUsersCount === users.length) {
                    io.sockets.emit('allPlayersReady', 'All players are ready!');
                } else {
                    socket.emit('waiting', `Waiting for ${users.length - readyUsersCount} more players to be ready.`);
                }
            } else {
                socket.emit('waiting', `Waiting for ${minPlayers - readyUsersCount} more players.`);
            }
        }
    });

    socket.on('startGame', function () {
        if(!gameStarted) {
            gameStarted = true;
            resetBall(); // Reset the ball at the start of the game
            intervalMain = setInterval(function() {
                updateBallPosition(); // Update the ball position
                updatePositions(); // Update the positions of players
            }, 1000 / 60);
            io.sockets.emit('gameStarting', 'Game is starting...');
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
            reorganizeUsers();
            io.sockets.emit('playerStateChanged', users);
        }
    });
});

http.listen(3000, function () {
    console.log('listening on localhost:3000');
});

