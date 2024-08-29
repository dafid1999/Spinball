const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
ctx.font = '30px Arial';

const boardWidth = 800;
const boardHeight = 800;
const boardX = (canvas.width - boardWidth) / 2;
const boardY = (canvas.height - boardHeight) / 2;
const borderWidth = 10;

let users = [];
let ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    color: 'black',
    dx: 0,
    dy: 0
};

const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

function drawBoard() {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'white';
    ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = 'black';
    ctx.strokeRect(boardX - borderWidth / 2, boardY - borderWidth / 2, boardWidth + borderWidth, boardHeight + borderWidth);
    ctx.shadowColor = 'transparent';
}

function drawPlayers() {
    users.forEach(user => {
        ctx.fillStyle = 'blue';
        ctx.fillRect(boardX + user.position.x, boardY + user.position.y, 20, 200);
        ctx.fillStyle = 'red';

        const angle = -90 * Math.PI / 180;
        ctx.save();
        ctx.translate(boardX + user.position.x - 10, boardY + user.position.y + 150);
        ctx.rotate(angle);
        ctx.fillText(user.username, 0, 0);
        ctx.restore();
    });
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.closePath();
}

function updateGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    drawBall();
    drawPlayers();
}

window.addEventListener('keydown', (event) => {
    if (event.key in keys) {
        keys[event.key] = true;
        socket.emit('playerMove', { key: event.key });
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key in keys) {
        keys[event.key] = false;
    }
});

