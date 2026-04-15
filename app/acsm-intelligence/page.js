'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getActiveAcsmConfig } from '../../lib/acsm/config';

const activeAcsm = getActiveAcsmConfig();
const ANALYTICS_BASE_PATH = activeAcsm.externalApis.brokerApiBasePath;
const API_BASE =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:1880`
    : 'http://localhost:1880';

function safeNum(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function pct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

function riskBadgeClass(level) {
  const x = String(level || '').toLowerCase();
  if (x === 'high') return 'badge badge-danger';
  if (x === 'medium') return 'badge badge-warning';
  if (x === 'low') return 'badge badge-success';
  return 'badge badge-muted';
}

function statusCardClass(level) {
  const x = String(level || '').toLowerCase();
  if (x === 'high') return 'intel-card danger';
  if (x === 'medium') return 'intel-card warning';
  if (x === 'low') return 'intel-card success';
  return 'intel-card';
}

function useAcsmData() {
  const [globalData, setGlobalData] = useState(null);
  const [reasoning, setReasoning] = useState(null);
  const [learning, setLearning] = useState(null);
  const [coordinator, setCoordinator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState('');

  async function loadAll() {
    try {
      setError('');

      const [g, r, l, c] = await Promise.all([
        fetch(`${API_BASE}${ANALYTICS_BASE_PATH}/global`, { cache: 'no-store' }),
        fetch(`${API_BASE}${ANALYTICS_BASE_PATH}/reasoning`, { cache: 'no-store' }),
        fetch(`${API_BASE}${ANALYTICS_BASE_PATH}/learning`, { cache: 'no-store' }),
        fetch(`${API_BASE}${ANALYTICS_BASE_PATH}/coordinator-output`, { cache: 'no-store' }),
      ]);

      const [gJson, rJson, lJson, cJson] = await Promise.all([
        g.json(),
        r.json(),
        l.json(),
        c.json(),
      ]);

      setGlobalData(gJson);
      setReasoning(rJson);
      setLearning(lJson);
      setCoordinator(cJson);
      setLastRefresh(new Date());
    } catch (err) {
      setError(`Falha ao carregar dados da ${activeAcsm.code}.`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, []);

  return {
    globalData,
    reasoning,
    learning,
    coordinator,
    loading,
    error,
    lastRefresh,
    reload: loadAll,
  };
}

function Card({ title, value, subtitle, children, className = '' }) {
  return (
    <div className={`intel-card ${className}`}>
      <div className="intel-card-header">
        <span>{title}</span>
      </div>
      {value !== undefined && <div className="intel-card-value">{value}</div>}
      {subtitle ? <div className="intel-card-subtitle">{subtitle}</div> : null}
      {children ? <div className="intel-card-body">{children}</div> : null}
    </div>
  );
}

export default function ACSMIntelligencePage() {
  const {
    globalData,
    reasoning,
    learning,
    coordinator,
    loading,
    error,
    lastRefresh,
    reload,
  } = useAcsmData();

  const oeeGlobal = useMemo(() => {
    if (!globalData) return null;
    return globalData.oeeGlobalSeries ?? globalData.oeeGlobal ?? null;
  }, [globalData]);

  const cpsCards = useMemo(() => {
    if (!globalData?.cps || !Array.isArray(globalData.cps)) return [];
    return globalData.cps;
  }, [globalData]);

  const predictedRiskLevel = learning?.predictedRisk?.level || coordinator?.predictedRisk?.level || 'unknown';
  const explanationText =
    coordinator?.explanation ||
    learning?.explanation ||
    reasoning?.explanation ||
    'Sem explicação disponível.';

  return (
    <div className="acsm-intel-page">
      <style jsx>{`
        .acsm-intel-page {
          min-height: 100vh;
          padding: 24px;
          background:
            radial-gradient(circle at top left, rgba(0, 180, 255, 0.08), transparent 28%),
            radial-gradient(circle at top right, rgba(0, 255, 150, 0.06), transparent 22%),
            linear-gradient(180deg, #07111b 0%, #0b1724 100%);
          color: #eaf2f8;
          font-family: Arial, Helvetica, sans-serif;
        }

        .intel-shell {
          max-width: 1500px;
          margin: 0 auto;
        }

        .intel-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .intel-title-wrap h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: 0.3px;
        }

        .intel-title-wrap p {
          margin: 6px 0 0;
          color: #a9bfd3;
          font-size: 14px;
        }

        .intel-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .intel-meta {
          color: #9db2c6;
          font-size: 13px;
        }

        .reload-btn {
          border: 1px solid rgba(120, 180, 255, 0.35);
          background: rgba(20, 38, 58, 0.95);
          color: #eaf2f8;
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 700;
        }

        .reload-btn:hover {
          background: rgba(30, 52, 78, 0.98);
        }

        .hero-panel {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 18px;
          margin-bottom: 20px;
        }

        .hero-main,
        .hero-side {
          background: rgba(10, 23, 36, 0.92);
          border: 1px solid rgba(120, 180, 255, 0.16);
          border-radius: 20px;
          padding: 22px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
        }

        .hero-label {
          color: #8fb4d1;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.9px;
          margin-bottom: 10px;
        }

        .hero-value {
          font-size: 54px;
          font-weight: 900;
          line-height: 1;
          color: #7fe3ff;
          margin-bottom: 10px;
        }

        .hero-sub {
          color: #bfd3e4;
          font-size: 15px;
        }

        .hero-side-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .intel-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .intel-grid-2 {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 16px;
          margin-bottom: 20px;
        }

        .intel-card {
          background: rgba(10, 23, 36, 0.92);
          border: 1px solid rgba(120, 180, 255, 0.14);
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.24);
        }

        .intel-card.success {
          border-color: rgba(62, 211, 154, 0.35);
        }

        .intel-card.warning {
          border-color: rgba(255, 196, 86, 0.35);
        }

        .intel-card.danger {
          border-color: rgba(255, 100, 100, 0.35);
        }

        .intel-card-header {
          color: #97b3ca;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 12px;
        }

        .intel-card-value {
          font-size: 28px;
          font-weight: 800;
          color: #f4fbff;
          margin-bottom: 6px;
          line-height: 1.15;
        }

        .intel-card-subtitle {
          color: #b7cad9;
          font-size: 14px;
        }

        .intel-card-body {
          margin-top: 12px;
          color: #d9e7f2;
          font-size: 14px;
          line-height: 1.55;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.4px;
        }

        .badge-danger {
          background: rgba(255, 92, 92, 0.16);
          color: #ffb1b1;
          border: 1px solid rgba(255, 92, 92, 0.25);
        }

        .badge-warning {
          background: rgba(255, 196, 86, 0.16);
          color: #ffd887;
          border: 1px solid rgba(255, 196, 86, 0.25);
        }

        .badge-success {
          background: rgba(62, 211, 154, 0.16);
          color: #98f0ca;
          border: 1px solid rgba(62, 211, 154, 0.25);
        }

        .badge-muted {
          background: rgba(180, 190, 200, 0.14);
          color: #d2dae2;
          border: 1px solid rgba(180, 190, 200, 0.2);
        }

        .section-title {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 800;
          color: #f0f7fc;
        }

        .cps-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(220px, 1fr));
          gap: 14px;
        }

        .cps-mini {
          background: rgba(16, 31, 46, 0.94);
          border: 1px solid rgba(120, 180, 255, 0.12);
          border-radius: 16px;
          padding: 14px;
        }

        .cps-mini h4 {
          margin: 0 0 8px;
          font-size: 15px;
          color: #e9f4fb;
        }

        .cps-mini p {
          margin: 4px 0;
          color: #b8ccdc;
          font-size: 13px;
        }

        .explanation-box {
          background: rgba(14, 29, 45, 0.96);
          border: 1px solid rgba(120, 180, 255, 0.14);
          border-radius: 18px;
          padding: 18px;
          color: #dfebf4;
          line-height: 1.7;
          font-size: 15px;
        }

        .error-box,
        .loading-box {
          background: rgba(10, 23, 36, 0.92);
          border: 1px solid rgba(255, 120, 120, 0.2);
          border-radius: 16px;
          padding: 18px;
          color: #ffd0d0;
          margin-bottom: 16px;
        }

        .loading-box {
          border-color: rgba(120, 180, 255, 0.16);
          color: #d6e5f1;
        }

        @media (max-width: 1100px) {
          .hero-panel,
          .intel-grid-2,
          .intel-grid,
          .cps-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 760px) {
          .hero-panel,
          .intel-grid-2,
          .intel-grid,
          .cps-grid,
          .hero-side-grid {
            grid-template-columns: 1fr;
          }

          .hero-value {
            font-size: 42px;
          }

          .intel-topbar {
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="intel-shell">
        <div className="intel-topbar">
          <div className="intel-title-wrap">
            <h1>{activeAcsm.code} Intelligence Center</h1>
            <p>Coordenação cognitiva da célula de manufatura</p>
          </div>

          <div className="intel-actions">
            <div className="intel-meta">
              Última atualização:{' '}
              {lastRefresh ? lastRefresh.toLocaleString() : '—'}
            </div>
            <button className="reload-btn" onClick={reload}>
              Atualizar
            </button>
          </div>
        </div>

        {loading && <div className="loading-box">Carregando dados da {activeAcsm.code}...</div>}
        {error ? <div className="error-box">{error}</div> : null}

        <div className="hero-panel">
          <div className="hero-main">
            <div className="hero-label">Global OEE</div>
            <div className="hero-value">{pct(oeeGlobal)}</div>
            <div className="hero-sub">
              Modo: {globalData?.mode || '—'} | OEE médio:{' '}
              {pct(globalData?.oeeGlobalAverage)}
            </div>
          </div>

          <div className="hero-side">
            <div className="hero-label">Predicted Risk</div>
            <div style={{ marginBottom: 12 }}>
              <span className={riskBadgeClass(predictedRiskLevel)}>
                {String(predictedRiskLevel || 'unknown').toUpperCase()}
              </span>
            </div>
            <div className="hero-side-grid">
              <Card
                title="Critical CPS"
                value={reasoning?.criticalCps || coordinator?.criticalCps || '—'}
                subtitle="Ativo dominante na perda global"
              />
              <Card
                title="Bottleneck"
                value={reasoning?.bottleneck || coordinator?.bottleneck || '—'}
                subtitle="Gargalo atual do sistema"
              />
            </div>
          </div>
        </div>

        <div className="intel-grid">
          <Card
            title="OEE Global"
            value={pct(oeeGlobal)}
            subtitle="Indicador consolidado do sistema"
          />

          <Card
            title="CPS Crítico"
            value={reasoning?.criticalCps || coordinator?.criticalCps || '—'}
            subtitle="Maior contribuição para a perda global"
          />

          <Card
            title="Perda Dominante"
            value={reasoning?.dominantLoss || coordinator?.dominantLoss || '—'}
            subtitle="Availability, performance ou quality"
          />

          <Card
            title="Gargalo"
            value={reasoning?.bottleneck || coordinator?.bottleneck || '—'}
            subtitle="Ponto limitante atual da célula"
          />

          <Card
            title="Padrão Aprendido"
            value={learning?.systemPattern || coordinator?.patternLearned || '—'}
            subtitle="Classificação sistêmica aprendida"
          />

          <Card
            title="Risco Previsto"
            value={learning?.predictedRisk?.type || coordinator?.predictedRisk?.type || '—'}
            subtitle={`Confiança: ${pct((learning?.predictedRisk?.confidence ?? coordinator?.predictedRisk?.confidence) || 0)}`}
            className={
              predictedRiskLevel === 'high'
                ? 'danger'
                : predictedRiskLevel === 'medium'
                ? 'warning'
                : predictedRiskLevel === 'low'
                ? 'success'
                : ''
            }
          />

          <Card
            title="Recomendação"
            value={coordinator?.recommendation || '—'}
            subtitle={`Confiança global: ${pct(coordinator?.confidence || 0)}`}
          />

          <Card
            title="Predicted OEE"
            value={pct(learning?.predictedOeeGlobal)}
            subtitle={`Horizonte: ${learning?.predictionHorizonMin || '—'} min`}
          />
        </div>

        <div className="intel-grid-2">
          <div className="intel-card">
            <h3 className="section-title">Explicação Sistêmica</h3>
            <div className="explanation-box">{explanationText}</div>
          </div>

          <div className={statusCardClass(predictedRiskLevel)}>
            <h3 className="section-title">Resumo Executivo</h3>
            <div className="intel-card-body">
              <p><strong>System ID:</strong> {globalData?.systemId || coordinator?.systemId || activeAcsm.code}</p>
              <p><strong>Risk Level:</strong> <span className={riskBadgeClass(predictedRiskLevel)}>{String(predictedRiskLevel || 'unknown').toUpperCase()}</span></p>
              <p><strong>Trend:</strong> {learning?.trend || '—'}</p>
              <p><strong>Derived Pattern:</strong> {learning?.derivedLearning?.pattern || '—'}</p>
              <p><strong>Dominant CPS:</strong> {reasoning?.criticalCps || '—'}</p>
            </div>
          </div>
        </div>

        <div className="intel-card">
          <h3 className="section-title">Visão por CPS</h3>
          <div className="cps-grid">
            {cpsCards.length > 0 ? (
              cpsCards.map((item, idx) => (
                <div key={`${item.baseTopic}-${idx}`} className="cps-mini">
                  <h4>{item.cpsName || item.cpsId || item.baseTopic}</h4>
                  <p><strong>ID:</strong> {item.cpsId || '—'}</p>
                  <p><strong>Topic:</strong> {item.baseTopic || '—'}</p>
                  <p><strong>Availability:</strong> {pct(item.availability)}</p>
                  <p><strong>Performance:</strong> {pct(item.performance)}</p>
                  <p><strong>Quality:</strong> {pct(item.quality)}</p>
                  <p><strong>OEE:</strong> {pct(item.global)}</p>
                </div>
              ))
            ) : (
              <div className="cps-mini">
                <p>Nenhum CPS disponível no snapshot global.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
