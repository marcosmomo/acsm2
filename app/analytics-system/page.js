'use client';

import React, { useMemo } from 'react';
import { CPSProvider, useCPSContext } from '../../context/CPSContext';
import AdaptiveTimeline from '../../components/AdaptiveTimeline';
import HistoryRecordsButton from '../../components/HistoryRecordsButton';
import SystemIntelligencePanel from '../../components/SystemIntelligencePanel';
import {
  filterContributionRanking,
  filterManagedArrayByCps,
  getActiveAcsmConfig,
  keepManagedValue,
} from '../../lib/acsm/config';

const activeAcsm = getActiveAcsmConfig();

function num(value, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(decimals);
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.0%';
  return `${(n * 100).toFixed(1)}%`;
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(Math.max(numeric, 0), 1);
}

function txt(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function joinTargets(value) {
  return Array.isArray(value) ? value.map((item) => txt(item, '')).filter(Boolean).join(', ') || '-' : '-';
}

function getOeeTone(value) {
  const n = Number(value);
  if (n >= 0.85) return 'good';
  if (n >= 0.6) return 'warn';
  return 'bad';
}

function getOeeMeta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return {
      label: 'No data',
      tone: 'neutral',
      color: '#94a3b8',
      track: 'rgba(148,163,184,0.24)',
      progress: 0,
    };
  }

  const progress = Math.min(Math.max(n, 0), 1);
  if (progress >= 0.85) {
    return {
      label: 'Stable',
      tone: 'good',
      color: '#22c55e',
      track: 'rgba(34,197,94,0.18)',
      progress,
    };
  }
  if (progress >= 0.6) {
    return {
      label: 'Moderate',
      tone: 'warn',
      color: '#f59e0b',
      track: 'rgba(245,158,11,0.20)',
      progress,
    };
  }
  return {
    label: 'Critical',
    tone: 'bad',
    color: '#ef4444',
    track: 'rgba(239,68,68,0.20)',
    progress,
  };
}

function getRiskTone(risk) {
  const r = String(risk || '').toLowerCase();
  if (r === 'low') return 'good';
  if (r === 'medium') return 'warn';
  if (r === 'high') return 'bad';
  return 'neutral';
}

function getPatternTone(pattern) {
  const p = String(pattern || '').toLowerCase();
  if (p.includes('stable') || p.includes('recovery') || p.includes('recovering')) return 'good';
  if (
    p.includes('variation') ||
    p.includes('unstable') ||
    p.includes('drift') ||
    p.includes('degrading') ||
    p.includes('performance')
  ) {
    return 'warn';
  }
  if (
    p.includes('cascade') ||
    p.includes('degradation') ||
    p.includes('critical') ||
    p.includes('anomaly') ||
    p.includes('availability') ||
    p.includes('quality')
  ) {
    return 'bad';
  }
  return 'info';
}

function badgeStyle(tone = 'neutral') {
  const map = {
    good: {
      background: '#dcfce7',
      color: '#166534',
      border: '1px solid #bbf7d0',
    },
    warn: {
      background: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a',
    },
    bad: {
      background: '#fee2e2',
      color: '#991b1b',
      border: '1px solid #fecaca',
    },
    info: {
      background: '#dbeafe',
      color: '#1d4ed8',
      border: '1px solid #bfdbfe',
    },
    neutral: {
      background: '#f1f5f9',
      color: '#334155',
      border: '1px solid #e2e8f0',
    },
  };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    ...map[tone],
  };
}

