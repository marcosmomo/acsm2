'use client';

import React, {
  createContext,
  useState,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';



const CPSContext = createContext(undefined);

export const useCPSContext = () => {
  const context = useContext(CPSContext);

  if (!context) {
    throw new Error('useCPSContext must be used within a CPSProvider');
  }

  return context;
};

// Broker WS/WSS default (fallback)
const DEFAULT_BROKER_URL =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? 'wss://broker.hivemq.com:8884/mqtt'
    : 'ws://broker.hivemq.com:8000/mqtt';

// Topic helpers
const joinTopic = (base, suffix) =>
  `${String(base).replace(/\/+$/, '')}/${String(suffix).replace(/^\/+/, '')}`;

const COMMAND_TOPIC_SUFFIX = 'cmd';
const DATA_TOPIC_SUFFIX = 'data';
const ACK_TOPIC_SUFFIX = 'ack';
const STATUS_TOPIC_SUFFIX = 'status';
const HEALTH_TOPIC_SUFFIX = 'health';

const ALARM_TOPIC_SUFFIX = 'alarm';

// ACSM analytics topics
const OEE_TOPIC_SUFFIX = 'oee';
const LEARNING_TOPIC_SUFIX = 'learning';

const ACSM_OEE_WILDCARD_TOPIC = '+/oee';
const ACSM_LEARNING_WILDCARD_TOPIC = '+/learning';

const DEBUG_LOG_ALL_TOPICS = true;
const CPS_AUTOLOAD_DELAY_MS = 3000;
const FEATURE_UI_UPDATE_MS = 5000;

// Lifecycle
const LIFECYCLE_UNPLUG_REQUEST_TOPIC = 'acsm/lifecycle/unplug_request';
const LIFECYCLE_UPDATE_FUNCTIONS_TOPIC = 'acsm/lifecycle/update_functions';
const AUTOUNPLUG_DEDUP_MS = 15000;



const normalizeTopic = (t) =>
  String(t || '').replace(/^\/+/, '').replace(/\/+$/, '');

const topicVariants = (t) => {
  const noLead = normalizeTopic(t);
  const withLead = `/${noLead}`;
  return [noLead, withLead];
};

const normalizeUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `http://${u}`;
};

const isMaintenanceReason = (reason) => {
  const r = String(reason || '').toLowerCase().trim();
  return [
    'maintenance',
    'manutencao',
    'preventive_maintenance',
    'corrective_maintenance',
    'scheduled_maintenance',
    'unscheduled_maintenance',
  ].includes(r);
};

/**
 * Detect feature state topic:
 * 1) <base>/feat/<key>/$state
 * 2) <base>/<plant>/feat/<key>/$state
 */
const parseFeatureStateTopic = (base, incoming) => {
  const baseNorm = normalizeTopic(base);
  const incNorm = normalizeTopic(incoming);

  if (!(incNorm === baseNorm || incNorm.startsWith(`${baseNorm}/`))) return null;

  const rel = incNorm.slice(baseNorm.length).replace(/^\/+/, '');
  const parts = rel.split('/');

  if (parts.length >= 3 && parts[0] === 'feat' && parts[2] === '$state') {
    return { featKey: parts[1], plant: null };
  }

  if (parts.length >= 4 && parts[1] === 'feat' && parts[3] === '$state') {
    return { featKey: parts[2], plant: parts[0] };
  }

  return null;
};

const normalizeFeatureStatusEN = (s) => {
  const v = String(s || '').toLowerCase();

  if (v === 'active') return 'active';
  if (v === 'maintenance') return 'maintenance';
  if (v === 'awaiting_replacement') return 'awaiting_replacement';
  if (v === 'failure') return 'failure';
  if (v === 'ok') return 'active';
  if (v === 'running') return 'active';

  if (v === 'ativo' || v === 'rodando') return 'active';
  if (v === 'manutencao') return 'maintenance';
  if (v === 'espera') return 'awaiting_replacement';
  if (v === 'falha') return 'failure';

  return null;
};

const mapOperationalStateToPlayStatus = (operationalState) => {
  const s = String(operationalState || '').toLowerCase();

  if (s === 'active' || s === 'running') return 'Rodando';
  if (s === 'stopped' || s === 'inactive') return 'Parado';
  if (s === 'maintenance') return 'Parado';
  return 'Parado';
};

const mapOperationalStateToGlobalState = (operationalState) => {
  const s = String(operationalState || '').toLowerCase();

  if (s === 'active') return 'running';
  if (s === 'running') return 'running';
  if (s === 'stopped') return 'stopped';
  if (s === 'inactive') return 'stopped';
  if (s === 'maintenance') return 'maintenance';
  if (s === 'awaiting_replacement') return 'awaiting_replacement';
  if (s === 'failure') return 'failure';
  return null;
};

const getSubmodelByIdShort = (parsed, idShort) =>
  (parsed?.submodels || []).find((sm) => sm?.idShort === idShort);

const getPropertyValueFromElements = (elements = [], idShort) => {
  const el = (elements || []).find((item) => item?.idShort === idShort);
  return el?.value ?? null;
};

const getCollectionValue = (elements = [], collectionIdShort, propertyIdShort) => {
  const col = (elements || []).find((item) => item?.idShort === collectionIdShort);
  const valueArr = Array.isArray(col?.value) ? col.value : [];
  const prop = valueArr.find((item) => item?.idShort === propertyIdShort);
  return prop?.value ?? null;
};

const getSpecificAssetIdValue = (aas, name) => {
  const arr = aas?.assetInformation?.specificAssetIds || [];
  const item = arr.find(
    (x) => String(x?.name || '').toLowerCase() === String(name || '').toLowerCase()
  );
  return item?.value ?? null;
};

const getFeatureDefinitionsFromAAS = (parsed, baseTopic) => {
  const smFunctions = getSubmodelByIdShort(parsed, 'Functions');
  const topic = normalizeTopic(baseTopic);

  if (!smFunctions?.submodelElements?.length) return [];

  const funcionalidades = [];

  for (const el of smFunctions.submodelElements || []) {
    const key = el?.idShort;
    if (!key) continue;

    const dict = Object.fromEntries(
      (el?.value || [])
        .filter((e) => e?.modelType === 'Property')
        .map((e) => [e.idShort, e.value])
    );

    funcionalidades.push({
      key,
      nome: dict.Name || key,
      descricao: dict.Description || '',
      allowed: String(dict.AllowedStatuses || '')
        .split('|')
        .map((x) => x.trim())
        .filter(Boolean),
      statusAtual: null,
      lastUpdate: null,
      lastDetails: null,
      topics: {
        state: `${topic}/feat/${key}/$state`,
      },
    });
  }

  return funcionalidades;
};

