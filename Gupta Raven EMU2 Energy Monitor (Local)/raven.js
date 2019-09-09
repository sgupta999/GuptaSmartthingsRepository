/**
 * Reads energy data from a smart meter via a RAVEn RFA-Z106 dongle (http://www.rainforestautomation.com/raven).
 */

var logger = require('winston'),
	util = require('util'),
	debug = require('debug')('serialport')
    serialport = require("serialport"),
    xml2js = require('xml2js'),
    events = require('events'),
	fs = require('fs'),
    jsonfile = require('jsonfile'),
	stripcomments = require("strip-json-comments"),
	readoptions = fs.readFileSync("./settings.json", 'utf8'),
	options = JSON.parse(stripcomments(readoptions)),
	S = require('string'),
	FastMap = require("collections/fast-map"),
	shell = require('shelljs'),
	LOG_DIR = getPath(options.logFolderPath, 'log'),
	LOG_FILE = LOG_DIR + 'raven.log';
	
//const {combine, timestamp, label, prettyPrint } = logger.format;

logger.loggers.add('raven', {
	  console: {
		level: options.logLevel,
		colorize: true,
		timestamp: function () {
			var date = new Date();
			return date.toLocaleString(); 
		},
		label:'raven.js:'
	  },
	  file: {
		filename: LOG_FILE,
		level: options.logLevel,
		colorize: true,
		timestamp: function () {
			var date = new Date();
			return date.toLocaleString(); 
		},
		label:'raven.js:',
		json: false
	  }
});

logger.loggers.add('mqtt', {
	  console: {
		level: options.logLevel,
		colorize: true,
		timestamp: function () {
			var date = new Date();
			return date.toLocaleString(); 
		},
		label:'raven_mqtt.js:'
	  },
	  file: {
		filename: LOG_FILE,
		level: options.logLevel,
		colorize: true,
		timestamp: function () {
			var date = new Date();
			return date.toLocaleString(); 
		},
		label:'raven_mqtt.js:',
		json: false
	  }
});

var winston = logger.loggers.get('raven');	
	

var DATA_DIR = getPath(options.logFolderPath, 'data'),
	STATE_FILE = DATA_DIR + 'state.json',
	EOD_ENERGYIN_FILE = DATA_DIR + 'eodenergyin.json',
	EOD_ENERGYOUT_FILE = DATA_DIR + 'eodenergyout.json',
	EOM_ENERGYIN_FILE = DATA_DIR + 'eomenergyin.json',
	EOM_ENERGYOUT_FILE = DATA_DIR + 'eomenergyout.json',
	DAILY_USAGEIN_FILE = DATA_DIR + 'usagein.json',
	DAILY_USAGEOUT_FILE = DATA_DIR + 'usageout.json',
	POWER_FILE = DATA_DIR + 'power.json',
	ENERGYIN_FILE = DATA_DIR + 'energyin.json',
	ENERGYOUT_FILE = DATA_DIR + 'energyout.json',
	portparser = new serialport.parsers.Readline,
	state={},
	data={},
	self,
	mqttMsg = new FastMap(),
	mqtt_topic
	dateOffset = Date.UTC(2000, 0, 1);  // date offset for RAVEn which presents timestamp as seconds since 2000-01-01


var Raven = function() {
    events.EventEmitter.call(this);	// inherit from EventEmitter
    self = this;
	winston.debug(util.format('%j',options));
	initialize();
    openPort();	
};

util.inherits(Raven, events.EventEmitter);

