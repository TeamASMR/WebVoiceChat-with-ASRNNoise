// visualizer part
// Ref: RNNoise Demo
var MIN_DB_LEVEL = -110; // -110
var MAX_DB_LEVEL = -40;  // -40

var DB_LEVEL_RANGE = MAX_DB_LEVEL - MIN_DB_LEVEL;
var HEAT_COLORS = [];

function generateHeatColors(){
  function color(value) {
    var h = (1 - value) * 240;
    return "hsl(" + h + ", 100%, 50%)";
  }
  for (var i = 0; i < 256; i++) {
    HEAT_COLORS.push(color(i / 256));
  }
}
generateHeatColors();
function clamp(v, a, b) {
  if (v < a) v = a;
  if (v > b) v = b;
  return v;
}
var DarkTheme = {
  // backgroundColor: "#212121"
  backgroundColor: "#000000"
};
var LightTheme = {
  backgroundColor: "#F5F5F5"
};

var __extends = this && this.__extends || function() {
  var extendStatics = Object.setPrototypeOf || {
    __proto__: []
  } instanceof Array && function(d, b) {
    d.__proto__ = b;
  } || function(d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
  };
  return function(d, b) {
    extendStatics(d, b);
    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
}();

var CanvasView = function() {
  function CanvasView(canvas, width, height) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.theme = DarkTheme;
    this.reset();
  }
  CanvasView.prototype.reset = function() {
    this.ratio = window.devicePixelRatio || 1;
    this.canvas.width = this.width * this.ratio;
    this.canvas.height = this.height * this.ratio;
//     this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx = this.canvas.getContext("2d");
  };

  CanvasView.prototype.tick = function() {
    this.update();
    this.render();
  };
  CanvasView.prototype.update = function() {};
  CanvasView.prototype.render = function() {};
  return CanvasView;
}();
var FrequencyBins = function() {
  function FrequencyBins(analyzerNode, skip) {
    if (skip === void 0) {
      skip = 2;
    }
    this.analyzerNode = analyzerNode;
    this.skip = skip;
    var binCount = this.analyzerNode.frequencyBinCount;
    this.temp = new Float32Array(binCount);
    this.bins = new Float32Array(binCount - skip);
  }
  FrequencyBins.prototype.update = function() {
    this.analyzerNode.getFloatFrequencyData(this.temp);
    this.bins.set(this.temp.subarray(this.skip));
  };
  return FrequencyBins;
}();
var AnalyzerNodeView = function(_super) {
  __extends(AnalyzerNodeView, _super);
  function AnalyzerNodeView(analyzerNode, canvas, width, height) {
    var _this = _super.call(this, canvas, width, height) || this;
    _this.isRecording = false;
    _this.frequency = new FrequencyBins(analyzerNode);
    return _this;
  }
  return AnalyzerNodeView;
}(CanvasView);
var SpectogramAnalyzerNodeView = function(_super) {
  __extends(SpectogramAnalyzerNodeView, _super);
  function SpectogramAnalyzerNodeView(analyzerNode, canvas, width, height) {
    var _this = _super.call(this, analyzerNode, canvas, width, height) || this;
    _this.binWidth = 1;
    _this.binHPadding = 0;
    _this.binTotalWidth = _this.binWidth + _this.binHPadding;
    _this.tickHeight = 2;
    _this.tickVPadding = 0;
    _this.tickTotalHeight = _this.tickHeight + _this.tickVPadding;
    _this.reset();
    //_this.start();
    return _this;
  }
  SpectogramAnalyzerNodeView.prototype.reset = function() {
    _super.prototype.reset.call(this);
    this.tmpCanvas = document.createElement("canvas");
    this.tmpCanvas.width = this.canvas.width;
    this.tmpCanvas.height = this.canvas.height;
    this.tmpCtx = this.tmpCanvas.getContext("2d");
  };
  SpectogramAnalyzerNodeView.prototype.update = function() {
    this.frequency.update();
  };
  SpectogramAnalyzerNodeView.prototype.render = function() {
    var ctx = this.ctx;
    this.tmpCtx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.save();
    ctx.scale(this.ratio, this.ratio);
    ctx.fillStyle = this.theme.backgroundColor;
    ctx.fillRect(0, 0, this.width, this.height);
    var maxBinCount = this.width / this.binTotalWidth | 0;
    var binCount = Math.min(maxBinCount, this.frequency.bins.length);
    for (var i = 0; i < binCount / 2 | 0; i++) {
      var value = clamp((this.frequency.bins[i] - MIN_DB_LEVEL) / DB_LEVEL_RANGE, 0, 0.995);
      ctx.globalAlpha = 1;
      ctx.fillStyle = FF_MAP[value * FF_MAP.length | 0];
      ctx.fillRect(this.width - this.binTotalWidth, (binCount/4-i-1) * this.tickTotalHeight, this.binWidth, this.tickHeight);
    }
    ctx.restore();
    ctx.translate(-this.binTotalWidth, 0);
    ctx.drawImage(this.tmpCanvas, 0, 0);
    ctx.restore();
  };
  return SpectogramAnalyzerNodeView;
}(AnalyzerNodeView);


// 2018.08.10 Audio Effect Test
var errorCallback = function(e) {
    console.log('error!', e);
};

//var context = new AudioContext();

