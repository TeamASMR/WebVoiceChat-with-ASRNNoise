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
function base_model2(){   
    const n_fs = [8, 8] // number of filter
    const n_ks = [8, 8]; // number of kernel size
    const n_layer = n_fs.length; // length of layer
    var d_layers = new Array(n_layer); // down-sampled array
    const in_dim = 256
    const in_chn = 1
    
    // Input Layer
    var x = tf.input({shape: [in_dim, in_chn]});
    
    // Down Sampling Layer
    var d_conv1 = tf.layers.conv1d({kernelSize: n_ks[0], 
                                     filters: n_fs[0], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: 'glorotUniform', 
                                     padding:'same'}).apply(x);
    var d_actv1 = tf.layers.leakyReLU(0.2).apply(d_conv1);
    var d_conv2 = tf.layers.conv1d({kernelSize: n_ks[1], 
                                     filters: n_fs[1], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: 'glorotUniform', 
                                     padding:'same'}).apply(d_actv1);
    var d_actv2 = tf.layers.leakyReLU(0.2).apply(d_conv2);
   
    // Bottle Neck Layer
    var b_conv  = tf.layers.conv1d({kernelSize: n_ks[1], 
                                     filters: n_fs[1], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: 'glorotUniform', 
                                     padding:'same'}).apply(d_actv2);
    var b_actv  = tf.layers.leakyReLU(0.2).apply(b_conv);
    
    var u_conv2 = tf.layers.conv1d({kernelSize: n_ks[1], 
                                     filters: n_fs[1] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: 'glorotUniform', 
                                     padding:'same'}).apply(b_actv);
    var u_drop2 = tf.layers.dropout(0.5).apply(u_conv2);
    var u_sbpx2 = SubPixel1D().apply(u_drop2);
    var u_conc2 = tf.layers.concatenate().apply([u_sbpx2,d_actv2]);
    
    var u_conv1 = tf.layers.conv1d({kernelSize: n_ks[0], 
                                     filters: n_fs[0] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: 'glorotUniform', 
                                     padding:'same'}).apply(u_conc2);
    var u_drop1 = tf.layers.dropout(0.5).apply(u_conv1);
    var u_sbpx1 = SubPixel1D().apply(u_drop1);
    var u_conc1 = tf.layers.concatenate().apply([u_sbpx1,d_actv1]);
    
    var f_conv  = tf.layers.conv1d({kernelSize: 9, 
                                     filters: 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: 'glorotUniform', 
                                     padding:'same'}).apply(u_conc1);
    var f_sbpx  = SubPixel1D().apply(f_conv);
    var y       = tf.layers.add().apply([f_sbpx, x]);
    
    var model = tf.model({inputs: x, outputs: y});
        
    return model;
}

