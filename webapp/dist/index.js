//console.log(int_sqrt(10)); test 4
// ......................................................
// .......................UI Code........................
// ......................................................

document.getElementById('open-room').onclick = function() {
    disableInputButtons();
    connection.open(document.getElementById('room-id').value, function() {
        showRoomURL(connection.sessionid);
        
        // 2018.08.12
        // you must remove original stream and add our custum stream in Callback Function
        if(turnOn){
            if(addOriginalStream){
                connection.addStream(destination.stream);
            }else{
                connection.attachStreams[0] = destination.stream;
            }
            console.log(connection.attachStreams);
        }else{
            console.log('TURN_OFF');
        }
    });
    
    console.log(connection.attachStreams);
};

document.getElementById('join-room').onclick = function() {
    disableInputButtons();
    connection.join(document.getElementById('room-id').value, function(){
        //showRoomURL(connection.sessionid);
        // 2018.08.12
        // you must remove original stream and add our custum stream in Callback Function
        if(turnOn){
            if(addOriginalStream){
                connection.addStream(destination.stream);
            }else{
                connection.attachStreams[0] = destination.stream;
            }
            console.log(connection.attachStreams);
        }else{
            console.log('TURN_OFF');
        }
    });
    
};

document.getElementById('open-or-join-room').onclick = function() {
    disableInputButtons();
    connection.openOrJoin(document.getElementById('room-id').value, function(isRoomExist, roomid) {
//         if (!isRoomExist) {
//             showRoomURL(roomid);
//         }
        
        // 2018.08.12
        // you must remove original stream and add our custum stream in Callback Function
        if(turnOn){
            if(addOriginalStream){
                connection.addStream(destination.stream);
            }else{
                connection.attachStreams[0] = destination.stream;
            }
            console.log(connection.attachStreams);
        }else{
            console.log('TURN_OFF');
        }
        
    });
    
    
};
    
// document.getElementById('change-analysis-type').onclick = function() {
//     _analyser_type = (_analyser_type + 1) % 4;
//     for(var i = 0 ; i < myAnalyserViews.length; i++){
//         myAnalyserViews[i].setAnalysisType(_analyser_type);
//     }
    
// };
    
// document.getElementById('change-stream-filter').onclick = function() {
//      _stream_type = (_stream_type + 1) % 4;
// };

document.getElementById('mode-original').onclick = function() {
    //_stream_type = _MODE_STREAM_ORIGINAL;
    _MODE_STREAM_ORIGINAL = true;
    _MODE_STREAM_RNNoise = false;
    _MODE_STREAM_ASR = false;
    document.getElementById('mode-status').innerText = 'Original Sound';
    console.log('stream type -> Original sounds');    
};
document.getElementById('mode-rnnoise').onclick = function() {
    //_stream_type = _MODE_STREAM_RNNoise;
    
    _MODE_STREAM_ORIGINAL = false;
    _MODE_STREAM_RNNoise = !_MODE_STREAM_RNNoise;
    
    if(_MODE_STREAM_RNNoise){
        document.getElementById('mode-rnnoise').innerText = 'OFF';
        if(_MODE_STREAM_ASR){
            document.getElementById('mode-status').innerText = 'Audio Up Sampling + RNNoise';
        }else{
            document.getElementById('mode-status').innerText = 'RNNoise';
        }
    }else{
        document.getElementById('mode-rnnoise').innerText = 'ON';
        if(_MODE_STREAM_ASR){
            document.getElementById('mode-status').innerText = 'Audio Up Sampling';
        }else{
            _MODE_STREAM_ORIGINAL = true;
            document.getElementById('mode-status').innerText = 'Original Sound';
        }
        
    }
    console.log('stream type -> RNNoise');
};
document.getElementById('mode-asr').onclick = function() {
    //_stream_type = _MODE_STREAM_ASR;
    _MODE_STREAM_ORIGINAL = false;
    _MODE_STREAM_ASR = !_MODE_STREAM_ASR;
    
    if(_MODE_STREAM_ASR){
        document.getElementById('mode-asr').innerText = 'OFF';
        if(_MODE_STREAM_RNNoise){
            document.getElementById('mode-status').innerText = 'Audio Up Sampling + RNNoise';
        }else{
            document.getElementById('mode-status').innerText = 'Audio Up Sampling';
        }
    }else{
        document.getElementById('mode-asr').innerText = 'ON';
        if(_MODE_STREAM_RNNoise){
            document.getElementById('mode-status').innerText = 'RNNoise';
        }else{
             _MODE_STREAM_ORIGINAL = true;
            document.getElementById('mode-status').innerText = 'Original Sound';
        }
    }
    
    
    
    console.log('stream type -> Audio Super Resolution');
};
// document.getElementById('mode-asrnnoise').onclick = function() {
//      _stream_type = _MODE_STREAM_ASRNNoise;
//     console.log('stream type -> ASR+RNNoise');
// };

