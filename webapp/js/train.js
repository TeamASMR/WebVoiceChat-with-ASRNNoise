const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-node');

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

class SubPixel1D extends tf.layers.Layer {
    constructor() {
        super({});
        // TODO(bileschi): Can we point to documentation on masking here?
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
        //print('--input-shape--');
        //const input_shape = input.shape;
        //print(input_shape);
        const transpose_x = tf.transpose(input, [2,1,0]);
        //const tx_shape = transpose_x.shape;
        //print(tx_shape);
        const batchnd_x = tf.batchToSpaceND(transpose_x, [2], [[0,0]]);
        //const bx_shape = batchnd_x.shape;
        //print(bx_shape);
        const x = tf.transpose(batchnd_x , [2,1,0]);  
        return x;
    }

    getClassName() {
        return 'SubPixel1D';
    }
}

        
function print(x){
    console.log(x);
}
        
// make model!
function base_model(){

    // init tf.layers

    const d_conv1 = tf.layers.conv1d({kernelSize: 8, filters: 32, strides: 2, 
                                      activation: null, kernelInitializer: 'glorotUniform', padding:'same'});
    const d_actv1 = tf.layers.leakyReLU(0.2); 
    const d_conv2 = tf.layers.conv1d({kernelSize: 8, filters: 32, strides: 2,
                                      activation: null, kernelInitializer: 'glorotUniform', padding:'same'});
    const d_actv2 = tf.layers.leakyReLU(0.2); 
    const d_conv3 = tf.layers.conv1d({kernelSize: 8, filters: 48, strides: 2, 
                                      activation: null, kernelInitializer: 'glorotUniform', padding:'same'});
    const d_actv3 = tf.layers.leakyReLU(0.2); 

    const b_conv  = tf.layers.conv1d({kernelSize: 8, filters: 64, strides: 2, 
                                      activation: null, kernelInitializer: 'glorotUniform', padding:'same'});
    const b_actv  = tf.layers.leakyReLU(0.2); 

    const u_conv3  = tf.layers.conv1d({kernelSize: 8, filters: 48*2, strides: 1, 
                                       activation: 'relu', kernelInitializer: 'glorotUniform', padding:'same'});
    const u_drop3  = tf.layers.dropout(0.5);
    const u_sbpx3  = new SubPixel1D();
    const u_conc3  = tf.layers.concatenate();

    const u_conv2  = tf.layers.conv1d({kernelSize: 8, filters: 32*2, strides: 1, 
                                       activation: 'relu', kernelInitializer: 'glorotUniform', padding:'same'});
    const u_drop2  = tf.layers.dropout(0.5);
    const u_sbpx2  = new SubPixel1D();
    const u_conc2  = tf.layers.concatenate();

    const u_conv1  = tf.layers.conv1d({kernelSize: 8, filters: 32*2, strides: 1, 
                                       activation: 'relu', kernelInitializer: 'glorotUniform', padding:'same'});
    const u_drop1  = tf.layers.dropout(0.5);
    const u_sbpx1  = new SubPixel1D();
    const u_conc1  = tf.layers.concatenate();

    const f_conv  = tf.layers.conv1d({kernelSize: 4, filters: 2, strides: 1, 
                                      activation: 'relu', kernelInitializer: 'glorotUniform', padding:'same'});
    const f_sbpx  = new SubPixel1D();
    const f_add = tf.layers.add();

    // apply layers
    const x = tf.input({shape: [64,1]}); 
    const dx1 = d_conv1.apply(x);
    const da1 = d_actv1.apply(dx1);
    const dx2 = d_conv2.apply(da1);
    const da2 = d_actv2.apply(dx2);
    const dx3 = d_conv3.apply(da2);
    const da3 = d_actv3.apply(dx3);
    const bnc = b_conv.apply(da3);
    const bca = b_actv.apply(bnc);
    const ux3 = u_conv3.apply(bca);
    const ud3 = u_drop3.apply(ux3);
    const us3 = u_sbpx3.apply(ud3);
    const uc3 = u_conc3.apply([us3,da3]); // todo: concatenate-3
    const ux2 = u_conv2.apply(uc3);
    const ud2 = u_drop2.apply(ux2);
    const us2 = u_sbpx2.apply(ud2);
    const uc2 = u_conc2.apply([us2,da2]); // todo: concatenate-2
    const ux1 = u_conv1.apply(uc2);
    const ud1 = u_drop1.apply(ux1);
    const us1 = u_sbpx1.apply(ud1);
    const uc1 = u_conc1.apply([us1,da1]); // todo: concatenate-1
    const fx  = f_conv.apply(uc1);
    const fs  = f_sbpx.apply(fx);
    const y   = f_add.apply([fs,x]) // todo: add-final

    const model = tf.model({inputs: x, outputs: y});
    return model;
}
        
async function train_model(){
    
    // init dataset
    var fs = require("fs");
    var dataset_path = fs.readFileSync('dataset_list.txt','utf8');
    var dataset_list = dataset_path.split('\n');
    var dataset_dir = '/mnt/dataSet/json-data/';
    
    const model    = base_model();    
    model.compile({optimizer: 'adam',loss: 'meanSquaredError'});
    model.summary();
    
    var EPOCHS = 100;
    for(var epoch=0; epoch<EPOCHS; epoch++){
        for(var i=0; i < dataset_list.length; i++){
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
              batchSize:4000,
              epochs: 1,
              shuffle: true,
              validationSplit: 0.05,
              callbacks: {
                onBatchEnd: async (batch, log) => {
                  console.log(`Batch ${batch}: loss = ${log.loss}`);
                  await model.save('file://./asr-model');
                }
              }
            });
        }
    }
    
     
    print('Exit');
    
    return 0;
}


train_model();
