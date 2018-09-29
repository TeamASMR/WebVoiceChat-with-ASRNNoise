function downsample(buffer, sampleRate, outSampleRate) {
    if (outSampleRate == sampleRate) {
        return buffer;
    }
    if (outSampleRate > sampleRate) {
        throw "downsampling rate show be smaller than original sample rate";
    }
    var sampleRateRatio = sampleRate / outSampleRate;
    var newLength = Math.round(buffer.length / sampleRateRatio);
    var result = new Float32Array(newLength);
    var offsetResult = 0;
    var offsetBuffer = 0;
    while (offsetResult < result.length) {
        var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        var accum = 0, count = 0;
        for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }

        result[offsetResult] = Math.min(1, accum / count)*0x7FFF;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    
    var up_result = new Float32Array(buffer.length);
    for(var i = 0; i < buffer.length; ++i) {
        up_result[i * sampleRateRatio] = result[i];
        var upsamp = (result[i] + result[i + sampleRateRatio]) / 2;
        for(var j = 0; j <  sampleRateRatio; j++){
            if(j != 0){
                up_result[i * sampleRateRatio + j] = (result[i] + result[i + sampleRateRatio]) / 2;
            }
        }
        
    }
    
    
    return up_result.buffer;
}



class subPixel1D extends tf.layers.Layer {
    
    constructor() {
        super({});
        this.supportsMasking = true;
    }

    computeOutputShape(inputShape) {
        return [inputShape[0], inputShape[1]*2 , inputShape[2] / 2];
    }

    call(inputs, kwargs) {
        let input = inputs;
        if (Array.isArray(input)) {
            input = input[0];
        }
        this.invokeCallHook(inputs, kwargs);
        const transpose_x = tf.transpose(input, [2,1,0]);
        const batchnd_x = tf.batchToSpaceND(transpose_x, [2], [[0,0]]);
        const x = tf.transpose(batchnd_x , [2,1,0]);  
        return x;
    }

    getClassName() {
        return 'subPixel1D';
    }
}
subPixel1D.className = 'subPixel1D'; // static variable
tf.serialization.SerializationMap.register(subPixel1D); // Here i added serialize code

async function load_model(){
    const model = await tf.loadModel('https://vchat.asrnnoise.ml:9999/dist/asr-model/model.json');
    return model;
}
var asr_model = null;
var asr_buf_size = 16384;
var asr_in_size = 256;
var ASR_effect = (function() {
    var lastOut = 1.0;
    var node = context.createScriptProcessor(asr_buf_size, 1, 1);
    node.onaudioprocess = async function(e) {
        var input = e.inputBuffer.getChannelData(0);
        var output = e.outputBuffer.getChannelData(0);
        if(asr_model == null){
            asr_model = await tf.loadModel('https://vchat.asrnnoise.ml:9999/dist/asr-model/model.json');
        }
        var batch_size = asr_buf_size / asr_in_size;
        var result = await asr_model.predict(tf.tensor(input,[batch_size,256,1])).data();
        for(var i = 0 ; i < asr_buf_size; i++){
            output[i] = result[i];
        }
 
    }
    return node;
})();