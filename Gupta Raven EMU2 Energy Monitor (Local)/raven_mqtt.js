/**
 * Reads energy data from a smart meter via a RAVEn RFA-Z106 dongle (http://www.rainforestautomation.com/raven).
 * Publishes energy data to a MQTT service.
 */

var Raven = require("./raven.js").Raven,
	options = require("./raven.js").options,
	logger = require("./raven.js").logger,
	//options = require('./config.js'),
   	//crypto = require('crypto'),
   	mqtt = require('mqtt'),
	winston = logger.loggers.get('mqtt');

/**
 * Publishes power/energy events from a Raven USB stick to an MQTT service
 */
var RavenMqtt = function() {
	var self = this;
	this.raven = new Raven();
	
	// last known state
	this.state = { power: {}, energyIn: {}, energyOut: {}, usageCurrent: {} , usageLast: {}  };
	
	// MQTT topics
	this.TOPIC_demand     = options.demandPath || "/house/meter/power";
	this.TOPIC_energyIn  = options.energyInPath || "/house/meter/energyin";
	this.TOPIC_energyOut = options.energyOutPath || "/house/meter/energyout";
	this.TOPIC_usageCurrent = options.currentUsagePath || "/house/meter/usagecurrent";
	this.TOPIC_usageLast = options.lastUsagePath || "/house/meter/usagelast";
	this.TOPIC_mqttMsg = options.mqttMsgPath || "/house/meter/usagelast";
	this.TOPIC_mqttErr = options.mqttErrPath || "/house/meter/usagelast";
	this.TOPIC_msghandler = options.msgPath || "/house/meter/info";
	
	this.raven.on("open", function() {
		initMqtt(self);
	});
};


// handle serial port open
function initMqtt(self) {

	var self = this;
	winston.info('Initiating MQTT session');
	
	// connect to MQTT service
	//var clientId = "raven_" + crypto.randomBytes(8).toString('hex');		// create a random client ID for MQTT
	var mqttClient = mqtt.connect(options.mqttHost); 
	mqttClient.subscribe(self.TOPIC_msghandler);

	// add handlers to MQTT client
	mqttClient.on('connect', function() {
		winston.info('MQTT session opened');
	});
	mqttClient.on('close', function() {
		winston.info('MQTT close');
	});
	mqttClient.on('error', function(e) {
		// ??? seems to timeout a lot
		winston.error('MQTT error: ' + e);
	});

	mqttClient.addListener('message', function(topic, payload) {
		// got data from subscribed topic
			winston.debug('received ' + topic + ' : ' + payload);
			self.raven.processMqttMsg(topic, payload);
	});	

	
	// add serial port data handler	
	self.raven.on('demand', function(demand) {
		self.state.demand = demand;
		mqttClient.publish(self.TOPIC_demand, JSON.stringify(self.state.demand));
	});

	// energy used
	self.raven.on('energy-in', function(energy) {
		self.state.energyIn = energy;
		mqttClient.publish(self.TOPIC_energyIn, JSON.stringify(self.state.energyIn));

	});

	// energy fed-in to the grid
	self.raven.on('energy-out', function(energy) {
		self.state.energyOut = energy;
		mqttClient.publish(self.TOPIC_energyOut, JSON.stringify(self.state.energyOut));
	});

	// energy fed-in to the grid
	self.raven.on('usage-current', function(usage) {
		self.state.usageCurrent = usage;
		mqttClient.publish(self.TOPIC_usageCurrent, JSON.stringify(self.state.usageCurrent));
	});

	// energy fed-in to the grid
	self.raven.on('usage-last', function(usage) {
		self.state.usageLast = usage;
		mqttClient.publish(self.TOPIC_usageLast, JSON.stringify(self.state.usageLast));
		//winston.info("Published " + self.TOPIC_usageLast, JSON.stringify(self.state.usageLast));
	});

	// consolidated energy data  package to mqtt
	self.raven.on('mqtt-msg', function(msg) {
		self.state.mqttMsg = msg;
		mqttClient.publish(self.TOPIC_mqttMsg, JSON.stringify(self.state.mqttMsg));
		//winston.info("Published " + self.TOPIC_usageLast, JSON.stringify(self.state.usageLast));
	});

	// error messages to mqtt
	self.raven.on('mqtt-err', function(err) {
		self.state.mqttErr = err;
		mqttClient.publish(self.TOPIC_mqttErr, JSON.stringify(self.state.mqttErr));
		//winston.info("Published " + self.TOPIC_usageLast, JSON.stringify(self.state.usageLast));
	});
};

exports.RavenMqtt = {
	RavenMqtt: RavenMqtt()
};
