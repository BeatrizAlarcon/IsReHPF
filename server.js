var static = require('node-static');
var http = require('http');
var file = new(static.Server)();
var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(2013);

io = require('socket.io').listen(app);
var sdp1;
var publica;

io.sockets.on('connection', function (socket){

  // convenience function to log server messages on the client
	function log(){
		var array = [">>> Message from server: "];
	  for (var i = 0; i < arguments.length; i++) {
	  	array.push(arguments[i]);
	  }
	    socket.emit('log', array);
	};

  function clients(room){
    return io.sockets.clients(room).length;
  };

	socket.on('message', function (message) {
		log('Got message:', message);
    // for a real app, would be room only (not broadcast)
		socket.broadcast.emit('message', message);
	});

  socket.on('create or join', function (msg) {
    var message = JSON.parse(msg);

    var room = message.roomName;
    var numClients = clients(room);

    log('Room ' + room + ' has ' + numClients + ' client(s)');
		log('Request to create or join room', room);

		if (numClients == 0){
			socket.join(room);
			socket.emit('created', room);
      log('Now: Room ' + room + ' has ' + clients(room) + ' client(s)');
		} else if (numClients == 1) {
			io.sockets.in(room).emit('join', room);
			socket.join(room);
			socket.emit('joined', room);
      log('Now: Room ' + room + ' has ' + clients(room) + ' client(s)');
		} else { // max two clients
			socket.emit('full', room);
      log('Full: Room ' + room + ' has ' + clients(room) + ' client(s)');
		}
		socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
		socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room);

	});
});