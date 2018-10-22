#!/usr/bin/python3
#-*- coding: utf-8 -*-

VCTK_PATH = "../data/corpus/vctk_corpus/"
VCTK_RAW_PATH = "../data/corpus/vctk_corpus_raw/"
NOISE_PATH = "../data/noise/rnnoise_contributions/"
YOUTUBE_NOISE_PATH = "../data/noise/youtube/"
YOUTUBE_NOISE_RAW_PATH = "../data/noise/youtube/"

import os
import numpy as np
import h5py
import sys

def load_file_list(dirname='data/',dtype="wav"):
    file_list = []    
    filenames = os.listdir(dirname)
    file_extensions = set(["." + dtype])
    for filename in filenames:
        ext = os.path.splitext(filename)[-1]
        if ext in file_extensions:
            full_filename = os.path.join(dirname, filename)
            file_list.append((full_filename, filename))

    return file_list

# Dependency - ffmpeg 
def convertWav2Raw(wav_list, raw_path):
    print("raw data will be saved in", raw_path)
    raw_list = []
    for wpath, wname in wav_list:
        #os.system("du -h %s"%(wpath))
        rname = wname.split(".")[0] + ".raw"
        rpath = raw_path + rname
        raw_list.append((rpath, rname))
        os.system("ffmpeg -i %s -f s16le -acodec pcm_s16le %s"%(wpath, rpath))
        
    return raw_list


def denoise_training(corpus_path, noise_path, output_path="temp.f32"):
    print(corpus_path, noise_path)
    os.system("./denoise_training %s %s %s < %s"%(corpus_path, noise_path, output_path, "byte_size.txt"))
    return output_path

    
def bin2hdf5(f32_path, byte_count, h5_path):
    data = np.fromfile(f32_path, dtype='float32');
    data = np.reshape(data, (int(byte_count), 87 ));
    h5f = h5py.File(h5_path, 'w');
    h5f.create_dataset('data', data=data)
    h5f.close()


def get_equal_length_list(a_list, b_list):
    if len(a_list) > len(b_list):
        for i in range(len(a_list)-len(b_list)):
            b_list.append(b_list[i])
    else:
        for i in range(len(b_list)-len(a_list)):
            a_list.append(a_list[i])
    
    ab_list = []
    
    for i in range(len(a_list)):
        ab_list.append((a_list[i], b_list[i]))
    
    return ab_list


if __name__ == "__main__":
    # get raw data noise list
    noise_raw_list = load_file_list(NOISE_PATH,"raw")

    # get wav corpus list
    corpus_wav_list = load_file_list(VCTK_PATH, "wav")

    # convert wav -> raw
    corpus_raw_list = convertWav2Raw(corpus_wav_list, VCTK_RAW_PATH)

    # make f32 format data and convert hdf5
    raw_list = get_equal_length_list(corpus_raw_list, noise_raw_list)
    byte_count = 15000
    for i, (corpus, noise) in enumerate(raw_list):
        f32_path = denoise_training(corpus[0], noise[0])
        h5_path = "data/rnnoise_dataset%d.h5"%(i)
        bin2hdf5(f32_path=f32_path, byte_count=byte_count, h5_path=h5_path)
        print("saved %s"%(h5_path))
      
    




