// document.getElementById('mode-high').onclick = function() {
//     _stream_quality = _QUALITY_STREAM_HIGH;
//     console.log('stream quality -> HIGH');
    
//     source.disconnect(low_pass_filter);
//     low_pass_filter.disconnect(cur_effect);
//     source.connect(cur_effect);
// };
// document.getElementById('mode-low').onclick = function() {
//     _stream_quality = _QUALITY_STREAM_LOW;
//     console.log('stream quality -> LOW');
    
//     source.disconnect(cur_effect);
//     source.connect(low_pass_filter);
//     low_pass_filter.connect(cur_effect);
    
// };




// ......................................................
// ..................RTCMultiConnection Code.............
// ......................................................

var connection = new RTCMultiConnection();

// by default, socket.io server is assumed to be deployed on your own URL
connection.socketURL = '/';

// comment-out below line if you do not have your own socket.io server
connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';

connection.socketMessageEvent = 'audio-conference-demo';

connection.session = {
    audio: true,
    video: false
};

connection.mediaConstraints = {
    audio: true,
    video: false
};

connection.sdpConstraints.mandatory = {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: false
};

connection.audiosContainer = document.getElementById('audios-container');
connection.onstream = function(event) {
    console.log('>> Event Type: ', event.type);
    var isLocal = false;
    if(event.type == 'local'){
        isLocal = true;
    }
    var rafID = null;
    var original_analyser;
    var processed_analyser;
    var original_analyser_view;
    var processed_analyser_view;
    
    function cancelAnalyserUpdates() {
        if (rafID)
            window.cancelAnimationFrame( rafID );
        rafID = null;
    }
    
    function updateAnalysers(time) {
        original_analyser_view.doFrequencyAnalysis( original_analyser );
        processed_analyser_view.doFrequencyAnalysis( processed_analyser );

        rafID = window.requestAnimationFrame( updateAnalysers );
    }
    
    
    var width = parseInt(connection.audiosContainer.clientWidth / 2) - 20;
    var mediaElement = getHTMLMediaElement(event.mediaElement, {
        title: event.userid,
        buttons: ['full-screen'],
        width: width,
        showOnMouseEnter: false,
        stream_id: event.streamid,
        stream: event.stream,
        isLocal: isLocal
    });
    
    console.log('returned mediaElements ->',mediaElement.innerHTML);
    
    var el = document.createElement( 'html' );
    el.innerHTML = mediaElement.innerHTML;
    var canvas_list = el.getElementsByTagName('canvas');
    console.log(canvas_list[0]);
    console.log(canvas_list[1]);
   
    
    
    connection.audiosContainer.appendChild(mediaElement);
    console.log('appendChild->mediaElement finish!');
    

    mediaElement.id = event.streamid;
    

    // Analyser animation
    var stream = event.stream;
    var input = context.createMediaStreamSource(stream);
    //var input = global_input;
    var user_context = input.context;
    console.log('init analyser input values finish');
    
    // init analysers
    original_analyser = user_context.createAnalyser();
    original_analyser.fftSize = 1024;
    processed_analyser = user_context.createAnalyser();
    processed_analyser.fftSize = 1024;
    
    original_analyser.smoothingTimeConstant = 0;
    processed_analyser.smoothingTimeConstant = 0;
    
    console.log('init analyser finish!');
    
    // different visualizer
    // init views(=canvas)
//     original_analyser_view  = new AnalyserView(canvas_list[0].id);
//     original_analyser_view.initByteBuffer(original_analyser);
//     processed_analyser_view = new AnalyserView(canvas_list[1].id);  
//     processed_analyser_view.initByteBuffer(processed_analyser);
//     console.log('init view finish!');
    
    // init connect?
    var outputMix = user_context.createGain();
    var dryGain = user_context.createGain();
    var wetGain = user_context.createGain();
    var effectInput = user_context.createGain();
    var user_destination = user_context.createMediaStreamDestination();

    if(isLocal){
        input.connect(dryGain); 
        input.connect(original_analyser);
        cur_effect.connect(processed_analyser);
        
        // new canvas!
        var source_spectrogram_doc = canvas_list[0];
        var destination_spectrogram_doc = canvas_list[1];
        var original_analyser_view = new SpectogramAnalyzerNodeView(original_analyser, document.getElementById(canvas_list[0].id) ,876, 256);
        var processed_analyser_view = new SpectogramAnalyzerNodeView(processed_analyser, document.getElementById(canvas_list[1].id), 876, 256);
        function tick() {
          original_analyser_view.tick();
          processed_analyser_view.tick();
          animation = requestAnimationFrame(tick);
        }
        animation = requestAnimationFrame(tick);
        console.log('animation Analysers finish');
        
    }else{
        input.connect(dryGain);
        input.connect(original_analyser);
        //dryGain.connect(outputMix);
        //wetGain.connect(outputMix);
        //outputMix.connect(processed_analyser);
        
        // new canvas!
        var source_spectrogram_doc = canvas_list[0];
        //var destination_spectrogram_doc = canvas_list[1];
        //destination_spectrogram_doc.style.height='0px;';
        var original_analyser_view = new SpectogramAnalyzerNodeView(original_analyser, document.getElementById(canvas_list[0].id) ,876, 256);
        //var processed_analyser_view = new SpectogramAnalyzerNodeView(processed_analyser, document.getElementById(canvas_list[1].id), 876, 256);
        function tick() {
          original_analyser_view.tick();
          //processed_analyser_view.tick();
          animation = requestAnimationFrame(tick);
        }
        animation = requestAnimationFrame(tick);
        console.log('animation Analysers finish');
    }
    
    
    
    
    // different visualizer
    //updata analysers
//     myAnalyserViews.push(original_analyser_view);
//     myAnalyserViews.push(processed_analyser_view);
    
//     cancelAnalyserUpdates();
//     console.log('cancelAnalyserUpdate finish');
    
//     updateAnalysers();
//     console.log('updateAnalysers finish');
};