const parseAASCps = (parsed) => {
  const aas = Array.isArray(parsed?.assetAdministrationShells)
    ? parsed.assetAdministrationShells[0]
    : null;

  if (!aas) {
    throw new Error('AAS principal ausente em assetAdministrationShells[0].');
  }

  const smDigital = getSubmodelByIdShort(parsed, 'DigitalNameplate');
  const smTechnical = getSubmodelByIdShort(parsed, 'TechnicalData');
  const smOperational = getSubmodelByIdShort(parsed, 'OperationalData');
  const smHealth = getSubmodelByIdShort(parsed, 'StatusAndHealth');
  const smDocs = getSubmodelByIdShort(parsed, 'Documents');
  const smInterfaces = getSubmodelByIdShort(parsed, 'AssetInterfacesDescription');
  const smLifecycle = getSubmodelByIdShort(parsed, 'LifecycleIntegration');
  const smAcsm = getSubmodelByIdShort(parsed, 'ACSMIntegration');

  if (!smInterfaces) {
    throw new Error('Submodel "AssetInterfacesDescription" ausente.');
  }

  // 1. Obtemos o ID bruto do AAS (ex: "CPS-007", "CPS 1", "cps_2")
const rawId =
    getSpecificAssetIdValue(aas, 'cpsId') ||
    getPropertyValueFromElements(smDigital?.submodelElements, 'CPSId') ||
    'UNKNOWN';

// 2. Normalização Universal:
// .toLowerCase() -> Tudo para minúsculo
// .replace(/[^a-z0-9]/g, '') -> Remove TUDO que não for letra ou número (hífens, espaços, underlines)
const cpsId = rawId.toLowerCase().replace(/[^a-z0-9]/g, '');

// Resultado esperado:
// "CPS-007" -> "cps007" (ou "cps7" se você preferir tratar o zero, veja abaixo)
// "CPS 1"   -> "cps1"
// "CPS_2"   -> "cps2"

  const nome =
    getSpecificAssetIdValue(aas, 'assetName') ||
    getPropertyValueFromElements(smDigital?.submodelElements, 'ManufacturerProductDesignation') ||
    aas?.idShort ||
    cpsId;

  const manufacturer =
    getSpecificAssetIdValue(aas, 'manufacturer') ||
    getPropertyValueFromElements(smDigital?.submodelElements, 'ManufacturerName') ||
    '';

  const assetType =
    getSpecificAssetIdValue(aas, 'assetType') ||
    getPropertyValueFromElements(smTechnical?.submodelElements, 'ConveyorType') ||
    '';

  const serialNumber =
    getSpecificAssetIdValue(aas, 'serialNumber') ||
    getPropertyValueFromElements(smDigital?.submodelElements, 'SerialNumber') ||
    '';

  const baseTopic =
    getPropertyValueFromElements(smInterfaces?.submodelElements, 'BaseTopic') ||
    getSpecificAssetIdValue(aas, 'baseTopic') ||
    'cps7';

  const topic = normalizeTopic(baseTopic);

  const brokerHost =
    getPropertyValueFromElements(smInterfaces?.submodelElements, 'BrokerHost') ||
    'broker.hivemq.com';

  const brokerPort =
    getPropertyValueFromElements(smInterfaces?.submodelElements, 'BrokerPort') || '1883';

  const brokerWs =
    getCollectionValue(smInterfaces?.submodelElements, 'WebSocketInterfaces', 'MQTTWS') ||
    'ws://broker.hivemq.com:8000/mqtt';

  const brokerWss =
    getCollectionValue(smInterfaces?.submodelElements, 'WebSocketInterfaces', 'MQTTWSS') ||
    'wss://broker.hivemq.com:8884/mqtt';

  const descriptionEndpoint =
    getCollectionValue(smInterfaces?.submodelElements, 'RESTEndpoints', 'DescriptionEndpoint') ||
    '';

  const summaryEndpoint =
    getCollectionValue(smInterfaces?.submodelElements, 'RESTEndpoints', 'SummaryEndpoint') || '';

  const indicatorsEndpoint =
    getCollectionValue(smInterfaces?.submodelElements, 'RESTEndpoints', 'IndicatorsEndpoint') ||
    '';

  const historyEndpoint =
    getCollectionValue(smInterfaces?.submodelElements, 'RESTEndpoints', 'HistoryEndpoint') || '';

  const healthEndpoint =
    getCollectionValue(smInterfaces?.submodelElements, 'RESTEndpoints', 'HealthEndpoint') || '';

  const dashboardUrl =
    getPropertyValueFromElements(smDocs?.submodelElements, 'DashboardURL') ||
    getPropertyValueFromElements(smAcsm?.submodelElements, 'DashboardURL') ||
    '';

  const currentPhase =
    getPropertyValueFromElements(smLifecycle?.submodelElements, 'CurrentPhase') || 'plug';

  const supportedPhases =
    getPropertyValueFromElements(smLifecycle?.submodelElements, 'SupportedPhases') || '';

  const operationMode =
    getPropertyValueFromElements(smOperational?.submodelElements, 'OperationMode') || 'play';

  const operationalState =
    getPropertyValueFromElements(smHealth?.submodelElements, 'OperationalState') || 'Unknown';

  const availability =
    getPropertyValueFromElements(smHealth?.submodelElements, 'Availability') || 'Unknown';

  const healthState =
    getPropertyValueFromElements(smHealth?.submodelElements, 'HealthState') || 'Unknown';

  const lastHeartbeat =
    getPropertyValueFromElements(smHealth?.submodelElements, 'LastHeartbeat') || null;

  const parsedHeartbeatTs = lastHeartbeat ? new Date(lastHeartbeat).getTime() : null;
  const initialPlayStatus = mapOperationalStateToPlayStatus(operationalState);
  const initialGlobalState = mapOperationalStateToGlobalState(operationalState);

  const apiData =
    normalizeUrl(indicatorsEndpoint) ||
    normalizeUrl(summaryEndpoint) ||
    normalizeUrl(descriptionEndpoint) ||
    '';

  const funcionalidades = getFeatureDefinitionsFromAAS(parsed, topic);

  return {
    aas,
    cps: {
      id: cpsId,
      nome,
      descricao:
        `${manufacturer}${assetType ? ` • ${assetType}` : ''}${
          serialNumber ? ` • SN ${serialNumber}` : ''
        }`.trim() || 'No description available.',
      manufacturer,
      assetType,
      serialNumber,
      server: brokerHost,
      brokerPort,
      brokerWs,
      brokerWss,
      topic,
      apiData,
      dashboardUrl: normalizeUrl(dashboardUrl),
      endpoints: {
        description: normalizeUrl(descriptionEndpoint),
        summary: normalizeUrl(summaryEndpoint),
        indicators: normalizeUrl(indicatorsEndpoint),
        history: normalizeUrl(historyEndpoint),
        health: normalizeUrl(healthEndpoint),
      },
      lifecycle: {
        cpsId,
        cpsName: nome,
        baseTopic: topic,
        currentPhase,
        supportedPhases,
      },
      maintenance: {
        inProgress: false,
        lastStartTs: null,
        lastEndTs: null,
      },
      updates: {
        lastMessage: null,
        lastType: null,
        lastTs: null,
        history: [],
      },
      health: {
        score: null,
        label: healthState || null,
        sourceStatus: availability || operationalState || null,
        lastUpdate: Number.isFinite(parsedHeartbeatTs) ? parsedHeartbeatTs : null,
      },
      globalState: {
        state: initialGlobalState,
        status: initialGlobalState,
        playEnabled: String(operationMode || '').toLowerCase() === 'play',
        healthScore: null,
        healthLabel: healthState || null,
        featureCount: funcionalidades.length,
        summary: `${operationalState || 'Unknown'} / ${availability || 'Unknown'}`,
        lastUpdate: Number.isFinite(parsedHeartbeatTs) ? parsedHeartbeatTs : null,
      },
      oee: {
        availability: null,
        performance: null,
        quality: null,
        value: null,
        totals: null,
        sourceStatus: null,
        lastUpdate: null,
      },
      operationalData: {
        currentTemperature: getPropertyValueFromElements(
          smOperational?.submodelElements,
          'CurrentTemperature'
        ),
        currentRPM: getPropertyValueFromElements(smOperational?.submodelElements, 'CurrentRPM'),
        currentTorque: getPropertyValueFromElements(
          smOperational?.submodelElements,
          'CurrentTorque'
        ),
        pieceCounter: getPropertyValueFromElements(smOperational?.submodelElements, 'PieceCounter'),
        cycleTimeMs: getPropertyValueFromElements(smOperational?.submodelElements, 'CycleTimeMs'),
        operationMode,
      },
      documents: {
        datasheetPdf: getPropertyValueFromElements(smDocs?.submodelElements, 'DatasheetPDF'),
        scientificReportPdf: getPropertyValueFromElements(
          smDocs?.submodelElements,
          'ScientificReportPDF'
        ),
      },
      funcionalidades,
      status: initialPlayStatus,
    },
  };
};

const buildSubscriptionTopicsForCps = (cps) => {
  if (!cps?.topic) return [];

  const [baseNo, baseWith] = topicVariants(cps.topic);

  const cmdNo = joinTopic(baseNo, COMMAND_TOPIC_SUFFIX);
  const cmdWith = joinTopic(baseWith, COMMAND_TOPIC_SUFFIX);

  const dataNo = joinTopic(baseNo, DATA_TOPIC_SUFFIX);
  const dataWith = joinTopic(baseWith, DATA_TOPIC_SUFFIX);

  const ackNo = joinTopic(baseNo, ACK_TOPIC_SUFFIX);
  const ackWith = joinTopic(baseWith, ACK_TOPIC_SUFFIX);

  const statusNo = joinTopic(baseNo, STATUS_TOPIC_SUFFIX);
  const statusWith = joinTopic(baseWith, STATUS_TOPIC_SUFFIX);

  const healthNo = joinTopic(baseNo, HEALTH_TOPIC_SUFFIX);
  const healthWith = joinTopic(baseWith, HEALTH_TOPIC_SUFFIX);

  const oeeNo = joinTopic(baseNo, OEE_TOPIC_SUFFIX);
  const oeeWith = joinTopic(baseWith, OEE_TOPIC_SUFFIX);

  const alarmNo = joinTopic(baseNo, ALARM_TOPIC_SUFFIX);
  const alarmWith = joinTopic(baseWith, ALARM_TOPIC_SUFFIX);

  const featWildcardNo = joinTopic(baseNo, '+/feat/+/$state');
  const featWildcardWith = joinTopic(baseWith, '+/feat/+/$state');

  const featStates = (cps.funcionalidades || []).flatMap((f) => {
    const state = f?.topics?.state;
    if (!state) return [];
    const [fsNo, fsWith] = topicVariants(state);
    return [fsNo, fsWith];
  });

  return [
    baseNo,
    baseWith,
    cmdNo,
    cmdWith,
    dataNo,
    dataWith,
    ackNo,
    ackWith,
    statusNo,
    statusWith,
    healthNo,
    healthWith,
    oeeNo,
    oeeWith,
    alarmNo,
    alarmWith,
    ...featStates,
    featWildcardNo,
    featWildcardWith,
  ].filter(Boolean);
};

