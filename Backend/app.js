const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const maxPlayers = 4; 
const users = []; 

let positions = [
    { x: 0, y: 350 },    // Position for the 1st player
    { x: 800, y: 350 },  // Position for the 2nd player
    { x: 350, y: 0 },    // Position for the 3rd player
    { x: 350, y: 800 }   // Position for the 4th player
];

io.on('connection', function(socket) {
    console.log('A user connected');


    if (users.length >= maxPlayers) {
        socket.emit('lobbyFull', 'The lobby is full. Please try again later.');
        socket.disconnect();
        return;
    }

    socket.on('setUsername', function(data) {
        if (users.find(user => user.username === data)) {
            socket.emit('userExists', data + ' username is taken! Try another username.');
        } else {

            const positionIndex = users.length;
            const position = positions[positionIndex];


            const newUser = {
                id: socket.id,
                username: data,
                position: position, 
                ready: false
            };

            users.push(newUser);

            socket.emit('userSet', {
                username: data,
                position: newUser.position 
            });

            console.log(`${data} has joined`);
        }
    });


    socket.on('playerReady', function() {
        const user = users.find(user => user.id === socket.id);
        if (user) {
            user.ready = true;

            const readyUsers = users.filter(user => user.ready).length;
            if (readyUsers === maxPlayers) {
                io.sockets.emit('allPlayersReady', 'All players are ready! The game will now start.');
            } else {
                socket.emit('waiting', `Waiting for ${maxPlayers - readyUsers} more players to be ready.`);
            }
        }
    });
    socket.on('disconnect', function() {
        const index = users.findIndex(user => user.id === socket.id);
        if (index !== -1) {
            console.log(`${users[index].username} has disconnected.`);
            users.splice(index, 1);
        }
    });
});

http.listen(3000, function() {
    console.log('listening on localhost:3000');
});

