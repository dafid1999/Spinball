const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
ctx.font = '20px Arial';

const boardWidth = 700;
const boardHeight = 700;
const boardX = (canvas.width - boardWidth) / 2;
const boardY = (canvas.height - boardHeight) / 2;
const borderWidth = boardWidth / 100;
let players = [];
let obstacles = [];
let isGameRunning = false;
let lastTime = 0;
let accumulatedTime = 0;
const FPS = 60;
const frameTime = 1000 / FPS;

const playerSpeed = 300;

// Ball object
let ball = {
    x: boardWidth / 2,
    y: boardHeight / 2,
    radius: 10,
    dx: 0,
    dy: 0
};

// Object to store key states
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// Load the heart image
const heartImage = new Image();
heartImage.src = '../images/heart.png';

function drawBoard() {
    // Shadow style
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    // Drawing a filled rectangle
    ctx.fillStyle = 'white';
    ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
    // Border style
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = 'black';
    // Drawing the border of the rectangle
    ctx.strokeRect(boardX - borderWidth / 2, boardY - borderWidth / 2, boardWidth + borderWidth, boardHeight + borderWidth);
    // Restoring default shadow settings
    ctx.shadowColor = 'transparent';
}

// Function to draw player
function drawPlayers() {
    for (let playerId in players) {
        const player = players[playerId];
        if(player.ready){
            ctx.fillStyle = player.color;
            ctx.fillRect(boardX + player.position.x, boardY + player.position.y, player.width, player.height);
            ctx.save();

            const textWidth = ctx.measureText(player.username).width;
            let nameX, nameY, heartsX, heartsY;
            let transX = boardX + player.position.x;
            let transY = boardY + player.position.y;
            ctx.translate(transX, transY);
            ctx.rotate(player.angle * Math.PI / 180);

            if (player.color === 'blue') {
                nameX = (player.height - textWidth) / 2 - player.height;
                nameY = -2.5 * player.width;
                heartsX = (player.height - (player.lives * 25)) / 2 - player.height;
                heartsY = -2 * player.width;
            } else if (player.color === 'red') {
                nameX = (player.height - textWidth) / 2;
                nameY = -3.5 * player.width;
                heartsX = (player.height - (player.lives * 25)) / 2;
                heartsY = -3 * player.width;
            } else if (player.color === 'green') {
                nameX = (player.width - textWidth) / 2;
                nameY = -2.5 * player.height;
                heartsX = (player.width - player.lives * 25) / 2;
                heartsY = -2 * player.height;
            } else if (player.color === 'yellow') {
                nameX = (player.width - textWidth) / 2;
                nameY = 4.5 * player.height;
                heartsX = (player.width - player.lives * 25) / 2;
                heartsY = 2 * player.height;
            }
            // Draw player name
            ctx.fillText(player.username, nameX, nameY);
            // Draw player lives as hearts
            for (let i = 0; i < player.lives; i++) {
                ctx.drawImage(heartImage, heartsX + i * 25, heartsY, 20, 20);
            }
            ctx.restore();
         }
    }
}

