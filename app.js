const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.get('/', function(req, res){
   res.sendFile(path.join(__dirname, 'index.html'));
});

const rooms = {
   'Room1': { users: [], limit: 2 },  // Room with 2 users limit
   'Room2': { users: [], limit: 3 },  // Room with 3 users limit
   'Room3': { users: [], limit: 4 },  // Room with 4 users limit
};

io.on('connection', function(socket){
   console.log('A user connected');

   socket.on('setUsername', function(data){
      const { username, room } = data;

      if (!rooms[room]) {
         socket.emit('noRoom', 'Room does not exist. Please select a valid room.');
      } else if (rooms[room].users.length >= rooms[room].limit) {
         socket.emit('roomFull', 'Room is full! Try another room.');
      } else if (rooms[room].users.includes(username)) {
         socket.emit('userExists', username + ' is taken! Try another username.');
      } else {
         rooms[room].users.push(username);
         socket.join(room);  // Join the room
         socket.room = room;
         socket.username = username;
         socket.emit('userSet', { username, room });
         io.to(room).emit('newmsg', { user: 'System', message: `${username} has joined ${room}!` });
      }
   });

   socket.on('msg', function(data){
      const room = socket.room;
      io.to(room).emit('newmsg', data);  // Send message only to users in the room
   });

   socket.on('disconnect', function(){
      const room = socket.room;
      if (room && rooms[room]) {
         rooms[room].users = rooms[room].users.filter(user => user !== socket.username);
         io.to(room).emit('newmsg', { user: 'System', message: `${socket.username} has left ${room}.` });
      }
   });
});

http.listen(3000, function(){
   console.log('listening on localhost:3000');
});

