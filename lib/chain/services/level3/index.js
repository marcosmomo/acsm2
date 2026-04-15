export { createLevel3CollaborativeLearningService } from './Level3CollaborativeLearningService.js';


import { normalizeCpsId } from '../../../acsm/config.js';
import { createLevel3CollaborativeLearningService } from './Level3CollaborativeLearningService.js';
import { createLevel3PublisherService } from './Level3PublisherService.js';

const normalizeAcsmId = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const match = normalized.match(/^acsm0*([0-9]+)$/);
  return match ? `acsm${Number(match[1])}` : normalized || null;
};

const toNumber = (value, fallback = null) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const pickManagedCps = ({ managedCps, addedCPS }) =>
  Array.from(
    new Set(
      (Array.isArray(managedCps)
        ? managedCps
        : Array.isArray(addedCPS)
          ? addedCPS.map((cps) => cps?.id || cps?.cpsId || cps?.baseTopic)
          : [])
        .map((value) => normalizeCpsId(value))
        .filter(Boolean)
    )
  );

export const buildLevel3LocalContribution = ({
  acsmId,
  industryId,
  industryName,
  systemAnalytics,
  addedCPS,
  managedCps,
  generatedAt = new Date().toISOString(),
}) => {
  const analytics = systemAnalytics || {};
  const normalizedAcsmId = normalizeAcsmId(acsmId);
  const normalizedManagedCps = pickManagedCps({ managedCps, addedCPS });
  const generatedDate = new Date(generatedAt);
  const safeGeneratedAt = Number.isNaN(generatedDate.getTime())
    ? new Date().toISOString()
    : generatedDate.toISOString();
  const ts = Number.isNaN(generatedDate.getTime()) ? Date.now() : generatedDate.getTime();
  const globalOEE = analytics?.globalOEE || analytics?.oee || {};
  const summary = {
    globalOee: toNumber(
      analytics?.globalSummary?.overallOee ??
        globalOEE?.oee ??
        globalOEE?.current ??
        analytics?.oeeGlobal,
      0
    ),
    availability: toNumber(
      analytics?.globalSummary?.overallAvailability ?? globalOEE?.availability,
      0
    ),
    performance: toNumber(
      analytics?.globalSummary?.overallPerformance ?? globalOEE?.performance,
      0
    ),
    quality: toNumber(analytics?.globalSummary?.overallQuality ?? globalOEE?.quality, 0),
    mode:
      analytics?.coordinationMode ||
      analytics?.level3Mode ||
      analytics?.systemState?.coordinationMode ||
      analytics?.learningState ||
      'unknown',
    confidence: toNumber(
      analytics?.confidence ??
        analytics?.riskSummary?.confidence ??
        analytics?.predictedRisk?.confidence ??
        analytics?.derivedLearning?.confidence,
      0
    ),
  };
  const criticalCpsId =
    normalizeCpsId(analytics?.criticalCPS?.cpsId || analytics?.criticalCPS || analytics?.criticalCps) ||
    null;
  const bottleneckCpsId = normalizeCpsId(
    analytics?.bottleneck?.cpsId ||
      analytics?.bottleneck ||
      analytics?.currentBottleneck ||
      analytics?.actionPlan?.targetCps ||
      criticalCpsId
  );
  const actionPlan = {
    ...(analytics?.actionPlan || {}),
    targetCps: normalizeCpsId(
      analytics?.actionPlan?.targetCps || analytics?.recommendedFocus || bottleneckCpsId
    ),
    priority:
      analytics?.actionPlan?.priority ||
      (analytics?.riskLevel === 'high' ? 'high' : analytics?.riskLevel === 'medium' ? 'medium' : 'low'),
    actionType:
      analytics?.actionPlan?.actionType ||
      analytics?.actionPlan?.type ||
      analytics?.recommendedAction ||
      null,
  };
  const reasoning = {
    dominantLoss:
      analytics?.dominantLosses?.[0]?.dominantDimension ||
      analytics?.dominantLosses?.[0]?.lossType ||
      analytics?.riskDrivers?.[0] ||
      null,
    bottleneckCps: bottleneckCpsId,
    probableCause:
      analytics?.reasoning?.probableCause ||
      analytics?.riskDrivers?.[0] ||
      analytics?.supportingSignals?.[0] ||
      null,
    explanation: analytics?.explanation || null,
  };
  const learning = {
    pattern:
      analytics?.learningPattern ||
      analytics?.learnedPattern ||
      analytics?.patternLearned ||
      analytics?.systemPattern ||
      analytics?.derivedLearning?.pattern ||
      null,
    trend:
      analytics?.derivedLearning?.trend ||
      analytics?.predictedRisk?.trend ||
      analytics?.learningTrend ||
      null,
    predictionNextOee: toNumber(
      analytics?.predictedGlobalOEE ??
        analytics?.predictedOeeGlobal ??
        analytics?.predictedSystemOEE ??
        analytics?.derivedLearning?.predictionNextOee,
      null
    ),
    riskLevel:
      analytics?.riskLevel || analytics?.predictedRisk?.level || analytics?.riskSummary?.level || 'unknown',
    riskScore: toNumber(
      analytics?.predictedRisk?.score ??
        analytics?.predictedRisk?.riskScore ??
        analytics?.riskSummary?.score,
      null
    ),
  };
  const normalizedIndustryId = industryId || 'industry2';
  const normalizedIndustryName = industryName || 'Industry 2';

  return {
    schemaVersion: '1.0',
    messageType: 'acsm_chain_input',
    ts,
    timestamp: safeGeneratedAt,
    generatedAt: safeGeneratedAt,
    acsmId: normalizedAcsmId,
    industryId: normalizedIndustryId,
    industryName: normalizedIndustryName,
    managedCps: normalizedManagedCps,
    managedCpsIds: normalizedManagedCps,
    managedCpsCount: normalizedManagedCps.length,
    summary,
    reasoning,
    learning,
    actionPlan,
    globalOEE: {
      ...globalOEE,
      oee: summary.globalOee,
      availability: summary.availability,
      performance: summary.performance,
      quality: summary.quality,
    },
    criticalCPS: analytics?.criticalCPS || analytics?.criticalCps || criticalCpsId || null,
    criticalCps: criticalCpsId,
    bottleneck: analytics?.bottleneck || bottleneckCpsId || null,
    riskLevel: learning.riskLevel,
    confidence: summary.confidence,
    recommendation: analytics?.recommendation || null,
    explanation: analytics?.explanation || null,
    learningPattern: learning.pattern,
    learningConsensus: analytics?.learningConsensus || null,
    supportingSignals: analytics?.supportingSignals || [],
    riskDrivers: analytics?.riskDrivers || [],
    dominantLosses: analytics?.dominantLosses || [],
    cpsContributionRanking: analytics?.cpsContributionRanking || [],
    systemEvidence: {
      ...(analytics?.systemEvidence || {}),
      industryId: normalizedIndustryId,
      industryName: normalizedIndustryName,
      managedCpsIds: normalizedManagedCps,
      managedCpsCount: normalizedManagedCps.length,
    },
    coordinationMode: analytics?.coordinationMode || null,
    derivedLearning: analytics?.derivedLearning || {},
  };
};

export {
  createLevel3CollaborativeLearningService,
  createLevel3PublisherService,
};
