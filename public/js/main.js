///<reference path="webrtc_polyfill.js"/>
///<reference path="jquery-2.1.4.min.js"/>
///<reference path="bootstrap.min.js"/>
///<reference path="bootstrap-combobox.js"/>
///<reference path="socket.io.js"/>

var MESSAGE_WAIT = '部屋に参加しました。リモートピアが参加するのを待機しています。';
var MESSAGE_REMOTE_LEAVE = 'リモートピアが退室しました。<br>リモートピアが入室するのを待機してます。';
var MESSAGE_EXIST_STREAM = '指定したストリームは既に追加されています。';
var MESSAGE_OVER = '指定した部屋にはすでに２人入っているため入室できませんでした。(1対1のみ)';
var MESSAGE_ROOMNAME_ERROR = '設定した部屋名が正しくありません。<br>(GUID形式のフォーマット"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"のみ)';
var MESSAGE_NOTFOUND_DEVICE = '使用可能なビデオキャプチャーデバイスがありませんでした。<br>(このサンプルアプリではビデオのみ使用します。)'
var MESSAGE_SIGNALING_SERVER_ERROR = 'シグナリングサーバーに接続できません。';

var configuration = { iceServers: [{ url: 'stun:stun.l.google.com:19302', urls: 'stun:stun.l.google.com:19302' }] };
var pc;// = new RTCPeerConnection(configuration);
var signalingChannel = io.connect('http://' + location.host);
var roomName = '';
var actionName = '';
var localPositionNo = '0';
var remotePositionNo = '0';
var isFirefox = !!window.sidebar;


othorSelectDevice.style.display = isFirefox ? 'none' : '';
firefoxSelectDevice.style.display = isFirefox ? '' : 'none';

var $messageDialog = $('#messageDialog');
var $selectDeviceDialog = $('#selectDeviceDialog');

// ---------------------------
// UI 処理
// ---------------------------

// イベントリスナー設定 -------

btnJoinRoom.addEventListener('click', setFocusTxtRoomName);
btnGenerateRoomName.addEventListener('click', generateRoomName);
formJoinRoom.onsubmit = function (evt) {
  joinRoom();
  return false;
}
txtRoomName.onkeydown = function (evt) {
  (evt.keyCode === 13) && joinRoom();
}
//btnJoin.onclick = joinRoom;
for (var i = 1; i <= 3; i++) {
  document.getElementById('btnAddStream' + i).addEventListener('click', showSelectDeviceDialog);
  document.getElementById('btnRemoveStream' + i).addEventListener('click', removeStream);
}
$messageDialog.on('shown.bs.modal', setFocusDialogRoomName);
$selectDeviceDialog.on('show.bs.modal', deviceChange);
btnDialogAddStream.addEventListener('click', addStream);
deviceList.addEventListener('change', deviceChange);


// 処理メソッド -------------

function setFocusTxtRoomName() {
  setTimeout(function () {
    txtRoomName.focus();
  }, 100);
}
function generateRoomName(evt){
  txtRoomName.value = UUID.generate();
  txtRoomName.focus();
  txtRoomName.select();
}

navigator.mediaDevices.enumerateDevices()
  .then(function (devices) {
    deviceList.innerHTML = '';
    var videoDevices = [];
    devices.forEach(function (device) {
      if (device.kind.indexOf('video') !== -1) {
        videoDevices.push(device);
      }
    });
    if (videoDevices.length) {
      createSelectItem(deviceList, '--デバイスを選択--', '');
      var cnt = 1;
      videoDevices.forEach(function (device) {
        createSelectItem(deviceList, device.label || 'camera-' + cnt, device.id || device.deviceId);
        cnt++;
      });
      deviceList.selectedIndex = 0;
    } else {
      showMessageDialog(MESSAGE_NOTFOUND_DEVICE);
      btnJoinRoom.disabled = true;
    }
  });

function createSelectItem(selectElement, text, value) {
  var option = document.createElement("option");
  option.textContent = text;
  option.value = value;
  selectElement.appendChild(option);
}

function joinRoom() {
  $('#ddmJoinRoom').hide();
  if (txtRoomName.checkValidity()) {
    roomName = txtRoomName.value;
    if (roomName) {
      signalingChannel.emit('join room', roomName);
    }
  }
};

function showSelectDeviceDialog() {
  localPositionNo = this.dataset.no;
  deviceList.selectedIndex = 0;
  $selectDeviceDialog.modal('show');
}

function addStream() {
  actionName = 'add';
  var stream = streamPreview.srcObject;
  streamPreview.srcObject = null;
  $selectDeviceDialog.modal('hide');
  document.getElementById('btnAddStream' + localPositionNo).style.display = 'none';
  document.getElementById('btnRemoveStream' + localPositionNo).style.display = '';
  if (!pc) start();
  var localView = document.getElementById('localView' + localPositionNo);
  pc.addStream(stream);
  localView.srcObject = stream;
  localView.play();
}

function setFocusDialogRoomName() {
  dialogRoomName.focus();
  dialogRoomName.select();
}

function deviceChange() {
  var deviceId = deviceList.value;
  clearStream(streamPreview);
  if (deviceId) {
    deviceList.disabled = true;
    // 現時点での Firefox(v39) では sourceId のオプションは無視される
    var constraints = {
      audio: false,
      video: {
        optional: [{ sourceId: deviceId }]
      }
    };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(function (stream) {
        streamPreview.srcObject = stream;
        streamPreview.play();
        deviceList.disabled = false;
      })
      .catch(function (err) {
        deviceList.disabled = false;
      });
  }
}

