# CPS6 Function Nodes

- formalCpsId: `CPS-006`
- cpsName: `BufferLine_50467`
- baseTopic: `cps6`
- features: `zone1_release`, `zone2_release`, `zone3_release`, `detectar_zone1`, `detectar_zone2`, `detectar_zone3`
- sensors: `NominalVoltage_24V`, `Zone1_Occupied`, `Zone2_Occupied`, `Zone3_Occupied`, `MotorCurrent`, `MotorTemperature`

## Gerar estado da funcionalidade fazer expedição
```javascript
// ======================================================================
// CPS6 - Funcionalidade: zone1_release
// Saída 1: status normal da funcionalidade
// Saída 2: somente quando status = awaiting_replacement
// Saída 3: sensordata para dashboard
// Saída 4: log estruturado
// ======================================================================

const playEnabled = flow.get("playEnabled") === true;
if (!playEnabled) {
  return null;
}

const base = "cps6";
const PLANT_KEY = "cps6";
const FEATURE = "zone1_release";

const KEY_LAST_STATE = `lastState:${PLANT_KEY}:${FEATURE}`;
const KEY_LAST_SEEN = `lastSeen:${PLANT_KEY}:${FEATURE}`;
const KEY_LAST_STATUS = `lastStatus:${PLANT_KEY}:${FEATURE}`;

const T_MAINT_MS = 3000;
const T_AWAIT_MS = 10000;

const to01 = (v) => {
  if (v === true) return 1;
  if (v === false) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
};

const sig = (s) => `${s.m_est_esq}|${s.m_est_dir}|${s.s_est_esquerda}|${s.s_est_direita}`;

const ACTIVE_STATES = new Set([
  "0|1|1|0",
  "0|1|0|0",
  "0|0|0|1",
  "1|0|0|1",
  "1|0|0|0",
  "1|0|1|0",
  "0|0|1|0"
]);

const now = Date.now();
const isTick = (msg.payload === "tick") || (msg.tick === true);

function buildAwaitingOutput(baseMsg) {
  if (baseMsg?.payload?.status === "awaiting_replacement") {
    return {
      topic: `${base}/${PLANT_KEY}/feat/${FEATURE}/awaiting_replacement`,
      payload: {
        cpsId: "CPS-006",
        plant: PLANT_KEY,
        feature: FEATURE,
        status: "awaiting_replacement",
        ts: baseMsg.payload.ts,
        details: baseMsg.payload.details || {}
      },
      retain: false,
      qos: 1
    };
  }
  return null;
}

function buildSensorDataOutput(state) {
  return {
    topic: `${base}/sensordata`,
    payload: {
      s_est_esquerda: Number(state.s_est_esquerda ?? 0),
      s_est_direita: Number(state.s_est_direita ?? 0),
      s_tor_encima: Number(state.s_tor_encima ?? 0),
      s_tor_embaixo: Number(state.s_tor_embaixo ?? 0),
      m_est_esq: Number(state.m_est_esq ?? 0),
      m_est_dir: Number(state.m_est_dir ?? 0),
      m_tor_encima: Number(state.m_tor_encima ?? 0),
      m_tor_embaixo: Number(state.m_tor_embaixo ?? 0)
    },
    retain: false,
    qos: 1
  };
}

function buildLog(eventType, payload, level = "INFO", topic = null) {
  return {
    _log: {
      cpsId: "CPS-006",
      cpsName: "BufferLine_50467",
      baseTopic: base,
      plant: PLANT_KEY,
      feature: FEATURE,
      level,
      eventType,
      sourceNode: "Gerar estado da funcionalidade fazer expedição",
      topic,
      payload
    }
  };
}

// --------------------
// 1) TICK
// --------------------
if (isTick) {
  const lastSeen = flow.get(KEY_LAST_SEEN);
  const lastState = flow.get(KEY_LAST_STATE);
  const lastStatus = flow.get(KEY_LAST_STATUS) || "maintenance";

  let out1;
  let outLog;

  if (!lastSeen || !lastState) {
    out1 = {
      topic: `${base}/${PLANT_KEY}/feat/${FEATURE}/$state`,
      payload: {
        status: "maintenance",
        ts: now,
        plant: PLANT_KEY,
        feature: FEATURE,
        details: {
          origem: "tick",
          motivo: "sem_dados_iniciais",
          tempo_sem_receber_dado_ms: lastSeen ? (now - lastSeen) : null
        }
      },
      retain: true,
      qos: 1
    };

    flow.set(KEY_LAST_STATUS, "maintenance");

    outLog = buildLog(
      "FEATURE_TICK_NO_INITIAL_DATA",
      out1.payload,
      "WARN",
      out1.topic
    );

    return [out1, null, null, outLog];
  }

  const timeSinceSeen = now - lastSeen;

  let status;
  if (timeSinceSeen >= T_AWAIT_MS) status = "awaiting_replacement";
  else if (timeSinceSeen >= T_MAINT_MS) status = "maintenance";
  else status = lastStatus;

  const prev = flow.get(KEY_LAST_STATUS) || lastStatus;
  if (status === prev) return null;

  flow.set(KEY_LAST_STATUS, status);

  out1 = {
    topic: `${base}/${PLANT_KEY}/feat/${FEATURE}/$state`,
    payload: {
      status,
      ts: now,
      plant: PLANT_KEY,
      feature: FEATURE,
      details: {
        origem: "tick",
        sensores: lastState,
        tempo_sem_receber_dado_ms: timeSinceSeen
      }
    },
    retain: true,
    qos: 1
  };

  const out2 = buildAwaitingOutput(out1);

  outLog = buildLog(
    "FEATURE_STATE_CHANGED_BY_TICK",
    {
      previousStatus: prev,
      newStatus: status,
      details: out1.payload.details
    },
    status === "awaiting_replacement" ? "WARN" : "INFO",
    out1.topic
  );

  return [out1, out2, null, outLog];
}

// --------------------
// 2) SERIAL
// --------------------
let raw = msg.payload;
let data;

if (Buffer.isBuffer(raw)) raw = raw.toString();

if (typeof raw === "string") {
  let str = raw.trim();
  const first = str.indexOf("{");
  const last = str.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) str = str.slice(first, last + 1);

  try {
    data = JSON.parse(str);
  } catch (e) {
    return [null, null, null, buildLog(
      "SERIAL_INVALID_JSON",
      { error: e.message, raw: str },
      "ERROR"
    )];
  }
} else if (typeof raw === "object" && raw !== null) {
  data = raw;
} else {
  return [null, null, null, buildLog(
    "SERIAL_UNEXPECTED_FORMAT",
    { rawType: typeof raw, raw },
    "ERROR"
  )];
}

if (!data[PLANT_KEY]) {
  return [null, null, null, buildLog(
    "SERIAL_MISSING_PLANT_KEY",
    { expectedPlantKey: PLANT_KEY, received: data },
    "WARN"
  )];
}

const p = data[PLANT_KEY];

const currentState = {
  s_est_esquerda: to01(p.s_est_esquerda),
  s_est_direita: to01(p.s_est_direita),
  s_tor_encima: to01(p.s_tor_encima),
  s_tor_embaixo: to01(p.s_tor_embaixo),
  m_est_esq: to01(p.m_est_esq),
  m_est_dir: to01(p.m_est_dir),
  m_tor_encima: to01(p.m_tor_encima),
  m_tor_embaixo: to01(p.m_tor_embaixo)
};

const stateSig = sig(currentState);
const isActive = ACTIVE_STATES.has(stateSig);

const allZero =
  currentState.m_est_esq === 0 &&
  currentState.m_est_dir === 0 &&
  currentState.s_est_esquerda === 0 &&
  currentState.s_est_direita === 0;

flow.set(KEY_LAST_SEEN, now);
flow.set(KEY_LAST_STATE, currentState);

let status;
if (allZero) {
  status = "awaiting_replacement";
} else if (isActive) {
  status = "active";
} else {
  status = "maintenance";
}

flow.set(KEY_LAST_STATUS, status);

const out1 = {
  topic: `${base}/${PLANT_KEY}/feat/${FEATURE}/$state`,
  payload: {
    status,
    ts: now,
    plant: PLANT_KEY,
    feature: FEATURE,
    details: {
      origem: "serial",
      sensores: currentState,
      assinatura: stateSig
    }
  },
  retain: true,
  qos: 1
};

const out2 = buildAwaitingOutput(out1);
const out3 = buildSensorDataOutput(currentState);
const out4 = buildLog(
  "FEATURE_STATE_FROM_SERIAL",
  {
    status,
    assinatura: stateSig,
    sensores: currentState,
    isActive,
    allZero
  },
  status === "awaiting_replacement" ? "WARN" : "INFO",
  out1.topic
);

return [out1, out2, out3, out4];
```

## Simula envio dos dados da planta 2
```javascript
// Gerador de valores aleatórios (0 ou 1)
const rand = () => Math.round(Math.random());

// 2. Prepara e envia os dados da Planta 2
const dadosPlanta2 = {
    "cps6": {
        "m_est_esq": rand(),
        "m_est_dir": rand(),
        "s_est_esquerda": rand(),
        "s_est_direita": rand()
    }
};

// O return final envia a última mensagem e encerra a função
return { payload: dadosPlanta2 };
```

## Init estado PLAY
```javascript
flow.set("playEnabled", false);
flow.set("autoReturnAfterMaintenance", false);
flow.set("maintenanceInProgress", false);
flow.set("lastLifecycleReason", "startup");

msg.payload = {
    cpsId: "CPS-006",
    cpsName: "BufferLine_50467",
    baseTopic: "cps6",
    playEnabled: false,
    status: "parado",
    ts: new Date().toISOString()
};

return [
    msg,
    {
        _log: {
            cpsId: "CPS-006",
            cpsName: "BufferLine_50467",
            baseTopic: "cps6",
            level: "INFO",
            eventType: "CPS_INITIALIZED",
            sourceNode: "Init estado PLAY",
            payload: msg.payload
        }
    }
];

return msg;
```

## Liberar operações só em PLAY
```javascript
const playEnabled = flow.get("playEnabled") === true;

if (!playEnabled) {
    node.status({ fill: "red", shape: "ring", text: "bloqueado - sem PLAY" });
    return [null, {
        _log: {
            cpsId: "CPS-006",
            cpsName: "BufferLine_50467",
            baseTopic: "cps6",
            level: "WARN",
            eventType: "OPERATION_BLOCKED_NO_PLAY",
            sourceNode: "Liberar operações só em PLAY",
            payload: {
                originalTopic: msg.topic || null,
                originalPayload: msg.payload
            }
        }
    }];
}

node.status({ fill: "green", shape: "dot", text: "operação liberada" });
return [msg, {
    _log: {
        cpsId: "CPS-006",
        cpsName: "BufferLine_50467",
        baseTopic: "cps6",
        level: "INFO",
        eventType: "OPERATION_RELEASED_PLAY_ENABLED",
        sourceNode: "Liberar operações só em PLAY",
        payload: {
            originalTopic: msg.topic || null
        }
    }
}];
```

## Controlar PLAY/STOP
```javascript
let payload = msg.payload;

if (typeof payload === "string") {
    try {
        payload = JSON.parse(payload);
    } catch (e) {
        payload = { action: String(payload).trim().toLowerCase() };
    }
}

const action = String(payload.action || payload.command || payload.cmd || "")
    .trim()
    .toLowerCase();

const cpsId = "CPS-006";
const cpsName = "BufferLine_50467";
const baseTopic = "cps6";

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function buildStatusMsg(state, playEnabled, healthScore = 50, healthLabel = "unknown", summaryText = "") {
    return {
        topic: `${baseTopic}/status`,
        payload: {
            cpsId,
            cpsName,
            state,
            playEnabled,
            healthScore,
            healthLabel,
            featureCount: 1,
            summary: summaryText || {
                active: 0,
                maintenance: 0,
                awaiting_replacement: 0,
                failure: 0,
                unknown: 0
            },
            ts: Date.now()
        },
        qos: 1,
        retain: true
    };
}

function buildLog(eventType, payloadData, level = "INFO", topic = null) {
    return {
        _log: {
            cpsId,
            cpsName,
            baseTopic,
            plant: "cps6",
            feature: null,
            level,
            eventType,
            sourceNode: "Controlar PLAY/STOP",
            topic,
            payload: payloadData
        }
    };
}

// --------------------------------------------------
// PLAY
// --------------------------------------------------
if (action === "play") {
    flow.set("playEnabled", true);
    flow.set("maintenanceInProgress", false);
    flow.set("autoReturnAfterMaintenance", false);
    flow.set("lastLifecycleReason", "manual_play");

    node.status({ fill: "green", shape: "dot", text: "PLAY habilitado" });

    const ackMsg = {
        topic: `${baseTopic}/ack`,
        payload: {
            cpsId,
            action: "play",
            ok: true,
            playEnabled: true,
            status: "rodando",
            ts: new Date().toISOString()
        },
        qos: 1,
        retain: false
    };

    const triggerMsg = {
        topic: `${baseTopic}/internal/resume`,
        payload: {
            trigger: "resume_operation",
            playEnabled: true,
            ts: Date.now()
        }
    };

    const statusMsg = buildStatusMsg(
        "running",
        true,
        100,
        "healthy",
        "PLAY command accepted. CPS resumed operation."
    );

    const logMsg = buildLog(
        "COMMAND_PLAY_ACCEPTED",
        {
            commandReceived: action,
            ack: ackMsg.payload,
            publishedTopics: [
                ackMsg.topic,
                triggerMsg.topic,
                statusMsg.topic
            ],
            flowState: {
                playEnabled: flow.get("playEnabled"),
                maintenanceInProgress: flow.get("maintenanceInProgress"),
                autoReturnAfterMaintenance: flow.get("autoReturnAfterMaintenance"),
                lastLifecycleReason: flow.get("lastLifecycleReason")
            },
            ts: Date.now()
        },
        "INFO",
        ackMsg.topic
    );

    return [ackMsg, triggerMsg, statusMsg, logMsg];
}

// --------------------------------------------------
// STOP
// --------------------------------------------------
if (action === "stop") {
    flow.set("playEnabled", false);
    flow.set("lastLifecycleReason", "manual_stop");

    node.status({ fill: "red", shape: "ring", text: "STOP ativo" });

    const ackMsg = {
        topic: `${baseTopic}/ack`,
        payload: {
            cpsId,
            action: "stop",
            ok: true,
            playEnabled: false,
            status: "parado",
            ts: new Date().toISOString()
        },
        qos: 1,
        retain: false
    };

    const statusMsg = buildStatusMsg(
        "stopped",
        false,
        50,
        "unknown",
        "STOP command accepted. CPS stopped."
    );

    const logMsg = buildLog(
        "COMMAND_STOP_ACCEPTED",
        {
            commandReceived: action,
            ack: ackMsg.payload,
            publishedTopics: [
                ackMsg.topic,
                statusMsg.topic
            ],
            flowState: {
                playEnabled: flow.get("playEnabled"),
                maintenanceInProgress: flow.get("maintenanceInProgress"),
                autoReturnAfterMaintenance: flow.get("autoReturnAfterMaintenance"),
                lastLifecycleReason: flow.get("lastLifecycleReason")
            },
            ts: Date.now()
        },
        "WARN",
        ackMsg.topic
    );

    return [ackMsg, null, statusMsg, logMsg];
}

// --------------------------------------------------
// UNPLUG
// --------------------------------------------------
if (action === "unplug") {
    const lastLifecycleReason = flow.get("lastLifecycleReason") || "";

    flow.set("playEnabled", false);

    // Preserva contexto se o unplug foi causado por manutenção
    if (lastLifecycleReason !== "maintenance") {
        flow.set("maintenanceInProgress", false);
        flow.set("autoReturnAfterMaintenance", false);
    }

    if (lastLifecycleReason !== "maintenance") {
        flow.set("lastLifecycleReason", "manual_unplug");
    }

    node.status({ fill: "grey", shape: "ring", text: "UNPLUG solicitado" });

    const ackMsg = {
        topic: `${baseTopic}/ack`,
        payload: {
            cpsId,
            action: "unplug",
            ok: true,
            playEnabled: false,
            status: "unplugged",
            ts: new Date().toISOString()
        },
        qos: 1,
        retain: false
    };

    const statusMsg = buildStatusMsg(
        "unplugged",
        false,
        0,
        "failure",
        "UNPLUG command accepted. CPS disconnected from operation."
    );

    const logMsg = buildLog(
        "COMMAND_UNPLUG_ACCEPTED",
        {
            commandReceived: action,
            ack: ackMsg.payload,
            publishedTopics: [
                ackMsg.topic,
                statusMsg.topic
            ],
            flowState: {
                playEnabled: flow.get("playEnabled"),
                maintenanceInProgress: flow.get("maintenanceInProgress"),
                autoReturnAfterMaintenance: flow.get("autoReturnAfterMaintenance"),
                lastLifecycleReason: flow.get("lastLifecycleReason")
            },
            ts: Date.now()
        },
        "WARN",
        ackMsg.topic
    );

    return [ackMsg, null, statusMsg, logMsg];
}

// --------------------------------------------------
// Comando inválido
// --------------------------------------------------
node.warn("Comando inválido recebido: " + JSON.stringify(msg.payload));

const invalidLog = buildLog(
    "INVALID_COMMAND",
    {
        commandReceived: action,
        originalPayload: msg.payload,
        ts: Date.now()
    },
    "ERROR",
    msg.topic || null
);

return [null, null, null, invalidLog];
```

