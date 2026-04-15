'use client';

import React, { useEffect, useMemo, useState } from 'react';

const API_DECISION = 'http://localhost:1880/api/coordinator/decision';
const API_KNOWLEDGE = 'http://localhost:1880/api/coordinator/knowledge';

const toNumber = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const fmtPct = (v) => {
  const n = toNumber(v);
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
};

const fmtDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-PT');
  } catch {
    return '—';
  }
};

const getRiskMeta = (risk) => {
  const r = String(risk || '').toLowerCase();

  if (r === 'high') {
    return {
      label: 'High Risk',
      bg: '#fee2e2',
      color: '#991b1b',
      border: '#fca5a5',
    };
  }

  if (r === 'medium') {
    return {
      label: 'Moderate Risk',
      bg: '#fef3c7',
      color: '#92400e',
      border: '#fcd34d',
    };
  }

  return {
    label: 'Low Risk',
    bg: '#dcfce7',
    color: '#166534',
    border: '#86efac',
  };
};

const getStrategyMeta = (strategy) => {
  const s = String(strategy || '').toLowerCase();

  if (s === 'reconfigure_supply_plan') {
    return {
      label: 'Reconfigure Supply Plan',
      bg: '#fee2e2',
      color: '#991b1b',
    };
  }

  if (s === 'monitor_and_prepare_contingency') {
    return {
      label: 'Monitor & Prepare Contingency',
      bg: '#fef3c7',
      color: '#92400e',
    };
  }

  return {
    label: 'Maintain Supply Plan',
    bg: '#dcfce7',
    color: '#166534',
  };
};

