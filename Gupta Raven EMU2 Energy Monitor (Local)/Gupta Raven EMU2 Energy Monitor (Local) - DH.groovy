/**
 *	Gupta Raven EMU2 Energy Monitor (Local)
 *
 *	Copyright 2016-2017 Andreas Amann
 *
 *	Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *	in compliance with the License. You may obtain a copy of the License at:
 *
 *			http://www.apache.org/licenses/LICENSE-2.0
 *
 *	Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *	on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *	for the specific language governing permissions and limitations under the License.
 *
 */
 
 
import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import groovy.transform.Field

def version() {
	return "1.0.0 \n© 2018 Sandeep Gupta"
}

preferences {
	
	section ("Bridge Configuration") {
        input("ip", "string",
            title: "MQTT Bridge IP Address",
            description: "MQTT Bridge IP Address",
            required: true,
            displayDuringSetup: true
        )
        input("port", "string",
            title: "MQTT Bridge Port",
            description: "MQTT Bridge Port",
            required: true,
            displayDuringSetup: true
        )
        input("mac", "string",
            title: "MQTT Bridge MAC Address",
            description: "MQTT Bridge MAC Address",
            required: true,
            displayDuringSetup: true
        )
    }	
}

metadata {
	definition (name: "Gupta Raven EMU2 Energy Monitor (Local)", namespace: "gupta", author: "Sandeep Gupta") {
		capability "Power Meter"
		capability "Energy Meter"
		capability "Refresh"
		capability "Health Check"

		attribute "energy_str", "string"
		attribute "energy_yesterday", "string"
		attribute "energy_thismonth", "string"
		attribute "energy_lastmonth", "string"
		attribute "energy_life", "string"
		attribute "power_details", "string"
		attribute "togrid_str", "string"
		attribute "togrid_yesterday", "string"
		attribute "togrid_thismonth", "string"
		attribute "togrid_lastmonth", "string"
		attribute "togrid_life", "string"
		attribute "timestamp", "string"
		
		command "refreshPower"
	}

	simulator {
		// TODO: define status and reply messages here
	}

	tiles(scale: 2) {
		// this tile is used for display in device list (to get correct colorization)
		valueTile(
			"power",
			"device.power") {
				state("power",
					label: '${currentValue}W',
					unit: "W",
					icon: "https://raw.githubusercontent.com/ahndee/Envoy-ST/master/devicetypes/aamann/enlighten-envoy-local.src/Solar.png",
					backgroundColors: [
						[value: 0, color: "#E86D13"],
						[value: 1000, color: "#1e9cbb"],
						[value: 2000, color: "#bc2323"]
					])
		}
		// this tile is used only to provide an icon in the recent events list
		valueTile(
			"energy",
			"device.energy") {
				state("energy",
					label: 'ENERGY',
					backgroundColor:"#1e9cbb")
		}
		// the following tiles are used for display in the device handler
		multiAttributeTile(
			name:"SolarMulti",
			type:"generic",
			width:6,
			height:4) {
				tileAttribute("device.power", key: "PRIMARY_CONTROL") {
					attributeState("power", action: "refreshPower",
						label: '${currentValue}W',
						//icon: "https://raw.githubusercontent.com/ahndee/Envoy-ST/master/devicetypes/aamann/enlighten-envoy-local.src/Solar-2.png",
						unit: "W",
						backgroundColors: [
							[value: 0, color: "#E86D13"],
							[value: 1000, color: "#1e9cbb"],
							[value: 2000, color: "#bc2323"]
						])
			}
			tileAttribute("device.power_details", key: "SECONDARY_CONTROL") {
				attributeState("power_details", action: "refresh",
					label: '${currentValue}', icon:"st.secondary.refresh")
				
                attributeState("refresh", label: 'Updating data from server...')
			}
		}
		standardTile(
			"today",
			"today",
			width: 2,
			height: 2) {
				state("default",
					label: "Today")
		}
		valueTile(
			"energy_str",
			"device.energy_str",
			width: 2,
			height: 2,
			decoration: "flat",
			wordWrap: true) {
				state("energy_str",
					label: '${currentValue}')
		}
		valueTile(
			"togrid_str",
			"device.togrid_str",
			width: 2,
			height: 2,
			decoration: "flat",
			wordWrap: true) {
				state("togrid_str",
					label: '${currentValue}'/*,
					backgroundColors: [
						[value: 0, color: "#bc2323"],
						[value: 2, color: "#d04e00"],
						[value: 4, color: "#f1d801"],
						[value: 5, color: "#90d2a7"],
						[value: 6, color: "#44b621"]
					]*/)
		}
		standardTile(
			"yesterday",
			"yesterday",
			width: 2,
			height: 2) {
				state("default",
					label: "Yesterday")
		}
		valueTile(
			"energy_yesterday",
			"device.energy_yesterday",
			width: 2,
			height: 2,
			decoration: "flat",
			wordWrap: true) {
				state("energy_yesterday",
					label: '${currentValue}')
		}
		valueTile(
			"togrid_yesterday",
			"device.togrid_yesterday",
			width: 2,
			height: 2,
			decoration: "flat",
			wordWrap: true) {
				state("togrid_yesterday",
					label: '${currentValue}'/*,
					backgroundColors: [
						[value: 0, color: "#bc2323"],
						[value: 2, color: "#d04e00"],
						[value: 4, color: "#f1d801"],
						[value: 5, color: "#90d2a7"],
						[value: 6, color: "#44b621"]
					]*/)
		}
		standardTile(
			"thismonth",
			"thismonth",
			width: 2,
			height: 2,
			wordWrap: true) {
				state("default",
					label: "This Month")
		}
		valueTile(
			"energy_thismonth",
			"device.energy_thismonth",
			width: 2,
			height: 2,
			decoration: "flat",
			wordWrap: true) {
				state("energy_thismonth",
					label: '${currentValue}')
		}
		valueTile(
			"togrid_thismonth",
			"device.togrid_thismonth",
			width: 2,
			height: 2,
			decoration: "flat",
			wordWrap: true) {
				state("togrid_thismonth",
					label: '${currentValue}'/*,
					backgroundColors: [
						[value: 0, color: "#bc2323"],
						[value: 2, color: "#d04e00"],
						[value: 4, color: "#f1d801"],
						[value: 5, color: "#90d2a7"],
						[value: 6, color: "#44b621"]
					]*/)
		}
		standardTile(
			"lastmonth",
			"lastmonth",
			width: 2,
			height: 2,
			wordWrap: true) {
				state("default",
					label: "Last Month")
		}
		valueTile(
			"energy_lastmonth",
			"device.energy_lastmonth",
			width: 2,
			height: 2,
			decoration: "flat",
			wordWrap: true) {
				state("energy_lastmonth",
					label: '${currentValue}')
		}
		valueTile(
			"togrid_lastmonth",
			"device.togrid_lastmonth",
			width: 2,
			height: 2,
			decoration: "flat",
			wordWrap: true) {
				state("togrid_lastmonth",
					label: '${currentValue}'/*,
					backgroundColors: [
						[value: 0, color: "#bc2323"],
						[value: 2, color: "#d04e00"],
						[value: 4, color: "#f1d801"],
						[value: 5, color: "#90d2a7"],
						[value: 6, color: "#44b621"]
					]*/)
		}
		standardTile(
			"lifetime",
			"lifetime",
			width: 2,
			height: 1) {
				state("default",
					label: "Lifetime")
		}
		valueTile(
			"energy_life",
			"device.energy_life",
			width: 2,
			height: 1,
			decoration: "flat",
			wordWrap: true) {
				state("energy_life",
					label: '${currentValue}')
		}
		valueTile(
			"togrid_life",
			"device.togrid_life",
			width: 2,
			height: 1,
			decoration: "flat",
			wordWrap: true) {
				state("togrid_life",
					label: '${currentValue}'/*,
					backgroundColors: [
						[value: 0, color: "#bc2323"],
						[value: 2, color: "#d04e00"],
						[value: 4, color: "#f1d801"],
						[value: 5, color: "#90d2a7"],
						[value: 6, color: "#44b621"]
					]*/)
		}
		standardTile(
			"refresh",
			"device.refresh",
			inactiveLabel: false,
			decoration: "flat",
			width: 1,
			height: 1) {
				state("default",
					action:"refresh",
					icon:"st.secondary.refresh")
		}
		valueTile(
			"timestamp",
			"device.timestamp",
			width: 5,
			height: 1,
			decoration: "flat",
			wordWrap: true) {
				state("timestamp",
					label: '${currentValue}')
		}
		htmlTile(name:"graphHTML",
			action: "getGraphHTML",
			refreshInterval: 1,
			width: 6,
			height: 4,
			whitelist: ["www.gstatic.com"])

		main "power"
		details(["SolarMulti", "graphHTML", "today", "energy_str", "togrid_str", "yesterday", "energy_yesterday", "togrid_yesterday", "thismonth", "energy_thismonth", "togrid_thismonth", "lastmonth", "energy_lastmonth", "togrid_lastmonth", "lifetime", "energy_life", "togrid_life", "timestamp", "refresh"])
	}
}