## Unplug por falha manutenção
```javascript
// ======================================================
// Unplug por falha manutenção
// Saída 1: e-mail
// Saída 2: gate do unplug
// Saída 3: log estruturado
// ======================================================

// 1. Inicializa regra1 caso ainda não exista
let regra1 = global.get("regra1");
if (regra1 === undefined) {
  global.set("regra1", false);
}

// 2. Contador de eventos
let count = flow.get("await_count") || 0;

// 3. Normaliza status recebido
let normalizedStatus = "";
if (msg.payload && msg.payload.status) {
  normalizedStatus = String(msg.payload.status)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

// Helper para log
function buildLog(eventType, payloadData, level = "INFO", topic = null) {
  return {
    _log: {
      cpsId: payloadData?.cpsId || "CPS-006",
      cpsName: payloadData?.cpsName || "BufferLine_50467",
      baseTopic: "cps6",
      plant: payloadData?.plant || "cps6",
      feature: payloadData?.feature || "zone1_release",
      level,
      eventType,
      sourceNode: "Unplug por falha manutenção",
      topic,
      payload: payloadData
    }
  };
}

// 4. Verifica status awaiting_replacement
if (normalizedStatus === "awaiting_replacement") {
  count++;
  flow.set("await_count", count);

  const cpsId = msg.payload?.cpsId || "CPS-006";
  const equipamento = msg.payload?.cpsName || "BufferLine_50467";
  const funcionalidade = msg.payload?.feature || "zone1_release";
  const statusAtual = msg.payload?.status || "awaiting_replacement";
  const pecas = msg.payload?.partCount || msg.payload?.piecesExpedited || 0;
  const tempoMs = msg.payload?.workedMs || 0;

  const horas = Math.floor(tempoMs / 3600000);
  const minutos = Math.floor((tempoMs % 3600000) / 60000);
  const segundos = Math.floor((tempoMs % 60000) / 1000);

  const dashboardUrl = "http://localhost:1872/dashboard/overview";
  const timestamp = new Date().toISOString();

  // --------------------------------------------------
  // Log de contagem intermediária
  // --------------------------------------------------
  if (count < 3) {
    const outLogPartial = buildLog(
      "AWAITING_REPLACEMENT_COUNT_INCREMENTED",
      {
        cpsId,
        cpsName: equipamento,
        feature: funcionalidade,
        status: statusAtual,
        awaitCount: count,
        threshold: 3,
        partCount: pecas,
        workedMs: tempoMs,
        regra1: global.get("regra1") || false,
        ts: Date.now()
      },
      "WARN",
      msg.topic || null
    );

    return [null, null, outLogPartial];
  }

  // 5. Limiar atingido
  if (count >= 3) {
    flow.set("await_count", 0);

    // ativa a regra global
    global.set("regra1", true);

    // -----------------------------
    // Saída 1: e-mail
    // -----------------------------
    const outEmail = {
      ...msg,
      to: "marcos.rodrigomomo@gmail.com",
      topic: "Alerta parada de CPS",
      payload:
        `ALERTA DE MANUTENÇÃO PREVENTIVA

O CPS atingiu o limiar de awaiting_replacement e deverá fazer unplug para manutenção.

Identificação do CPS
- CPS ID: ${cpsId}
- Equipamento: ${equipamento}

Estado operacional
- Funcionalidade: ${funcionalidade}
- Status atual: ${statusAtual}

Indicadores operacionais
- Número de peças produzidas/expedidas: ${pecas}
- Tempo de operação acumulado: ${horas}h ${minutos}min ${segundos}s

Ação recomendada
- Realizar unplug do CPS para manutenção.

Evolução de autonomia
- O CPS ${cpsId} está começando a apresentar algum nível de autonomia, por exemplo:
  - enviar alerta ao responsável
  - solicitar UNPLUG via ACSM
- Em uma manutenção rápida, idealmente poderia se comissionar sozinho sem depender da ACSM.
- Já em alterações maiores, como adição ou remoção de funcionalidades, será necessário um novo AAS com novas informações e redefinição dos níveis de autonomia, inteligência e governança.

Dashboard
- ${dashboardUrl}

Timestamp
- ${timestamp}`,
      html: `
<h2>Alerta de Manutenção Preventiva</h2>

<p>O CPS atingiu o limiar de <b>awaiting_replacement</b> e deverá fazer <b>unplug</b> para manutenção.</p>

<h3>Identificação do CPS</h3>
<ul>
  <li><b>CPS ID:</b> ${cpsId}</li>
  <li><b>Equipamento:</b> ${equipamento}</li>
</ul>

<h3>Estado operacional</h3>
<ul>
  <li><b>Funcionalidade:</b> ${funcionalidade}</li>
  <li><b>Status atual:</b> ${statusAtual}</li>
</ul>

<h3>Indicadores operacionais</h3>
<ul>
  <li><b>Número de peças produzidas/expedidas:</b> ${pecas}</li>
  <li><b>Tempo de operação acumulado:</b> ${horas}h ${minutos}min ${segundos}s</li>
</ul>

<h3>Ação recomendada</h3>
<p>Realizar <b>unplug do CPS</b> para manutenção.</p>

<h3>Evolução de autonomia</h3>
<p>
O CPS <b>${cpsId}</b> está começando a apresentar algum nível de autonomia, como enviar alerta ao responsável
e solicitar <b>UNPLUG</b> via ACSM.
</p>
<p>
Em uma manutenção rápida, idealmente poderia se comissionar sozinho sem depender da ACSM.
Já em alterações maiores, como adição ou remoção de funcionalidades, será necessário um novo AAS
com novas informações e redefinição dos níveis de autonomia, inteligência e governança.
</p>

<h3>Dashboard</h3>
<p>${dashboardUrl}</p>

<h3>Timestamp</h3>
<p>${timestamp}</p>
`
    };

    // -----------------------------
    // Saída 2: gate do unplug
    // -----------------------------
    const outGate = {
      ...msg,
      payload: {
        cpsName: equipamento,
        cpsId: cpsId,
        baseTopic: "cps6",
        reason: "preventive_maintenance",
        conditionType: "regra1",
        regra1: true,
        status: statusAtual,
        feature: funcionalidade,
        partCount: pecas,
        workedMs: tempoMs,
        ts: Date.now()
      }
    };

    // -----------------------------
    // Saída 3: log
    // -----------------------------
    const outLog = buildLog(
      "MAINTENANCE_THRESHOLD_REACHED",
      {
        cpsId,
        cpsName: equipamento,
        feature: funcionalidade,
        status: statusAtual,
        awaitCount: 3,
        threshold: 3,
        partCount: pecas,
        workedMs: tempoMs,
        workedTimeHuman: `${horas}h ${minutos}min ${segundos}s`,
        regra1: true,
        action: "trigger_unplug_gate",
        emailGenerated: true,
        gateGenerated: true,
        dashboardUrl,
        ts: Date.now()
      },
      "WARN",
      "cps6/internal/maintenance_alert"
    );

    return [outEmail, outGate, outLog];
  }
}

// --------------------------------------------------
// Caso não seja awaiting_replacement
// opcionalmente reseta contador e loga
// --------------------------------------------------
if (normalizedStatus && normalizedStatus !== "awaiting_replacement") {
  if (count !== 0) {
    flow.set("await_count", 0);
  }

  const outLogReset = buildLog(
    "AWAITING_REPLACEMENT_COUNTER_RESET",
    {
      cpsId: msg.payload?.cpsId || "CPS-006",
      cpsName: msg.payload?.cpsName || "BufferLine_50467",
      feature: msg.payload?.feature || "zone1_release",
      status: normalizedStatus,
      awaitCount: 0,
      reason: "status_changed",
      ts: Date.now()
    },
    "INFO",
    msg.topic || null
  );

  return [null, null, outLogReset];
}

// Retorna null nas três saídas se nada útil ocorreu
return [null, null, null];
```

## Simular replacement
```javascript
// Gerador de valores aleatórios (0 ou 1)
//const rand = () => Math.round(Math.random());
//simula replacemnt

// 2. Prepara e envia os dados da Planta 2
const dadosPlanta2 = {
    "cps6": {
        "m_est_esq": 0,
        "m_est_dir": 0,
        "s_est_esquerda": 0,
        "s_est_direita": 0
    }
};

// O return final envia a última mensagem e encerra a função
return { payload: dadosPlanta2 };
```

## gate com trava e auto-reset 
```javascript
const regra1 = global.get("regra1") || false;
const unplugSent = flow.get("unplugSent") || false;

// lê e normaliza o status atual
let status = "";
if (msg.payload && msg.payload.status) {
    status = String(msg.payload.status)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_");
}

// se saiu de awaiting_replacement, reseta a trava e a regra
if (status !== "awaiting_replacement") {
    flow.set("unplugSent", false);
    global.set("regra1", false);

    node.status({
        fill: "blue",
        shape: "ring",
        text: "gate resetado"
    });

    return [null, null];
}

// só segue se regra1 estiver ativa
if (!regra1) {
    node.status({
        fill: "grey",
        shape: "ring",
        text: "regra1=false"
    });
    return [null, null];
}

// se já enviou, bloqueia
if (unplugSent) {
    node.status({
        fill: "yellow",
        shape: "ring",
        text: "unplug já enviado"
    });
    return [null, null];
}

const playEnabled = flow.get("playEnabled") === true;
const ts = Date.now();

// marca contexto de manutenção
flow.set("maintenanceInProgress", true);
flow.set("autoReturnAfterMaintenance", playEnabled);
flow.set("lastLifecycleReason", "maintenance");
flow.set("maintenanceStartTs", ts);
flow.set("playEnabled", false);

// libera uma vez
flow.set("unplugSent", true);

// saída 1 = pedido real de unplug para ACSM
const msgUnplug = {
    topic: "acsm/lifecycle/unplug_request",
    payload: {
        cpsName: msg.payload?.cpsName || "BufferLine_50467",
        cpsId: msg.payload?.cpsId || "CPS-006",
        baseTopic: msg.payload?.baseTopic || "cps6",
        reason: "maintenance",
        conditionType: "regra1",
        autoReturnCandidate: playEnabled,
        ts
    }
};

// saída 2 = agenda manutenção automática
const msgMaintenanceTimer = {
    topic: "cps6/internal/maintenance_timer",
    payload: {
        type: "maintenance_scheduled",
        cpsName: msg.payload?.cpsName || "BufferLine_50467",
        cpsId: msg.payload?.cpsId || "CPS-006",
        baseTopic: msg.payload?.baseTopic || "cps6",
        autoReturnCandidate: playEnabled,
        delayMs: 10000,
        maintenanceStartTs: ts
    }
};

node.status({
    fill: "green",
    shape: "dot",
    text: "unplug manutenção liberado"
});

return [msgUnplug, msgMaintenanceTimer];
```

## Calcular health do CPS
```javascript
const p = msg.payload || {};
const status = String(p.status || "").toLowerCase().trim();

let healthScore = 100;
let healthLabel = "healthy";

if (status === "active") {
    healthScore = 100;
    healthLabel = "healthy";
} else if (status === "maintenance") {
    healthScore = 60;
    healthLabel = "warning";
} else if (status === "awaiting_replacement") {
    healthScore = 20;
    healthLabel = "critical";
} else if (status === "failure") {
    healthScore = 0;
    healthLabel = "failure";
} else {
    healthScore = 50;
    healthLabel = "unknown";
}

msg.topic = "cps6/health";
msg.payload = {
    cpsId: "CPS-006",
    cpsName: "BufferLine_50467",
    plant: p.plant || "cps6",
    feature: p.feature || "zone1_release",
    sourceStatus: status || "unknown",
    healthScore,
    healthLabel,
    ts: Date.now()
};

msg.qos = 1;
msg.retain = true;

return msg;
```

## gerar dado imediato ao play
```javascript
const rand = () => Math.round(Math.random());

return {
    payload: {
        cps6: {
            m_est_esq: rand(),
            m_est_dir: rand(),
            s_est_esquerda: rand(),
            s_est_direita: rand()
        }
    }
};
```

## calcular estado global do CPS
```javascript
const p = msg.payload || {};
const featureStatus = String(p.status || "").toLowerCase().trim();
const playEnabled = flow.get("playEnabled") === true;

const cpsId = "CPS-006";
const cpsName = "BufferLine_50467";

// Como o CPS-7 hoje tem 1 funcionalidade principal,
// vamos montar a contagem já pensando em expansão futura.
const summary = {
    active: 0,
    maintenance: 0,
    awaiting_replacement: 0,
    failure: 0,
    unknown: 0
};

if (featureStatus === "active") {
    summary.active += 1;
} else if (featureStatus === "maintenance") {
    summary.maintenance += 1;
} else if (featureStatus === "awaiting_replacement") {
    summary.awaiting_replacement += 1;
} else if (featureStatus === "failure") {
    summary.failure += 1;
} else {
    summary.unknown += 1;
}

// Health derivado do status atual da feature
let healthScore = 50;
let healthLabel = "unknown";

if (featureStatus === "active") {
    healthScore = 100;
    healthLabel = "healthy";
} else if (featureStatus === "maintenance") {
    healthScore = 60;
    healthLabel = "warning";
} else if (featureStatus === "awaiting_replacement") {
    healthScore = 20;
    healthLabel = "critical";
} else if (featureStatus === "failure") {
    healthScore = 0;
    healthLabel = "failure";
}

// Estado global do CPS
let globalState = "ready";

if (!playEnabled) {
    globalState = "stopped";
} else if (summary.failure > 0) {
    globalState = "failure";
} else if (summary.awaiting_replacement > 0) {
    globalState = "awaiting_replacement";
} else if (summary.maintenance > 0) {
    globalState = "maintenance";
} else if (summary.active > 0) {
    globalState = "running";
} else {
    globalState = "ready";
}

msg.topic = "cps6/status";
msg.payload = {
    cpsId,
    cpsName,
    state: globalState,
    playEnabled,
    healthScore,
    healthLabel,
    featureCount: 1,
    summary,
    ts: Date.now()
};

msg.qos = 1;
msg.retain = true;

return msg;
```

