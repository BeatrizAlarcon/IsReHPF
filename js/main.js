'use strict';

//---------------------------------- AUX ---------------------------------------
function trace(text) {
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}

function log(text){
  console.log("main.js : "+text);
}
//---------------------------------- end AUX -----------------------------------



//--------------------------------sockets.on------------------------------------
var isCreator=false;
var isConnectionReady=false;
var isLocalConnectionCreated=false;

var socket = io.connect();
// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true };

socket.on('created', function (msg){
  var message = JSON.parse(msg);
  log('-> created room '+ message.roomName + ' by '+ message.userName);
  isCreator=true;
  //start!!!!
  start();
});

socket.on('join', function (msg){
  var message = JSON.parse(msg);
  log('-> Another peer has joined to room '+ message.roomName + '; His/Her name is '+ message.userName);
  isConnectionReady=true;
  //startConnection();

});

socket.on('joined', function (msg){
  var message = JSON.parse(msg);
  log('-> joined at room '+ message.roomName + ' user '+ message.userName);
  isCreator=false;
  isConnectionReady=true;
  //start!!!!
  start();
});

socket.on('full', function (msg){
  var message = JSON.parse(msg);
  log('Room '+ message.roomName  +' is full; user '+ message.userName+' is out.');
});

socket.on('log', function (array){
  console.log.apply(console, array);
});

socket.on('message', function (message) {
  log('Received message:', message);
});

socket.on('offerted',function (message){
  try{
    var msg = JSON.parse(message);
    var room = msg.roomName;
    var sdpOffer = msg.sdpOffer;
    console.log("creador? "+ isCreator +" LocalConnectionCreated? "+isLocalConnectionCreated);
    if (!isCreator || !isLocalConnectionCreated){
      start();
    }
    if (isCreator && isLocalConnectionCreated){
      console.log("creo DataChannel");
      createDataChannel();
    }
    log("++++ Ha llegado una oferta +++" + sdpOffer)
    localPeerConnection.setRemoteDescription(new RTCSessionDescription(sdpOffer));
    // log("\n+-----+\nSet Remote Description (Offer): \n");
    // console.log(sdpOffer);
    // log("\n-----");
    sendAnswer();
  }catch(e){
    log("Exception offerted: "+e);
  }
});

socket.on('answered',function(message){
  try{
    var msg = JSON.parse(message);
    var room = msg.roomName;
    var sdpAnswer = msg.sdpAnswer;
    // log("++++ Ha llegado una respuesta +++")
    // log("\n+-----+\nReciv Answer: \n");
    // console.log(sdpAnswer);
    // log("\n-----");
    localPeerConnection.setRemoteDescription(new RTCSessionDescription(sdpAnswer));
  }catch(e){
    log("Exception answered "+e);
  }
});

socket.on('ICECandidated',function (message){
  try{
    // log("++++ Ha llegado un candidato +++")
    // log("\n+-----+\nReciv candidate: \n");
    // console.log(message);
    // log("\n-----");
    var msg = JSON.parse(message);
    var room = msg.roomName;
    var sdpMLineIndex = msg.sdpMLineIndex;
    var candidate = msg.candidate;
    //trace('remote ice candidate');
    if (candidate) {
      localPeerConnection.addIceCandidate(new RTCIceCandidate({sdpMLineIndex:sdpMLineIndex,candidate:candidate}));
    }
  }catch(e){
    log("Exception ICECandidated "+e);
  }
});
//-----------------------------end sockets.on-----------------------------------

//---------------------------------- UI ----------------------------------------
var room;
var user;

var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");
var joinRoomButton = document.getElementById("joinroom");
var sendButton = document.getElementById("sendButton");
var localText = document.getElementById("localText");
var remoteText = document.getElementById("remoteText");

joinRoomButton.disabled = false;
joinRoomButton.onclick = joinRoom;

sendButton.disabled = true;
sendButton.onclick = sendData;

function getLocalText(){
  return document.getElementById("localText").value;
}

function setRemoteText(data){
  document.getElementById("remoteText").value = data;
}

function createStream(stream){
  localVideo.src = URL.createObjectURL(stream);
}
function createRemoteStream(stream){
  remoteVideo.src = URL.createObjectURL(stream);
}

function joinRoom() {
  room = document.getElementById("idroom").value;
  user = document.getElementById("iduser").value;
  if (room !== "") {
    if (user !== "") {
      log('Joining room ' + room + ': user '+ user);
      var msg = {roomName : room,
      userName : user};
      trace("Emito create or join room "+ msg.roomName +" by "+ msg.userName);
      socket.emit("create or join",JSON.stringify(msg));
    }else{
      alert("Please enter a username");
    }
  }else{
    alert("It is not possible to access the room ''");
  }
}

