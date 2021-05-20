/*
 * window.mozRTCPeerConnection, window.mozRTCSessionDescription, window.mozRTCIceCandidate are now deprecated
 */

RTCPeerConnection = window.RTCPeerConnection || /*window.mozRTCPeerConnection ||*/ window.webkitRTCPeerConnection;
RTCSessionDescription = /*window.mozRTCSessionDescription ||*/ window.RTCSessionDescription;
RTCIceCandidate = /*window.mozRTCIceCandidate ||*/ window.RTCIceCandidate;
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia;



function signal(url, onStream, onError, onClose, onMessage, xirsysResponse) {
    if ("WebSocket" in window) {
        console.log("opening web socket: " + url);
        var ws = new WebSocket(url);
        var pc;
        var iceCandidates = [];
        var hasRemoteDesc = false;
        var isFirefox = typeof InstallTrigger !== 'undefined';// Firefox 1.0+

        function addIceCandidates() {
            if (hasRemoteDesc) {
                iceCandidates.forEach(function (candidate) {
                    pc.addIceCandidate(candidate,
                        function () {
                            console.log("IceCandidate added: " + JSON.stringify(candidate));
                        },
                        function (error) {
                            console.error("addIceCandidate error: " + error);
                        }
                    );
                });
                iceCandidates = [];
            }
        }

        ws.onopen = function () {
            
            /* First we create a peer connection */
            //var config = {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]};
            var config = {
                        iceServers: [{   urls: [ "stun:eu-turn2.xirsys.com" ]}, {   username: "HsUicabP7fG2RiYPtkkEp8HUacCdyQCW-xXu0sj3r9BG7tbKnyTf5sD4w9VRMQt_AAAAAF7ETPBib3phbQ==",   credential: "295de6f0-9a16-11ea-b71a-0242ac140004",   urls: [       "turn:eu-turn2.xirsys.com:80?transport=udp",       "turn:eu-turn2.xirsys.com:3478?transport=udp",       "turn:eu-turn2.xirsys.com:80?transport=tcp",       "turn:eu-turn2.xirsys.com:3478?transport=tcp",       "turns:eu-turn2.xirsys.com:443?transport=tcp",       "turns:eu-turn2.xirsys.com:5349?transport=tcp"   ]}]


                        }

            var options = {optional: []};
            pc = new RTCPeerConnection(config, options);
            iceCandidates = [];
            hasRemoteDesc = false;

            pc.onicecandidate = function (event) {
                if (event.candidate) {
                    var candidate = {
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                        sdpMid: event.candidate.sdpMid,
                        candidate: event.candidate.candidate
                    };
                    var request = {
                        what: "addIceCandidate",
                        data: JSON.stringify(candidate)
                    };
                    ws.send(JSON.stringify(request));
                } else {
                    console.log("end of candidates.");
                }
            };

            if ('ontrack' in pc) {
                pc.ontrack = function (event) {
                    onStream(event.streams[0]);
                };
            } else {  // onaddstream() deprecated
                pc.onaddstream = function (event) {
                    onStream(event.stream);
                };
            }

            pc.onremovestream = function (event) {
                console.log("the stream has been removed: do your stuff now");
            };

            
            pc.ondatachannel = onDataChannel
 /*Troubleshooting Data kanala - ne prolazi preko Interneta

            const dataChannelOptions = {
                ordered: false, // do not guarantee order
                maxPacketLifeTime: 3000, // in milliseconds
              };
            
            const dataChannel =pc.createDataChannel("Testni Datakanal");

            do {
                console.log(dataChannel.readyState)

            }
            while (dataChannel.readyState !== "open")
            
*/



            /* kindly signal the remote peer that we would like to initiate a call */
            var request = {
                what: "call",
                options: {
                    // If forced, the hardware codec depends on the arch.
                    // (e.g. it's H264 on the Raspberry Pi)
                    // Make sure the browser supports the codec too.
                    force_hw_vcodec: true,
                    vformat: 30, /* 30=640x480, 30 fps */
                    trickle_ice: true
                }
            };

            localConstraints = {}
            // localConstraints['audio'] = { mediaSource: "audioCapture" };
            //localConstraints['audio'] = isFirefox ? { echoCancellation: true } : { optional: [{ echoCancellation: true }] };
            if (localConstraints.audio) {
                if (navigator.getUserMedia) {
                    navigator.getUserMedia(localConstraints, function (stream) {
                        if (stream) {
                            pc.addStream(stream);
                        }
                        // localVideoElement.muted = true;
                        //localVideoElement.src = URL.createObjectURL(stream); // deprecated
                        // localVideoElement.srcObject = stream;
                        // localVideoElement.play();
                    }, function (error) {
                        stop();
                        alert("An error has occurred. Check media device, permissions on media and origin.");
                        console.error(error);
                    });
                } else {
                    console.log("getUserMedia not supported");
                }
            }
            console.log("send message " + JSON.stringify(request));
            ws.send(JSON.stringify(request));
        };

        ws.onmessage = function (evt) {
            var msg = JSON.parse(evt.data);
            var what = msg.what;
            var data = msg.data;

            console.log("received message " + JSON.stringify(msg));

            switch (what) {
                case "offer":
                    var mediaConstraints = {
                        optional: [],
                        mandatory: {
                            // OfferToReceiveAudio: true,
                            OfferToReceiveVideo: true
                        }
                    };
                    pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)),
                            function onRemoteSdpSuccess() {
                                hasRemoteDesc = true;
                                addIceCandidates();
                                pc.createAnswer(function (sessionDescription) {
                                    pc.setLocalDescription(sessionDescription);
                                    var request = {
                                        what: "answer",
                                        data: JSON.stringify(sessionDescription)
                                    };
                                    ws.send(JSON.stringify(request));
                                }, function (error) {
                                    onError("failed to create answer: " + error);
                                }, mediaConstraints);
                            },
                            function onRemoteSdpError(event) {
                                onError('failed to set the remote description: ' + event);
                                ws.close();
                            }
                    );

                    break;

                case "answer":
                    break;

                case "message":
                    if (onMessage) {
                        onMessage(msg.data);
                    }
                    break;

                case "iceCandidate": // received when trickle ice is used (see the "call" request)
                    if (!msg.data) {
                        console.log("Ice Gathering Complete");
                        break;
                    }
                    var elt = JSON.parse(msg.data);
                    let candidate = new RTCIceCandidate({sdpMLineIndex: elt.sdpMLineIndex, candidate: elt.candidate});
                    iceCandidates.push(candidate);
                    addIceCandidates(); // it internally checks if the remote description has been set
                    break;

                case "iceCandidates": // received when trickle ice is NOT used (see the "call" request)
                    var candidates = JSON.parse(msg.data);
                    for (var i = 0; candidates && i < candidates.length; i++) {
                        var elt = candidates[i];
                        let candidate = new RTCIceCandidate({sdpMLineIndex: elt.sdpMLineIndex, candidate: elt.candidate});
                        iceCandidates.push(candidate);
                    }
                    addIceCandidates();
                    break;
            }
        };

        ws.onclose = function (event) {
            console.log('socket closed with code: ' + event.code);
            if (pc) {
                pc.close();
                pc = null;
                ws = null;
            }
            if (onClose) {
                onClose();
            }
        };

        ws.onerror = function (event) {
            onError("An error has occurred on the websocket (make sure the address is correct)!");
        };

        this.hangup = function() {
            if (ws) {
                var request = {
                    what: "hangup"
                };
                console.log("send message " + JSON.stringify(request));
                ws.send(JSON.stringify(request));
            }
        };

    } else {
        onError("Sorry, this browser does not support Web Sockets. Bye.");
    }
}


