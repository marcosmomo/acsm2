# CPS4 Critical Nodes - Semantic Pass 2

- formalCpsId: `CPS-004`
- cpsName: `AGV_Logistico_Zeta`
- baseTopic: `cps4`

## Gerar estado da funcionalidade fazer expedição
```javascript
const cfg={
  "alias": "CPS4",
  "formalCpsId": "CPS-004",
  "cpsName": "AGV_Logistico_Zeta",
  "baseTopic": "cps4",
  "description": "AGV para logística interna com navegação SLAM, monitoramento de obstáculos e diagnóstico de motores em tempo real.",
  "features": [
    "navegacao",
    "pickup_delivery",
    "docking"
  ],
  "sensors": [
    "Bateria",
    "Velocidade",
    "Posicao_Mapa",
    "Distancia_Obstaculo",
    "Status_Motor_Tração"
  ],
  "learningTopic": "acsm2/cps4/learning",
  "oeeTopic": "cps4/oee",
  "acsmOeeTopic": "acsm2/cps4/oee",
  "federationOeeTopic": "acsm/cps4/oee",
  "federationLearningTopic": "acsm/cps4/learning",
  "datasheet": "/datasheetAGV_logico_zeta.pdf",
  "endpoints": {
    "DescriptionEndpoint": "http://localhost:3000/api/acsm2/cps4/description",
    "SummaryEndpoint": "http://localhost:3000/api/acsm2/cps4/summary",
    "IndicatorsEndpoint": "http://localhost:3000/api/acsm2/cps4/indicators",
    "HistoryEndpoint": "http://localhost:3000/api/acsm2/cps4/history",
    "HealthEndpoint": "http://localhost:3000/api/acsm2/cps4/health"
  }
},profile={
  "d": "agv",
  "ideal": 6000,
  "tempW": 55,
  "tempC": 68,
  "batW": 35,
  "batC": 20,
  "speedI": 0.15,
  "speedC": 1.2,
  "obsW": 1.2,
  "obsC": 0.45,
  "targetS": 1,
  "good": "stable_route_execution",
  "drift": "battery_or_congestion_drift",
  "crit": "fleet_mobility_risk",
  "why": {
    "availability": "battery_or_obstacle_stop",
    "performance": "route_speed_loss",
    "quality": "navigation_precision_loss"
  }
};const now=Date.now(),play=flow.get("playEnabled")===true;if(!play&&msg.payload!=="tick"&&msg.tick!==true)return null;const payload=msg.payload&&typeof msg.payload==="object"?msg.payload:{};const t=payload.telemetry||(flow.get("lastOperationalSnapshot")||{}).telemetry||{};const srs=payload.sensors||(flow.get("lastOperationalSnapshot")||{}).sensors||{};const tick=msg.payload==="tick"||msg.tick===true;const prev=flow.get("featureStates")||{},next={...prev},o1=[],o2=[],o4=[];const n=(k,f=0)=>{const x=Number(srs[k]);return Number.isFinite(x)?x:f};function emit(k,status,details){if(!cfg.features.includes(k))return;const topic=cfg.baseTopic+"/feat/"+k+"/$state";o1.push({topic,payload:{cpsId:cfg.formalCpsId,cpsName:cfg.cpsName,plant:cfg.baseTopic,feature:k,featureName:k,status,ts:now,details},retain:true,qos:1});if(status==="awaiting_replacement")o2.push({topic:cfg.baseTopic+"/feat/"+k+"/awaiting_replacement",payload:{cpsId:cfg.formalCpsId,cpsName:cfg.cpsName,feature:k,status,ts:now,details},qos:1,retain:false});next[k]={status,lastSeen:tick?(prev[k]?.lastSeen||now):now,lastDetails:details};o4.push({_log:{cpsId:cfg.formalCpsId,cpsName:cfg.cpsName,baseTopic:cfg.baseTopic,level:status==="awaiting_replacement"?"WARN":"INFO",eventType:tick?"FEATURE_STATE_TICK_EVALUATED":"FEATURE_STATE_DOMAIN_EVALUATED",sourceNode:"Gerar estado da funcionalidade fazer expedição",topic,payload:{feature:k,status,details}}});}
if(profile.d==="cnc"){const rpm=Number(t.currentRPM??n("Velocidade_Spindle",0)),temp=Number(t.currentTemperature??n("Temperatura_Spindle",0)),vib=n("Vibracao_Estrutura",0),x=n("Posicao_Eixo_X",0),y=n("Posicao_Eixo_Y",0),mov=Math.abs(x)+Math.abs(y)>0.2,axis=Number((Math.abs(x)+Math.abs(y)).toFixed(3));emit("desbaste",rpm>=profile.rpmR&&mov&&vib<profile.vibC?"active":temp>=profile.tempC||vib>=profile.vibC?"awaiting_replacement":"maintenance",{rpm,temp,vibration:vib,axisMotion:axis,rule:"roughing_load"});emit("acabamento",rpm>=profile.rpmF&&rpm<profile.rpmR&&mov&&vib<profile.vibW?"active":temp>=profile.tempC||vib>=profile.vibC?"awaiting_replacement":"maintenance",{rpm,temp,vibration:vib,axisMotion:axis,rule:"finishing_precision"});emit("probin",rpm<=profile.rpmI&&vib<profile.vibW&&!mov?"active":temp>=profile.tempC?"awaiting_replacement":"maintenance",{rpm,temp,vibration:vib,axisMotion:axis,rule:"probing_stability"});}
else if(profile.d==="agv"){const bat=n("Bateria",100),speed=Number(t.linearSpeed??n("Velocidade",0)),obs=n("Distancia_Obstaculo",9),tr=String(srs["Status_Motor_Tração"]??t.tractionStatus??"ok").toLowerCase(),pos=String(srs["Posicao_Mapa"]??t.positionLabel??"route").toLowerCase();emit("navegacao",speed>=profile.speedI&&obs>profile.obsC&&bat>profile.batC&&tr!=="fault"?"active":bat<=profile.batC||obs<=profile.obsC||tr==="fault"?"awaiting_replacement":"maintenance",{battery:bat,speed,obstacleDistance:obs,traction:tr,mapPos:pos,rule:"route_motion"});emit("pickup_delivery",/(pickup|delivery|station|dock|load|unload)/.test(pos)&&speed<=profile.speedC&&obs>profile.obsC?"active":bat<=profile.batC?"awaiting_replacement":"maintenance",{battery:bat,speed,obstacleDistance:obs,traction:tr,mapPos:pos,rule:"station_service"});emit("docking",/dock|charge|charging/.test(pos)||(bat<=profile.batW&&speed<profile.speedI)?(obs>profile.obsC?"active":"maintenance"):tr==="fault"?"awaiting_replacement":"maintenance",{battery:bat,speed,obstacleDistance:obs,traction:tr,mapPos:pos,rule:"dock_alignment"});}
else {const z1=n("Zone1_Occupied",0),z2=n("Zone2_Occupied",0),z3=n("Zone3_Occupied",0),mc=Number(t.motorCurrent??n("MotorCurrent",0)),mt=Number(t.currentTemperature??n("MotorTemperature",0)),jam=mc>=profile.currC||mt>=profile.tempC;emit("zone1_release",z1===1&&z2===0&&!jam?"active":jam?"awaiting_replacement":"maintenance",{zone1:z1,zone2:z2,zone3:z3,motorCurrent:mc,motorTemp:mt,rule:"release_downstream_gap"});emit("zone2_release",z2===1&&z3===0&&!jam?"active":jam?"awaiting_replacement":"maintenance",{zone1:z1,zone2:z2,zone3:z3,motorCurrent:mc,motorTemp:mt,rule:"release_downstream_gap"});emit("zone3_release",z3===1&&!jam?"active":jam?"awaiting_replacement":"maintenance",{zone1:z1,zone2:z2,zone3:z3,motorCurrent:mc,motorTemp:mt,rule:"dispatch_terminal_zone"});emit("detectar_zone1",z1===1?"active":jam?"awaiting_replacement":"maintenance",{zone1:z1,motorCurrent:mc,motorTemp:mt,rule:"occupancy_detection"});emit("detectar_zone2",z2===1?"active":jam?"awaiting_replacement":"maintenance",{zone2:z2,motorCurrent:mc,motorTemp:mt,rule:"occupancy_detection"});emit("detectar_zone3",z3===1?"active":jam?"awaiting_replacement":"maintenance",{zone3:z3,motorCurrent:mc,motorTemp:mt,rule:"occupancy_detection"});}
if(tick)for(const k of Object.keys(next)){const el=now-(next[k].lastSeen||now);if(el>=10000)next[k].status="awaiting_replacement";else if(el>=3000&&next[k].status==="active")next[k].status="maintenance";}flow.set("featureStates",next);return[o1,o2,{topic:cfg.baseTopic+"/sensordata",payload:{...srs,featureStates:Object.fromEntries(Object.entries(next).map(([k,v])=>[k,v.status]))},qos:1,retain:false},o4];
```