async function loadMqttConnect() {
  const mod = await import('mqtt');
  const connect =
    mod?.connect ||
    mod?.default?.connect ||
    (typeof mod?.default === 'function' ? mod.default : undefined);
  return typeof connect === 'function' ? connect : null;
}



export const CPSProvider = ({ children }) => {
  const [registry, setRegistry] = useState({});
  const [addedCPS, setAddedCPS] = useState([]);
  const [log, setLog] = useState([]);
  const [mqttClient, setMqttClient] = useState(null);
  const [mqttData, setMqttData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [cpsAnalytics, setCpsAnalytics] = useState({});

  const addedCPSRef = useRef([]);
  useEffect(() => {
    addedCPSRef.current = addedCPS;
  }, [addedCPS]);

  const registryRef = useRef({});
  useEffect(() => {
    registryRef.current = registry;
  }, [registry]);

  const lastAutoUnplugRef = useRef({});
  const unplugRef = useRef(null);
  const maintenanceReturnRef = useRef({});

  const featPendingRef = useRef({});
  const featTimerRef = useRef({});
  const featLastEmitRef = useRef({});

  const availableCPS = useMemo(() => {
    return Object.values(registry)
      .filter(Boolean)
      .filter((cps, index, arr) => arr.findIndex((x) => x.id === cps.id) === index);
  }, [registry]);

  const availableCPSNames = useMemo(
    () =>
      Array.from(
        new Set(
          availableCPS
            .filter(Boolean)
            .map((cps) => cps.nome)
            .filter(Boolean)
        )
      ),
    [availableCPS]
  );

  const persistPlugEvent = useCallback(async (event) => {
    try {
      await fetch('/api/plug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch (e) {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: `[PLUG_LOG_ERROR] Failed to persist event: ${e?.message || e}`,
        },
      ]);
    }
  }, []);

  const handleAnalyticsMessage = useCallback((topic, rawPayload) => {
  try {
    const parsed = typeof rawPayload === 'string'
        ? JSON.parse(rawPayload)
        : JSON.parse(rawPayload.toString());

    // --- NORMALIZAÇÃO DO ID (IGUAL AO REGISTRO) ---
    // Remove hífens, espaços e zeros à esquerda (Ex: CPS-007 -> cps7)
    const rawCpsId = parsed?.cpsId || 'UNKNOWN';
    const cpsId = String(rawCpsId)
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '')
                    .replace(/(cps)0+/, '$1');

    if (cpsId === 'unknown') return;

    if (topic.endsWith('/oee')) {
      setCpsAnalytics((prev) => ({
        ...prev,
        [cpsId]: {
          ...(prev[cpsId] || {}),
          oee: parsed,
          lastUpdate: parsed?.ts || new Date().toISOString(),
        },
      }));
      return;
    }

    if (topic.endsWith('/learning')) {
      setCpsAnalytics((prev) => {
        const existing = prev[cpsId] || {};
        
        // Mapeamento direto do seu Payload do Node-RED para o Estado do React
        return {
          ...prev,
          [cpsId]: {
            ...existing,
            // Pegamos cada objeto do seu payload e colocamos no lugar certo
            learning: parsed.learning || existing.learning,
            reasoning: parsed.reasoning || existing.reasoning,
            oee: parsed.oee || existing.oee,
            statistics: parsed.statistics || existing.statistics,
            features: parsed.features || existing.features,
            window: parsed.window || existing.window,
            totals: parsed.totals || existing.totals,
            
            // Metadados extras
            lastUpdate: parsed.ts || new Date().toISOString(),
          },
        };
      });
    }
  } catch (err) {
    console.error('Erro ao processar mensagem analytics MQTT:', err);
  }
}, []);

  const patchRegistryCps = useCallback((cpsRef, patch) => {
    if (!cpsRef) return;

    const keys = [
      cpsRef.nome,
      cpsRef.id,
      cpsRef.topic,
      cpsRef.lifecycle?.cpsName,
      cpsRef.lifecycle?.cpsId,
      cpsRef.lifecycle?.baseTopic,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    setRegistry((prev) => {
      const next = { ...prev };

      const baseObj =
        next[String(cpsRef.nome || '').toLowerCase()] ||
        next[String(cpsRef.id || '').toLowerCase()] ||
        next[String(cpsRef.topic || '').toLowerCase()] ||
        cpsRef;

      const updated = {
        ...baseObj,
        ...patch,
        lifecycle: {
          ...(baseObj.lifecycle || {}),
          ...(patch?.lifecycle || {}),
        },
        maintenance: {
          ...(baseObj.maintenance || {}),
          ...(patch?.maintenance || {}),
        },
        updates: {
          ...(baseObj.updates || {}),
          ...(patch?.updates || {}),
          history: Array.isArray(patch?.updates?.history)
            ? patch.updates.history
            : baseObj.updates?.history || [],
        },
        globalState: {
          ...(baseObj.globalState || {}),
          ...(patch?.globalState || {}),
        },
        health: {
          ...(baseObj.health || {}),
          ...(patch?.health || {}),
        },
        oee: {
          ...(baseObj.oee || {}),
          ...(patch?.oee || {}),
        },
        operationalData: {
          ...(baseObj.operationalData || {}),
          ...(patch?.operationalData || {}),
        },
        endpoints: {
          ...(baseObj.endpoints || {}),
          ...(patch?.endpoints || {}),
        },
        documents: {
          ...(baseObj.documents || {}),
          ...(patch?.documents || {}),
        },
      };

      keys.forEach((k) => {
        next[k] = updated;
      });

      return next;
    });
  }, []);

  const appendRegistryHistory = useCallback((cpsRef, entry) => {
    if (!cpsRef || !entry) return;

    const keys = [
      cpsRef.nome,
      cpsRef.id,
      cpsRef.topic,
      cpsRef.lifecycle?.cpsName,
      cpsRef.lifecycle?.cpsId,
      cpsRef.lifecycle?.baseTopic,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    setRegistry((prev) => {
      const next = { ...prev };

      const baseObj =
        next[String(cpsRef.nome || '').toLowerCase()] ||
        next[String(cpsRef.id || '').toLowerCase()] ||
        next[String(cpsRef.topic || '').toLowerCase()] ||
        cpsRef;

      const oldHistory = Array.isArray(baseObj?.updates?.history)
        ? baseObj.updates.history
        : [];

      const alreadyExists = oldHistory.some(
        (item) => item?.id && entry?.id && String(item.id) === String(entry.id)
      );

      const newHistory = alreadyExists
        ? oldHistory
        : [entry, ...oldHistory].slice(0, 20);

      const updated = {
        ...baseObj,
        updates: {
          ...(baseObj.updates || {}),
          lastMessage: entry.message || baseObj?.updates?.lastMessage || null,
          lastType: entry.type || baseObj?.updates?.lastType || null,
          lastTs: entry.ts || baseObj?.updates?.lastTs || null,
          history: newHistory,
        },
      };

      keys.forEach((k) => {
        next[k] = updated;
      });

      return next;
    });
  }, []);

  const registerCPS = useCallback(
    (parsed) => {
      try {
        const { cps } = parseAASCps(parsed);

        setRegistry((prev) => ({
          ...prev,
          [String(cps.nome).toLowerCase()]: cps,
          [String(cps.id).toLowerCase()]: cps,
          [String(cps.topic).toLowerCase()]: cps,
          [String(cps.lifecycle?.cpsName).toLowerCase()]: cps,
          [String(cps.lifecycle?.cpsId).toLowerCase()]: cps,
          [String(cps.lifecycle?.baseTopic).toLowerCase()]: cps,
        }));

        persistPlugEvent({
          eventType: 'cps_registered',
          cpsId: cps.id,
          cpsName: cps.nome,
          topic: cps.topic,
          message: 'CPS registered in Plug Phase from AAS.',
          details: {
            server: cps.server,
            brokerPort: cps.brokerPort,
            brokerWs: cps.brokerWs,
            brokerWss: cps.brokerWss,
            dashboardUrl: cps.dashboardUrl,
            endpoints: cps.endpoints,
            lifecycle: cps.lifecycle,
            operationalData: cps.operationalData,
            documents: cps.documents,
          },
          ts: Date.now(),
        });

        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message:
              `[REGISTER] ${cps.nome} registered ` +
              `(id=${cps.id}, topic=${cps.topic}, server=${cps.server}, ws=${cps.brokerWs}).`,
          },
          {
            time: new Date().toLocaleTimeString(),
            message:
              `[AAS] Endpoints -> description=${cps.endpoints.description || '—'} | ` +
              `summary=${cps.endpoints.summary || '—'} | indicators=${cps.endpoints.indicators || '—'} | ` +
              `history=${cps.endpoints.history || '—'} | health=${cps.endpoints.health || '—'}`,
          },
          {
            time: new Date().toLocaleTimeString(),
            message:
              `[FUNCTIONS_DEBUG] ${cps.nome} -> ${
                cps.funcionalidades?.map((f) => f.key).join(', ') || 'none'
              }`,
          },
        ]);

        return true;
      } catch (err) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[REGISTER_ERROR] ${err?.message || err}`,
          },
        ]);
        return false;
      }
    },
    [persistPlugEvent]
  );

  useEffect(() => {
    let timeouts = [];

    const loadCpsFromServer = async () => {
      try {
        const res = await fetch('/api/cps');
        if (!res.ok) throw new Error('Failed to fetch /api/cps');
        const data = await res.json();
        const arr = Array.isArray(data.cps) ? data.cps : [];

        arr.forEach((parsed, index) => {
          const delay = CPS_AUTOLOAD_DELAY_MS * (index + 1);
          const id = setTimeout(() => {
            registerCPS(parsed);
          }, delay);
          timeouts.push(id);
        });
      } catch (e) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[PLUG_LOAD_ERROR] Failed to autoload CPS: ${e?.message || e}`,
          },
        ]);
      }
    };

    loadCpsFromServer();

    return () => {
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, [registerCPS]);

  const publishLifecycleCommand = useCallback(
    (cps, action) => {
      if (!mqttClient || !cps?.topic) return false;

      const cmdTopic = joinTopic(cps.topic, COMMAND_TOPIC_SUFFIX);

      const payload = {
        type: 'lifecycle_command',
        action,
        cpsId: cps.id,
        cpsName: cps.nome,
        baseTopic: cps.topic,
        lifecycleCpsId: cps.lifecycle?.cpsId || cps.id,
        lifecycleCpsName: cps.lifecycle?.cpsName || cps.nome,
        lifecycleBaseTopic: cps.lifecycle?.baseTopic || cps.topic,
        ts: Date.now(),
        source: 'ACSM',
      };

      try {
        mqttClient.publish(cmdTopic, JSON.stringify(payload), {
          qos: 1,
          retain: false,
        });

        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[CMD] ${action.toUpperCase()} sent to ${cps.nome} on ${cmdTopic}`,
          },
        ]);

        return true;
      } catch (e) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[CMD_ERROR] Failed to send ${action} to ${cps.nome}: ${
              e?.message || e
            }`,
          },
        ]);
        return false;
      }
    },
    [mqttClient]
  );

  const scheduleFeatureUiUpdate = useCallback((ownerId, featKey, statusKey, ts, details) => {
    const k = `${ownerId}::${featKey}`;
    const now = Date.now();
    const lastEmit = featLastEmitRef.current[k] || 0;
    const elapsed = now - lastEmit;

    featPendingRef.current[k] = { ownerId, featKey, statusKey, ts, details };

    const flush = () => {
      const pending = featPendingRef.current[k];
      if (!pending) return;

      featLastEmitRef.current[k] = Date.now();
      delete featPendingRef.current[k];

      const timerId = featTimerRef.current[k];
      if (timerId) clearTimeout(timerId);
      delete featTimerRef.current[k];

      setAddedCPS((prev) =>
        prev.map((c) => {
          if (c.id !== pending.ownerId) return c;

          const funcs = (c.funcionalidades || []).map((f) => {
            if (f.key !== pending.featKey) return f;
            return {
              ...f,
              statusAtual: pending.statusKey ?? (f.statusAtual ?? null),
              lastUpdate: pending.ts,
              lastDetails: pending.details,
            };
          });

          return { ...c, funcionalidades: funcs };
        })
      );

      setRegistry((prev) => {
        const next = { ...prev };

        const baseObj = Object.values(next).find((x) => x?.id === pending.ownerId);
        if (!baseObj) return prev;

        const funcs = (baseObj.funcionalidades || []).map((f) => {
          if (f.key !== pending.featKey) return f;
          return {
            ...f,
            statusAtual: pending.statusKey ?? (f.statusAtual ?? null),
            lastUpdate: pending.ts,
            lastDetails: pending.details,
          };
        });

        const updated = { ...baseObj, funcionalidades: funcs };

        [
          updated.nome,
          updated.id,
          updated.topic,
          updated.lifecycle?.cpsName,
          updated.lifecycle?.cpsId,
          updated.lifecycle?.baseTopic,
        ]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase())
          .forEach((k2) => {
            next[k2] = updated;
          });

        return next;
      });
    };

    if (elapsed >= FEATURE_UI_UPDATE_MS && !featTimerRef.current[k]) {
      flush();
      return;
    }

    if (!featTimerRef.current[k]) {
      const wait = Math.max(0, FEATURE_UI_UPDATE_MS - elapsed);
      featTimerRef.current[k] = setTimeout(flush, wait);
    }
  }, []);

  const restoreCPSFromMaintenance = useCallback(
    (cpsObj, payload = {}) => {
      if (!cpsObj) return false;

      const alreadyInPlay = addedCPSRef.current.some((c) => c.id === cpsObj.id);
      if (alreadyInPlay) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[AUTO_RETURN] ${cpsObj.nome} already in Play Phase.`,
          },
        ]);
        return false;
      }

      const completedTs = payload?.ts || Date.now();

      const maintenanceCompletedEntry = {
        id: `${cpsObj.id}-maintenance-complete-${completedTs}`,
        type: payload?.type || 'update_functions',
        title: 'Maintenance completed',
        message:
          payload?.summary ||
          'Maintenance completed. CPS resumed operation autonomously.',
        ts: completedTs,
      };

      const restored = {
        ...cpsObj,
        status: 'Rodando',
        maintenance: {
          ...(cpsObj.maintenance || {}),
          inProgress: false,
          lastEndTs: completedTs,
        },
        updates: {
          ...(cpsObj.updates || {}),
          lastMessage:
            payload?.summary ||
            'Maintenance completed. CPS resumed operation autonomously.',
          lastType: payload?.type || 'update_functions',
          lastTs: completedTs,
          history: [
            maintenanceCompletedEntry,
            ...(Array.isArray(cpsObj?.updates?.history) ? cpsObj.updates.history : []),
          ].slice(0, 20),
        },
        globalState: {
          ...(cpsObj.globalState || {}),
          state: 'running',
          status: 'running',
          summary:
            payload?.summary || 'CPS returned automatically after maintenance.',
          lastUpdate: completedTs,
        },
      };

      setAddedCPS((prev) => [...prev, restored]);

      patchRegistryCps(cpsObj, {
        status: 'Rodando',
        maintenance: {
          inProgress: false,
          lastEndTs: completedTs,
        },
        updates: {
          lastMessage:
            payload?.summary ||
            'Maintenance completed. CPS resumed operation autonomously.',
          lastType: payload?.type || 'update_functions',
          lastTs: completedTs,
        },
        globalState: {
          state: 'running',
          status: 'running',
          summary:
            payload?.summary || 'CPS returned automatically after maintenance.',
          lastUpdate: completedTs,
        },
      });

      appendRegistryHistory(cpsObj, maintenanceCompletedEntry);

      persistPlugEvent({
        eventType: 'maintenance_completed',
        cpsId: cpsObj.id,
        cpsName: cpsObj.nome,
        topic: cpsObj.topic,
        message:
          payload?.summary ||
          'Maintenance completed. CPS resumed operation autonomously.',
        details: {
          historyEntry: maintenanceCompletedEntry,
          payload,
        },
        ts: completedTs,
      });

      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message:
            `[AUTO_RETURN] ${restored.nome} returned automatically to Play Phase ` +
            `after maintenance (id=${restored.id}, topic=${restored.topic}).`,
        },
        {
          time: new Date().toLocaleTimeString(),
          message:
            `[UPDATE_FUNCTIONS] ${restored.nome} notified ACSM that maintenance was completed ` +
            `and the CPS resumed operation autonomously.`,
        },
      ]);

      return true;
    },
    [patchRegistryCps, appendRegistryHistory, persistPlugEvent]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let client;

    const start = async () => {
      try {
        const connect = await loadMqttConnect();
        if (!connect) {
          setLog((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message: '[MQTT_ERROR] Could not load mqtt connect(). Recommend mqtt@^5.',
            },
          ]);
          return;
        }

        client = connect(DEFAULT_BROKER_URL, {
          clean: true,
          reconnectPeriod: 1000,
          clientId: `cps-ui-${Math.random().toString(16).slice(2)}`,
        });

        client.on('connect', () => {
          setMqttClient(client);
          
          setLog((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message: `[MQTT] Connected to ${DEFAULT_BROKER_URL}`,
            },
          ]);

          // Subscrição direta e limpa usando Wildcards para todos os CPS
          // Isso garante que qualquer tópico terminando em /oee ou /learning seja capturado
          const analyticsSubs = ['+/oee', '+/learning'];

          client.subscribe(analyticsSubs, (err) => {
            setLog((prev) => [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                message: err
                  ? `[MQTT_ERROR] Subscribe analytics failed (${err?.message || err})`
                  : `[MQTT] Subscribed to Analytics Wildcards: ${analyticsSubs.join(', ')}`,
              },
            ]);
          });
        });

        client.on('message', (topic, message) => {
          const rawTopic = String(topic || '').trim();
          const normIncoming = normalizeTopic(rawTopic);

          if (DEBUG_LOG_ALL_TOPICS) {
            setLog((prev) => [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                message: `[DEBUG] msg in '${rawTopic}': ${message?.toString?.()}`,
              },
            ]);
          }

          // Removemos a checagem do startsWith e mantemos apenas os sufixos
const isAnalyticsTopic = 
  normIncoming.endsWith('/oee') || 
  normIncoming.endsWith('/learning');

if (isAnalyticsTopic) {
  handleAnalyticsMessage(normIncoming, message);
  return;
}

          const current = addedCPSRef.current;

          const owner = current.find((cps) => {
            const base = normalizeTopic(cps.topic);
            return normIncoming === base || normIncoming.startsWith(`${base}/`);
          });

          if (!owner) return;

          const isAck =
            normIncoming.endsWith(`/${ACK_TOPIC_SUFFIX}`) ||
            normIncoming.includes(`/${ACK_TOPIC_SUFFIX}/`);

          if (isAck) {
            try {
              const ack = JSON.parse(message.toString());

              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[ACK] ${owner.nome} -> action=${ack?.action || '—'} ok=${String(
                    ack?.ok ?? '—'
                  )}`,
                },
              ]);
            } catch (e) {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[ACK] non-JSON payload in '${rawTopic}': ${message?.toString?.()}`,
                },
              ]);
            }
            return;
          }

          const isData =
            normIncoming.endsWith(`/${DATA_TOPIC_SUFFIX}`) ||
            normIncoming.includes(`/${DATA_TOPIC_SUFFIX}/`);

          const isStatus =
            normIncoming.endsWith(`/${STATUS_TOPIC_SUFFIX}`) ||
            normIncoming.includes(`/${STATUS_TOPIC_SUFFIX}/`);

          const isHealth =
            normIncoming.endsWith(`/${HEALTH_TOPIC_SUFFIX}`) ||
            normIncoming.includes(`/${HEALTH_TOPIC_SUFFIX}/`);

          const isOee =
            normIncoming.endsWith(`/${OEE_TOPIC_SUFFIX}`) ||
            normIncoming.includes(`/${OEE_TOPIC_SUFFIX}/`);

          const isAlarm =
            normIncoming.endsWith(`/${ALARM_TOPIC_SUFFIX}`) ||
            normIncoming.includes(`/${ALARM_TOPIC_SUFFIX}/`);

          const isRunningInUi = String(owner.status).toLowerCase() === 'rodando';

          const featInfo = parseFeatureStateTopic(owner.topic, normIncoming);
          if (featInfo?.featKey) {
            if (!isRunningInUi) return;

            let payload = null;
            try {
              payload = JSON.parse(message.toString());
            } catch (e) {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[FEAT] non-JSON payload in '${rawTopic}': ${message?.toString?.()}`,
                },
              ]);
              return;
            }

            const statusKey = normalizeFeatureStatusEN(payload?.status);
            const ts = payload?.ts || Date.now();
            const details = payload?.details;

            scheduleFeatureUiUpdate(owner.id, featInfo.featKey, statusKey, ts, details);

            if (statusKey === 'failure' || statusKey === 'maintenance') {
              const compName =
                owner.funcionalidades?.find((f) => f.key === featInfo.featKey)?.nome ||
                featInfo.featKey;

              const alertObj = {
                id: `${owner.id}-${featInfo.featKey}-${ts}`,
                cpsId: owner.id,
                cpsName: owner.nome,
                component: compName,
                severity: statusKey === 'failure' ? 'high' : 'medium',
                timestamp: new Date(ts).toISOString(),
                raw: {
                  type: 'feature_state',
                  status: statusKey,
                  featKey: featInfo.featKey,
                  plant: featInfo.plant,
                  details,
                },
              };

              setAlerts((prev) => [alertObj, ...prev].slice(0, 200));
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[FEAT] ${owner.nome} • ${compName} -> status=${statusKey}`,
                },
              ]);
            }

            return;
          }

          if (isHealth) {
            try {
              const data = JSON.parse(message.toString());

              setAddedCPS((prev) =>
                prev.map((c) =>
                  c.id === owner.id
                    ? {
                        ...c,
                        health: {
                          score: data?.healthScore ?? c?.health?.score ?? null,
                          label: data?.healthLabel ?? c?.health?.label ?? null,
                          sourceStatus: data?.sourceStatus ?? c?.health?.sourceStatus ?? null,
                          lastUpdate: data?.ts ?? Date.now(),
                        },
                      }
                    : c
                )
              );

              patchRegistryCps(owner, {
                health: {
                  score: data?.healthScore ?? owner?.health?.score ?? null,
                  label: data?.healthLabel ?? owner?.health?.label ?? null,
                  sourceStatus: data?.sourceStatus ?? owner?.health?.sourceStatus ?? null,
                  lastUpdate: data?.ts ?? Date.now(),
                },
              });

              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[HEALTH] ${owner.nome} -> score=${data?.healthScore} label=${data?.healthLabel}`,
                },
              ]);
            } catch (e) {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[HEALTH] non-JSON payload in '${rawTopic}': ${message?.toString?.()}`,
                },
              ]);
            }
            return;
          }

          if (isOee) {
            try {
              const data = JSON.parse(message.toString());

              setAddedCPS((prev) =>
                prev.map((c) =>
                  c.id === owner.id
                    ? {
                        ...c,
                        oee: {
                          availability: data?.availability ?? null,
                          performance: data?.performance ?? null,
                          quality: data?.quality ?? null,
                          value: data?.oee ?? null,
                          totals: data?.totals ?? null,
                          sourceStatus: data?.sourceStatus ?? null,
                          lastUpdate: data?.ts ?? Date.now(),
                        },
                      }
                    : c
                )
              );

              patchRegistryCps(owner, {
                oee: {
                  availability: data?.availability ?? null,
                  performance: data?.performance ?? null,
                  quality: data?.quality ?? null,
                  value: data?.oee ?? null,
                  totals: data?.totals ?? null,
                  sourceStatus: data?.sourceStatus ?? null,
                  lastUpdate: data?.ts ?? Date.now(),
                },
              });

              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message:
                    `[OEE] ${owner.nome} -> ` +
                    `A=${String(data?.availability ?? '—')} ` +
                    `P=${String(data?.performance ?? '—')} ` +
                    `Q=${String(data?.quality ?? '—')} ` +
                    `OEE=${String(data?.oee ?? '—')}`,
                },
              ]);
            } catch (e) {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[OEE] non-JSON payload in '${rawTopic}': ${message?.toString?.()}`,
                },
              ]);
            }
            return;
          }

          if (isStatus) {
            try {
              const data = JSON.parse(message.toString());
              const incomingState = data?.state ?? data?.status ?? null;

              if (
                data &&
                (incomingState || Object.prototype.hasOwnProperty.call(data, 'playEnabled'))
              ) {
                setAddedCPS((prev) =>
                  prev.map((c) =>
                    c.id === owner.id
                      ? {
                          ...c,
                          status:
                            incomingState === 'running'
                              ? 'Rodando'
                              : incomingState === 'stopped'
                              ? 'Parado'
                              : incomingState === 'maintenance'
                              ? 'Parado'
                              : c.status,
                          globalState: {
                            state: incomingState,
                            status: incomingState,
                            playEnabled: data?.playEnabled ?? null,
                            healthScore: data?.healthScore ?? null,
                            healthLabel: data?.healthLabel ?? null,
                            featureCount: data?.featureCount ?? c?.globalState?.featureCount ?? null,
                            summary: data?.summary ?? null,
                            lastUpdate: data?.ts ?? Date.now(),
                          },
                        }
                      : c
                  )
                );

                patchRegistryCps(owner, {
                  status:
                    incomingState === 'running'
                      ? 'Rodando'
                      : incomingState === 'stopped'
                      ? 'Parado'
                      : incomingState === 'maintenance'
                      ? 'Parado'
                      : owner.status,
                  globalState: {
                    state: incomingState,
                    status: incomingState,
                    playEnabled: data?.playEnabled ?? null,
                    healthScore: data?.healthScore ?? null,
                    healthLabel: data?.healthLabel ?? null,
                    featureCount: data?.featureCount ?? owner?.globalState?.featureCount ?? null,
                    summary: data?.summary ?? null,
                    lastUpdate: data?.ts ?? Date.now(),
                  },
                });

                setLog((prev) => [
                  ...prev,
                  {
                    time: new Date().toLocaleTimeString(),
                    message:
                      `[STATUS] ${owner.nome} -> state=${incomingState ?? '—'} ` +
                      `play=${String(data?.playEnabled ?? '—')} ` +
                      `health=${String(data?.healthScore ?? '—')}`,
                  },
                ]);

                return;
              }

              const variable = data?.variable || 'variable';
              const value = data?.value;
              const sev =
                data?.severity ||
                (data?.below_threshold === true ? 'low' : 'medium');

              const alertObj = {
                id: data.correlation_id || `${owner.id}-${variable}-${Date.now()}`,
                correlation_id: data.correlation_id,
                cpsId: owner.id,
                cpsName: owner.nome,
                component: data.component || 'Status',
                severity: sev,
                timestamp: data.timestamp || new Date().toISOString(),
                raw: data,
              };

              setAlerts((prev) => [alertObj, ...prev].slice(0, 200));

              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[STATUS] ${owner.nome} • ${variable}=${value} (sev=${sev})`,
                },
              ]);
            } catch (e) {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[STATUS] non-JSON payload in '${rawTopic}': ${message?.toString?.()}`,
                },
              ]);
            }
            return;
          }

          if (isAlarm) {
            try {
              const data = JSON.parse(message.toString());

              const alertObj = {
                id: data?.correlation_id || `${owner.id}-alarm-${Date.now()}`,
                correlation_id: data?.correlation_id,
                cpsId: owner.id,
                cpsName: owner.nome,
                component: data?.component || 'Alarm',
                severity: data?.severity || 'high',
                timestamp: data?.timestamp || new Date().toISOString(),
                raw: data,
              };

              setAlerts((prev) => [alertObj, ...prev].slice(0, 200));

              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[ALARM] ${owner.nome} • ${alertObj.component} • sev=${alertObj.severity}`,
                },
              ]);
            } catch (e) {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[ALARM] non-JSON payload in '${rawTopic}': ${message?.toString?.()}`,
                },
              ]);
            }
            return;
          }

          if (isData) {
            if (!isRunningInUi) return;

            try {
              const data = JSON.parse(message.toString());

              if (!(data && data.type === 'alert')) {
                setMqttData((prev) => ({ ...prev, [owner.id]: data }));

                setAddedCPS((prev) =>
                  prev.map((c) =>
                    c.id === owner.id
                      ? {
                          ...c,
                          operationalData: {
                            ...(c.operationalData || {}),
                            currentTemperature:
                              data?.currentTemperature ??
                              data?.temperature ??
                              c?.operationalData?.currentTemperature ??
                              null,
                            currentRPM:
                              data?.currentRPM ?? data?.rpm ?? c?.operationalData?.currentRPM ?? null,
                            currentTorque:
                              data?.currentTorque ??
                              data?.torque ??
                              c?.operationalData?.currentTorque ??
                              null,
                            pieceCounter:
                              data?.pieceCounter ??
                              data?.count ??
                              c?.operationalData?.pieceCounter ??
                              null,
                            cycleTimeMs:
                              data?.cycleTimeMs ??
                              data?.cycle_time_ms ??
                              c?.operationalData?.cycleTimeMs ??
                              null,
                            operationMode:
                              data?.operationMode ??
                              c?.operationalData?.operationMode ??
                              null,
                          },
                        }
                      : c
                  )
                );

                patchRegistryCps(owner, {
                  operationalData: {
                    currentTemperature:
                      data?.currentTemperature ??
                      data?.temperature ??
                      owner?.operationalData?.currentTemperature ??
                      null,
                    currentRPM:
                      data?.currentRPM ?? data?.rpm ?? owner?.operationalData?.currentRPM ?? null,
                    currentTorque:
                      data?.currentTorque ??
                      data?.torque ??
                      owner?.operationalData?.currentTorque ??
                      null,
                    pieceCounter:
                      data?.pieceCounter ?? data?.count ?? owner?.operationalData?.pieceCounter ?? null,
                    cycleTimeMs:
                      data?.cycleTimeMs ??
                      data?.cycle_time_ms ??
                      owner?.operationalData?.cycleTimeMs ??
                      null,
                    operationMode:
                      data?.operationMode ?? owner?.operationalData?.operationMode ?? null,
                  },
                });
              }

              if (data && data.type === 'alert') {
                const alertObj = {
                  id: data.correlation_id || `${owner.id}-${Date.now()}`,
                  correlation_id: data.correlation_id,
                  cpsId: owner.id,
                  cpsName: owner.nome,
                  component: data.component,
                  severity: data.severity || 'low',
                  risk_score: data.risk_score,
                  predicted_ttf_hours: data.predicted_ttf_hours,
                  timestamp: data.timestamp || new Date().toISOString(),
                  raw: data,
                };

                setAlerts((prev) => [alertObj, ...prev].slice(0, 200));

                setLog((prev) => [
                  ...prev,
                  {
                    time: new Date().toLocaleTimeString(),
                    message: `[ALERT] ${owner.nome} • ${alertObj.component} • sev=${alertObj.severity} • risk=${alertObj.risk_score}`,
                  },
                ]);
              }
            } catch (e) {
              setMqttData((prev) => ({ ...prev, [owner.id]: message.toString() }));
            }
            return;
          }
        });

        client.on('error', (err) => {
          setLog((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message: `[MQTT_ERROR] ${err?.message || String(err)}`,
            },
          ]);
        });
      } catch (e) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[MQTT_ERROR] Failed to import/connect mqtt: ${e?.message || e}`,
          },
        ]);
      }
    };

    start();

    return () => {
      try {
        Object.values(featTimerRef.current).forEach((id) => clearTimeout(id));
      } catch (e) {}
      featTimerRef.current = {};
      featPendingRef.current = {};
      featLastEmitRef.current = {};

      if (client) client.end(true);
    };
  }, [patchRegistryCps, scheduleFeatureUiUpdate, handleAnalyticsMessage]);

  useEffect(() => {
    if (!mqttClient) return;

    const [tNo, tWith] = topicVariants(LIFECYCLE_UNPLUG_REQUEST_TOPIC);
    const subs = [tNo, tWith];

    const safeParse = (buf) => {
      try {
        const s = buf?.toString?.() ?? '';
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    };

    const onLifecycleMessage = async (topic, message) => {
      const rawTopic = String(topic || '').trim();
      const norm = normalizeTopic(rawTopic);

      if (norm !== normalizeTopic(LIFECYCLE_UNPLUG_REQUEST_TOPIC)) return;

      const evt = safeParse(message);
      if (!evt) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[LIFECYCLE] unplug_request inválido (não JSON).`,
          },
        ]);
        return;
      }

      const evtName = String(evt?.cpsName || '').trim().toLowerCase();
      const evtId = String(evt?.cpsId || '').trim().toLowerCase();
      const evtBaseTopic = normalizeTopic(evt?.baseTopic || '');
      const evtReason = String(evt?.reason || '').trim();
      const workedMs = Number(evt?.workedMs || 0);

      const current = addedCPSRef.current || [];

      const target = current.find((c) => {
        const byName =
          evtName &&
          (String(c.nome || '').trim().toLowerCase() === evtName ||
            String(c.lifecycle?.cpsName || '').trim().toLowerCase() === evtName);

        const byId =
          evtId &&
          (String(c.id || '').trim().toLowerCase() === evtId ||
            String(c.lifecycle?.cpsId || '').trim().toLowerCase() === evtId);

        const byTopic =
          evtBaseTopic &&
          (normalizeTopic(c.topic) === evtBaseTopic ||
            normalizeTopic(c.lifecycle?.baseTopic) === evtBaseTopic);

        return byName || byId || byTopic;
      });

      if (!target) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[LIFECYCLE] unplug_request recebido, mas nenhum CPS correspondente está em Play. payload=${JSON.stringify(
              evt
            )}`,
          },
        ]);
        return;
      }

      const dedupKey = String(
        target.lifecycle?.cpsId ||
          target.lifecycle?.baseTopic ||
          target.id ||
          target.topic ||
          target.nome
      ).toLowerCase();

      const last = lastAutoUnplugRef.current[dedupKey];
      if (last && Date.now() - last.ts < AUTOUNPLUG_DEDUP_MS) return;

      lastAutoUnplugRef.current[dedupKey] = { ts: Date.now(), workedMs };

      if (isMaintenanceReason(evtReason)) {
        maintenanceReturnRef.current[dedupKey] = {
          allowed: true,
          cpsId: target.id,
          cpsName: target.nome,
          topic: target.topic,
          reason: evtReason,
          unplugTs: Date.now(),
        };

        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message:
              `[MAINTENANCE_FLAG] ${target.nome} marked as eligible for automatic return ` +
              `(reason=${evtReason}).`,
          },
        ]);
      }

      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message:
            `[LIFECYCLE] AUTOUNPLUG '${target.nome}' ` +
            `(reason=${evtReason || '—'}, workedMs=${workedMs}, ` +
            `topic=${target.topic}, id=${target.id}).`,
        },
      ]);

      try {
        const maintenanceTs = Date.now();

        const maintenanceHistoryEntry = {
          id: `${target.id}-maintenance-start-${maintenanceTs}`,
          type: 'maintenance_started',
          title: 'Maintenance started',
          message: 'Autonomous maintenance started after awaiting replacement.',
          ts: maintenanceTs,
        };

        setAddedCPS((prev) =>
          prev.map((c) =>
            c.id === target.id
              ? {
                  ...c,
                  maintenance: {
                    ...(c.maintenance || {}),
                    inProgress: true,
                    lastStartTs: maintenanceTs,
                  },
                  updates: {
                    ...(c.updates || {}),
                    lastMessage:
                      'Autonomous maintenance started after awaiting replacement.',
                    lastType: 'maintenance_started',
                    lastTs: maintenanceTs,
                    history: [
                      maintenanceHistoryEntry,
                      ...(Array.isArray(c.updates?.history) ? c.updates.history : []),
                    ].slice(0, 20),
                  },
                }
              : c
          )
        );

        patchRegistryCps(target, {
          maintenance: {
            inProgress: true,
            lastStartTs: maintenanceTs,
          },
          updates: {
            lastMessage: 'Autonomous maintenance started after awaiting replacement.',
            lastType: 'maintenance_started',
            lastTs: maintenanceTs,
          },
        });

        appendRegistryHistory(target, maintenanceHistoryEntry);

        persistPlugEvent({
          eventType: 'maintenance_started',
          cpsId: target.id,
          cpsName: target.nome,
          topic: target.topic,
          message: 'Autonomous maintenance started after awaiting replacement.',
          details: {
            historyEntry: maintenanceHistoryEntry,
            reason: evtReason,
          },
          ts: maintenanceTs,
        });

        await Promise.resolve(unplugRef.current?.(target.nome));
      } catch (e) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[LIFECYCLE_ERROR] Failed to autounplug '${target.nome}': ${
              e?.message || e
            }`,
          },
        ]);
      }
    };

    mqttClient.subscribe(subs, (err) => {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: err
            ? `[MQTT_ERROR] Subscribe lifecycle failed (${err?.message || err})`
            : `[MQTT] Subscribed lifecycle: ${subs.join(', ')}`,
        },
      ]);
    });

    mqttClient.on('message', onLifecycleMessage);

    return () => {
      try {
        mqttClient.unsubscribe(subs);
      } catch (e) {}
      try {
        mqttClient.off?.('message', onLifecycleMessage);
        mqttClient.removeListener?.('message', onLifecycleMessage);
      } catch (e) {}
    };
  }, [mqttClient, patchRegistryCps, appendRegistryHistory, persistPlugEvent]);

  useEffect(() => {
    if (!mqttClient) return;

    const [tNo, tWith] = topicVariants(LIFECYCLE_UPDATE_FUNCTIONS_TOPIC);
    const subs = [tNo, tWith];

    const safeParse = (buf) => {
      try {
        const s = buf?.toString?.() ?? '';
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    };

    const onUpdateFunctionsMessage = (topic, message) => {
      const rawTopic = String(topic || '').trim();
      const norm = normalizeTopic(rawTopic);

      if (norm !== normalizeTopic(LIFECYCLE_UPDATE_FUNCTIONS_TOPIC)) return;

      const evt = safeParse(message);
      if (!evt) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[UPDATE_FUNCTIONS] invalid payload (non-JSON).`,
          },
        ]);
        return;
      }

      const evtName = String(evt?.cpsName || '').trim().toLowerCase();
      const evtId = String(evt?.cpsId || '').trim().toLowerCase();
      const evtBaseTopic = normalizeTopic(evt?.baseTopic || '');
      const evtReason = String(evt?.reason || '').trim().toLowerCase();

      const registryCandidates = Object.values(registryRef.current || {}).filter(Boolean);

      const target = registryCandidates.find((c) => {
        const byName =
          evtName &&
          (String(c.nome || '').trim().toLowerCase() === evtName ||
            String(c.lifecycle?.cpsName || '').trim().toLowerCase() === evtName);

        const byId =
          evtId &&
          (String(c.id || '').trim().toLowerCase() === evtId ||
            String(c.lifecycle?.cpsId || '').trim().toLowerCase() === evtId);

        const byTopic =
          evtBaseTopic &&
          (normalizeTopic(c.topic) === evtBaseTopic ||
            normalizeTopic(c.lifecycle?.baseTopic) === evtBaseTopic);

        return byName || byId || byTopic;
      });

      if (!target) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[UPDATE_FUNCTIONS] no CPS found in registry for payload=${JSON.stringify(
              evt
            )}`,
          },
        ]);
        return;
      }

      const dedupKey = String(
        target.lifecycle?.cpsId ||
          target.lifecycle?.baseTopic ||
          target.id ||
          target.topic ||
          target.nome
      ).toLowerCase();

      const maintInfo = maintenanceReturnRef.current[dedupKey];

      if (!maintInfo?.allowed) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message:
              `[UPDATE_FUNCTIONS] ${target.nome} sent return notification, ` +
              `but automatic return is not allowed for this CPS.`,
          },
        ]);
        return;
      }

      if (!isMaintenanceReason(evtReason || maintInfo?.reason)) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message:
              `[UPDATE_FUNCTIONS] ${target.nome} notification ignored because reason is not maintenance.`,
          },
        ]);
        return;
      }

      const restored = restoreCPSFromMaintenance(target, evt);

      if (restored) {
        delete maintenanceReturnRef.current[dedupKey];
      }
    };

    mqttClient.subscribe(subs, (err) => {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: err
            ? `[MQTT_ERROR] Subscribe update_functions failed (${err?.message || err})`
            : `[MQTT] Subscribed lifecycle update_functions: ${subs.join(', ')}`,
        },
      ]);
    });

    mqttClient.on('message', onUpdateFunctionsMessage);

    return () => {
      try {
        mqttClient.unsubscribe(subs);
      } catch (e) {}
      try {
        mqttClient.off?.('message', onUpdateFunctionsMessage);
        mqttClient.removeListener?.('message', onUpdateFunctionsMessage);
      } catch (e) {}
    };
  }, [mqttClient, restoreCPSFromMaintenance]);

  useEffect(() => {
    if (!mqttClient) return;

    const topicsToSubscribe = addedCPS.flatMap(buildSubscriptionTopicsForCps);
    const uniqueSubs = [...new Set(topicsToSubscribe)];
    if (!uniqueSubs.length) return;

    mqttClient.subscribe(uniqueSubs, (err) => {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: err
            ? `[MQTT_ERROR] Subscribe failed (${err?.message || err})`
            : `[MQTT] Subscribed: ${uniqueSubs.join(', ')}`,
        },
      ]);
    });

    return () => {
      try {
        mqttClient.unsubscribe(uniqueSubs);
      } catch (e) {}
    };
  }, [mqttClient, addedCPS]);

  const addCPS = (cpsName, options = {}) => {
    const { startAfterPlug = true } = options;
    const lower = String(cpsName || '').toLowerCase();
    const fromRegistry = registry[lower];

    if (!fromRegistry) {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: `[ERROR] ${cpsName} not found in registry (load JSON first).`,
        },
      ]);
      return false;
    }

    if (addedCPSRef.current.some((c) => c.id === fromRegistry.id)) {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: `[WARN] ${cpsName} already plugged.`,
        },
      ]);
      return false;
    }

    const initialStatus = startAfterPlug ? 'Rodando' : 'Parado';
    const cps = {
      ...fromRegistry,
      status: initialStatus,
      lifecycle: {
        ...(fromRegistry.lifecycle || {}),
        currentPhase: 'play',
      },
      globalState: {
        ...(fromRegistry.globalState || {}),
        state: startAfterPlug ? 'running' : 'stopped',
        status: startAfterPlug ? 'running' : 'stopped',
        playEnabled: startAfterPlug,
        lastUpdate: Date.now(),
      },
    };

    setAddedCPS((prev) => [...prev, cps]);

    patchRegistryCps(fromRegistry, {
      status: initialStatus,
      lifecycle: {
        currentPhase: 'play',
      },
      globalState: {
        state: startAfterPlug ? 'running' : 'stopped',
        status: startAfterPlug ? 'running' : 'stopped',
        playEnabled: startAfterPlug,
        lastUpdate: Date.now(),
      },
    });

    setLog((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        message:
          `[PLAY] ${cps.nome} moved to Play Phase ` +
          `(id=${cps.id}, topic=${cps.topic}, autoStart=${startAfterPlug}).`,
      },
    ]);

    if (startAfterPlug) {
      setTimeout(() => {
        publishLifecycleCommand(cps, 'play');
      }, 200);
    }

    persistPlugEvent({
      eventType: 'cps_moved_to_play',
      cpsId: cps.id,
      cpsName: cps.nome,
      topic: cps.topic,
      message: 'CPS moved from Plug Phase to Play Phase.',
      details: {
        autoStart: startAfterPlug,
      },
      ts: Date.now(),
    });

    return true;
  };

  const removeCPS = (cpsName) => {
    const lower = String(cpsName || '').toLowerCase();
    const removed = addedCPSRef.current.find((c) => c.nome.toLowerCase() === lower);

    if (!removed) {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: `[WARN] ${cpsName} not plugged.`,
        },
      ]);
      return false;
    }

    if (mqttClient) {
      const topics = buildSubscriptionTopicsForCps(removed);
      mqttClient.unsubscribe(topics);

      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: `[MQTT] Unsubscribe: ${topics.join(', ')}`,
        },
      ]);
    }

    setAddedCPS((prev) => prev.filter((c) => c.nome.toLowerCase() !== lower));

    setMqttData((prev) => {
      const x = { ...prev };
      delete x[removed.id];
      return x;
    });

    patchRegistryCps(removed, {
      lifecycle: {
        currentPhase: 'plug',
      },
      globalState: {
        state: 'ready',
        status: 'ready',
        playEnabled: false,
        lastUpdate: Date.now(),
      },
      status: 'Parado',
    });

    setLog((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        message: `[PLAY] ${removed.nome} removed from Play Phase.`,
      },
    ]);

    return true;
  };

  const startCPSById = (cpsId) => {
    const cps = addedCPSRef.current.find((c) => c.id === cpsId);
    if (!cps) return;

    publishLifecycleCommand(cps, 'play');

    setAddedCPS((prev) =>
      prev.map((c) =>
        c.id === cpsId
          ? {
              ...c,
              status: 'Rodando',
              globalState: {
                ...(c.globalState || {}),
                state: 'running',
                status: 'running',
                playEnabled: true,
                lastUpdate: Date.now(),
              },
            }
          : c
      )
    );

    patchRegistryCps(cps, {
      status: 'Rodando',
      lifecycle: {
        currentPhase: 'play',
      },
      globalState: {
        state: 'running',
        status: 'running',
        playEnabled: true,
        lastUpdate: Date.now(),
      },
    });

    setLog((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        message: `[PLAY] ${cps.nome} started by ACSM command.`,
      },
    ]);
  };

  const stopCPSById = (cpsId) => {
    const cps = addedCPSRef.current.find((c) => c.id === cpsId);
    if (!cps) return;

    publishLifecycleCommand(cps, 'stop');

    setAddedCPS((prev) =>
      prev.map((c) =>
        c.id === cpsId
          ? {
              ...c,
              status: 'Parado',
              globalState: {
                ...(c.globalState || {}),
                state: 'stopped',
                status: 'stopped',
                playEnabled: false,
                lastUpdate: Date.now(),
              },
            }
          : c
      )
    );

    patchRegistryCps(cps, {
      status: 'Parado',
      globalState: {
        state: 'stopped',
        status: 'stopped',
        playEnabled: false,
        lastUpdate: Date.now(),
      },
    });

    setMqttData((prev) => {
      const next = { ...prev };
      delete next[cpsId];
      return next;
    });

    setLog((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        message: `[STOP] ${cps.nome} stopped by ACSM command.`,
      },
    ]);
  };

  const unplugCPS = useCallback(
    async (cpsName) => {
      const lower = String(cpsName || '').toLowerCase();
      const removed = addedCPSRef.current.find((c) => c.nome.toLowerCase() === lower);

      if (!removed) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[WARN] ${cpsName} not plugged.`,
          },
        ]);
        return false;
      }

      publishLifecycleCommand(removed, 'unplug');

      if (mqttClient) {
        const topics = buildSubscriptionTopicsForCps(removed);
        try {
          mqttClient.unsubscribe(topics);
        } catch (e) {}
      }

      setAddedCPS((prev) => prev.filter((c) => c.nome.toLowerCase() !== lower));

      setMqttData((prev) => {
        const x = { ...prev };
        delete x[removed.id];
        return x;
      });

      patchRegistryCps(removed, {
        status: 'Parado',
        lifecycle: {
          currentPhase: 'plug',
        },
        globalState: {
          state: 'unplugged',
          status: 'unplugged',
          playEnabled: false,
          lastUpdate: Date.now(),
        },
      });

      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message:
            `[UNPLUG] ${removed.nome} removed from architecture ` +
            `(id=${removed.id}, topic=${removed.topic}). CPS keeps running independently.`,
        },
      ]);

      persistPlugEvent({
        eventType: 'cps_unplugged',
        cpsId: removed.id,
        cpsName: removed.nome,
        topic: removed.topic,
        message: 'CPS removed from Play Phase and architecture.',
        details: {
          source: 'ACSM',
        },
        ts: Date.now(),
      });

      return true;
    },
    [mqttClient, publishLifecycleCommand, persistPlugEvent, patchRegistryCps]
  );

  useEffect(() => {
    unplugRef.current = unplugCPS;
  }, [unplugCPS]);

  const toggleCPSStatus = (cpsId, newStatus) => {
    if (newStatus === 'Rodando') startCPSById(cpsId);
    else if (newStatus === 'Parado') stopCPSById(cpsId);
  };

  const getMQTTOperations = useCallback(() => {
    if (addedCPS.length === 0) {
      return 'No CPS added. Connect to broker to receive data.';
    }

    return addedCPS
      .map((cps) => {
        const currentData = mqttData[cps.id];
        const feats = (cps.funcionalidades || [])
          .map((f) => `${f.nome}=${String(f.statusAtual ?? '—')}`)
          .join(', ');
        const featLine = feats ? ` • Feat: [${feats}]` : '';

        if (String(cps.status).toLowerCase() !== 'rodando') {
          return `${cps.nome} (${cps.server}/${cps.topic}): Stopped${featLine}`;
        }

        if (currentData && typeof currentData === 'object') {
          return `${cps.nome} (${cps.server}/${cps.topic}): ${JSON.stringify(currentData)}${featLine}`;
        }

        const last = currentData || 'Waiting...';
        return `${cps.nome} (${cps.server}/${cps.topic}): Last Msg: ${last}${featLine}`;
      })
      .join('\n\n');
  }, [addedCPS, mqttData]);

  const acknowledgeAlert = (idOrCorrelation) => {
    setAlerts((prev) =>
      prev.filter((a) => a.id !== idOrCorrelation && a.correlation_id !== idOrCorrelation)
    );

    setLog((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        message: `[INFO] Alert acknowledged (${idOrCorrelation}).`,
      },
    ]);
  };

  const clearAlerts = () => {
    setAlerts([]);
    setLog((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        message: `[INFO] Alerts cleared.`,
      },
    ]);
  };

  const clearLog = () => {
    setLog([
      {
        time: new Date().toLocaleTimeString(),
        message: '[INFO] Log cleared.',
      },
    ]);
  };

  return (
    <CPSContext.Provider
      value={{
        availableCPSNames,
        availableCPS,
        addedCPS,
        log,
        registerCPS,
        addCPS,
        removeCPS,
        startCPSById,
        stopCPSById,
        unplugCPS,
        toggleCPSStatus,
        clearLog,
        alerts,
        acknowledgeAlert,
        clearAlerts,
        cpsAnalytics,
        setCpsAnalytics,
        getMQTTOperations,
      }}
    >
      {children}
    </CPSContext.Provider>
  );
};