function handleMessageUI(enable){
  trace("Message UI enable? "+enable);
  if (enable) {
    localText.disabled = false;
    localText.focus();
    localText.placeholder = "";
    sendButton.disabled = false;
  } else {
    localText.disabled = true;
    sendButton.disabled = true;
    localText.placeholder = "";
    remoteText.placeholder = "";
  }
}
//-------------------------------- end UI --------------------------------------


//---------------------------------manager--------------------------------------

var localStream = null;
var localPeerConnection;
var sendRecvChannel;

function start() {
  trace("Requesting local stream");
  getUserMedia(
    {audio:true, video:true},
    handleUserMedia,
    function(error) {
      localStream = null;
      trace("getUserMedia error: ", error);
    });
}

function handleUserMedia(stream){
  trace("Received local stream");
  createStream(stream);
  localStream = stream;
  if (localStream.getVideoTracks().length > 0) {
    trace('Using video device: ' + localStream.getVideoTracks()[0].label);
  }
  if (localStream.getAudioTracks().length > 0) {
    trace('Using audio device: ' + localStream.getAudioTracks()[0].label);
  }
  handleConnection();
}

function handleConnection(){
  //Create localPeerConnection ; new RTCPeerConnection !!!
  var servers = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'},{'url': 'turn:numb.viagenie.ca','username':'b.alarcon@alumnos.urjc.es','credential':'pass'}]}:
                //{'iceServers': [{'url':'stun:23.21.150.121'}]} :
                {'iceServers': [{'url': 'stun:stun.l.google.com:19302'},{'url': 'turn:numb.viagenie.ca','username':'b.alarcon@alumnos.urjc.es','credential':'pass'}]};

  var pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true},
                                    {'RtpDataChannels': true}]};
  try{
    localPeerConnection = new RTCPeerConnection(servers,pc_constraints);
    trace('\nCreated RTCPeerConnection connection :\n'+'servers: '+ JSON.stringify(servers)+
          '\nconstraints: '+ JSON.stringify(pc_constraints));
  } catch (e){
    trace('RTCPeerConnection() failed with exception: ' + e.message);
  }

  localPeerConnection.onicecandidate = handleIceCandidate;
  localPeerConnection.onaddstream = handleRemoteStream;
  localPeerConnection.onremovestream = handleRemoveRemoteStream;
  localPeerConnection.addStream(localStream);
  log("Added localStream to localPeerConnection");
  localPeerConnection.ondatachannel=handleReceiveChannel;
  trace('------------------------------------------------------- receive Channel');

  isLocalConnectionCreated = true;

  if (isConnectionReady){
    createDataChannel();
    startConnection();
  }
}

function startConnection(){
    //start connection !!!
    //server -> create or join
    var constraints = {'MozDontOfferDataChannel': true};
    // temporary measure to remove Moz* constraints in Chrome
    if (webrtcDetectedBrowser === 'chrome') {
      for (var prop in constraints) {
        if (prop.indexOf('Moz') !== -1) {
          delete constraints[prop];
        }
       }
     }
    constraints = mergeConstraints(constraints, sdpConstraints);
    log('Sending offer to peer, with constraints: \n' +
      '  \'' + JSON.stringify(constraints) + '\'.');
    localPeerConnection.createOffer(constraints).then(doOffer).catch(errorOffer);
}

function createDataChannel(){
  console.log("createDataChannel: creador? "+ isCreator +" isConnectionReady? "+isConnectionReady);
  if (isConnectionReady){
    //Create DataChannel
    try {
      sendRecvChannel = localPeerConnection.createDataChannel("sendDataChannel", {reliable: false});
      sendRecvChannel.onmessage = handleMessage;
      sendRecvChannel.onopen = handleSendChannelStateChange;
      sendRecvChannel.onclose = handleSendChannelStateChange;
      trace('----------------------------------------------------- Created send data channel');
      var readyState = sendRecvChannel.readyState;
      trace('Send channel state is: ' + readyState);
    } catch (e) {
      alert('Failed to create data channel. ' +
      'You need Chrome M25 or later with RtpDataChannel enabled');
      trace('createDataChannel() failed with exception: ' + e.message);
    }
  }else{
    //localPeerConnection.ondatachannel = handleReceiveChannel;
    //trace('------------------------------------------------------- receive Channel');
    //var readyState = sendRecvChannel.readyState;
    //trace('Send channel state is: ' + readyState);
  }
}

function sendAnswer(){
  //log('Go to send answer')
  localPeerConnection.createAnswer(sdpConstraints).then(doAnswer).catch(errorAnswer);
}

