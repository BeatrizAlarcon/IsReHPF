'use strict';

/*
    ISRH Práctica Final
    Beatriz Alarcón Iniesta
    2015-2016

    main.js
    versión: 1.0
*/

//---------------------------------- UI ----------------------------------------
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");
var roomText = document.getElementById("idroom");
var userText = document.getElementById("iduser");
var joinRoomButton = document.getElementById("joinroom");
var waitmsg = document.getElementById("comunication");
var container = document.getElementById("container");
var roomTitle = document.getElementById("Title");
var yourID = document.getElementById("yourID");
var oponentID = document.getElementById("oponentID");

joinRoomButton.disabled = false;
sendButton.disabled = true;
sendButton.onclick = sendData;

function enableMessageInterface(shouldEnable) {
    if (shouldEnable) {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "";
    sendButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
  }
}
//-------------------------------- end UI --------------------------------------

//------------------------------- declaraciones --------------------------------
var room;
var user;
var sendChannel;
var isChannelReady;
var isInitiator = false;
var isStarted;
var localStream;
var pc;
var remoteStream;
var turnReady;

var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'},{'url': 'turn:numb.viagenie.ca','username':'b.alarcon@alumnos.urjc.es','credential':'pass'}]} :
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'},{'url': 'turn:numb.viagenie.ca','username':'b.alarcon@alumnos.urjc.es','credential':'pass'}]};

var pc_constraints = {
  'optional': [
    {'DtlsSrtpKeyAgreement': true},
    {'RtpDataChannels': true}
  ]};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true }};

//------------------------------- end declaraciones ----------------------------


//---------------------------------- AUX ---------------------------------------
function log(msg){
  console.log("CM: "+msg);
}
//---------------------------------- end AUX -----------------------------------

//--------------------------------sockets.on------------------------------------
var socket = io.connect();

room = roomText.value;
user = userText.value;

if (room !== '') {
  log('Create or join room', room);
  var msg = {roomName : room,
      userName : user};
      trace("Emito create or join room "+ msg.roomName +" by "+ msg.userName);
      socket.emit("create or join",JSON.stringify(msg));
}

socket.on('created', function (message){
  log('Created room ' + message);
  isInitiator = true;
  waitmsg.hidden = false;
});

socket.on('full', function (room){
  log('Room ' + room + ' is full');
});

socket.on('join', function (message){
  var msg = JSON.parse(message);
  var room = msg.roomName;
  var oponent = msg.userName;
  log('Another peer made a request to join room ' + room);
  log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
  waitmsg.hidden = true;
  container.hidden = false;
  roomTitle.innerHTML = "<h4>"+room+"</h4>";
  yourID.innerHTML = "<h4>"+user+"</h4>";
  oponentID.innerHTML = "<h4>"+oponent+"</h4>";
});

socket.on('joined', function (message){
  var msg = JSON.parse(message);
  var room = msg.roomName;
  var oponent = msg.userName;
  log('This peer has joined room ' + message);
  isChannelReady = true;
  waitmsg.hidden = true;
  container.hidden = false;
  roomTitle.innerHTML = "<h4>"+room+"</h4>";
  yourID.innerHTML = "<h4>"+user+"</h4>";
  oponentID.innerHTML = "<h4>"+oponent+"</h4>";
});

socket.on('log', function (array){
  log.apply(console, array);
});

function sendMessage(message){
	log('Sending message: ', message);
  socket.emit('message', message);
}

