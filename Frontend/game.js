const canvas = document.getElementById('mainCanvas');
const ctx= canvas.getContext('2d');
ctx.font = '30px Arial';

const boardWidth = 800;
const boardHeight = 800;
const boardX = (canvas.width - boardWidth) / 2;
const boardY = (canvas.height - boardHeight) / 2;
const borderWidth = 10;
const playerWidth = 20;
const playerHeight = 200;



// Parametry gracza
const player = {
    name: 'Player1', // Nazwa gracza
    x: 0, // Pozycja początkowa X
    y: 0, // Pozycja początkowa Y
    width: 20, // Szerokość gracza
    height: 200, // Wysokość gracza
    color: 'blue', // Kolor gracza
    speed: 2 // Prędkość poruszania
};

// let players = {};
// Obiekt przechowujący stan wciśniętych klawiszy
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

function drawBoard() {
    // Styl cienia
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; // Kolor cienia (czarny z przezroczystością)
    ctx.shadowBlur = 15; // Rozmycie cienia
    ctx.shadowOffsetX = 0; // Przesunięcie cienia w poziomie
    ctx.shadowOffsetY = 0; // Przesunięcie cienia w pionie

    // Rysowanie prostokąta z wypełnieniem
    ctx.fillStyle = 'white';
    ctx.fillRect(boardX, boardY, boardWidth, boardHeight);
    // Styl obramowania
    ctx.lineWidth = borderWidth; // Grubość obramowania
    ctx.strokeStyle = 'black'; // Kolor obramowania

    // Rysowanie obramowania prostokąta
    ctx.strokeRect(boardX - borderWidth / 2, boardY - borderWidth / 2, boardWidth + borderWidth, boardHeight + borderWidth);
    // Przywrócenie domyślnych ustawień cienia
    ctx.shadowColor = 'transparent'; // Wyłączenie cienia
}

// Funkcja rysująca gracza
function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(boardX + player.x, boardY + player.y, player.width, player.height);
    ctx.fillStyle = 'red';

    // Ustawienia obrotu
    const angle = -90 * Math.PI / 180; // Kąt obrotu w radianach

    ctx.save(); // Zapisz aktualny stan kontekstu
    ctx.translate(boardX + player.x - 10, boardY + player.y + 150); // Przesunięcie na środek prostokąta
    ctx.rotate(angle); // Obrót o 90 stopni

    // Rysowanie tekstu (tekst jest teraz rysowany w punkcie (0,0) względem przesuniętego kontekstu)
    ctx.fillText(player.name, 0, 0);

    // Przywrócenie wcześniejszego stanu kontekstu
    ctx.restore(); // Przywróć wcześniejszy stan kontekstu
}

// Funkcja aktualizująca pozycję gracza
function updatePlayerPosition() {
    if(player.name === 'Player1'
        || player.name === 'Player2') {
        if (keys.ArrowUp && player.y > 0) {
            player.y -= player.speed;
        }
        if (keys.ArrowDown && player.y < boardHeight - player.height) {
            player.y += player.speed;
        }
    } else if(player.name === 'Player3'
        || player.name === 'Player4') {
        if (keys.ArrowLeft && player.x > 0) {
            player.x -= player.speed;
        }
        if (keys.ArrowRight && player.x < boardWidth- player.width) {
            player.x += player.speed;
        }
    }
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
    drawBoard(); // Rysowanie planszy
    updatePlayerPosition(); // Aktualizacja pozycji gracza
    drawPlayer(); // Rysowanie gracza
    requestAnimationFrame(gameLoop); // Wywołanie gameLoop w następnym cyklu
}

// Uruchomienie pętli gry
gameLoop();