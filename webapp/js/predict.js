const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-node');
const fs = require("fs");

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

function subpixel1D(){
    return new SubPixel1D();
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
    const u_sbpx3  = subpixel1D();
    const u_conc3  = tf.layers.concatenate();

    const u_conv2  = tf.layers.conv1d({kernelSize: 8, filters: 32*2, strides: 1, 
                                       activation: 'relu', kernelInitializer: 'glorotUniform', padding:'same'});
    const u_drop2  = tf.layers.dropout(0.5);
    const u_sbpx2  = subpixel1D();
    const u_conc2  = tf.layers.concatenate();

    const u_conv1  = tf.layers.conv1d({kernelSize: 8, filters: 32*2, strides: 1, 
                                       activation: 'relu', kernelInitializer: 'glorotUniform', padding:'same'});
    const u_drop1  = tf.layers.dropout(0.5);
    const u_sbpx1  = subpixel1D();
    const u_conc1  = tf.layers.concatenate();

    const f_conv  = tf.layers.conv1d({kernelSize: 4, filters: 2, strides: 1, 
                                      activation: 'relu', kernelInitializer: 'glorotUniform', padding:'same'});
    const f_sbpx  = subpixel1D();
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



async function predict(){
    const model = base_model();
//     const weights = model.getWeights();
//     fs.writeFile('weights', weights, (err) => {
//       if (err) throw err;
//       console.log('The file has been saved!');
//     });
//     print(weights[0]);
    model = await tf.loadModel('file://./asr-model/model.json');
}

predict();





