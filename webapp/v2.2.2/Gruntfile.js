'use strict';

module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt, {
        pattern: 'grunt-*',
        config: 'package.json',
        scope: 'devDependencies'
    });

    // configure project
    grunt.initConfig({
        // make node configurations available
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                stripBanners: true,
                separator: '\n',
                banner: '// Last time updated at <%= grunt.template.today("dddd, mmmm dS, yyyy, h:MM:ss TT") %> \n\n'
            },
            dist: {
                src: [
                    'dev/head.js',
                    'dev/RTCMultiConnection.js',
                    'dev/RTCMultiSession.js',
                    'dev/globals.js',
                    'dev/getUserMedia.js',
                    'dev/PeerConnection.js',
                    'dev/FilesHandler.js',
                    'dev/DataMessagingHandler.js',
                    'dev/DetectRTC.js',
                    'dev/DetectRTC-Extender.js',
                    'dev/setDefaults.js',
                    'dev/tail.js'
                ],
                dest: 'RTCMultiConnection.js',
            },
        },
        htmlhint: {
            html1: {
                src: [
                    'demos/*.html'
                ],
                options: {
                    'tag-pair': true
                }
            }
        },
        uglify: {
            options: {
                mangle: false,
                banner: '// Last time updated at <%= grunt.template.today("dddd, mmmm dS, yyyy, h:MM:ss TT") %> \n\n'
            },
            my_target: {
                files: {
                    'RTCMultiConnection.min.js': ['RTCMultiConnection.js']
                }
            }
        },
        jsbeautifier: {
            files: ['RTCMultiConnection.js', 'dev/*.js', 'Gruntfile.js'],
            options: {
                js: {
                    braceStyle: "collapse",
                    breakChainedMethods: false,
                    e4x: false,
                    evalCode: false,
                    indentChar: " ",
                    indentLevel: 0,
                    indentSize: 4,
                    indentWithTabs: false,
                    jslintHappy: false,
                    keepArrayIndentation: false,
                    keepFunctionIndentation: false,
                    maxPreserveNewlines: 10,
                    preserveNewlines: true,
                    spaceBeforeConditional: true,
                    spaceInParen: false,
                    unescapeStrings: false,
                    wrapLineLength: 0
                },
                html: {
                    braceStyle: "collapse",
                    indentChar: " ",
                    indentScripts: "keep",
                    indentSize: 4,
                    maxPreserveNewlines: 10,
                    preserveNewlines: true,
                    unformatted: ["a", "sub", "sup", "b", "i", "u"],
                    wrapLineLength: 0
                },
                css: {
                    indentChar: " ",
                    indentSize: 4
                }
            }
        },
        bump: {
            options: {
                files: ['package.json', 'bower.json'],
                updateConfigs: [],
                commit: true,
                commitMessage: 'v%VERSION%',
                commitFiles: ['package.json', 'bower.json'],
                createTag: true,
                tagName: '%VERSION%',
                tagMessage: '%VERSION%',
                push: false,
                pushTo: 'upstream',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d'
            }
        }
    });

    // enable plugins

    // set default tasks to run when grunt is called without parameters
    // http://gruntjs.com/api/grunt.task
    grunt.registerTask('default', ['concat', 'jsbeautifier', 'htmlhint', 'uglify']);
};