function initialize(){	
	mqtt_topic = options.msgPath;
	state['serialPath'] = options.serialPath;
	state['POLL_DEMAND'] = false;
	state['POLL_ENERGY'] = false;
	state['POLL_USAGE_CURRENT'] = false;
	state['POLL_USAGE_LAST']= false;
	state['PORT_INITIALIZED'] =false
	state['PORT_RESET_FREQUENCY'] = ((options.portResetFreq != null) && (options.portResetFreq != '')) ? Math.min(Math.max(options.portResetFreq,1800), 6*3600) : 900;
	state['FIRST_RUN'] = true;
	state['failCount'] = 0;
	state['retries'] = 0;
	state['TIMEOUT'] = 2*60*60*1000;
	data['today'] = new Date();
	var input = loadSavedData();
	data['yday'] = ((input.timestamp != null) && (input.timestamp != '')) ? new Date(input.timestamp) : new Date();
	data['energyOutYday'] = ((input.energyout != null) && (input.energyout != '')) ? input.energyout : 0;
	data['energyInYday'] = ((input.energyin != null) && (input.energyin != '')) ? input.energyin : 0;	
	if (input.thismonth ==  null){		
		data['energyOutThisMonth'] = 0;	
		data['energyInThisMonth'] = 0;
		data['energyOutTMStartDate'] = data.today;
		data['energyOutTMDays'] = 0;		
	}else {
		data['energyOutThisMonth']=input.thismonth.energyout;
		data['energyOutTMStartDate']=new Date(input.thismonth.startdate);
		data['energyOutTMDays']=input.thismonth.days
		data['energyInThisMonth']=input.thismonth.energyin;
	}
	if (input.lastmonth ==  null){		
		data['energyOutLastMonth'] = 0;
		data['energyInLastMonth'] = 0;
		data['energyOutLMStartDate'] = data.today;
		data.energyOutLMStartDate = data.energyOutLMStartDate.setMonth(data.today.getMonth()-1)
		data['energyOutLMEndDate'] = data.today;
		data['energyOutLMDays'] = 0;	
	} else {
		data['energyOutLastMonth']=input.lastmonth.energyout;
		data['energyOutLMStartDate']=new Date(input.lastmonth.startdate);
		data['energyOutLMEndDate']=new Date(input.lastmonth.enddate);
		data['energyOutLMDays']=input.lastmonth.days;
		data['energyInLastMonth']=input.lastmonth.energyin;
	}
	if ((data.today.getTime() - data.yday.getTime()) > 24*60*60*1000){
		data.energyOutYday = 0;
		data.energyInYday = 0;
	}
	state['meterSchedule'] = ((options.meterReadSch != null) && (options.meterReadSch != '')) ? options.meterReadSch.split(',') : {};
	state.meterSchedule.forEach(function(date,index){
		state.meterSchedule[index] = new Date(date);
	});
	state.meterSchedule.forEach(function(date,index){	
		if (date < data.today) state.meterSchedule.splice(index,1);
	});
	data['energyInToday']=0;
	data['energyOutToday']=0;
	data['powerTable']=new FastMap();
	data['energyIn']=new FastMap();
	data['energyOut']=new FastMap();
	data['energyInEOD']=new FastMap();
	data['energyOutEOD']=new FastMap();
	data['energyDailyIn']=new FastMap();
	data['energyDailyOut']=new FastMap();
	data['energyInEOM']=new FastMap();
	data['energyOutEOM']=new FastMap();	
	setTimeout(function(){
			state['checkPortTimer'] = setInterval(checkPort, 60000 );
	},30000);
	state['demandTimer'] = setInterval(pollDemand, options.pollDemandFreq*1000);
	setTimeout(function(){
		state['allTimer'] = setInterval(pollAll, options.pollAllFreq*1000);
	},30000);
	state['saveTimer'] = setInterval(saveData, options.dataSaveTimer*1000);
	winston.info('Inititalized ...');
}

function suspend(){
	if (!state.SUSPENDED){
		state['SUSPENSION_START_TIME'] = new Date();
	}
	if (((new Date).getTime() - state.SUSPENSION_START_TIME.getTime()) >= state.TIMEOUT) {
		winston.error("No port activity has been evident for more than " + formatTime((new Date).getTime()- state.SUSPENSION_START_TIME.getTime()));
		saveData();
		winston.error("Quitting process. GOOD BYE");
		process.exit(1);
	}		
	state.failCount = 0;
	state.retries = 0;
	winston.info("Waiting in suspended mode");
	if (state.SUSPENDED) return;
	state.SUSPENDED = true;
	clearInterval(state.demandTimer);
	clearInterval(state.allTimer);
	clearInterval(state.saveTimer);
	clearInterval(state.checkPortTimer);
	setTimeout(function(){
			state.checkPortTimer = setInterval(checkPort, 60000 );
	},state.PORT_RESET_FREQUENCY*1000);
}