mappings {
	path("/getGraphHTML") {action: [GET: "getGraphHTML"]}
}

// Code for MQTT message handling



// Store the MAC address as the device ID so that it can talk to SmartThings
def setNetworkAddress() {
    // Setting Network Device Id
    def hex = "$settings.mac".toUpperCase().replaceAll(':', '')
    if (device.deviceNetworkId != "$hex") {
        device.deviceNetworkId = "$hex"
        log.debug "Device Network Id set to ${device.deviceNetworkId}"
    }
}

// Send message to the Bridge
def deviceNotification(message) {
    if (device.hub == null)
    {
        log.error "Hub is null, must set the hub in the device settings so we can get local hub IP and port"
        return
    }
    
    //log.debug "Sending '${message}' to device"
    setNetworkAddress()

    def slurper = new JsonSlurper()
    def parsed = slurper.parseText(message)
    
    if (parsed.path == '/subscribe') {
        parsed.body.callback = device.hub.getDataValue("localIP") + ":" + device.hub.getDataValue("localSrvPortTCP")
    }

    def headers = [:]
    headers.put("HOST", "$ip:$port")
    headers.put("Content-Type", "application/json")
	try {
    def hubAction = new physicalgraph.device.HubAction(
        method: "POST",
        path: parsed.path,
        headers: headers,
        body: parsed.body
    )
    hubAction
	} catch (Exception e ){
		log.debug "error in hubaction"
		log.debug e
	}
	
}


