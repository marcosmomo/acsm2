'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCPSContext } from '../context/CPSContext';
import {
  filterManagedArrayByCps,
  getActiveAcsmConfig,
  keepManagedValue,
} from '../lib/acsm/config';

const DEFAULT_BROKER_URL =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? 'wss://broker.hivemq.com:8884/mqtt'
    : 'ws://broker.hivemq.com:8000/mqtt';

const ACTIVE_ACSM = getActiveAcsmConfig();
const KNOWLEDGE_TOPIC = ACTIVE_ACSM.topics.knowledgeGlobal;

const toNumber = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const mean = (arr) => {
  const nums = (arr || []).map((x) => Number(x)).filter((x) => Number.isFinite(x));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

const classifyTrend = (globalOee) => {
  const n = toNumber(globalOee, 0);
  if (n >= 0.85) return 'stable_high_performance';
  if (n >= 0.6) return 'stable';
  if (n >= 0.4) return 'attention';
  return 'declining';
};

const dominantLossFromCps = (cps) => {
  const a = toNumber(cps?.oee?.availability, 0);
  const p = toNumber(cps?.oee?.performance, 0);
  const q = toNumber(cps?.oee?.quality, 0);

  const lossA = 1 - a;
  const lossP = 1 - p;
  const lossQ = 1 - q;

  const maxLoss = Math.max(lossA, lossP, lossQ);

  if (maxLoss === lossA) return 'availability';
  if (maxLoss === lossP) return 'performance';
  return 'quality';
};

const getRiskMeta = (globalOEE) => {
  const n = toNumber(globalOEE, 0);

  if (n >= 0.85) {
    return {
      label: 'Low risk',
      bg: '#dcfce7',
      color: '#166534',
      border: '#86efac',
    };
  }

  if (n >= 0.6) {
    return {
      label: 'Moderate risk',
      bg: '#fef3c7',
      color: '#92400e',
      border: '#fcd34d',
    };
  }

  return {
    label: 'High risk',
    bg: '#fee2e2',
    color: '#991b1b',
    border: '#fca5a5',
  };
};

const getTrendMeta = (trend) => {
  const t = String(trend || '').toLowerCase();

  if (t.includes('stable_high')) {
    return { label: 'Stable high performance', bg: '#dcfce7', color: '#166534' };
  }
  if (t.includes('stable')) {
    return { label: 'Stable', bg: '#dbeafe', color: '#1d4ed8' };
  }
  if (t.includes('attention')) {
    return { label: 'Attention', bg: '#fef3c7', color: '#92400e' };
  }
  return { label: 'Declining', bg: '#fee2e2', color: '#991b1b' };
};

const buildKnowledgePackage = ({ addedCPS = [], systemAnalytics = null }) => {
  const validOees = addedCPS
    .map((cps) => toNumber(cps?.oee?.value ?? cps?.oee?.current))
    .filter((v) => Number.isFinite(v));

  const globalOEE = systemAnalytics?.globalOEE?.oee ?? mean(validOees);
  const trend = classifyTrend(globalOEE);

  const cpsSummaries = addedCPS
    .filter((cps) => keepManagedValue(cps?.id, ACTIVE_ACSM))
    .map((cps) => ({
    cpsId: cps?.id || null,
    cpsName: cps?.nome || null,
    state: cps?.globalState?.state || null,
    healthScore: toNumber(cps?.health?.score),
    healthLabel: cps?.health?.label || null,
    oee: {
      value: toNumber(cps?.oee?.value ?? cps?.oee?.current),
      availability: toNumber(cps?.oee?.availability),
      performance: toNumber(cps?.oee?.performance),
      quality: toNumber(cps?.oee?.quality),
      lastUpdate: cps?.oee?.lastUpdate || null,
    },
    dominantLoss: dominantLossFromCps(cps),
  }));

  const criticalCps =
    (keepManagedValue(systemAnalytics?.criticalCPS?.cpsId || systemAnalytics?.criticalCPS, ACTIVE_ACSM)
      ? {
          ...(typeof systemAnalytics?.criticalCPS === 'object' ? systemAnalytics.criticalCPS : {}),
          cpsId: keepManagedValue(systemAnalytics?.criticalCPS?.cpsId || systemAnalytics?.criticalCPS, ACTIVE_ACSM),
        }
      : null) ||
    [...cpsSummaries]
      .filter((c) => Number.isFinite(c?.oee?.value))
      .sort((a, b) => (a.oee.value ?? 1) - (b.oee.value ?? 1))[0] ||
    null;

  const dominantLosses = filterManagedArrayByCps(cpsSummaries.map((c) => ({
    cpsId: c.cpsId,
    cpsName: c.cpsName,
    dominantLoss: c.dominantLoss,
    oee: c?.oee?.value ?? null,
  })), ACTIVE_ACSM);

  const recommendations = [];

  cpsSummaries.forEach((c) => {
    if ((c?.healthScore ?? 100) < 50) {
      recommendations.push({
        action: 'inspect_health_condition',
        target: c.cpsId,
        priority: 'high',
        reason: 'low_health_score',
      });
    }

    if ((c?.oee?.value ?? 1) < 0.6) {
      recommendations.push({
        action: 'investigate_oee_loss',
        target: c.cpsId,
        priority: 'high',
        reason: c.dominantLoss,
      });
    }
  });

  if (!recommendations.length) {
    recommendations.push({
      action: 'maintain_monitoring',
      target: 'system',
      priority: 'normal',
      reason: 'stable_operation',
    });
  }

  const explanation =
    systemAnalytics?.explanation ||
    `Global OEE is ${(globalOEE * 100).toFixed(1)}%. ` +
      `${criticalCps?.cpsId ? `${criticalCps.cpsId} is the most critical CPS. ` : ''}` +
      `Trend classified as ${trend}.`;

  return {
    schemaVersion: '1.0',
    messageType: 'acsm_knowledge_package',
    acsmId: ACTIVE_ACSM.code,
    timestamp: new Date().toISOString(),
    topic: KNOWLEDGE_TOPIC,

    plantKnowledge: {
      globalOEE: Number(globalOEE.toFixed(4)),
      trend,
      cpsCount: addedCPS.length,
      criticalCPS: criticalCps
        ? {
            cpsId: criticalCps.cpsId || criticalCps?.cpsId,
            cpsName: criticalCps.cpsName || criticalCps?.cpsName,
          }
        : null,
      dominantLosses,
      confidence: systemAnalytics?.confidence ?? 0.75,
      explanation,
    },

    cpsSummaries,

    learnedModel: {
      type: systemAnalytics?.learnedPattern || 'aggregated_rule_based_learning',
      source: ACTIVE_ACSM.code,
      description:
        'System-level knowledge synthesized from local CPS OEE, health, status and learned patterns.',
    },

    recommendedActions: recommendations,

    coordinatorOutput:
      {
        ...(systemAnalytics?.coordinatorOutput || {}),
        globalOEE: Number(globalOEE.toFixed(4)),
        criticalCPS: keepManagedValue(criticalCps?.cpsId || criticalCps, ACTIVE_ACSM),
        trend,
        recommendation:
          systemAnalytics?.coordinatorOutput?.recommendation ||
          recommendations[0]?.action ||
          'maintain_monitoring',
      },
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

export default function ACSMKnowledgePublisher() {
  const { addedCPS, systemAnalytics } = useCPSContext();

  const [mqttClient, setMqttClient] = useState(null);
  const [mqttStatus, setMqttStatus] = useState('disconnected');
  const [autoPublish, setAutoPublish] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState(null);
  const [publishResult, setPublishResult] = useState('');
  const lastPayloadRef = useRef('');

  const knowledgePackage = useMemo(() => {
    return buildKnowledgePackage({ addedCPS, systemAnalytics });
  }, [addedCPS, systemAnalytics]);

  const riskMeta = useMemo(
    () => getRiskMeta(knowledgePackage?.plantKnowledge?.globalOEE),
    [knowledgePackage]
  );

  const trendMeta = useMemo(
    () => getTrendMeta(knowledgePackage?.plantKnowledge?.trend),
    [knowledgePackage]
  );

  useEffect(() => {
    let mounted = true;
    let clientRef = null;

    const connectMqtt = async () => {
      try {
        const mod = await import('mqtt');
        const connect =
          mod?.connect ||
          mod?.default?.connect ||
          (typeof mod?.default === 'function' ? mod.default : undefined);

        if (!connect) {
          if (mounted) setMqttStatus('error');
          return;
        }

        clientRef = connect(DEFAULT_BROKER_URL, {
          clean: true,
          reconnectPeriod: 1000,
          clientId: `acsm-knowledge-${Math.random().toString(16).slice(2)}`,
        });

        clientRef.on('connect', () => {
          if (!mounted) return;
          setMqttClient(clientRef);
          setMqttStatus('connected');
        });

        clientRef.on('reconnect', () => {
          if (!mounted) return;
          setMqttStatus('reconnecting');
        });

        clientRef.on('error', () => {
          if (!mounted) return;
          setMqttStatus('error');
        });

        clientRef.on('close', () => {
          if (!mounted) return;
          setMqttStatus('disconnected');
        });
      } catch {
        if (mounted) setMqttStatus('error');
      }
    };

    connectMqtt();

    return () => {
      mounted = false;
      try {
        clientRef?.end?.(true);
      } catch {}
    };
  }, []);

  const publishKnowledge = () => {
    if (!mqttClient || mqttStatus !== 'connected') {
      setPublishResult('MQTT not connected.');
      return;
    }

    try {
      const payload = JSON.stringify(knowledgePackage, null, 2);

      mqttClient.publish(
        KNOWLEDGE_TOPIC,
        payload,
        { qos: 1, retain: false },
        (err) => {
          if (err) {
            setPublishResult(`Publish error: ${err.message || err}`);
            return;
          }

          setLastPublishedAt(new Date().toLocaleString());
          setPublishResult(`Knowledge published to ${KNOWLEDGE_TOPIC}`);
          lastPayloadRef.current = JSON.stringify(knowledgePackage);
        }
      );
    } catch (e) {
      setPublishResult(`Serialization error: ${e?.message || e}`);
    }
  };

  useEffect(() => {
    if (!autoPublish || mqttStatus !== 'connected') return;

    const payload = JSON.stringify(knowledgePackage);
    if (payload === lastPayloadRef.current) return;

    publishKnowledge();
  }, [knowledgePackage, autoPublish, mqttStatus]); // eslint-disable-line react-hooks/exhaustive-deps

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
              KNOWLEDGE DISPATCH SERVICE
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
              {ACTIVE_ACSM.code} Knowledge Publisher
            </h2>

            <div
              style={{
                marginTop: 10,
                color: '#cbd5e1',
                fontSize: 15,
                lineHeight: 1.7,
              }}
            >
              Service responsible for synthesizing systemic knowledge from {ACTIVE_ACSM.code} and
              publishing it to the supply chain coordinator through MQTT.
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
                label={`MQTT ${mqttStatus}`}
                bg={
                  mqttStatus === 'connected'
                    ? '#dcfce7'
                    : mqttStatus === 'error'
                    ? '#fee2e2'
                    : '#e2e8f0'
                }
                color={
                  mqttStatus === 'connected'
                    ? '#166534'
                    : mqttStatus === 'error'
                    ? '#991b1b'
                    : '#334155'
                }
              />
              <Chip
                label={trendMeta.label}
                bg={trendMeta.bg}
                color={trendMeta.color}
              />
              <Chip
                label={riskMeta.label}
                bg={riskMeta.bg}
                color={riskMeta.color}
                border={riskMeta.border}
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
              Dispatch Controls
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
  <button
    onClick={publishKnowledge}
    style={{
      border: '1px solid rgba(255,255,255,0.18)',
      background: '#ffffff',
      color: '#0f172a',
      borderRadius: 14,
      padding: '12px 16px',
      fontWeight: 800,
      cursor: 'pointer',
    }}
  >
    Publish Now
  </button>

  <button
    onClick={() => window.open('/supply-chain-dashboard', '_blank', 'noopener,noreferrer')}
    style={{
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.08)',
      color: '#ffffff',
      borderRadius: 14,
      padding: '12px 16px',
      fontWeight: 800,
      cursor: 'pointer',
    }}
  >
    Open Coordinator Dashboard
  </button>

  <label
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '12px 14px',
      fontWeight: 700,
      color: '#ffffff',
    }}
  >
    <input
      type="checkbox"
      checked={autoPublish}
      onChange={(e) => setAutoPublish(e.target.checked)}
    />
    Auto publish
  </label>
</div>

            <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
              {publishResult || 'Ready to publish the current system knowledge package.'}
            </div>
          </div>
        </div>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <MetricCard
          label="MQTT Topic"
          value={KNOWLEDGE_TOPIC}
          helper="Topic used to disseminate the knowledge package."
        />
        <MetricCard
          label="Global OEE"
          value={`${((knowledgePackage?.plantKnowledge?.globalOEE ?? 0) * 100).toFixed(1)}%`}
          helper={`Systemic consolidation of CPS assets in ${ACTIVE_ACSM.code}.`}
        />
        <MetricCard
          label="Critical CPS"
          value={keepManagedValue(knowledgePackage?.plantKnowledge?.criticalCPS?.cpsId, ACTIVE_ACSM) || '-'}
          helper="Asset with the highest current Criticality."
        />
        <MetricCard
          label="Last Publish"
          value={lastPublishedAt || '—'}
          helper="Timestamp of the last package publication to the coordinator."
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
            Executive Summary
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
            Knowledge package preview
          </h3>

          <div style={{ marginTop: 8, color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
            Structured view of the systemic knowledge package that will be sent
            to the supply chain coordinator.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
            marginBottom: 16,
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
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Coordinator Output</div>
            <div style={{ color: '#0f172a', fontWeight: 800, lineHeight: 1.8 }}>
              Recommendation:{' '}
              {knowledgePackage?.coordinatorOutput?.recommendation || '—'}
            </div>
            <div style={{ color: '#334155', marginTop: 8, lineHeight: 1.7 }}>
              Critical CPS: {keepManagedValue(knowledgePackage?.coordinatorOutput?.criticalCPS, ACTIVE_ACSM) || '-'}
            </div>
            <div style={{ color: '#334155', marginTop: 4, lineHeight: 1.7 }}>
              Trend: {knowledgePackage?.coordinatorOutput?.trend || '—'}
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
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Learned Model</div>
            <div style={{ color: '#0f172a', fontWeight: 800, lineHeight: 1.8 }}>
              {knowledgePackage?.learnedModel?.type || '—'}
            </div>
            <div style={{ color: '#334155', marginTop: 8, lineHeight: 1.7 }}>
              {knowledgePackage?.learnedModel?.description || '—'}
            </div>
          </div>
        </div>

        <textarea
          readOnly
          value={JSON.stringify(knowledgePackage, null, 2)}
          style={{
            width: '100%',
            minHeight: 320,
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
      </section>
    </div>
  );
}