## calcular OEE CPS
```javascript
// ============================================================
// CPS6 - OEE Industrial Completo
// ============================================================

const now = Date.now();
const p = msg.payload || {};

// -----------------------------
// 1) Entradas de contexto
// -----------------------------
const playEnabled = flow.get("playEnabled") === true;
const featureStatus = String(p.status || p.sourceStatus || "").toLowerCase().trim();

// telemetria operacional já disponível no CPS6
const live = flow.get("aas_cps6_live") || {};
const op = live.operationalData || {};

const currentTemperature = Number(op.CurrentTemperature ?? 25);
const currentRPM = Number(op.CurrentRPM ?? 0);
const currentTorque = Number(op.CurrentTorque ?? 0);
const cycleTimeMs = Number(op.CycleTimeMs ?? 0);
const pieceCounterAbs = Number(op.PieceCounter ?? 0);

// -----------------------------
// 2) Parâmetros de processo
// -----------------------------
const IDEAL_CYCLE_TIME_MS = 3000;

const DOWNTIME_STATES = new Set([
    "maintenance",
    "awaiting_replacement",
    "failure",
    "stopped",
    "unplugged"
]);

// -----------------------------
// 3) Estado anterior
// -----------------------------
const prevTs = Number(flow.get("oee_prevTs") || now);
const prevStatus = String(flow.get("oee_prevStatus") || "").toLowerCase().trim();
const prevPlayEnabled = flow.get("oee_prevPlayEnabled") === true;
const prevPieceCounterAbs = Number(flow.get("oee_prevPieceCounterAbs") ?? pieceCounterAbs);

// acumuladores de tempo
let plannedProductionTimeMs = Number(flow.get("oee_plannedProductionTimeMs") || 0);
let downtimeMs = Number(flow.get("oee_downtimeMs") || 0);
let operatingTimeMs = Number(flow.get("oee_operatingTimeMs") || 0);

// acumuladores de produção
let totalPieces = Number(flow.get("oee_totalPieces") || 0);
let goodPieces = Number(flow.get("oee_goodPieces") || 0);
let rejectPieces = Number(flow.get("oee_rejectPieces") || 0);

// -----------------------------
// 4) Delta de tempo
// -----------------------------
const deltaMs = Math.max(0, now - prevTs);

if (prevPlayEnabled) {
    plannedProductionTimeMs += deltaMs;
}

if (prevPlayEnabled && DOWNTIME_STATES.has(prevStatus)) {
    downtimeMs += deltaMs;
}

if (prevPlayEnabled && !DOWNTIME_STATES.has(prevStatus)) {
    operatingTimeMs += deltaMs;
}

// -----------------------------
// 5) Produção total
// -----------------------------
let producedDelta = pieceCounterAbs - prevPieceCounterAbs;
if (!Number.isFinite(producedDelta) || producedDelta < 0) {
    producedDelta = 0;
}

totalPieces += producedDelta;

// -----------------------------
// 6) Qualidade (yield)
// -----------------------------
let rejectDelta = Number(
    p.rejectPiecesDelta ??
    p.scrapDelta ??
    p.badPiecesDelta ??
    0
);

if (!Number.isFinite(rejectDelta) || rejectDelta < 0) {
    rejectDelta = 0;
}

if (rejectDelta === 0 && producedDelta > 0) {
    let rejectProbability = 0;

    if (currentTemperature > 40) rejectProbability += 0.05;
    if (currentTorque > 13) rejectProbability += 0.05;
    if (cycleTimeMs > (IDEAL_CYCLE_TIME_MS * 1.5)) rejectProbability += 0.05;
    if (featureStatus === "awaiting_replacement") rejectProbability += 0.15;
    if (featureStatus === "maintenance") rejectProbability += 0.08;

    for (let i = 0; i < producedDelta; i++) {
        if (Math.random() < rejectProbability) {
            rejectDelta += 1;
        }
    }
}

rejectPieces += rejectDelta;
goodPieces += Math.max(0, producedDelta - rejectDelta);

if (goodPieces > totalPieces) goodPieces = totalPieces;
if (rejectPieces > totalPieces) rejectPieces = totalPieces;

// -----------------------------
// 7) Availability
// -----------------------------
const availability =
    plannedProductionTimeMs > 0
        ? operatingTimeMs / plannedProductionTimeMs
        : 0;

// -----------------------------
// 8) Performance
// -----------------------------

// 8.1 Performance acumulada (oficial para OEE)
let performanceAccumulated =
    operatingTimeMs > 0
        ? (IDEAL_CYCLE_TIME_MS * totalPieces) / operatingTimeMs
        : 0;

if (!Number.isFinite(performanceAccumulated) || performanceAccumulated < 0) {
    performanceAccumulated = 0;
}

// limitar para OEE industrial
performanceAccumulated = Math.min(performanceAccumulated, 1);

// 8.2 Performance instantânea da janela
let deltaOperatingTimeMs = 0;

if (prevPlayEnabled && !DOWNTIME_STATES.has(prevStatus)) {
    deltaOperatingTimeMs = deltaMs;
}

let performanceInstant = null;

if (deltaOperatingTimeMs > 0 && producedDelta > 0) {
    performanceInstant = (IDEAL_CYCLE_TIME_MS * producedDelta) / deltaOperatingTimeMs;
}

if (!Number.isFinite(performanceInstant) || performanceInstant < 0) {
    performanceInstant = null;
}

// 8.3 Se não produziu peça nesta janela, mantém valor anterior
let lastPerformanceDisplay = Number(flow.get("oee_lastPerformanceDisplay"));
if (!Number.isFinite(lastPerformanceDisplay)) {
    lastPerformanceDisplay = performanceAccumulated;
}

let performanceDisplayRaw =
    performanceInstant !== null
        ? performanceInstant
        : lastPerformanceDisplay;

// 8.4 Suavização (EMA)
const alpha = 0.25; // 0.15 a 0.30 costuma ficar bom
let performanceDisplay =
    (alpha * performanceDisplayRaw) +
    ((1 - alpha) * lastPerformanceDisplay);

if (!Number.isFinite(performanceDisplay) || performanceDisplay < 0) {
    performanceDisplay = 0;
}

// limitar a 100% para exibição
performanceDisplay = Math.min(performanceDisplay, 1);

// salva para próxima janela
flow.set("oee_lastPerformanceDisplay", performanceDisplay);

// -----------------------------
// 9) Quality
// -----------------------------
const quality =
    totalPieces > 0
        ? goodPieces / totalPieces
        : 1;

// -----------------------------
// 10) OEE
// -----------------------------
const oee = availability * performanceAccumulated * quality;
// -----------------------------
// 11) Persistência
// -----------------------------
flow.set("oee_prevTs", now);
flow.set("oee_prevStatus", featureStatus);
flow.set("oee_prevPlayEnabled", playEnabled);
flow.set("oee_prevPieceCounterAbs", pieceCounterAbs);

flow.set("oee_plannedProductionTimeMs", plannedProductionTimeMs);
flow.set("oee_downtimeMs", downtimeMs);
flow.set("oee_operatingTimeMs", operatingTimeMs);

flow.set("oee_totalPieces", totalPieces);
flow.set("oee_goodPieces", goodPieces);
flow.set("oee_rejectPieces", rejectPieces);

// -----------------------------
// 12) Saída MQTT
// -----------------------------
msg.topic = "cps6/oee";
msg.payload = {
    cpsId: "CPS-006",
    cpsName: "BufferLine_50467",

    availability: Number(availability.toFixed(4)),
    performance: Number(performanceDisplay.toFixed(4)),
    performanceAccumulated: Number(performanceAccumulated.toFixed(4)),
    performanceInstant: performanceInstant !== null ? Number(performanceInstant.toFixed(4)) : null,
    quality: Number(quality.toFixed(4)),
    oee: Number(oee.toFixed(4)),

    process: {
        idealCycleTimeMs: IDEAL_CYCLE_TIME_MS,
        featureStatus,
        playEnabled
    },

    times: {
        plannedProductionTimeMs,
        downtimeMs,
        operatingTimeMs,
        deltaMs,
        deltaOperatingTimeMs
    },

    production: {
        pieceCounterAbs,
        producedDelta,
        totalPieces,
        goodPieces,
        rejectPieces,
        rejectDelta
    },

    telemetry: {
        currentTemperature,
        currentRPM,
        currentTorque,
        cycleTimeMs
    },

    ts: now
};

msg.qos = 1;
msg.retain = true;

return msg;
```

## preparar sensor data
```javascript
[
  {
    "id": "cps6_aas_prepare_sensor_data",
    "type": "function",
    "z": "c763014928964bab",
    "name": "Preparar SensorActuatorData (AAS)",
    "func": "const p = msg.payload || {};\nconst planta = p.cps6 || p || {};\n\nconst sensorData = {\n    s_est_esquerda: Number(planta.s_est_esquerda ?? 0),\n    s_est_direita: Number(planta.s_est_direita ?? 0),\n    s_tor_encima: Number(planta.s_tor_encima ?? 0),\n    s_tor_embaixo: Number(planta.s_tor_embaixo ?? 0),\n    m_est_esq: Number(planta.m_est_esq ?? 0),\n    m_est_dir: Number(planta.m_est_dir ?? 0),\n    m_tor_encima: Number(planta.m_tor_encima ?? 0),\n    m_tor_embaixo: Number(planta.m_tor_embaixo ?? 0)\n};\n\nflow.set('cps6_last_sensorData', sensorData);\n\nmsg.topic = 'cps6/sensordata';\nmsg.payload = sensorData;\nmsg.qos = 1;\nmsg.retain = true;\nreturn msg;",
    "outputs": 1,
    "timeout": "",
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 980,
    "y": 520,
    "wires": [
      [
        "cps6_aas_publish_sensordata",
        "cps6_aas_debug_sensordata"
      ]
    ]
  },
  {
    "id": "cps6_aas_publish_sensordata",
    "type": "mqtt out",
    "z": "c763014928964bab",
    "name": "Publicar cps6/sensordata",
    "topic": "",
    "qos": "",
    "retain": "",
    "respTopic": "",
    "contentType": "",
    "userProps": "",
    "correl": "",
    "expiry": "",
    "broker": "5e90268c1fac0ea4",
    "x": 1270,
    "y": 500,
    "wires": []
  },
  {
    "id": "cps6_aas_debug_sensordata",
    "type": "debug",
    "z": "c763014928964bab",
    "name": "DEBUG SensorActuatorData",
    "active": false,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "x": 1290,
    "y": 540,
    "wires": []
  },
  {
    "id": "cps6_aas_prepare_operationaldata",
    "type": "function",
    "z": "c763014928964bab",
    "name": "Preparar OperationalData (AAS)",
    "func": "const statusMsg = msg.payload || {};\n\nlet partCount = flow.get('cps6_partCount') || 0;\nlet motorTemperature = flow.get('cps6_motorTemperature') || 45.0;\n\nconst featureStatus = String(statusMsg.status || '').toLowerCase().trim();\nconst playEnabled = flow.get('playEnabled') === true;\n\n// Simulação inicial coerente com o comportamento do CPS\nif (playEnabled && featureStatus === 'active') {\n    partCount += 1;\n    motorTemperature = Math.min(80, motorTemperature + 0.2);\n} else if (playEnabled && featureStatus === 'maintenance') {\n    motorTemperature = Math.min(75, motorTemperature + 0.05);\n} else {\n    motorTemperature = Math.max(25, motorTemperature - 0.1);\n}\n\npartCount = Math.round(partCount);\nmotorTemperature = Number(motorTemperature.toFixed(1));\n\nflow.set('cps6_partCount', partCount);\nflow.set('cps6_motorTemperature', motorTemperature);\n\nconst operationalData = {\n    PartCount: partCount,\n    MotorTemperature: motorTemperature\n};\n\nflow.set('cps6_last_operationalData', operationalData);\n\nmsg.topic = 'cps6/operationaldata';\nmsg.payload = operationalData;\nmsg.qos = 1;\nmsg.retain = true;\nreturn msg;",
    "outputs": 1,
    "timeout": "",
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 990,
    "y": 620,
    "wires": [
      [
        "cps6_aas_publish_operationaldata",
        "cps6_aas_debug_operationaldata"
      ]
    ]
  },
  {
    "id": "cps6_aas_publish_operationaldata",
    "type": "mqtt out",
    "z": "c763014928964bab",
    "name": "Publicar cps6/operationaldata",
    "topic": "",
    "qos": "",
    "retain": "",
    "respTopic": "",
    "contentType": "",
    "userProps": "",
    "correl": "",
    "expiry": "",
    "broker": "5e90268c1fac0ea4",
    "x": 1290,
    "y": 600,
    "wires": []
  },
  {
    "id": "cps6_aas_debug_operationaldata",
    "type": "debug",
    "z": "c763014928964bab",
    "name": "DEBUG OperationalData",
    "active": false,
    "tosidebar": true,
    "console": false,
    "tostatus": false,
    "complete": "payload",
    "targetType": "msg",
    "x": 1300,
    "y": 640,
    "wires": []
  }
]
```

## Preparar OperationalData (AAS)
```javascript

return msg;
```

## Preparar fim manutenção automática
```javascript
msg.payload = {
    maintenanceCompleted: true,
    origin: "automatic_timer",
    delayMs: 10000,
    ts: Date.now()
};

return msg;
```

## Retorno automático após manutenção
```javascript
const maintenanceInProgress = flow.get("maintenanceInProgress") === true;
const autoReturnAfterMaintenance = flow.get("autoReturnAfterMaintenance") === true;
const maintenanceCompleted = msg.payload?.maintenanceCompleted === true;
const maintenanceStartTs = Number(flow.get("maintenanceStartTs") || 0);

const cpsName = "BufferLine_50467";
const cpsId = "CPS-006";
const baseTopic = "cps6";

const now = Date.now();
const elapsedMs = maintenanceStartTs > 0 ? (now - maintenanceStartTs) : 0;
const MIN_MAINTENANCE_MS = 10000;

node.warn({
    step: "AUTO_RETURN_CHECK",
    maintenanceCompleted,
    maintenanceInProgress,
    autoReturnAfterMaintenance,
    elapsedMs,
    payload: msg.payload,
    flowState: {
        playEnabled: flow.get("playEnabled"),
        maintenanceInProgress: flow.get("maintenanceInProgress"),
        autoReturnAfterMaintenance: flow.get("autoReturnAfterMaintenance"),
        lastLifecycleReason: flow.get("lastLifecycleReason"),
        unplugSent: flow.get("unplugSent"),
        maintenanceStartTs
    }
});

if (!maintenanceCompleted) {
    node.status({ fill: "yellow", shape: "ring", text: "aguardando fim manutenção" });
    return null;
}

if (!maintenanceInProgress) {
    node.status({ fill: "yellow", shape: "ring", text: "sem manutenção ativa" });
    return null;
}

if (!autoReturnAfterMaintenance) {
    node.status({ fill: "yellow", shape: "dot", text: "retorno manual necessário" });
    return null;
}

if (elapsedMs < MIN_MAINTENANCE_MS) {
    node.status({ fill: "yellow", shape: "ring", text: `manutenção insuficiente: ${elapsedMs}ms` });
    return null;
}

flow.set("maintenanceInProgress", false);
flow.set("lastLifecycleReason", "maintenance_completed");
flow.set("playEnabled", true);
flow.set("autoReturnAfterMaintenance", false);
flow.set("unplugSent", false);
global.set("regra1", false);

const ts = Date.now();

const msgStatus = {
    topic: `${baseTopic}/status`,
    payload: {
        cpsId,
        cpsName,
        state: "running",
        playEnabled: true,
        healthScore: 100,
        healthLabel: "healthy",
        featureCount: 1,
        summary: "CPS returned automatically after maintenance",
        ts
    },
    qos: 1,
    retain: true
};

const msgUpdateFunctions = {
    topic: "acsm/lifecycle/update_functions",
    payload: {
        type: "update_functions",
        cpsId,
        cpsName,
        baseTopic,
        reason: "maintenance",
        summary: "Maintenance completed. CPS resumed operation autonomously.",
        maintenanceCompleted: true,
        ts,
        source: "CPS"
    },
    qos: 1,
    retain: false
};

const msgResume = {
    topic: `${baseTopic}/internal/resume_after_maintenance`,
    payload: {
        trigger: "resume_after_maintenance",
        cpsId,
        cpsName,
        baseTopic,
        ts
    }
};

node.warn({
    step: "AUTO_RETURN_PUBLISH",
    topics: [
        msgStatus.topic,
        msgUpdateFunctions.topic,
        msgResume.topic
    ]
});

node.status({ fill: "green", shape: "dot", text: "retorno automático ao PLAY" });

const msgLog = {
    _log: {
        cpsId,
        cpsName,
        baseTopic,
        level: "INFO",
        eventType: "AUTO_RETURN_AFTER_MAINTENANCE",
        sourceNode: "Retorno automático após manutenção",
        topic: msgStatus.topic,
        payload: {
            elapsedMs,
            maintenanceCompleted,
            autoReturnAfterMaintenance,
            published: {
                statusTopic: msgStatus.topic,
                updateFunctionsTopic: msgUpdateFunctions.topic,
                resumeTopic: msgResume.topic
            },
            ts
        }
    }
};

return [msgStatus, msgUpdateFunctions, msgResume, msgLog];
```

## Logar publicação MQTT
```javascript
[
  {
    "id": "log_mqtt_publish",
    "type": "function",
    "z": "",
    "name": "Logar publicação MQTT",
    "func": "const cpsId = msg.payload?.cpsId || \"CPS-006\";\nconst cpsName = msg.payload?.cpsName || \"BufferLine_50467\";\n\nconst baseTopic = msg.payload?.baseTopic || (\n    typeof msg.topic === \"string\" && msg.topic.startsWith(\"cps6/\")\n        ? \"cps6\"\n        : null\n);\n\nconst feature = msg.payload?.feature || msg.payload?.sourceFeature || null;\n\nconst plant = msg.payload?.plant || \"cps6\";\n\nconst logMsg = {\n    _log: {\n        cpsId,\n        cpsName,\n        baseTopic,\n        plant,\n        feature,\n        level: \"INFO\",\n        eventType: \"MQTT_PUBLISH\",\n        sourceNode: \"Logar publicação MQTT\",\n        topic: msg.topic || null,\n        payload: {\n            publishedTopic: msg.topic || null,\n            payload: msg.payload,\n            qos: msg.qos ?? null,\n            retain: msg.retain ?? null,\n            ts: Date.now()\n        }\n    }\n};\n\nreturn [msg, logMsg];",
    "outputs": 2,
    "timeout": 0,
    "noerr": 0,
    "initialize": "",
    "finalize": "",
    "libs": [],
    "x": 520,
    "y": 260,
    "wires": [
      [],
      []
    ]
  }
]
```

## Converter JSONL → JSON
```javascript
const lines = msg.payload
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

const result = [];

for (let line of lines) {
    try {
        result.push(JSON.parse(line));
    } catch (err) {
        // ignora linha quebrada
    }
}

msg.headers = {
    "Content-Type": "application/json",
    "Content-Disposition": "attachment; filename=cps6-log.json"
};

msg.payload = JSON.stringify(result, null, 2);

return msg;
```

## montar log
```javascript
const now = new Date();
const epoch = Date.now();

const src = msg._log || {};

const logEntry = {
    ts: now.toISOString(),
    epoch,
    cpsId: src.cpsId || "CPS-006",
    cpsName: src.cpsName || "BufferLine_50467",
    baseTopic: src.baseTopic || "cps6",
    plant: src.plant || null,
    feature: src.feature || null,
    level: src.level || "INFO",
    eventType: src.eventType || "GENERIC_EVENT",
    sourceNode: src.sourceNode || msg._sourceNode || "unknown",
    topic: src.topic || msg.topic || null,
    payload: src.payload !== undefined ? src.payload : msg.payload,
    meta: {
        retain: msg.retain ?? null,
        qos: msg.qos ?? null
    }
};

flow.set("cps6_last_log", logEntry);

msg.logLine = JSON.stringify(logEntry) + "\n";

return msg;
```