function removeStream() {
  actionName = 'remove';
  localPositionNo = this.dataset.no;
  pc.removeStream(document.getElementById('localView' + localPositionNo).srcObject);
}

function showMessageDialog(message, isWaiting, roomName) {
  messageText.innerHTML = message;
  waitingIcon.setAttribute('aria-hidden', isWaiting ? 'false' : 'true');
  messageDialogFooter.style.display = isWaiting ? 'none' : '';
  roomName && message.replace('roomName', roomName);
  $messageDialog.modal('show');
}

function clearStream(video) {
  if (video.srcObject) {
    video.srcObject.stop();
    video.srcObject = null;

  }
}

function clearStreamAll() {
  for (var i = 1; i <= 3; i++) {
    document.getElementById('btnAddStream' + i).style.display = '';
    document.getElementById('btnRemoveStream' + i).style.display = 'none';
    clearStream(document.getElementById('localView' + i));
    clearStream(document.getElementById('remoteView' + i));
  }
}


// ---------------------------
// シグナリング 処理
// ---------------------------

signalingChannel.on('message', function (message) {
  console.log(message);
  if (message === 'ready') {
    $messageDialog.modal('hide');
    maskPanel.style.display = 'none';
  } else if (message === 'roomName error') {
    showMessageDialog(MESSAGE_ROOMNAME_ERROR);
  } else if (message === 'leave remotePeer') {
    clearStreamAll();
    pc = null;
    showMessageDialog(MESSAGE_REMOTE_LEAVE, true);
  } else if (message === 'over') {
    showMessageDialog(MESSAGE_OVER);
  } else {
    var message = JSON.parse(message);
    if (message.roomName) {
      // 部屋に参加した。
      roomName = message.roomName;
      dialogRoomName.value = roomName;
      showMessageDialog(MESSAGE_WAIT, true);
      dialogRoomName.focus();
      dialogRoomName.select();
      ddJoinRoom.style.display = 'none';
      reloadLeaveMessage.style.display = '';
    } else if (message.sdp) {
      if (!pc) start();
      remotePositionNo = message.streamPositionNo;
      var desc = new RTCSessionDescription(message.sdp);
      if (desc.type === 'offer') {
        pc.setRemoteDescription(desc).then(function () {
          return pc.createAnswer();
        })
        .then(function (answer) {
          return pc.setLocalDescription(answer);
        })
        .then(function () {
          signalingChannel.send(JSON.stringify({ sdp: pc.localDescription }));
        })
        .catch(logError);
      } else
        pc.setRemoteDescription(desc).catch(logError);
    } else if (message.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(message.candidate)).catch(logError);
    }
  }
});


// ---------------------------
// WebRTC 処理
// ---------------------------

function start() {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = function (evt) {
    if (evt.candidate)
      signalingChannel.send(JSON.stringify({ candidate: evt.candidate }));
  };

  pc.onnegotiationneeded = function () {
    pc.createOffer()
      .then(function (offer) {
        return pc.setLocalDescription(offer);
      })
      .then(function () {
        signalingChannel.send(JSON.stringify({ sdp: pc.localDescription, streamPositionNo: localPositionNo }));
      })
      .then(function () {
        if (actionName === 'remove') {
          document.getElementById('btnAddStream' + localPositionNo).style.display = '';
          document.getElementById('btnRemoveStream' + localPositionNo).style.display = 'none';
          clearStream(document.getElementById('localView' + localPositionNo));
        }
      })
      .catch(logError);
  };

  pc.onaddstream = function (evt) {
    var remoteView = document.getElementById('remoteView' + remotePositionNo);
    remoteView.srcObject = evt.stream;
    remoteView.play();
  };

  pc.onremovestream = function (evt) {
    var remoteView = document.getElementById('remoteView' + remotePositionNo);
    clearStream(remoteView);
  }
}

function start_AddEventListenerVer() {
  pc = new RTCPeerConnection(configuration);

  // send any ice candidates to the other peer
  pc.addEventListener('icecandidate', function (evt) {
    if (evt.candidate)
      signalingChannel.send(JSON.stringify({ candidate: evt.candidate }));
  });

  // let the "negotiationneeded" event trigger offer generation
  pc.addEventListener('negotiationneeded', function () {
    pc.createOffer()
      .then(function (offer) {
        return pc.setLocalDescription(offer);
      })
      .then(function () {
        // send the offer to the other peer
        signalingChannel.send(JSON.stringify({ sdp: pc.localDescription, streamPositionNo: localPositionNo }));
      })
      .then(function () {
        if (actionName === 'remove') {
          document.getElementById('btnAddStream' + localPositionNo).style.display = '';
          document.getElementById('btnRemoveStream' + localPositionNo).style.display = 'none';
          clearStream(document.getElementById('localView' + localPositionNo));
        }
      })
      .catch(logError);
  });

  // once remote stream arrives, show it in the remote video element
  pc.addEventListener('addstream', function (evt) {
    var remoteView = document.getElementById('remoteView' + remotePositionNo);
    remoteView.srcObject = evt.stream;
    remoteView.play();
  });

  pc.addEventListener('removestream', function (evt) {
    var remoteView = document.getElementById('remoteView' + remotePositionNo);
    clearStream(remoteView);
  });
}

function logError(error) {
  console.log(error);
}