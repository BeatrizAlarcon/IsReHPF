'use strict';

//---------------------------------- AUX ---------------------------------------
function trace(text) {
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}
//---------------------------------- end AUX -----------------------------------



//--------------------------------sockets.on------------------------------------
var isCreator=false;
var isConnectionReady=false;

var socket = io.connect();

socket.on('created', function (msg){
  var message = JSON.parse(msg);
  console.log('-> created room '+ message.roomName + ' by '+ message.userName);
  isCreator=true;
});

socket.on('join', function (msg){
  var message = JSON.parse(msg);
  console.log('-> Another peer has joined to room '+ message.roomName + '; His/Her name is '+ message.userName);
  isConnectionReady=true;
});

socket.on('joined', function (msg){
  var message = JSON.parse(msg);
  console.log('-> joined at room '+ message.roomName + ' user '+ message.userName);
  isCreator=false;
  isConnectionReady=true;
});

socket.on('full', function (msg){
  var message = JSON.parse(msg);
  console.log('Room '+ message.roomName  +' is full; user '+ message.userName+' is out.');
});

socket.on('log', function (array){
  console.log.apply(console, array);
});

/*socket.on('asnwerfor2',function(respuesta){
  localPeerConnection.setLocalDescription(localSDP);
  trace("Offer from localPeerConnection: \n" + description.sdp);
  localPeerConnection.setRemoteDescription(respuesta);
});

socket.on('offerfor1',function (sdpOferta){
  localPeerConnection.setLocalDescription(localSDP);
  localPeerConnection.setRemoteDescription(sdpOferta);
  localPeerConnection.createAnswer(function(sdpAnswer){
    socket.emit('asnwerfrom1',sdpAnswer);
  }
  ,handleError);
});*/

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
joinRoomButton.onclick = joinroom;

sendButton.disabled = true;
sendButton.onclick = sendData;

function getLocalText(){
  return document.getElementById("localText").value;
}

function setRemoteText(data){
  document.getElementById("remoteText").value = data;
}

function joinroom() {
  room = document.getElementById("idroom").value;
  user = document.getElementById("iduser").value;
  if (room !== "") {
    if (user !== "") {
      console.log('Joining room ' + room + ': user '+ user);
      //start!!!!
      start();
    }else{
      alert("Please enter a username");
    }
  }else{
    alert("It is not possible to access the room ''");
  }
}
//-------------------------------- end UI --------------------------------------


//---------------------------------manager--------------------------------------
var localSDP;
var localStream, localPeerConnection;
var sendChannel, receiveChannel;

function start() {
  trace("Requesting local stream");
  getUserMedia(
    {audio:true, video:true},
    handleConnection,
    function(error) {
      trace("getUserMedia error: ", error);
    });
}

function handleConnection(stream){
  trace("Received local stream");
  localVideo.src = URL.createObjectURL(stream);
  localStream = stream;
  if (localStream.getVideoTracks().length > 0) {
    trace('Using video device: ' + localStream.getVideoTracks()[0].label);
  }
  if (localStream.getAudioTracks().length > 0) {
    trace('Using audio device: ' + localStream.getAudioTracks()[0].label);
  }

  var servers = webrtcDetectedBrowser === 'firefox' ?
                {'iceServers': [{'url':'stun:23.21.150.121'}]} :
                ({'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]},
                {'iceServers': [{'url': 'turn:numb.viagenie.ca@b.alarcon@alumnos.urjc.escredentialpass'}]});
  var pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true},
                                    {'RtpDataChannels': true}]};
  // new RTCPeerConnection !!!
  try{
    window.localPeerConnection = new RTCPeerConnection(servers,pc_constraints);
    trace('\nCreated RTCPeerConnection connection :\n'+'servers: '+ JSON.stringify(servers)+
          '\nconstraints: '+ JSON.stringify(pc_constraints));
  } catch (e){
    trace('RTCPeerConnection() failed with exception: ' + e.message);
  }

  try {
    // Reliable Data Channels not yet supported in Chrome
    sendChannel = localPeerConnection.createDataChannel("sendDataChannel",
      {reliable: true});//fiable
    trace('Created send data channel');
  } catch (e) {
    alert('Failed to create data channel. ' +
          'You need Chrome M25 or later with RtpDataChannel enabled');
    trace('createDataChannel() failed with exception: ' + e.message);
  }

  localPeerConnection.onicecandidate = gotLocalCandidate;
  localPeerConnection.onaddstream = gotRemoteStream;
  sendChannel.onopen = handleSendChannelStateChange;
  sendChannel.onclose = handleSendChannelStateChange;

  localPeerConnection.addStream(localStream);
  trace("Added localStream to localPeerConnection");
  //consigo el SDP
  localPeerConnection.createOffer(gotLocalDescription,
    function(error) {
        trace("createOffer error: ", error);
      });
}

function gotLocalDescription(description){
  //guardo el SDP en local
  localSDP = description;
  //emit server
  var msg = {roomName : room,
  userName : user};
  trace("Emito create or join room "+ msg.roomName +" by "+ msg.userName);
  socket.emit("create or join",JSON.stringify(msg));
}

function hangup() {
  trace("Ending call");
  localPeerConnection.close();
  localPeerConnection = null;
  //hangupButton.disabled = true;
  //callButton.disabled = false;
}

function gotRemoteStream(event){
  //ya tengo el stream del otro
  remoteVideo.src = URL.createObjectURL(event.stream);
  trace("Received remote stream");
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
  closeButton.disabled = true;
  dataChannelSend.value = "";
  dataChannelReceive.value = "";
  dataChannelSend.disabled = true;
  dataChannelSend.placeholder = "Press Start, enter some text, then press Send.";
}

function gotLocalCandidate(event) {
  trace('local ice');
  if (event.candidate) {
    socket.emit('sendICECandidate',event.candidate);
    trace('Local ICE candidate: \n' + event.candidate.candidate);
  }
}

function gotReceiveChannel(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
  trace('Received message: ' + event.data);
  setRemoteText(event.data);
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  if (readyState == "open") {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "";
    sendButton.disabled = false;
    closeButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
    closeButton.disabled = true;
  }
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
  console.log("navigator.getUserMedia error: ", error);
}