def installed() {
    log.debug "Installed with settings: ${settings}"
    runEvery3Hours(updateSubscription)
    updateSubscription()
}

def updated() {
    log.debug "Updated with settings: ${settings}"
    updateSubscription()
}

// Update the bridge"s subscription
def updateSubscription() {
    def attributes = [
        demand: ["emu2"],
        //energyin: ["emu2"],
        //energyout: ["emu2"],
        //usagelast: ["emu2"],
        mqttmsg: ["emu2"],
        //usagecurrent: ["emu2"]
    ]
    def json = new groovy.json.JsonOutput().toJson([
        path: "/subscribe",
        body: [
            devices: attributes
        ]
    ])
    log.debug "Updating subscription: ${json}"
    deviceNotification(json)
}

// Send Event to Bridge
def publishToBridge (action) {
	def json = new JsonOutput().toJson([
		path: "/push",
		body: [
			name: "emu2",
			value: action,
			type: "msghandler"
		]
	])

	log.debug "Forwarding device event to bridge: ${json}"
	deviceNotification(json)
}

// Code for MQTT Ends here



def refresh() {
	publishToBridge('all')
}


def refreshPower(){
	publishToBridge('demand')
}

String getDataString(Integer seriesIndex) {
	def dataString = ""
	def dataTable = []
	switch (seriesIndex) {
		case 1:
			dataTable = state.energyTableYesterday
			break
		case 2:
			dataTable = state.powerTableYesterday
			break
		case 3:
			dataTable = state.energyTable
			break
		case 4:
			dataTable = state.powerTable
			break
	}
	dataTable.each() {
		def dataArray = [[it[0],it[1],0],null,null,null,null]
		dataArray[seriesIndex] = it[2]
		dataString += dataArray.toString() + ","
		//if (it[2] < 0) log.debug "Series ${seriesIndex} - value ${dataArray.toString()}"	
	}
	return dataString
}