## Gerar telemetria operacional CPS7
```javascript
const cfg={
  "alias": "CPS4",
  "formalCpsId": "CPS-004",
  "cpsName": "AGV_Logistico_Zeta",
  "baseTopic": "cps4",
  "description": "AGV para logística interna com navegação SLAM, monitoramento de obstáculos e diagnóstico de motores em tempo real.",
  "features": [
    "navegacao",
    "pickup_delivery",
    "docking"
  ],
  "sensors": [
    "Bateria",
    "Velocidade",
    "Posicao_Mapa",
    "Distancia_Obstaculo",
    "Status_Motor_Tração"
  ],
  "learningTopic": "acsm2/cps4/learning",
  "oeeTopic": "cps4/oee",
  "acsmOeeTopic": "acsm2/cps4/oee",
  "federationOeeTopic": "acsm/cps4/oee",
  "federationLearningTopic": "acsm/cps4/learning",
  "datasheet": "/datasheetAGV_logico_zeta.pdf",
  "endpoints": {
    "DescriptionEndpoint": "http://localhost:3000/api/acsm2/cps4/description",
    "SummaryEndpoint": "http://localhost:3000/api/acsm2/cps4/summary",
    "IndicatorsEndpoint": "http://localhost:3000/api/acsm2/cps4/indicators",
    "HistoryEndpoint": "http://localhost:3000/api/acsm2/cps4/history",
    "HealthEndpoint": "http://localhost:3000/api/acsm2/cps4/health"
  }
},profile={
  "d": "agv",
  "ideal": 6000,
  "tempW": 55,
  "tempC": 68,
  "batW": 35,
  "batC": 20,
  "speedI": 0.15,
  "speedC": 1.2,
  "obsW": 1.2,
  "obsC": 0.45,
  "targetS": 1,
  "good": "stable_route_execution",
  "drift": "battery_or_congestion_drift",
  "crit": "fleet_mobility_risk",
  "why": {
    "availability": "battery_or_obstacle_stop",
    "performance": "route_speed_loss",
    "quality": "navigation_precision_loss"
  }
};const payload=msg.payload&&typeof msg.payload==="object"?msg.payload:{};const srs=payload.sensors||{},fs=payload.featureStates||flow.get("featureStates")||{},prev=flow.get("lastOperationalSnapshot")||{telemetry:{}};const n=(k,f=0)=>{const x=Number(srs[k]);return Number.isFinite(x)?x:f};let t;if(profile.d==="cnc"){const spindle=n("Velocidade_Spindle",prev.telemetry.currentRPM||0),temp=n("Temperatura_Spindle",prev.telemetry.currentTemperature||28),vib=n("Vibracao_Estrutura",0),x=n("Posicao_Eixo_X",0),y=n("Posicao_Eixo_Y",0),axis=Math.abs(x)+Math.abs(y),act=Object.entries(fs).find(([,v])=>v?.status==="active")?.[0]||null,torque=Number((spindle/120+vib*4+axis*6).toFixed(2)),prod=act==="acabamento"?1:act==="desbaste"?0.4:0.1,rej=temp>profile.tempW||vib>profile.vibW?(act==="acabamento"?1:0):0;t={domainMode:act||"idle",currentTemperature:temp,currentRPM:spindle,currentTorque:torque,pieceCounter:(prev.telemetry.pieceCounter||0)+prod,cycleTimeMs:act==="desbaste"?profile.ideal*1.25:act==="acabamento"?profile.ideal*0.95:profile.ideal*0.7,operationMode:cfg.baseTopic,spindleSpeed:spindle,spindleLoad:Number((torque/profile.targetT).toFixed(4)),axisMotion:Number(axis.toFixed(4)),thermalLoad:Number((temp/profile.tempC).toFixed(4)),vibrationLevel:vib,producedDelta:prod,goodDelta:Math.max(0,prod-rej),rejectDelta:rej,qualityScore:Number(Math.max(0,1-Math.max(0,vib-profile.vibW)/profile.vibC).toFixed(4))};}
else if(profile.d==="agv"){const bat=n("Bateria",100),speed=n("Velocidade",0),obs=n("Distancia_Obstaculo",9),pos=String(srs["Posicao_Mapa"]??prev.telemetry.positionLabel??"route"),tr=String(srs["Status_Motor_Tração"]??prev.telemetry.tractionStatus??"ok"),task=obs<=profile.obsC?"safety_stop":/dock|charge/i.test(pos)?"docking":/pickup|delivery|station|load|unload/i.test(pos)?"pickup_delivery":"navegacao",rpm=Number((speed*360).toFixed(0)),torque=Number((Math.max(0.2,1.4-bat/100)*22+(obs<profile.obsW?8:0)).toFixed(2)),done=task==="pickup_delivery"&&speed<profile.speedI?1:0,rej=obs<=profile.obsC||/fault/i.test(tr)?1:0;t={domainMode:task,currentTemperature:Number((28+(100-bat)*0.18+(speed>profile.speedC?4:0)).toFixed(2)),currentRPM:rpm,currentTorque:torque,pieceCounter:(prev.telemetry.pieceCounter||0)+done,cycleTimeMs:task==="docking"?profile.ideal*1.2:task==="pickup_delivery"?profile.ideal:profile.ideal*0.85,operationMode:cfg.baseTopic,batteryLevel:bat,linearSpeed:speed,obstacleDistance:obs,positionLabel:pos,tractionStatus:tr,routeEfficiency:Number(Math.max(0,Math.min(1,speed/profile.targetS)).toFixed(4)),producedDelta:done,goodDelta:Math.max(0,done-rej),rejectDelta:rej,qualityScore:Number(Math.max(0,Math.min(1,obs/(profile.obsW*2))).toFixed(4))};}
else {const z1=n("Zone1_Occupied",0),z2=n("Zone2_Occupied",0),z3=n("Zone3_Occupied",0),mc=n("MotorCurrent",prev.telemetry.motorCurrent||0),mt=n("MotorTemperature",prev.telemetry.currentTemperature||28),rel=["zone1_release","zone2_release","zone3_release"].filter(k=>fs[k]?.status==="active").length,jam=mc>profile.currW||mt>profile.tempW?1:0;t={domainMode:rel?"releasing":(z1||z2||z3?"buffering":"idle"),currentTemperature:mt,currentRPM:Number((mc*55).toFixed(0)),currentTorque:Number((mc*2.1).toFixed(2)),pieceCounter:(prev.telemetry.pieceCounter||0)+rel,cycleTimeMs:rel?profile.ideal/Math.max(1,rel):profile.ideal*1.5,operationMode:cfg.baseTopic,motorCurrent:mc,zoneOccupancy:{zone1:z1,zone2:z2,zone3:z3},occupancySum:z1+z2+z3,releaseRate:rel,jamRisk:jam,producedDelta:rel,goodDelta:Math.max(0,rel-jam),rejectDelta:jam,qualityScore:Number(Math.max(0,1-jam*0.5).toFixed(4))};}
const snap={ts:Date.now(),sensors:srs,featureStates:fs,telemetry:t};flow.set("lastOperationalSnapshot",snap);msg.topic=cfg.baseTopic+"/data";msg.payload=t;return msg;
```

