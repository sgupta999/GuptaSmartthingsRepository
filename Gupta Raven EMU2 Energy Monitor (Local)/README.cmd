This is my attempt to integrate the Smart Electric Meter being used by Oncor in the Texas Area.

Besides the smartmetertexas.com website which is pretty useless there did not seem to be many options to view real time data except going to the meter.

Since I have Solar panels and there is no net metering in Texas I wanted to get real time info to smartthings to turn AC/Heater on/off when excess energy was being produced. Also there are retail energy plans which provide incentive based on usage pattern so i wanted to track exact usage for e.g to use 1000 units a month or targets like that.

The only device  I found which would let me view this usage inside was EMU2 from rainforest. they also have a gateway but I couldn't find any integration with smartthings - there might be a way to integrate with PVwatts and then to smartthings but seemed convoluted.  a RAVEn RFA-Z106 dongle (http://www.rainforestautomation.com/raven).

After much research i found disparate tools to integrate together what I  really wanted. Here is what you will need.
1. https://github.com/stjohnjohnson/smartthings-mqtt-bridge - You need this bridge to transmit mqtt message to hub and back. This is our SERVER process using node.js - this you need to download from that repository and install 

2. I created node.js implementation that connects to ravenforest (raven.js) - gets the data and transmits it to the bridge (raven_mqtt.js) which relays it to smartthings. This I am calling the CLIENT (see the linux shell scripts to launch these). All configurable properties are in settings.json

3. Smartthings Device Handler (Gupta Raven EMU2 Energy Monitor (Local) - DH.groovy) - This is the groovy script - I made major changes to stjohnjohnson's device handler integrting bridge and smartapp into one and also added graphical capabilities from Andreas Amann to give me the view that you see in the screenshots.

I can basically see current usage, peak usage for day, usage for current billing period. Also a graph that shows usage and total consumption for today and overlays it on graph from yesterday (really nifty - thanks Amann). And the the summary table for consumption (1st column) and excess from solar to grid (2nd column) - for today, yesterday, this month, last month and lifetime.

This has been the most useful tool that I have had.
I am running all these on a 1st gen raspberry pi and i run into an issue where the serial port connection between EMU2 and the pi time out for a reason i have not been able to fathom. The script checks and restablishes connection but it is finicky - sometimes I have to reseat the USB connection and reboot the pi to have it working again. Mostly it works wihtout issues for months but having that persistent serial connection with EMU2 could be a pain. From what I remember don't think I noticed these problems on windows. 