socket.on('message', function (message){
  log('Received message:', message);
  if (message === 'got user media') {
  	maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.label,
      candidate:message.candidate});
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

//----------------------------- end sockets.on ---------------------------------


//----------------------------- manager -----------------------------------------
function handleUserMedia(stream) {
  localStream = stream;
  attachMediaStream(localVideo, stream);
  log('Adding local stream.');
  if (localStream.getVideoTracks().length > 0) {
    trace('Using video device: ' + localStream.getVideoTracks()[0].label);
  }
  if (localStream.getAudioTracks().length > 0) {
    trace('Using audio device: ' + localStream.getAudioTracks()[0].label);
  }
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

function handleUserMediaError(error){
  log('getUserMedia error: ', error);
}

var constraints = {audio:true,video: true};

getUserMedia(constraints, handleUserMedia, handleUserMediaError);
log('Getting user media with constraints', constraints);


/*if (location.hostname != "localhost") {
  requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
}*/

function maybeStart() {
  if (!isStarted && localStream && isChannelReady) {
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    if (isInitiator) {
      doCall();
    }
    initWebGL(isInitiator);
  }
}

window.onbeforeunload = function(e){
	sendMessage('bye');
}


function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    pc.onicecandidate = handleIceCandidate;
    log('Created RTCPeerConnnection with:\n' +
      '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
      '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
  } catch (e) {
    log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
      return;
  }
  pc.onaddstream = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;

  if (isInitiator) {
    try {
      // Reliable Data Channels not yet supported in Chrome
      sendChannel = pc.createDataChannel("sendDataChannel",
        {reliable: false});
      sendChannel.onmessage = handleMessage;
      trace('Created send data channel');
    } catch (e) {
      alert('Failed to create data channel. ' +
            'You need Chrome M25 or later with RtpDataChannel enabled');
      trace('createDataChannel() failed with exception: ' + e.message);
    }
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onclose = handleSendChannelStateChange;
  } else {
    pc.ondatachannel = gotReceiveChannel;
  }
}

function sendData() {
  var data = sendTextarea.value;
  sendChannel.send(data);
  trace('Sent data: ' + data);
}

// function closeDataChannels() {
//   trace('Closing data channels');
//   sendChannel.close();
//   trace('Closed data channel with label: ' + sendChannel.label);
//   receiveChannel.close();
//   trace('Closed data channel with label: ' + receiveChannel.label);
//   localPeerConnection.close();
//   remotePeerConnection.close();
//   localPeerConnection = null;
//   remotePeerConnection = null;
//   trace('Closed peer connections');
//   startButton.disabled = false;
//   sendButton.disabled = true;
//   closeButton.disabled = true;
//   dataChannelSend.value = "";
//   dataChannelReceive.value = "";
//   dataChannelSend.disabled = true;
//   dataChannelSend.placeholder = "Press Start, enter some text, then press Send.";
// }

function gotReceiveChannel(event) {
  trace('Receive Channel Callback');
  sendChannel = event.channel;
  sendChannel.onmessage = handleMessage;
  sendChannel.onopen = handleReceiveChannelStateChange;
  sendChannel.onclose = handleReceiveChannelStateChange;
}

function sendPos(r, px, py) {
  var data = JSON.stringify({posR: r, posPx: px, posPy: py});
  sendChannel.send(data);
}

function handleMessage(event) {
  try {
    var data = JSON.parse(event.data);
    if (isInitiator) {
      posB_x = data.posR;
    } else {
      posA_x = data.posR;
      posP_x = data.posPx;
      posP_y = data.posPy;
      if (Math.abs(posP_y) > heightArena) {
        checkScore(posP_y);
      }
    }
  }
  catch(e) {
    trace('Received message: ' + event.data);
    receiveTextarea.value = event.data;
  }
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  enableMessageInterface(readyState == "open");
}

function handleReceiveChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Receive channel state is: ' + readyState);
  enableMessageInterface(readyState == "open");
}

function handleIceCandidate(event) {
  log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate});
  } else {
    log('End of candidates.');
  }
}

function doCall() {
  var constraints = {'optional': [], 'mandatory': {'MozDontOfferDataChannel': true}};
  // temporary measure to remove Moz* constraints in Chrome
  if (webrtcDetectedBrowser === 'chrome') {
    for (var prop in constraints.mandatory) {
      if (prop.indexOf('Moz') !== -1) {
        delete constraints.mandatory[prop];
      }
     }
   }
  constraints = mergeConstraints(constraints, sdpConstraints);
  log('Sending offer to peer, with constraints: \n' +
    '  \'' + JSON.stringify(constraints) + '\'.');
  pc.createOffer(constraints).then(setLocalAndSendMessage).catch(errorOffer);
}

function errorOffer(error) {
    log("createOffer error: ", error);
}

function doAnswer() {
  log('Sending answer to peer.');
  pc.createAnswer(sdpConstraints).then(setLocalAndSendMessage).catch(errorAnswer);
}

function errorAnswer(error) {
    log("createAnswer error: ", error);
}

function mergeConstraints(cons1, cons2) {
  var merged = cons1;
  for (var name in cons2.mandatory) {
    merged.mandatory[name] = cons2.mandatory[name];
  }
  merged.optional.concat(cons2.optional);
  return merged;
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

/*function requestTurn(turn_url) {
  var turnExists = false;
  for (var i in pc_config.iceServers) {
    if (pc_config.iceServers[i].url.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    log('Getting TURN server from ', turn_url);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
      	log('Got TURN server: ', turnServer);
        pc_config.iceServers.push({
          'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turn_url, true);
    xhr.send();
  }
}*/

function handleRemoteStreamAdded(event) {
  log('Remote stream added.');
  attachMediaStream(remoteVideo, event.stream);
  remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  log('Remote stream removed. Event: ', event);
}

function hangup() {
  log('---------- Hanging up.');
  stop();
  sendMessage('---------- bye');
}

function handleRemoteHangup() {
  log('----------- Session terminated.');
  stop();
  isInitiator = false;
  waitmsg.hidden = false;
  container.hidden = true;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        mLineIndex = i;
        break;
      }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  // sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
/*function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}*/
