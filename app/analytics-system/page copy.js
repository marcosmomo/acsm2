'use client';

import React, { useMemo } from 'react';
import { CPSProvider, useCPSContext } from '../../context/CPSContext';

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
  if (p.includes('stable')) return 'good';
  if (p.includes('oscillation') || p.includes('variation')) return 'warn';
  if (p.includes('degradation') || p.includes('critical')) return 'bad';
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

function AnalyticsSystemContent() {
  const { systemAnalytics, runSystemAnalytics } = useCPSContext();

  const analytics = useMemo(() => {
    if (systemAnalytics?.ts) return systemAnalytics;
    return runSystemAnalytics ? runSystemAnalytics() : {};
  }, [systemAnalytics, runSystemAnalytics]);

  const globalOEE = analytics?.globalOEE || {};
  const criticalCPS = analytics?.criticalCPS || null;
  const bottleneck = analytics?.bottleneck || null;
  const ranking = Array.isArray(analytics?.criticalityRanking)
    ? analytics.criticalityRanking
    : [];
  const losses = Array.isArray(analytics?.dominantLosses)
    ? analytics.dominantLosses
    : [];

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
                ACSM META-ORCHESTRATOR
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
                Visão cognitiva global da manufatura com reasoning, learning e coordenação
                em nível ACSM.
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={badgeStyle(getOeeTone(globalOEE.oee))}>
                  Global OEE {pct(globalOEE.oee)}
                </span>
                <span style={badgeStyle(getRiskTone(analytics?.riskLevel))}>
                  Risk {analytics?.riskLevel || '—'}
                </span>
                <span style={badgeStyle(getPatternTone(analytics?.learnedPattern))}>
                  Pattern {analytics?.learnedPattern || '—'}
                </span>
                <span style={badgeStyle('info')}>
                  Confidence {num(analytics?.confidence, 2)}
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
                {criticalCPS?.cpsId || '—'}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>
                CPS crítico atual com score <strong>{num(criticalCPS?.score, 3)}</strong>.
              </div>
              <div style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>
                Gargalo atual: <strong>{bottleneck?.cpsId || '—'}</strong>
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
            value={pct(globalOEE.oee)}
            helper={globalOEE.oee >= 0.85 ? 'Excellent' : globalOEE.oee >= 0.6 ? 'Good' : 'Critical'}
            tone={getOeeTone(globalOEE.oee)}
          />

          <MetricCard
            label="Availability"
            value={pct(globalOEE.availability)}
            helper="System availability"
            tone={getOeeTone(globalOEE.availability)}
          />

          <MetricCard
            label="Performance"
            value={pct(globalOEE.performance)}
            helper="System performance"
            tone={getOeeTone(globalOEE.performance)}
          />

          <MetricCard
            label="Quality"
            value={pct(globalOEE.quality)}
            helper="System quality"
            tone={getOeeTone(globalOEE.quality)}
          />

          <MetricCard
            label="Predicted Global OEE"
            value={pct(analytics?.predictedGlobalOEE)}
            helper="Trend-based prediction"
            tone={getOeeTone(analytics?.predictedGlobalOEE)}
          />

          <MetricCard
            label="CPS Count"
            value={String(analytics?.cpsCount ?? 0)}
            helper="Assets considered"
            tone="info"
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

            {analytics?.explanation || 'No system-level explanation available.'}
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
            <strong>Recommendation:</strong>{' '}
            {analytics?.recommendation || 'No recommendation available.'}
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
            subtitle="Indicadores de dominância de perdas, gargalo e comportamento sistêmico."
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Critical CPS</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  {criticalCPS?.cpsId || '—'}
                </div>
                <div style={{ marginTop: 6, color: '#475569' }}>
                  Score: {num(criticalCPS?.score, 4)}
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Current Bottleneck</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  {bottleneck?.cpsId || '—'}
                </div>
                <div style={{ marginTop: 6, color: '#475569' }}>
                  Cycle time: {bottleneck?.cycleTimeMs ?? '—'} ms
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={badgeStyle(analytics?.cascadeEffect ? 'bad' : 'good')}>
                  Cascade effect: {analytics?.cascadeEffect ? 'yes' : 'no'}
                </span>
                <span style={badgeStyle(analytics?.synchronizationIssue ? 'warn' : 'good')}>
                  Synchronization issue: {analytics?.synchronizationIssue ? 'yes' : 'no'}
                </span>
                <span style={badgeStyle(analytics?.bottleneckMigrating ? 'warn' : 'neutral')}>
                  Bottleneck migrating: {analytics?.bottleneckMigrating ? 'yes' : 'no'}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="System-Level Learning"
            subtitle="Padrão aprendido, risco previsto e confiança do meta-orquestrador."
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Learned Pattern</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  {analytics?.learnedPattern || '—'}
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Predicted Risk</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  {analytics?.riskLevel || '—'}
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 14, background: '#ffffff' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Confidence</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                  {num(analytics?.confidence, 2)}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

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
                      {num(item.score, 4)}
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
                      Dominant: {item.dominantDimension}
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