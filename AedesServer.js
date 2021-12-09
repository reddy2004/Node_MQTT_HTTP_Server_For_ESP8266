var fs = require('fs');
const aedes = require('aedes')();
var HashMap = require('hashmap');
const server = require('net').createServer(aedes.handle);
const port = 1883;

var array = fs.readFileSync('auth.json').toString();
var creds = JSON.parse(array);
var auth = creds.mqtt;
var notifier;
var devicesStatus = new HashMap();

var init = function () {
    auth.forEach(function (userAuth) {
        console.log(userAuth);
    });
};

/*
 * When you want to send something from the main thread to 
 * the aedes server
 */
var set_notification_handlers = function (eventsObject) {
    notifier = eventsObject;
    notifier.on('main-to-aedes-message', function (data) {
        console.log("bot-to-mqtt-message:" + JSON.stringify(data));
    });
    notifier.on('main-to-aedes-command', function (data) {
        console.log("bot-to-mqtt-command:" + JSON.stringify(data));
    });
}

var dump_devices = function () {
    devicesStatus.forEach(function (value, key) {
        console.log(key + " " + value);
    });
}

var start_server = function () {
    console.log("starting Aedes server..");
    var counter = 0;
    var configsRecieved = 0;

    server.listen(port, function () {
        console.log('server started and listening on port ', port)
    });

    aedes.authenticate = function (client, username, password, callback) {
        console.log('Client connected. Login ...' + username + " & " + password + " of " + client.id);
        //console.log(client);
        for (var i = 0; i < auth.length; i++) {
            var userAuth = auth[i]
            if (username == userAuth.username && password == userAuth.password) {
                console.log("User " + username + " is valid!");
                callback(null, true);
                return;
            }
        }
        console.log("Failed for user " + username);
        callback(null, false);
    }

    aedes.subscribe('fromClient', function (packet, cb) {
        console.log('Published', packet.payload.toString());
        console.log(packet);
        console.log(cb);
        aedes.publish({
            cmd: 'publish',
            qos: 2,
            topic: 'fromServer',
            payload: new Buffer('Thank you!' + packet.payload.toString()),
            retain: false
        });
    });

    aedes.on('publish', function (packet, client) {
        if (client) {
            console.log(packet);
            console.log('message from client', client.id)
            if (packet.topic == "status") {

                //Let main know so that http request also sees this
                //and then send it immediately via mqtt
                notifier.emit('configsRecieved', packet.payload);

                var reply = {};
                reply.esp01Pin0 = parseInt(packet.payload);
                    
                aedes.publish({
                    cmd: 'publish',
                    qos: 2,
                    topic: 'NFOXMQTT/Linea/tofox',
                    payload: new Buffer(JSON.stringify(reply)),
                    retain: false
                });

                devicesStatus.set(client.id, String(packet.payload));
                dump_devices();
                aedes.publish({
                    cmd: 'publish',
                    qos: 2,
                    topic: 'fromServer',
                    payload: new Buffer("(" + (counter++) + ")"),
                    retain: false
                });
            } else if (packet.topic == "NFOXMQTT/configJson") {
                configsRecieved++;
                
                aedes.publish({
                    cmd: 'publish',
                    qos: 2,
                    topic: 'configsRecieved',
                    payload: new Buffer("CFG (" + (configsRecieved) + ")"),
                    retain: false
                });
            }
        }
    })

    aedes.on('subscribe', function (subscriptions, client) {
        if (client) {
            console.log('subscribe from client', subscriptions, client.id)
        }
    })

    aedes.on('client', function (client) {
        console.log('new client', client.id)
    })
}

var send_message = function (clientid, message) {

}

/* MQTT server powered by Aedes */
module.exports.init_mqtt_server = init;
module.exports.start_mqtt_server = start_server;
module.exports.send_message = send_message;
module.exports.set_notification_handlers = set_notification_handlers;