connection.onstreamended = function(event) {
    var mediaElement = document.getElementById(event.streamid);
    if (mediaElement) {
        mediaElement.parentNode.removeChild(mediaElement);
    }
};

function disableInputButtons() {
    document.getElementById('open-or-join-room').disabled = true;
    document.getElementById('open-room').disabled = true;
    document.getElementById('join-room').disabled = true;
    document.getElementById('room-id').disabled = true;
}

// ......................................................
// ......................Handling Room-ID................
// ......................................................

function showRoomURL(roomid) {
    var roomHashURL = '#' + roomid;
    var roomQueryStringURL = '?roomid=' + roomid;

    var html = '<h2>Unique URL for your room:</h2><br>';

    html += 'Hash URL: <a href="' + roomHashURL + '" target="_blank">' + roomHashURL + '</a>';
    html += '<br>';
    html += 'QueryString URL: <a href="' + roomQueryStringURL + '" target="_blank">' + roomQueryStringURL + '</a>';

    var roomURLsDiv = document.getElementById('room-urls');
    roomURLsDiv.innerHTML = html;

    roomURLsDiv.style.display = 'block';
    roomURLsDiv.style.background = '#FFFFFF00';
    roomURLsDiv.style.padding = '20px';
    //roomURLsDiv.style.padding.bottom = '20px';
}

(function() {
    var params = {},
        r = /([^&=]+)=?([^&]*)/g;

    function d(s) {
        return decodeURIComponent(s.replace(/\+/g, ' '));
    }
    var match, search = window.location.search;
    while (match = r.exec(search.substring(1)))
        params[d(match[1])] = d(match[2]);
    window.params = params;
})();

var roomid = '';
if (localStorage.getItem(connection.socketMessageEvent)) {
    roomid = localStorage.getItem(connection.socketMessageEvent);
} else {
    roomid = connection.token();
}
document.getElementById('room-id').value = roomid;
document.getElementById('room-id').onkeyup = function() {
    localStorage.setItem(connection.socketMessageEvent, this.value);
};

var hashString = location.hash.replace('#', '');
if (hashString.length && hashString.indexOf('comment-') == 0) {
    hashString = '';
}

var roomid = params.roomid;
if (!roomid && hashString.length) {
    roomid = hashString;
}

if (roomid && roomid.length) {
    document.getElementById('room-id').value = roomid;
    localStorage.setItem(connection.socketMessageEvent, roomid);

    // auto-join-room
    (function reCheckRoomPresence() {
        connection.checkPresence(roomid, function(isRoomExist) {
            if (isRoomExist) {
                connection.join(roomid);
                return;
            }

            setTimeout(reCheckRoomPresence, 5000);
        });
    })();
    console.log('disableInputButton called!');
    disableInputButtons();
}
    