## calcular OEE CPS
```javascript
const cfg={
  "alias": "CPS4",
  "formalCpsId": "CPS-004",
  "cpsName": "AGV_Logistico_Zeta",
  "baseTopic": "cps4",
  "description": "AGV para logística interna com navegação SLAM, monitoramento de obstáculos e diagnóstico de motores em tempo real.",
  "features": [
    "navegacao",
    "pickup_delivery",
    "docking"
  ],
  "sensors": [
    "Bateria",
    "Velocidade",
    "Posicao_Mapa",
    "Distancia_Obstaculo",
    "Status_Motor_Tração"
  ],
  "learningTopic": "acsm2/cps4/learning",
  "oeeTopic": "cps4/oee",
  "acsmOeeTopic": "acsm2/cps4/oee",
  "federationOeeTopic": "acsm/cps4/oee",
  "federationLearningTopic": "acsm/cps4/learning",
  "datasheet": "/datasheetAGV_logico_zeta.pdf",
  "endpoints": {
    "DescriptionEndpoint": "http://localhost:3000/api/acsm2/cps4/description",
    "SummaryEndpoint": "http://localhost:3000/api/acsm2/cps4/summary",
    "IndicatorsEndpoint": "http://localhost:3000/api/acsm2/cps4/indicators",
    "HistoryEndpoint": "http://localhost:3000/api/acsm2/cps4/history",
    "HealthEndpoint": "http://localhost:3000/api/acsm2/cps4/health"
  }
},profile={
  "d": "agv",
  "ideal": 6000,
  "tempW": 55,
  "tempC": 68,
  "batW": 35,
  "batC": 20,
  "speedI": 0.15,
  "speedC": 1.2,
  "obsW": 1.2,
  "obsC": 0.45,
  "targetS": 1,
  "good": "stable_route_execution",
  "drift": "battery_or_congestion_drift",
  "crit": "fleet_mobility_risk",
  "why": {
    "availability": "battery_or_obstacle_stop",
    "performance": "route_speed_loss",
    "quality": "navigation_precision_loss"
  }
};const snap=flow.get("lastOperationalSnapshot")||{telemetry:{}},t=snap.telemetry||{},health=flow.get("lastHealth")||{},states=flow.get("featureStates")||{};let availability=0,performance=0,quality=0;if(profile.d==="cnc"){const active=["desbaste","acabamento","probin"].filter(k=>states[k]?.status==="active").length;availability=Math.max(0,Math.min(1,active/3-(health.healthLabel==="critical"?0.35:0)));performance=Math.max(0,Math.min(1,(Number(t.currentRPM||0)/profile.targetR)*(profile.ideal/Math.max(profile.ideal,Number(t.cycleTimeMs||profile.ideal)))));quality=Math.max(0,Math.min(1,Number(t.qualityScore??1)*(Number(t.currentTemperature||0)<profile.tempW?1:0.88)));}else if(profile.d==="agv"){availability=Math.max(0,Math.min(1,(Number(t.batteryLevel??100)/100)*(Number(t.obstacleDistance??9)<=profile.obsC?0.4:1)));performance=Math.max(0,Math.min(1,(Number(t.linearSpeed||0)/profile.targetS)*(profile.ideal/Math.max(profile.ideal,Number(t.cycleTimeMs||profile.ideal)))));quality=Math.max(0,Math.min(1,Number(t.qualityScore??1)*(/fault/i.test(String(t.tractionStatus||''))?0.5:1)));}else{availability=Math.max(0,Math.min(1,1-Number(t.jamRisk||0)*0.45-(health.healthLabel==='critical'?0.2:0)));performance=Math.max(0,Math.min(1,(Number(t.releaseRate||0)/profile.targetRel)*(profile.ideal/Math.max(profile.ideal,Number(t.cycleTimeMs||profile.ideal)))));quality=Math.max(0,Math.min(1,Number(t.qualityScore??1)*((Number(t.occupancySum||0)>=3)?0.85:1)));}const oee=Number((availability*performance*quality).toFixed(4));msg.topic=cfg.oeeTopic;msg.payload={cpsId:cfg.formalCpsId,cpsName:cfg.cpsName,availability:Number(availability.toFixed(4)),performance:Number(performance.toFixed(4)),quality:Number(quality.toFixed(4)),oee,totals:{producedDelta:Number(t.producedDelta||0),goodDelta:Number(t.goodDelta||0),rejectDelta:Number(t.rejectDelta||0)},sourceStatus:health.healthLabel||null,ts:Date.now()};flow.set("lastOee",msg.payload);return msg;
```

