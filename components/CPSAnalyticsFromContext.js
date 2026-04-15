'use client';

import React from 'react';
import { useCPSContext } from '../context/CPSContext';
import CPSAnalyticsPanel from './CPSAnalyticsPanel';
import { getActiveAcsmConfig } from '../lib/acsm/config';

//const { cpsAnalytics = {} } = useCPSContext();

//const analytics = cpsAnalytics[cpsId] || {};
//const hasData = Object.keys(analytics).length > 0;

export default function CPSAnalyticsFromContext({
  cpsId = getActiveAcsmConfig().defaultCpsId,
  title = 'OEE & Learning',
}) {
  const { cpsAnalytics = {} } = useCPSContext();

  const rawKey = String(cpsId || '');
  const lowerKey = rawKey.toLowerCase();
  const normalizedKey = lowerKey.replace(/[^a-z0-9]/g, '');
  const analytics =
    cpsAnalytics[rawKey] ||
    cpsAnalytics[lowerKey] ||
    cpsAnalytics[normalizedKey] ||
    Object.entries(cpsAnalytics).find(([key]) => {
      const candidateRaw = String(key || '');
      const candidateLower = candidateRaw.toLowerCase();
      const candidateNormalized = candidateLower.replace(/[^a-z0-9]/g, '');
      return (
        candidateRaw === rawKey ||
        candidateLower === lowerKey ||
        candidateNormalized === normalizedKey
      );
    })?.[1] ||
    {};
  const hasData = Object.keys(analytics).length > 0;
 // const hasData = analytics?.oee || analytics?.learning;

  if (!hasData) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 24,
        padding: 24,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        boxShadow: '0 16px 40px rgba(15,23,42,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
            ACSM Analytics
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            {title}
          </div>
          <div style={{ marginTop: 8, color: '#475569' }}>
            CPS ID: <strong>{cpsId}</strong>
          </div>
        </div>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 14px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            color: '#92400e',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
          }}
        >
          Waiting for MQTT
        </span>
      </div>

      <div style={{ color: '#475569', lineHeight: 1.8 }}>
        Aguardando telemetria analítica MQTT para o CPS selecionado.
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gap: 10,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: '#0f172a',
            color: '#e2e8f0',
            fontFamily: 'monospace',
          }}
        >
          {cpsId}/oee
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: '#0f172a',
            color: '#e2e8f0',
            fontFamily: 'monospace',
          }}
        >
          {cpsId}/learning
        </div>
      </div>
    </div>
  );
}

  return (
    <div style={{ marginBottom: 12 }}>
      <CPSAnalyticsPanel cpsId={cpsId} analytics={analytics} title={title} />
    </div>
  );
}
