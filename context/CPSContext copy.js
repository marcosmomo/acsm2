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

const hasKeys = (obj) =>
  !!obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0;

const hasItems = (arr) => Array.isArray(arr) && arr.length > 0;

export const useCPSContext = () => {
  const context = useContext(CPSContext);

  if (!context) {
    throw new Error('useCPSContext must be used within a CPSProvider');
  }

  return context;
};

const DEFAULT_BROKER_URL =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? 'wss://broker.hivemq.com:8884/mqtt'
    : 'ws://broker.hivemq.com:8000/mqtt';

const joinTopic = (base, suffix) =>
  `${String(base).replace(/\/+$/, '')}/${String(suffix).replace(/^\/+/, '')}`;

const COMMAND_TOPIC_SUFFIX = 'cmd';
const DATA_TOPIC_SUFFIX = 'data';
const ACK_TOPIC_SUFFIX = 'ack';
const STATUS_TOPIC_SUFFIX = 'status';
const HEALTH_TOPIC_SUFFIX = 'health';
const ALARM_TOPIC_SUFFIX = 'alarm';
const OEE_TOPIC_SUFFIX = 'oee';
const LEARNING_TOPIC_SUFFIX = 'learning';

const DEBUG_LOG_ALL_TOPICS = true;
const CPS_AUTOLOAD_DELAY_MS = 3000;
const FEATURE_UI_UPDATE_MS = 5000;

const LIFECYCLE_UNPLUG_REQUEST_TOPIC = 'acsm/lifecycle/unplug_request';
const LIFECYCLE_UPDATE_FUNCTIONS_TOPIC = 'acsm/lifecycle/update_functions';
const AUTOUNPLUG_DEDUP_MS = 15000;

const MAX_INGESTION_BUFFER = 300;
const MAX_HISTORY_PER_CPS = 500;
const MAX_SYSTEM_EVENTS = 500;
const MAX_SYSTEM_SNAPSHOTS = 500;

const normalizeTopic = (t) => String(t || '').replace(/^\/+/, '').replace(/\/+$/, '');

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

const safeParseJson = (raw) => {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(raw.toString());
  } catch {
    return null;
  }
};

const clampArray = (arr, max) => {
  if (!Array.isArray(arr)) return [];
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
};

const nowTs = () => Date.now();

const toNumber = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const mean = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const nums = arr.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

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

  if (s === 'active' || s === 'running') return 'running';
  if (s === 'stopped' || s === 'inactive') return 'stopped';
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

  const rawId =
    getSpecificAssetIdValue(aas, 'cpsId') ||
    getPropertyValueFromElements(smDigital?.submodelElements, 'CPSId') ||
    'UNKNOWN';

  const cpsId = String(rawId)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(cps)0+/, '$1');

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
    getCollectionValue(smInterfaces?.submodelElements, 'RESTEndpoints', 'IndicatorsEndpoint') || '';

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

const emptySystemAnalytics = () => ({
  ts: null,
  cpsCount: 0,
  globalOEE: {
    availability: 0,
    performance: 0,
    quality: 0,
    oee: 0,
  },
  criticalCPS: null,
  criticalityRanking: [],
  bottleneck: null,
  cascadeEffect: false,
  synchronizationIssue: false,
  bottleneckMigrating: false,
  dominantLosses: [],
  learnedPattern: 'unknown',
  patternLearned: 'unknown',
  systemPattern: 'unknown',
  predictedGlobalOEE: null,
  predictedOeeGlobal: null,
  riskLevel: 'unknown',
  confidence: 0,
  recommendation: 'No recommendation yet.',
  explanation: 'No system-level explanation yet.',
  coordinatorOutput: null,
  systemEvidence: {},
  crossCpsPatterns: [],
  riskSummary: {},
  recommendedFocus: null,
  actionPlan: {},
  systemState: {},
  coordinationMode: null,
  learningConsensus: null,
  fleetAnomalyIndex: null,
  fleetDriftIndex: null,
  stabilityIndex: null,
  riskDrivers: [],
  supportingSignals: [],
  derivedLearning: {},
  predictedRisk: {},
  historySummary: {},
  synchronization: {},
  lossPropagation: {},
  bottleneckMigration: {},
  generatedAt: null,
  timestamp: null,
  criticalCps: null,
  oee: {
    oee: 0,
    current: 0,
    average: 0,
  },
});

const computeCriticalityFromSnapshot = (snap) => {
  if (!snap) return 0;

  const oee = toNumber(snap?.oee?.oee ?? snap?.oee?.value, 0);
  const availability = toNumber(snap?.oee?.availability, 0);
  const performance = toNumber(snap?.oee?.performance, 0);
  const quality = toNumber(snap?.oee?.quality, 0);

  const cycle = toNumber(
    snap?.operationalData?.cycleTimeMs ??
      snap?.statistics?.cycleTimeMs ??
      snap?.evidence?.cycleTimeMs,
    0
  );

  const temp = toNumber(snap?.operationalData?.currentTemperature, 0);
  const rejectLike = Math.max(0, 1 - quality);

  const normalizedCycle = Math.min(cycle / 10000, 1);
  const normalizedTemp = Math.min(temp / 100, 1);

  const score =
    (1 - oee) * 0.4 +
    (1 - availability) * 0.2 +
    (1 - performance) * 0.15 +
    rejectLike * 0.1 +
    normalizedCycle * 0.1 +
    normalizedTemp * 0.05;

  return Number(score.toFixed(4));
};

const classifyGlobalPattern = (globalOee, cascadeEffect, syncIssue) => {
  if (globalOee >= 0.85 && !cascadeEffect && !syncIssue) return 'stable_high_performance';
  if (globalOee >= 0.6 && !syncIssue) return 'stable_moderate_performance';
  if (cascadeEffect) return 'propagating_loss_pattern';
  if (syncIssue) return 'desynchronization_pattern';
  if (globalOee < 0.6) return 'degraded_global_pattern';
  return 'mixed_operational_pattern';
};

const inferRiskLevel = (globalOee, predictedGlobalOee, topCritical, cascadeEffect) => {
  if (cascadeEffect || topCritical >= 0.7 || globalOee < 0.55) return 'high';
  if ((predictedGlobalOee ?? globalOee) < globalOee || topCritical >= 0.45) return 'medium';
  return 'low';
};

