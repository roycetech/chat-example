var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use('/', express.static(__dirname + '/'));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

var count = 1000;
var chatters = {};
var chatterIds = {};
var sockets = {};
var defaultName = 'guest';

var log4js = require('log4js');
var logger = log4js.getLogger();


io.on('connection', function (socket) {
  sockets[socket.id] = socket;
  logger.info('A user connected with ID: ' + socket.id);

  var username = defaultName + count++;

  logger.info('A user with ID: ' + socket.id + ' has been nicknamed: ' + username);
  chatters[socket.id] = username;
  chatterIds[username] = socket.id;
  socket.broadcast.emit('user joined', username);

  socket.emit('user list', chatters);
  socket.emit('welcome', 'Welcome to the server, ' + username);

  var currentUser = function (id) {
    return chatters[id];
  }

  socket.on('chat message', function (msg) {
    socket.broadcast.emit('chat message', {from: currentUser(socket.id), message: msg});
  });

  socket.on('private message', function (obj) {
    logger.debug('private message received: ' + obj);
    var targetId = chatterIds[obj.to];
    var to = sockets[targetId];
    to.emit('private message', {from: currentUser(socket.id), message: obj.msg});
  });

  socket.on('type on', function () {
    logger.debug('type on received from ' + currentUser(socket.id));
    socket.broadcast.emit('type on', currentUser(socket.id));
  });

  socket.on('type off', function () {
    logger.debug('type off received from ' + currentUser(socket.id));
    socket.broadcast.emit('type off', currentUser(socket.id));
  });

  socket.on('change name', function (new_name) {
    console.log('Change name request from ' + username + ' to ' + new_name);

    var name_taken = false;
    Object.keys(chatters).forEach(function (key, index) {
      if (this[key] === new_name) {
        name_taken = true;
        return false;
      }
    }, chatters);

    if (name_taken) {
      socket.emit('change name failed', new_name + ' is already taken.');
    } else {
      socket.broadcast.emit('change name', {
        id: socket.id,
        new_name: new_name,
        old_name: username
      });
      socket.emit('change name success', {
        id: socket.id,
        new_name: new_name,
        old_name: username
      });
    }
    chatters[socket.id] = new_name;
    chatterIds[new_name] = socket.id;
  });

  socket.on('disconnect', function () {
    var leaverName = chatters[socket.id];
    delete chatters[socket.id];
    delete chatterIds[leaverName];
    logger.info('User [' + username + '] has disconnected');
    socket.broadcast.emit('user left', leaverName);
    delete sockets[socket.id];
  });

});

http.listen(3000, function () {
  logger.info('listening on *:3000');
});
