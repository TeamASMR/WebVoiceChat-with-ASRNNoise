/* Copyright (c) 2017 Mozilla */
/*
   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions
   are met:

   - Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.

   - Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
   ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
   LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
   A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE FOUNDATION OR
   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
   PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

#include <stdio.h>
#include <stdint.h>
#include "rnnoise.h"

#define FRAME_SIZE 480
//static DenoiseState *gst;

int web_rnnoise(int strucAddr, float *input_buffer,int input_buffer_length) {
  int i,j;
  int quotient;
  int remainder;
  float *input_pointer;
  //float x[FRAME_SIZE]; 
  DenoiseState *st;
  //st = strucAddr;
  st = rnnoise_create();

  quotient = input_buffer_length / FRAME_SIZE;
  remainder = input_buffer_length % FRAME_SIZE;
  
  /*
  for(i=0; i<quotient; i++)
  {
	  for(j=0; j<FRAME_SIZE ; j++) x[j] = input_buffer[i*quotient+j];
	  rnnoise_process_frame(st, x, x);
	  for(j=0; j<FRAME_SIZE ; j++) input_buffer[i*quotient+j] = x[j];
  }

  for(i=0; i<FRAME_SIZE ; i++) x[i] = input_buffer[(input_buffer_length-1) - FRAME_SIZE + i];
  rnnoise_process_frame(st, x, x);
  for(i=0; i<FRAME_SIZE ; i++) input_buffer[(input_buffer_length-1) - FRAME_SIZE + i] = x[i];
  */


  
  input_pointer = input_buffer;

  for(i=0 ; i<quotient ; i++){
  	rnnoise_process_frame(st,input_pointer , input_pointer);
// 	if(i != (quotient-1))input_pointer += FRAME_SIZE;
    input_pointer += FRAME_SIZE;
  }

//   input_pointer += remainder;
//   rnnoise_process_frame(st,input_pointer , input_pointer);

  rnnoise_destroy(st);

  return 0;
}