function wakeup(){
	state.SUSPENDED = false;
	state.failCount = 0;
	state.retries= 0;
	clearInterval(state.demandTimer);
	clearInterval(state.allTimer);
	clearInterval(state.saveTimer);
	clearInterval(state.checkPortTimer);
	state.demandTimer = setInterval(pollDemand, options.pollDemandFreq*1000);
	setTimeout(function(){
		state.allTimer = setInterval(pollAll, options.pollAllFreq*1000);
	},30000);
	state.saveTimer = setInterval(saveData, options.dataSaveTimer*1000);
	state.checkPortTimer = setInterval(checkPort, 60000 );
	console.log('Ready to begin polling ...');
}

function formatTime (time){
	time = time/1000;
	return (("0"+ Math.floor(time/(3600*24))).slice(-2) +"d, "+ ("0"+Math.floor((time%(3600*24))/3600)).slice(-2)+":"+("0"+Math.floor((time%3600)/60)).slice(-2)+":"+("0"+(time%60)).slice(-2));
}

function saveData (){			
		jsonfile.writeFileSync(STATE_FILE, {timestamp:data.yday, energyin:data.energyInYday, energyout:data.energyOutYday,
		thismonth:{energyout:data.energyOutThisMonth, energyin:data.energyInThisMonth, startdate:data.energyOutTMStartDate, days: data.energyOutTMDays},	
		lastmonth:{energyout:data.energyOutLastMonth, energyin:data.energyInLastMonth, startdate:data.energyOutLMStartDate, enddate:data.energyOutLMEndDate,days: data.energyOutLMDays}});
		
		if (data.energyInEOD.length > 0) saveMap(EOD_ENERGYIN_FILE,data.energyInEOD);
		if (data.energyOutEOD.length > 0) saveMap(EOD_ENERGYOUT_FILE,data.energyOutEOD);
		if (data.energyInEOM.length > 0) saveMap(EOM_ENERGYIN_FILE,data.energyInEOM);
		if (data.energyOutEOM.length > 0) saveMap(EOM_ENERGYOUT_FILE,data.energyOutEOM);
		if (data.energyDailyIn.length > 0) saveMap(DAILY_USAGEIN_FILE,data.energyDailyIn);
		if (data.energyDailyOut.length > 0) saveMap(DAILY_USAGEOUT_FILE,data.energyDailyOut);
		if (data.energyIn.length > 0) saveMap(ENERGYIN_FILE,data.energyIn);
		if (data.energyOut.length > 0 ) saveMap(ENERGYOUT_FILE,data.energyOut);
		if (data.powerTable.length > 0) saveMap(POWER_FILE,data.powerTable);
		
		winston.info('saved data...');
}

function saveMap(path, map ){	// convert array to JSON Map
	 jsonfile.writeFileSync(path,map,{flag: 'a'});
	 var contents = fs.readFileSync(path, 'utf8');
	 var result = contents.replace(/\]\]\n\[\[/g,'\],\n\[');	 
	 fs.writeFileSync(path, result, 'utf8');
	 map.clear();
}


function getPath(path, defaultPath){
	var defaultPath = process.cwd() + "/" + defaultPath +"/"; 
		if ((path != null) && (path != '')){
			if (shell.test('-d', path)) return (path+"/");
		}
		console.log("Path specified '" + path + "' does not exist. Resorting to default path '"+defaultPath+" '."); 
		if (shell.test('-d', defaultPath)) return defaultPath 
		else {
			try {
				shell.mkdir(defaultPath);
			}catch (ex){
				console.log("Default directory '" + defaultPath + "' does not exist. Could not create one. Saving to '" + process.vwd() + "'."); 
				return (process.cwd() + "/");
			}			
			console.log("Default directory '" + defaultPath + "' does not exist. Creating..."); 
			return ( defaultPath);
		}
}


