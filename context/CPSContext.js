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
import {
  filterContributionRanking,
  filterManagedArrayByCps,
  getActiveAcsmConfig,
  keepManagedValue,
  normalizeCpsId,
} from '../lib/acsm/config';

const CPSContext = createContext(undefined);
const ACTIVE_ACSM = getActiveAcsmConfig();
const ACSM_TOPICS = ACTIVE_ACSM.topics;
const sanitizeManagedText = (value) => {
  if (value === undefined || value === null) return value ?? null;
  return String(value)
    .replace(/cps[\s_-]*0*\d+/gi, (match) => keepManagedValue(match, ACTIVE_ACSM) || '')
    .replace(/\s{2,}/g, ' ')
    .trim();

};
const normalizeManagedReferenceObject = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return keepManagedValue(value, ACTIVE_ACSM);
  }
  const cpsId = keepManagedValue(
    value?.cpsId || value?.id || value?.baseTopic || value?.cps,
    ACTIVE_ACSM
  );
  if (!cpsId) return null;
  return {
    ...value,
    cpsId,
  };
};
const normalizeManagedArrayEntries = (items) =>
  filterManagedArrayByCps(items, ACTIVE_ACSM).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return typeof item === 'string' ? sanitizeManagedText(item) : item;
    }
    return {
      ...item,
      ...(item?.cpsId !== undefined ? { cpsId: keepManagedValue(item.cpsId, ACTIVE_ACSM) } : {}),
      ...(item?.id !== undefined && keepManagedValue(item.id, ACTIVE_ACSM)
        ? { id: keepManagedValue(item.id, ACTIVE_ACSM) }
        : {}),
      ...(item?.sourceCps !== undefined && keepManagedValue(item.sourceCps, ACTIVE_ACSM)
        ? { sourceCps: keepManagedValue(item.sourceCps, ACTIVE_ACSM) }
        : {}),
      ...(item?.targetCps !== undefined && keepManagedValue(item.targetCps, ACTIVE_ACSM)
        ? { targetCps: keepManagedValue(item.targetCps, ACTIVE_ACSM) }
        : {}),
      ...(item?.relatedCps !== undefined
        ? {
            relatedCps: Array.isArray(item.relatedCps)
              ? item.relatedCps
                  .map((entry) => keepManagedValue(entry, ACTIVE_ACSM))
                  .filter(Boolean)
              : keepManagedValue(item.relatedCps, ACTIVE_ACSM),
          }
        : {}),
    };
  });
const normalizeSystemAnalytics = (payload) => {
  const p = payload || {};
  const criticalCps = keepManagedValue(
    p.criticalCps || p.criticalCPS?.cpsId || p.dominantCps || p.highestLossCps,
    ACTIVE_ACSM
  );
  const currentBottleneck = keepManagedValue(
    p.currentBottleneck || p.bottleneckCps || p.bottleneck?.cpsId || p.bottleneck,
    ACTIVE_ACSM
  );
  const dominantCps = keepManagedValue(
    p.dominantCps || p.criticalCps || p.criticalCPS?.cpsId || p.highestLossCps,
    ACTIVE_ACSM
  );
  const cpsContributionRanking = filterContributionRanking(
    p.cpsContributionRanking || p.contributionRanking || [],
    ACTIVE_ACSM
  );
  const criticalityRanking = filterContributionRanking(
    p.criticalityRanking || p.criticality || [],
    ACTIVE_ACSM
  );
  const dominantLosses = normalizeManagedArrayEntries(p.dominantLosses || []);
  const crossCpsPatterns = normalizeManagedArrayEntries(
    p.crossCpsPatterns || p.systemEvidence?.crossCpsPatterns || p.evidence?.crossCpsPatterns || []
  );
  const riskDrivers = normalizeManagedArrayEntries(
    p.riskDrivers || p.systemEvidence?.riskDrivers || p.evidence?.riskDrivers || []
  );
  const dominantSignals = normalizeManagedArrayEntries(
    p.systemEvidence?.dominantSignals || p.evidence?.dominantSignals || []
  );
  const supportingSignals = normalizeManagedArrayEntries(p.supportingSignals || []);
  const systemEvidence = {
    ...(p.systemEvidence || {}),
    dominantSignals,
    crossCpsPatterns,
    riskDrivers,
  };
  return {
    ...p,
    criticalCps,
    currentBottleneck,
    bottleneckCps: currentBottleneck,
    dominantCps,
    criticalCPS: normalizeManagedReferenceObject(p.criticalCPS || criticalCps),
    bottleneck: normalizeManagedReferenceObject(p.bottleneck || currentBottleneck),
    cpsContributionRanking,
    criticality: criticalityRanking,
    criticalityRanking,
    dominantLosses,
    crossCpsPatterns,
    riskDrivers,
    supportingSignals,
    systemEvidence,
    explanation: sanitizeManagedText(p.explanation),
    recommendation: sanitizeManagedText(p.recommendation),
    recommendedFocus: sanitizeManagedText(
      keepManagedValue(p.recommendedFocus, ACTIVE_ACSM)
    ),
    actionPlan: {
      ...(p.actionPlan || {}),
      targetCps: keepManagedValue(p.actionPlan?.targetCps, ACTIVE_ACSM),
      recommendation: sanitizeManagedText(p.actionPlan?.recommendation),
    },
    coordinatorOutput: p.coordinatorOutput
      ? {
          ...p.coordinatorOutput,
          criticalCPS: criticalCps,
          recommendation: sanitizeManagedText(p.coordinatorOutput?.recommendation),
          explanation: sanitizeManagedText(p.coordinatorOutput?.explanation),
        }
      : p.coordinatorOutput,
    evidence: {
      ...(p.evidence || {}),
      dominantSignals,
      crossCpsPatterns,
      riskDrivers,
    },
  };
};

const hasKeys = (obj) =>
  !!obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0;

const hasItems = (arr) => Array.isArray(arr) && arr.length > 0;
const isPlainObject = (value) =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const mergeAnalyticsSection = (existing, incoming) => {
  if (incoming === undefined || incoming === null) return existing ?? null;
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    return {
      ...existing,
      ...incoming,
    };
  }
  return incoming;
};

const mergeCpsAnalyticsEntry = (existing = {}, incoming = {}) => ({
  ...existing,
  ...incoming,
  cpsId: incoming?.cpsId ?? existing?.cpsId ?? null,
  cpsName: incoming?.cpsName ?? existing?.cpsName ?? null,
  oee: mergeAnalyticsSection(existing?.oee, incoming?.oee),
  learning: mergeAnalyticsSection(existing?.learning, incoming?.learning),
  reasoning: mergeAnalyticsSection(existing?.reasoning, incoming?.reasoning),
  statistics: mergeAnalyticsSection(existing?.statistics, incoming?.statistics),
  features: mergeAnalyticsSection(existing?.features, incoming?.features),
  window: mergeAnalyticsSection(existing?.window, incoming?.window),
  totals: mergeAnalyticsSection(existing?.totals, incoming?.totals),
  evidence: mergeAnalyticsSection(existing?.evidence, incoming?.evidence),
  basis: mergeAnalyticsSection(existing?.basis, incoming?.basis),
  timeSeriesFeatures: mergeAnalyticsSection(
    existing?.timeSeriesFeatures,
    incoming?.timeSeriesFeatures
  ),
  sourceStatus: incoming?.sourceStatus ?? existing?.sourceStatus ?? null,
  lastUpdate: incoming?.lastUpdate ?? existing?.lastUpdate ?? null,
});

const normalizeEvidenceAgainstBaseline = (raw) => {
  if (!isPlainObject(raw)) return null;

  const normalized = {
    cycleDeltaPct: raw?.cycleDeltaPct ?? raw?.CycleDeltaPct ?? null,
    rpmDeltaPct: raw?.rpmDeltaPct ?? raw?.RPMDeltaPct ?? null,
    torqueDeltaPct: raw?.torqueDeltaPct ?? raw?.TorqueDeltaPct ?? null,
    temperatureDeltaPct:
      raw?.temperatureDeltaPct ?? raw?.TemperatureDeltaPct ?? raw?.tempDeltaPct ?? null,
    tempDeltaPct: raw?.tempDeltaPct ?? raw?.temperatureDeltaPct ?? raw?.TemperatureDeltaPct ?? null,
    oeeDeltaPct: raw?.oeeDeltaPct ?? raw?.OEEDeltaPct ?? null,
  };

  return Object.values(normalized).some((value) => value !== null) ? normalized : raw;
};

const extractLocalBaselineEvidence = (payload) => {
  const candidates = [
    payload?.evidence,
    payload?.basis,
    payload?.learning?.evidence,
    payload?.learning?.basis,
    payload?.learning?.Evidence,
    payload?.learning?.Basis,
    payload?.timeSeriesFeatures?.quickSignals,
    payload?.learning?.timeSeriesFeatures?.quickSignals,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeEvidenceAgainstBaseline(candidate);
    if (normalized) return normalized;
  }

  return null;
};

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

