const socket = io();

function setUsername() {
    const username = document.getElementById('username').value;
    socket.emit('setUsername', username);
}

function markReady() {
    socket.emit('playerReady');
}

// Listen for username set confirmation
socket.on('userSet', function(data) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    document.getElementById('userDisplay').innerText = data.username;
    document.getElementById('position').innerText = `x: ${data.position.x}, y: ${data.position.y}`;
});

// Listen for a full lobby
socket.on('lobbyFull', function(message) {
    alert(message);
});

// Listen for player readiness
socket.on('waiting', function(message) {
    document.getElementById('status').innerText = message;
});

// Listen for all players being ready
socket.on('allPlayersReady', function(message) {
    document.getElementById('status').innerText = message;
    startGame();
    drawPlayers();
    document.getElementById('game').style.display = 'none';
    document.getElementById('mainCanvas').style.display = 'block';
});

// Listen for game over
socket.on('gameOver', function(message) {
    isGameRunning(false);
    document.getElementById('game').style.display = 'block';
    document.getElementById('mainCanvas').style.display = 'none';
});