function loadSavedData(){
	winston.info("Loading saved data...");
    var output;
    try {
        output = jsonfile.readFileSync(STATE_FILE);
		//winston.info(output);
    } catch (ex) {
        winston.info('No previous state found, continuing');		
		output = {timestamp:new Date(), energyin:0, energyout:0,
		thismonth:{energyout:0, energyin:0, startdate:data.today, days: 0},	
		lastmonth:{energyout:0, energyin:0, startdate:(new Date(date.today.getTime()).setMonth(data.today.getMonth()-1)), enddate:data.today, days:0}};
    }
    return output;
}

function newDay (){
	var isNewDay = (data.today.getDate() === (new Date()).getDate()) ? false : true ;
	return isNewDay;
}

function rolloverDay(){
	data.yday = data.today;
	data.yday.setHours(23,59,59,999);
	data.energyDailyIn.add(data.energyInToday-data.energyInYday,data.yday);
	data.energyDailyOut.add(data.energyOutToday-data.energyOutYday,data.yday);
	data.energyInEOD.add(data.energyInToday,data.yday);
	data.energyOutEOD.add(data.energyOutToday,data.yday);
	data.energyInYday = data.energyInToday;
	data.energyOutYday = data.energyOutToday;
	data.today = new Date();
	winston.info("New Day " + data.today.toLocaleString());
	if (state.meterSchedule.length > 0){
		state.meterSchedule.forEach(function(date,index){
			if ((date.getDate() == data.today.getDate()) && (date.getMonth()== data.today.getMonth()) && (date.getYear() ==  data.today.getYear())) {
				rolloverMonth();
				state.meterSchedule.splice(index,1);
			}
		});
	} else if (date.today.getDate() == 1){
		rolloverMonth();	
	}
}


function rolloverMonth(){	
	winston.info('Month Rollover - Closing current period at Meter - '+ data.today.toLocaleString());
	self.closeCurrentPeriod();
	data.energyOutLastMonth = data.energyOutYday - data.energyOutThisMonth;
	data.energyInLastMonth = data.energyInYday - data.energyInThisMonth;
	data.energyOutThisMonth = data.energyOutYday;	
	data.energyInThisMonth = data.energyInYday;
	data.energyOutLMStartDate = data.energyOutTMStartDate;
	data.energyOutLMEndDate = data.yday;
	data.energyOutTMStartDate = data.today;
	data.energyOutTMDays = 0;	
	data.energyOutLMDays = Math.round((data.energyOutLMEndDate.getTime() - data.energyOutLMStartDate.getTime())/(1000*60*60*24));
	data.energyInEOM.add(data.energyInLastMonth,data.yday);
	data.energyOutEOM.add(data.energyOutLastMonth,data.yday);
}

/**
 * Get the connection status between the USB device and the power meter 
 */
Raven.prototype.getConnectionStatus = function() {
	writeCommand(this.serialPort, "get_connection_status");
};

/**
 * Get informaiton about the device
 */
Raven.prototype.getDeviceInfo = function() {
	writeCommand(this.serialPort, "get_device_info");
};

/**
 * Initialise the XML parser.
 */
Raven.prototype.initialize = function() {
	writeCommand(this.serialPort, "initialize");
};

/**
 * Restart device
 */
Raven.prototype.restart = function() {
	writeCommand(this.serialPort, "restart");
};

/**
 * Decommission device and restart.
 */
Raven.prototype.factoryReset = function() {
	writeCommand(this.serialPort, "factory_reset");
};

Raven.prototype.getMeterList = function() {
        writeCommand(this.serialPort, "get_meter_list");
};

Raven.prototype.getMeterInfo = function() {
        writeCommand(this.serialPort, "get_meter_info");
};

/**
 * Query the amount of energy used or fed-in.
 */
Raven.prototype.getSumEnergy = function() {
	writeFullCommand(this.serialPort, "<Name>get_current_summation_delivered</Name><Refresh>Y</Refresh>");
	//writeCommand(this.serialPort, "get_current_summation_delivered");	
};

/**
 * Get the power currently being used (or fed-in)
 */
Raven.prototype.getSumPower = function() {
	writeFullCommand(this.serialPort, "<Name>get_instantaneous_demand</Name><Refresh>Y</Refresh>");
	//self.serialPort.write("<Command><Name>get_instantaneous_demand</Name><Refresh>Y</Refresh></Command>\r\n");
	//writeCommand(this.serialPort, "get_instantaneous_demand");
};


