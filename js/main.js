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
  //isConnectionReady=true;
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

socket.on('offer',function (sdpOferta){
  log("++++ Ha llegado una oferta +++")
  localPeerConnection.setRemoteDescription(new RTCSessionDescription(sdpOferta));
  log("\n+-----+\nSet Remote Description (Offer): \n");
  console.log(sdpOferta);
  log("\n-----");
  localPeerConnection.createAnswer(function(sdpAnswer){
    sdpAnswer.sdp=preferSdp(sdpAnswer.sdp);
    localPeerConnection.setLocalDescription(sdpAnswer);
    socket.emit('answer',sdpAnswer);
    log("\n+-----+\nSet Local Description and Send Answer: \n");
    console.log(sdpAnswer);
    log("\n-----");
  },function(error){
    log("offer error:" + error);
  },sdpConstraints);
});

socket.on('answer',function(sdpAnswer){
  log("++++ Ha llegado una respuesta +++")
  log("\n+-----+\nReciv Answer: \n");
  console.log(sdpAnswer);
  log("\n-----");
  localPeerConnection.setRemoteDescription(new RTCSessionDescription(sdpAnswer));
});

socket.on('sendICECandidate',function (candidate){
    trace('remote ice candidate');
    if (candidate) {
      localPeerConnection.addIceCandidate(candidate);
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


//---------------------------------manager--------------------------------------

var localStream = null;
var localPeerConnection;
var sendChannel, receiveChannel;

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
                {'iceServers': [{'url':'stun:23.21.150.121'}]} :
                ({'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]},
                {'iceServers': [{'url': 'turn:numb.viagenie.ca@b.alarcon@alumnos.urjc.escredentialpass'}]});
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

  if (isCreator){
    //Create DataChannel
    try {
      sendChannel = localPeerConnection.createDataChannel("sendDataChannel", {reliable: true});
      sendChannel.onmessage = handleMessage;
      sendChannel.onopen = handleSendChannelStateChange;
      sendChannel.onclose = handleSendChannelStateChange;
      trace('Created send data channel');
    } catch (e) {
      alert('Failed to create data channel. ' +
      'You need Chrome M25 or later with RtpDataChannel enabled');
      trace('createDataChannel() failed with exception: ' + e.message);
    }
  }else{
    localPeerConnection.ondatachannel = gotReceiveChannel;
    trace('receiveChannel');
  }
  if (isConnectionReady){
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

function handleIceCandidate(event) {

}

function handleRemoveRemoteStream(event){

}

function handleMessage(event) {
  trace('Received message: ' + event.data);
  setRemoteText(event.data);
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  handleMessageUI(readyState == "open") ;
}

function gotReceiveChannel(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
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
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
    }
  }
  sdp = sdpLines.join('\r\n');
  return sdp;
}

function doOffer(sdpOffer){
  sdpOffer.sdp=preferSdp(sdpOffer.sdp);
  localPeerConnection.setLocalDescription(sdpOffer);
  socket.emit('offer',sdpOffer);

  log("\n+--Emit Offer--+\nSet Local Description and Send Offer: \n");
  console.log(sdpOffer);
  log("\n-----");
}

function errorOffer(error) {
    log("createOffer error: ", error);
}

function hangup() {
  trace("Ending call");
  localPeerConnection.close();
  localPeerConnection = null;
  //hangupButton.disabled = true;
  //callButton.disabled = false;
}

function handleRemoteStream(event){
  log("Received remote stream");
  createRemoteStream(event.stream);
  remoteVideo=event.stream;
}

function sendData() {
  var data = getLocalText();
  sendChannel.send(data);
  trace('Sent data: ' + data);
}

function closeDataChannels() {
  trace('Closing data channels');
  sendChannel.close();
  trace('Closed data channel with label: ' + sendChannel.label);
  receiveChannel.close();
  trace('Closed data channel with label: ' + receiveChannel.label);
  localPeerConnection.close();
  remotePeerConnection.close();
  localPeerConnection = null;
  remotePeerConnection = null;
  trace('Closed peer connections');
  //startButtonC.disabled = false;
  sendButton.disabled = true;
  dataChannelSend.value = "";
  dataChannelReceive.value = "";
  dataChannelSend.disabled = true;
  dataChannelSend.placeholder = "Press Start, enter some text, then press Send.";
}









function handleReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace('Receive channel state is: ' + readyState);
}
function successCallback(localMediaStream) {
  window.stream = localMediaStream; // stream available to console
  var video = document.querySelector("video");
  video.src = window.URL.createObjectURL(localMediaStream);
  video.play();
}

function errorCallback(error){
  log("navigator.getUserMedia error: ", error);
}