const LIFECYCLE_UNPLUG_REQUEST_TOPIC = ACSM_TOPICS.lifecycleUnplugRequest;
const LIFECYCLE_UPDATE_FUNCTIONS_TOPIC = ACSM_TOPICS.lifecycleUpdateFunctions;
const AUTOUNPLUG_DEDUP_MS = 15000;

const MAX_INGESTION_BUFFER = 300;
const MAX_HISTORY_PER_CPS = 500;
const MAX_SYSTEM_EVENTS = 500;
const MAX_SYSTEM_SNAPSHOTS = 500;
const MAX_SYSTEM_LEARNING_HISTORY = 500;
const SYSTEM_LEARNING_WINDOW_SIZE = 6;

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

const canonicalizeOeeBlock = (input) => {
  const source = input && typeof input === 'object' ? input : {};
  const canonicalValue =
    toNumber(source?.oee) ??
    toNumber(source?.value) ??
    toNumber(source?.current) ??
    null;

  return {
    ...source,
    current: canonicalValue,
    oee: canonicalValue,
    value: canonicalValue,
  };
};

const normalizeLocalAnalyticsPayload = (payload, topic) => {
  const raw = payload && typeof payload === 'object' ? payload : {};
  const source = raw?.payload && typeof raw.payload === 'object' ? raw.payload : raw;
  const topicBase = normalizeTopic(topic).split('/')[0] || '';
  const cpsId = normalizeCpsId(source?.cpsId || raw?.cpsId || topicBase);

  if (!cpsId) return null;

  return {
    ...source,
    cpsId,
    cpsName: source?.cpsName || raw?.cpsName || cpsId,
    ts: source?.ts || raw?.ts || Date.now(),
    timestamp: source?.timestamp || raw?.timestamp || null,
    sourceStatus: source?.sourceStatus || raw?.sourceStatus || null,
    oee: canonicalizeOeeBlock(
      source?.oee && typeof source.oee === 'object'
        ? {
            ...source.oee,
            availability: source?.oee?.availability ?? source?.availability,
            performance:
              source?.oee?.performance ??
              source?.oee?.performanceDisplay ??
              source?.oee?.performanceAccumulated ??
              source?.performance,
            quality: source?.oee?.quality ?? source?.quality,
          }
        : {
            availability: source?.availability,
            performance: source?.performance,
            quality: source?.quality,
            current: source?.oee,
          }
    ),
    telemetry: {
      pieceCounter:
        toNumber(source?.telemetry?.pieceCounter) ??
        toNumber(source?.production?.pieceCounterAbs) ??
        null,
      cycleTimeMs:
        toNumber(source?.telemetry?.cycleTimeMs) ??
        toNumber(source?.features?.avgCycleTimeMs) ??
        null,
      temperature:
        toNumber(source?.telemetry?.temperature) ??
        toNumber(source?.telemetry?.currentTemperature) ??
        toNumber(source?.features?.avgTemperature) ??
        toNumber(source?.features?.avgTempPontaSolda) ??
        null,
      rpm:
        toNumber(source?.telemetry?.rpm) ??
        toNumber(source?.telemetry?.currentRPM) ??
        toNumber(source?.features?.avgRpm) ??
        toNumber(source?.features?.avgCorrenteArco) ??
        null,
      torque:
        toNumber(source?.telemetry?.torque) ??
        toNumber(source?.telemetry?.currentTorque) ??
        toNumber(source?.features?.avgTorque) ??
        toNumber(source?.features?.avgPressaoGas) ??
        null,
    },
  };
};

const mean = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const nums = arr.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

