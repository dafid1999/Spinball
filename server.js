const { log } = require('console');
const express = require('express');
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

const playerSize = [
    { x: boardWidth/40, y: boardHeight/4},
    { x: boardWidth/4, y: boardHeight/40}
];

let positions = [
    { x: 0, y: (boardHeight-playerSize[0].y)/2 },    // Position for the 1st player
    { x: boardWidth-playerSize[0].x, y: (boardHeight-playerSize[0].y)/2 },  // Position for the 2nd player
    { x: (boardWidth-playerSize[1].x)/2, y: 0 },    // Position for the 3rd player
    { x: (boardWidth-playerSize[1].x)/2, y: boardHeight-playerSize[1].y }   // Position for the 4th player
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
    const angle = Math.random() * 2 * Math.PI; // Random direction
    ball.dx = Math.cos(angle) * ball.speed;
    ball.dy = Math.sin(angle) * ball.speed;
    users.forEach((user, index) => {
        if (index < positions.length) {
            user.position = {...positions[index] };
        }
    });
    io.sockets.emit('ballMoved', ball);
    io.sockets.emit('currentPlayers', users);
}

function updateBallPosition() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Ball collision with the game board edges
    if (ball.x + ball.radius > boardWidth || ball.x - ball.radius < 0) {
        ball.dx *= -1;
    }
    if (ball.y + ball.radius > boardHeight || ball.y - ball.radius < 0) {
        ball.dy *= -1;
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
            // Calculate impact point
            const impactX = Math.max(user.position.x, Math.min(ball.x, user.position.x + user.width));
            const impactY = Math.max(user.position.y, Math.min(ball.y, user.position.y + user.height));

            // Calculate angle of impact
            const dx = impactX - (user.position.x + user.width / 2);
            const dy = impactY - (user.position.y + user.height / 2);
            const angle = Math.atan2(dy, dx);

            // Update ball's direction based on impact angle
            const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy) + 1; // Preserve speed
            ball.dx = Math.cos(angle) * speed;
            ball.dy = Math.sin(angle) * speed;
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
            if (users.length < minPlayers) {
                io.sockets.emit('gameOver', 'Not enough players to continue the game.');
            }
        } else {
            io.sockets.emit('playerLostLife', { id: user.id, lives: user.lives });
        }
    });
    io.sockets.emit('ballMoved', ball);
}

// Update ball position periodically
setInterval(updateBallPosition, 1000 / 60);

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

    socket.on('playerReady', function() {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            user.ready = true;

            const readyUsers = users.filter(user => user.ready).length;

            if (readyUsers >= minPlayers && readyUsers === users.length) {
                io.sockets.emit('allPlayersReady', 'All players are ready! The game will now start.');
                resetBall(); // Reset the ball at the start of the game
            } else if (readyUsers >= minPlayers && readyUsers < users.length) {
                socket.emit('waiting', `Waiting for ${users.length - readyUsers} more players to be ready.`);
            } else if (readyUsers < minPlayers) {
                socket.emit('waiting', `Waiting for ${minPlayers - readyUsers} more players `);
            }
        }
    });

    socket.on('playerMovement', function(data) {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            movementData[user.id] = data; // Aktualizacja danych ruchu dla gracza
        }
    });
    // Funkcja aktualizująca pozycje graczy na serwerze
    function updatePositions() {
        users.forEach(user => {
            const data = movementData[user.id];
            if (data) {
                // Ruch dla graczy 'blue' i 'red' (góra-dół)
                if (user.color === 'blue' || user.color === 'red') {
                    user.position.y += data.y;
                    user.position.y = Math.max(0, Math.min(user.position.y, boardHeight - user.height));
                }
                // Ruch dla graczy 'green' i 'yellow' (lewo-prawo)
                if (user.color === 'green' || user.color === 'yellow') {
                    user.position.x += data.x;
                    user.position.x = Math.max(0, Math.min(user.position.x, boardWidth - user.width));
                }
                // Emitowanie zaktualizowanej pozycji do wszystkich klientów
                io.sockets.emit('playerMoved', user);
            }
        });
    }
    // Uruchomienie interwału aktualizującego pozycje graczy
    setInterval(updatePositions, 1000 / 60); // 60 razy na sekundę

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