## preparar rotacao
```javascript
const baseDir = "C:\\node-red-data\\logs";
const maxBytes = 262144000; // 250 MB

let currentIndex = flow.get("cps6_log_index");
if (!currentIndex) {
    currentIndex = 1;
}

const padded = String(currentIndex).padStart(3, "0");
const filename = `${baseDir}\\cps6-log-${padded}.jsonl`;

msg._logConfig = {
    baseDir,
    maxBytes,
    currentIndex
};

msg._candidateFilename = filename;

// comando powershell em uma linha
msg.payload = `$p='${filename.replace(/\\/g, "\\\\")}'; if (Test-Path $p) { (Get-Item $p).Length } else { 0 }`;

return msg;
```

## decidir rotacao
```javascript
const cfg = msg._logConfig || {};
const maxBytes = cfg.maxBytes || 262144000;
let currentIndex = cfg.currentIndex || 1;
const baseDir = cfg.baseDir || "C:\\node-red-data\\logs";

let fileSize = Number(String(msg.payload).trim());
if (isNaN(fileSize)) {
    fileSize = 0;
}

const nextLineSize = Buffer.byteLength(msg.logLine || "", "utf8");

if ((fileSize + nextLineSize) > maxBytes) {
    currentIndex += 1;
}

flow.set("cps6_log_index", currentIndex);

const padded = String(currentIndex).padStart(3, "0");
msg.filename = `${baseDir}\\cps6-log-${padded}.jsonl`;
msg.payload = msg.logLine;

return msg;
```

## Gerar telemetria operacional CPS6
```javascript
// ======================================================================
// CPS6 - Telemetria operacional com SIMULADOR ATIVO
// ======================================================================

const playEnabled = flow.get("playEnabled") === true;
const aas = flow.get("aas_cps6_model") || {};
const live = flow.get("aas_cps6_live") || {};

const baseTopic = aas?.assetInterfaces?.BaseTopic || "cps6";
const topic = aas?.assetInterfaces?.interfaces?.data?.topic || `${baseTopic}/data`;

const sensor = live.sensorActuatorData || {};
const now = Date.now();

// --------------------------------------------------
// FORÇAR ATIVIDADE PARA TESTE (SIMULADOR)
// Altere para false se quiser voltar a usar os sensores reais
// --------------------------------------------------
const SIMULATE_ACTIVITY = true; 

const conveyorRunning = SIMULATE_ACTIVITY ? true : (Number(sensor.m_est_esq ?? 0) === 1 || Number(sensor.m_est_dir ?? 0) === 1);
const towerRunning = SIMULATE_ACTIVITY ? false : (Number(sensor.m_tor_encima ?? 0) === 1 || Number(sensor.m_tor_embaixo ?? 0) === 1);
const machineActive = conveyorRunning || towerRunning;
const anyPieceDetected = SIMULATE_ACTIVITY ? true : (Number(sensor.s_est_esquerda ?? 0) === 1 || Number(sensor.s_est_direita ?? 0) === 1);
const playBtn = SIMULATE_ACTIVITY ? true : playEnabled;

// --------------------------------------------------
// Recuperação de Estados
// --------------------------------------------------
let pieceCounter = Number(flow.get("telemetry_pieceCounter") ?? 120);
let temperature = Number(flow.get("telemetry_temperature") ?? 25.0);
let lastIncrementTs = Number(flow.get("telemetry_lastIncrementTs") ?? now);
const incrementIntervalMs = 3000;
let cycleTimeMs = 0;

// --------------------------------------------------
// Lógica de Incremento (3 Segundos)
// --------------------------------------------------
if (playBtn && machineActive) {
    const timeElapsed = now - lastIncrementTs;

    if (timeElapsed >= incrementIntervalMs) {
        pieceCounter += 1; 
        lastIncrementTs = now;
    }
    cycleTimeMs = now - lastIncrementTs;
} else {
    lastIncrementTs = now;
    cycleTimeMs = 0;
}

// --------------------------------------------------
// RPM e Torque
// --------------------------------------------------
let currentRPM = 0;
if (playBtn && conveyorRunning) {
    currentRPM = 1450 + Math.floor(Math.random() * 90);
} else if (playBtn && towerRunning) {
    currentRPM = 920 + Math.floor(Math.random() * 60);
}

let currentTorque = 0;
if (currentRPM > 0) {
    const baseTorque = conveyorRunning ? 10.5 : 7.5;
    const loadFactor = anyPieceDetected ? 1.3 : 1.0;
    currentTorque = baseTorque * loadFactor + (Math.random() * 0.8);
}

// --------------------------------------------------
// Temperatura (Inércia Térmica)
// --------------------------------------------------
const ambientTemp = 24.5;
let targetTemp = machineActive ? (conveyorRunning && towerRunning ? 40 : 35) : ambientTemp;
const thermalStep = 0.15;
temperature = temperature + ((targetTemp - temperature) * thermalStep) + (Math.random() * 0.1);

// --------------------------------------------------
// Payload e Persistência
// --------------------------------------------------
let operationMode = (playBtn && machineActive) ? "play" : (playBtn ? "idle" : "stop");

const payload = {
    CurrentTemperature: Number(temperature.toFixed(1)),
    CurrentRPM: Number(currentRPM),
    CurrentTorque: Number(currentTorque.toFixed(1)),
    PieceCounter: Number(pieceCounter),
    CycleTimeMs: Number(Math.round(cycleTimeMs)),
    OperationMode: operationMode,
    ts: now
};

// Salva no Flow para a próxima execução
flow.set("telemetry_pieceCounter", pieceCounter);
flow.set("telemetry_temperature", payload.CurrentTemperature);
flow.set("telemetry_lastIncrementTs", lastIncrementTs);

// Atualiza objeto Live (AAS)
live.operationalData = { ...(live.operationalData || {}), ...payload };
live.lastDataTs = now;
flow.set("aas_cps6_live", live);

msg.topic = topic;
msg.payload = payload;
return msg;
```

## API CPS6 Description
```javascript
const aas = flow.get('aas_cps6_model') || {};
const live = flow.get('aas_cps6_live') || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  aasId: aas?.shell?.id || '',
  aasIdShort: aas?.shell?.idShort || 'CPS6_AAS',
  description: aas?.shell?.description || '',
  manufacturer: aas?.shell?.manufacturer || '',
  assetType: aas?.shell?.assetType || '',
  serialNumber: aas?.shell?.serialNumber || '',
  globalAssetId: aas?.shell?.globalAssetId || '',
  dashboardUrl: aas?.documents?.DashboardURL || '',
  thumbnailUrl: aas?.publicUrls?.thumbnailUrl || '',
  datasheetUrl: aas?.publicUrls?.pdfUrl || '',
  scientificReportUrl: aas?.publicUrls?.scientificReportUrl || '',
  currentState: live?.status?.state || 'unknown',
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 Summary
```javascript
const aas = flow.get('aas_cps6_model') || {};
const live = flow.get('aas_cps6_live') || {};

const status = live.status || {};
const health = live.health || {};
const oee = live.oee || {};
const op = live.operationalData || {};
const feature = live.feature || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  state: status.state || 'unknown',
  playEnabled: !!status.playEnabled,
  healthScore: Number(status.healthScore ?? health.healthScore ?? 0),
  healthLabel: status.healthLabel || health.healthLabel || 'unknown',
  oee: Number(oee.oee ?? 0),
  availability: Number(oee.availability ?? 0),
  performance: Number(oee.performance ?? 0),
  quality: Number(oee.quality ?? 0),
  currentTemperature: Number(op.CurrentTemperature ?? 0),
  currentRPM: Number(op.CurrentRPM ?? 0),
  currentTorque: Number(op.CurrentTorque ?? 0),
  pieceCounter: Number(op.PieceCounter ?? 0),
  cycleTimeMs: Number(op.CycleTimeMs ?? 0),
  operationMode: op.OperationMode || 'unknown',
  featureName: feature.feature || 'runtime_feature',
  featureStatus: feature.status || 'unknown',
  currentPhase: aas?.lifecycleIntegration?.CurrentPhase || 'unknown',
  supportedPhases: aas?.lifecycleIntegration?.SupportedPhases || '',
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 Indicators
```javascript
const live = flow.get('aas_cps6_live') || {};
const oee = live.oee || {};
const health = live.health || {};
const status = live.status || {};
const op = live.operationalData || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  health: {
    score: Number(status.healthScore ?? health.healthScore ?? 0),
    label: status.healthLabel || health.healthLabel || 'unknown'
  },
  oee: {
    value: Number(oee.oee ?? 0),
    availability: Number(oee.availability ?? 0),
    performance: Number(oee.performance ?? 0),
    quality: Number(oee.quality ?? 0),
    oeePct: Number((Number(oee.oee ?? 0) * 100).toFixed(2)),
    availabilityPct: Number((Number(oee.availability ?? 0) * 100).toFixed(2)),
    performancePct: Number((Number(oee.performance ?? 0) * 100).toFixed(2)),
    qualityPct: Number((Number(oee.quality ?? 0) * 100).toFixed(2))
  },
  operational: {
    currentTemperature: Number(op.CurrentTemperature ?? 0),
    currentRPM: Number(op.CurrentRPM ?? 0),
    currentTorque: Number(op.CurrentTorque ?? 0),
    pieceCounter: Number(op.PieceCounter ?? 0),
    cycleTimeMs: Number(op.CycleTimeMs ?? 0),
    operationMode: op.OperationMode || 'unknown'
  },
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 History
```javascript
const events = flow.get('aas_cps6_events') || [];
const live = flow.get('aas_cps6_live') || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  total: events.length,
  items: events.map((line, index) => ({
    order: index + 1,
    message: line
  })),
  latestFeature: live?.feature || {},
  latestAlarm: live?.alarm || null,
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 Health
```javascript
const aas = flow.get('aas_cps6_model') || {};
const live = flow.get('aas_cps6_live') || {};
const status = live.status || {};
const health = live.health || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  healthScore: Number(status.healthScore ?? health.healthScore ?? 0),
  healthLabel: status.healthLabel || health.healthLabel || 'unknown',
  lastHeartbeat: health.lastHeartbeat || aas?.statusAndHealth?.LastHeartbeat || null,
  operationalState: aas?.statusAndHealth?.OperationalState || 'Unknown',
  availability: aas?.statusAndHealth?.Availability || 'Unknown',
  healthState: aas?.statusAndHealth?.HealthState || 'Unknown',
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 Status
```javascript
const aas = flow.get('aas_cps6_model') || {};
const live = flow.get('aas_cps6_live') || {};
const status = live.status || {};
const feature = live.feature || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  state: status.state || 'unknown',
  playEnabled: !!status.playEnabled,
  feature: feature.feature || 'runtime_feature',
  featureStatus: feature.status || 'unknown',
  currentPhase: aas?.lifecycleIntegration?.CurrentPhase || 'unknown',
  supportedPhases: aas?.lifecycleIntegration?.SupportedPhases || '',
  ts: status.ts || Date.now()
};

return msg;
```

## API CPS6 Data
```javascript
const aas = flow.get('aas_cps6_model') || {};
const live = flow.get('aas_cps6_live') || {};
const op = live.operationalData || {};
const io = live.sensorActuatorData || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  operationalData: {
    currentTemperature: Number(op.CurrentTemperature ?? 0),
    currentRPM: Number(op.CurrentRPM ?? 0),
    currentTorque: Number(op.CurrentTorque ?? 0),
    pieceCounter: Number(op.PieceCounter ?? 0),
    cycleTimeMs: Number(op.CycleTimeMs ?? 0),
    operationMode: op.OperationMode || 'unknown'
  },
  sensorActuatorData: {
    s_est_esquerda: Number(io.s_est_esquerda ?? 0),
    s_est_direita: Number(io.s_est_direita ?? 0),
    m_est_esq: Number(io.m_est_esq ?? 0),
    m_est_dir: Number(io.m_est_dir ?? 0)
  },
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 OEE
```javascript
const aas = flow.get('aas_cps6_model') || {};
const live = flow.get('aas_cps6_live') || {};
const oee = live.oee || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  availability: Number(oee.availability ?? 0),
  performance: Number(oee.performance ?? 0),
  quality: Number(oee.quality ?? 0),
  oee: Number(oee.oee ?? 0),
  availabilityPct: Number((Number(oee.availability ?? 0) * 100).toFixed(2)),
  performancePct: Number((Number(oee.performance ?? 0) * 100).toFixed(2)),
  qualityPct: Number((Number(oee.quality ?? 0) * 100).toFixed(2)),
  oeePct: Number((Number(oee.oee ?? 0) * 100).toFixed(2)),
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 Interfaces
```javascript
const aas = flow.get('aas_cps6_model') || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  primaryProtocol: aas?.assetInterfaces?.PrimaryProtocol || 'MQTT',
  brokerHost: aas?.assetInterfaces?.BrokerHost || '',
  brokerPort: Number(aas?.assetInterfaces?.BrokerPort ?? 1883),
  brokerWebSocketPort: Number(aas?.assetInterfaces?.BrokerWebSocketPort ?? 8000),
  brokerSecureWebSocketPort: Number(aas?.assetInterfaces?.BrokerSecureWebSocketPort ?? 8884),
  qosDefault: Number(aas?.assetInterfaces?.QoSDefault ?? 1),
  retainDefault: aas?.assetInterfaces?.RetainDefault || 'false',
  payloadFormat: aas?.assetInterfaces?.PayloadFormat || 'JSON',
  baseTopic: aas?.assetInterfaces?.BaseTopic || 'cps6',
  mqtt: aas?.assetInterfaces?.interfaces || {},
  rest: aas?.assetInterfaces?.restEndpoints || {},
  websocket: aas?.assetInterfaces?.webSocketInterfaces || {},
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 Lifecycle
```javascript
const aas = flow.get('aas_cps6_model') || {};
const live = flow.get('aas_cps6_live') || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  currentPhase: aas?.lifecycleIntegration?.CurrentPhase || 'unknown',
  supportedPhases: aas?.lifecycleIntegration?.SupportedPhases || '',
  currentState: live?.status?.state || 'unknown',
  playEnabled: !!live?.status?.playEnabled,
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 ACSM
```javascript
const aas = flow.get('aas_cps6_model') || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };

msg.payload = {
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  acsmAssetId: aas?.acsmIntegration?.ACSMAssetId || '',
  orchestrationRole: aas?.acsmIntegration?.OrchestrationRole || '',
  nodeRedFlowReference: aas?.acsmIntegration?.NodeRedFlowReference || '',
  aasServerReference: aas?.acsmIntegration?.AASServerReference || '',
  registryReference: aas?.acsmIntegration?.RegistryReference || '',
  dashboardUrl: aas?.acsmIntegration?.DashboardURL || aas?.documents?.DashboardURL || '',
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 Ping
```javascript
const aas = flow.get('aas_cps6_model') || {};

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };
msg.payload = {
  ok: true,
  service: 'cps6-api',
  cpsId: aas?.shell?.cpsId || 'CPS-006',
  assetName: aas?.shell?.assetName || 'BufferLine_50467',
  ts: new Date().toISOString()
};

return msg;
```

## API CPS6 Command Input
```javascript
const aas = flow.get('aas_cps6_model') || {};
const body = msg.payload || {};

const action = String(body.action || '').trim().toLowerCase();
const allowed = ['play', 'stop', 'unplug'];

if (!allowed.includes(action)) {
    msg.statusCode = 400;
    msg.headers = { 'Content-Type': 'application/json' };
    msg.payload = {
        error: 'Invalid action',
        allowed,
        received: action || null
    };
    return [null, null, msg];
}

const baseTopic = aas?.assetInterfaces?.BaseTopic || 'cps6';
const cmdTopic =
    aas?.assetInterfaces?.interfaces?.command?.topic ||
    `${baseTopic}/cmd`;

const cpsId = aas?.shell?.cpsId || 'CPS-006';
const cpsName = aas?.shell?.assetName || 'BufferLine_50467';

const nowEpoch = Date.now();
const nowIso = new Date(nowEpoch).toISOString();

const commandPayload = {
    action,
    cpsId,
    cpsName,
    ts: nowEpoch,
    source: 'REST'
};

// Atualiza também o log curto em memória
const ev = flow.get('aas_cps6_events') || [];
ev.unshift(`${new Date().toLocaleString('pt-PT')} | Comando REST enviado: ${action}`);
if (ev.length > 15) ev.pop();
flow.set('aas_cps6_events', ev);

// Evento persistente em JSONL
const persistedEvent = {
    ts: nowIso,
    epoch: nowEpoch,
    cpsId,
    cpsName,
    baseTopic,
    topic: cmdTopic,
    eventType: 'COMMAND',
    summary: `Command published via REST: ${action}`,
    payload: commandPayload
};

// Saída 1: MQTT
const mqttMsg = {
    topic: cmdTopic,
    payload: commandPayload,
    qos: 1,
    retain: false
};

// Saída 2: FILE append (.jsonl)
const fileMsg = {
    payload: JSON.stringify(persistedEvent)
};

// Saída 3: HTTP response
const httpMsg = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    payload: {
        ok: true,
        topic: cmdTopic,
        command: commandPayload,
        persisted: true
    }
};

return [mqttMsg, fileMsg, httpMsg];
```

## Normalizar evento persistente CPS6
```javascript
let payload = msg.payload;
const topic = String(msg.topic || '').trim();

if (typeof payload === 'string') {
    try {
        payload = JSON.parse(payload);
    } catch (e) {
        payload = { raw: msg.payload };
    }
}

const aas = flow.get('aas_cps6_model') || {};
const baseTopic = aas?.assetInterfaces?.BaseTopic || 'cps6';
const cpsId = aas?.shell?.cpsId || 'CPS-006';
const cpsName = aas?.shell?.assetName || 'BufferLine_50467';

function buildEvent(eventType, summary) {
    return {
        ts: new Date().toISOString(),
        epoch: Date.now(),
        cpsId,
        cpsName,
        baseTopic,
        topic,
        eventType,
        summary,
        payload
    };
}

let event = null;

if (topic === `${baseTopic}/status`) {
    const state = payload?.state || payload?.status || 'unknown';
    event = buildEvent('STATUS_UPDATE', `Global state changed to ${state}`);
}
else if (topic === `${baseTopic}/health`) {
    const label = payload?.healthLabel || 'unknown';
    const score = payload?.healthScore ?? 'n/a';
    event = buildEvent('HEALTH_UPDATE', `Health updated to ${label} (${score})`);
}
else if (topic === `${baseTopic}/oee`) {
    const oee = payload?.oee ?? 'n/a';
    event = buildEvent('OEE_UPDATE', `OEE updated to ${oee}`);
}
else if (topic === `${baseTopic}/data`) {
    const temp = payload?.CurrentTemperature ?? payload?.temperature ?? 'n/a';
    const counter = payload?.PieceCounter ?? payload?.pieceCounter ?? 'n/a';
    event = buildEvent('DATA_UPDATE', `Operational data updated (temp=${temp}, count=${counter})`);
}
else if (topic === `${baseTopic}/alarm`) {
    const severity = payload?.severity || 'unknown';
    event = buildEvent('ALARM', `Alarm received with severity ${severity}`);
}
else if (topic === `${baseTopic}/ack`) {
    const action = payload?.action || 'unknown';
    event = buildEvent('ACK', `Acknowledgement received for action ${action}`);
}
else if (topic.startsWith(`${baseTopic}/`) && topic.endsWith('/$state')) {
    const feature = payload?.feature || 'runtime_feature';
    const status = payload?.status || 'unknown';
    event = buildEvent('FEATURE_STATE', `Feature ${feature} changed to ${status}`);
}
else if (topic === `${baseTopic}/cmd`) {
    // evita duplicar comandos enviados pelo endpoint REST,
    // pois eles já são persistidos no fluxo POST /api/cps6/cmd
    if (String(payload?.source || '').toUpperCase() === 'REST') {
        return null;
    }
    const action = payload?.action || 'unknown';
    event = buildEvent('COMMAND', `Command published: ${action}`);
}

if (!event) {
    return null;
}

msg.payload = JSON.stringify(event);
return msg;
```

## Preparar leitura resumo histórico
```javascript
msg.filename = 'C:\\cps6-logs\\cps6-events.jsonl';
return msg;
```

## Resumo histórico CPS6
```javascript
if (msg.error) {
    msg.statusCode = 200;
    msg.headers = { 'Content-Type': 'application/json' };
    msg.payload = {
        totalEvents: 0,
        byType: {},
        latestEvent: null,
        ts: new Date().toISOString()
    };
    return msg;
}

const raw = String(msg.payload || '').trim();

let items = [];
if (raw) {
    items = raw
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);
}

const byType = {};
for (const item of items) {
    const t = item.eventType || 'UNKNOWN';
    byType[t] = (byType[t] || 0) + 1;
}

const latest = [...items].sort((a, b) => Number(b.epoch || 0) - Number(a.epoch || 0))[0] || null;

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };
msg.payload = {
    totalEvents: items.length,
    byType,
    latestEvent: latest,
    ts: new Date().toISOString()
};

return msg;
```

## Preparar leitura histórico CPS6
```javascript
msg.filename = 'C:\\cps6-logs\\cps6-events.jsonl';
return msg;
```

## Montar resposta histórico CPS6
```javascript
if (msg.error) {
    msg.statusCode = 200;
    msg.headers = { 'Content-Type': 'application/json' };
    msg.payload = {
        total: 0,
        items: [],
        ts: new Date().toISOString(),
        readError: String(msg.error.message || msg.error)
    };
    return msg;
}

const raw = String(msg.payload || '').trim();

let items = [];
if (raw) {
    items = raw
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean)
        .sort((a, b) => Number(b.epoch || 0) - Number(a.epoch || 0));
}

msg.statusCode = 200;
msg.headers = { 'Content-Type': 'application/json' };
msg.payload = {
    total: items.length,
    items: items.slice(0, 200),
    ts: new Date().toISOString()
};

return msg;
```

## Preparar leitura logs rotativos (export)
```javascript
const logsDir = 'C:\\node-red-data\\logs';
const pattern = 'cps6-log-*.jsonl';

msg.command = `powershell.exe -NoProfile -Command "if (Get-ChildItem -Path '${logsDir}\\${pattern}' -ErrorAction SilentlyContinue) { Get-ChildItem -Path '${logsDir}\\${pattern}' | Sort-Object Name | ForEach-Object { Get-Content $_.FullName } } elseif (Test-Path '${logsDir}\\cps6-log.jsonl') { Get-Content '${logsDir}\\cps6-log.jsonl' } else { Write-Output '' }"`;
return msg;
```

## Converter JSONL → JSON
```javascript
const lines = String(msg.payload || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

const result = [];

for (let line of lines) {
    try {
        result.push(JSON.parse(line));
    } catch (err) {
        // ignora linha quebrada
    }
}

msg.headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="cps6-log.json"'
};

msg.payload = JSON.stringify(result, null, 2);
return msg;
```

## Preparar leitura logs rotativos (export)
```javascript
const logsDir = 'C:\\node-red-data\\logs';
const pattern = 'cps6-log-*.jsonl';

msg.command = `powershell.exe -NoProfile -Command "if (Get-ChildItem -Path '${logsDir}\\${pattern}' -ErrorAction SilentlyContinue) { Get-ChildItem -Path '${logsDir}\\${pattern}' | Sort-Object Name | ForEach-Object { Get-Content $_.FullName } } elseif (Test-Path '${logsDir}\\cps6-log.jsonl') { Get-Content '${logsDir}\\cps6-log.jsonl' } else { Write-Output '' }"`;
return msg;
```

## Converter JSONL → JSON
```javascript
const lines = String(msg.payload || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

const result = [];

for (let line of lines) {
    try {
        result.push(JSON.parse(line));
    } catch (err) {
        // ignora linha quebrada
    }
}

msg.headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="cps6-log.json"'
};

msg.payload = JSON.stringify(result, null, 2);
return msg;
```

## Preparar leitura HTML científico
```javascript
msg.filename = 'C:\\cps6-logs\\cps6-events.jsonl';
return msg;
```

## Montar HTML científico CPS6
```javascript
function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(ts) {
    if (!ts) return '—';
    try {
        return new Date(ts).toLocaleString('pt-PT');
    } catch (e) {
        return String(ts);
    }
}

if (msg.error) {
    msg.headers = { 'Content-Type': 'text/html; charset=utf-8' };
    msg.payload = `<html><body style="font-family:Arial;padding:40px;"><h1>Erro ao gerar relatório científico</h1><p>Não foi possível ler o histórico persistido do CPS-7.</p><pre>${escapeHtml(msg.error.message || msg.error)}</pre></body></html>`;
    return msg;
}

const raw = String(msg.payload || '').trim();
let items = [];
if (raw) {
    items = raw.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(Boolean).sort((a,b) => Number(a.epoch || 0) - Number(b.epoch || 0));
}

const totalEvents = items.length;
const byType = {};
for (const item of items) {
    const t = item.eventType || 'UNKNOWN';
    byType[t] = (byType[t] || 0) + 1;
}

const firstEvent = items[0] || null;
const lastEvent = items[items.length - 1] || null;
const cpsId = firstEvent?.cpsId || 'CPS-006';
const cpsName = firstEvent?.cpsName || 'BufferLine_50467';
const baseTopic = firstEvent?.baseTopic || 'cps6';

const statusEvents = items.filter(e => e.eventType === 'STATUS_UPDATE');
const healthEvents = items.filter(e => e.eventType === 'HEALTH_UPDATE');
const oeeEvents = items.filter(e => e.eventType === 'OEE_UPDATE');
const dataEvents = items.filter(e => e.eventType === 'DATA_UPDATE');
const alarmEvents = items.filter(e => e.eventType === 'ALARM');
const featureEvents = items.filter(e => e.eventType === 'FEATURE_STATE');
const commandEvents = items.filter(e => e.eventType === 'COMMAND');
const ackEvents = items.filter(e => e.eventType === 'ACK');

const latestStatus = statusEvents[statusEvents.length - 1] || null;
const latestHealth = healthEvents[healthEvents.length - 1] || null;
const latestOee = oeeEvents[oeeEvents.length - 1] || null;
const latestData = dataEvents[dataEvents.length - 1] || null;

const latestState = latestStatus?.payload?.state || latestStatus?.payload?.status || 'unknown';
const latestHealthScore = latestHealth?.payload?.healthScore ?? latestStatus?.payload?.healthScore ?? '—';
const latestHealthLabel = latestHealth?.payload?.healthLabel || latestStatus?.payload?.healthLabel || 'unknown';
const latestOeeValue = latestOee?.payload?.oee;
const latestOeePct = Number.isFinite(Number(latestOeeValue)) ? `${(Number(latestOeeValue) * 100).toFixed(2)}%` : '—';
const latestTemp = latestData?.payload?.CurrentTemperature ?? latestData?.payload?.temperature ?? '—';
const latestCounter = latestData?.payload?.PieceCounter ?? latestData?.payload?.pieceCounter ?? '—';

const typeRows = Object.entries(byType).sort((a,b) => b[1]-a[1]).map(([type,count]) => `
<tr><td>${escapeHtml(type)}</td><td style="text-align:right;">${count}</td></tr>`).join('');

const timelineRows = items.slice(-40).reverse().map((item, idx) => `
<tr>
<td>${idx + 1}</td>
<td>${escapeHtml(formatDate(item.ts))}</td>
<td>${escapeHtml(item.eventType || 'UNKNOWN')}</td>
<td>${escapeHtml(item.topic || '')}</td>
<td>${escapeHtml(item.summary || '')}</td>
</tr>`).join('');

msg.headers = { 'Content-Type': 'text/html; charset=utf-8' };
msg.payload = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>Relatório Científico CPS-7</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:0;background:#fff;}
.page{padding:40px;}
.cover{background:linear-gradient(135deg,#0f3d91,#1976d2);color:#fff;padding:48px 40px;}
h1,h2,h3{margin:0 0 12px 0;}
.card{border:1px solid #dbe3ea;border-radius:14px;padding:18px;margin-top:18px;background:#fff;}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.kpi{border:1px solid #dbe3ea;border-radius:14px;padding:16px;background:#f8fafc;}
.kpi .label{font-size:12px;color:#607d8b;text-transform:uppercase;}
.kpi .value{font-size:24px;font-weight:700;margin-top:8px;}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;}
th,td{border:1px solid #dbe3ea;padding:8px 10px;vertical-align:top;}
th{background:#f1f5f9;text-align:left;}
.section-title{font-size:12px;letter-spacing:.6px;color:#607d8b;text-transform:uppercase;margin-bottom:8px;}
.paragraph{line-height:1.7;}
</style>
</head>
<body>
<div class="cover">
<div style="font-size:13px;opacity:.9;letter-spacing:.7px;text-transform:uppercase;">Relatório científico do experimento</div>
<h1>CPS-7 · Histórico Persistido</h1>
<div style="margin-top:10px;font-size:16px;">
<b>CPS ID:</b> ${escapeHtml(cpsId)}<br/>
<b>Ativo:</b> ${escapeHtml(cpsName)}<br/>
<b>Base Topic:</b> ${escapeHtml(baseTopic)}<br/>
<b>Data de geração:</b> ${escapeHtml(formatDate(new Date().toISOString()))}
</div>
</div>
<div class="page">
<div class="card">
<div class="section-title">Resumo executivo</div>
<div class="paragraph">Este relatório consolida os eventos persistidos do CPS-7 para análise técnico-científica, com foco em rastreabilidade temporal, governança operacional, evidências de execução do ciclo de vida e comportamento observado durante o experimento.</div>
</div>
<div class="grid2">
<div class="kpi"><div class="label">Total de eventos</div><div class="value">${totalEvents}</div></div>
<div class="kpi"><div class="label">Estado final</div><div class="value">${escapeHtml(latestState)}</div></div>
<div class="kpi"><div class="label">Health final</div><div class="value">${escapeHtml(String(latestHealthScore))} (${escapeHtml(latestHealthLabel)})</div></div>
<div class="kpi"><div class="label">OEE final</div><div class="value">${escapeHtml(latestOeePct)}</div></div>
<div class="kpi"><div class="label">Temperatura final</div><div class="value">${escapeHtml(String(latestTemp))}</div></div>
<div class="kpi"><div class="label">Contador final</div><div class="value">${escapeHtml(String(latestCounter))}</div></div>
</div>
<div class="card">
<div class="section-title">Metadados do período analisado</div>
<div class="paragraph">
<b>Primeiro evento:</b> ${escapeHtml(firstEvent ? formatDate(firstEvent.ts) : '—')}<br/>
<b>Último evento:</b> ${escapeHtml(lastEvent ? formatDate(lastEvent.ts) : '—')}<br/>
<b>Comandos:</b> ${commandEvents.length}<br/>
<b>ACKs:</b> ${ackEvents.length}<br/>
<b>Alarmes:</b> ${alarmEvents.length}<br/>
<b>Transições de funcionalidade:</b> ${featureEvents.length}
</div>
</div>
<div class="card">
<div class="section-title">Distribuição por tipo de evento</div>
<table>
<thead><tr><th>Tipo</th><th>Quantidade</th></tr></thead>
<tbody>${typeRows || '<tr><td colspan="2">Sem dados</td></tr>'}</tbody>
</table>
</div>
<div class="card">
<div class="section-title">Linha do tempo recente</div>
<table>
<thead><tr><th>#</th><th>Data/Hora</th><th>Tipo</th><th>Tópico</th><th>Resumo</th></tr></thead>
<tbody>${timelineRows || '<tr><td colspan="5">Sem dados</td></tr>'}</tbody>
</table>
</div>
</div>
</body>
</html>`;
return msg;
```

## Preparar geração PDF
```javascript
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const pdfDir = 'C:\\cps6-logs';
const pdfPath = `${pdfDir}\\cps6-scientific-report-${ts}.pdf`;
const url = 'http://127.0.0.1:1880/api/cps6/report/scientific';

// ajuste aqui conforme o Edge da sua máquina
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

msg.pdfPath = pdfPath;
msg.url = url;
msg.command = `cmd /c if not exist "${pdfDir}" mkdir "${pdfDir}" && "${edgePath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${url}"`;

return msg;
```

## Definir arquivo PDF
```javascript
msg.filename = msg.pdfPath;
return msg;
```

## Preparar download PDF
```javascript
if (msg.error) {
    msg.statusCode = 500;
    msg.headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    msg.payload = `Falha ao ler PDF gerado: ${msg.error.message || msg.error}`;
    return msg;
}

msg.headers = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="cps6-scientific-report.pdf"'
};
return msg;
```

## Definir arquivo JSON
```javascript
msg.filename = 'C:\\cps6-logs\\cps6-events.jsonl';
return msg;
```

## Preparar download JSON
```javascript
if (msg.error) {
    msg.statusCode = 500;
    msg.headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    msg.payload = `Falha ao ler log JSON: ${msg.error.message || msg.error}`;
    return msg;
}

