#!/usr/bin/python3
#-*- coding: utf-8 -*-
import os
import numpy as np
import h5py
import sys
from preprocess import load_file_list

def training(dataset):
    os.system("./rnn_train.py %s"%(dataset))

h5_list = load_file_list(dirname='data/',dtype="h5")
for dataset, _ in h5_list:
    print("Train start - %s"%(dataset))
    training(dataset)