// Function to draw ball
function drawBall() {
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(boardX + ball.x, boardY + ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
}
// Function to draw obstacles
function drawObstacles() {
    ctx.fillStyle = 'gray';
    obstacles.forEach(obstacle => {
        ctx.beginPath();
        ctx.moveTo(boardX + obstacle.x + obstacle.cornerRadius, boardY + obstacle.y);
        ctx.lineTo(boardX + obstacle.x + obstacle.width - obstacle.cornerRadius, boardY + obstacle.y);
        ctx.quadraticCurveTo(boardX + obstacle.x + obstacle.width, boardY + obstacle.y, boardX + obstacle.x + obstacle.width, boardY + obstacle.y + obstacle.cornerRadius);
        ctx.lineTo(boardX + obstacle.x + obstacle.width, boardY + obstacle.y + obstacle.height - obstacle.cornerRadius);
        ctx.quadraticCurveTo(boardX + obstacle.x + obstacle.width, boardY + obstacle.y + obstacle.height, boardX + obstacle.x + obstacle.width - obstacle.cornerRadius, boardY + obstacle.y + obstacle.height);
        ctx.lineTo(boardX + obstacle.x + obstacle.cornerRadius, boardY + obstacle.y + obstacle.height);
        ctx.quadraticCurveTo(boardX + obstacle.x, boardY + obstacle.y + obstacle.height, boardX + obstacle.x, boardY + obstacle.y + obstacle.height - obstacle.cornerRadius);
        ctx.lineTo(boardX + obstacle.x, boardY + obstacle.y + obstacle.cornerRadius);
        ctx.quadraticCurveTo(boardX + obstacle.x, boardY + obstacle.y, boardX + obstacle.x + obstacle.cornerRadius, boardY + obstacle.y);
        ctx.fill();
    });
}

// Function to update player position
function updatePlayerPosition(deltaTime) {
    const movementData = { x: 0, y: 0 };
    if (keys.ArrowUp) movementData.y -= playerSpeed * deltaTime;
    if (keys.ArrowDown) movementData.y += playerSpeed * deltaTime;
    if (keys.ArrowLeft) movementData.x -= playerSpeed * deltaTime;
    if (keys.ArrowRight) movementData.x += playerSpeed * deltaTime;
    socket.emit('playerMovement', movementData);
}

// Event listeners for key presses
window.addEventListener('keydown', (event) => {
    if (event.key in keys) {
        keys[event.key] = true;
    }
});

// Event listeners for key releases
window.addEventListener('keyup', (event) => {
    if (event.key in keys) {
        keys[event.key] = false;
    }
});

// Main game loop function
function gameLoop(timestamp) {
    if (lastTime === 0) lastTime = timestamp;

    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    accumulatedTime += deltaTime;

    if (!isNaN(deltaTime)) {  // Sprawdzamy, czy deltaTime jest poprawną liczbą
        accumulatedTime += deltaTime;
    } else {
        accumulatedTime = 0;  // Jeśli deltaTime byłby NaN, ustawiamy accumulatedTime na 0
    }

    if (isGameRunning) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBoard();
        drawPlayers();
        drawBall();
        drawObstacles();
        if (accumulatedTime >= frameTime) {
            updatePlayerPosition(frameTime / 1000);
            accumulatedTime -= frameTime;
        }
    }
    requestAnimationFrame(gameLoop);
}

// Function to start the game
function startGame() {
    isGameRunning = true;
    gameLoop();
}

socket.on('obstaclesUpdated', (serverObstacles) => {
    obstacles = serverObstacles;
})

// Listen for ball position updates
socket.on('ballMoved', (serverBall) => {
    ball.x = serverBall.x;
    ball.y = serverBall.y;
    ball.dx = serverBall.dx;
    ball.dy = serverBall.dy;
});

// Listen for player updates
socket.on('currentPlayers', (serverPlayers) => {
    players = serverPlayers;
});

// Listen for player movement updates
socket.on('playerMoved', (playerData) => {
    const player = players.find(player => player.id === playerData.id);
    if (player) {
        player.position.x = playerData.position.x;
        player.position.y = playerData.position.y;
    } else {
        console.error(`Player with ID ${playerData.id} not found.`);
    }
});

// Listen for player life updates
socket.on('playerLostLife', (data) => {
    const player = players.find(player => player.id === data.id);
    if (player) {
        player.lives = data.lives;
    } else {
        console.error(`Player with ID ${data.id} not found.`);
    }
});

// Listen for game over
socket.on('gameOver', (message) => {
    isGameRunning = false;
    players = [];
    lastTime = 0;
    accumulatedTime = 0;
    document.getElementById('mainCanvas').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    document.getElementById('status').innerText = message;
});
