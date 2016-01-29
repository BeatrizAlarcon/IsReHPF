var static = require('node-static');
var http = require('http');
var file = new(static.Server)();
var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(2013);


var io = require('socket.io').listen(app);
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
	}

	socket.on('message', function (message) {
		log('Got message:', message);
    // for a real app, would be room only (not broadcast)
		socket.broadcast.emit('message', message);
	});

	socket.on('join', function (mensaje) {
    var msg = JSON.parse(mensaje);
    var room = msg.roomName;
    var aux = io.sockets.adapter.rooms[room];
    log('aux ='+io.sockets.adapter.rooms[room] +' '+room);
		var numClients = aux!=undefined?Object.keys(aux).length:0;
    var srvSockets = io.sockets.sockets;
    var numClientsServer =Object.keys(srvSockets).length;

		log('Room ' + room + ' has ' + numClients + ' client(s)');
		log('Request to create or join room ' + room);
    log('clientes del servidor =' + numClientsServer);

		if (numClients === 0){
			socket.join(room);
      //guardar user en la room
			socket.emit('joined', numClients);
      var aux2 = io.sockets.adapter.rooms[room];
      var numClients2 = Object.keys(aux2).length;
      log('aux2 ='+ Object.keys(io.sockets.adapter.rooms[room]).length + ' '+numClients2 +' '+room);
		} else if (numClients === 1) {
			//io.sockets.in(room).emit('joined', 2)
			socket.join(room);
			socket.emit('joined', numClients);
      socket.broadcast.to(room).emit('offerfor1', msg.sdp);
		} else { // max two clients
			socket.emit('full', room);
		}
		socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
		socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room);

	});
  socket.on('asnwerfrom1', function (mensaje) {
    //socket.broadcast.to(room).emit('asnwerfor2', mensaje);
    socket.broadcast.emit('asnwerfor2', mensaje);
  });

  socket.on('sendICECandidate', function (candidate) {
    //socket.broadcast.to(room).emit('sendICECandidate', candidate);
    socket.broadcast.emit('sendICECandidate', candidate);
  });

});