/**
 * Get the profile data delivered to customer
 */
Raven.prototype.getProfileDelivered = function() {
	//winston.info("calling delivered");
	writeFullCommand(this.serialPort, "<Name>get_profile_data</Name><NumberOfPeriods>0x2</NumberOfPeriods><EndTime>0x0</EndTime><IntervalChannel></IntervalChannel>");
	//writeCommand(this.serialPort, "get_instantaneous_demand");
};


/**
 * Get the profile data received from customer
 */
Raven.prototype.getProfileReceived = function() {
	writeFullCommand(this.serialPort, "<Name>get_profile_data</Name><NumberOfPeriods>0x2</NumberOfPeriods><EndTime>0x0</EndTime><IntervalChannel>Received </IntervalChannel>");
	//writeCommand(this.serialPort, "get_instantaneous_demand");
};



/**
 * Get the power used in current period
 */
Raven.prototype.getCurrentPeriodUsage = function() {
	writeCommand(this.serialPort, "get_current_period_usage");
};

/**
 * Get the power used in last period
 */
Raven.prototype.getLastPeriodUsage = function() {
	writeCommand(this.serialPort, "get_last_period_usage");
};

Raven.prototype.getMessage = function() {
	writeCommand(this.serialPort, "get_message");
};

Raven.prototype.getSchedule = function() {
	writeCommand(this.serialPort, "get_schedule");
};

Raven.prototype.getTime = function() {
	writeCommand(this.serialPort, "get_time");
};

Raven.prototype.getCurrentPrice = function() {
	writeCommand(this.serialPort, "get_current_price");
};

Raven.prototype.closeCurrentPeriod = function() {
	writeCommand(this.serialPort, "close_current_period");
};

Raven.prototype.close = function() {
	this.serialPort.close();
	
};


Raven.prototype.processMqttMsg = function(topic, payload){	
	if (topic == mqtt_topic){
		if (state.PORT_INITIALIZED){
			switch (payload.toString()) {			
				case "all": 
					winston.info('mqtt polling .. all, from:' + topic);
					pollAll();
					self.getSumPower();
					break;
				case "demand": 
					winston.info('mqtt polling .. demand, from:' + topic);
					pollDemand();
					self.getSumPower();
					break;		
				default:
					winston.info('Wrong command. Command \''+ payload + '\' not found');
			}
		} else {
			winston.info('Port not initialized. Command \''+ payload + '\' ignored');
		}
	}
}



function checkPort(){
	//winston.debug("Checking port, PortInitialized: "+state.PORT_INITIALIZED+" , Retries: "+state.retries);
	if (!state.PORT_INITIALIZED){
		if (++state.retries < 6) {	
			if (state.SUSPENDED){				 
				winston.info("Resuming Attempt [" + state.retries + "/5] to re-open port. " + formatTime((new Date).getTime() - state.SUSPENSION_START_TIME.getTime()) + " since 'No Connection'. Process will timeout in " + formatTime(state.TIMEOUT + state.SUSPENSION_START_TIME.getTime() - (new Date).getTime())) ;
			} 
			if (state.retries > 1) {
				winston.info("Port did not open. Attempt [" + state.retries + "/5] to re-open port");
			}
			if (self.serialPort.isOpen) {
				winston.debug("Port was open but not working ...closing it");
				self.serialPort.close();
				setTimeout(openPort, 30000);
			} else {
				openPort();
			}
		} else {
			winston.error("Connection to port could not be established after " + (state.retries-1) + " retries.\nSuspending polling. Please check Raven device is connected to correct port and functioning.\nWill attempt to reconnect again in " + formatTime(state.PORT_RESET_FREQUENCY*1000));
			state.retries = 0;
			suspend();
		}
	}
}


function requireUncached(module){
    delete require.cache[require.resolve(module)]
    return require(module)
}


