const canvas = document.getElementById('mainCanvas');
const ctx= canvas.getContext('2d');
ctx.font = '30px Arial';

const boardWidth = 800;
const boardHeight = 800;
const boardX = (canvas.width - boardWidth) / 2;
const boardY = (canvas.height - boardHeight) / 2;
const borderWidth = 10;
let players = [];
let isGameRunning = false; // Zmienna stanu gry
const playerSpeed = 2;

// Obiekt przechowujący stan wciśniętych klawiszy
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

function drawBoard() {
    // Shadow style
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Shadow color (black with transparency)
    ctx.shadowBlur = 15; // Shadow blur
    ctx.shadowOffsetX = 0; // Shadow offset in the horizontal direction
    ctx.shadowOffsetY = 0; // Shadow offset in the vertical direction
    // Drawing a filled rectangle
    ctx.fillStyle = 'white';
    ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
    // Border style
    ctx.lineWidth = borderWidth; // Border thickness
    ctx.strokeStyle = 'black'; // Border color
    // Drawing the border of the rectangle
    ctx.strokeRect(boardX - borderWidth / 2, boardY - borderWidth / 2, boardWidth + borderWidth, boardHeight + borderWidth);
    // Restoring default shadow settings
    ctx.shadowColor = 'transparent'; // Disabling shadow
}

// Function to draw player
function drawPlayers() {
    console.log("start drawing players");
    for (let playerId in players) {
        console.log("drawing player", playerId);
        const player = players[playerId];

        ctx.fillStyle = player.color;
        ctx.fillRect(boardX + player.position.x, boardY + player.position.y, player.width, player.height);
        ctx.save();
        ctx.translate(boardX + player.position.x - 10, boardY + player.position.y + 150);
        ctx.rotate(player.angle*Math.PI/180); // Rotate the context
        // Draw player name
        ctx.fillText(player.username, 0, 0);
        ctx.restore(); // Restore previous context state
    }
    console.log("end drawing players");
}

socket.on('currentPlayers', (serverPlayers) => {
    players = serverPlayers;
});

socket.on('playerMoved', (playerData) => {
    const player = players.find(player => player.id === playerData.id);
    if (player) {
        player.position.x = playerData.position.x;
        player.position.y = playerData.position.y;
        drawPlayers();
    } else {
        console.error(`Player with ID ${playerData.id} not found.`);
    }
});


// Function to update player position
function updatePlayerPosition() {
    const movementData = { x: 0, y: 0 };
    if (keys.ArrowUp) movementData.y -= playerSpeed;
    if (keys.ArrowDown) movementData.y += playerSpeed;
    if (keys.ArrowLeft) movementData.x -= playerSpeed;
    if (keys.ArrowRight) movementData.x += playerSpeed;
    socket.emit('playerMovement', movementData);
}

// Event listeners dla wciśnięcia klawisza
window.addEventListener('keydown', (event) => {
    if (event.key in keys) {
        keys[event.key] = true;
    }
});

// Event listeners dla zwolnienia klawisza
window.addEventListener('keyup', (event) => {
    if (event.key in keys) {
        keys[event.key] = false;
    }
});

// Funkcja główna gry
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Czyszczenie canvasa
    if (isGameRunning) {
        drawBoard(); // Rysowanie planszy
        drawPlayers(); // Rysowanie graczy
        updatePlayerPosition(); // Aktualizacja pozycji gracza
    }
    requestAnimationFrame(gameLoop); // Wywołanie gameLoop w następnym cyklu
}

// Funkcja do rozpoczęcia gry
function startGame() {
    isGameRunning = true;
    gameLoop(); // Uruchomienie pętli gry
}