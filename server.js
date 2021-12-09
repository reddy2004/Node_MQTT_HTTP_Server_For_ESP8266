'use strict';

var https = require('https');
var fs = require('fs');
var EventEmitter = require('events')
var AedesServer = require('./AedesServer.js');

var url = require('url');

var crossMessageNotifier = new EventEmitter();

var selfBindAddress = "127.0.0.1";
var selfBindPort = 8080;


var ServerSideApp = function () {
    var self = this;
    var config;
    var telegramEnabled = false;
    var esp01Pin0 = 1;

    self.loadConfig = function () {
        var array = fs.readFileSync('config.json').toString();

        self.config = JSON.parse(array);
        console.log(self.config);
    }

    self.initialize = function () {
        self.loadConfig();
    }

    self.crossMessageNotifierInit = function () {
        crossMessageNotifier.on('cron-to-aedes', function (payload) {
            console.log("cron-to-aedes not implimented yet!");
        });

        crossMessageNotifier.on('configsRecieved', function (payload) {
            esp01Pin0 = parseInt(payload);
            console.log("*** got esp01Pin0 " + esp01Pin0 + " ****");
        });
    }

    /* 
     * These handlers are only for cross-component messaging. Server will decide on type of message
     * and what to do with them
     */ 
    self.setHandlers = function (crossMessageNotifier) {
        console.log("** Entering self.setHandlers");
        crossMessageNotifier.on('aedes-to-main', function (data) {

        });
    }

    self.start = function () {
        console.log("Starting ServerSideApp");

        self.crossMessageNotifierInit();
        self.setHandlers(crossMessageNotifier);

        AedesServer.init_mqtt_server(null);
        AedesServer.set_notification_handlers(crossMessageNotifier);
        AedesServer.start_mqtt_server();

        //Start the http server
        var server = require('http').createServer(function (req, res) {
            var pathname = url.parse(req.url).pathname;
            if (pathname.indexOf("/fox_ping") == 0) {
                var reply = {};
                reply.esp01Pin0 = esp01Pin0;
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(JSON.stringify(reply));
            } else if (pathname.indexOf("/downloadfilesforesp8266/") == 0) {
                //Allow download of certain kind of files to nodemcu
                if (pathname.indexOf("/downloadfilesforesp8266/logic.js") == 0) {
                    var array1 = fs.readFileSync('downloadfilesforesp8266/logic.js');
                    res.setHeader('Content-Length', array1.length);
                    res.writeHead(200, { 'Content-Type': 'text/javascript' });

                    res.write(array1);
                    res.end();
                } else if (pathname.indexOf("/downloadfilesforesp8266/body.txt") == 0) {
                    var array1 = fs.readFileSync('downloadfilesforesp8266/body.txt');
                    res.setHeader('Content-Length', array1.length);
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.write(array1);
                    res.end();
                } else if (pathname.indexOf("/downloadfilesforesp8266/moduleconfig.json") == 0) {
                    var array1 = fs.readFileSync('downloadfilesforesp8266/moduleconfig.json');
                    res.setHeader('Content-Length', array1.length);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.write(array1);
                    res.end();
                } else {
                    res.end("Unknown ESP8266 file requested! Closing");
                }
            }
            else
            {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end("Welcome to home server");
            }
        });

        server.listen(selfBindPort, selfBindAddress, function () {
            console.log("http! server listening on port " + selfBindAddress + ":" + selfBindPort);
        });

        server.on('connection', function (sock) {
            console.log('Client connected from ' + sock.remoteAddress);
        });
    }
}

var zapp = new ServerSideApp();
zapp.initialize();
zapp.start();
