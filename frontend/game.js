const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
ctx.font = '30px Arial';

const boardWidth = 800;
const boardHeight = 800;
const boardX = (canvas.width - boardWidth) / 2;
const boardY = (canvas.height - boardHeight) / 2;
const borderWidth = 10;
let players = [];
let isGameRunning = false;

const playerSpeed = 2;

// Ball object
const ball = {
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

        ctx.fillStyle = player.color;
        ctx.fillRect(boardX + player.position.x, boardY + player.position.y, player.width, player.height);
        ctx.save();
        const textWidth = ctx.measureText(player.username).width; 
        if(player.color === 'blue') {
            ctx.translate(boardX + player.position.x - player.width, boardY + player.position.y + player.height - ((player.height - textWidth) / 2));
        } else if(player.color === 'red') {
            ctx.translate(boardX + player.position.x + 2*player.width, boardY + player.position.y + ((player.height - textWidth) / 2));
        } else if(player.color === 'green') {
            ctx.translate(boardX + player.position.x + ((player.width - textWidth) / 2), boardY + player.position.y - player.height);
        } else if(player.color === 'yellow') {
            ctx.translate(boardX + player.position.x + ((player.width - textWidth) / 2), boardY + player.position.y + 3*player.height);
        }
        ctx.rotate(player.angle*Math.PI/180); 
        // Draw player name
        ctx.fillText(player.username, 0, 0);
        ctx.restore(); 
        
        // Draw player lives
        ctx.fillStyle = 'black';
        ctx.fillText(`Lives: ${player.lives}`, boardX + player.position.x + player.width / 2, boardY + player.position.y - 10);
    }
}

// Function to draw ball
function drawBall() {
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(boardX + ball.x, boardY + ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
}

// Function to update player position
function updatePlayerPosition() {
    const movementData = { x: 0, y: 0 };
    if (keys.ArrowUp) movementData.y -= playerSpeed;
    if (keys.ArrowDown) movementData.y += playerSpeed;
    if (keys.ArrowLeft) movementData.x -= playerSpeed;
    if (keys.ArrowRight) movementData.x += playerSpeed;
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
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isGameRunning) {
        drawBoard(); 
        drawPlayers(); 
        drawBall(); 
        updatePlayerPosition(); 
    }
    requestAnimationFrame(gameLoop);
}

// Function to start the game
function startGame() {
    isGameRunning = true;
    gameLoop();
}

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
    alert(message);
    isGameRunning = false;
    document.getElementById('mainCanvas').style.display = 'none';
    document.getElementById('game').style.display = 'block';
});