export const CPSProvider = ({ children }) => {
  const [registry, setRegistry] = useState({});
  const [addedCPS, setAddedCPS] = useState([]);
  const [log, setLog] = useState([]);
  const [mqttClient, setMqttClient] = useState(null);
  const [mqttData, setMqttData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [cpsAnalytics, setCpsAnalytics] = useState({});
  const [ingestionBuffer, setIngestionBuffer] = useState([]);
  const [systemAnalytics, setSystemAnalytics] = useState(emptySystemAnalytics());

  const knowledgeStoreRef = useRef({
    cps: {},
    system: {
      snapshots: [],
      events: [],
    },
  });

  const addedCPSRef = useRef([]);
  useEffect(() => {
    addedCPSRef.current = addedCPS;
  }, [addedCPS]);

  const registryRef = useRef({});
  useEffect(() => {
    registryRef.current = registry;
  }, [registry]);

  const cpsAnalyticsRef = useRef({});
  useEffect(() => {
    cpsAnalyticsRef.current = cpsAnalytics;
  }, [cpsAnalytics]);

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

  const pushSystemEvent = useCallback((event) => {
    const store = knowledgeStoreRef.current;
    store.system.events = clampArray(
      [
        ...store.system.events,
        {
          ts: event?.ts || nowTs(),
          type: event?.type || 'system_event',
          cpsId: event?.cpsId || null,
          cpsName: event?.cpsName || null,
          message: event?.message || '',
          payload: event?.payload || null,
        },
      ],
      MAX_SYSTEM_EVENTS
    );
  }, []);

  const updateKnowledgeStoreFromAnalytics = useCallback((cpsId, payload) => {
    if (!cpsId) return;

    const store = knowledgeStoreRef.current;
    const registryCps =
      Object.values(registryRef.current || {}).find((c) => c?.id === cpsId) || null;

    if (!store.cps[cpsId]) {
      store.cps[cpsId] = {
        cpsId,
        cpsName: registryCps?.nome || cpsId,
        baseTopic: registryCps?.topic || '',
        history: [],
        reasoningDocs: [],
        learningDocs: [],
      };
    }

    const entry = {
      ts: payload?.ts || nowTs(),
      cpsId,
      cpsName: payload?.cpsName || registryCps?.nome || cpsId,
      baseTopic: payload?.baseTopic || registryCps?.topic || '',
      oee: payload?.oee || null,
      learning: payload?.learning || null,
      reasoning: payload?.reasoning || null,
      statistics: payload?.statistics || null,
      evidence: payload?.learning?.evidence || payload?.evidence || null,
      operationalData: payload?.operationalData || registryCps?.operationalData || null,
      globalState: payload?.globalState || registryCps?.globalState || null,
      raw: payload || null,
    };

    store.cps[cpsId].history = clampArray(
      [...store.cps[cpsId].history, entry],
      MAX_HISTORY_PER_CPS
    );

    if (payload?.reasoning) {
      store.cps[cpsId].reasoningDocs = clampArray(
        [
          ...store.cps[cpsId].reasoningDocs,
          {
            ts: entry.ts,
            data: payload.reasoning,
          },
        ],
        100
      );
    }

    if (payload?.learning) {
      store.cps[cpsId].learningDocs = clampArray(
        [
          ...store.cps[cpsId].learningDocs,
          {
            ts: entry.ts,
            data: payload.learning,
          },
        ],
        100
      );
    }

    setIngestionBuffer((prev) =>
      clampArray(
        [
          ...prev,
          {
            ts: entry.ts,
            cpsId,
            cpsName: entry.cpsName,
            baseTopic: entry.baseTopic,
            oee: entry.oee,
            learning: entry.learning,
            reasoning: entry.reasoning,
            statistics: entry.statistics,
            operationalData: entry.operationalData,
          },
        ],
        MAX_INGESTION_BUFFER
      )
    );
  }, []);

  const runSystemAnalytics = useCallback(() => {
    const store = knowledgeStoreRef.current;
    const cpsEntries = Object.values(store.cps || {});

    if (!cpsEntries.length) {
      const empty = emptySystemAnalytics();
      setSystemAnalytics((prev) => ({
        ...prev,
        ...empty,
        systemEvidence: prev.systemEvidence || {},
        actionPlan: prev.actionPlan || {},
        systemState: prev.systemState || {},
        supportingSignals: prev.supportingSignals || [],
        riskDrivers: prev.riskDrivers || [],
        coordinationMode: prev.coordinationMode ?? null,
      }));
      return empty;
    }

    const latest = cpsEntries.map((c) => c.history?.at(-1)).filter(Boolean);

    if (!latest.length) {
      const empty = emptySystemAnalytics();
      setSystemAnalytics((prev) => ({
        ...prev,
        ...empty,
        systemEvidence: prev.systemEvidence || {},
        actionPlan: prev.actionPlan || {},
        systemState: prev.systemState || {},
        supportingSignals: prev.supportingSignals || [],
        riskDrivers: prev.riskDrivers || [],
        coordinationMode: prev.coordinationMode ?? null,
      }));
      return empty;
    }

    const globalOEE = {
      availability: Number(mean(latest.map((x) => x?.oee?.availability)).toFixed(4)),
      performance: Number(mean(latest.map((x) => x?.oee?.performance)).toFixed(4)),
      quality: Number(mean(latest.map((x) => x?.oee?.quality)).toFixed(4)),
      oee: Number(mean(latest.map((x) => x?.oee?.oee ?? x?.oee?.value)).toFixed(4)),
    };

    const criticalityRanking = latest
      .map((snap) => ({
        cpsId: snap.cpsId,
        cpsName: snap.cpsName,
        baseTopic: snap.baseTopic,
        score: computeCriticalityFromSnapshot(snap),
      }))
      .sort((a, b) => b.score - a.score);

    const criticalCPS = criticalityRanking[0] || null;

    let bottleneck = null;
    latest.forEach((snap) => {
      const cycle = toNumber(snap?.operationalData?.cycleTimeMs, -1);
      if (cycle < 0) return;
      if (!bottleneck || cycle > bottleneck.cycleTimeMs) {
        bottleneck = {
          cpsId: snap.cpsId,
          cpsName: snap.cpsName,
          cycleTimeMs: cycle,
          reason: 'highest_cycle_time',
        };
      }
    });

    const cycles = latest
      .map((x) => toNumber(x?.operationalData?.cycleTimeMs))
      .filter((x) => Number.isFinite(x) && x > 0);

    const synchronizationIssue =
      cycles.length >= 2 ? Math.max(...cycles) / Math.min(...cycles) > 1.5 : false;

    const oees = latest
      .map((x) => toNumber(x?.oee?.oee ?? x?.oee?.value))
      .filter((x) => Number.isFinite(x));

    const cascadeEffect =
      oees.length >= 2
        ? Math.max(...oees) - Math.min(...oees) < 0.08 && mean(oees) < 0.75
        : false;

    const dominantLosses = latest.map((snap) => {
      const availabilityLoss = Math.max(0, 1 - (toNumber(snap?.oee?.availability, 0) || 0));
      const performanceLoss = Math.max(0, 1 - (toNumber(snap?.oee?.performance, 0) || 0));
      const qualityLoss = Math.max(0, 1 - (toNumber(snap?.oee?.quality, 0) || 0));

      const dominantDimension =
        availabilityLoss >= performanceLoss && availabilityLoss >= qualityLoss
          ? 'availability'
          : performanceLoss >= availabilityLoss && performanceLoss >= qualityLoss
            ? 'performance'
            : 'quality';

      return {
        cpsId: snap.cpsId,
        cpsName: snap.cpsName,
        availabilityLoss: Number(availabilityLoss.toFixed(4)),
        performanceLoss: Number(performanceLoss.toFixed(4)),
        qualityLoss: Number(qualityLoss.toFixed(4)),
        dominantDimension,
      };
    });

    const recentSnapshots = store.system.snapshots || [];
    const predictedGlobalOEE =
      recentSnapshots.length >= 1
        ? (() => {
            const last = toNumber(recentSnapshots.at(-1)?.globalOEE?.oee, globalOEE.oee);
            const prev = toNumber(recentSnapshots.at(-2)?.globalOEE?.oee, last);
            return Number(Math.max(0, Math.min(1, last + (last - prev))).toFixed(4));
          })()
        : null;

    const learnedPattern = classifyGlobalPattern(
      globalOEE.oee,
      cascadeEffect,
      synchronizationIssue
    );

    const riskLevel = inferRiskLevel(
      globalOEE.oee,
      predictedGlobalOEE,
      criticalCPS?.score || 0,
      cascadeEffect
    );

    let confidence = 0.6;
    if (latest.length >= 3) confidence += 0.1;
    if (predictedGlobalOEE !== null) confidence += 0.1;
    if (criticalCPS?.score >= 0.4) confidence += 0.1;
    if (cascadeEffect || synchronizationIssue) confidence += 0.1;
    confidence = Number(Math.min(0.95, confidence).toFixed(2));

    const bottleneckMigrating =
      recentSnapshots.length >= 2
        ? new Set(
            recentSnapshots
              .slice(-3)
              .map((s) => s?.bottleneck?.cpsId)
              .filter(Boolean)
          ).size > 1
        : false;

    const recommendation = criticalCPS?.cpsId
      ? riskLevel === 'high'
        ? `Prioritize intervention on ${criticalCPS.cpsId} and inspect dominant losses affecting the global OEE.`
        : synchronizationIssue
          ? 'Adjust synchronization between CPS and review handoff timing between assets.'
          : bottleneck?.cpsId
            ? `Monitor ${bottleneck.cpsId} as the current bottleneck and rebalance workload if possible.`
            : 'Maintain current coordination and continue monitoring.'
      : 'Collect more data for system-level recommendation.';

    const explanation =
      `Global OEE is ${(globalOEE.oee * 100).toFixed(1)}%. ` +
      `${criticalCPS?.cpsId ? `${criticalCPS.cpsId} is currently the most critical CPS. ` : ''}` +
      `${bottleneck?.cpsId ? `${bottleneck.cpsId} acts as the current bottleneck. ` : ''}` +
      `${cascadeEffect ? 'There are signs of possible cascade effect across CPS. ' : ''}` +
      `${synchronizationIssue ? 'Cycle mismatch suggests poor synchronization between assets. ' : ''}` +
      `Learned pattern: ${learnedPattern}. Risk level: ${riskLevel}.`;

    const analytics = {
      ts: nowTs(),
      cpsCount: latest.length,
      globalOEE,
      criticalCPS,
      criticalityRanking,
      bottleneck,
      cascadeEffect,
      synchronizationIssue,
      bottleneckMigrating,
      dominantLosses,
      learnedPattern,
      predictedGlobalOEE,
      riskLevel,
      confidence,
      recommendation,
      explanation,
      coordinatorOutput: {
        globalOEE: globalOEE.oee,
        dominantLosses,
        criticalCPS: criticalCPS?.cpsId || null,
        learnedPattern,
        predictedRisk: riskLevel,
        recommendation,
        confidence,
        explanation,
      },
    };

    store.system.snapshots = clampArray(
      [
        ...store.system.snapshots,
        {
          ts: analytics.ts,
          globalOEE,
          criticalCPS,
          bottleneck,
          cascadeEffect,
          synchronizationIssue,
          learnedPattern,
          riskLevel,
        },
      ],
      MAX_SYSTEM_SNAPSHOTS
    );

    setSystemAnalytics((prev) => ({
      ...prev,
      ...analytics,
      systemEvidence:
        analytics.systemEvidence && Object.keys(analytics.systemEvidence).length
          ? analytics.systemEvidence
          : prev.systemEvidence || {},
      actionPlan:
        analytics.actionPlan && Object.keys(analytics.actionPlan).length
          ? analytics.actionPlan
          : prev.actionPlan || {},
      systemState:
        analytics.systemState && Object.keys(analytics.systemState).length
          ? analytics.systemState
          : prev.systemState || {},
      supportingSignals:
        Array.isArray(analytics.supportingSignals) && analytics.supportingSignals.length
          ? analytics.supportingSignals
          : prev.supportingSignals || [],
      riskDrivers:
        Array.isArray(analytics.riskDrivers) && analytics.riskDrivers.length
          ? analytics.riskDrivers
          : prev.riskDrivers || [],
      coordinationMode: analytics.coordinationMode ?? prev.coordinationMode ?? null,
      crossCpsPatterns:
        Array.isArray(analytics.crossCpsPatterns) && analytics.crossCpsPatterns.length
          ? analytics.crossCpsPatterns
          : prev.crossCpsPatterns || [],
      riskSummary:
        analytics.riskSummary && Object.keys(analytics.riskSummary).length
          ? analytics.riskSummary
          : prev.riskSummary || {},
      recommendedFocus: analytics.recommendedFocus ?? prev.recommendedFocus ?? null,
      learningConsensus: analytics.learningConsensus ?? prev.learningConsensus ?? null,
      fleetAnomalyIndex: analytics.fleetAnomalyIndex ?? prev.fleetAnomalyIndex ?? null,
      fleetDriftIndex: analytics.fleetDriftIndex ?? prev.fleetDriftIndex ?? null,
      stabilityIndex: analytics.stabilityIndex ?? prev.stabilityIndex ?? null,
      derivedLearning:
        analytics.derivedLearning && Object.keys(analytics.derivedLearning).length
          ? analytics.derivedLearning
          : prev.derivedLearning || {},
      predictedRisk:
        analytics.predictedRisk && Object.keys(analytics.predictedRisk).length
          ? analytics.predictedRisk
          : prev.predictedRisk || {},
      historySummary:
        analytics.historySummary && Object.keys(analytics.historySummary).length
          ? analytics.historySummary
          : prev.historySummary || {},
    }));

    return analytics;
  }, []);

  const getCoordinatorOutput = useCallback(() => {
    return systemAnalytics?.coordinatorOutput || null;
  }, [systemAnalytics]);

  const getKnowledgeStore = useCallback(() => knowledgeStoreRef.current, []);

  const exportSystemSnapshot = useCallback(() => {
    return {
      exportedAt: new Date().toISOString(),
      registry,
      addedCPS,
      ingestionBuffer,
      cpsAnalytics,
      systemAnalytics,
      knowledgeStore: knowledgeStoreRef.current,
    };
  }, [registry, addedCPS, ingestionBuffer, cpsAnalytics, systemAnalytics]);

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

      const oldHistory = Array.isArray(baseObj?.updates?.history) ? baseObj.updates.history : [];

      const alreadyExists = oldHistory.some(
        (item) => item?.id && entry?.id && String(item.id) === String(entry.id)
      );

      const newHistory = alreadyExists ? oldHistory : [entry, ...oldHistory].slice(0, 20);

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

  const handleAnalyticsMessage = useCallback((topic, rawPayload) => {
    try {
      const parsed =
        typeof rawPayload === 'string' ? JSON.parse(rawPayload) : JSON.parse(rawPayload.toString());

      if (
        topic === 'acsm/global/oee' ||
        topic === 'acsm/global/reasoning' ||
        topic === 'acsm/global/learning' ||
        topic === 'acsm/coordinator/output'
      ) {
        const raw = parsed?.payload || parsed || {};

        const criticality = Array.isArray(raw?.criticality)
          ? raw.criticality
          : Array.isArray(raw?.criticalityRanking)
            ? raw.criticalityRanking
            : [];

        const dominantLosses = Array.isArray(raw?.dominantLosses)
          ? raw.dominantLosses
          : criticality.map((item) => ({
              cpsId: item?.cpsId,
              cpsName: item?.cpsName,
              dominantDimension: item?.dominantLoss || 'unknown',
              availabilityLoss: item?.criticalityDetails?.availabilityLoss ?? null,
              performanceLoss: item?.criticalityDetails?.performanceLoss ?? null,
              qualityLoss: item?.criticalityDetails?.qualityLoss ?? null,
            }));

        const normalized = {
          ...raw,
          generatedAt: raw?.generatedAt || raw?.isoDate || null,
          timestamp: raw?.timestamp || raw?.ts || null,
          globalOEE: raw?.globalOEE || {
            oee: toNumber(raw?.oeeGlobal ?? raw?.oeeGlobalSeries),
            current: toNumber(raw?.oeeGlobal ?? raw?.oeeGlobalSeries),
            average: toNumber(raw?.oeeGlobalAverage),
          },
          oee: raw?.oee || {
            oee: toNumber(raw?.oeeGlobal ?? raw?.oeeGlobalSeries),
            current: toNumber(raw?.oeeGlobal ?? raw?.oeeGlobalSeries),
            average: toNumber(raw?.oeeGlobalAverage),
          },
          criticalCPS:
            raw?.criticalCPS || (raw?.criticalCps ? { cpsId: raw.criticalCps } : null),
          criticalCps: raw?.criticalCps || raw?.criticalCPS?.cpsId || null,
          bottleneck:
            typeof raw?.bottleneck === 'string' ? { cpsId: raw.bottleneck } : raw?.bottleneck || null,
          criticality,
          criticalityRanking: criticality,
          dominantLosses,
          learnedPattern:
            raw?.learnedPattern ||
            raw?.patternLearned ||
            raw?.systemPattern ||
            raw?.derivedLearning?.pattern ||
            '—',
          patternLearned:
            raw?.patternLearned || raw?.learnedPattern || raw?.systemPattern || '—',
          systemPattern:
            raw?.systemPattern || raw?.patternLearned || raw?.learnedPattern || '—',
          riskLevel:
            raw?.riskLevel || raw?.riskSummary?.level || raw?.predictedRisk?.level || 'low',
          confidence: toNumber(
            raw?.confidence ??
              raw?.riskSummary?.confidence ??
              raw?.predictedRisk?.confidence ??
              raw?.derivedLearning?.confidence,
            0
          ),
          predictedGlobalOEE: toNumber(raw?.predictedGlobalOEE ?? raw?.predictedOeeGlobal, null),
          predictedOeeGlobal: toNumber(raw?.predictedOeeGlobal ?? raw?.predictedGlobalOEE, null),
          recommendation: raw?.recommendation || raw?.actionPlan?.recommendation || null,
          explanation: raw?.explanation || null,
          synchronization: raw?.synchronization || {},
          lossPropagation: raw?.lossPropagation || {},
          bottleneckMigration: raw?.bottleneckMigration || {},
          systemEvidence: raw?.systemEvidence || {},
          crossCpsPatterns: Array.isArray(raw?.crossCpsPatterns) ? raw.crossCpsPatterns : [],
          riskSummary: raw?.riskSummary || {},
          recommendedFocus: raw?.recommendedFocus || null,
          actionPlan: raw?.actionPlan || {},
          systemState: raw?.systemState || {},
          coordinationMode: raw?.coordinationMode || raw?.systemState?.coordinationMode || null,
          learningConsensus:
            raw?.learningConsensus || raw?.derivedLearning?.learningConsensus || null,
          fleetAnomalyIndex: toNumber(raw?.fleetAnomalyIndex, null),
          fleetDriftIndex: toNumber(raw?.fleetDriftIndex, null),
          stabilityIndex: toNumber(raw?.stabilityIndex, null),
          riskDrivers: Array.isArray(raw?.riskDrivers) ? raw.riskDrivers : [],
          supportingSignals: Array.isArray(raw?.supportingSignals) ? raw.supportingSignals : [],
          derivedLearning: raw?.derivedLearning || {},
          predictedRisk: raw?.predictedRisk || {},
          historySummary: raw?.historySummary || {},
        };

        setSystemAnalytics((prev) => ({
          ...prev,
          ...normalized,
          systemEvidence: hasKeys(normalized.systemEvidence)
            ? normalized.systemEvidence
            : prev.systemEvidence || {},
          actionPlan: hasKeys(normalized.actionPlan)
            ? normalized.actionPlan
            : prev.actionPlan || {},
          systemState: hasKeys(normalized.systemState)
            ? normalized.systemState
            : prev.systemState || {},
          supportingSignals: hasItems(normalized.supportingSignals)
            ? normalized.supportingSignals
            : prev.supportingSignals || [],
          riskDrivers: hasItems(normalized.riskDrivers)
            ? normalized.riskDrivers
            : prev.riskDrivers || [],
          crossCpsPatterns: hasItems(normalized.crossCpsPatterns)
            ? normalized.crossCpsPatterns
            : prev.crossCpsPatterns || [],
          riskSummary: hasKeys(normalized.riskSummary)
            ? normalized.riskSummary
            : prev.riskSummary || {},
          recommendedFocus: normalized.recommendedFocus ?? prev.recommendedFocus ?? null,
          coordinationMode: normalized.coordinationMode ?? prev.coordinationMode ?? null,
          learningConsensus: normalized.learningConsensus ?? prev.learningConsensus ?? null,
          fleetAnomalyIndex: normalized.fleetAnomalyIndex ?? prev.fleetAnomalyIndex ?? null,
          fleetDriftIndex: normalized.fleetDriftIndex ?? prev.fleetDriftIndex ?? null,
          stabilityIndex: normalized.stabilityIndex ?? prev.stabilityIndex ?? null,
          derivedLearning: hasKeys(normalized.derivedLearning)
            ? normalized.derivedLearning
            : prev.derivedLearning || {},
          predictedRisk: hasKeys(normalized.predictedRisk)
            ? normalized.predictedRisk
            : prev.predictedRisk || {},
          historySummary: hasKeys(normalized.historySummary)
            ? normalized.historySummary
            : prev.historySummary || {},
        }));

        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[GLOBAL_ANALYTICS] Updated from topic=${topic}`,
          },
        ]);

        return;
      }

      const rawCpsId = parsed?.cpsId || 'UNKNOWN';
      const cpsId = String(rawCpsId)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/(cps)0+/, '$1');

      if (cpsId === 'unknown') return;

      const owner =
        addedCPSRef.current.find((c) => c.id === cpsId) ||
        Object.values(registryRef.current || {}).find((c) => c?.id === cpsId);

      if (topic.endsWith('/oee')) {
        const oeeValue =
          parsed?.oee && typeof parsed.oee === 'object'
            ? parsed?.oee?.current ?? parsed?.oee?.global ?? null
            : parsed?.oee ?? null;

        const availability =
          parsed?.oee && typeof parsed.oee === 'object'
            ? parsed?.oee?.availability ?? null
            : parsed?.availability ?? null;

        const performance =
          parsed?.oee && typeof parsed.oee === 'object'
            ? parsed?.oee?.performance ?? null
            : parsed?.performance ?? null;

        const quality =
          parsed?.oee && typeof parsed.oee === 'object'
            ? parsed?.oee?.quality ?? null
            : parsed?.quality ?? null;

        const nextOperationalData = owner
          ? {
              ...(owner?.operationalData || {}),
              pieceCounter: parsed?.totals?.totalCount ?? owner?.operationalData?.pieceCounter ?? null,
              cycleTimeMs: parsed?.features?.avgCycleTimeMs ?? owner?.operationalData?.cycleTimeMs ?? null,
              currentTemperature:
                parsed?.features?.avgTemperature ??
                parsed?.features?.avgTempPontaSolda ??
                owner?.operationalData?.currentTemperature ??
                null,
              currentRPM:
                parsed?.features?.avgRpm ??
                parsed?.features?.avgCorrenteArco ??
                owner?.operationalData?.currentRPM ??
                null,
              currentTorque:
                parsed?.features?.avgTorque ??
                parsed?.features?.avgPressaoGas ??
                owner?.operationalData?.currentTorque ??
                null,
              operationMode: owner?.operationalData?.operationMode ?? 'play',
            }
          : null;

        setCpsAnalytics((prev) => ({
          ...prev,
          [cpsId]: {
            ...(prev[cpsId] || {}),
            cpsId,
            cpsName: parsed?.cpsName || prev?.[cpsId]?.cpsName || cpsId,
            oee: {
              current: oeeValue,
              global:
                parsed?.oee && typeof parsed.oee === 'object'
                  ? parsed?.oee?.global ?? oeeValue
                  : oeeValue,
              availability,
              performance,
              quality,
            },
            totals: parsed?.totals ?? prev?.[cpsId]?.totals ?? null,
            features: parsed?.features ?? prev?.[cpsId]?.features ?? null,
            sourceStatus: parsed?.sourceStatus ?? prev?.[cpsId]?.sourceStatus ?? null,
            lastUpdate: parsed?.ts || new Date().toISOString(),
          },
        }));

        if (owner) {
          setAddedCPS((prev) =>
            prev.map((c) =>
              c.id === owner.id
                ? {
                    ...c,
                    oee: {
                      availability,
                      performance,
                      quality,
                      value: oeeValue,
                      totals: parsed?.totals ?? null,
                      sourceStatus: parsed?.sourceStatus ?? null,
                      lastUpdate: parsed?.ts ?? Date.now(),
                    },
                    operationalData: nextOperationalData || c.operationalData,
                  }
                : c
            )
          );

          patchRegistryCps(owner, {
            oee: {
              availability,
              performance,
              quality,
              value: oeeValue,
              totals: parsed?.totals ?? null,
              sourceStatus: parsed?.sourceStatus ?? null,
              lastUpdate: parsed?.ts ?? Date.now(),
            },
            operationalData: nextOperationalData || owner?.operationalData || {},
          });

          setLog((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message:
                `[OEE] ${owner.nome} -> ` +
                `A=${String(availability ?? '—')} ` +
                `P=${String(performance ?? '—')} ` +
                `Q=${String(quality ?? '—')} ` +
                `OEE=${String(oeeValue ?? '—')}`,
            },
          ]);
        }

        updateKnowledgeStoreFromAnalytics(cpsId, {
          ...(cpsAnalyticsRef.current?.[cpsId] || {}),
          cpsId,
          cpsName: parsed?.cpsName || cpsId,
          oee: {
            current: oeeValue,
            global:
              parsed?.oee && typeof parsed.oee === 'object'
                ? parsed?.oee?.global ?? oeeValue
                : oeeValue,
            availability,
            performance,
            quality,
            totals: parsed?.totals ?? null,
            sourceStatus: parsed?.sourceStatus ?? null,
          },
          totals: parsed?.totals ?? null,
          features: parsed?.features ?? null,
          operationalData: nextOperationalData,
          ts: parsed?.ts ?? Date.now(),
        });

        runSystemAnalytics();
        return;
      }

      if (topic.endsWith('/learning')) {
        const nextOperationalData = owner
          ? {
              ...(owner?.operationalData || {}),
              pieceCounter: parsed?.totals?.totalCount ?? owner?.operationalData?.pieceCounter ?? null,
              cycleTimeMs: parsed?.features?.avgCycleTimeMs ?? owner?.operationalData?.cycleTimeMs ?? null,
              currentTemperature:
                parsed?.features?.avgTemperature ??
                parsed?.features?.avgTempPontaSolda ??
                owner?.operationalData?.currentTemperature ??
                null,
              currentRPM:
                parsed?.features?.avgRpm ??
                parsed?.features?.avgCorrenteArco ??
                owner?.operationalData?.currentRPM ??
                null,
              currentTorque:
                parsed?.features?.avgTorque ??
                parsed?.features?.avgPressaoGas ??
                owner?.operationalData?.currentTorque ??
                null,
              operationMode: owner?.operationalData?.operationMode ?? 'play',
            }
          : null;

        setCpsAnalytics((prev) => {
          const existing = prev[cpsId] || {};
          return {
            ...prev,
            [cpsId]: {
              ...existing,
              cpsId,
              cpsName: parsed?.cpsName || existing?.cpsName || cpsId,
              learning: parsed.learning || existing.learning,
              reasoning: parsed.reasoning || existing.reasoning,
              oee: parsed.oee || existing.oee,
              statistics: parsed.statistics || existing.statistics,
              features: parsed.features || existing.features,
              window: parsed.window || existing.window,
              totals: parsed.totals || existing.totals,
              lastUpdate: parsed.ts || new Date().toISOString(),
            },
          };
        });

        if (owner && nextOperationalData) {
          setAddedCPS((prev) =>
            prev.map((c) =>
              c.id === owner.id
                ? {
                    ...c,
                    operationalData: nextOperationalData,
                  }
                : c
            )
          );

          patchRegistryCps(owner, {
            operationalData: nextOperationalData,
          });
        }

        updateKnowledgeStoreFromAnalytics(cpsId, {
          ...(cpsAnalyticsRef.current?.[cpsId] || {}),
          cpsId,
          cpsName: parsed?.cpsName || cpsId,
          learning: parsed.learning || null,
          reasoning: parsed.reasoning || null,
          oee: parsed.oee || null,
          statistics: parsed.statistics || null,
          features: parsed.features || null,
          window: parsed.window || null,
          totals: parsed.totals || null,
          operationalData: nextOperationalData,
          ts: parsed.ts || Date.now(),
        });

        const analytics = runSystemAnalytics();

        pushSystemEvent({
          ts: parsed.ts || Date.now(),
          type: 'analytics_refresh',
          cpsId,
          cpsName: parsed?.cpsName || cpsId,
          message: `System analytics recalculated after learning update from ${cpsId}`,
          payload: analytics?.coordinatorOutput || null,
        });

        return;
      }
    } catch (err) {
      console.error('Erro ao processar mensagem analytics MQTT:', err);
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: `[ANALYTICS_ERROR] ${err?.message || err}`,
        },
      ]);
    }
  }, [patchRegistryCps, pushSystemEvent, runSystemAnalytics, updateKnowledgeStoreFromAnalytics]);

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

        if (!knowledgeStoreRef.current.cps[cps.id]) {
          knowledgeStoreRef.current.cps[cps.id] = {
            cpsId: cps.id,
            cpsName: cps.nome,
            baseTopic: cps.topic,
            history: [],
            reasoningDocs: [],
            learningDocs: [],
          };
        }

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

        pushSystemEvent({
          ts: Date.now(),
          type: 'cps_registered',
          cpsId: cps.id,
          cpsName: cps.nome,
          message: `CPS ${cps.nome} registered in Plug Phase.`,
        });

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
    [persistPlugEvent, pushSystemEvent]
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
            message: `[CMD_ERROR] Failed to send ${action} to ${cps.nome}: ${e?.message || e}`,
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
          payload?.summary || 'Maintenance completed. CPS resumed operation autonomously.',
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
            payload?.summary || 'Maintenance completed. CPS resumed operation autonomously.',
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
          summary: payload?.summary || 'CPS returned automatically after maintenance.',
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
            payload?.summary || 'Maintenance completed. CPS resumed operation autonomously.',
          lastType: payload?.type || 'update_functions',
          lastTs: completedTs,
        },
        globalState: {
          state: 'running',
          status: 'running',
          summary: payload?.summary || 'CPS returned automatically after maintenance.',
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
          payload?.summary || 'Maintenance completed. CPS resumed operation autonomously.',
        details: {
          historyEntry: maintenanceCompletedEntry,
          payload,
        },
        ts: completedTs,
      });

      pushSystemEvent({
        ts: completedTs,
        type: 'maintenance_completed',
        cpsId: cpsObj.id,
        cpsName: cpsObj.nome,
        message:
          payload?.summary || 'Maintenance completed. CPS resumed operation autonomously.',
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
    [patchRegistryCps, appendRegistryHistory, persistPlugEvent, pushSystemEvent]
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

          const analyticsSubs = [
            '+/oee',
            '+/learning',
            'acsm/global/oee',
            'acsm/global/reasoning',
            'acsm/global/learning',
            'acsm/coordinator/output',
            LIFECYCLE_UNPLUG_REQUEST_TOPIC,
            LIFECYCLE_UPDATE_FUNCTIONS_TOPIC,
          ];

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

          const dynamicSubs = Array.from(
            new Set(availableCPS.flatMap((cps) => buildSubscriptionTopicsForCps(cps)))
          );

          if (dynamicSubs.length) {
            client.subscribe(dynamicSubs, (err) => {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: err
                    ? `[MQTT_ERROR] Subscribe CPS topics failed (${err?.message || err})`
                    : `[MQTT] Subscribed CPS topics: ${dynamicSubs.length}`,
                },
              ]);
            });
          }
        });

        client.on('message', (topic, message) => {
          const rawTopic = String(topic || '').trim();
          const normIncoming = normalizeTopic(rawTopic);
          const rawStr = message?.toString?.() || '';

          if (DEBUG_LOG_ALL_TOPICS) {
            setLog((prev) => [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                message: `[DEBUG] msg in '${rawTopic}': ${rawStr}`,
              },
            ]);
          }

          const isAnalyticsTopic =
            normIncoming.endsWith('/learning') ||
            normIncoming.endsWith('/oee') ||
            normIncoming === 'acsm/global/oee' ||
            normIncoming === 'acsm/global/reasoning' ||
            normIncoming === 'acsm/global/learning' ||
            normIncoming === 'acsm/coordinator/output';

          if (isAnalyticsTopic) {
            handleAnalyticsMessage(normIncoming, message);
            return;
          }

          if (normIncoming === LIFECYCLE_UNPLUG_REQUEST_TOPIC) {
            const payload = safeParseJson(message);
            if (!payload?.baseTopic && !payload?.cpsId) return;

            const target =
              addedCPSRef.current.find(
                (c) =>
                  c.id === String(payload?.cpsId || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(cps)0+/, '$1') ||
                  normalizeTopic(c.topic) === normalizeTopic(payload?.baseTopic)
              ) ||
              Object.values(registryRef.current || {}).find(
                (c) =>
                  c?.id === String(payload?.cpsId || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(cps)0+/, '$1') ||
                  normalizeTopic(c?.topic) === normalizeTopic(payload?.baseTopic)
              );

            if (!target) return;

            const now = Date.now();
            const last = lastAutoUnplugRef.current[target.id] || 0;
            if (now - last < AUTOUNPLUG_DEDUP_MS) return;
            lastAutoUnplugRef.current[target.id] = now;

            if (isMaintenanceReason(payload?.reason)) {
              maintenanceReturnRef.current[target.id] = true;
            }

            setTimeout(() => {
              setAddedCPS((prev) => prev.filter((c) => c.id !== target.id));
              patchRegistryCps(target, {
                status: 'Parado',
                maintenance: {
                  ...(target.maintenance || {}),
                  inProgress: isMaintenanceReason(payload?.reason),
                  lastStartTs: payload?.ts || Date.now(),
                },
                globalState: {
                  ...(target.globalState || {}),
                  state: isMaintenanceReason(payload?.reason) ? 'maintenance' : 'stopped',
                  status: isMaintenanceReason(payload?.reason) ? 'maintenance' : 'stopped',
                  summary: payload?.summary || 'CPS unplugged from Play Phase.',
                  lastUpdate: payload?.ts || Date.now(),
                },
              });
            }, 0);

            appendRegistryHistory(target, {
              id: `${target.id}-unplug-${payload?.ts || Date.now()}`,
              type: payload?.type || 'unplug_request',
              title: 'Autonomous unplug',
              message: payload?.summary || 'CPS requested unplug.',
              ts: payload?.ts || Date.now(),
            });

            return;
          }

          if (normIncoming === LIFECYCLE_UPDATE_FUNCTIONS_TOPIC) {
            const payload = safeParseJson(message);
            if (!payload) return;

            const target =
              Object.values(registryRef.current || {}).find(
                (c) =>
                  c?.id ===
                    String(payload?.cpsId || '')
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, '')
                      .replace(/(cps)0+/, '$1') ||
                  normalizeTopic(c?.topic) === normalizeTopic(payload?.baseTopic)
              ) || null;

            if (!target) return;

            if (maintenanceReturnRef.current[target.id] || isMaintenanceReason(payload?.reason)) {
              restoreCPSFromMaintenance(target, payload);
              maintenanceReturnRef.current[target.id] = false;
              return;
            }
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
            const ack = safeParseJson(message);
            setLog((prev) => [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                message: ack
                  ? `[ACK] ${owner.nome} -> action=${ack?.action || '—'} ok=${String(ack?.ok ?? '—')}`
                  : `[ACK] non-JSON payload in '${rawTopic}': ${rawStr}`,
              },
            ]);
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

            const payload = safeParseJson(message);
            if (!payload) {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[FEAT] non-JSON payload in '${rawTopic}': ${rawStr}`,
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
            const data = safeParseJson(message);
            if (!data) {
              setLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  message: `[HEALTH] non-JSON payload in '${rawTopic}': ${rawStr}`,
                },
              ]);
              return;
            }

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

            return;
          }

          if (isOee) {
            handleAnalyticsMessage(normIncoming, message);
            return;
          }

          if (isStatus) {
            const data = safeParseJson(message);
            if (!data) return;

            const nextGlobalState = {
              ...(owner.globalState || {}),
              state: data?.state || owner?.globalState?.state || null,
              status: data?.status || data?.state || owner?.globalState?.status || null,
              playEnabled:
                typeof data?.playEnabled === 'boolean'
                  ? data.playEnabled
                  : owner?.globalState?.playEnabled ?? true,
              healthScore: data?.healthScore ?? owner?.globalState?.healthScore ?? null,
              healthLabel: data?.healthLabel ?? owner?.globalState?.healthLabel ?? null,
              featureCount:
                data?.featureCount ?? owner?.globalState?.featureCount ?? owner?.funcionalidades?.length ?? 0,
              summary: data?.summary || owner?.globalState?.summary || '',
              lastUpdate: data?.ts ?? Date.now(),
            };

            setAddedCPS((prev) =>
              prev.map((c) => (c.id === owner.id ? { ...c, globalState: nextGlobalState } : c))
            );
            patchRegistryCps(owner, { globalState: nextGlobalState });
            return;
          }

          if (isData) {
            const data = safeParseJson(message);
            const payload = data || rawStr;

            setMqttData((prev) => ({
              ...prev,
              [owner.id]: payload,
            }));

            if (data && typeof data === 'object') {
              const nextOperationalData = {
                ...(owner?.operationalData || {}),
                currentTemperature:
                  data?.CurrentTemperature ?? data?.currentTemperature ?? owner?.operationalData?.currentTemperature ?? null,
                currentRPM: data?.CurrentRPM ?? data?.currentRPM ?? owner?.operationalData?.currentRPM ?? null,
                currentTorque:
                  data?.CurrentTorque ?? data?.currentTorque ?? owner?.operationalData?.currentTorque ?? null,
                pieceCounter:
                  data?.PieceCounter ?? data?.pieceCounter ?? owner?.operationalData?.pieceCounter ?? null,
                cycleTimeMs:
                  data?.CycleTimeMs ?? data?.cycleTimeMs ?? owner?.operationalData?.cycleTimeMs ?? null,
                operationMode:
                  data?.OperationMode ?? data?.operationMode ?? owner?.operationalData?.operationMode ?? 'play',
              };

              setAddedCPS((prev) =>
                prev.map((c) =>
                  c.id === owner.id ? { ...c, operationalData: nextOperationalData } : c
                )
              );
              patchRegistryCps(owner, { operationalData: nextOperationalData });
            }
            return;
          }

          if (isAlarm) {
            const alarm = safeParseJson(message) || { raw: rawStr };
            const ts = alarm?.ts || Date.now();
            const alertObj = {
              id: `${owner.id}-alarm-${ts}`,
              cpsId: owner.id,
              cpsName: owner.nome,
              component: alarm?.component || alarm?.source || 'alarm',
              severity: alarm?.severity || 'medium',
              timestamp: new Date(ts).toISOString(),
              raw: alarm,
            };
            setAlerts((prev) => [alertObj, ...prev].slice(0, 200));
          }
        });

        client.on('error', (err) => {
          setLog((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message: `[MQTT_ERROR] ${err?.message || err}`,
            },
          ]);
        });
      } catch (err) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[MQTT_BOOT_ERROR] ${err?.message || err}`,
          },
        ]);
      }
    };

    start();

    return () => {
      if (client) {
        try {
          client.end(true);
        } catch {
          // noop
        }
      }
    };
  }, [
    availableCPS,
    handleAnalyticsMessage,
    patchRegistryCps,
    restoreCPSFromMaintenance,
    scheduleFeatureUiUpdate,
    appendRegistryHistory,
  ]);

  useEffect(() => {
    if (!mqttClient) return;
    const dynamicSubs = Array.from(
      new Set(availableCPS.flatMap((cps) => buildSubscriptionTopicsForCps(cps)))
    );
    if (!dynamicSubs.length) return;
    mqttClient.subscribe(dynamicSubs, () => {});
  }, [mqttClient, availableCPS]);

  const addCPS = useCallback(
    (nameOrId) => {
      const key = String(nameOrId || '').toLowerCase();
      const cps =
        registry[key] ||
        Object.values(registry).find(
          (item) => item?.id === key || String(item?.nome || '').toLowerCase() === key
        );

      if (!cps) {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: `[PLAY_ERROR] CPS not found: ${nameOrId}`,
          },
        ]);
        return false;
      }

      if (addedCPSRef.current.some((item) => item.id === cps.id)) return true;

      const next = {
        ...cps,
        status: 'Rodando',
        globalState: {
          ...(cps.globalState || {}),
          state: cps?.globalState?.state || 'running',
          status: cps?.globalState?.status || 'running',
          playEnabled: true,
          lastUpdate: Date.now(),
        },
      };

      setAddedCPS((prev) => [...prev, next]);
      patchRegistryCps(cps, { status: 'Rodando', globalState: next.globalState });
      publishLifecycleCommand(cps, 'play');
      return true;
    },
    [patchRegistryCps, publishLifecycleCommand, registry]
  );

  const removeCPS = useCallback((idOrName) => {
    const normalized = String(idOrName || '').toLowerCase();
    setAddedCPS((prev) =>
      prev.filter(
        (c) => c.id !== normalized && String(c.nome || '').toLowerCase() !== normalized
      )
    );
    return true;
  }, []);

  const startCPSById = useCallback(
    (id) => {
      const cps = Object.values(registryRef.current || {}).find((item) => item?.id === id);
      if (!cps) return false;
      return addCPS(cps.id);
    },
    [addCPS]
  );

  const stopCPSById = useCallback(
    (id) => {
      const cps = Object.values(registryRef.current || {}).find((item) => item?.id === id);
      if (!cps) return false;

      publishLifecycleCommand(cps, 'stop');
      setAddedCPS((prev) => prev.filter((c) => c.id !== id));
      patchRegistryCps(cps, {
        status: 'Parado',
        globalState: {
          ...(cps.globalState || {}),
          state: 'stopped',
          status: 'stopped',
          playEnabled: false,
          lastUpdate: Date.now(),
        },
      });
      return true;
    },
    [patchRegistryCps, publishLifecycleCommand]
  );

  const unplugCPS = useCallback(
    (id) => {
      const cps = Object.values(registryRef.current || {}).find((item) => item?.id === id);
      if (!cps || !mqttClient) return false;

      const payload = {
        cpsId: cps.id,
        cpsName: cps.nome,
        baseTopic: cps.topic,
        type: 'unplug_request',
        reason: 'manual_unplug',
        summary: 'Manual unplug requested by ACSM.',
        ts: Date.now(),
      };

      mqttClient.publish(LIFECYCLE_UNPLUG_REQUEST_TOPIC, JSON.stringify(payload), {
        qos: 1,
        retain: false,
      });

      setAddedCPS((prev) => prev.filter((c) => c.id !== id));
      patchRegistryCps(cps, {
        status: 'Parado',
        globalState: {
          ...(cps.globalState || {}),
          state: 'stopped',
          status: 'stopped',
          playEnabled: false,
          summary: 'Manual unplug requested by ACSM.',
          lastUpdate: Date.now(),
        },
      });
      return true;
    },
    [mqttClient, patchRegistryCps]
  );

  const toggleCPSStatus = useCallback(
    (id) => {
      const running = addedCPSRef.current.some((c) => c.id === id);
      return running ? stopCPSById(id) : startCPSById(id);
    },
    [startCPSById, stopCPSById]
  );

  const getMQTTOperations = useCallback(() => {
    return addedCPS
      .map((cps) => {
        const currentData = mqttData[cps.id];
        const feats = (cps.funcionalidades || [])
          .map((f) => `${f.nome || f.key}:${f.statusAtual || '—'}`)
          .join(', ');
        const featLine = feats ? ` • Feat: [${feats}]` : '';

        if (String(cps.status).toLowerCase() !== 'rodando') {
          return `${cps.nome} (${cps.server}/${cps.topic}): Stopped${featLine}`;
        }

        if (currentData && typeof currentData === 'object') {
          return `${cps.nome} (${cps.server}/${cps.topic}): ${JSON.stringify(currentData)}${featLine}`;
        }

        const last = currentData || 'Waiting.';
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
        ingestionBuffer,
        systemAnalytics,
        runSystemAnalytics,
        getCoordinatorOutput,
        getKnowledgeStore,
        exportSystemSnapshot,
      }}
    >
      {children}
    </CPSContext.Provider>
  );
};