function handleIceCandidate(event) {
  if (event.candidate){
    //trace('ICE candidate: '+ event.candidate.candidate);
    try{
      var msg = {roomName : room,
      sdpMLineIndex : event.candidate.sdpMLineIndex,
      candidate : event.candidate.candidate};
      //socket.emit('ICECandidate',event.candidate);
      sentToSocket("ICECandidate",JSON.stringify(msg));
    }catch(e){
      console.log("ICECandidate error: "+e);
    }
  }else{
    trace('ICE cantidates finish');
  }
}

function handleRemoveRemoteStream(event){

}

function handleMessage(event) {
  trace('Received message: ' + event.data);
  setRemoteText(event.data);
}

function handleSendChannelStateChange() {
  var readyState = sendRecvChannel.readyState;
  trace('Send channel state is: ' + readyState);
  handleMessageUI(readyState == "open") ;
}

function handleReceiveChannelStateChange() {
  var readyState = sendRecvChannel.readyState;
  trace('Receive channel state is: ' + readyState);
  handleMessageUI(readyState == "open") ;
}

function handleReceiveChannel(event) {
  trace('--------------------------------------------Receive Channel Callback');
  sendRecvChannel = event.channel;
  sendRecvChannel.onmessage = handleMessage;
  sendRecvChannel.onopen = handleReceiveChannelStateChange;
  sendRecvChannel.onclose = handleReceiveChannelStateChange;
  //sendRecvChannel.onconnecting = handleReceiveChannelChange;
}

function mergeConstraints(cons1, cons2) {
  var merged = cons1;
  for (var name in cons2) {
    merged[name] = cons2[name];
  }
  return merged;
}

// Set Opus as the default audio codec if it's present.
function preferSdp(sdp) {
  var sdpLines = sdp.split('\r\n');
  var index;
  var i=0;
  var found= false;
  while (i < sdpLines.length && !found){
    found=sdpLines[i].search('m=audio') !== -1;
    if (found){
      return sdp;
    }
    i++;
  }
  // If it's posible set Opus at default
  i=0;
  found=false;
  while (i < sdpLines.length && !found){
    found =(sdpLines[i].search('opus/48000') !== -1)
    if (found) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[index], opusPayload);
      }else{
        found = false;
      }
    }
  }
  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

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
function sentToSocket(subject,message){
  //log("SentToSocket: "+subject+" - "+ message);
  socket.emit(subject,message);
}
function doOffer(sdpOffer){
  sdpOffer.sdp=preferSdp(sdpOffer.sdp);
  sdpOffer.sdp=sdpOffer.sdp.replace(/a=mid:data\r\n/g, 'a=mid:data\r\nb=AS:'+300+'\r\n');
  localPeerConnection.setLocalDescription(sdpOffer);
  var msg = {roomName : room,
  sdpOffer : sdpOffer};
  //socket.emit('offer',JSON.stringify(msg));
  sentToSocket("offer",JSON.stringify(msg));
  // log("\n+--Emit Offer--+\nSet Local Description and Send Offer: \n");
  // console.log(msg);
  // log("\n-----");
}

function errorOffer(error) {
    log("createOffer error: ", error);
}

function doAnswer(sdpAnswer){
  sdpAnswer.sdp=preferSdp(sdpAnswer.sdp);
  localPeerConnection.setLocalDescription(sdpAnswer);
  var msg = {roomName : room,
  sdpAnswer : sdpAnswer};
  // log("\n+-----+\nSet Local Description and Send Answer: \n");
  // console.log(msg.sdpAnswer);
  // log("\n-----");
  try{
    //socket.emit('answer',JSON.stringify(msg));
    sentToSocket("answer",JSON.stringify(msg));
    // log("\n+-----+\nSet Local Description and Send Answer: \n");
    // console.log(msg.sdpAnswer);
    // log("\n-----");
  }catch(e){
    console.log("do Answer error: "+e);
  }
}
function errorAnswer(error) {
    log("createAnswer error: ", error);
}

function hangup() {
  trace("Ending call");
  localPeerConnection.close();
  localPeerConnection = null;
}

function handleRemoteStream(event){
  console.log("Cambios en el canal? "+event.channel);
  if (event.stream){
    log("Received remote stream");
    createRemoteStream(event.stream);
    remoteVideo=event.stream;
  }
}

function sendData() {
  var data = getLocalText();
  sendRecvChannel.send(data);
  trace('Sent data: ' + data);
}

function closeDataChannels() {
  trace('Closing data channels');
  sendRecvChannel.close();
  trace('Closed data channel with label: ' + sendRecvChannel.label);
  localPeerConnection.close();
  localPeerConnection = null;
  trace('Closed peer connections');
}