## Local Times-Series Features
```javascript
const cfg={
  "alias": "CPS4",
  "formalCpsId": "CPS-004",
  "cpsName": "AGV_Logistico_Zeta",
  "baseTopic": "cps4",
  "description": "AGV para logística interna com navegação SLAM, monitoramento de obstáculos e diagnóstico de motores em tempo real.",
  "features": [
    "navegacao",
    "pickup_delivery",
    "docking"
  ],
  "sensors": [
    "Bateria",
    "Velocidade",
    "Posicao_Mapa",
    "Distancia_Obstaculo",
    "Status_Motor_Tração"
  ],
  "learningTopic": "acsm2/cps4/learning",
  "oeeTopic": "cps4/oee",
  "acsmOeeTopic": "acsm2/cps4/oee",
  "federationOeeTopic": "acsm/cps4/oee",
  "federationLearningTopic": "acsm/cps4/learning",
  "datasheet": "/datasheetAGV_logico_zeta.pdf",
  "endpoints": {
    "DescriptionEndpoint": "http://localhost:3000/api/acsm2/cps4/description",
    "SummaryEndpoint": "http://localhost:3000/api/acsm2/cps4/summary",
    "IndicatorsEndpoint": "http://localhost:3000/api/acsm2/cps4/indicators",
    "HistoryEndpoint": "http://localhost:3000/api/acsm2/cps4/history",
    "HealthEndpoint": "http://localhost:3000/api/acsm2/cps4/health"
  }
},profile={
  "d": "agv",
  "ideal": 6000,
  "tempW": 55,
  "tempC": 68,
  "batW": 35,
  "batC": 20,
  "speedI": 0.15,
  "speedC": 1.2,
  "obsW": 1.2,
  "obsC": 0.45,
  "targetS": 1,
  "good": "stable_route_execution",
  "drift": "battery_or_congestion_drift",
  "crit": "fleet_mobility_risk",
  "why": {
    "availability": "battery_or_obstacle_stop",
    "performance": "route_speed_loss",
    "quality": "navigation_precision_loss"
  }
};const snap=flow.get("lastOperationalSnapshot")||{telemetry:{}},oee=flow.get("lastOee")||{};let h=flow.get("timeseriesHistory")||[];const e={ts:Date.now(),currentTemperature:Number(snap.telemetry.currentTemperature||0),currentRPM:Number(snap.telemetry.currentRPM||0),currentTorque:Number(snap.telemetry.currentTorque||0),cycleTimeMs:Number(snap.telemetry.cycleTimeMs||profile.ideal),availability:Number(oee.availability||0),performance:Number(oee.performance||0),quality:Number(oee.quality||0),oee:Number(oee.oee||0),domainMode:snap.telemetry.domainMode||'idle'};if(profile.d==='cnc'){e.spindleLoad=Number(snap.telemetry.spindleLoad||0);e.thermalLoad=Number(snap.telemetry.thermalLoad||0);e.vibrationLevel=Number(snap.telemetry.vibrationLevel||0);}if(profile.d==='agv'){e.batteryLevel=Number(snap.telemetry.batteryLevel||0);e.linearSpeed=Number(snap.telemetry.linearSpeed||0);e.obstacleDistance=Number(snap.telemetry.obstacleDistance||0);}if(profile.d==='buffer'){e.motorCurrent=Number(snap.telemetry.motorCurrent||0);e.occupancySum=Number(snap.telemetry.occupancySum||0);e.releaseRate=Number(snap.telemetry.releaseRate||0);}h.push(e);if(h.length>500)h=h.slice(-500);flow.set("timeseriesHistory",h);function stats(v){const n=v.filter(x=>Number.isFinite(x));if(!n.length)return{mean:null,median:null,min:null,max:null,std:null};const s=[...n].sort((a,b)=>a-b),m=n.reduce((a,b)=>a+b,0)/n.length,med=s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2,varc=n.reduce((a,x)=>a+Math.pow(x-m,2),0)/n.length;return{mean:Number(m.toFixed(4)),median:Number(med.toFixed(4)),min:Number(Math.min(...n).toFixed(4)),max:Number(Math.max(...n).toFixed(4)),std:Number(Math.sqrt(varc).toFixed(4))};}const payload={historySize:h.length,window:'last_'+h.length+'_points',temperature:stats(h.map(x=>x.currentTemperature)),rpm:stats(h.map(x=>x.currentRPM)),torque:stats(h.map(x=>x.currentTorque)),cycleTimeMs:stats(h.map(x=>x.cycleTimeMs)),availability:stats(h.map(x=>x.availability)),performance:stats(h.map(x=>x.performance)),quality:stats(h.map(x=>x.quality)),oee:stats(h.map(x=>x.oee)),domain:profile.d,modeCounts:h.slice(-50).reduce((a,i)=>{a[i.domainMode]=(a[i.domainMode]||0)+1;return a;},{}),quickSignals:profile.d==='cnc'?{spindleLoad:stats(h.map(x=>x.spindleLoad)),thermalLoad:stats(h.map(x=>x.thermalLoad)),vibrationLevel:stats(h.map(x=>x.vibrationLevel))}:profile.d==='agv'?{batteryLevel:stats(h.map(x=>x.batteryLevel)),linearSpeed:stats(h.map(x=>x.linearSpeed)),obstacleDistance:stats(h.map(x=>x.obstacleDistance))}:{motorCurrent:stats(h.map(x=>x.motorCurrent)),occupancySum:stats(h.map(x=>x.occupancySum)),releaseRate:stats(h.map(x=>x.releaseRate))}};flow.set("lastTimeSeriesFeatures",payload);msg.payload=payload;return msg;
```