function MetricCard({ label, value, helper, tone = 'neutral' }) {
  return (
    <div
      style={{
        borderRadius: 20,
        padding: 18,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
        {label}
      </div>

      <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
        {value}
      </div>

      <div style={{ marginTop: 10 }}>
        <span style={badgeStyle(tone)}>{helper}</span>
      </div>
    </div>
  );
}

function GlobalOeeGaugeCard({
  value,
  criticalCpsId,
  recommendedFocus,
  bottleneckCpsId,
  coordinationMode,
}) {
  const meta = getOeeMeta(value);
  const size = 190;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = meta.progress * circumference;

  return (
    <div
      style={{
        borderRadius: 22,
        padding: 20,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 700 }}>Global OEE</div>
        <span style={badgeStyle(meta.tone)}>{meta.label}</span>
      </div>

      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          width: size,
          height: size,
          margin: '0 auto',
        }}
      >
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={meta.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
        </svg>
        <div style={{ position: 'absolute', textAlign: 'center', display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800 }}>System OEE</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>
            {pct(value)}
          </div>
          <div style={{ fontSize: 13, color: meta.color, fontWeight: 900 }}>{meta.label}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.12)',
          }}
        >
          <div
            style={{
              width: `${Math.round(meta.progress * 100)}%`,
              height: '100%',
              borderRadius: 999,
              background: `linear-gradient(90deg, ${meta.color}, #38bdf8)`,
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: 12 }}>
          <span>0%</span>
          <span>Target 85%</span>
          <span>100%</span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          color: '#cbd5e1',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <div>
          Focus: <strong>{txt(recommendedFocus, '-')}</strong>
        </div>
        <div>
          Bottleneck: <strong>{txt(bottleneckCpsId, '-')}</strong>
        </div>
        <div>
          Critical CPS: <strong>{txt(criticalCpsId, '-')}</strong>
        </div>
        <div>
          Mode: <strong>{txt(coordinationMode, '-')}</strong>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section
      style={{
        borderRadius: 24,
        padding: 20,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        boxShadow: '0 12px 32px rgba(15,23,42,0.05)',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>{title}</h2>
        {subtitle ? (
          <div style={{ marginTop: 6, fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
            {subtitle}
          </div>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function AnalyticsSystemContent() {
  const {
    systemAnalytics,
    runSystemAnalytics,
    supplyChainFeedback,
    localAdaptiveIntelligence,
    serviceAdaptiveIntelligence,
  } = useCPSContext();

  const analytics = useMemo(() => {
    if (systemAnalytics?.ts || systemAnalytics?.timestamp || systemAnalytics?.generatedAt) {
      return systemAnalytics;
    }
    return runSystemAnalytics ? runSystemAnalytics() : {};
  }, [systemAnalytics, runSystemAnalytics]);

  console.log('SYSTEM ANALYTICS PAGE', analytics);

console.log('LEARNING FIELDS', {
  learningState: analytics?.learningState,
  learningPattern: analytics?.learningPattern,
  globalDriftScore: analytics?.globalDriftScore,
  dominantChronicLoss: analytics?.dominantChronicLoss,
  predictedSystemOEE: analytics?.predictedSystemOEE,
  cpsContributionRanking: analytics?.cpsContributionRanking,
  derivedLearning: analytics?.derivedLearning,
});

  const globalOEE = analytics?.globalOEE || analytics?.oee || {};
  const overallAvailability = clamp01(
    analytics?.globalSummary?.overallAvailability ?? globalOEE?.availability
  );
  const overallPerformance = clamp01(
    analytics?.globalSummary?.overallPerformance ?? globalOEE?.performance
  );
  const overallQuality = clamp01(
    analytics?.globalSummary?.overallQuality ?? globalOEE?.quality
  );
  const overallOee = clamp01(
    analytics?.globalSummary?.overallOee ??
      globalOEE?.oee ??
      globalOEE?.current ??
      analytics?.oeeGlobal ??
      (overallAvailability != null && overallPerformance != null && overallQuality != null
        ? overallAvailability * overallPerformance * overallQuality
        : null)
  );
  const criticalCPS = analytics?.criticalCPS || analytics?.criticalCps || null;
  const bottleneck = analytics?.bottleneck || null;
  const criticalCpsId = keepManagedValue(criticalCPS?.cpsId || criticalCPS, activeAcsm);
  const bottleneckCpsId = keepManagedValue(bottleneck?.cpsId || bottleneck, activeAcsm);
  const ranking = filterContributionRanking(
    analytics?.criticalityRanking || analytics?.criticality,
    activeAcsm
  );
  const losses = filterManagedArrayByCps(analytics?.dominantLosses || [], activeAcsm);

  const riskLevel =
    analytics?.riskLevel ||
    analytics?.riskSummary?.level ||
    analytics?.predictedRisk?.level ||
    '?';

  const learnedPattern =
    analytics?.learnedPattern ||
    analytics?.patternLearned ||
    analytics?.systemPattern ||
    '?';

  const confidence =
    analytics?.confidence ??
    analytics?.riskSummary?.confidence ??
    analytics?.predictedRisk?.confidence ??
    analytics?.derivedLearning?.confidence ??
    0;
  const level3Mode = String(analytics?.level3Mode || 'partial').toUpperCase();
  const activeParticipantsCount = analytics?.activeParticipantsCount ?? 0;
  const expectedParticipantsCount = analytics?.expectedParticipantsCount ?? 3;
  const managedCpsCount =
    analytics?.managedCpsCount ??
    analytics?.globalSummary?.managedCpsCount ??
    analytics?.systemEvidence?.managedCpsCount ??
    analytics?.systemEvidence?.totalManagedCps ??
    0;

  const systemEvidence = analytics?.systemEvidence || {};
  const dominantSignals = filterManagedArrayByCps(
    safeArray(systemEvidence?.dominantSignals),
    activeAcsm
  );
  const crossCpsPatterns = filterManagedArrayByCps(
    safeArray(analytics?.crossCpsPatterns || systemEvidence?.crossCpsPatterns),
    activeAcsm
  );
  const supportingSignals = filterManagedArrayByCps(
    safeArray(analytics?.supportingSignals),
    activeAcsm
  );
  const riskDrivers = filterManagedArrayByCps(safeArray(analytics?.riskDrivers), activeAcsm);
  const actionPlan = analytics?.actionPlan || {};
  const systemState = analytics?.systemState || {};
  const feedbackAssessment = supplyChainFeedback?.globalAssessment || {};
  const feedbackDirectives = supplyChainFeedback?.globalDirectives || {};
  const feedbackAdaptive =
    supplyChainFeedback?.adaptiveLearning || supplyChainFeedback?.raw?.adaptiveLearning || {};
  const adaptiveAction =
    feedbackDirectives?.adaptiveAction || supplyChainFeedback?.raw?.globalDirectives?.adaptiveAction;
  const strategyClass =
    feedbackDirectives?.strategyClass || supplyChainFeedback?.raw?.globalDirectives?.strategyClass;
  const feedbackTimeline = (
    Array.isArray(supplyChainFeedback?.adaptiveTimeline)
      ? supplyChainFeedback.adaptiveTimeline
      : Array.isArray(supplyChainFeedback?.raw?.adaptiveTimeline)
      ? supplyChainFeedback.raw.adaptiveTimeline
      : []
  )
    .slice()
    .sort((a, b) => Number(b?.ts || Date.parse(b?.timestamp) || 0) - Number(a?.ts || Date.parse(a?.timestamp) || 0))
    .slice(0, 8);
  const localAdaptiveLearning = localAdaptiveIntelligence?.adaptiveLearningLocal || {};
  const localAdaptiveTimeline = (
    Array.isArray(localAdaptiveIntelligence?.adaptiveTimelineLocal)
      ? localAdaptiveIntelligence.adaptiveTimelineLocal
      : []
  )
    .slice()
    .sort((a, b) => Number(b?.ts || Date.parse(b?.timestamp) || 0) - Number(a?.ts || Date.parse(a?.timestamp) || 0))
    .slice(0, 8);
  const serviceAdaptiveLearning = serviceAdaptiveIntelligence?.adaptiveLearningService || {};
  const serviceAdaptiveTimeline = (
    Array.isArray(serviceAdaptiveIntelligence?.adaptiveTimelineService)
      ? serviceAdaptiveIntelligence.adaptiveTimelineService
      : []
  )
    .slice()
    .sort((a, b) => Number(b?.ts || Date.parse(b?.timestamp) || 0) - Number(a?.ts || Date.parse(a?.timestamp) || 0))
    .slice(0, 8);
  const localFeedback = supplyChainFeedback?.local || {};
  const recommendedFocus =
  keepManagedValue(analytics?.recommendedFocus, activeAcsm) || '';
  const explanation =
    analytics?.explanation || 'No system-level explanation available.';
  const recommendation =
    analytics?.recommendation ||
    actionPlan?.recommendation ||
    'No recommendation available.';

  const learningState =
    analytics?.learningState ||
    analytics?.derivedLearning?.state ||
    '?';

  const learningPattern =
    analytics?.learningPattern ||
    analytics?.derivedLearning?.pattern ||
    learnedPattern ||
    '?';

  const globalDriftScore =
    analytics?.globalDriftScore ??
    analytics?.derivedLearning?.globalDriftScore ??
    0;

  const dominantChronicLoss =
    analytics?.dominantChronicLoss ||
    analytics?.derivedLearning?.dominantChronicLoss ||
    '?';

const predictedSystemOEEValue =
  analytics?.predictedSystemOEE ??
  analytics?.derivedLearning?.predictedSystemOEE ??
  null;

const predictedSystemOEE = Array.isArray(predictedSystemOEEValue)
  ? predictedSystemOEEValue
  : Number.isFinite(Number(predictedSystemOEEValue))
  ? [Number(predictedSystemOEEValue)]
  : [];

  const cpsContributionRanking = filterContributionRanking(
    analytics?.cpsContributionRanking || analytics?.derivedLearning?.cpsContributionRanking,
    activeAcsm
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gap: 20 }}>
        <section
          style={{
            borderRadius: 28,
            padding: 28,
            background:
              'radial-gradient(circle at top right, rgba(59,130,246,0.28), transparent 20%), linear-gradient(135deg, #0f172a 0%, #111827 50%, #1e293b 100%)',
            boxShadow: '0 24px 60px rgba(15,23,42,0.20)',
            color: '#ffffff',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 22,
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  marginBottom: 14,
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#e2e8f0',
                }}
              >
                {activeAcsm.code} META-ORCHESTRATOR
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: 36,
                  lineHeight: 1.05,
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                }}
              >
                System-Level Analytics
              </h1>

              <div
                style={{
                  marginTop: 10,
                  color: '#cbd5e1',
                  fontSize: 15,
                  lineHeight: 1.7,
                }}
              >
                Global cognitive view of manufacturing with reasoning, learning,
                propagation across CPS, and systemic coordination.
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={badgeStyle(getOeeTone(overallOee))}
                >
                  Global OEE {pct(overallOee)}
                </span>
                <span style={badgeStyle(getRiskTone(riskLevel))}>
                  Risk {riskLevel}
                </span>
                <span style={badgeStyle(getPatternTone(learningPattern))}>
                  Pattern {learningPattern}
                </span>
                <span style={badgeStyle('info')}>
                  Confidence {num(confidence, 2)}
                </span>
                <span style={badgeStyle('neutral')}>Level 3 Mode {level3Mode}</span>
                <span style={badgeStyle('neutral')}>
                  Participants {activeParticipantsCount}/{expectedParticipantsCount}
                </span>
              </div>
            </div>

            <GlobalOeeGaugeCard
              value={overallOee}
              criticalCpsId={criticalCpsId}
              recommendedFocus={recommendedFocus}
              bottleneckCpsId={bottleneckCpsId}
              coordinationMode={systemState?.coordinationMode || analytics?.coordinationMode}
            />

            <div
              style={{
                borderRadius: 22,
                padding: 20,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 700 }}>
                Supply Chain Feedback
              </div>
              <HistoryRecordsButton level="level4" variant="dark" />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={badgeStyle(getRiskTone(feedbackAssessment?.riskLevel))}>
                  Risk {txt(feedbackAssessment?.riskLevel)}
                </span>
                <span style={badgeStyle(getRiskTone(feedbackDirectives?.priority))}>
                  Priority {txt(feedbackDirectives?.priority)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>
                <div>State: <strong>{txt(feedbackAssessment?.systemState)}</strong></div>
                <div>Mode: <strong>{txt(feedbackAssessment?.coordinationMode)}</strong></div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 10, display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 800 }}>Local Guidance</div>
                <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>Directive: <strong>{txt(localFeedback?.directive)}</strong></div>
                <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>Focus: <strong>{txt(localFeedback?.focus)}</strong></div>
                <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>Reason: <strong>{txt(localFeedback?.reason)}</strong></div>
                <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>Target CPS: <strong>{joinTargets(localFeedback?.targetCps)}</strong></div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 800 }}>Adaptive Intelligence</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, color: '#cbd5e1', fontSize: 12, lineHeight: 1.45 }}>
                  <div>Temporal State: <strong>{txt(feedbackAdaptive?.temporalState)}</strong></div>
                  <div>Adaptive Action: <strong>{txt(adaptiveAction)}</strong></div>
                  <div>Strategy Class: <strong>{txt(strategyClass)}</strong></div>
                  <div>Effectiveness: <strong>{txt(feedbackAdaptive?.interventionEffectiveness)}</strong></div>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45 }}>
                  {txt(feedbackAdaptive?.adaptiveReason)}
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 10 }}>
                <AdaptiveTimeline title="Adaptive Timeline" items={feedbackTimeline} variant="dark" />
              </div>
            </div>
          </div>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <MetricCard
            label="Global OEE"
            value={pct(overallOee)}
            helper="System efficiency"
            tone={getOeeTone(overallOee)}
          />

          <MetricCard
            label="Predicted Global OEE"
            value={pct(analytics?.predictedGlobalOEE ?? analytics?.predictedOeeGlobal)}
            helper="Short-term prediction"
            tone={getOeeTone(analytics?.predictedGlobalOEE ?? analytics?.predictedOeeGlobal)}
          />

          <MetricCard
            label="Risk Level"
            value={String(riskLevel)}
            helper="Predicted systemic risk"
            tone={getRiskTone(riskLevel)}
          />

          <MetricCard
            label="Stability Index"
            value={num(analytics?.stabilityIndex, 2)}
            helper="Global operational stability"
            tone={getOeeTone(analytics?.stabilityIndex)}
          />

          <MetricCard
            label="Fleet Anomaly Index"
            value={num(analytics?.fleetAnomalyIndex, 2)}
            helper="Mean anomaly across CPS"
            tone={getRiskTone(
              analytics?.fleetAnomalyIndex >= 0.55
                ? 'high'
                : analytics?.fleetAnomalyIndex >= 0.35
                ? 'medium'
                : 'low'
            )}
          />

          <MetricCard
            label="Level 3 Mode"
            value={level3Mode}
            helper={`Participants ${activeParticipantsCount}/${expectedParticipantsCount}`}
            tone={activeParticipantsCount >= expectedParticipantsCount ? 'good' : 'warn'}
          />

          <MetricCard
            label="Managed CPS in context"
            value={String(managedCpsCount)}
            helper="Unique managed CPS in Level 3 context"
            tone={managedCpsCount >= 9 ? 'good' : 'info'}
          />

          <MetricCard
            label="Learning Consensus"
            value={String(analytics?.learningConsensus || '?')}
            helper="Agreement among CPS learnings"
            tone={getPatternTone(analytics?.learningConsensus)}
          />
        </div>

        <SectionCard
          title="Local Adaptive Intelligence"
          subtitle="Temporal adaptive state calculated locally for the CPS managed by this ACSM."
        >
          <div style={{ marginBottom: 12 }}>
            <HistoryRecordsButton level="level2" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff', display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>Local State</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
                <div>Temporal State: <strong>{txt(localAdaptiveLearning?.temporalState)}</strong></div>
                <div>Adaptive Action: <strong>{txt(localAdaptiveLearning?.adaptiveAction)}</strong></div>
                <div>Strategy Class: <strong>{txt(localAdaptiveLearning?.strategyClass)}</strong></div>
                <div>Effectiveness: <strong>{txt(localAdaptiveLearning?.interventionEffectiveness)}</strong></div>
              </div>
              <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
                {txt(localAdaptiveLearning?.adaptiveReason, 'No local adaptive state available yet.')}
              </div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <AdaptiveTimeline
                title="Adaptive Timeline (local)"
                items={localAdaptiveTimeline}
                emptyText="No local adaptive history yet."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Service Adaptive Intelligence"
          subtitle="Level 3 temporal coordination across ACSM1, ACSM2, and ACSM3."
        >
          <div style={{ marginBottom: 12 }}>
            <HistoryRecordsButton level="level3" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff', display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>Service State</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
                <div>Temporal State: <strong>{txt(serviceAdaptiveLearning?.temporalState)}</strong></div>
                <div>Adaptive Action: <strong>{txt(serviceAdaptiveLearning?.adaptiveAction)}</strong></div>
                <div>Strategy Class: <strong>{txt(serviceAdaptiveLearning?.strategyClass)}</strong></div>
                <div>Effectiveness: <strong>{txt(serviceAdaptiveLearning?.interventionEffectiveness)}</strong></div>
              </div>
              <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.6 }}>
                {txt(serviceAdaptiveLearning?.adaptiveReason, 'No service adaptive state available yet.')}
              </div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <AdaptiveTimeline
                title="Adaptive Timeline (service)"
                items={serviceAdaptiveTimeline}
                emptyText="No service adaptive history yet."
              />
            </div>
          </div>
        </SectionCard>

        <SystemIntelligencePanel analytics={analytics} />

        <SectionCard
          title="Executive Interpretation"
          subtitle="Executive summary for dashboard, report, or supply chain coordination."
        >
          <div
            style={{
              borderRadius: 20,
              padding: 20,
              background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
              border: '1px solid #dbeafe',
              color: '#334155',
              lineHeight: 1.9,
              fontSize: 15,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#1d4ed8',
                marginBottom: 10,
                textTransform: 'uppercase',
              }}
            >
              System Explanation
            </div>

            {explanation}
          </div>

          <div
            style={{
              marginTop: 14,
              borderRadius: 20,
              padding: 20,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              color: '#0f172a',
              lineHeight: 1.8,
              fontSize: 15,
            }}
          >
            <strong>Recommendation:</strong> {recommendation}
          </div>
        </SectionCard>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 18,
          }}
        >
          <SectionCard
            title="System-Level Reasoning"
            subtitle="Criticality, bottleneck, propagation, and systemic synchronization."
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Critical CPS</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  {criticalCpsId || '-'}
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Current Bottleneck</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  {bottleneckCpsId || '-'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={badgeStyle(analytics?.lossPropagation?.detected ? 'bad' : 'good')}>
                  Cascade effect: {analytics?.lossPropagation?.detected ? 'yes' : 'no'}
                </span>
                <span style={badgeStyle(
                  String(analytics?.synchronization?.state || '').toLowerCase() === 'poor'
                    ? 'bad'
                    : String(analytics?.synchronization?.state || '').toLowerCase() === 'attention'
                    ? 'warn'
                    : 'good'
                )}>
                  Synchronization: {analytics?.synchronization?.state || '?'}
                </span>
                <span style={badgeStyle(analytics?.bottleneckMigration?.detected ? 'warn' : 'neutral')}>
                  Bottleneck migrating: {analytics?.bottleneckMigration?.detected ? 'yes' : 'no'}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="System-Level Learning"
            subtitle="System learning based on OEE, Availability, Performance, and Quality."
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Learning State</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                    {learningState}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={badgeStyle(getPatternTone(learningState))}>
                      Current systemic learning state
                    </span>
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Learning Pattern</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                    {learningPattern}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={badgeStyle(getPatternTone(learningPattern))}>
                      Temporal pattern detected
                    </span>
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Global Drift Score</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                    {num(globalDriftScore, 3)}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span
                      style={badgeStyle(
                        globalDriftScore >= 0.5 ? 'bad' : globalDriftScore >= 0.25 ? 'warn' : 'good'
                      )}
                    >
                      OEE-based temporal drift
                    </span>
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Dominant Chronic Loss</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                    {dominantChronicLoss}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={badgeStyle(getPatternTone(dominantChronicLoss))}>
                      Persistent OEE loss factor
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Predicted Risk</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                    {riskLevel}
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Confidence</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                    {num(confidence, 2)}
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, background: '#ffffff' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>
                  Predicted System OEE
                </div>

                {predictedSystemOEE.length ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {predictedSystemOEE.map((value, index) => (
                      <span key={`${value}-${index}`} style={badgeStyle(getOeeTone(value))}>
                        t+{index + 1}: {pct(value)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#64748b' }}>No predicted system OEE available.</div>
                )}
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, background: '#ffffff' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>
                  CPS Contribution Ranking
                </div>

                {cpsContributionRanking.length ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {cpsContributionRanking.map((item, index) => (
                      <div
                        key={`${item.cpsId || item.id}-${index}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '70px 1fr 140px',
                          gap: 12,
                          alignItems: 'center',
                          border: '1px solid #e2e8f0',
                          borderRadius: 14,
                          padding: 12,
                          background: '#f8fafc',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>
                          #{index + 1}
                        </div>

                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                            {item.cpsId || item.id || '?'}
                          </div>
                          <div style={{ fontSize: 13, color: '#475569' }}>
                            {item.cpsName || item.name || 'Unnamed CPS'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={badgeStyle(index === 0 ? 'bad' : index === 1 ? 'warn' : 'neutral')}>
                            {num(item.score ?? item.contribution ?? item.value, 4)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#64748b' }}>No CPS contribution ranking available.</div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="System Evidence"
          subtitle="Dominant signals and cross-CPS patterns supporting systemic inference."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>
                Dominant Signals
              </div>
              {dominantSignals.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {dominantSignals.map((item, index) => (
                    <span key={`${item}-${index}`} style={badgeStyle('info')}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>No dominant signals available.</div>
              )}
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>
                Cross-CPS Patterns
              </div>
              {crossCpsPatterns.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {crossCpsPatterns.map((item, index) => (
                    <span key={`${item}-${index}`} style={badgeStyle('warn')}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>No cross-CPS patterns detected.</div>
              )}
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginBottom: 10 }}>
                Risk Drivers
              </div>
              {riskDrivers.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {riskDrivers.map((item, index) => (
                    <span key={`${item}-${index}`} style={badgeStyle('bad')}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>No risk drivers available.</div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Coordination Action Plan"
          subtitle={`Executive output from ${activeAcsm.code} for adaptive coordination, contingency, or recovery.`}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Priority</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
                {actionPlan?.priority || analytics?.priority || '?'}
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Action Type</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
                {actionPlan?.actionType || '?'}
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Expected Impact</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
                {actionPlan?.expectedImpact || '?'}
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Target CPS</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
                {keepManagedValue(actionPlan?.targetCps, activeAcsm) || ''}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="System State"
          subtitle="Consolidated executive state of the cell with operational focus and coordination mode."
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={badgeStyle(getRiskTone(systemState?.health === 'critical' ? 'high' : systemState?.health === 'attention' ? 'medium' : 'low'))}>
              Health {systemState?.health || '?'}
            </span>
            <span style={badgeStyle(getPatternTone(systemState?.coordinationMode))}>
              Mode {systemState?.coordinationMode || analytics?.coordinationMode || '?'}
            </span>
            <span style={badgeStyle('info')}>
              Focus {systemState?.recommendedFocus || recommendedFocus}
            </span>
          </div>

          {supportingSignals.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {supportingSignals.map((item, index) => (
                <span key={`${item}-${index}`} style={badgeStyle('neutral')}>
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>No supporting signals available.</div>
          )}
        </SectionCard>

        <SectionCard
          title="Criticality Ranking"
          subtitle="Relative CPS contribution to global criticality."
        >
          {ranking.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {ranking.map((item, index) => (
                <div
                  key={`${item.cpsId}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 120px',
                    gap: 12,
                    alignItems: 'center',
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    padding: 14,
                    background: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>
                    #{index + 1}
                  </div>

                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                      {item.cpsId}
                    </div>
                    <div style={{ fontSize: 13, color: '#475569' }}>
                      {item.cpsName || 'Unnamed CPS'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={badgeStyle(index === 0 ? 'bad' : index === 1 ? 'warn' : 'neutral')}>
                      {num(item.criticalityScore ?? item.score, 4)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>No ranking data available.</div>
          )}
        </SectionCard>

        <SectionCard
          title="Dominant Losses by CPS"
          subtitle="Most relevant losses by asset in the Global OEE composition."
        >
          {losses.length ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
              }}
            >
              {losses.map((item, index) => (
                <div
                  key={`${item.cpsId}-${index}`}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 18,
                    padding: 16,
                    background: '#ffffff',
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                    {item.cpsId}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={badgeStyle('info')}>
                      Dominant: {item.dominantDimension || item.dominantLoss}
                    </span>
                  </div>

                  <div style={{ color: '#475569', fontSize: 14 }}>
                    Availability loss: <strong>{pct(item.availabilityLoss)}</strong>
                  </div>
                  <div style={{ color: '#475569', fontSize: 14 }}>
                    Performance loss: <strong>{pct(item.performanceLoss)}</strong>
                  </div>
                  <div style={{ color: '#475569', fontSize: 14 }}>
                    Quality loss: <strong>{pct(item.qualityLoss)}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b' }}>No loss analysis available.</div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default function AnalyticsSystemPage() {
  return (
    <CPSProvider>
      <AnalyticsSystemContent />
    </CPSProvider>
  );
}




