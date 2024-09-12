const socket = io();

function setUsername() {
    const username = document.getElementById('username').value;
    socket.emit('setUsername', username);
}

function markReady() {
    socket.emit('playerReady');
    document.getElementById('status').innerText = 'You are ready!';
}

// Listen for username set confirmation
socket.on('userSet', function (data) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    document.getElementById('userDisplay').innerText = data.username;
    document.getElementById('position').innerText = `x: ${data.position.x}, y: ${data.position.y}`;
});

// Listen for a full lobby
socket.on('lobbyFull', function (message) {
    document.getElementById('status').innerText = message;
});

socket.on('invalidUsername', function (message) {
    document.getElementById('statusNick').innerText = message;
});

// Listen for player readiness
socket.on('waiting', function (message) {
    document.getElementById('status').innerText = 'You are ready! ' + message;
});

// Listen for player readiness confirmation
socket.on('gameIsStarted', function (message) {
    document.getElementById('status').innerText = message;
});

// Listen for all players being ready
socket.on('allPlayersReady', function (message) {
    document.getElementById('status').innerText = message;
    let countdown = 3;

    const countdownInterval = setInterval(function () {
        document.getElementById('status').innerText = `Game starting in ${countdown}...`;
        countdown--;
        if (countdown < 0) {
            clearInterval(countdownInterval);
            socket.emit('startGame');
            document.getElementById('game').style.display = 'none';
            document.getElementById('mainCanvas').style.display = 'block';
            document.getElementById('status').innerText = ``;
        }
    }, 1000);
});

function updateOnlinePlayers(players) {
    const onlinePlayers = document.getElementById('playersOnline');
    onlinePlayers.innerHTML = '';
    players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.innerText = `${player.username} - ${player.ready ? 'ready' : 'not ready'}`;
        onlinePlayers.appendChild(playerElement);
    });
}

socket.on('gameOver', function (message) {
    updateReadyButton();
});
function updateReadyButton() {
    const readyButton = document.getElementById('readyButton');
    readyButton.disabled = false;
}


socket.on('playerStateChanged', function (players) {
    updateOnlinePlayers(players);
});

socket.on('gameStarting', function (message) {
    startGame();
    drawPlayers();
});
