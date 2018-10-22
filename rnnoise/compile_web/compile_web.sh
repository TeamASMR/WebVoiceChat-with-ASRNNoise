#!/bin/sh
emcc *.c -o rnnoise_web.html -s EXPORTED_FUNCTIONS='["_web_rnnoise","_rnnoise_create"]' -s EXTRA_EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]'
cp rnnoise_web.js ../../webapp/dist/
cp rnnoise_web.wasm ../../webapp/dist/