/* EXAMPLE: Reverb Filter */
function impulseResponse( duration, decay, reverse ) {
    var sampleRate = context.sampleRate;
    var length = sampleRate * duration;
    var impulse = context.createBuffer(2, length, sampleRate);
    var impulseL = impulse.getChannelData(0);
    var impulseR = impulse.getChannelData(1);

    if (!decay)
        decay = 2.0;
    for (var i = 0; i < length; i++){
      var n = reverse ? length - i : i;
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    return impulse;
}


var outputMix = context.createGain();
var wetGain = context.createGain();
wetGain.connect(outputMix);
var reverb = (function () {
    var convolver = context.createConvolver();
    convolver.buffer = impulseResponse( 2.5, 2.0 );  // reverbBuffer;
    convolver.connect( wetGain );
    return convolver;
})();


var low_pass_filter = (function () {
    //var convolver = context.createConvolver();
    //var gainNode = context.createGain();
    var biquadFilter = context.createBiquadFilter();
    biquadFilter.type = "lowpass";
    biquadFilter.frequency.setValueAtTime(500, context.currentTime);
    biquadFilter.gain.setValueAtTime(25, context.currentTime);
    //biquadFilter.connect(convolver);
    //convolver.connect(gainNode);
    return biquadFilter;
})();


var donwSampling_effect = (function() {
    var lastOut = 1.0;
    var node = context.createScriptProcessor(bufferSize, 1, 1);
    node.onaudioprocess = async function(e) { 
        var convolver = context.createConvolver();
        var biquadFilter = context.createBiquadFilter();
        biquadFilter.connect(convolver);
        convolver.connect(gainNode);
    }
    return node;
})();



/* ASRNNoise Effect */
var bufferSize = 8192;
var st = 0;
var ptr = 0;
var init_st = false;
var in_dim = 480;
var out_dim = 480;
async function reSample(audioBuffer, targetSampleRate, onComplete) {
    var channel = audioBuffer.numberOfChannels;
    var samples = audioBuffer.length * targetSampleRate / audioBuffer.sampleRate;
    //console.log(channel, samples, targetSampleRate);
    var offlineContext = new OfflineAudioContext(channel, samples, targetSampleRate);
    var bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;

    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    await offlineContext.startRendering().then(function(renderedBuffer){
        onComplete(renderedBuffer);
    });
}


var ASRNNoise_effect = (function() {
    var lastOut = 1.0;
    var node = context.createScriptProcessor(bufferSize, 1, 1);
    var inputBuffer = [];
    var outputBuffer = [];
    let frameBuffer = [];
    node.onaudioprocess = async function(e) {
        
        if(asr_model == null){ asr_model = await tf.loadModel('https://vchat.asrnnoise.ml/dist/asr-model/model.json'); }
        if(!init_st){
            init_st = true;
            st = Module.ccall('rnnoise_create','number',[],[]);
            ptr = Module._malloc(480 * 4);
            console.log(st);
        }
        
        var input = e.inputBuffer.getChannelData(0);
        var output = e.outputBuffer.getChannelData(0);
        

        //if(_stream_type == _MODE_STREAM_ORIGINAL){
        if(_MODE_STREAM_ORIGINAL){    
            for(var i = 0 ; i < bufferSize; i++){
                output[i] = input[i];
            }   
        }else{
            
            // Audio Super Resolution Mode
            if(_MODE_STREAM_ASR){
                var batch_size = bufferSize / asr_in_size;
                var result_asr = await asr_model.predict(tf.tensor(input,[batch_size,asr_in_size,1])).data();
                for(var i = 0 ; i < bufferSize; i++){
                    output[i] = result_asr[i];
                }
            }
            
            // RNNoise Mode
            if(_MODE_STREAM_RNNoise){
                for (let i = 0; i < bufferSize; i++) {
                    inputBuffer.push(input[i]);
                }
                
                while (inputBuffer.length >= 480) {
                    for (let i = 0; i < 480; i++) {
                        frameBuffer[i] = inputBuffer.shift();
                    }

                    for (let i = 0; i < 480; i++) {
                        Module.HEAPF32[(ptr >> 2) + i] = frameBuffer[i] * 32768;
                    }
                    Module.ccall('rnnoise_process_frame','number',['number','number','number'],[st, ptr, ptr]);
                    for (let i = 0; i < 480; i++) {
                        frameBuffer[i] = Module.HEAPF32[(ptr >> 2) + i] / 32768;
                    }

                    for (let i = 0; i < 480; i++) {
                        outputBuffer.push(frameBuffer[i]);
                    }
                }

                if (outputBuffer.length < bufferSize) {
                    console.log('length small then bufferSize');
                    return;
                }
                // Flush output buffer.
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = outputBuffer.shift();
                }
            }
            
            
        }

    }
    return node;
})();




// Add Effect to my audio-stream and WebRTC Connection
var cur_effect = ASRNNoise_effect; //ASRNNoise_effect; //reverb   , RNNoise_effect
var destination = context.createMediaStreamDestination();
var source;
navigator.getUserMedia({audio: true}, function(stream) {      
    source = context.createMediaStreamSource(stream);
    // microphone -> filter -> destination.
    
    source.connect(cur_effect);
    
    // we can hear the filtered audio stream in local 
    cur_effect.connect(destination); // -> context.destination == 'My Speaker or Headset'

    console.log('Only local user media stream id -> ',stream.id);
    
    // This code for debugging! --> You can hear effected sound directly!
    //cur_effect.connect(context.destination);

    // connect my effected audiostream to MultiRTCconnection!
    //console.log(connection.attachStreams);
    //connection.addStream(destination.stream);
    //console.log(connection.attachStreams);

}, errorCallback);