function discriminator(){
    const in_dim = 256
    const in_chn = 1
    var model = tf.sequential();
    model.add(tf.layers.conv1d({
      inputShape: [256, 1],
      kernelSize: 16,
      filters: 16,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'VarianceScaling'
    }));
    model.add(tf.layers.maxPooling1d({
      poolSize: 2,
      strides: 2
    }));
    model.add(tf.layers.conv1d({
      kernelSize: 8,
      filters: 32,
      strides: 1,
      activation: 'relu',
      kernelInitializer: 'VarianceScaling'
    }));
    model.add(tf.layers.maxPooling1d({
      poolSize: 2,
      strides: 2
    }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({
      units: 64,
      kernelInitializer: 'VarianceScaling',
      activation: 'relu'
    }));
    model.add(tf.layers.dense({
      units: 1,
      kernelInitializer: 'VarianceScaling',
      activation: 'sigmoid'
    }));
    return model;
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
    
    
    const n_fs = [16, 32, 32, 32, 32, 32] // number of filter
    const n_ks = [16,  8,  4,  4,  4,  4]; // number of kernel size
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
    var d_conv3 = tf.layers.conv1d({kernelSize: n_ks[2], 
                                     filters: n_fs[2], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(d_actv2);
    var d_actv3 = tf.layers.leakyReLU(0.2).apply(d_conv3);
    var d_conv4 = tf.layers.conv1d({kernelSize: n_ks[3], 
                                     filters: n_fs[3], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(d_actv3);
    var d_actv4 = tf.layers.leakyReLU(0.2).apply(d_conv4);
    var d_conv5 = tf.layers.conv1d({kernelSize: n_ks[4], 
                                     filters: n_fs[4], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(d_actv4);
    var d_actv5 = tf.layers.leakyReLU(0.2).apply(d_conv5);
    var d_conv6 = tf.layers.conv1d({kernelSize: n_ks[5], 
                                     filters: n_fs[5], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(d_actv5);
    var d_actv6 = tf.layers.leakyReLU(0.2).apply(d_conv6);
    
    // Bottle Neck Layer
    var b_conv  = tf.layers.conv1d({kernelSize: n_ks[5], 
                                     filters: n_fs[5], 
                                     strides:2, 
                                     activation: null, 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(d_actv6);
    var b_actv  = tf.layers.leakyReLU(0.2).apply(b_conv);
    
    // Up Sampling Layer
    var u_conv6 = tf.layers.conv1d({kernelSize: n_ks[5], 
                                     filters: n_fs[5] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(b_actv);
    var u_drop6 = tf.layers.dropout(0.5).apply(u_conv6);
    var u_sbpx6 = SubPixel1D().apply(u_drop6);
    var u_conc6 = tf.layers.concatenate().apply([u_sbpx6,d_actv6]);
    
    var u_conv5 = tf.layers.conv1d({kernelSize: n_ks[4], 
                                     filters: n_fs[4] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(u_conc6);
    var u_drop5 = tf.layers.dropout(0.5).apply(u_conv5);
    var u_sbpx5 = SubPixel1D().apply(u_drop5);
    var u_conc5 = tf.layers.concatenate().apply([u_sbpx5,d_actv5]);
    
    var u_conv4 = tf.layers.conv1d({kernelSize: n_ks[3], 
                                     filters: n_fs[3] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(u_conc5);
    var u_drop4 = tf.layers.dropout(0.5).apply(u_conv4);
    var u_sbpx4 = SubPixel1D().apply(u_drop4);
    var u_conc4 = tf.layers.concatenate().apply([u_sbpx4,d_actv4]);
    
    var u_conv3 = tf.layers.conv1d({kernelSize: n_ks[2], 
                                     filters: n_fs[2] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(u_conc4);
    var u_drop3 = tf.layers.dropout(0.5).apply(u_conv3);
    var u_sbpx3 = SubPixel1D().apply(u_drop3);
    var u_conc3 = tf.layers.concatenate().apply([u_sbpx3,d_actv3]);
    
    var u_conv2 = tf.layers.conv1d({kernelSize: n_ks[1], 
                                     filters: n_fs[1] * 2, 
                                     strides:1, 
                                     activation: 'relu', 
                                     kernelInitializer: initializer, 
                                     padding:'same'}).apply(u_conc3);
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

async function train_gan_model(){
    
    // init dataset
    var fs = require("fs");
    var dataset_path = fs.readFileSync('dataset_list.txt','utf8');
    var dataset_list = dataset_path.split('\n');
    dataset_list = shuffle(dataset_list);
    var dataset_dir = '/mnt/dataSet/json-data-temp/';
    
    // init model
    var g = base_model();    
    var d = discriminator();
    var d_on_g = tf.sequential();
    d_on_g.add(g);
    d_on_g.add(d);
    
    // compile model
    g.compile({optimizer: 'adam',loss: 'meanSquaredError'});
    g.summary();
    d.compile({optimizer: 'adam',loss: 'binaryCrossentropy'});
    d.summary();
    d_on_g.compile({optimizer: 'adam',loss: 'binaryCrossentropy'});
    d_on_g.summary();
    
    var EPOCHS = 1;
    
    var path = dataset_dir.concat(dataset_list[0]);
    print(path);
    var contents = fs.readFileSync(path, 'utf8');
    
//     for(var epoch=0; epoch<EPOCHS; epoch++){        
//         for(var i=0; i < dataset_list.length; i++){
//             var path = dataset_dir.concat(dataset_list[i]);
//             print(path);
            
//             var contents = fs.readFileSync(path, 'utf8');
            //print(contents);
            //var jsonContent = JSON.parse(contents);
            
            //var jsonContent = require(path);
//             var X = jsonContent.data;
//             var Y = jsonContent.label;
            
//             var tensorX = tf.tensor(X);
//             var tensorY = tf.tensor(Y);
//             print(tensorX);
//             print(tensorY);
            
            
            
            
//             await model.fit(tensorX, tensorY, {
//               batchSize:128,
//               epochs: 5,
//               shuffle: true,
//               validationSplit: 0.05,
//               callbacks: {
//                 onBatchEnd: async (batch, log) => {
//                   console.log(`Batch ${batch}: loss = ${log.loss}`);
//                   await model.save('file://./asr-model',true);
//                 }
//               }
//             });
            
//             path = null;
//             contents =  null;
//             jsonContent =  null;
//             X =  null;
//             Y =  null;
//             tensorX =  null;
//             tensorY =  null;
//         }
//     }
    
//     await load_model();
    
    return 0;
}

async function train_model(){
    
    // init dataset
    var fs = require("fs");
    var dataset_path = fs.readFileSync('dataset_list.txt','utf8');
    var dataset_list = dataset_path.split('\n');
    dataset_list = shuffle(dataset_list);
    var dataset_dir = '/mnt/dataSet/json-data/';
    
    
    const model    = base_model();    
    
    // Load pre-trained model
    //const model = await tf.loadModel('file://./asr-model/model2.json');
    
    model.compile({optimizer: 'adam',loss: 'meanSquaredError'});
    model.summary();
    
    var EPOCHS = 1;
    for(var epoch=0; epoch<EPOCHS; epoch++){
        
        
        
        for(var i=0; i < dataset_list.length; i++){
            //var path = dataset_dir.concat(dataset_list[i]);
            var path = dataset_dir.concat(dataset_list[i]);
            var contents = fs.readFileSync(path);
            print(path);
            var jsonContent = JSON.parse(contents);
            var X = jsonContent.data;
            var Y = jsonContent.label;
            var tensorX = tf.tensor(X);
            var tensorY = tf.tensor(Y);
            print(tensorX);
            print(tensorY);
            print('model fit start..');
            await model.fit(tensorX, tensorY, {
              batchSize:128,
              epochs: 5,
              shuffle: true,
              validationSplit: 0.05,
              callbacks: {
                onBatchEnd: async (batch, log) => {
                  console.log(`Batch ${batch}: loss = ${log.loss}`);
                  await model.save('file://./asr-model2',true);
                }
              }
            });
            
            path = null;
            contents =  null;
            jsonContent =  null;
            X =  null;
            Y =  null;
            tensorX =  null;
            tensorY =  null;
        }
    }
    
    await load_model();
    
    return 0;
}


//train_model();
train_gan_model()