## Local Learning CPS7
```javascript
const cfg={
  "alias": "CPS4",
  "formalCpsId": "CPS-004",
  "cpsName": "AGV_Logistico_Zeta",
  "baseTopic": "cps4",
  "description": "AGV para logística interna com navegação SLAM, monitoramento de obstáculos e diagnóstico de motores em tempo real.",
  "features": [
    "navegacao",
    "pickup_delivery",
    "docking"
  ],
  "sensors": [
    "Bateria",
    "Velocidade",
    "Posicao_Mapa",
    "Distancia_Obstaculo",
    "Status_Motor_Tração"
  ],
  "learningTopic": "acsm2/cps4/learning",
  "oeeTopic": "cps4/oee",
  "acsmOeeTopic": "acsm2/cps4/oee",
  "federationOeeTopic": "acsm/cps4/oee",
  "federationLearningTopic": "acsm/cps4/learning",
  "datasheet": "/datasheetAGV_logico_zeta.pdf",
  "endpoints": {
    "DescriptionEndpoint": "http://localhost:3000/api/acsm2/cps4/description",
    "SummaryEndpoint": "http://localhost:3000/api/acsm2/cps4/summary",
    "IndicatorsEndpoint": "http://localhost:3000/api/acsm2/cps4/indicators",
    "HistoryEndpoint": "http://localhost:3000/api/acsm2/cps4/history",
    "HealthEndpoint": "http://localhost:3000/api/acsm2/cps4/health"
  }
},profile={
  "d": "agv",
  "ideal": 6000,
  "tempW": 55,
  "tempC": 68,
  "batW": 35,
  "batC": 20,
  "speedI": 0.15,
  "speedC": 1.2,
  "obsW": 1.2,
  "obsC": 0.45,
  "targetS": 1,
  "good": "stable_route_execution",
  "drift": "battery_or_congestion_drift",
  "crit": "fleet_mobility_risk",
  "why": {
    "availability": "battery_or_obstacle_stop",
    "performance": "route_speed_loss",
    "quality": "navigation_precision_loss"
  }
};const tsf=flow.get("lastTimeSeriesFeatures")||{},oee=flow.get("lastOee")||{},health=flow.get("lastHealth")||{};let state='stable',pattern=profile.good,recommendation='Maintain current operating configuration.',evidence=[];if(profile.d==='cnc'){const thermal=Number(tsf.quickSignals?.thermalLoad?.mean??0),vib=Number(tsf.quickSignals?.vibrationLevel?.mean??0),sp=Number(tsf.quickSignals?.spindleLoad?.mean??0);if(thermal>0.9||vib>profile.vibW){state='attention';pattern=profile.drift;recommendation='Inspect spindle cooling, compensation and vibration sources.';}if(health.healthLabel==='critical'){state='critical';pattern=profile.crit;recommendation='Stop machining and inspect spindle/fixture condition before next cycle.';}evidence=['thermalLoad='+thermal.toFixed(4),'vibration='+vib.toFixed(4),'spindleLoad='+sp.toFixed(4)];}
else if(profile.d==='agv'){const bat=Number(tsf.quickSignals?.batteryLevel?.mean??100),speed=Number(tsf.quickSignals?.linearSpeed?.mean??0),obs=Number(tsf.quickSignals?.obstacleDistance?.mean??9);if(bat<profile.batW||obs<profile.obsW){state='attention';pattern=profile.drift;recommendation='Review charging schedule, routing and obstacle avoidance zones.';}if(health.healthLabel==='critical'){state='critical';pattern=profile.crit;recommendation='Hold AGV mission and inspect traction or navigation blockers.';}evidence=['battery='+bat.toFixed(2),'speed='+speed.toFixed(3),'obstacle='+obs.toFixed(3)];}
else{const cur=Number(tsf.quickSignals?.motorCurrent?.mean??0),occ=Number(tsf.quickSignals?.occupancySum?.mean??0),rate=Number(tsf.quickSignals?.releaseRate?.mean??0);if(occ>=2||cur>profile.currW){state='attention';pattern=profile.drift;recommendation='Inspect congestion between zones and motor load before it turns into a jam.';}if(health.healthLabel==='critical'){state='critical';pattern=profile.crit;recommendation='Stop release sequence and inspect zones for blockage or overload.';}evidence=['motorCurrent='+cur.toFixed(3),'occupancy='+occ.toFixed(3),'releaseRate='+rate.toFixed(3)];}
const curOee=Number(oee.oee||0),meanOee=Number(tsf.oee?.mean??curOee),drift=meanOee===0?0:Number(Math.min(1,Math.abs(curOee-meanOee)/Math.max(meanOee,0.0001)).toFixed(4)),anomaly=Number(Math.min(1,health.healthLabel==='critical'?0.95:health.healthLabel==='attention'?0.55:drift).toFixed(4));msg.payload={model:'domain-heuristic',type:profile.d+'-local-learning',state,pattern,learned:pattern,confidence:Number((1-Math.min(0.9,drift*0.6+anomaly*0.4)).toFixed(4)),driftScore:drift,anomalyScore:anomaly,forecastOEE:[Number(Math.max(0,Math.min(1,curOee-drift*0.08)).toFixed(4))],recommendation,evidence,basis:{timeSeriesFeatures:tsf,health,domain:profile.d}};flow.set("lastLearning",msg.payload);return msg;
```

