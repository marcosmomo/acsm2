'use client';

import React, { useMemo } from 'react';
import { CPSProvider, useCPSContext } from '../../context/CPSContext';
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

function getOeeTone(value) {
  const n = Number(value);
  if (n >= 0.85) return 'good';
  if (n >= 0.6) return 'warn';
  return 'bad';
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
  const { systemAnalytics, runSystemAnalytics, level3RuntimeStatus } = useCPSContext();

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
  const level3Mode = String(
    analytics?.level3Mode || level3RuntimeStatus?.level3Mode || 'partial'
  ).toUpperCase();
  const activeParticipantsCount =
    analytics?.activeParticipantsCount ?? level3RuntimeStatus?.activeParticipantsCount ?? 0;
  const expectedParticipantsCount =
    analytics?.expectedParticipantsCount ?? level3RuntimeStatus?.expectedParticipantsCount ?? 3;
  const managedCpsCount =
    analytics?.managedCpsCount ??
    analytics?.globalSummary?.managedCpsCount ??
    analytics?.systemEvidence?.managedCpsCount ??
    analytics?.systemEvidence?.totalManagedCps ??
    level3RuntimeStatus?.managedCpsCount ??
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
                Visão cognitiva global da manufatura com reasoning, learning,
                propagação entre CPS e coordenação sistêmica.
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
                  style={badgeStyle(
                    getOeeTone(globalOEE.oee ?? globalOEE.current ?? analytics?.oeeGlobal)
                  )}
                >
                  Global OEE {pct(globalOEE.oee ?? globalOEE.current ?? analytics?.oeeGlobal)}
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
              </div>
            </div>

            <div
              style={{
                borderRadius: 22,
                padding: 20,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 700 }}>
                Coordinator Output
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>
                {criticalCpsId || '-'}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>
                Focus: <strong>{recommendedFocus}</strong>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>
                Bottleneck: <strong>{bottleneckCpsId || '-'}</strong>
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>
                Mode: <strong>{systemState?.coordinationMode || analytics?.coordinationMode || '?'}</strong>
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
            value={pct(globalOEE.oee ?? globalOEE.current ?? analytics?.oeeGlobal)}
            helper="System efficiency"
            tone={getOeeTone(globalOEE.oee ?? globalOEE.current ?? analytics?.oeeGlobal)}
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
          title="Executive Interpretation"
          subtitle="Síntese pronta para apresentação, relatório ou coordenação da cadeia."
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
            subtitle="Criticidade, gargalo, propagação e sincronização sistêmica."
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
            subtitle="Aprendizado sistêmico baseado em OEE, availability, performance e quality."
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
          subtitle="Sinais dominantes e padrões cruzados entre CPS que sustentam a inferência sistêmica."
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
          subtitle={`Saída executiva da ${activeAcsm.code} para coordenação adaptativa, contingência ou recuperação.`}
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
          subtitle="Estado executivo consolidado da célula com foco operacional e modo de coordenação."
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
          subtitle="Contribuição relativa dos CPS para a criticidade global."
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
          subtitle="Perdas mais relevantes por ativo na composição do OEE global."
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