msg.headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="cps6-events.jsonl"'
};
return msg;
```

## Montar HTML estático CPS6
```javascript
msg.headers = { 'Content-Type': 'text/html; charset=utf-8' };
msg.payload = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>CPS-7 Dashboard</title>
<style>
body { font-family: Arial; background: #f4f6f9; margin: 0; }
.header { background: #0f3d91; color: white; padding: 20px; }
.container { padding: 20px; max-width: 1000px; margin: auto; }
.grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
.card { background: white; padding: 14px; border-radius: 8px; box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
.card h3 { font-size: 12px; color: #777; margin: 0; }
.card b { font-size: 20px; }
.buttons { margin-top: 15px; display: flex; gap: 10px; }
.btn { flex:1; padding: 10px; text-align:center; color:white; text-decoration:none; border-radius:6px; }
.json { background:#1f6fbf; }
.pdf { background:#8e24aa; }
.timeline { margin-top:20px; }
.timeline-item { background:white; padding:10px; margin-bottom:8px; border-left:4px solid #1976d2; border-radius:6px; }
img { max-width:200px; margin-top:10px; }
@media (max-width: 900px) { .grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 520px) { .grid { grid-template-columns: 1fr; } .buttons { flex-direction: column; } }
</style>
</head>
<body>
<div class="header">
  <h1>CPS-7 · BufferLine_50467</h1>
</div>
<div class="container">
  <img src="/img/50464_Stan.png" onerror="this.style.display='none'" />

  <div class="grid">
    <div class="card"><h3>CPS ID</h3><b>CPS-006</b></div>
    <div class="card"><h3>Estado</h3><b id="state">--</b></div>
    <div class="card"><h3>Health</h3><b id="health">--</b></div>
    <div class="card"><h3>OEE</h3><b id="oee">--</b></div>
  </div>

  <div class="grid" style="margin-top:10px;">
    <div class="card"><h3>Temperatura</h3><b id="temp">--</b></div>
    <div class="card"><h3>Peças</h3><b id="counter">--</b></div>
    <div class="card"><h3>Broker</h3><b>MQTT</b></div>
    <div class="card"><h3>Ativo</h3><b>Transportband</b></div>
  </div>

  <div class="buttons">
    <a class="btn json" href="/api/cps6/log/json" target="_blank">JSON</a>
    <a class="btn pdf" href="/api/cps6/report/scientific/pdf" target="_blank">PDF</a>
  </div>

  <div class="timeline">
    <h3>Últimos eventos</h3>
    <div id="timeline"></div>
  </div>
</div>

<script>
async function loadSummary() {
  try {
    const res = await fetch('/api/cps6/report/scientific');
    const html = await res.text();

    function get(label) {
      const r = new RegExp('<div class="label">' + label + '<\\/div><div class="value">([^<]+)<\\/div>', 'i');
      const m = html.match(r);
      return m ? m[1].trim() : '--';
    }

    document.getElementById('state').innerText = get('Estado final');
    document.getElementById('health').innerText = get('Health final');
    document.getElementById('oee').innerText = get('OEE final');
    document.getElementById('temp').innerText = get('Temperatura final');
    document.getElementById('counter').innerText = get('Contador final');
  } catch (e) {
    console.log(e);
  }
}

async function loadTimeline() {
  try {
    const res = await fetch('/api/cps6/timeline/recent');
    const data = await res.json();
    const div = document.getElementById('timeline');
    div.innerHTML = '';

    (data.items || []).forEach(e => {
      div.innerHTML += '<div class="timeline-item"><b>' + (e.eventType || '--') + '</b><br>' + (e.summary || '--') + '</div>';
    });
  } catch (e) {
    console.log(e);
  }
}

loadSummary();
loadTimeline();
setInterval(loadTimeline, 5000);
</script>
</body>
</html>`;
return msg;
```

## Definir arquivo datasheet PDF
```javascript
msg.filename = 'C:\\cps6-logs\\cps6-datasheet.pdf';
return msg;
```

## Preparar resposta datasheet PDF
```javascript
if (msg.error) {
    msg.statusCode = 500;
    msg.headers = { 'Content-Type': 'text/plain; charset=utf-8' };
    msg.payload = `Falha ao ler datasheet PDF: ${msg.error.message || msg.error}`;
    return msg;
}

msg.headers = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="cps6-datasheet.pdf"'
};
return msg;
```

## definir topicos MQTT
```javascript
// 1. Pegamos o payload que veio da função anterior (já montado para o ACSM)
const fullPayload = msg.payload;

// 2. Definimos o ID do CPS (buscando do payload ou fixo)
const cpsId = fullPayload.cpsId || "cps6";

// 3. RECONFIGURAMOS O OBJETO MSG ORIGINAL
// No Node-RED, msg.topic na raiz é o que define o destino no MQTT Out
msg.topic = `${cpsId}/learning`;

// O payload deve ser uma string ou um objeto que o MQTT Out saiba converter para JSON
msg.payload = fullPayload;

// 4. Limpeza de segurança (evita conflitos de propriedades de mensagens anteriores)
delete msg.qos;
delete msg.retain;

return msg;


```

## persistir historico localmente em historico resumido
```javascript
let insights = flow.get('learningInsights') || [];

insights.push({
    ts: msg.payload.ts,
    cpsId: msg.payload.cpsId,
    oee: msg.payload.oee.current,
    availability: msg.payload.oee.availability,
    performance: msg.payload.oee.performance,
    quality: msg.payload.oee.quality,
    dominantLossNow: msg.payload.reasoning.dominantLossNow,
    dominantLossForecast: msg.payload.reasoning.dominantLossForecast,
    learningState: msg.payload.learning.state,
    learningPattern: msg.payload.learning.pattern,
    riskLevel: msg.payload.reasoning.riskLevel,
    confidence: msg.payload.learning.confidence,
    driftScore: msg.payload.learning.driftScore,
    anomalyScore: msg.payload.learning.anomalyScore
});

if (insights.length > 500) {
    insights = insights.slice(-500);
}

flow.set('learningInsights', insights);

return msg;
```

## Local Times-Series Features
```javascript
// ============================================================
// CPS6 - Local Time-Series Features
// Entrada esperada: payload do node "calcular OEE CPS"
// Saída: acrescenta msg.payload.timeSeriesFeatures
// ============================================================

const p = msg.payload || {};
const now = Number(p.ts || Date.now());

// -----------------------------
// Configuração
// -----------------------------
const HISTORY_SIZE = 20;   // janela curta local
const MIN_POINTS = 5;      // mínimo para estatísticas úteis

// -----------------------------
// Helpers
// -----------------------------
function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function round(v, d = 4) {
    if (!Number.isFinite(v)) return null;
    return Number(v.toFixed(d));
}

function mean(arr) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function min(arr) {
    return arr.length ? Math.min(...arr) : null;
}

function max(arr) {
    return arr.length ? Math.max(...arr) : null;
}

function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    const variance = mean(arr.map(v => Math.pow(v - m, 2)));
    return Math.sqrt(variance);
}

function pctDelta(current, baseline) {
    if (!Number.isFinite(current) || !Number.isFinite(baseline)) return null;
    if (baseline === 0) return null;
    return ((current - baseline) / Math.abs(baseline));
}

function simpleSlope(values) {
    if (values.length < 2) return 0;
    const first = values[0];
    const last = values[values.length - 1];
    const steps = values.length - 1;
    if (steps <= 0) return 0;
    return (last - first) / steps;
}

function lastN(arr, n) {
    return arr.slice(Math.max(0, arr.length - n));
}

function summarizeSeries(current, arr) {
    const arrValid = arr.filter(v => Number.isFinite(v));
    if (!arrValid.length) {
        return {
            current: round(current),
            mean: null,
            median: null,
            min: null,
            max: null,
            stddev: null,
            deltaPctVsMedian: null,
            slope: null
        };
    }

    const med = median(arrValid);
    return {
        current: round(current),
        mean: round(mean(arrValid)),
        median: round(med),
        min: round(min(arrValid)),
        max: round(max(arrValid)),
        stddev: round(stddev(arrValid)),
        deltaPctVsMedian: round(pctDelta(current, med)),
        slope: round(simpleSlope(arrValid))
    };
}

// -----------------------------
// Leitura do ponto atual
// -----------------------------
const point = {
    ts: now,
    oee: num(p.oee, NaN),
    availability: num(p.availability, NaN),
    performance: num(p.performanceAccumulated ?? p.performance, NaN),
    performanceDisplay: num(p.performance, NaN),
    quality: num(p.quality, NaN),
    temperature: num(p.telemetry?.currentTemperature, NaN),
    rpm: num(p.telemetry?.currentRPM, NaN),
    torque: num(p.telemetry?.currentTorque, NaN),
    cycleTimeMs: num(p.telemetry?.cycleTimeMs, NaN),
    featureStatus: String(p.process?.featureStatus || "").toLowerCase().trim(),
    playEnabled: !!p.process?.playEnabled
};

// -----------------------------
// Histórico
// -----------------------------
let history = flow.get("cps6_ts_history") || [];
history.push(point);
history = lastN(history, HISTORY_SIZE);
flow.set("cps6_ts_history", history);

// Se ainda não há pontos suficientes
if (history.length < MIN_POINTS) {
    msg.payload.timeSeriesFeatures = {
        historySize: history.length,
        minPointsRequired: MIN_POINTS,
        ready: false,
        note: "Not enough history yet for robust temporal features."
    };
    return msg;
}

// -----------------------------
// Séries separadas
// -----------------------------
const oeeSeries = history.map(x => x.oee).filter(Number.isFinite);
const availabilitySeries = history.map(x => x.availability).filter(Number.isFinite);
const performanceSeries = history.map(x => x.performance).filter(Number.isFinite);
const qualitySeries = history.map(x => x.quality).filter(Number.isFinite);
const tempSeries = history.map(x => x.temperature).filter(Number.isFinite);
const rpmSeries = history.map(x => x.rpm).filter(Number.isFinite);
const torqueSeries = history.map(x => x.torque).filter(Number.isFinite);
const cycleSeries = history.map(x => x.cycleTimeMs).filter(Number.isFinite);

// -----------------------------
// Features
// -----------------------------
const features = {
    historySize: history.length,
    window: `last_${history.length}_points`,
    ready: true,

    oee: summarizeSeries(point.oee, oeeSeries),
    availability: summarizeSeries(point.availability, availabilitySeries),
    performance: summarizeSeries(point.performance, performanceSeries),
    quality: summarizeSeries(point.quality, qualitySeries),

    temperature: summarizeSeries(point.temperature, tempSeries),
    rpm: summarizeSeries(point.rpm, rpmSeries),
    torque: summarizeSeries(point.torque, torqueSeries),
    cycleTimeMs: summarizeSeries(point.cycleTimeMs, cycleSeries),

    correlationsHint: {
        lowRpmHighCycle:
            round(
                (point.rpm < (median(rpmSeries) ?? point.rpm) * 0.9 &&
                    point.cycleTimeMs > (median(cycleSeries) ?? point.cycleTimeMs) * 1.1) ? 1 : 0,
                0
            ),
        highTempLowOee:
            round(
                (point.temperature > (median(tempSeries) ?? point.temperature) * 1.05 &&
                    point.oee < (median(oeeSeries) ?? point.oee) * 0.95) ? 1 : 0,
                0
            ),
        highTorqueQualityRisk:
            round(
                (point.torque > (median(torqueSeries) ?? point.torque) * 1.1 &&
                    point.quality < (median(qualitySeries) ?? point.quality) * 0.98) ? 1 : 0,
                0
            )
    }
};

// -----------------------------
// Atalhos úteis para o learning
// -----------------------------
features.quickSignals = {
    oeeDeltaPct: features.oee.deltaPctVsMedian,
    availabilityDeltaPct: features.availability.deltaPctVsMedian,
    performanceDeltaPct: features.performance.deltaPctVsMedian,
    qualityDeltaPct: features.quality.deltaPctVsMedian,
    tempDeltaPct: features.temperature.deltaPctVsMedian,
    rpmDeltaPct: features.rpm.deltaPctVsMedian,
    torqueDeltaPct: features.torque.deltaPctVsMedian,
    cycleDeltaPct: features.cycleTimeMs.deltaPctVsMedian,

    oeeSlope: features.oee.slope,
    tempSlope: features.temperature.slope,
    rpmSlope: features.rpm.slope,
    torqueSlope: features.torque.slope,
    cycleSlope: features.cycleTimeMs.slope
};

// -----------------------------
// Persistência auxiliar
// -----------------------------
flow.set("cps6_last_timeSeriesFeatures", features);

// Acrescenta ao payload atual
msg.payload.timeSeriesFeatures = features;

return msg;
```

## Local Learning CPS6
```javascript
// ============================================================
// CPS6 - Local Learning CPS6
// Entrada esperada:
//   msg.payload.timeSeriesFeatures
//   msg.payload (OEE + telemetria atual)
// Saída:
//   msg.payload.learning
// ============================================================

const p = msg.payload || {};
const tsf = p.timeSeriesFeatures || {};
const qs = tsf.quickSignals || {};

function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function round(v, d = 4) {
    if (!Number.isFinite(v)) return null;
    return Number(v.toFixed(d));
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function pushEvidence(arr, text) {
    if (text && !arr.includes(text)) arr.push(text);
}

const ready = tsf.ready === true;

// --------------------------------------------------
// Caso ainda não haja histórico suficiente
// --------------------------------------------------
if (!ready) {
    const learning = {
        model: "local_temporal_learning_v2",
        type: "baseline_warmup",
        state: "warming_up",
        pattern: "insufficient_history",
        driftScore: 0,
        anomalyScore: 0,
        confidence: 0.25,
        forecastOEE: [],
        evidence: [
            "Temporal window not ready yet.",
            `History size: ${num(tsf.historySize, 0)}`
        ],
        recommendation: "Continue collecting local history before stronger temporal inference."
    };

    flow.set("cps6_last_learning", learning);
    msg.payload.learning = learning;
    return msg;
}

// --------------------------------------------------
// Leitura dos sinais rápidos
// --------------------------------------------------
const oeeDeltaPct = num(qs.oeeDeltaPct, 0);
const availabilityDeltaPct = num(qs.availabilityDeltaPct, 0);
const performanceDeltaPct = num(qs.performanceDeltaPct, 0);
const qualityDeltaPct = num(qs.qualityDeltaPct, 0);

const tempDeltaPct = num(qs.tempDeltaPct, 0);
const rpmDeltaPct = num(qs.rpmDeltaPct, 0);
const torqueDeltaPct = num(qs.torqueDeltaPct, 0);
const cycleDeltaPct = num(qs.cycleDeltaPct, 0);

const oeeSlope = num(qs.oeeSlope, 0);
const tempSlope = num(qs.tempSlope, 0);
const rpmSlope = num(qs.rpmSlope, 0);
const torqueSlope = num(qs.torqueSlope, 0);
const cycleSlope = num(qs.cycleSlope, 0);

const featureStatus = String(p.process?.featureStatus || "").toLowerCase().trim();
const playEnabled = !!p.process?.playEnabled;

const currentOEE = num(p.oee, 0);
const currentAvailability = num(p.availability, 0);
const currentPerformance = num(p.performanceAccumulated ?? p.performance, 0);
const currentQuality = num(p.quality, 1);

// hints de correlação
const hints = tsf.correlationsHint || {};
const lowRpmHighCycle = num(hints.lowRpmHighCycle, 0) === 1;
const highTempLowOee = num(hints.highTempLowOee, 0) === 1;
const highTorqueQualityRisk = num(hints.highTorqueQualityRisk, 0) === 1;

// --------------------------------------------------
// Scores
// --------------------------------------------------
let driftScore = 0;
let anomalyScore = 0;
let evidence = [];
let recommendation = "Maintain monitoring.";
let pattern = "normal_operation";
let state = "stable";

// Drift score: mistura desvios percentuais relevantes
driftScore += Math.abs(oeeDeltaPct) * 0.30;
driftScore += Math.abs(cycleDeltaPct) * 0.20;
driftScore += Math.abs(tempDeltaPct) * 0.15;
driftScore += Math.abs(rpmDeltaPct) * 0.15;
driftScore += Math.abs(torqueDeltaPct) * 0.10;
driftScore += Math.abs(availabilityDeltaPct) * 0.10;

// Anomaly score: heurístico baseado em combinações perigosas
if (cycleDeltaPct > 0.15) anomalyScore += 0.20;
if (tempDeltaPct > 0.10) anomalyScore += 0.15;
if (rpmDeltaPct < -0.10) anomalyScore += 0.15;
if (torqueDeltaPct > 0.10) anomalyScore += 0.10;
if (oeeDeltaPct < -0.10) anomalyScore += 0.20;
if (availabilityDeltaPct < -0.10) anomalyScore += 0.20;

if (lowRpmHighCycle) anomalyScore += 0.10;
if (highTempLowOee) anomalyScore += 0.10;
if (highTorqueQualityRisk) anomalyScore += 0.10;

if (featureStatus === "maintenance") anomalyScore += 0.10;
if (featureStatus === "awaiting_replacement") anomalyScore += 0.25;
if (featureStatus === "failure") anomalyScore += 0.35;

driftScore = clamp(driftScore, 0, 1);
anomalyScore = clamp(anomalyScore, 0, 1);

// --------------------------------------------------
// Reconhecimento de padrões
// --------------------------------------------------

// 1) perda de performance por ciclo alto
if (cycleDeltaPct > 0.15 && oeeDeltaPct < -0.08) {
    pattern = "performance_degradation";
    state = "degrading";
    pushEvidence(evidence, "Cycle time above local baseline.");
    pushEvidence(evidence, "OEE below local baseline.");
    recommendation = "Inspect speed losses, microstops, and process flow.";
}

// 2) perda por rotação baixa
if (rpmDeltaPct < -0.10 && cycleDeltaPct > 0.10) {
    pattern = "speed_loss";
    state = "degrading";
    pushEvidence(evidence, "RPM below local baseline.");
    pushEvidence(evidence, "Cycle time above local baseline.");
    recommendation = "Inspect conveyor speed, loading condition, and motion consistency.";
}

// 3) degradação térmica
if (tempDeltaPct > 0.10 && oeeDeltaPct < -0.08) {
    pattern = "thermal_degradation";
    state = "degrading";
    pushEvidence(evidence, "Temperature above local baseline.");
    pushEvidence(evidence, "OEE below local baseline.");
    recommendation = "Inspect thermal load, friction sources, and maintenance condition.";
}

// 4) risco de qualidade
if (torqueDeltaPct > 0.10 && qualityDeltaPct < -0.02) {
    pattern = "quality_risk";
    state = "degrading";
    pushEvidence(evidence, "Torque above local baseline.");
    pushEvidence(evidence, "Quality below local baseline.");
    recommendation = "Inspect process stability and quality-related mechanical stress.";
}

// 5) perda de disponibilidade
if (availabilityDeltaPct < -0.10) {
    pattern = "availability_loss";
    state = "degrading";
    pushEvidence(evidence, "Availability below local baseline.");
    recommendation = "Inspect downtime causes, maintenance status, and replacement triggers.";
}

// 6) condição crítica explícita
if (
    featureStatus === "awaiting_replacement" ||
    featureStatus === "failure" ||
    currentOEE < 0.45 ||
    anomalyScore > 0.70
) {
    pattern = "critical_operational_degradation";
    state = "critical";
    pushEvidence(evidence, "Critical feature state or strong anomaly evidence detected.");
    recommendation = "Prioritize intervention and inspect CPS6 immediately.";
}

// 7) recuperação
if (
    oeeSlope > 0.01 &&
    cycleSlope < 0 &&
    tempSlope <= 0 &&
    currentOEE > 0.70 &&
    featureStatus === "active"
) {
    pattern = "recovering_operation";
    state = "recovering";
    pushEvidence(evidence, "OEE trend improving.");
    pushEvidence(evidence, "Cycle time trend reducing.");
    recommendation = "Keep monitoring recovery and stabilize the operating baseline.";
}

// 8) estável
if (
    evidence.length === 0 &&
    Math.abs(oeeDeltaPct) < 0.05 &&
    Math.abs(cycleDeltaPct) < 0.08 &&
    Math.abs(tempDeltaPct) < 0.08 &&
    Math.abs(rpmDeltaPct) < 0.08 &&
    Math.abs(torqueDeltaPct) < 0.08 &&
    currentOEE >= 0.70
) {
    pattern = "stable_baseline";
    state = "stable";
    pushEvidence(evidence, "Temporal indicators remain close to local baseline.");
    recommendation = "Maintain current operating condition.";
}

// --------------------------------------------------
// Forecast OEE curto (heurístico)
// --------------------------------------------------
// previsão simples usando tendência + drift
const forecastOEE = [];
let base = currentOEE;

// tendência líquida
const netTrend =
    (oeeSlope * 0.6) -
    (Math.max(0, cycleSlope) * 0.00001) -
    (Math.max(0, tempSlope) * 0.002) +
    (Math.min(0, rpmSlope) * 0.05);

// penalização por drift/anomalia
const penalty = (driftScore * 0.03) + (anomalyScore * 0.04);

for (let i = 1; i <= 3; i++) {
    base = clamp(base + netTrend - penalty, 0, 1);
    forecastOEE.push(round(base));
}

// --------------------------------------------------
// Confiança
// --------------------------------------------------
let confidence = 0.55;

if (state === "stable") confidence = 0.72;
if (state === "degrading") confidence = 0.80;
if (state === "critical") confidence = 0.88;
if (state === "recovering") confidence = 0.76;

if (featureStatus === "awaiting_replacement" || featureStatus === "failure") {
    confidence += 0.05;
}

confidence = clamp(confidence, 0, 0.95);

// --------------------------------------------------
// Saída learning
// --------------------------------------------------
const learning = {
    model: "local_temporal_learning_v2",
    type: "temporal_pattern_learning",
    state,
    pattern,
    learned: pattern,
    confidence: round(confidence),
    driftScore: round(driftScore),
    anomalyScore: round(anomalyScore),
    forecastOEE,
    evidence,
    recommendation,
    basis: {
        oeeDeltaPct: round(oeeDeltaPct),
        availabilityDeltaPct: round(availabilityDeltaPct),
        performanceDeltaPct: round(performanceDeltaPct),
        qualityDeltaPct: round(qualityDeltaPct),
        tempDeltaPct: round(tempDeltaPct),
        rpmDeltaPct: round(rpmDeltaPct),
        torqueDeltaPct: round(torqueDeltaPct),
        cycleDeltaPct: round(cycleDeltaPct),
        oeeSlope: round(oeeSlope),
        tempSlope: round(tempSlope),
        rpmSlope: round(rpmSlope),
        torqueSlope: round(torqueSlope),
        cycleSlope: round(cycleSlope)
    }
};

flow.set("cps6_last_learning", learning);

// histórico curto opcional
let learningInsights = flow.get("learningInsights") || [];
learningInsights.push({
    ts: Date.now(),
    pattern: learning.pattern,
    state: learning.state,
    confidence: learning.confidence,
    driftScore: learning.driftScore,
    anomalyScore: learning.anomalyScore
});
if (learningInsights.length > 50) {
    learningInsights = learningInsights.slice(-50);
}
flow.set("learningInsights", learningInsights);

msg.payload.learning = learning;
return msg;
```

## Local Reasoning CPS6
```javascript
// ======================================================
// Build Root-Cause Reasoning for ACSM / CPS Analytics
// ======================================================
// Espera receber em msg.payload algo próximo de:
// {
//   cpsId: "CPS-006",
//   ts: 1774003654680,
//
//   oee: 0.569,                  // opcional
//   availability: 0.724,         // opcional
//   performance: 0.817,          // opcional
//   quality: 0.962,              // opcional
//
//   // OU em bloco:
//   oee: {
//     availability: 0.724,
//     performance: 0.817,
//     quality: 0.962,
//     oee: 0.569
//   },
//
//   status: {
//     operationalState: "maintenance",
//     healthState: "warning",
//     availabilityState: "degraded",
//     lastHeartbeat: 1774003654000
//   },
//
//   operationalData: {
//     CurrentTemperature: 24.3,
//     CurrentRPM: 0,
//     CurrentTorque: 0,
//     PieceCounter: 120,
//     CycleTimeMs: 0,
//     OperationMode: "stop"
//   },
//
//   telemetry: {
//     currentTemperature: 24.3,
//     currentRPM: 0,
//     currentTorque: 0,
//     cycleTimeMs: 0
//   },
//
//   learning: {
//     predictedLoss: "availability",
//     anomalyScore: 0.81,
//     degradationTrend: "rising"
//   },
//
//   history: {
//     downtimeEvents: 4,
//     maintenanceEvents: 3,
//     awaitingReplacementEvents: 2,
//     faultEvents: 1,
//     microStops: 5,
//     rejectedPieces: 0,
//     idealCycleTimeMs: 5000,
//     actualCycleTimeMsAvg: 7100
//   }
// }
//
// Saída:
//   msg.reasoning = reasoning
//   msg.payload.reasoning = reasoning
// ======================================================

function num(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function toText(v, def = 'unknown') {
  const s = String(v ?? '').trim();
  return s || def;
}

function round1(v) {
  return Math.round(num(v, 0) * 10) / 10;
}

function round4(v) {
  return Math.round(num(v, 0) * 10000) / 10000;
}

function normalizeMetric(v) {
  const n = num(v, 0);

  // Se vier em escala percentual (0..100), converte para 0..1
  if (n > 1) return clamp(n / 100, 0, 1);

  // Se já vier em escala 0..1
  return clamp(n, 0, 1);
}

function pctLoss(metricValue) {
  const v = num(metricValue, 1);

  // caso venha em escala 0..1
  if (v <= 1) {
    return clamp(1 - v, 0, 1);
  }

  // caso venha em escala 0..100
  return clamp((100 - v) / 100, 0, 1);
}

function severityFromLoss(lossValue) {
  const v = normalizeMetric(lossValue);
  if (v >= 0.40) return 'high';
  if (v >= 0.20) return 'medium';
  return 'low';
}

function normalizeKey(k) {
  return String(k || '').toLowerCase();
}

function humanizeLoss(key) {
  const k = normalizeKey(key);
  if (k === 'availability') return 'Availability';
  if (k === 'performance') return 'Performance';
  if (k === 'quality') return 'Quality';
  return 'Unknown';
}

function buildEvidenceList(ctx) {
  const ev = [];

  if (ctx.status.operationalState === 'maintenance') {
    ev.push('current_state_is_maintenance');
  }
  if (ctx.status.operationalState === 'awaiting_replacement') {
    ev.push('current_state_is_awaiting_replacement');
  }
  if (ctx.status.operationalState === 'failure') {
    ev.push('current_state_is_failure');
  }
  if (ctx.operational.CurrentRPM <= 0) {
    ev.push('rpm_is_zero');
  }
  if (ctx.operational.OperationMode === 'stop') {
    ev.push('operation_mode_is_stop');
  }
  if (ctx.history.downtimeEvents > 0) {
    ev.push(`downtime_events_${ctx.history.downtimeEvents}`);
  }
  if (ctx.history.maintenanceEvents > 0) {
    ev.push(`maintenance_events_${ctx.history.maintenanceEvents}`);
  }
  if (ctx.history.awaitingReplacementEvents > 0) {
    ev.push(`awaiting_replacement_events_${ctx.history.awaitingReplacementEvents}`);
  }
  if (ctx.history.faultEvents > 0) {
    ev.push(`fault_events_${ctx.history.faultEvents}`);
  }
  if (ctx.history.microStops > 0) {
    ev.push(`microstops_${ctx.history.microStops}`);
  }
  if (ctx.history.rejectedPieces > 0) {
    ev.push(`rejected_pieces_${ctx.history.rejectedPieces}`);
  }
  if (
    ctx.history.idealCycleTimeMs > 0 &&
    ctx.history.actualCycleTimeMsAvg > ctx.history.idealCycleTimeMs
  ) {
    ev.push('actual_cycle_time_above_ideal');
  }
  if (ctx.learning.anomalyScore >= 0.7) {
    ev.push(`high_anomaly_score_${round1(ctx.learning.anomalyScore)}`);
  }
  if (ctx.learning.degradationTrend === 'rising') {
    ev.push('degradation_trend_rising');
  }

  return ev;
}

function chooseDominantLoss(losses, learning) {
  const ordered = [...losses].sort((a, b) => b.loss - a.loss);
  let dominant = ordered[0];

  const predicted = normalizeKey(learning.predictedLoss);
  if (
    predicted &&
    ['availability', 'performance', 'quality'].includes(predicted)
  ) {
    const predictedItem = losses.find(x => x.key === predicted);
    if (predictedItem) {
      const diff = Math.abs(predictedItem.loss - dominant.loss);
      if (diff <= 0.05) dominant = predictedItem;
    }
  }

  return dominant;
}

function buildAvailabilityReasoning(ctx, dominantLossValue) {
  const causes = [];
  const actions = [];
  const evidence = [];

  if (ctx.status.operationalState === 'maintenance') {
    causes.push('the CPS is currently in maintenance state');
    evidence.push('maintenance_state_detected');
  }
  if (ctx.status.operationalState === 'awaiting_replacement') {
    causes.push('the CPS is currently awaiting replacement');
    evidence.push('awaiting_replacement_state_detected');
  }
  if (ctx.status.operationalState === 'failure') {
    causes.push('the CPS is currently in failure state');
    evidence.push('failure_state_detected');
  }
  if (ctx.history.downtimeEvents > 0) {
    causes.push(`recent downtime events were observed (${ctx.history.downtimeEvents})`);
    evidence.push(`downtime_events=${ctx.history.downtimeEvents}`);
  }
  if (ctx.history.maintenanceEvents > 0) {
    causes.push(`maintenance interventions were recorded (${ctx.history.maintenanceEvents})`);
    evidence.push(`maintenance_events=${ctx.history.maintenanceEvents}`);
  }
  if (ctx.history.awaitingReplacementEvents > 0) {
    causes.push(`replacement-related interruptions were recorded (${ctx.history.awaitingReplacementEvents})`);
    evidence.push(`awaiting_replacement_events=${ctx.history.awaitingReplacementEvents}`);
  }
  if (ctx.operational.CurrentRPM <= 0 && ctx.operational.OperationMode === 'stop') {
    causes.push('the asset is not producing (RPM = 0 and operation mode = stop)');
    evidence.push('rpm_zero_and_stop_mode');
  }

  actions.push('inspect downtime history and identify the most frequent stop causes');
  actions.push('verify maintenance log, replacement triggers, and state transition history');
  actions.push('check whether the CPS is stuck in maintenance or awaiting replacement longer than expected');
  actions.push('correlate zero-RPM periods with stop, failure, or maintenance events');

  const explanation = causes.length
    ? `The dominant OEE loss is availability (${(dominantLossValue * 100).toFixed(1)}%). This indicates that the main productivity reduction is associated with asset unavailability. Probable causal reading: ${causes.join('; ')}.`
    : `The dominant OEE loss is availability (${(dominantLossValue * 100).toFixed(1)}%). This suggests that the main productivity reduction is related to downtime, interruption, or maintenance-driven unavailability.`;

  const recommendation =
    'Prioritize investigation of downtime causes, maintenance occurrences, replacement conditions, and prolonged inactive states before optimizing speed or quality.';

  return {
    explanation,
    recommendation,
    evidence,
    probableCause: 'availability_related_operational_unavailability',
    actions
  };
}

function buildPerformanceReasoning(ctx, dominantLossValue) {
  const causes = [];
  const actions = [];
  const evidence = [];

  if (
    ctx.history.idealCycleTimeMs > 0 &&
    ctx.history.actualCycleTimeMsAvg > ctx.history.idealCycleTimeMs
  ) {
    causes.push(
      `average cycle time is above the ideal reference (${ctx.history.actualCycleTimeMsAvg} ms vs ${ctx.history.idealCycleTimeMs} ms)`
    );
    evidence.push('cycle_time_above_reference');
  }

  if (ctx.operational.CurrentRPM > 0 && ctx.operational.CurrentRPM < 10) {
    causes.push(`the asset is running at low RPM (${ctx.operational.CurrentRPM})`);
    evidence.push(`low_rpm=${ctx.operational.CurrentRPM}`);
  }

  if (ctx.history.microStops > 0) {
    causes.push(`micro-stops were detected (${ctx.history.microStops})`);
    evidence.push(`microstops=${ctx.history.microStops}`);
  }

  if (ctx.learning.degradationTrend === 'rising') {
    causes.push('the learning layer indicates a rising degradation trend');
    evidence.push('degradation_trend_rising');
  }

  actions.push('compare actual cycle time against the expected cycle baseline');
  actions.push('investigate micro-stops, speed losses, and intermittent flow interruptions');
  actions.push('inspect mechanical drag, conveyor rhythm, actuator response, and upstream/downstream bottlenecks');
  actions.push('correlate RPM, torque, and cycle time variation over the last time window');

  const explanation = causes.length
    ? `The dominant OEE loss is performance (${(dominantLossValue * 100).toFixed(1)}%). This indicates production below the expected operating pace. Probable causal reading: ${causes.join('; ')}.`
    : `The dominant OEE loss is performance (${(dominantLossValue * 100).toFixed(1)}%). This suggests speed loss, increased cycle time, micro-stops, or reduced effective throughput.`;

  const recommendation =
    'Prioritize investigation of cycle time increase, low-speed operation, micro-stops, and local bottlenecks before focusing on availability or quality improvement.';

  return {
    explanation,
    recommendation,
    evidence,
    probableCause: 'performance_related_speed_or_cycle_loss',
    actions
  };
}

function buildQualityReasoning(ctx, dominantLossValue) {
  const causes = [];
  const actions = [];
  const evidence = [];

  if (ctx.history.rejectedPieces > 0) {
    causes.push(`rejected or nonconforming pieces were detected (${ctx.history.rejectedPieces})`);
    evidence.push(`rejected_pieces=${ctx.history.rejectedPieces}`);
  }

  if (ctx.learning.anomalyScore >= 0.7) {
    causes.push(`the anomaly score is elevated (${round1(ctx.learning.anomalyScore)})`);
    evidence.push(`anomaly_score=${round1(ctx.learning.anomalyScore)}`);
  }

  if (ctx.operational.CurrentTorque > 0) {
    causes.push(`torque variation should be checked (${ctx.operational.CurrentTorque})`);
    evidence.push(`torque=${ctx.operational.CurrentTorque}`);
  }

  actions.push('inspect rejected pieces and identify defect patterns');
  actions.push('verify process stability, actuator positioning, and sensor consistency');
  actions.push('correlate anomalies with torque, temperature, and state transitions');
  actions.push('review quality events, rework occurrences, and acceptance thresholds');

  const explanation = causes.length
    ? `The dominant OEE loss is quality (${(dominantLossValue * 100).toFixed(1)}%). This indicates that the main reduction in effective output is associated with nonconformity or process instability. Probable causal reading: ${causes.join('; ')}.`
    : `The dominant OEE loss is quality (${(dominantLossValue * 100).toFixed(1)}%). This suggests rejects, rework, or instability affecting conforming output.`;

  const recommendation =
    'Prioritize investigation of defect generation, process instability, sensor consistency, and quality-event recurrence before tuning speed or downtime routines.';

  return {
    explanation,
    recommendation,
    evidence,
    probableCause: 'quality_related_process_instability',
    actions
  };
}

// ------------------------------------------------------
// 1) Normalização da entrada
// ------------------------------------------------------
const p = msg.payload || {};

const rawAvailability =
  p?.oee?.availability ??
  p?.availability ??
  null;

const rawPerformance =
  p?.oee?.performanceDisplay ??
  p?.performance ??
  p?.oee?.performance ??
  p?.performanceAccumulated ??
  null;

const rawQuality =
  p?.oee?.quality ??
  p?.quality ??
  null;

const rawOEE =
  p?.oee?.oee ??
  p?.oeeGlobal ??
  p?.oee ??
  null;

const ctx = {
  cpsId: p.cpsId || msg.cpsId || 'unknown_cps',
  ts: p.ts || p.timestamp || Date.now(),
  oee: {
    availability: normalizeMetric(rawAvailability),
    performance: normalizeMetric(rawPerformance),
    quality: normalizeMetric(rawQuality),
    oee: normalizeMetric(rawOEE)
  },
  status: {
    operationalState: toText(
      p?.status?.operationalState || p?.status?.state || p?.operationalState || p?.process?.featureStatus,
      'unknown'
    ).toLowerCase(),
    healthState: toText(
      p?.status?.healthState || p?.healthState,
      'unknown'
    ).toLowerCase(),
    availabilityState: toText(
      p?.status?.availabilityState || p?.availabilityState,
      'unknown'
    ).toLowerCase(),
    lastHeartbeat: p?.status?.lastHeartbeat || p?.lastHeartbeat || null
  },
  operational: {
    CurrentTemperature: num(
      p?.operationalData?.CurrentTemperature,
      p?.telemetry?.currentTemperature ?? p?.CurrentTemperature
    ),
    CurrentRPM: num(
      p?.operationalData?.CurrentRPM,
      p?.telemetry?.currentRPM ?? p?.CurrentRPM
    ),
    CurrentTorque: num(
      p?.operationalData?.CurrentTorque,
      p?.telemetry?.currentTorque ?? p?.CurrentTorque
    ),
    PieceCounter: num(
      p?.operationalData?.PieceCounter,
      p?.production?.pieceCounterAbs ?? p?.PieceCounter
    ),
    CycleTimeMs: num(
      p?.operationalData?.CycleTimeMs,
      p?.telemetry?.cycleTimeMs ?? p?.CycleTimeMs
    ),
    OperationMode: toText(
      p?.operationalData?.OperationMode || p?.OperationMode || p?.process?.operationMode,
      'unknown'
    ).toLowerCase()
  },
  learning: {
    predictedLoss: toText(
      p?.learning?.predictedLoss,
      ''
    ).toLowerCase(),
    anomalyScore: num(
      p?.learning?.anomalyScore,
      0
    ),
    degradationTrend: toText(
      p?.learning?.degradationTrend,
      p?.learning?.state || 'unknown'
    ).toLowerCase()
  },
  history: {
    downtimeEvents: num(p?.history?.downtimeEvents, 0),
    maintenanceEvents: num(p?.history?.maintenanceEvents, 0),
    awaitingReplacementEvents: num(p?.history?.awaitingReplacementEvents, 0),
    faultEvents: num(p?.history?.faultEvents, 0),
    microStops: num(p?.history?.microStops, 0),
    rejectedPieces: num(
      p?.history?.rejectedPieces,
      p?.production?.rejectPieces ?? 0
    ),
    idealCycleTimeMs: num(
      p?.history?.idealCycleTimeMs,
      p?.process?.idealCycleTimeMs ?? 0
    ),
    actualCycleTimeMsAvg: num(p?.history?.actualCycleTimeMsAvg, 0)
  }
};

// ------------------------------------------------------
// 2) Cálculo de perdas
// ------------------------------------------------------
const losses = [
  {
    key: 'availability',
    metricValue: round4(ctx.oee.availability),
    loss: round4(pctLoss(ctx.oee.availability))
  },
  {
    key: 'performance',
    metricValue: round4(ctx.oee.performance),
    loss: round4(pctLoss(ctx.oee.performance))
  },
  {
    key: 'quality',
    metricValue: round4(ctx.oee.quality),
    loss: round4(pctLoss(ctx.oee.quality))
  }
];

const dominant = chooseDominantLoss(losses, ctx.learning);

// ------------------------------------------------------
// 3) Reasoning específico por perda dominante
// ------------------------------------------------------
let reasoningBlock;

if (dominant.key === 'availability') {
  reasoningBlock = buildAvailabilityReasoning(ctx, dominant.loss);
} else if (dominant.key === 'performance') {
  reasoningBlock = buildPerformanceReasoning(ctx, dominant.loss);
} else {
  reasoningBlock = buildQualityReasoning(ctx, dominant.loss);
}

const genericEvidence = buildEvidenceList(ctx);
const mergedEvidence = [...new Set([...(reasoningBlock.evidence || []), ...genericEvidence])];

// ------------------------------------------------------
// 4) Objeto final pronto para o front
// ------------------------------------------------------
const reasoning = {
  generatedAt: new Date(ctx.ts).toISOString(),
  timestamp: ctx.ts,
  cpsId: ctx.cpsId,

  title: 'Root-Cause Reasoning',
  subtitle: 'Causal reading of the dominant OEE loss and technical investigation recommendation.',

  dominantLoss: dominant.key,
  dominantLossLabel: humanizeLoss(dominant.key),
  dominantLossValue: round4(dominant.loss),
  dominantMetricValue: round4(dominant.metricValue),
  severity: severityFromLoss(dominant.loss),

  losses: {
    availability: losses.find(x => x.key === 'availability')?.loss ?? 0,
    performance: losses.find(x => x.key === 'performance')?.loss ?? 0,
    quality: losses.find(x => x.key === 'quality')?.loss ?? 0
  },

  metrics: {
    availability: round4(ctx.oee.availability),
    performance: round4(ctx.oee.performance),
    quality: round4(ctx.oee.quality),
    oee: round4(ctx.oee.oee)
  },

  probableCause: reasoningBlock.probableCause,
  explanation: reasoningBlock.explanation,

  recommendation: reasoningBlock.recommendation,
  technicalRecommendation: reasoningBlock.recommendation,

  recommendedActions: reasoningBlock.actions || [],
  evidence: mergedEvidence,

  context: {
    operationalState: ctx.status.operationalState,
    healthState: ctx.status.healthState,
    operationMode: ctx.operational.OperationMode,
    rpm: ctx.operational.CurrentRPM,
    torque: ctx.operational.CurrentTorque,
    cycleTimeMs: ctx.operational.CycleTimeMs,
    pieceCounter: ctx.operational.PieceCounter,
    anomalyScore: ctx.learning.anomalyScore,
    degradationTrend: ctx.learning.degradationTrend
  }
};

// ------------------------------------------------------
// 5) Saída
// ------------------------------------------------------
msg.reasoning = reasoning;

msg.payload = {
  ...(typeof p === 'object' ? p : {}),
  reasoning
};

return msg;
```

## Build CPS6 Payload for ACSM
```javascript
// ============================================================
// CPS6 - Build Payload for ACSM
// Entrada esperada:
//   msg.payload contendo:
//   - OEE/telemetria
//   - timeSeriesFeatures
//   - learning
//   - reasoning
// Saída:
//   msg.payload = payload semântico para ACSM
// ============================================================

const p = msg.payload || {};
const now = Number(p.ts || Date.now());

function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function round(v, d = 4) {
    if (!Number.isFinite(v)) return null;
    return Number(v.toFixed(d));
}

function uniq(arr) {
    return [...new Set((arr || []).filter(Boolean))];
}

// --------------------------------------------------
// 1) Identidade e contexto
// --------------------------------------------------
const cpsId = p.cpsId || "CPS-006";
const cpsName = p.cpsName || "BufferLine_50467";
const baseTopic = "cps6";

const featureStatus = String(p.process?.featureStatus || "").toLowerCase().trim();
const playEnabled = !!p.process?.playEnabled;

// --------------------------------------------------
// 2) Blocos principais
// --------------------------------------------------

const oeeBlock = {
    current: round(num(p.oee, 0)),

    // campos principais usados pelo front
    availability: round(num(p.availability, 0)),
    performance: round(num(p.performance, 0)),
    quality: round(num(p.quality, 1)),

    // auxiliares
    performanceDisplay: round(num(p.performance, 0)),
    performanceAccumulated: round(num(p.performanceAccumulated ?? p.performance, 0)),
    performanceInstant: p.performanceInstant != null ? round(num(p.performanceInstant, 0)) : null
};

const telemetryBlock = {
    temperature: round(num(p.telemetry?.currentTemperature, 0)),
    rpm: round(num(p.telemetry?.currentRPM, 0)),
    torque: round(num(p.telemetry?.currentTorque, 0)),
    cycleTimeMs: round(num(p.telemetry?.cycleTimeMs, 0)),
    pieceCounter: round(num(p.production?.pieceCounterAbs, 0), 0)
};

const productionBlock = {
    producedDelta: round(num(p.production?.producedDelta, 0), 0),
    totalPieces: round(num(p.production?.totalPieces, 0), 0),
    goodPieces: round(num(p.production?.goodPieces, 0), 0),
    rejectPieces: round(num(p.production?.rejectPieces, 0), 0),
    rejectDelta: round(num(p.production?.rejectDelta, 0), 0)
};

const timeBlock = {
    plannedProductionTimeMs: round(num(p.times?.plannedProductionTimeMs, 0), 0),
    downtimeMs: round(num(p.times?.downtimeMs, 0), 0),
    operatingTimeMs: round(num(p.times?.operatingTimeMs, 0), 0),
    deltaMs: round(num(p.times?.deltaMs, 0), 0),
    deltaOperatingTimeMs: round(num(p.times?.deltaOperatingTimeMs, 0), 0)
};

const timeSeriesFeatures = p.timeSeriesFeatures || {};
const learning = p.learning || {};
const reasoning = p.reasoning || {};

// --------------------------------------------------
// 3) Evidências consolidadas
// --------------------------------------------------
const evidence = uniq([
    ...(Array.isArray(learning.evidence) ? learning.evidence : []),
    ...(Array.isArray(reasoning.evidence) ? reasoning.evidence : [])
]);

// --------------------------------------------------
// 4) Estatísticas resumidas para ACSM
// Compatível com o payload novo e com o frontend antigo
// --------------------------------------------------
const statistics = {
    // formato novo
    oeeMean: timeSeriesFeatures?.oee?.mean ?? null,
    oeeMedian: timeSeriesFeatures?.oee?.median ?? null,

    availabilityMean: timeSeriesFeatures?.availability?.mean ?? null,
    availabilityMedian: timeSeriesFeatures?.availability?.median ?? null,

    performanceMean: timeSeriesFeatures?.performance?.mean ?? null,
    performanceMedian: timeSeriesFeatures?.performance?.median ?? null,
    performanceDisplayMean: timeSeriesFeatures?.performance?.mean ?? null,
    performanceDisplayMedian: timeSeriesFeatures?.performance?.median ?? null,

    qualityMean: timeSeriesFeatures?.quality?.mean ?? null,
    qualityMedian: timeSeriesFeatures?.quality?.median ?? null,

    tempMean: timeSeriesFeatures?.temperature?.mean ?? null,
    tempMedian: timeSeriesFeatures?.temperature?.median ?? null,

    rpmMean: timeSeriesFeatures?.rpm?.mean ?? null,
    rpmMedian: timeSeriesFeatures?.rpm?.median ?? null,

    torqueMean: timeSeriesFeatures?.torque?.mean ?? null,
    torqueMedian: timeSeriesFeatures?.torque?.median ?? null,

    cycleMean: timeSeriesFeatures?.cycleTimeMs?.mean ?? null,
    cycleMedian: timeSeriesFeatures?.cycleTimeMs?.median ?? null,

    // compatibilidade com frontend antigo
    oee_mean: timeSeriesFeatures?.oee?.mean ?? null,
    oee_median: timeSeriesFeatures?.oee?.median ?? null,

    availability_mean: timeSeriesFeatures?.availability?.mean ?? null,
    availability_median: timeSeriesFeatures?.availability?.median ?? null,

    performance_mean: timeSeriesFeatures?.performance?.mean ?? null,
    performance_median: timeSeriesFeatures?.performance?.median ?? null,
    performance_display_mean: timeSeriesFeatures?.performance?.mean ?? null,
    performance_display_median: timeSeriesFeatures?.performance?.median ?? null,

    quality_mean: timeSeriesFeatures?.quality?.mean ?? null,
    quality_median: timeSeriesFeatures?.quality?.median ?? null,

    temp_mean: timeSeriesFeatures?.temperature?.mean ?? null,
    temp_median: timeSeriesFeatures?.temperature?.median ?? null,

    rpm_mean: timeSeriesFeatures?.rpm?.mean ?? null,
    rpm_median: timeSeriesFeatures?.rpm?.median ?? null,

    torque_mean: timeSeriesFeatures?.torque?.mean ?? null,
    torque_median: timeSeriesFeatures?.torque?.median ?? null,

    cycle_mean: timeSeriesFeatures?.cycleTimeMs?.mean ?? null,
    cycle_median: timeSeriesFeatures?.cycleTimeMs?.median ?? null
};
// --------------------------------------------------
// 5) Features compactas para ACSM
// --------------------------------------------------
const features = {
    featureStatus,
    playEnabled,
    learningState: learning.state || null,
    learningPattern: learning.pattern || null,
    dominantLossNow: reasoning.dominantLossNow || null,
    dominantLossForecast: reasoning.dominantLossForecast || null,
    probableCause: reasoning.probableCause || null,
    riskLevel: reasoning.riskLevel || null,
    driftScore: learning.driftScore ?? null,
    anomalyScore: learning.anomalyScore ?? null
};

// --------------------------------------------------
// 6) Janela temporal
// --------------------------------------------------
const windowLabel =
    timeSeriesFeatures?.window ||
    `last_${timeSeriesFeatures?.historySize || 0}_points`;

// --------------------------------------------------
// 7) Payload final para ACSM
// --------------------------------------------------
const acsmPayload = {
    ts: now,
    timestamp: new Date(now).toISOString(),

    cpsId,
    cpsName,
    baseTopic,

    window: windowLabel,

    oee: oeeBlock,
    telemetry: telemetryBlock,
    production: productionBlock,
    time: timeBlock,
    statistics,

    features,

    timeSeriesFeatures,

    learning: {
        model: learning.model || null,
        type: learning.type || null,
        state: learning.state || null,
        pattern: learning.pattern || learning.learned || null,
        learned: learning.learned || learning.pattern || null,
        confidence: learning.confidence ?? null,
        driftScore: learning.driftScore ?? null,
        anomalyScore: learning.anomalyScore ?? null,
        forecastOEE: Array.isArray(learning.forecastOEE) ? learning.forecastOEE : [],
        recommendation: learning.recommendation || null,
        evidence: Array.isArray(learning.evidence) ? learning.evidence : [],
        basis: learning.basis || {}
    },

    
    reasoning: {
        model: reasoning.model || null,
        type: reasoning.type || null,
        dominantLossNow: reasoning.dominantLossNow || null,
        dominantLossForecast: reasoning.dominantLossForecast || null,

        dominantLoss: reasoning.dominantLossNow || reasoning.dominantLoss || null,

        probableCause: reasoning.probableCause || null,
        riskLevel: reasoning.riskLevel || null,
        confidence: reasoning.confidence ?? null,
        explanation: reasoning.explanation || null,
        recommendation: reasoning.recommendation || null,
        evidence: Array.isArray(reasoning.evidence) ? reasoning.evidence : [],

        losses: reasoning.losses || {
            availability: Math.max(0, 1 - num(p.availability, 1)),
            performance: Math.max(0, 1 - num(p.performanceAccumulated ?? p.performance, 1)),
            quality: Math.max(0, 1 - num(p.quality, 1))
        }
    },

    evidence,

    source: {
        producer: "CPS6",
        semanticPackageVersion: "v2",
        generatedBy: "Build CPS6 Payload for ACSM"
    }
};

// --------------------------------------------------
// 8) Persistência opcional
// --------------------------------------------------
flow.set("cps6_last_acsm_payload", acsmPayload);

let acsmPayloadHistory = flow.get("cps6_acsm_payload_history") || [];
acsmPayloadHistory.push({
    ts: acsmPayload.ts,
    cpsId: acsmPayload.cpsId,
    oee: acsmPayload.oee.current,
    learningState: acsmPayload.learning.state,
    learningPattern: acsmPayload.learning.pattern,
    dominantLossNow: acsmPayload.reasoning.dominantLossNow,
    riskLevel: acsmPayload.reasoning.riskLevel
});
if (acsmPayloadHistory.length > 50) {
    acsmPayloadHistory = acsmPayloadHistory.slice(-50);
}
flow.set("cps6_acsm_payload_history", acsmPayloadHistory);

// --------------------------------------------------
// 9) Saída
// --------------------------------------------------
msg.payload = acsmPayload;
return msg;
```
