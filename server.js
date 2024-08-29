const express = require('express');
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

let positions = [
    { x: 0, y: 300 },    // Position for the 1st player
    { x: 780, y: 300 },  // Position for the 2nd player
    { x: 300, y: 0 },    // Position for the 3rd player
    { x: 300, y: 780 }   // Position for the 4th player
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
            const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy); // Preserve speed
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
                height: height,
                lives: 3  // Initial lives
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
            if(user.color === 'blue' || user.color === 'red') {
                if(user.position.y >= 0 && user.position.y <= boardHeight - 200){
                    user.position.y += data.y;
                } else if(user.position.y < 0) {
                    user.position.y = 0;
                } else if(user.position.y > boardHeight - 200) {
                    user.position.y = boardHeight - 200;
                }
            }
            if(user.color === 'green' || user.color === 'yellow') {
                if(user.position.x >= 0 && user.position.x <= boardWidth - 200){
                    user.position.x += data.x;
                } else if(user.position.x < 0) {
                    user.position.x = 0;
                } else if(user.position.x > boardWidth - 200) {
                    user.position.x = boardWidth - 200;
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