private Map processInput(attribute, value){	
	def data = [:]
    //log.debug "${device}:${attribute} - ${value}"	
	value = (value) ? value.replaceAll(/\]\]/,'}').replaceAll(/\[\[/,'{').replaceAll(/\[/,'').replaceAll(/\]/,'').replace(/,{/,':{') : "";
	//log.debug "FormattedString - ${value}"
	def json = new groovy.json.JsonSlurper().parseText(value)
	def timestamp = (attribute == "mqttmsg") ?  json.demand.timestamp : json.timestamp	    
	data.timestamp = Date.parse("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timestamp)
	//log.debug "Timestamp is - ${data.timestamp.format("EEE MMM dd, yyyy 'at' hh:mm a", location.timeZone)}"
    //log.debug "${device}:${attribute} - ${value}, at ${data.timestamp}"
    switch (attribute) {
	
        case "demand":			
			data.processAll = false			
			assert json instanceof Map
			data.wattsNow = json.value
        break
        case "mqttmsg":			
			data.processAll = true;
			data.wattsNow = json.demand.value	
			data.wattHoursToday = 1000*Double.parseDouble(json.energyin.value.toString())	
			data.lifetimein = 1000*Double.parseDouble(json.energyin.lifetime.toString())
			data.wattHoursThisMonth = 1000*Double.parseDouble(json.currentusage.value.toString())
			data.thisMonthDays = json.currentusage.days
			data.thisMonthStartDate = Date.parse("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", json.currentusage.startdate)			
			data.wattHoursLastMonth = 1000*Double.parseDouble(json.lastusage.value.toString())
			data.lastMonthDays = json.lastusage.days
			data.lastMonthStartDate = Date.parse("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", json.lastusage.startdate)
			data.lastMonthEndDate = Date.parse("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", json.lastusage.enddate)
			data.wattHoursOutToday = 1000*Double.parseDouble(json.energyout.value.toString())	
			data.wattHoursOutThisMonth = 1000*Double.parseDouble(json.energyout.thismonth.toString())
			data.wattHoursOutLastMonth = 1000*Double.parseDouble(json.energyout.lastmonth.toString())
			data.lifetimeout = 1000*Double.parseDouble(json.energyout.lifetime.toString())
			data.togridTMStartDate = Date.parse("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", json.energyout.tmstartdate)
			data.togridLMStartDate = Date.parse("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", json.energyout.lmstartdate)
			data.togridLMEndDate = Date.parse("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", json.energyout.lmenddate)
			data.togridTMDays = json.energyout.tmdays
			data.togridLMDays = json.energyout.lmdays
        break
        case "msghandler":	
        break
    }
	return data
}


def parse(String description) {
	def display = false;
    setNetworkAddress()	
    def msg = parseLanMessage(description)
    //log.debug "Parsing '${msg.body}'"
	if (msg.data.status == 'OK') {
		log.debug "Bridge acknowledged receipt of mqtt msg"
		return null
	}
    def json = new JsonSlurper().parseText(new JsonOutput().toJson(msg.data))
	if (state.lastevent.equals(json.value)) {	
		log.debug "skipping duplicate event"
		return null
	} 
	state.lastevent = json.value
	def data  = processInput(json.type,json.value)
	log.debug "${device.displayName} - new data: ${data}"
	def currentPower = data.wattsNow
	def previousPower = state.lastPower != null ? state.lastPower : currentPower
	def powerChange = currentPower - previousPower
	state.lastPower = currentPower
	if (!state.peakpower || (state.peakpower <= currentPower)) {
		state.peakpower = currentPower
		state.peakpowerTime = data.timestamp.getTime()
	}
	def events = []
	if (data.processAll){		
		//log.debug "proccessing all"
		if (state.lastData && (data.wattHoursToday == state.lastData.wattHoursToday) && (data.wattsNow == state.lastData.wattsNow)) {
			log.debug "${device.displayName} - no new data"
			sendEvent(name: 'lastUpdate', value: new Date(), displayed: false) // dummy event for health check
			return null
		}
		state.lastData = data
		def energyToday = (data.wattHoursToday/1000)
		def energyOutToday = (data.wattHoursOutToday/1000)
		def energyThisMonth = (data.wattHoursThisMonth/1000)
		def energyThisMonthDays = data.thisMonthDays
		def togridThisMonthDays = data.togridTMDays
		def togridThisMonth = (data.wattHoursOutThisMonth/1000)
		def energyLastMonth = (data.wattHoursLastMonth/1000)
		def togridLastMonth = (data.wattHoursOutLastMonth/1000)
		def energyLastMonthDays = data.lastMonthDays	
		def togridLastMonthDays = data.togridLMDays
		def energyLife = data.lifetimein/1000000
		def togridLife = data.lifetimeout/1000000
		def todayDay = new Date().format("dd",location.timeZone)
		def powerTable = state.powerTable
		def energyTable = state.energyTable
		def energyOutTable = state.energyOutTable
		if (!state.today || state.today != todayDay) {
			state.peakpower = currentPower
			state.peakpowerTime = data.timestamp.getTime()
			state.today = todayDay
			log.debug "Now new day is ...${state.today}"
			state.powerTableYesterday = powerTable
			state.energyTableYesterday = energyTable
			state.energyOutTableYesterday = energyOutTable
			powerTable = powerTable ? [] : null
			energyTable = energyTable ? [] : null
			energyOutTable = energyOutTable ? [] : null
			state.lastPower = 0
			log.debug "Executed day rollover ..."
			sendEvent(name: 'energy_yesterday', value: device.currentState("energy_str")?.value, displayed: display)
			sendEvent(name: 'togrid_yesterday', value: device.currentState("togrid_str")?.value, displayed: display)
		}		
		//log.debug "Executed block 1 ..."
		events << createEvent(name: 'power_details', value:"Today's Peak: " + String.format("%,d", (long)state.peakpower) + "W at " +  new Date(state.peakpowerTime).format("hh:mm a", location.timeZone)+ "\nThis Month: " + String.format("%,d", (long)energyThisMonth) + "kWh in " + String.format("%d", (long)energyThisMonthDays) + " days", displayed: display)
		
		//log.debug "Executed block 2 ..."
		events << createEvent(name: 'energy_thismonth', value: String.format("%,#.1f", energyThisMonth) + "\nkWh[" + String.format("%02d", (long)energyThisMonthDays) + "d]", displayed: display)
		events << createEvent(name: 'togrid_thismonth', value: String.format("%,#.1f", togridThisMonth) + "\nkWh[" + String.format("%02d", (long)togridThisMonthDays) + "d]", displayed: display)
		events << createEvent(name: 'energy_lastmonth', value: String.format("%,#.1f", energyLastMonth) + "\nkWh[" + String.format("%02d", (long)energyLastMonthDays)  + "d]", displayed: display)
		events << createEvent(name: 'togrid_lastmonth', value: String.format("%,#.1f", togridLastMonth) + "\nkWh[" + String.format("%02d", (long)togridLastMonthDays)  + "d]", displayed: display)
		events << createEvent(name: 'energy_life', value: String.format("%,#.1f", energyLife) + "\nMWh", displayed: display)
		events << createEvent(name: 'togrid_life', value: String.format("%,#.1f", togridLife) + "\nMWh", displayed: display)
		events << createEvent(name: 'energy_str', value: String.format("%,#.1f", energyToday) + "\nkWh", displayed: display)
		events << createEvent(name: 'togrid_str', value: String.format("%,#.1f", energyOutToday) + "\nkWh", displayed: display)
		events << createEvent(name: 'timestamp', value: "Last Updated on " + data.timestamp.format("EEE MMM dd, yyyy 'at' hh:mm a", location.timeZone), displayed: display)
		events << createEvent(name: 'energy', value: energyToday, unit: "kWh", descriptionText: "From grid " + String.format("%,#.1f", energyToday) + "kWh\nTo Grid " + String.format("%,#.1f", energyOutToday) + "kWh")
		events << createEvent(name: 'power', value: (long)currentPower, unit: "W", descriptionText: "Power is " + String.format("%,d", (long)currentPower) + "W (" + String.format("%+,d", (long)powerChange) + "W since last reading)")
		
		//log.debug "Executed block 3 ..."
		// get power data for yesterday and today so we can create a graph
		if (state.powerTableYesterday == null || state.energyTableYesterday == null || powerTable == null || energyTable == null) {
			def startOfToday = timeToday("00:00", location.timeZone)
			def newValues
			if (state.powerTableYesterday == null || state.energyTableYesterday == null) {
				log.trace "Querying DB for yesterday's data…"
				def dataTable = []
				def powerData = device.statesBetween("power", startOfToday - 1, startOfToday, [max: 288]) // 24h in 5min intervals should be more than sufficient…
				// work around a bug where the platform would return less than the requested number of events (as of June 2016, only 50 events are returned)
				if (powerData.size()) {
					while ((newValues = device.statesBetween("power", startOfToday - 1, powerData.last().date, [max: 288])).size()) {
						powerData += newValues
					}
					powerData.reverse().each() {
						dataTable.add([it.date.format("H", location.timeZone),it.date.format("m", location.timeZone),it.integerValue])
					}
				}
				state.powerTableYesterday = dataTable
				dataTable = []
				def energyData = device.statesBetween("energy", startOfToday - 1, startOfToday, [max: 288])
				if (energyData.size()) {
					while ((newValues = device.statesBetween("energy", startOfToday - 1, energyData.last().date, [max: 288])).size()) {
						energyData += newValues
					}
					// we drop the first point after midnight (0 energy) in order to have the graph scale correctly
					energyData.reverse().drop(1).each() {
						dataTable.add([it.date.format("H", location.timeZone),it.date.format("m", location.timeZone),it.floatValue])
					}
				}
				state.energyTableYesterday = dataTable
			}
			if (powerTable == null || energyTable == null) {
				log.trace "Querying DB for today's data…"
				powerTable = []
				def powerData = device.statesSince("power", startOfToday, [max: 288])
				if (powerData.size()) {
					while ((newValues = device.statesBetween("power", startOfToday, powerData.last().date, [max: 288])).size()) {
						powerData += newValues
					}
					powerData.reverse().each() {
						powerTable.add([it.date.format("H", location.timeZone),it.date.format("m", location.timeZone),it.integerValue])
					}
				}
				energyTable = []
				def energyData = device.statesSince("energy", startOfToday, [max: 288])
				if (energyData.size()) {
					while ((newValues = device.statesBetween("energy", startOfToday, energyData.last().date, [max: 288])).size()) {
						energyData += newValues
					}
					energyData.reverse().drop(1).each() {
						energyTable.add([it.date.format("H", location.timeZone),it.date.format("m", location.timeZone),it.floatValue])
					}
				}
			}
		}
		//log.debug "Executed block 4 ..."
		// add latest power & energy readings for the graph
		if (currentPower > 0 || powerTable.size() != 0) {
			def newDate = new Date()
			powerTable.add([newDate.format("H", location.timeZone),newDate.format("m", location.timeZone),currentPower])
			energyTable.add([newDate.format("H", location.timeZone),newDate.format("m", location.timeZone),energyToday])
		}
		state.powerTable = powerTable
		state.energyTable = energyTable
		//log.debug "Executed block 5 ...${events.size()} events pending"
	} else {		
		//log.debug "proccessing demand"
		events << createEvent(name: 'power', value: (long)currentPower, unit: "W", descriptionText: "Power is " + String.format("%,d", (long)currentPower) + "W (" + String.format("%+,d", (long)powerChange) + "W since last reading)")
		events << createEvent(name: 'timestamp', value: "Last Updated on " + data.timestamp.format("EEE MMM dd, yyyy 'at' hh:mm a", location.timeZone), displayed: display)
	}
	
	log.debug "Finished parsing mqtt message from bridge"
	//log.debug "Firing ${events.size()} events"
	return events
}

def getStartTime() {
	def startTime = 24
	if (state.powerTable && state.powerTable.size()) {
		startTime = state.powerTable.min{it[0].toInteger()}[0].toInteger()
	}
	if (state.powerTableYesterday && state.powerTableYesterday.size()) {
		startTime = Math.min(startTime, state.powerTableYesterday.min{it[0].toInteger()}[0].toInteger())
	}
	return startTime
}

def getGraphHTML() {
	def html = """
		<!DOCTYPE html>
			<html>
				<head>
					<meta http-equiv="cache-control" content="max-age=0"/>
					<meta http-equiv="cache-control" content="no-cache"/>
					<meta http-equiv="expires" content="0"/>
					<meta http-equiv="expires" content="Tue, 01 Jan 1980 1:00:00 GMT"/>
					<meta http-equiv="pragma" content="no-cache"/>
					<meta name="viewport" content="width = device-width">
					<meta name="viewport" content="initial-scale = 1.0, user-scalable=yes">
					<style type="text/css">body,div {margin:0;padding:0}</style>
					<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
					<script type="text/javascript">
						google.charts.load('current', {packages: ['corechart']});
						google.charts.setOnLoadCallback(drawGraph);
						function drawGraph() {
							var data = new google.visualization.DataTable();
							data.addColumn('timeofday', 'time');
							data.addColumn('number', 'Energy (Yesterday)');
							data.addColumn('number', 'Power (Yesterday)');
							data.addColumn('number', 'Energy (Today)');
							data.addColumn('number', 'Power (Today)');
							data.addRows([
								${getDataString(1)}
								${getDataString(2)}
								${getDataString(3)}
								${getDataString(4)}
							]);
							var options = {
								fontName: 'San Francisco, Roboto, Arial',
								height: 240,
								hAxis: {
									format: 'H:mm',
									minValue: [${getStartTime()},0,0],
									slantedText: false
								},
								series: {
									0: {targetAxisIndex: 1, color: '#FFC2C2', lineWidth: 1},
									1: {targetAxisIndex: 0, color: '#D1DFFF', lineWidth: 1},
									2: {targetAxisIndex: 1, color: '#FF0000'},
									3: {targetAxisIndex: 0, color: '#004CFF'}
								},
								vAxes: {
									0: {
										title: 'Power (W)',
										format: 'decimal',
										textStyle: {color: '#004CFF'},
										titleTextStyle: {color: '#004CFF'}
									},
									1: {
										title: 'Energy (kWh)',
										format: 'decimal',
										textStyle: {color: '#FF0000'},
										titleTextStyle: {color: '#FF0000'},
										viewWindow: {min: 0}
									}
								},
								legend: {
									position: 'none'
								},
								chartArea: {
									width: '72%',
									height: '85%'
								}
							};
							var chart = new google.visualization.AreaChart(document.getElementById('chart_div'));
							chart.draw(data, options);
						}
					</script>
				</head>
				<body>
					<div id="chart_div"></div>
				</body>
			</html>
		"""
	render contentType: "text/html", data: html, status: 200
}