const stddev = (arr) => {
  if (!Array.isArray(arr) || arr.length < 2) return 0;
  const nums = arr.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (nums.length < 2) return 0;
  const avg = mean(nums);
  const variance = nums.reduce((acc, value) => acc + (value - avg) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const getHistorySeries = (history, key) =>
  (history || [])
    .map((item) => toNumber(item?.[key]))
    .filter((value) => Number.isFinite(value));

const getLinearSlope = (series) => {
  if (!Array.isArray(series) || series.length < 2) return 0;
  const y = series.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (y.length < 2) return 0;
  const n = y.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(y);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    const xDelta = i - xMean;
    numerator += xDelta * (y[i] - yMean);
    denominator += xDelta * xDelta;
  }
  if (!denominator) return 0;
  return numerator / denominator;
};

const getSignChanges = (series) => {
  if (!Array.isArray(series) || series.length < 3) return 0;
  let changes = 0;
  let previousSign = 0;
  for (let i = 1; i < series.length; i += 1) {
    const delta = toNumber(series[i], 0) - toNumber(series[i - 1], 0);
    const sign = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    if (sign && previousSign && sign !== previousSign) changes += 1;
    if (sign) previousSign = sign;
  }
  return changes;
};

const getChronicLossSummary = (recentHistory) => {
  const availabilityMean = mean(getHistorySeries(recentHistory, 'systemAvailability'));
  const performanceMean = mean(getHistorySeries(recentHistory, 'systemPerformance'));
  const qualityMean = mean(getHistorySeries(recentHistory, 'systemQuality'));

  const losses = [
    { key: 'availability', score: clamp01(1 - availabilityMean) },
    { key: 'performance', score: clamp01(1 - performanceMean) },
    { key: 'quality', score: clamp01(1 - qualityMean) },
  ].sort((a, b) => b.score - a.score);

  const dominant = losses[0] || { key: null, score: 0 };
  const chronic = dominant.score >= 0.12 ? dominant.key : null;

  return {
    dominantChronicLoss: chronic,
    lossScores: {
      availability: Number((losses.find((item) => item.key === 'availability')?.score || 0).toFixed(4)),
      performance: Number((losses.find((item) => item.key === 'performance')?.score || 0).toFixed(4)),
      quality: Number((losses.find((item) => item.key === 'quality')?.score || 0).toFixed(4)),
    },
  };
};

const buildSystemLearning = (learningHistory) => {
  const history = Array.isArray(learningHistory) ? learningHistory.filter(Boolean) : [];
  const current = history.at(-1) || null;

  if (!current) {
    return {
      learningState: 'insufficient_history',
      learningPattern: 'insufficient_history',
      confidence: 0,
      globalDriftScore: 0,
      predictedSystemOEE: null,
      dominantChronicLoss: null,
      cpsContributionRanking: [],
      recommendation: 'Collect more OEE history for system-level learning.',
      derivedLearning: {
        pattern: 'insufficient_history',
        confidence: 0,
      },
      systemEvidence: {
        dominantSignals: [],
      },
      learningConsensus: null,
      fleetDriftIndex: 0,
      fleetAnomalyIndex: 0,
      stabilityIndex: null,
      supportingSignals: [],
      riskDrivers: [],
      historySummary: {
        samples: history.length,
      },
    };
  }

  const recentWindow = history.slice(-SYSTEM_LEARNING_WINDOW_SIZE);
  const baselineWindow = history.slice(-12, -SYSTEM_LEARNING_WINDOW_SIZE);
  const fullOeeSeries = getHistorySeries(history, 'systemOEE');
  const recentOeeSeries = getHistorySeries(recentWindow, 'systemOEE');
  const baselineOeeSeries = getHistorySeries(baselineWindow, 'systemOEE');

  const recentMeanOee = mean(recentOeeSeries);
  const baselineMeanOee = baselineOeeSeries.length ? mean(baselineOeeSeries) : recentMeanOee;
  const drift = recentMeanOee - baselineMeanOee;
  const slope = getLinearSlope(recentOeeSeries);
  const volatility = stddev(recentOeeSeries);
  const signChanges = getSignChanges(recentOeeSeries);

  const { dominantChronicLoss, lossScores } = getChronicLossSummary(recentWindow);

  let learningPattern = 'stable_system';
  let learningState = 'stable';

  if (recentOeeSeries.length < 3) {
    learningPattern = 'insufficient_history';
    learningState = 'learning';
  } else if (signChanges >= 2 && volatility >= 0.035) {
    learningPattern = 'unstable_oscillation';
    learningState = 'unstable';
  } else if (drift <= -0.03 || slope <= -0.01) {
    learningPattern = 'degrading_system';
    learningState = 'degrading';
  } else if (drift >= 0.02 || slope >= 0.01) {
    learningPattern = 'recovering_system';
    learningState = 'recovering';
  } else if (dominantChronicLoss === 'availability') {
    learningPattern = 'chronic_availability_loss';
    learningState = 'attention';
  } else if (dominantChronicLoss === 'performance') {
    learningPattern = 'chronic_performance_loss';
    learningState = 'attention';
  } else if (dominantChronicLoss === 'quality') {
    learningPattern = 'chronic_quality_loss';
    learningState = 'attention';
  }

  const lastOee = toNumber(fullOeeSeries.at(-1), toNumber(current.systemOEE, null));
  const prevOee = toNumber(fullOeeSeries.at(-2), lastOee);
  const projectedStep = recentOeeSeries.length >= 2 ? slope : lastOee - prevOee;
  const predictedSystemOEE =
    lastOee === null ? null : Number(clamp01(lastOee + projectedStep).toFixed(4));

  const globalDriftScore = Number(
    clamp01(Math.abs(drift) * 8 + Math.abs(slope) * 10 + volatility * 6).toFixed(4)
  );

  /*
  const cpsContributionRanking = filterContributionRanking(
    (current?.cpsMetrics || [])
    .map((item) => {
      const availabilityLoss = clamp01(1 - toNumber(item?.availability, 0));
      const performanceLoss = clamp01(1 - toNumber(item?.performance, 0));
      const qualityLoss = clamp01(1 - toNumber(item?.quality, 0));
      const oeeLoss = clamp01(1 - toNumber(item?.oee, 0));
      const score = Number(
        (
          oeeLoss * 0.4 +
          availabilityLoss * 0.2 +
          performanceLoss * 0.2 +
          qualityLoss * 0.2
        ).toFixed(4)
      );

      return {
        cpsId: item?.cpsId || null,
        cpsName: item?.cpsName || null,
        score,
        oee: toNumber(item?.oee, null),
        availability: toNumber(item?.availability, null),
        performance: toNumber(item?.performance, null),
        quality: toNumber(item?.quality, null),
        dominantLoss:
          availabilityLoss >= performanceLoss && availabilityLoss >= qualityLoss
            ? 'availability'
            : performanceLoss >= availabilityLoss && performanceLoss >= qualityLoss
              ? 'performance'
              : 'quality',
      };
    })
    .sort((a, b) => b.score - a.score),
    ACTIVE_ACSM
  );*/

  const cpsContributionRanking = (current?.cpsMetrics || [])
  .map((item) => {
    const availabilityLoss = clamp01(1 - toNumber(item?.availability, 0));
    const performanceLoss = clamp01(1 - toNumber(item?.performance, 0));
    const qualityLoss = clamp01(1 - toNumber(item?.quality, 0));
    const oeeLoss = clamp01(1 - toNumber(item?.oee, 0));

    const score = Number(
      (
        oeeLoss * 0.4 +
        availabilityLoss * 0.2 +
        performanceLoss * 0.2 +
        qualityLoss * 0.2
      ).toFixed(4)
    );

    return {
      cpsId: normalizeCpsId(item?.cpsId),
      cpsName: item?.cpsName || null,
      score,
      oee: toNumber(item?.oee, null),
      availability: toNumber(item?.availability, null),
      performance: toNumber(item?.performance, null),
      quality: toNumber(item?.quality, null),
      dominantLoss:
        availabilityLoss >= performanceLoss && availabilityLoss >= qualityLoss
          ? 'availability'
          : performanceLoss >= availabilityLoss && performanceLoss >= qualityLoss
            ? 'performance'
            : 'quality',
    };
  })
  .filter((item) => item?.cpsId)
  .sort((a, b) => b.score - a.score);

  let recommendation =
    'Maintain monitoring of aggregated OEE indicators and preserve current operating discipline.';
  if (learningPattern === 'degrading_system') {
    recommendation =
      'Investigate the recent decline in system OEE and prioritize the CPS with the highest contribution to aggregated loss.';
  } else if (learningPattern === 'recovering_system') {
    recommendation =
      'Preserve the recent recovery actions and verify whether the OEE improvement remains stable over the next window.';
  } else if (learningPattern === 'unstable_oscillation') {
    recommendation =
      'Reduce variability in handoff and execution because the system OEE is oscillating across consecutive windows.';
  } else if (learningPattern === 'chronic_availability_loss') {
    recommendation =
      'Availability is the persistent systemic loss driver; prioritize downtime reduction and continuity of operation.';
  } else if (learningPattern === 'chronic_performance_loss') {
    recommendation =
      'Performance is the persistent systemic loss driver; prioritize throughput stability and execution-rate recovery.';
  } else if (learningPattern === 'chronic_quality_loss') {
    recommendation =
      'Quality is the persistent systemic loss driver; prioritize defect reduction and conformance stabilization.';
  }

  const confidence = Number(
    clamp01(
      0.35 +
        Math.min(history.length, 12) / 20 +
        (recentOeeSeries.length >= 5 ? 0.15 : recentOeeSeries.length / 40) +
        (baselineOeeSeries.length >= 4 ? 0.1 : 0) +
        (learningPattern !== 'insufficient_history' ? 0.1 : 0)
    ).toFixed(2)
  );

  const dominantSignals = [
    `drift=${drift.toFixed(4)}`,
    `slope=${slope.toFixed(4)}`,
    `volatility=${volatility.toFixed(4)}`,
    `dominant_loss=${dominantChronicLoss || 'none'}`,
  ];

  const supportingSignals = [
    `recent_mean_oee=${recentMeanOee.toFixed(4)}`,
    `baseline_mean_oee=${baselineMeanOee.toFixed(4)}`,
    `sign_changes=${signChanges}`,
  ];

  const riskDrivers = dominantChronicLoss
    ? [`persistent_${dominantChronicLoss}_loss`, globalDriftScore >= 0.35 ? 'system_drift' : null]
    : [globalDriftScore >= 0.35 ? 'system_drift' : null, volatility >= 0.035 ? 'oee_volatility' : null]
        .filter(Boolean);

  return {
    learningState,
    learningPattern,
    confidence,
    globalDriftScore,
    predictedSystemOEE,
    dominantChronicLoss,
    cpsContributionRanking,
    recommendation,
    derivedLearning: {
      pattern: learningPattern,
      confidence,
      drift: globalDriftScore,
      dominantChronicLoss,
    },
    systemEvidence: {
      dominantSignals,
      drift,
      slope,
      volatility,
      signChanges,
      chronicLossScores: lossScores,
    },
    learningConsensus: dominantChronicLoss ? `loss_${dominantChronicLoss}` : learningPattern,
    fleetDriftIndex: globalDriftScore,
    fleetAnomalyIndex: Number(clamp01(volatility * 10).toFixed(4)),
    stabilityIndex: Number(clamp01(1 - volatility * 8 - Math.abs(slope) * 10).toFixed(4)),
    supportingSignals,
    riskDrivers,
    historySummary: {
      samples: history.length,
      recentMeanOEE: Number(recentMeanOee.toFixed(4)),
      baselineMeanOEE: Number(baselineMeanOee.toFixed(4)),
      volatility: Number(volatility.toFixed(4)),
    },
  };
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
        command: dict.CommandTopic || `${topic}/feat/${key}/cmd`,
        state: dict.StateTopic || `${topic}/feat/${key}/$state`,
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

  const cpsId = normalizeCpsId(rawId) || 'unknown';

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
    getPropertyValueFromElements(smTechnical?.submodelElements, 'AssetType') ||
    getPropertyValueFromElements(smTechnical?.submodelElements, 'ConveyorType') ||
    '';

  const realDescription =
    getSpecificAssetIdValue(aas, 'description') ||
    getPropertyValueFromElements(smTechnical?.submodelElements, 'Description') ||
    '';

  const serialNumber =
    getSpecificAssetIdValue(aas, 'serialNumber') ||
    getPropertyValueFromElements(smDigital?.submodelElements, 'SerialNumber') ||
    '';

  const baseTopic =
    getPropertyValueFromElements(smInterfaces?.submodelElements, 'BaseTopic') ||
    getSpecificAssetIdValue(aas, 'baseTopic') ||
    cpsId;

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
    normalizeUrl(getPropertyValueFromElements(smTechnical?.submodelElements, 'APIData')) ||
    '';

  const funcionalidades = getFeatureDefinitionsFromAAS(parsed, topic);

  return {
    aas,
    cps: {
      id: cpsId,
      nome,
      descricao:
        realDescription ||
        `${manufacturer}${assetType ? ` ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${assetType}` : ''}${
          serialNumber ? ` ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ SN ${serialNumber}` : ''
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
  systemLearningModel: null,
  systemCausality: null,
  systemAnomaly: null,
  systemForecast: null,
  systemReasoning: {},
  crossCpsPatterns: [],
  riskSummary: {},
  recommendedFocus: null,
  actionPlan: {},
  systemState: {},
  coordinationMode: null,
  learningConsensus: null,
  learningState: 'insufficient_history',
  learningPattern: 'insufficient_history',
  globalDriftScore: 0,
  dominantChronicLoss: null,
  cpsContributionRanking: [],
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

  const oee = toNumber(snap?.oee?.oee ?? snap?.oee?.value ?? snap?.oee?.current, 0);
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

const getDominantLossFromMetrics = ({ availability, performance, quality } = {}) => {
  const losses = [
    { key: 'availability', value: clamp01(1 - toNumber(availability, 0)) },
    { key: 'performance', value: clamp01(1 - toNumber(performance, 0)) },
    { key: 'quality', value: clamp01(1 - toNumber(quality, 1)) },
  ].sort((a, b) => b.value - a.value);

  return losses[0]?.key || 'availability';
};

const getSystemTrend = ({ learningPattern, predictedGlobalOEE, globalOEE, historySummary } = {}) => {
  const pattern = String(learningPattern || '').toLowerCase();
  if (pattern.includes('recovering')) return 'positive';
  if (pattern.includes('unstable') || pattern.includes('oscillation')) return 'unstable';
  if (pattern.includes('degrading') || pattern.includes('degraded')) return 'negative';

  const current = toNumber(globalOEE?.oee ?? globalOEE, null);
  const predicted = toNumber(predictedGlobalOEE, null);
  if (Number.isFinite(current) && Number.isFinite(predicted)) {
    if (predicted < current - 0.01) return 'negative';
    if (predicted > current + 0.01) return 'positive';
  }

  const volatility = toNumber(historySummary?.volatility, 0);
  if (volatility >= 0.035) return 'unstable';
  return 'stable';
};

const getSystemStateFromSignals = ({ trend, riskLevel, anomalyStatus } = {}) => {
  if (trend === 'positive') return 'recovering';
  if (anomalyStatus === 'unstable' || trend === 'unstable') return 'unstable';
  if (riskLevel === 'high' || trend === 'negative') return 'degrading';
  if (riskLevel === 'medium') return 'attention';
  return 'stable';
};

const getStabilityFromSignals = ({ trend, learningPattern, anomalyStatus } = {}) => {
  const pattern = String(learningPattern || '').toLowerCase();
  if (trend === 'positive' || pattern.includes('recovering')) return 'improving';
  if (trend === 'unstable' || anomalyStatus === 'unstable' || pattern.includes('unstable')) {
    return 'unstable';
  }
  if (trend === 'negative' || pattern.includes('degrading') || pattern.includes('degraded')) {
    return 'degrading';
  }
  return 'persistent';
};

const getCpsStateFromSnapshot = (snap) => {
  const pattern = String(
    snap?.learningPattern ||
      snap?.learning?.pattern ||
      snap?.learning?.learned ||
      snap?.features?.learningPattern ||
      ''
  ).toLowerCase();
  const risk = String(snap?.riskLevel || snap?.reasoning?.riskLevel || '').toLowerCase();
  const anomalyStatus = String(snap?.anomaly?.status || '').toLowerCase();
  const oee = toNumber(snap?.oee?.oee ?? snap?.oee?.value ?? snap?.oee?.current, null);

  if (pattern.includes('recovering')) return 'improving';
  if (pattern.includes('unstable') || anomalyStatus === 'unstable') return 'unstable';
  if (pattern.includes('degrading') || risk === 'high' || (Number.isFinite(oee) && oee < 0.55)) {
    return 'degrading';
  }
  if (risk === 'medium' || (Number.isFinite(oee) && oee < 0.75)) return 'attention';
  return 'stable';
};

const getExpectedOee = ({ globalOEE, predictedGlobalOEE, trend } = {}) => {
  const current = toNumber(globalOEE?.oee ?? globalOEE, 0);
  const predicted = toNumber(predictedGlobalOEE, null);
  const fallback =
    trend === 'negative'
      ? current - 0.04
      : trend === 'positive'
        ? current + 0.03
        : trend === 'unstable'
          ? current - 0.02
          : current;
  return Number(clamp01(Number.isFinite(predicted) ? predicted : fallback).toFixed(4));
};

const buildSystemEvidenceList = ({
  globalOEE,
  latest,
  criticalCPS,
  dominantLoss,
  trend,
  learningPattern,
  systemLearning,
  anomalyScore,
}) => {
  const evidence = [];
  const currentOee = toNumber(globalOEE?.oee, 0);
  const availability = toNumber(globalOEE?.availability, 0);
  const performance = toNumber(globalOEE?.performance, 0);
  const quality = toNumber(globalOEE?.quality, 1);
  const degradedCps = (latest || []).filter((snap) => {
    const oee = toNumber(snap?.oee?.oee ?? snap?.oee?.value ?? snap?.oee?.current, 1);
    const risk = String(snap?.riskLevel || snap?.reasoning?.riskLevel || '').toLowerCase();
    const pattern = String(snap?.learningPattern || snap?.learning?.pattern || '').toLowerCase();
    return oee < 0.75 || risk === 'high' || pattern.includes('degrad') || pattern.includes('chronic');
  });

  if (currentOee < 0.75) evidence.push(`global OEE remained below 75% in the last ${SYSTEM_LEARNING_WINDOW_SIZE} windows`);
  if (availability < 0.65) evidence.push(`global availability remained below 65% in the last ${SYSTEM_LEARNING_WINDOW_SIZE} windows`);
  if (performance < 0.75) evidence.push('global performance is below the expected operating band');
  if (quality < 0.95) evidence.push('global quality is below the expected conformance band');
  if (degradedCps.length >= 2) evidence.push('multiple CPS showed simultaneous degradation');
  if (criticalCPS?.cpsId) evidence.push(`${criticalCPS.cpsId} contributed most to the system loss`);
  if (trend === 'negative') evidence.push('global OEE trend is negative across recent windows');
  if (trend === 'unstable' || anomalyScore >= 0.65) evidence.push('system variability increased across recent windows');
  if (String(learningPattern || '').includes('chronic')) {
    evidence.push(`global learning converged to persistent ${dominantLoss} loss`);
  }
  if (systemLearning?.riskDrivers?.length) {
    evidence.push(`learning risk drivers include ${systemLearning.riskDrivers.slice(0, 2).join(' and ')}`);
  }

  return [...new Set(evidence)].slice(0, 8);
};

const buildSystemIntelligence = ({
  latest,
  globalOEE,
  criticalityRanking,
  criticalCPS,
  dominantLosses,
  learnedPattern,
  riskLevel,
  confidence,
  systemLearning,
  cascadeEffect,
  synchronizationIssue,
  predictedGlobalOEE,
}) => {
  const dominantLoss =
    systemLearning?.dominantChronicLoss ||
    dominantLosses?.[0]?.dominantDimension ||
    getDominantLossFromMetrics(globalOEE);
  const learningPattern = systemLearning?.learningPattern || learnedPattern || 'unknown';
  const trend = getSystemTrend({
    learningPattern,
    predictedGlobalOEE: systemLearning?.predictedSystemOEE ?? predictedGlobalOEE,
    globalOEE,
    historySummary: systemLearning?.historySummary,
  });
  const degradedByAvailability = (latest || []).filter(
    (snap) => toNumber(snap?.oee?.availability, 1) < 0.7
  );
  const degradedByPerformance = (latest || []).filter(
    (snap) => toNumber(snap?.oee?.performance, 1) < 0.75
  );
  const highAnomalyCps = (latest || []).filter((snap) => toNumber(snap?.anomaly?.score, 0) >= 0.55);
  const enrichedRanking = (criticalityRanking || [])
    .map((entry) => {
      const snap = (latest || []).find(
        (item) => normalizeCpsId(item?.cpsId || item?.baseTopic) === normalizeCpsId(entry?.cpsId)
      );
      const dominantLossForCps = getDominantLossFromMetrics({
        availability: snap?.oee?.availability,
        performance: snap?.oee?.performance,
        quality: snap?.oee?.quality,
      });
      const localConfidence = toNumber(
        snap?.confidence ?? snap?.reasoning?.confidence ?? snap?.learning?.confidence,
        0.5
      );
      const anomalyBoost = toNumber(snap?.anomaly?.score, 0) * 0.15;
      const riskBoost =
        String(snap?.riskLevel || snap?.reasoning?.riskLevel || '').toLowerCase() === 'high'
          ? 0.08
          : 0;
      const impactScore = clamp01(toNumber(entry?.score, 0) * 0.78 + localConfidence * 0.14 + anomalyBoost + riskBoost);

      return {
        cpsId: entry.cpsId,
        cpsName: entry.cpsName || snap?.cpsName || '',
        baseTopic: entry.baseTopic || snap?.baseTopic || entry.cpsId,
        score: entry.score,
        impactScore: Number(impactScore.toFixed(4)),
        dominantLoss: dominantLossForCps,
        state: getCpsStateFromSnapshot(snap),
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore);
  const relatedCps = enrichedRanking
    .filter((entry) => entry.impactScore >= 0.35 || entry.cpsId === criticalCPS?.cpsId)
    .slice(0, 3)
    .map((entry) => entry.cpsId);
  const affectedCps = relatedCps.length ? relatedCps : enrichedRanking.slice(0, 2).map((entry) => entry.cpsId);

  let probableCause = `${dominantLoss} loss`;
  let causeType = `${dominantLoss}_loss`;
  if (degradedByAvailability.length >= 2) {
    probableCause = 'distributed availability loss';
    causeType = 'multi_cps_degradation';
  } else if (enrichedRanking[0]?.impactScore >= 0.65) {
    probableCause = 'single critical bottleneck';
    causeType = 'single_critical_bottleneck';
  } else if (degradedByPerformance.length >= 2 || dominantLoss === 'performance') {
    probableCause = 'execution slowdown';
    causeType = 'execution_slowdown';
  } else if (synchronizationIssue || highAnomalyCps.length >= 2) {
    probableCause = 'system instability';
    causeType = 'system_instability';
  } else if (cascadeEffect || String(learningPattern).includes('degrad')) {
    probableCause = 'propagating degradation risk';
    causeType = 'propagating_degradation_risk';
  }

  const affectedDimensions = [
    dominantLoss,
    toNumber(globalOEE?.oee, 0) < 0.75 ? 'global_oee' : null,
    toNumber(globalOEE?.availability, 1) < 0.7 ? 'availability' : null,
    toNumber(globalOEE?.performance, 1) < 0.75 ? 'throughput' : null,
    toNumber(globalOEE?.quality, 1) < 0.95 ? 'quality' : null,
  ].filter(Boolean);
  const anomalyScore = Number(
    clamp01(
      Math.max(
        systemLearning?.fleetAnomalyIndex || 0,
        1 - toNumber(globalOEE?.oee, 0),
        enrichedRanking[0]?.impactScore || 0
      )
    ).toFixed(4)
  );
  let anomalyStatus = 'normal';
  if (trend === 'unstable' || synchronizationIssue) anomalyStatus = 'unstable';
  else if (riskLevel === 'high' || toNumber(globalOEE?.oee, 0) < 0.55) anomalyStatus = 'degraded';
  else if (affectedDimensions.length >= 2 || riskLevel === 'medium') anomalyStatus = 'below_normal';
  else if (toNumber(globalOEE?.oee, 0) >= 0.85) anomalyStatus = 'above_normal';

  const systemEvidence = buildSystemEvidenceList({
    globalOEE,
    latest,
    criticalCPS,
    dominantLoss,
    trend,
    learningPattern,
    systemLearning,
    anomalyScore,
  });
  const stability = getStabilityFromSignals({ trend, learningPattern, anomalyStatus });
  const systemState = getSystemStateFromSignals({ trend, riskLevel, anomalyStatus });
  const expectedOEE = getExpectedOee({
    globalOEE,
    predictedGlobalOEE: systemLearning?.predictedSystemOEE ?? predictedGlobalOEE,
    trend,
  });
  const forecastRisk =
    riskLevel === 'high' || anomalyStatus === 'degraded' || expectedOEE < 0.55
      ? 'high'
      : riskLevel === 'medium' || anomalyStatus === 'unstable' || expectedOEE < 0.7
        ? 'medium'
        : 'low';
  const nextState =
    forecastRisk === 'high' && affectedCps.length >= 2
      ? 'coordination_required'
      : String(learningPattern).includes('chronic') && affectedCps.length >= 2
        ? 'maintenance_wave_risk'
        : trend === 'positive'
          ? 'stabilizing'
          : trend === 'unstable'
            ? 'unstable'
            : trend === 'negative'
              ? 'distributed_degradation'
              : 'stabilizing';
  const causalConfidence = Number(
    clamp01(Math.max(toNumber(confidence, 0.5) - 0.02, systemEvidence.length >= 3 ? 0.72 : 0.6)).toFixed(2)
  );

  const systemLearningModel = {
    model: 'multi_cps_system_learning_v1',
    pattern: learningPattern,
    windowSize: SYSTEM_LEARNING_WINDOW_SIZE,
    dominantLoss,
    criticalCps: affectedCps.length ? affectedCps : criticalCPS?.cpsId ? [criticalCPS.cpsId] : [],
    stability,
    confidence: toNumber(confidence, systemLearning?.confidence ?? 0),
    description: `${stability} system pattern driven by ${dominantLoss} loss across critical CPS`,
  };
  const systemCausality = {
    probableCause,
    causeType,
    primaryDriver: enrichedRanking[0]?.cpsId || criticalCPS?.cpsId || null,
    relatedCps: affectedCps,
    causalConfidence,
  };
  const systemAnomaly = {
    score: anomalyScore,
    status: anomalyStatus,
    affectedDimensions: [...new Set(affectedDimensions)],
    affectedCps,
  };
  const systemForecast = {
    nextState,
    timeHorizon: 'short_term',
    risk: forecastRisk,
    confidence: toNumber(confidence, systemLearning?.confidence ?? 0),
    expectedOEE,
  };
  const systemReasoning = {
    systemState,
    dominantLoss,
    primaryIssue:
      causeType === 'multi_cps_degradation'
        ? `distributed ${dominantLoss} loss across critical CPS`
        : `${probableCause} led by ${systemCausality.primaryDriver || 'managed CPS'}`,
    probableCause:
      systemCausality.primaryDriver && causeType !== 'single_critical_bottleneck'
        ? `${causeType.replace(/_/g, ' ')} led by ${systemCausality.primaryDriver}`
        : probableCause,
    trend,
    confidence: toNumber(confidence, systemLearning?.confidence ?? 0),
    executiveInterpretation:
      systemState === 'stable'
        ? 'system operation remains stable with no dominant multi-CPS degradation'
        : `system ${systemState} behavior is driven by ${dominantLoss} losses concentrated in critical CPS`,
    recommendation:
      affectedCps.length >= 2
        ? `prioritize stabilization of ${affectedCps.join(' and ')} before broader optimization actions`
        : systemCausality.primaryDriver
          ? `prioritize stabilization of ${systemCausality.primaryDriver} before broader optimization actions`
          : 'maintain system monitoring and continue coordinated supervision',
  };

  return {
    systemLearningModel,
    systemEvidence,
    systemCausality,
    criticalityRanking: enrichedRanking,
    systemAnomaly,
    systemForecast,
    systemReasoning,
    trend,
  };
};

export const CPSProvider = ({ children, acsmId, config }) => {
  const acsmConfig = useMemo(
    () => ({ ...getActiveAcsmConfig(acsmId), ...(config || {}) }),
    [acsmId, config]
  );

  const [registry, setRegistry] = useState({});
  const [addedCPS, setAddedCPS] = useState([]);
  const [log, setLog] = useState([]);
  const [mqttClient, setMqttClient] = useState(null);
  const [mqttData, setMqttData] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [cpsAnalytics, setCpsAnalyticsState] = useState({});
  const [ingestionBuffer, setIngestionBuffer] = useState([]);
  const [systemAnalytics, setSystemAnalytics] = useState(emptySystemAnalytics());

  const knowledgeStoreRef = useRef({
    cps: {},
    system: {
      snapshots: [],
      learningHistory: [],
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

  const setCpsAnalytics = useCallback((updater) => {
    setCpsAnalyticsState((prev) => {
      const resolved = typeof updater === 'function' ? updater(prev) : updater;

      if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) {
        return prev;
      }

      const next = { ...prev };
      Object.entries(resolved).forEach(([cpsId, entry]) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          next[cpsId] = entry;
          return;
        }
        next[cpsId] = mergeCpsAnalyticsEntry(prev[cpsId] || {}, entry);
      });
      return next;
    });
  }, []);

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

  const availableCPSRef = useRef([]);
  useEffect(() => {
    availableCPSRef.current = availableCPS;
  }, [availableCPS]);

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
    const normalizedCpsId = keepManagedValue(cpsId, ACTIVE_ACSM);
    if (!normalizedCpsId) return;

    const store = knowledgeStoreRef.current;
    const registryCps =
      Object.values(registryRef.current || {}).find((c) => c?.id === normalizedCpsId) || null;

    if (!store.cps[normalizedCpsId]) {
      store.cps[normalizedCpsId] = {
        cpsId: normalizedCpsId,
        cpsName: registryCps?.nome || cpsId,
        baseTopic: registryCps?.topic || '',
        history: [],
        reasoningDocs: [],
        learningDocs: [],
      };
    }

    const baselineEvidence = extractLocalBaselineEvidence(payload);

    const entry = {
      ts: payload?.ts || nowTs(),
      cpsId: normalizedCpsId,
      cpsName: payload?.cpsName || registryCps?.nome || normalizedCpsId,
      baseTopic: payload?.baseTopic || registryCps?.topic || '',
      oee: payload?.oee || null,
      learning: payload?.learning || null,
      reasoning: payload?.reasoning || null,
      statistics: payload?.statistics || null,
      evidence: baselineEvidence,
      operationalData: payload?.operationalData || registryCps?.operationalData || null,
      globalState: payload?.globalState || registryCps?.globalState || null,
      raw: payload || null,
    };

    store.cps[normalizedCpsId].history = clampArray(
      [...store.cps[normalizedCpsId].history, entry],
      MAX_HISTORY_PER_CPS
    );

    if (payload?.reasoning) {
      store.cps[normalizedCpsId].reasoningDocs = clampArray(
        [
          ...store.cps[normalizedCpsId].reasoningDocs,
          {
            ts: entry.ts,
            data: payload.reasoning,
          },
        ],
        100
      );
    }

    if (payload?.learning) {
      store.cps[normalizedCpsId].learningDocs = clampArray(
        [
          ...store.cps[normalizedCpsId].learningDocs,
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
            cpsId: normalizedCpsId,
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
    const cpsEntries = Object.values(store.cps || {}).filter((entry) =>
      keepManagedValue(entry?.cpsId || entry?.baseTopic, ACTIVE_ACSM)
    );

    if (!cpsEntries.length) {
      const empty = emptySystemAnalytics();
      setSystemAnalytics((prev) => ({
        ...prev,
        ...empty,
        systemEvidence: {},
        actionPlan: prev.actionPlan || {},
        systemState: prev.systemState || {},
        supportingSignals: [],
        riskDrivers: [],
        crossCpsPatterns: [],
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
        systemEvidence: {},
        actionPlan: prev.actionPlan || {},
        systemState: prev.systemState || {},
        supportingSignals: [],
        riskDrivers: [],
        crossCpsPatterns: [],
        coordinationMode: prev.coordinationMode ?? null,
      }));
      return empty;
    }

    const globalOEE = {
      availability: Number(mean(latest.map((x) => x?.oee?.availability)).toFixed(4)),
      performance: Number(mean(latest.map((x) => x?.oee?.performance)).toFixed(4)),
      quality: Number(mean(latest.map((x) => x?.oee?.quality)).toFixed(4)),
      oee: Number(mean(latest.map((x) => x?.oee?.oee ?? x?.oee?.value ?? x?.oee?.current)).toFixed(4)),
    };

    const criticalityRanking = filterContributionRanking(
      latest.map((snap) => ({
        cpsId: snap.cpsId,
        cpsName: snap.cpsName,
        baseTopic: snap.baseTopic,
        score: computeCriticalityFromSnapshot(snap),
      }))
      .sort((a, b) => b.score - a.score),
    ACTIVE_ACSM
  );

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
      .map((x) => toNumber(x?.oee?.oee ?? x?.oee?.value ?? x?.oee?.current))
      .filter((x) => Number.isFinite(x));

    const cascadeEffect =
      oees.length >= 2
        ? Math.max(...oees) - Math.min(...oees) < 0.08 && mean(oees) < 0.75
        : false;

    const dominantLosses = normalizeManagedArrayEntries(latest.map((snap) => {
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
    }));

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

    const recommendedFocus = keepManagedValue(
      bottleneck?.cpsId || criticalCPS?.cpsId,
      ACTIVE_ACSM
    );

    const actionPlan = recommendedFocus
      ? {
          priority: riskLevel === 'high' ? 'high' : riskLevel === 'medium' ? 'medium' : 'low',
          actionType: synchronizationIssue
            ? 'resynchronize_flow'
            : bottleneck?.cpsId
              ? 'rebalance_bottleneck'
              : 'monitor',
          expectedImpact:
            riskLevel === 'high'
              ? 'Reduce systemic OEE loss'
              : synchronizationIssue
                ? 'Improve system coordination'
                : 'Stabilize operation',
          targetCps: recommendedFocus,
          recommendation,
        }
      : {};

    const systemState = {
      health: riskLevel === 'high' ? 'critical' : riskLevel === 'medium' ? 'attention' : 'stable',
      coordinationMode: synchronizationIssue
        ? 'adaptive_resynchronization'
        : cascadeEffect
          ? 'loss_containment'
          : 'normal_coordination',
      recommendedFocus,
    };

    const analytics = normalizeSystemAnalytics({
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
      recommendedFocus,
      actionPlan,
      systemState,
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
    });

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

    store.system.learningHistory = clampArray(
      [
        ...(store.system.learningHistory || []),
        {
          ts: analytics.ts,
          systemOEE: globalOEE.oee,
          systemAvailability: globalOEE.availability,
          systemPerformance: globalOEE.performance,
          systemQuality: globalOEE.quality,
          cpsMetrics: latest.map((snap) => ({
            cpsId: snap?.cpsId || null,
            cpsName: snap?.cpsName || null,
            oee: toNumber(snap?.oee?.oee ?? snap?.oee?.value ?? snap?.oee?.current, null),
            availability: toNumber(snap?.oee?.availability, null),
            performance: toNumber(snap?.oee?.performance, null),
            quality: toNumber(snap?.oee?.quality, null),
          })),
        },
      ],
      MAX_SYSTEM_LEARNING_HISTORY
    );

    const systemLearning = normalizeSystemAnalytics(buildSystemLearning(store.system.learningHistory));

    analytics.learningState = systemLearning.learningState;
    analytics.learningPattern = systemLearning.learningPattern;
    analytics.globalDriftScore = systemLearning.globalDriftScore;
    analytics.predictedSystemOEE = systemLearning.predictedSystemOEE;
    analytics.dominantChronicLoss = systemLearning.dominantChronicLoss;
    analytics.cpsContributionRanking = systemLearning.cpsContributionRanking;
    analytics.recommendation = systemLearning.recommendation || analytics.recommendation;
    analytics.confidence = systemLearning.confidence;
    analytics.derivedLearning = systemLearning.derivedLearning;
    analytics.systemEvidence = systemLearning.systemEvidence;
    analytics.learningConsensus = systemLearning.learningConsensus;
    analytics.fleetDriftIndex = systemLearning.fleetDriftIndex;
    analytics.fleetAnomalyIndex = systemLearning.fleetAnomalyIndex;
    analytics.stabilityIndex = systemLearning.stabilityIndex;
    analytics.supportingSignals = systemLearning.supportingSignals;
    analytics.riskDrivers = systemLearning.riskDrivers;
    analytics.historySummary = systemLearning.historySummary;

    const systemIntelligence = buildSystemIntelligence({
      latest,
      globalOEE,
      criticalityRanking: analytics.criticalityRanking,
      criticalCPS: analytics.criticalCPS,
      dominantLosses: analytics.dominantLosses,
      learnedPattern: analytics.learningPattern || learnedPattern,
      riskLevel: analytics.riskLevel || riskLevel,
      confidence: analytics.confidence,
      systemLearning,
      cascadeEffect,
      synchronizationIssue,
      predictedGlobalOEE: analytics.predictedSystemOEE ?? predictedGlobalOEE,
    });

    analytics.systemLearningModel = systemIntelligence.systemLearningModel;
    analytics.systemEvidenceList = systemIntelligence.systemEvidence;
    analytics.systemCausality = systemIntelligence.systemCausality;
    analytics.criticalityRanking = systemIntelligence.criticalityRanking;
    analytics.criticality = systemIntelligence.criticalityRanking;
    analytics.systemAnomaly = systemIntelligence.systemAnomaly;
    analytics.systemForecast = systemIntelligence.systemForecast;
    analytics.systemReasoning = systemIntelligence.systemReasoning;
    analytics.reasoning = {
      ...(analytics.reasoning || {}),
      ...systemIntelligence.systemReasoning,
      supportingEvidence: systemIntelligence.systemEvidence,
      systemCausality: systemIntelligence.systemCausality,
      systemLearningModel: systemIntelligence.systemLearningModel,
      systemForecast: systemIntelligence.systemForecast,
    };
    analytics.trend = systemIntelligence.trend;
    analytics.recommendation =
      systemIntelligence.systemReasoning?.recommendation || analytics.recommendation;
    analytics.systemEvidence = {
      ...(analytics.systemEvidence || {}),
      narrative: systemIntelligence.systemEvidence,
    };

    analytics.coordinatorOutput = {
      ...(analytics.coordinatorOutput || {}),
      learningState: analytics.learningState,
      learningPattern: analytics.learningPattern,
      globalDriftScore: analytics.globalDriftScore,
      predictedSystemOEE: analytics.predictedSystemOEE,
      dominantChronicLoss: analytics.dominantChronicLoss,
      confidence: analytics.confidence,
      recommendation: analytics.recommendation,
      systemLearningModel: analytics.systemLearningModel,
      systemEvidence: analytics.systemEvidenceList,
      systemCausality: analytics.systemCausality,
      criticalityRanking: analytics.criticalityRanking,
      systemAnomaly: analytics.systemAnomaly,
      systemForecast: analytics.systemForecast,
      systemReasoning: analytics.systemReasoning,
    };

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
      supportingSignals: analytics.supportingSignals || [],
      riskDrivers: analytics.riskDrivers || [],
      coordinationMode: analytics.coordinationMode ?? prev.coordinationMode ?? null,
      crossCpsPatterns: analytics.crossCpsPatterns || [],
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
        topic === ACSM_TOPICS.globalOee ||
        topic === ACSM_TOPICS.globalReasoning ||
        topic === ACSM_TOPICS.globalLearning ||
        topic === ACSM_TOPICS.coordinatorOutput ||
        topic === ACSM_TOPICS.chainGlobalState ||
        topic === ACSM_TOPICS.chainGlobalReasoning ||
        topic === ACSM_TOPICS.chainGlobalLearning ||
        topic === ACSM_TOPICS.chainCoordinatorOutput
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

      

        const normalized = normalizeSystemAnalytics({
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
            'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â',
          patternLearned:
            raw?.patternLearned || raw?.learnedPattern || raw?.systemPattern || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â',
          systemPattern:
            raw?.systemPattern || raw?.patternLearned || raw?.learnedPattern || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â',
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
          level3Mode: raw?.level3Mode || raw?.globalSummary?.level3Mode || null,
          activeParticipantsCount: toNumber(
            raw?.activeParticipantsCount ?? raw?.globalSummary?.activeParticipantsCount,
            null
          ),
          expectedParticipantsCount: toNumber(
            raw?.expectedParticipantsCount ?? raw?.globalSummary?.expectedParticipantsCount,
            null
          ),
          managedCpsCount: toNumber(
            raw?.managedCpsCount ??
              raw?.globalSummary?.managedCpsCount ??
              raw?.plantKnowledge?.managedCpsCount,
            null
          ),
          managedCpsIds:
            raw?.managedCpsIds ||
            raw?.globalSummary?.managedCpsIds ||
            raw?.plantKnowledge?.managedCpsIds ||
            [],
          coordinatorOutput:
            topic === ACSM_TOPICS.chainCoordinatorOutput
              ? raw
              : {
                  ...(raw?.coordinatorOutput || {}),
                  globalOEE: toNumber(raw?.globalOEE?.oee ?? raw?.globalOEE ?? raw?.oeeGlobal, null),
                  recommendation: raw?.recommendation || raw?.coordinatorOutput?.recommendation || null,
                  explanation: raw?.explanation || raw?.coordinatorOutput?.explanation || null,
                },
        });

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
          supportingSignals: normalized.supportingSignals || [],
          riskDrivers: normalized.riskDrivers || [],
          crossCpsPatterns: normalized.crossCpsPatterns || [],
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

        setLevel3RuntimeStatus((prev) => ({
          ...prev,
          level3Mode: normalized?.level3Mode || prev.level3Mode || 'partial',
          activeParticipantsCount:
            normalized?.activeParticipantsCount ?? prev.activeParticipantsCount ?? 0,
          expectedParticipantsCount:
            normalized?.expectedParticipantsCount ?? prev.expectedParticipantsCount ?? 3,
          managedCpsCount: normalized?.managedCpsCount ?? prev.managedCpsCount ?? 0,
          managedCpsIds: normalized?.managedCpsIds || prev.managedCpsIds || [],
          presentAcsms: raw?.presentAcsms || prev.presentAcsms || [],
          missingAcsms: raw?.missingAcsms || prev.missingAcsms || [],
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
        const normalized = normalizeLocalAnalyticsPayload(parsed, topic);

        if (!normalized?.cpsId) return;

        setCpsAnalyticsState((prev) => ({
          ...prev,
          [normalized.cpsId]: mergeCpsAnalyticsEntry(prev?.[normalized.cpsId] || {}, {
            ...normalized,
            oee: canonicalizeOeeBlock({
              ...(prev?.[normalized.cpsId]?.oee || {}),
              ...(normalized?.oee || {}),
            }),
          }),
        }));

        if (owner) {
          const nextOwnerOee = {
            availability: normalized?.oee?.availability ?? owner?.oee?.availability ?? null,
            performance: normalized?.oee?.performance ?? owner?.oee?.performance ?? null,
            quality: normalized?.oee?.quality ?? owner?.oee?.quality ?? null,
            value:
              normalized?.oee?.oee ??
              normalized?.oee?.value ??
              normalized?.oee?.current ??
              owner?.oee?.value ??
              null,
            totals: normalized?.totals ?? owner?.oee?.totals ?? null,
            sourceStatus: normalized?.sourceStatus ?? owner?.oee?.sourceStatus ?? null,
            lastUpdate: normalized?.ts ?? owner?.oee?.lastUpdate ?? Date.now(),
          };

          const nextOperationalData = {
            ...(owner?.operationalData || {}),
            pieceCounter:
              normalized?.telemetry?.pieceCounter ??
              owner?.operationalData?.pieceCounter ??
              null,
            cycleTimeMs:
              normalized?.telemetry?.cycleTimeMs ??
              owner?.operationalData?.cycleTimeMs ??
              null,
            currentTemperature:
              normalized?.telemetry?.temperature ??
              owner?.operationalData?.currentTemperature ??
              null,
            currentRPM:
              normalized?.telemetry?.rpm ??
              owner?.operationalData?.currentRPM ??
              null,
            currentTorque:
              normalized?.telemetry?.torque ??
              owner?.operationalData?.currentTorque ??
              null,
            operationMode: owner?.operationalData?.operationMode ?? 'play',
          };

          setAddedCPS((prev) =>
            prev.map((c) =>
              c.id === owner.id
                ? {
                    ...c,
                    oee: nextOwnerOee,
                    operationalData: nextOperationalData,
                  }
                : c
            )
          );

          patchRegistryCps(owner, {
            oee: nextOwnerOee,
            operationalData: nextOperationalData,
          });

          setLog((prev) => [
            ...prev,
            {
              time: new Date().toLocaleTimeString(),
              message:
                `[OEE] ${owner.nome} -> ` +
                `A=${String(normalized?.oee?.availability ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â')} ` +
                `P=${String(normalized?.oee?.performance ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â')} ` +
                `Q=${String(normalized?.oee?.quality ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â')} ` +
                `OEE=${String(normalized?.oee?.oee ?? normalized?.oee?.value ?? normalized?.oee?.current ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â')}`,
            },
          ]);
        }

        updateKnowledgeStoreFromAnalytics(normalized.cpsId, {
          ...normalized,
          ts: normalized?.ts ?? Date.now(),
        });

        runSystemAnalytics();
        return;
      }

      if (topic.endsWith('/learning')) {
        const existingAnalytics = cpsAnalyticsRef.current?.[cpsId] || {};
        const baselineEvidence = extractLocalBaselineEvidence(parsed);
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

        const nextAnalytics = mergeCpsAnalyticsEntry(existingAnalytics, {
          cpsId,
          cpsName: parsed?.cpsName || existingAnalytics?.cpsName || cpsId,
          learning: parsed?.learning,
          reasoning: parsed?.reasoning,
          oee: canonicalizeOeeBlock(parsed?.oee),
          statistics: parsed?.statistics,
          features: parsed?.features,
          window: parsed?.window,
          totals: parsed?.totals,
          evidence: baselineEvidence,
          basis: baselineEvidence || parsed?.basis || parsed?.learning?.basis || parsed?.learning?.Basis,
          timeSeriesFeatures: parsed?.timeSeriesFeatures,
          lastUpdate: parsed?.ts || new Date().toISOString(),
        });

        setCpsAnalyticsState((prev) => {
          return {
            ...prev,
            [cpsId]: mergeCpsAnalyticsEntry(prev[cpsId] || {}, nextAnalytics),
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
          ...nextAnalytics,
          operationalData: nextOperationalData,
          ts: parsed?.ts || Date.now(),
        });

        const analytics = runSystemAnalytics();

        pushSystemEvent({
          ts: parsed?.ts || Date.now(),
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
  }, [
    patchRegistryCps,
    pushSystemEvent,
    runSystemAnalytics,
    updateKnowledgeStoreFromAnalytics,
  ]);

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
              `[AAS] Endpoints -> description=${cps.endpoints.description || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'} | ` +
              `summary=${cps.endpoints.summary || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'} | indicators=${cps.endpoints.indicators || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'} | ` +
              `history=${cps.endpoints.history || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'} | health=${cps.endpoints.health || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}`,
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
        const query = new URLSearchParams({ acsmId: acsmConfig.id }).toString();
        const res = await fetch(`/api/cps?${query}`);
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
  }, [acsmConfig.id, registerCPS]);

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
        source: ACTIVE_ACSM.code,
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
            `[UPDATE_FUNCTIONS] ${restored.nome} notified ${ACTIVE_ACSM.code} that maintenance was completed ` +
            `and the CPS resumed operation autonomously.`,
        },
      ]);

      return true;
    },
    [patchRegistryCps, appendRegistryHistory, persistPlugEvent, pushSystemEvent]
  );

  const handleAnalyticsMessageRef = useRef(handleAnalyticsMessage);
  useEffect(() => {
    handleAnalyticsMessageRef.current = handleAnalyticsMessage;
  }, [handleAnalyticsMessage]);

  const patchRegistryCpsRef = useRef(patchRegistryCps);
  useEffect(() => {
    patchRegistryCpsRef.current = patchRegistryCps;
  }, [patchRegistryCps]);

  const restoreCPSFromMaintenanceRef = useRef(restoreCPSFromMaintenance);
  useEffect(() => {
    restoreCPSFromMaintenanceRef.current = restoreCPSFromMaintenance;
  }, [restoreCPSFromMaintenance]);

  const scheduleFeatureUiUpdateRef = useRef(scheduleFeatureUiUpdate);
  useEffect(() => {
    scheduleFeatureUiUpdateRef.current = scheduleFeatureUiUpdate;
  }, [scheduleFeatureUiUpdate]);

  const appendRegistryHistoryRef = useRef(appendRegistryHistory);
  useEffect(() => {
    appendRegistryHistoryRef.current = appendRegistryHistory;
  }, [appendRegistryHistory]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let client;
    let isDisposed = false;

    const pushMqttLog = (message) => {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message,
        },
      ]);
    };

    const start = async () => {
      try {
        const connect = await loadMqttConnect();
        if (!connect) {
          pushMqttLog('[MQTT_ERROR] Could not load mqtt connect(). Recommend mqtt@^5.');
          return;
        }

        client = connect(DEFAULT_BROKER_URL, {
          clean: true,
          reconnectPeriod: 1000,
          clientId: `cps-ui-${Math.random().toString(16).slice(2)}`,
        });

        pushMqttLog(`[MQTT_CONNECTING] Connecting to ${DEFAULT_BROKER_URL}`);

        client.on('connect', () => {
          if (isDisposed) return;
          setMqttClient(client);
          pushMqttLog(`[MQTT_CONNECT] Connected to ${DEFAULT_BROKER_URL}`);

          const analyticsSubs = [
            '+/oee',
            '+/learning',
            ACSM_TOPICS.wildcardOee,
            ACSM_TOPICS.wildcardLearning,
            ACSM_TOPICS.globalOee,
            ACSM_TOPICS.globalReasoning,
            ACSM_TOPICS.globalLearning,
            ACSM_TOPICS.coordinatorOutput,
            ACSM_TOPICS.chainGlobalState,
            ACSM_TOPICS.chainGlobalReasoning,
            ACSM_TOPICS.chainGlobalLearning,
            ACSM_TOPICS.chainCoordinatorOutput,
            LIFECYCLE_UNPLUG_REQUEST_TOPIC,
            LIFECYCLE_UPDATE_FUNCTIONS_TOPIC,
          ];

          client.subscribe(analyticsSubs, (err) => {
            pushMqttLog(
              err
                ? `[MQTT_SUBSCRIBE_ERROR] analytics (${err?.message || err})`
                : `[MQTT_SUBSCRIBE] analytics -> ${analyticsSubs.join(', ')}`
            );
          });

          const dynamicSubs = Array.from(
            new Set(availableCPSRef.current.flatMap((cps) => buildSubscriptionTopicsForCps(cps)))
          );

          if (dynamicSubs.length) {
            client.subscribe(dynamicSubs, (err) => {
              pushMqttLog(
                err
                  ? `[MQTT_SUBSCRIBE_ERROR] cps_dynamic (${err?.message || err})`
                  : `[MQTT_SUBSCRIBE] cps_dynamic -> ${dynamicSubs.length} topics`
              );
            });
          }
        });

        client.on('reconnect', () => {
          pushMqttLog('[MQTT_RECONNECT] Broker reconnect attempt started.');
        });

        client.on('close', () => {
          pushMqttLog('[MQTT_CLOSE] Connection closed.');
        });

        client.on('offline', () => {
          pushMqttLog('[MQTT_OFFLINE] Client went offline.');
        });

        client.on('message', (topic, message) => {
          const rawTopic = String(topic || '').trim();
          const normIncoming = normalizeTopic(rawTopic);
          const rawStr = message?.toString?.() || '';

          pushMqttLog(`[MQTT_MESSAGE] ${rawTopic}`);

          if (DEBUG_LOG_ALL_TOPICS) {
            pushMqttLog(`[DEBUG] msg in '${rawTopic}': ${rawStr}`);
          }

          const isAnalyticsTopic =
            normIncoming.endsWith('/learning') ||
            normIncoming.endsWith('/oee') ||
            normIncoming === ACSM_TOPICS.globalOee ||
            normIncoming === ACSM_TOPICS.globalReasoning ||
            normIncoming === ACSM_TOPICS.globalLearning ||
            normIncoming === ACSM_TOPICS.coordinatorOutput ||
            normIncoming === ACSM_TOPICS.chainGlobalState ||
            normIncoming === ACSM_TOPICS.chainGlobalReasoning ||
            normIncoming === ACSM_TOPICS.chainGlobalLearning ||
            normIncoming === ACSM_TOPICS.chainCoordinatorOutput;

          if (isAnalyticsTopic) {
            handleAnalyticsMessageRef.current?.(normIncoming, message);
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
              patchRegistryCpsRef.current?.(target, {
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

            appendRegistryHistoryRef.current?.(target, {
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
              restoreCPSFromMaintenanceRef.current?.(target, payload);
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
                  ? `[ACK] ${owner.nome} -> action=${ack?.action || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'} ok=${String(ack?.ok ?? 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â')}`
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

            scheduleFeatureUiUpdateRef.current?.(
              owner.id,
              featInfo.featKey,
              statusKey,
              ts,
              details
            );

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
                  message: `[FEAT] ${owner.nome} ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ ${compName} -> status=${statusKey}`,
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

            patchRegistryCpsRef.current?.(owner, {
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
            handleAnalyticsMessageRef.current?.(normIncoming, message);
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
            patchRegistryCpsRef.current?.(owner, { globalState: nextGlobalState });
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
              patchRegistryCpsRef.current?.(owner, { operationalData: nextOperationalData });
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
          pushMqttLog(`[MQTT_ERROR] ${err?.message || err}`);
        });
      } catch (err) {
        pushMqttLog(`[MQTT_BOOT_ERROR] ${err?.message || err}`);
      }
    };

    start();

    return () => {
      isDisposed = true;
      if (client) {
        try {
          pushMqttLog('[MQTT_UNSUBSCRIBE] cleanup -> ending client connection');
          setMqttClient(null);
          client.end(true);
        } catch {
          // noop
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!mqttClient) return;
    const dynamicSubs = Array.from(
      new Set(availableCPS.flatMap((cps) => buildSubscriptionTopicsForCps(cps)))
    );
    if (!dynamicSubs.length) return;
    setLog((prev) => [
      ...prev,
      {
        time: new Date().toLocaleTimeString(),
        message: `[MQTT_SUBSCRIBE] dynamic effect -> ${dynamicSubs.length} topics`,
      },
    ]);
    mqttClient.subscribe(dynamicSubs, (err) => {
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: err
            ? `[MQTT_SUBSCRIBE_ERROR] dynamic effect (${err?.message || err})`
            : `[MQTT_SUBSCRIBE_OK] dynamic effect`,
        },
      ]);
    });

    return () => {
      if (!mqttClient || !dynamicSubs.length) return;
      setLog((prev) => [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message: `[MQTT_UNSUBSCRIBE] dynamic effect -> ${dynamicSubs.length} topics`,
        },
      ]);
      mqttClient.unsubscribe(dynamicSubs, (err) => {
        setLog((prev) => [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            message: err
              ? `[MQTT_UNSUBSCRIBE_ERROR] dynamic effect (${err?.message || err})`
              : `[MQTT_UNSUBSCRIBE_OK] dynamic effect`,
          },
        ]);
      });
    };
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

    publishLifecycleCommand(cps, 'play');

    setAddedCPS((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'rodando',
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
      globalState: {
        ...(cps.globalState || {}),
        state: 'running',
        status: 'running',
        playEnabled: true,
        lastUpdate: Date.now(),
      },
    });

    return true;
  },
  [publishLifecycleCommand, patchRegistryCps]
);

  const stopCPSById = useCallback(
  (id) => {
    const cps = Object.values(registryRef.current || {}).find((item) => item?.id === id);
    if (!cps) return false;

    publishLifecycleCommand(cps, 'stop');

    // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â¥ NÃƒÆ’Ã†â€™O REMOVE MAIS DA PLAY
    setAddedCPS((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'parado',
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
        ...(cps.globalState || {}),
        state: 'stopped',
        status: 'stopped',
        playEnabled: false,
        lastUpdate: Date.now(),
      },
    });

    return true;
  },
  [publishLifecycleCommand, patchRegistryCps]
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
        summary: `Manual unplug requested by ${ACTIVE_ACSM.code}.`,
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
          summary: `Manual unplug requested by ${ACTIVE_ACSM.code}.`,
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
          .map((f) => `${f.nome || f.key}:${f.statusAtual || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â'}`)
          .join(', ');
        const featLine = feats ? ` ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ Feat: [${feats}]` : '';

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
        acsmConfig,
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