function Chip({ label, bg, color, border }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 12px',
        borderRadius: 999,
        background: bg,
        color,
        border: `1px solid ${border || bg}`,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

function MetricCard({ label, value, helper }) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        borderRadius: 18,
        padding: 16,
        boxShadow: '0 8px 20px rgba(15,23,42,0.04)',
      }}
    >
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: '#0f172a',
          letterSpacing: '-0.03em',
          lineHeight: 1,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
      {helper ? (
        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

export default function SupplyChainCoordinatorDashboard() {
  const [decision, setDecision] = useState(null);
  const [knowledge, setKnowledge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = async () => {
    try {
      setErrorMsg('');

      const [decisionRes, knowledgeRes] = await Promise.all([
        fetch(API_DECISION, { cache: 'no-store' }),
        fetch(API_KNOWLEDGE, { cache: 'no-store' }),
      ]);

      const decisionJson = await decisionRes.json().catch(() => null);
      const knowledgeJson = await knowledgeRes.json().catch(() => null);

      if (!decisionRes.ok && !knowledgeRes.ok) {
        throw new Error('Coordinator APIs not available.');
      }

      setDecision(decisionRes.ok ? decisionJson : null);
      setKnowledge(knowledgeRes.ok ? knowledgeJson : null);
      setLastRefresh(new Date().toISOString());
    } catch (e) {
      setErrorMsg(e?.message || 'Failed to load coordinator data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, []);

  const riskMeta = useMemo(
    () => getRiskMeta(decision?.riskLevel),
    [decision]
  );

  const strategyMeta = useMemo(
    () => getStrategyMeta(decision?.strategy),
    [decision]
  );

  const prioritizedActions = Array.isArray(decision?.prioritizedActions)
    ? decision.prioritizedActions
    : [];

  const dominantLosses = Array.isArray(decision?.dominantLosses)
    ? decision.dominantLosses
    : [];

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 28,
          padding: 28,
          background:
            'radial-gradient(circle at top right, rgba(59,130,246,0.28), transparent 22%), radial-gradient(circle at bottom left, rgba(16,185,129,0.18), transparent 18%), linear-gradient(135deg, #0f172a 0%, #111827 45%, #1e293b 100%)',
          boxShadow: '0 28px 70px rgba(15,23,42,0.22)',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
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
              SUPPLY CHAIN COORDINATION
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: 34,
                lineHeight: 1.06,
                fontWeight: 900,
                letterSpacing: '-0.04em',
              }}
            >
              Supply Chain Coordinator Dashboard
            </h2>

            <div
              style={{
                marginTop: 10,
                color: '#cbd5e1',
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              Painel executivo para leitura do conhecimento recebido da ACSM e da
              decisão interorganizacional gerada pelo coordenador da cadeia.
            </div>

            <div
              style={{
                marginTop: 18,
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <Chip
                label={riskMeta.label}
                bg={riskMeta.bg}
                color={riskMeta.color}
                border={riskMeta.border}
              />
              <Chip
                label={strategyMeta.label}
                bg={strategyMeta.bg}
                color={strategyMeta.color}
              />
              <Chip
                label={`Last refresh ${fmtDate(lastRefresh)}`}
                bg="rgba(255,255,255,0.10)"
                color="#ffffff"
                border="rgba(255,255,255,0.14)"
              />
            </div>
          </div>

          <div
            style={{
              borderRadius: 24,
              padding: 20,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              display: 'grid',
              gap: 14,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: '#cbd5e1',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Coordinator Status
            </div>

            <div style={{ color: '#ffffff', fontWeight: 800, fontSize: 18 }}>
              {decision?.coordinationMessage || 'No decision available yet.'}
            </div>

            <button
              onClick={loadData}
              style={{
                justifySelf: 'start',
                border: '1px solid rgba(255,255,255,0.18)',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: 14,
                padding: '12px 16px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Refresh Now
            </button>
          </div>
        </div>
      </section>

      {errorMsg ? (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            borderRadius: 16,
            padding: 14,
            fontWeight: 700,
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <MetricCard
          label="Global OEE Received"
          value={fmtPct(decision?.globalOEE)}
          helper="OEE global consolidado recebido da ACSM."
        />
        <MetricCard
          label="Critical CPS"
          value={decision?.criticalCPS || '—'}
          helper="Ativo mais crítico apontado pelo coordenador."
        />
        <MetricCard
          label="Confidence"
          value={toNumber(decision?.confidence) !== null ? decision.confidence.toFixed(2) : '—'}
          helper="Confiança associada à decisão interorganizacional."
        />
        <MetricCard
          label="High Priority Actions"
          value={String(decision?.summary?.highPriorityCount ?? prioritizedActions.length ?? 0)}
          helper="Quantidade de ações com prioridade alta."
        />
      </div>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          padding: 22,
          boxShadow: '0 16px 40px rgba(15,23,42,0.06)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Executive Decision
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Current coordination strategy
          </h3>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          <div
            style={{
              border: '1px solid #dbeafe',
              background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)',
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Strategy</div>
            <div style={{ color: '#0f172a', fontWeight: 900, fontSize: 22, lineHeight: 1.4 }}>
              {decision?.strategy || '—'}
            </div>
            <div style={{ color: '#334155', marginTop: 8, lineHeight: 1.7 }}>
              {decision?.coordinationMessage || 'No coordination message available.'}
            </div>
          </div>

          <div
            style={{
              border: '1px solid #ede9fe',
              background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)',
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Source</div>
            <div style={{ color: '#0f172a', fontWeight: 800, lineHeight: 1.8 }}>
              Received from: {decision?.receivedFrom || '—'}
            </div>
            <div style={{ color: '#334155', marginTop: 8, lineHeight: 1.7 }}>
              Input knowledge timestamp: {fmtDate(decision?.inputKnowledgeTs)}
            </div>
            <div style={{ color: '#334155', marginTop: 4, lineHeight: 1.7 }}>
              Decision timestamp: {fmtDate(decision?.ts)}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          padding: 22,
          boxShadow: '0 16px 40px rgba(15,23,42,0.06)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Priority Actions
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Recommended response set
          </h3>
        </div>

        {prioritizedActions.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {prioritizedActions.map((action, index) => (
              <div
                key={`${action.target || 'target'}-${index}`}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 14,
                  background: '#f8fafc',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  {action.action || '—'}
                </div>
                <div style={{ color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
                  Target: <strong>{action.target || '—'}</strong> • Priority:{' '}
                  <strong>{action.priority || '—'}</strong> • Reason:{' '}
                  <strong>{action.reason || '—'}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              border: '1px dashed #cbd5e1',
              borderRadius: 16,
              padding: 16,
              color: '#64748b',
            }}
          >
            No prioritized actions available.
          </div>
        )}
      </section>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          padding: 22,
          boxShadow: '0 16px 40px rgba(15,23,42,0.06)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Dominant Losses
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            System loss distribution
          </h3>
        </div>

        {dominantLosses.length ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {dominantLosses.map((loss, index) => (
              <div
                key={`${loss.cpsId || 'cps'}-${index}`}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 16,
                  padding: 14,
                  background: '#ffffff',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
                  {loss.cpsName || loss.cpsId || '—'}
                </div>
                <div style={{ color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
                  Dominant loss: <strong>{loss.dominantLoss || '—'}</strong>
                </div>
                <div style={{ color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
                  Local OEE: <strong>{fmtPct(loss.oee)}</strong>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              border: '1px dashed #cbd5e1',
              borderRadius: 16,
              padding: 16,
              color: '#64748b',
            }}
          >
            No dominant loss information available.
          </div>
        )}
      </section>

      <section
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 24,
          padding: 22,
          boxShadow: '0 16px 40px rgba(15,23,42,0.06)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Raw Payloads
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Coordinator and ACSM payload preview
          </h3>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>
              Last Decision
            </div>
            <textarea
              readOnly
              value={JSON.stringify(decision || {}, null, 2)}
              style={{
                width: '100%',
                minHeight: 280,
                borderRadius: 16,
                border: '1px solid #cbd5e1',
                padding: 14,
                fontFamily: 'monospace',
                fontSize: 12,
                background: '#f8fafc',
                color: '#0f172a',
                lineHeight: 1.6,
              }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>
              Last Knowledge Package
            </div>
            <textarea
              readOnly
              value={JSON.stringify(knowledge || {}, null, 2)}
              style={{
                width: '100%',
                minHeight: 280,
                borderRadius: 16,
                border: '1px solid #cbd5e1',
                padding: 14,
                fontFamily: 'monospace',
                fontSize: 12,
                background: '#f8fafc',
                color: '#0f172a',
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div style={{ color: '#64748b', fontWeight: 700 }}>Loading coordinator dashboard...</div>
      ) : null}
    </div>
  );
}