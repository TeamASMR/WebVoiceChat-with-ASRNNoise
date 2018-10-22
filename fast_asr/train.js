const tf = require('@tensorflow/tfjs');
const tf_core = require('@tensorflow/tfjs-core');
require('@tensorflow/tfjs-node');

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

function SubPixel1D(){
    return new subPixel1D();
}

function print(x){
    console.log(x);
}


// make model!
function base_model(){
    
    // init tf.layers
//     const n_fs = [16, 16,32,32,32,32] // number of filter
//     const n_ks = [16, 16, 8, 8, 8, 8]; // number of kernel size
//     const n_layer = n_fs.length; // length of layer
//     const d_layers = new Array(n_layer); // down-sampled array
//     const in_dim = 256
//     const in_chn = 1
    
    
    const n_fs = [16 , 64] // number of filter
    const n_ks = [32 , 8]; // number of kernel size
    const n_layer = n_fs.length; // length of layer
    const d_layers = new Array(n_layer); // down-sampled array
    const in_dim = 256;
    const in_chn = 1;
    const initializer = 'glorotUniform';
    // Input Layer
    var x = tf.input({shape: [in_dim, in_chn]});
    
    // Down Sampling Layer
    var d_conv1 = tf.layers.conv1d({kernelSize: n_ks[0], 
                                     filters: n_fs[0], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(x);
    var d_actv1 = tf.layers.leakyReLU(0.2).apply(d_conv1);
    var d_conv2 = tf.layers.conv1d({kernelSize: n_ks[1], 
                                     filters: n_fs[1], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(d_actv1);
    var d_actv2 = tf.layers.leakyReLU(0.2).apply(d_conv2);
    
    
    // Bottle Neck Layer
    var b_conv  = tf.layers.conv1d({kernelSize: n_ks[1], 
                                     filters: n_fs[1], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(d_actv2);
    var b_actv  = tf.layers.leakyReLU(0.2).apply(b_conv);
    
        
    var u_conv2 = tf.layers.conv1d({kernelSize: n_ks[1], 
                                     filters: n_fs[1] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(b_actv);
    var u_drop2 = tf.layers.dropout(0.5).apply(u_conv2);
    var u_sbpx2 = SubPixel1D().apply(u_drop2);
    var u_conc2 = tf.layers.concatenate().apply([u_sbpx2,d_actv2]);
    
    var u_conv1 = tf.layers.conv1d({kernelSize: n_ks[0], 
                                     filters: n_fs[0] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(u_conc2);
    var u_drop1 = tf.layers.dropout(0.5).apply(u_conv1);
    var u_sbpx1 = SubPixel1D().apply(u_drop1);
    var u_conc1 = tf.layers.concatenate().apply([u_sbpx1,d_actv1]);
    
    var f_conv  = tf.layers.conv1d({kernelSize: 8, 
                                     filters: 2, 
                                     strides:1, 
                                     activation: null, 
                                     kernelInitializer: 'randomNormal', 
                                     padding:'same'}).apply(u_conc1);
    var f_sbpx  = SubPixel1D().apply(f_conv);
    var y       = tf.layers.add().apply([f_sbpx, x]);
    
    var model = tf.model({inputs: x, outputs: y});
        
    return model;
}


async function load_model(){
    print('test load-model');
    const model = await tf.loadModel('file://./asr-model/model.json');
    print('finish');
}  

function shuffle(a) {
    var seed = 0.4567;
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor((Math.random() * seed ) * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

function SNR(y_true,y_pred){
    const P = y_pred;
    const Y = y_true;
    // compute l2 loss
    const sqrt_l2_loss = tf.sqrt(tf.mean((P-Y)**2 + 1e-6, axis=[1,2]));
    const sqrn_l2_norm = tf.sqrt(tf.mean(Y**2, axis=[1,2]));
    const snr = 20 * tf.log(sqrn_l2_norm / sqrt_l2_loss + 1e-8) / tf.log(10.);
    const avg_snr = tf.mean(snr, axis=0);
    return avg_snr * -1;
}

async function train_model(){
    
    // init dataset
    var fs = require("fs");
    var hdf5 = require('hdf5').hdf5;
    var h5lt = require('hdf5').h5lt;
    var Access = require('hdf5/lib/globals').Access;
    
    
    const model    = base_model();    
    
    model.compile({optimizer: 'adam',loss: 'meanSquaredError'});
    model.summary();
    
    var EPOCHS = 1;
    for(var epoch=0; epoch<EPOCHS; epoch++){
        
        
        
        for(var i=0; i < 1; i++){
            //var path = dataset_dir.concat(dataset_list[i]);
            var path = './data/asr-ex10-start0-end9-scale8-sr48000-dim256-strd64-train.h5';
            var contents = fs.readFileSync(path);
            print(path);
            var file = new hdf5.File(path, Access.ACC_RDONLY);
            var X = h5lt.readDataset(file.id, "data");
            var Y = h5lt.readDataset(file.id, "label");
            //var tensorX = tf.tensor(X).reshape([X.sections, X.rows, X.columns]);
            //var tensorY = tf.tensor(Y).reshape([Y.sections, Y.rows, Y.columns]);
            var tensorX = tf.tensor(X).reshape([X.sections, X.rows, X.columns]);
            var tensorY = tf.tensor(Y).reshape([Y.sections, Y.rows, Y.columns]);
            print(tensorX)
            print(tensorY)
            
            print('model fit start..');
            await model.fit(tensorX, tensorY, {
              batchSize:128,
              epochs: 1,
              shuffle: true,
              validationSplit: 0.05,
              callbacks: {
                onBatchEnd: async (batch, log) => {
                  console.log(`Batch ${batch}: loss = ${log.loss}`);
                  await model.save('file://./asr-model',true);
                }
              }
            });
            
            path = null;
            X =  null;
            Y =  null;
            tensorX =  null;
            tensorY =  null;
        }
    }
    
//     await load_model();
    
    return 0;
}


train_model();