## Local Reasoning CPS7
```javascript
const cfg={
  "alias": "CPS4",
  "formalCpsId": "CPS-004",
  "cpsName": "AGV_Logistico_Zeta",
  "baseTopic": "cps4",
  "description": "AGV para logística interna com navegação SLAM, monitoramento de obstáculos e diagnóstico de motores em tempo real.",
  "features": [
    "navegacao",
    "pickup_delivery",
    "docking"
  ],
  "sensors": [
    "Bateria",
    "Velocidade",
    "Posicao_Mapa",
    "Distancia_Obstaculo",
    "Status_Motor_Tração"
  ],
  "learningTopic": "acsm2/cps4/learning",
  "oeeTopic": "cps4/oee",
  "acsmOeeTopic": "acsm2/cps4/oee",
  "federationOeeTopic": "acsm/cps4/oee",
  "federationLearningTopic": "acsm/cps4/learning",
  "datasheet": "/datasheetAGV_logico_zeta.pdf",
  "endpoints": {
    "DescriptionEndpoint": "http://localhost:3000/api/acsm2/cps4/description",
    "SummaryEndpoint": "http://localhost:3000/api/acsm2/cps4/summary",
    "IndicatorsEndpoint": "http://localhost:3000/api/acsm2/cps4/indicators",
    "HistoryEndpoint": "http://localhost:3000/api/acsm2/cps4/history",
    "HealthEndpoint": "http://localhost:3000/api/acsm2/cps4/health"
  }
},profile={
  "d": "agv",
  "ideal": 6000,
  "tempW": 55,
  "tempC": 68,
  "batW": 35,
  "batC": 20,
  "speedI": 0.15,
  "speedC": 1.2,
  "obsW": 1.2,
  "obsC": 0.45,
  "targetS": 1,
  "good": "stable_route_execution",
  "drift": "battery_or_congestion_drift",
  "crit": "fleet_mobility_risk",
  "why": {
    "availability": "battery_or_obstacle_stop",
    "performance": "route_speed_loss",
    "quality": "navigation_precision_loss"
  }
};const health=flow.get("lastHealth")||{},oee=flow.get("lastOee")||{},t=(flow.get("lastOperationalSnapshot")||{}).telemetry||{};const losses={availability:Number((1-Number(oee.availability||0)).toFixed(4)),performance:Number((1-Number(oee.performance||0)).toFixed(4)),quality:Number((1-Number(oee.quality||0)).toFixed(4))};const dom=Object.entries(losses).sort((a,b)=>b[1]-a[1])[0]?.[0]||null,prob=dom?profile.why[dom]:null,risk=health.healthLabel==='critical'?'high':health.healthLabel==='attention'?'medium':'low';let rec='';if(profile.d==='cnc')rec=dom==='quality'?'Recalibrate offsets, inspect thermal compensation and reduce vibration.':dom==='performance'?'Inspect spindle load and feed stability.':'Reduce setup/downtime and recover machine availability.';if(profile.d==='agv')rec=dom==='quality'?'Inspect localization precision, obstacle clearance and docking alignment.':dom==='performance'?'Review route congestion and target cruise speed.':'Recover battery/traction availability before next mission.';if(profile.d==='buffer')rec=dom==='quality'?'Inspect zone synchronization and false occupancy detection.':dom==='performance'?'Increase stable release rate and reduce blocking between zones.':'Resolve jams or motor stoppage before resuming throughput.';msg.payload={model:'domain-heuristic',type:profile.d+'-local-reasoning',dominantLossNow:dom,dominantLossForecast:dom,dominantLoss:dom,probableCause:prob,riskLevel:risk,confidence:Number((risk==='high'?0.9:risk==='medium'?0.76:0.62).toFixed(2)),explanation:'Dominant loss is '+dom+' in '+profile.d+' context due to '+prob+'.',recommendation:rec,evidence:profile.d==='cnc'?['rpm='+(t.currentRPM??'n/a'),'temp='+(t.currentTemperature??'n/a'),'vibration='+(t.vibrationLevel??'n/a')]:profile.d==='agv'?['battery='+(t.batteryLevel??'n/a'),'speed='+(t.linearSpeed??'n/a'),'obstacle='+(t.obstacleDistance??'n/a')]:['motorCurrent='+(t.motorCurrent??'n/a'),'occupancy='+(t.occupancySum??'n/a'),'releaseRate='+(t.releaseRate??'n/a')],losses};flow.set("lastReasoning",msg.payload);return msg;
```

