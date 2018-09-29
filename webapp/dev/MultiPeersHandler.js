function MultiPeers(connection) {
    var self = this;

    var skipPeers = ['getAllParticipants', 'getLength', 'selectFirst', 'streams', 'send', 'forEach'];
    connection.peersBackup = {};
    connection.peers = {
        getLength: function() {
            var numberOfPeers = 0;
            for (var peer in this) {
                if (skipPeers.indexOf(peer) == -1) {
                    numberOfPeers++;
                }
            }
            return numberOfPeers;
        },
        selectFirst: function() {
            var firstPeer;
            for (var peer in this) {
                if (skipPeers.indexOf(peer) == -1) {
                    firstPeer = this[peer];
                }
            }
            return firstPeer;
        },
        getAllParticipants: function(sender) {
            var allPeers = [];
            for (var peer in this) {
                if (skipPeers.indexOf(peer) == -1 && peer != sender) {
                    allPeers.push(peer);
                }
            }
            return allPeers;
        },
        forEach: function(callbcak) {
            this.getAllParticipants().forEach(function(participant) {
                callbcak(connection.peers[participant]);
            });
        },
        send: function(data, remoteUserId) {
            var that = this;

            if (!isNull(data.size) && !isNull(data.type)) {
                self.shareFile(data, remoteUserId);
                return;
            }

            if (data.type !== 'text' && !(data instanceof ArrayBuffer) && !(data instanceof DataView)) {
                TextSender.send({
                    text: data,
                    channel: this,
                    connection: connection,
                    remoteUserId: remoteUserId
                });
                return;
            }

            if (data.type === 'text') {
                data = JSON.stringify(data);
            }

            if (remoteUserId) {
                var remoteUser = connection.peers[remoteUserId];
                if (remoteUser) {
                    if (!remoteUser.channels.length) {
                        connection.peers[remoteUserId].createDataChannel();
                        connection.renegotiate(remoteUserId);
                        setTimeout(function() {
                            that.send(data, remoteUserId);
                        }, 3000);
                        return;
                    }

                    remoteUser.channels.forEach(function(channel) {
                        channel.send(data);
                    });
                    return;
                }
            }

            this.getAllParticipants().forEach(function(participant) {
                if (!that[participant].channels.length) {
                    connection.peers[participant].createDataChannel();
                    connection.renegotiate(participant);
                    setTimeout(function() {
                        that[participant].channels.forEach(function(channel) {
                            channel.send(data);
                        });
                    }, 3000);
                    return;
                }

                that[participant].channels.forEach(function(channel) {
                    channel.send(data);
                });
            });
        }
    };

    this.uuid = connection.userid;

    this.getLocalConfig = function(remoteSdp, remoteUserId, userPreferences) {
        if (!userPreferences) {
            userPreferences = {};
        }

        return {
            streamsToShare: userPreferences.streamsToShare || {},
            rtcMultiConnection: connection,
            connectionDescription: userPreferences.connectionDescription,
            userid: remoteUserId,
            localPeerSdpConstraints: userPreferences.localPeerSdpConstraints,
            remotePeerSdpConstraints: userPreferences.remotePeerSdpConstraints,
            dontGetRemoteStream: !!userPreferences.dontGetRemoteStream,
            dontAttachLocalStream: !!userPreferences.dontAttachLocalStream,
            renegotiatingPeer: !!userPreferences.renegotiatingPeer,
            peerRef: userPreferences.peerRef,
            channels: userPreferences.channels || [],
            onLocalSdp: function(localSdp) {
                self.onNegotiationNeeded(localSdp, remoteUserId);
            },
            onLocalCandidate: function(localCandidate) {
                localCandidate = OnIceCandidateHandler.processCandidates(connection, localCandidate)
                if (localCandidate) {
                    self.onNegotiationNeeded(localCandidate, remoteUserId);
                }
            },
            remoteSdp: remoteSdp,
            onDataChannelMessage: function(message) {
                if (!connection.fbr && connection.enableFileSharing) initFileBufferReader();

                if (typeof message == 'string' || !connection.enableFileSharing) {
                    self.onDataChannelMessage(message, remoteUserId);
                    return;
                }

                var that = this;

                if (message instanceof ArrayBuffer || message instanceof DataView) {
                    connection.fbr.convertToObject(message, function(object) {
                        that.onDataChannelMessage(object);
                    });
                    return;
                }

                if (message.readyForNextChunk) {
                    connection.fbr.getNextChunk(message, function(nextChunk, isLastChunk) {
                        connection.peers[remoteUserId].channels.forEach(function(channel) {
                            channel.send(nextChunk);
                        });
                    }, remoteUserId);
                    return;
                }

                if (message.chunkMissing) {
                    connection.fbr.chunkMissing(message);
                    return;
                }

                connection.fbr.addChunk(message, function(promptNextChunk) {
                    connection.peers[remoteUserId].peer.channel.send(promptNextChunk);
                });
            },
            onDataChannelError: function(error) {
                self.onDataChannelError(error, remoteUserId);
            },
            onDataChannelOpened: function(channel) {
                self.onDataChannelOpened(channel, remoteUserId);
            },
            onDataChannelClosed: function(event) {
                self.onDataChannelClosed(event, remoteUserId);
            },
            onRemoteStream: function(stream) {
                if (connection.peers[remoteUserId]) {
                    connection.peers[remoteUserId].streams.push(stream);
                }

                self.onGettingRemoteMedia(stream, remoteUserId);
            },
            onRemoteStreamRemoved: function(stream) {
                self.onRemovingRemoteMedia(stream, remoteUserId);
            },
            onPeerStateChanged: function(states) {
                self.onPeerStateChanged(states);

                if (states.iceConnectionState === 'new') {
                    self.onNegotiationStarted(remoteUserId, states);
                }

                if (states.iceConnectionState === 'connected') {
                    self.onNegotiationCompleted(remoteUserId, states);
                }

                if (states.iceConnectionState.search(/closed|failed/gi) !== -1) {
                    self.onUserLeft(remoteUserId);
                    self.disconnectWith(remoteUserId);
                }
            }
        };
    };

    this.createNewPeer = function(remoteUserId, userPreferences) {
        if (connection.maxParticipantsAllowed <= connection.getAllParticipants().length) {
            return;
        }

        userPreferences = userPreferences || {};

        if (connection.isInitiator && !!connection.session.audio && connection.session.audio === 'two-way' && !userPreferences.streamsToShare) {
            userPreferences.isOneWay = false;
            userPreferences.isDataOnly = false;
            userPreferences.session = connection.session;
        }

        if (!userPreferences.isOneWay && !userPreferences.isDataOnly) {
            userPreferences.isOneWay = true;
            this.onNegotiationNeeded({
                enableMedia: true,
                userPreferences: userPreferences
            }, remoteUserId);
            return;
        }

        userPreferences = connection.setUserPreferences(userPreferences, remoteUserId);
        var localConfig = this.getLocalConfig(null, remoteUserId, userPreferences);
        connection.peers[remoteUserId] = new PeerInitiator(localConfig);

        this.checkIfNextPossibleInitiator(remoteUserId);
    };

    this.createAnsweringPeer = function(remoteSdp, remoteUserId, userPreferences) {
        userPreferences = connection.setUserPreferences(userPreferences || {}, remoteUserId);

        var localConfig = this.getLocalConfig(remoteSdp, remoteUserId, userPreferences);
        connection.peers[remoteUserId] = new PeerInitiator(localConfig);
        this.checkIfNextPossibleInitiator(remoteUserId);
    };

    this.renegotiatePeer = function(remoteUserId, userPreferences, remoteSdp) {
        if (!connection.peers[remoteUserId]) {
            if (connection.enableLogs) {
                console.error('Peer (' + remoteUserId + ') does not exist. Renegotiation skipped.');
            }
            return;
        }

        if (!userPreferences) {
            userPreferences = {};
        }

        userPreferences.renegotiatingPeer = true;
        userPreferences.peerRef = connection.peers[remoteUserId].peer;
        userPreferences.channels = connection.peers[remoteUserId].channels;

        var localConfig = this.getLocalConfig(remoteSdp, remoteUserId, userPreferences);

        connection.peers[remoteUserId] = new PeerInitiator(localConfig);
        this.checkIfNextPossibleInitiator(remoteUserId);
    };

    this.replaceTrack = function(track, remoteUserId, isVideoTrack) {
        if (!connection.peers[remoteUserId]) {
            throw 'This peer (' + remoteUserId + ') does not exist.';
        }

        var peer = connection.peers[remoteUserId].peer;

        if (!!peer.getSenders && typeof peer.getSenders === 'function' && peer.getSenders().length) {
            peer.getSenders().forEach(function(rtpSender) {
                if (isVideoTrack && rtpSender.track instanceof VideoStreamTrack) {
                    connection.peers[remoteUserId].peer.lastVideoTrack = rtpSender.track;
                    rtpSender.replaceTrack(track);
                }

                if (!isVideoTrack && rtpSender.track instanceof AudioStreamTrack) {
                    connection.peers[remoteUserId].peer.lastAudioTrack = rtpSender.track;
                    rtpSender.replaceTrack(track);
                }
            });
            return;
        }

        console.warn('RTPSender.replaceTrack is NOT supported.');
        this.renegotiatePeer(remoteUserId);
    };

    this.onNegotiationNeeded = function(message, remoteUserId) {};
    this.addNegotiatedMessage = function(message, remoteUserId) {
        if (message.type && message.sdp) {
            if (message.type == 'answer') {
                if (connection.peers[remoteUserId]) {
                    connection.peers[remoteUserId].addRemoteSdp(message);
                }
            }

            if (message.type == 'offer') {
                if (message.renegotiatingPeer) {
                    this.renegotiatePeer(remoteUserId, null, message);
                } else {
                    this.createAnsweringPeer(message, remoteUserId);
                }
            }

            if (connection.enableLogs) {
                console.log('Remote peer\'s sdp:', message.sdp);
            }
            return;
        }

        if (message.candidate) {
            if (connection.peers[remoteUserId]) {
                connection.peers[remoteUserId].addRemoteCandidate(message);
            }

            if (connection.enableLogs) {
                console.log('Remote peer\'s candidate pairs:', message.candidate);
            }
            return;
        }

        if (message.enableMedia) {
            connection.session = message.userPreferences.session || connection.session;

            if (connection.session.oneway && connection.attachStreams.length) {
                connection.attachStreams = [];
            }

            if (message.userPreferences.isDataOnly && connection.attachStreams.length) {
                connection.attachStreams.length = [];
            }

            var streamsToShare = {};
            connection.attachStreams.forEach(function(stream) {
                streamsToShare[stream.streamid] = {
                    isAudio: !!stream.isAudio,
                    isVideo: !!stream.isVideo,
                    isScreen: !!stream.isScreen
                };
            });
            message.userPreferences.streamsToShare = streamsToShare;

            self.onNegotiationNeeded({
                readyForOffer: true,
                userPreferences: message.userPreferences
            }, remoteUserId);
        }

        if (message.readyForOffer) {
            connection.onReadyForOffer(remoteUserId, message.userPreferences);
        }

        function cb(stream) {
            gumCallback(stream, message, remoteUserId);
        }
    };

    function gumCallback(stream, message, remoteUserId) {
        var streamsToShare = {};
        connection.attachStreams.forEach(function(stream) {
            streamsToShare[stream.streamid] = {
                isAudio: !!stream.isAudio,
                isVideo: !!stream.isVideo,
                isScreen: !!stream.isScreen
            };
        });
        message.userPreferences.streamsToShare = streamsToShare;

        self.onNegotiationNeeded({
            readyForOffer: true,
            userPreferences: message.userPreferences
        }, remoteUserId);
    }

    this.connectNewParticipantWithAllBroadcasters = function(newParticipantId, userPreferences, broadcastersList) {
        if (connection.socket.isIO) {
            return;
        }

        broadcastersList = (broadcastersList || '').split('|-,-|');

        if (!broadcastersList.length) {
            return;
        }

        var firstBroadcaster;

        var remainingBroadcasters = [];
        broadcastersList.forEach(function(list) {
            list = (list || '').replace(/ /g, '');
            if (list.length) {
                if (!firstBroadcaster) {
                    firstBroadcaster = list;
                } else {
                    remainingBroadcasters.push(list);
                }
            }
        });

        if (!firstBroadcaster) {
            return;
        }

        self.onNegotiationNeeded({
            newParticipant: newParticipantId,
            userPreferences: userPreferences || false
        }, firstBroadcaster);

        if (!remainingBroadcasters.length) {
            return;
        }

        setTimeout(function() {
            self.connectNewParticipantWithAllBroadcasters(newParticipantId, userPreferences, remainingBroadcasters.join('|-,-|'));
        }, 3 * 1000);
    };

    this.onGettingRemoteMedia = function(stream, remoteUserId) {};
    this.onRemovingRemoteMedia = function(stream, remoteUserId) {};
    this.onGettingLocalMedia = function(localStream) {};
    this.onLocalMediaError = function(error, constraints) {
        connection.onMediaError(error, constraints);
    };

    function initFileBufferReader() {
        connection.fbr = new FileBufferReader();
        connection.fbr.onProgress = function(chunk) {
            connection.onFileProgress(chunk);
        };
        connection.fbr.onBegin = function(file) {
            connection.onFileStart(file);
        };
        connection.fbr.onEnd = function(file) {
            connection.onFileEnd(file);
        };
    }

    this.shareFile = function(file, remoteUserId) {
        if (!connection.enableFileSharing) {
            throw '"connection.enableFileSharing" is false.';
        }

        initFileBufferReader();

        connection.fbr.readAsArrayBuffer(file, function(uuid) {
            var arrayOfUsers = connection.getAllParticipants();

            if (remoteUserId) {
                arrayOfUsers = [remoteUserId];
            }

            arrayOfUsers.forEach(function(participant) {
                connection.fbr.getNextChunk(uuid, function(nextChunk) {
                    connection.peers[participant].channels.forEach(function(channel) {
                        channel.send(nextChunk);
                    });
                }, participant);
            });
        }, {
            userid: connection.userid,
            // extra: connection.extra,
            chunkSize: DetectRTC.browser.name === 'Firefox' ? 15 * 1000 : connection.chunkSize || 0
        });
    };

    if (typeof 'TextReceiver' !== 'undefined') {
        var textReceiver = new TextReceiver(connection);
    }

    this.onDataChannelMessage = function(message, remoteUserId) {
        textReceiver.receive(JSON.parse(message), remoteUserId, connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {});
    };

    this.onDataChannelClosed = function(event, remoteUserId) {
        event.userid = remoteUserId;
        event.extra = connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {};
        connection.onclose(event);
    };

    this.onDataChannelError = function(error, remoteUserId) {
        error.userid = remoteUserId;
        event.extra = connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {};
        connection.onerror(error);
    };

    this.onDataChannelOpened = function(channel, remoteUserId) {
        // keep last channel only; we are not expecting parallel/channels channels
        if (connection.peers[remoteUserId].channels.length) {
            connection.peers[remoteUserId].channels = [channel];
            return;
        }

        connection.peers[remoteUserId].channels.push(channel);
        connection.onopen({
            userid: remoteUserId,
            extra: connection.peers[remoteUserId] ? connection.peers[remoteUserId].extra : {},
            channel: channel
        });
    };

    this.onPeerStateChanged = function(state) {
        connection.onPeerStateChanged(state);
    };

    this.onNegotiationStarted = function(remoteUserId, states) {};
    this.onNegotiationCompleted = function(remoteUserId, states) {};

    this.getRemoteStreams = function(remoteUserId) {
        remoteUserId = remoteUserId || connection.peers.getAllParticipants()[0];
        return connection.peers[remoteUserId] ? connection.peers[remoteUserId].streams : [];
    };

    this.checkIfNextPossibleInitiator = function(remoteUserId) {
        if (connection.sessionid === remoteUserId) return;
        if (connection.autoCloseEntireSession) return;
        if (connection.isInitiator && connection.getAllParticipants().length > 1) return;

        connection.socket.emit(connection.socketMessageEvent, {
            remoteUserId: remoteUserId,
            message: 'next-possible-initiator',
            sender: connection.userid
        });
    };
}