function openPort(){
	try {
		winston.info("Opening port");
		if (!state.FIRST_RUN){
			//util = requireUncached("util");
			//events = requireUncached("events");
			//util.inherits(Raven, events.EventEmitter);
			//events.EventEmitter.call(self);	// inherit from EventEmitter
			//serialport = requireUncached("serialport");
		}
		portparser  = new serialport.parsers.Readline;
		self.serialPort = new serialport(state.serialPath, {
			baudRate: 115200,
			dataBits: 8,
			stopBits: 1,
			parity: 'none',
		});
		self.serialPort.pipe(portparser);
		self.serialPort.on("open", function() {	
			openHandler(self);
		});
	} catch (ex){
		winston.error("ERROR opening port\n" + ex);
	}
}


function setPortStatus(){
	state.PORT_INITIALIZED = true;
	state.retries = 0;
	winston.info("Port is open. Status - Open: " + self.serialPort.isOpen + ", Initialized: "+ state.PORT_INITIALIZED);
	if (state.SUSPENDED) wakeup();
}

function pollDemand(){	
	winston.silly("Thread Polling demand..."+state.POLL_DEMAND);
	if (state.PORT_INITIALIZED){
		if (state.POLL_DEMAND){
			state.failCount++;
		}
		if (state.failCount > 5){
			state.failCount = 0;
			winston.info("Failed Poll: resetting port");
			state.PORT_INITIALIZED = false;
		}
		state.POLL_DEMAND = true;
		winston.silly("In Polling demand..."+state.POLL_DEMAND);
		//self.getSumPower();
	}
}

function pollAll(){
	if (state.PORT_INITIALIZED){
		winston.silly("Polling other..."+state.POLL_ENERGY);
		state.POLL_ENERGY = true;
		state.POLL_USAGE_CURRENT = true;
		state.POLL_USAGE_LAST = true;
		//self.getSumEnergy();
	}
}

function fireMqtt(){
	if (!state.POLL_USAGE_LAST){
		self.emit("mqtt-msg", mqttMsg);
		winston.debug("Sending msg to mqtt ...");
		winston.debug(util.format('%j',mqttMsg));
		mqttMsg.clear();
	}
}

function writeCommand(serialPort, commandName) {
	var queryCommand = "<Name>" + commandName + "</Name>";
	writeFullCommand(serialPort, queryCommand);
}


function writeFullCommand(serialPort, commandName) {
	var queryCommand = "<Command>" + commandName + "</Command>\r\n";
	serialPort.write(queryCommand);
	serialPort.drain(function (error){
				if (error != null) {
					winston.error("Error writing command , " + commandName + " to port.");
					state.failCount++;
				}
			});
}