## Build CPS7 Payload for ACSM
```javascript
const cfg={
  "alias": "CPS4",
  "formalCpsId": "CPS-004",
  "cpsName": "AGV_Logistico_Zeta",
  "baseTopic": "cps4",
  "description": "AGV para logística interna com navegação SLAM, monitoramento de obstáculos e diagnóstico de motores em tempo real.",
  "features": [
    "navegacao",
    "pickup_delivery",
    "docking"
  ],
  "sensors": [
    "Bateria",
    "Velocidade",
    "Posicao_Mapa",
    "Distancia_Obstaculo",
    "Status_Motor_Tração"
  ],
  "learningTopic": "acsm2/cps4/learning",
  "oeeTopic": "cps4/oee",
  "acsmOeeTopic": "acsm2/cps4/oee",
  "federationOeeTopic": "acsm/cps4/oee",
  "federationLearningTopic": "acsm/cps4/learning",
  "datasheet": "/datasheetAGV_logico_zeta.pdf",
  "endpoints": {
    "DescriptionEndpoint": "http://localhost:3000/api/acsm2/cps4/description",
    "SummaryEndpoint": "http://localhost:3000/api/acsm2/cps4/summary",
    "IndicatorsEndpoint": "http://localhost:3000/api/acsm2/cps4/indicators",
    "HistoryEndpoint": "http://localhost:3000/api/acsm2/cps4/history",
    "HealthEndpoint": "http://localhost:3000/api/acsm2/cps4/health"
  }
},profile={
  "d": "agv",
  "ideal": 6000,
  "tempW": 55,
  "tempC": 68,
  "batW": 35,
  "batC": 20,
  "speedI": 0.15,
  "speedC": 1.2,
  "obsW": 1.2,
  "obsC": 0.45,
  "targetS": 1,
  "good": "stable_route_execution",
  "drift": "battery_or_congestion_drift",
  "crit": "fleet_mobility_risk",
  "why": {
    "availability": "battery_or_obstacle_stop",
    "performance": "route_speed_loss",
    "quality": "navigation_precision_loss"
  }
};const now=Date.now(),snap=flow.get("lastOperationalSnapshot")||{telemetry:{},sensors:{},featureStates:{}},tsf=flow.get("lastTimeSeriesFeatures")||{},learning=flow.get("lastLearning")||{},reasoning=flow.get("lastReasoning")||{},oee=flow.get("lastOee")||{};const featureStatus=Object.fromEntries(Object.entries(flow.get("featureStates")||{}).map(([k,v])=>[k,v.status]));const tele={currentTemperature:Number(snap.telemetry.currentTemperature||0),currentRPM:Number(snap.telemetry.currentRPM||0),currentTorque:Number(snap.telemetry.currentTorque||0),cycleTimeMs:Number(snap.telemetry.cycleTimeMs||profile.ideal),pieceCounterAbs:Number(snap.telemetry.pieceCounter||0),domainMode:snap.telemetry.domainMode||'idle'};if(profile.d==='cnc')Object.assign(tele,{spindleSpeed:snap.telemetry.spindleSpeed||0,spindleLoad:snap.telemetry.spindleLoad||0,axisMotion:snap.telemetry.axisMotion||0,thermalLoad:snap.telemetry.thermalLoad||0,vibrationLevel:snap.telemetry.vibrationLevel||0});if(profile.d==='agv')Object.assign(tele,{batteryLevel:snap.telemetry.batteryLevel||0,linearSpeed:snap.telemetry.linearSpeed||0,obstacleDistance:snap.telemetry.obstacleDistance||0,positionLabel:snap.telemetry.positionLabel||null,tractionStatus:snap.telemetry.tractionStatus||null,routeEfficiency:snap.telemetry.routeEfficiency||0});if(profile.d==='buffer')Object.assign(tele,{motorCurrent:snap.telemetry.motorCurrent||0,occupancySum:snap.telemetry.occupancySum||0,releaseRate:snap.telemetry.releaseRate||0,zoneOccupancy:snap.telemetry.zoneOccupancy||{}});const prod={producedDelta:Number(snap.telemetry.producedDelta||0),totalPieces:Number(snap.telemetry.pieceCounter||0),goodPieces:Number((snap.telemetry.pieceCounter||0)-(snap.telemetry.rejectDelta||0)),rejectPieces:Number(snap.telemetry.rejectDelta||0),rejectDelta:Number(snap.telemetry.rejectDelta||0)};const time={plannedProductionTimeMs:profile.ideal*Math.max(prod.totalPieces,1),downtimeMs:(flow.get('lastHealth')?.details?.awaiting||0)*10000,operatingTimeMs:profile.ideal*Math.max(prod.producedDelta,0),deltaMs:profile.ideal,deltaOperatingTimeMs:prod.producedDelta?profile.ideal:0};const st={oeeMean:tsf?.oee?.mean??null,oeeMedian:tsf?.oee?.median??null,availabilityMean:tsf?.availability?.mean??null,availabilityMedian:tsf?.availability?.median??null,performanceMean:tsf?.performance?.mean??null,performanceMedian:tsf?.performance?.median??null,performanceDisplayMean:tsf?.performance?.mean??null,performanceDisplayMedian:tsf?.performance?.median??null,qualityMean:tsf?.quality?.mean??null,qualityMedian:tsf?.quality?.median??null,tempMean:tsf?.temperature?.mean??null,tempMedian:tsf?.temperature?.median??null,rpmMean:tsf?.rpm?.mean??null,rpmMedian:tsf?.rpm?.median??null,torqueMean:tsf?.torque?.mean??null,torqueMedian:tsf?.torque?.median??null,cycleMean:tsf?.cycleTimeMs?.mean??null,cycleMedian:tsf?.cycleTimeMs?.median??null,oee_mean:tsf?.oee?.mean??null,oee_median:tsf?.oee?.median??null,availability_mean:tsf?.availability?.mean??null,availability_median:tsf?.availability?.median??null,performance_mean:tsf?.performance?.mean??null,performance_median:tsf?.performance?.median??null,performance_display_mean:tsf?.performance?.mean??null,performance_display_median:tsf?.performance?.median??null,quality_mean:tsf?.quality?.mean??null,quality_median:tsf?.quality?.median??null,temp_mean:tsf?.temperature?.mean??null,temp_median:tsf?.temperature?.median??null,rpm_mean:tsf?.rpm?.mean??null,rpm_median:tsf?.rpm?.median??null,torque_mean:tsf?.torque?.mean??null,torque_median:tsf?.torque?.median??null,cycle_mean:tsf?.cycleTimeMs?.mean??null,cycle_median:tsf?.cycleTimeMs?.median??null};const feats={featureStatus,playEnabled:flow.get('playEnabled')===true,learningState:learning.state||null,learningPattern:learning.pattern||null,dominantLossNow:reasoning.dominantLossNow||null,dominantLossForecast:reasoning.dominantLossForecast||null,probableCause:reasoning.probableCause||null,riskLevel:reasoning.riskLevel||null,driftScore:learning.driftScore??null,anomalyScore:learning.anomalyScore??null,domain:profile.d};const evidence=[...new Set([...(Array.isArray(learning.evidence)?learning.evidence:[]),...(Array.isArray(reasoning.evidence)?reasoning.evidence:[])])];msg.payload={ts:now,timestamp:new Date(now).toISOString(),cpsId:cfg.formalCpsId,cpsName:cfg.cpsName,baseTopic:cfg.baseTopic,window:tsf?.window||('last_'+(tsf?.historySize||0)+'_points'),oee:{availability:Number(oee.availability||0),performance:Number(oee.performance||0),quality:Number(oee.quality||0),current:Number(oee.oee||0),oee:Number(oee.oee||0)},telemetry:tele,production:prod,time,statistics:st,features:feats,timeSeriesFeatures:tsf,learning:{model:learning.model||null,type:learning.type||null,state:learning.state||null,pattern:learning.pattern||learning.learned||null,learned:learning.learned||learning.pattern||null,confidence:learning.confidence??null,driftScore:learning.driftScore??null,anomalyScore:learning.anomalyScore??null,forecastOEE:Array.isArray(learning.forecastOEE)?learning.forecastOEE:[],recommendation:learning.recommendation||null,evidence:Array.isArray(learning.evidence)?learning.evidence:[],basis:learning.basis||{}},reasoning:{model:reasoning.model||null,type:reasoning.type||null,dominantLossNow:reasoning.dominantLossNow||null,dominantLossForecast:reasoning.dominantLossForecast||null,dominantLoss:reasoning.dominantLossNow||reasoning.dominantLoss||null,probableCause:reasoning.probableCause||null,riskLevel:reasoning.riskLevel||null,confidence:reasoning.confidence??null,explanation:reasoning.explanation||null,recommendation:reasoning.recommendation||null,evidence:Array.isArray(reasoning.evidence)?reasoning.evidence:[],losses:reasoning.losses||{}},evidence,source:{producer:cfg.alias,semanticPackageVersion:'v2-domain',generatedBy:'Semantic Pass 2 for '+cfg.alias},assetContext:{domain:profile.d,description:cfg.description,features:cfg.features.map(function(f){return typeof f==='string'?{key:f,name:f}:{key:f.key,name:f.name||f.key};}),optionalFederationTopics:{oee:cfg.federationOeeTopic,learning:cfg.federationLearningTopic}}};flow.set('lastAcsmPayload',msg.payload);return msg;
```
