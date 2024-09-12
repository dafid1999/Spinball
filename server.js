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

function isCollidingWithBallStartPosition(obstacle) {
    const ballStartX = boardWidth / 2;
    const ballStartY = boardHeight / 2;
    const ballRadius = ball.radius;

    return (
        ballStartX + ballRadius > obstacle.x &&
        ballStartX - ballRadius < obstacle.x + obstacle.width &&
        ballStartY + ballRadius > obstacle.y &&
        ballStartY - ballRadius < obstacle.y + obstacle.height
    );
}

function generateObstacles() {
    obstacles.length = 0;
    const numberOfObstacles = 3;
    // Generating random obstacles
    for (let i = 0; i < numberOfObstacles; i++) {
        let obstacle;
        do {
            obstacle = {
                x: Math.random() * (boardWidth - 100),
                y: Math.random() * (boardHeight - 100),
                width: 50 + Math.random() * 50,
                height: 50 + Math.random() * 50,
                cornerRadius: 10
            };
        } while (isCollidingWithBallStartPosition(obstacle));
        // Adding the obstacle to the obstacles array
        obstacles.push(obstacle);
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

function bounceWithMinValue() {
    const minAngle = 10;
    const maxAngle = 80;
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    let normDx = ball.dx / speed;
    let normDy = ball.dy / speed;

    let angle = Math.atan2(normDy, normDx);
    let angleDeg = angle * 180 / Math.PI;
    log('Checking min bounce');
    if (Math.abs(angleDeg) < minAngle) {
        angleDeg = minAngle * Math.sign(angleDeg);
        log('min bounce ' + angleDeg);
    } else if (Math.abs(angleDeg) > (180 - minAngle)) {
        angleDeg = (180 - minAngle) * Math.sign(angleDeg);
        log('min bounce ' + angleDeg);
    } else if (Math.abs(angleDeg) > maxAngle && Math.abs(angleDeg) < (180 - maxAngle)) {
        angleDeg = maxAngle * Math.sign(angleDeg);
        log('max bounce ' + angleDeg);
    }
    const adjustedAngle = angleDeg * (Math.PI / 180);

    ball.dx = Math.cos(adjustedAngle) * speed;
    ball.dy = Math.sin(adjustedAngle) * speed;
}

function isBallCollidingWithObstacle(obstacle) {
    return (
        ball.x + ball.radius > obstacle.x &&
        ball.x - ball.radius < obstacle.x + obstacle.width &&
        ball.y + ball.radius > obstacle.y &&
        ball.y - ball.radius < obstacle.y + obstacle.height
    );
}


function handleObstacleCollisions() {
    obstacles.forEach(obstacle => {
        if (isBallCollidingWithObstacle(obstacle)) {
            // Determine the side of the collision
            const overlapX = Math.min(
                ball.x + ball.radius - obstacle.x, // This represents the distance from the right edge of the ball to the left edge of the obstacle.
                obstacle.x + obstacle.width - (ball.x - ball.radius) // This represents the distance from the right edge of the obstacle to the left edge of the ball.
            );
            const overlapY = Math.min(
                ball.y + ball.radius - obstacle.y, // This represents the distance from the bottom edge of the ball to the top edge of the obstacle.
                obstacle.y + obstacle.height - (ball.y - ball.radius) // This represents the distance from the bottom edge of the obstacle to the top edge of the ball.
            );

            if (overlapX < overlapY) {
                ball.dx *= -1;
            } else {
                ball.dy *= -1;
            }
            bounceWithMinValue();
        }
    });
}

function preventBallStuck() {
    let margin = 1;
    if (ball.x > boardWidth - margin) {
        ball.x = boardWidth - ball.radius - margin;
        ball.dx = -Math.abs(ball.dx);
        log('Ball stuck at right edge');
    } else if (ball.x < margin ) {
        ball.x = ball.radius + margin;
        ball.dx = Math.abs(ball.dx);
        log('Ball stuck at left edge');
    }

    if (ball.y > boardHeight - margin) {
        ball.y = boardHeight - ball.radius - margin;
        ball.dy = -Math.abs(ball.dy);
        log('Ball stuck at bottom edge');
    } else if (ball.y < margin) {
        ball.y = ball.radius + margin;
        ball.dy = Math.abs(ball.dy);
        log('Ball stuck at top edge');
    }

    for (let obstacle of obstacles) {
        if (isBallCollidingWithObstacle(obstacle)) {
            if (ball.x + ball.radius < obstacle.x) {
                ball.x = obstacle.x - ball.radius - margin;
                log('Ball stuck at left edge of obstacle');
            } else if (ball.x + ball.radius > obstacle.x + obstacle.width) {
                ball.x = obstacle.x + obstacle.width + ball.radius + margin;
                log('Ball stuck at right edge of obstacle');
            }
            if (ball.y < obstacle.y) {
                ball.y = obstacle.y - ball.radius - margin;
                log('Ball stuck at top edge of obstacle');
            } else if (ball.y > obstacle.y + obstacle.height) {
                ball.y = obstacle.y + obstacle.height + ball.radius + margin;
                log('Ball stuck at bottom edge of obstacle');
            }
        }
    }

    for (let user of users) {
        if (isBallCollidingWithPlayer(user)) {
            if(user.color === 'blue') {
                ball.x = user.position.x + user.width + ball.radius + margin;
            }
            if (user.color === 'red') {
                ball.x = user.position.x - user.width - ball.radius - margin;
            }
            if (user.color === 'green') {
                ball.y = user.position.y + user.height + ball.radius + margin;
            }
            if (user.color === 'yellow') {
                ball.y = user.position.y - user.height - ball.radius - margin;
            }
        }
    }
}

function updateBallPosition() {
    if (!gameStarted) return;

    ball.x += ball.dx;
    ball.y += ball.dy;

    handleBoardCollisions();
    handlePlayerCollisions();
    handleObstacleCollisions();
    preventBallStuck();

    io.sockets.emit('ballMoved', ball);
}

function handleBoardCollisions() {
    if (ball.x + ball.radius > boardWidth || ball.x - ball.radius < 0) {
        ball.dx *= -1;
        bounceWithMinValue();
    }
    if (ball.y + ball.radius > boardHeight || ball.y - ball.radius < 0) {
        ball.dy *= -1;
        bounceWithMinValue();
    }
}

function handlePlayerCollisions() {
    users.forEach(user => {
        if (!user.ready) return;

        if (isBallCollidingWithPlayer(user)) {
            adjustBallVelocityOnPlayerCollision(user);
            bounceWithMinValue();
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

function limitSpeed() {
    const length = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    if (length > ball.maxSpeed) {
        ball.dx = (ball.dx / length) * ball.maxSpeed;
        ball.dy = (ball.dy / length) * ball.maxSpeed;
    }
    log('Ball after limit speed: speed ' + Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy));
}

function adjustBallVelocityOnPlayerCollision(user) {
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    const normalizedDx = ball.dx / speed;
    const normalizedDy = ball.dy / speed;
    if (user.color === 'blue' || user.color === 'red') {
        ball.dx = -normalizedDx * (speed + 1);
        ball.dy = normalizedDy * (speed + 1);
    } else if (user.color === 'green' || user.color === 'yellow') {
        ball.dx = normalizedDx * (speed + 1);
        ball.dy = -normalizedDy * (speed + 1);
    }
    // Limit the speed to ball.maxSpeed
    limitSpeed();
    log('Ball after player collision: speed ' + Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy));
    log('Ball after player collision: dx i dy ' + ball.dx, ball.dy);
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