// handle serial port open
function openHandler (self) {
	var parser = new xml2js.Parser();
	var linenumber = 0;
	var buffer = "";	// read buffer.
	var parseBuffer=""; // for xml parsing
	var tmpBuffer = "";
	var line = "";      // line read;
	//var lines;
    
    winston.info('serial device opened at ...' + new Date());
    
    if (state.FIRST_RUN) {
		state.FIRST_RUN =  false;
		self.emit("open");
	}	
	
	// add serial port data handler	
	self.serialPort.on('data', function(evtdata) {
		state.PORT_INITIALIZED = true;
		winston.silly("Receiving data....");
		if (newDay()) rolloverDay();
		line = evtdata.toString();	
		buffer += line;		// append to the read buffer
		tmpBuffer="";
		parseBuffer="";
		var lines = S(buffer).lines();
		for (var i=0; i< lines.length; i++){
			tmpBuffer += lines[i];
			if (lines[i].endsWith('>')){
				tmpBuffer += '\r\n';
			}
			if ((lines[i].indexOf('</') == 0) && (lines[i].endsWith('>'))){
				parseBuffer=tmpBuffer;
				linenumber =0;
				tmpBuffer="";
			}
		}
		buffer = tmpBuffer;
	
		if ( parseBuffer != "") {		// check if last part of XML element.
			winston.silly('Raw Data:\n' + parseBuffer);
			
			// try to parse buffer
			try {
				parser.parseString(parseBuffer, function (err, result) {
					if (err) {
						winston.error("parser error: " + Object.keys(err)[0] +":" + Object.values(err)[0]);
						winston.debug("details: " + err + "\nRaw Buffer\n" + parseBuffer);
						
					}
					else if (result.InstantaneousDemand) {
						var timestamp = parseInt( result.InstantaneousDemand.TimeStamp );
						timestamp = new Date(dateOffset+timestamp*1000);
						var demand = parseInt( result.InstantaneousDemand.Demand, 16 );
						var multiplier = parseInt( result.InstantaneousDemand.Multiplier, 16 );
						if (multiplier == 0) { multiplier = 1;}
						var divisor = parseInt( result.InstantaneousDemand.Divisor, 16 );
						if (divisor == 0) { divisor = 1;}
						demand = demand < 0x80000000 ? demand : - ~demand - 1;
						demand = 1000*demand*multiplier / divisor;
						winston.info("demand: " + timestamp.toLocaleString() + " : " + demand);
						// emit power event
						var power = { value: demand, unit: "W", timestamp: timestamp.toISOString() };
						state.POLL_DEMAND = false;
						state.failCount=0;
						//winston.debug("DEMAND POLL FLAG demand:" + state.POLL_DEMAND + " , Sum:" + state.POLL_ENERGY + " , Current:"+ state.POLL_USAGE_CURRENT +" , Last" + state.POLL_USAGE_LAST );
						if (state.POLL_ENERGY) {
							data.powerTable.add(demand,timestamp);
							mqttMsg.add(power,"demand");
							self.getSumEnergy();
						} else {
							self.emit("demand", power);
						}
					}
					else if (result.CurrentSummationDelivered) {;
						var timestamp = parseInt( result.CurrentSummationDelivered.TimeStamp );
						timestamp = new Date(dateOffset+timestamp*1000);
						var used = parseInt( result.CurrentSummationDelivered.SummationDelivered, 16 );
						var fedin = parseInt( result.CurrentSummationDelivered.SummationReceived, 16 );
						var multiplier = parseInt( result.CurrentSummationDelivered.Multiplier, 16 );
						if (multiplier == 0) { multiplier = 1;}
						var divisor = parseInt( result.CurrentSummationDelivered.Divisor, 16 );
						if (divisor == 0) { divisor = 1;}
						used = used * multiplier / divisor;
						fedin = fedin * multiplier / divisor;
						data.energyInToday = used;
						data.energyIn.add(data.energyInToday,timestamp);
						if (data.energyInYday == 0 ) data.energyInYday = data.energyInToday;
						if (data.energyInThisMonth == 0 ) data.energyInThisMonth = data.energyInToday;
						data.energyOutToday = fedin;
						data.energyOut.add(data.energyOutToday,timestamp);
						if (data.energyOutYday == 0 ) data.energyOutYday = data.energyOutToday;
						if (data.energyOutThisMonth == 0 ) data.energyOutThisMonth = data.energyOutToday;
						used = (data.energyInToday - data.energyInYday);
						fedin = (data.energyOutToday - data.energyOutYday);
						winston.info("Today used: " + used.toFixed(2) + ", togrid:" + fedin.toFixed(2) + ", Month used:" + (data.energyInToday - data.energyInThisMonth).toFixed(2) +", togrid:" + (data.energyOutToday - data.energyOutThisMonth).toFixed(2) );					
						data.energyOutTMDays = Math.round((timestamp.getTime() - data.energyOutTMStartDate.getTime())/(1000*60*60*24)); 
						
						// publish summation on MQTT service
						var energyIn = { value: used, unit: "KWh" , thismonth: (data.energyInToday - data.energyInThisMonth),  lastmonth:data.energyInLastMonth, lifetime:data.energyInToday, timestamp: timestamp.toISOString() };
						var energyOut = { value: fedin, unit: "KWh", thismonth: (data.energyOutToday - data.energyOutThisMonth),  lastmonth:data.energyOutLastMonth, lifetime:data.energyOutToday , tmstartdate: data.energyOutTMStartDate.toISOString(), tmdays:data.energyOutTMDays , lmstartdate:data.energyOutLMStartDate.toISOString(), lmenddate:data.energyOutLMEndDate.toISOString(), lmdays: data.energyOutLMDays, timestamp: timestamp.toISOString() };

						//self.emit("energy-in", energyIn);
						//self.emit("energy-out", energyOut);
						state.POLL_ENERGY =  false
						mqttMsg.add(energyIn,"energyin");
						mqttMsg.add(energyOut,"energyout");
						self.getCurrentPeriodUsage();
					}
					else if  (result.CurrentPeriodUsage) {
						var timestamp = new Date();
						var startdate = parseInt( result.CurrentPeriodUsage.StartDate );
						startdate = new Date(dateOffset+startdate*1000);
						var days = Math.round((timestamp.getTime() - startdate.getTime())/(1000*60*60*24));
						var used = parseInt( result.CurrentPeriodUsage.CurrentUsage, 16 );
						var multiplier = parseInt( result.CurrentPeriodUsage.Multiplier, 16 );
						if (multiplier == 0) { multiplier = 1;}
						var divisor = parseInt( result.CurrentPeriodUsage.Divisor, 16 );
						if (divisor == 0) { divisor = 1;}
						//winston.info("after divisor, miltiplier - " + multiplier + ", divisor - " + divisor);
						used = used * multiplier / divisor;
						winston.info("Current Period Usage: " + timestamp.toLocaleString() + " : " + used.toFixed(2) + " - Days: " + days + " - Start Date " + startdate.toLocaleString());

						// publish summation on MQTT service
						var currentUsage = { value: used, unit: "KWh" , timestamp: timestamp.toISOString() , startdate: startdate.toISOString(), days: days };
						//self.emit("usage-current", currentUsage);
						state.POLL_USAGE_CURRENT = false;
						mqttMsg.add(currentUsage,"currentusage");
						self.getLastPeriodUsage();
					}
					else if (result.LastPeriodUsage) {
						var timestamp = new Date();
						var startdate = parseInt( result.LastPeriodUsage.StartDate );
						startdate = new Date(dateOffset+startdate*1000);
						var enddate = parseInt( result.LastPeriodUsage.EndDate );
						enddate = new Date(dateOffset+enddate*1000);
						var days = Math.round((enddate.getTime() - startdate.getTime())/(1000*60*60*24));
						var used = parseInt( result.LastPeriodUsage.LastUsage, 16 );
						var multiplier = parseInt( result.LastPeriodUsage.Multiplier, 16 );
						if (multiplier == 0) { multiplier = 1;}
						var divisor = parseInt( result.LastPeriodUsage.Divisor, 16 );
						if (divisor == 0) { divisor = 1;}
						used = used * multiplier / divisor;
						winston.info("Last Period Usage: " + timestamp.toLocaleString() + " : " + used.toFixed(2) + " - Days: " + days +" - Start Date " + startdate.toLocaleString() + " - End Date " + enddate.toLocaleString());
						// publish summation on MQTT service
						var lastUsage = { value: used , unit: "KWh" , timestamp: timestamp.toISOString() , startdate: startdate.toISOString(), enddate: enddate.toISOString(), days: days };

						//self.emit("usage-last", lastUsage);
						state.POLL_USAGE_LAST = false;
						mqttMsg.add(lastUsage,"lastusage");
						fireMqtt();
					}
					else if (result.ConnectionStatus) {
						winston.info("connection status: " + result.ConnectionStatus.Status);
						self.emit("connection", result.ConnectionStatus.Status);
					}
					else if ( (!result.InstantaneousDemand) && (!result.CurrentSummationDelivered) && (!result.CurrentPeriodUsage) && (!result.LastPeriodUsage)){
							winston.info("Other Command: " + Object.keys(result)[0] +":" + Object.values(result)[0]);
							winston.debug(util.format('%o',result));	// display data read in
					}
				});
			} catch (ex){
				winston.error("Uncaught exception liklely in XML2js parser\n" + ex);
				winston.debug("Details\n" + Object.keys(ex)[0] +":" + Object.values(ex)[0]);
			}
			parseBuffer = "";	// reset the read buffer
		}	
	});
	setTimeout(setPortStatus, 15000);
}

module.exports = {
	Raven,
	options,
	logger
}