// controller
datachannel = null;

function onDataChannel(event) {
    console.log("onDataChannel()");
    datachannel = event.channel;
    console.log(datachannel)

    event.channel.onopen = function () {
        console.log("Data Channel is open!");``
        //document.getElementById('datachannels').disabled = false;
    };

    event.channel.onerror = function (error) {
        console.error("Data Channel Error:", error);
    };

    event.channel.onmessage = function (event) {
        console.log("Got Data Channel Message:", event.data);
    };

    event.channel.onclose = function () {
        datachannel = null;
        console.log("The Data Channel is Closed");
    };
}

function stop() {
    if (datachannel) {
        console.log("closing data channels");
        datachannel.close();
        datachannel = null;
    }
}

function send_message(msg) {
    if (!datachannel)
      return;
    datachannel.send(msg);
    console.log("message sent: ", msg);
}

var keysDown = {};
var cmd = { speed: 0, steer: 0 };

function keysChanged() {
  cmd.speed = 0;
  cmd.steer = 0;
  if (keysDown[37])
    cmd.steer -= 0.45;
  if (keysDown[38])
    cmd.speed += 0.3;
  if (keysDown[39])
    cmd.steer += 0.45;
  if (keysDown[40])
    cmd.speed -= 0.3;
  sendCmd();
}

function sendCmd() {
  send_message(JSON.stringify(cmd));
}

setInterval(sendCmd, 100);

function keydown(e) {
    if (e.keyCode < 37 || e.keyCode > 40)
      return;
    e.preventDefault();
    keysDown[e.keyCode] = true;
    keysChanged();
}

function keyup(e) {
    e.preventDefault();
    keysDown[e.keyCode] = false;
    keysChanged();
}


// listen to key events
window.addEventListener('keydown', keydown, true);
window.addEventListener('keyup', keyup, true);
