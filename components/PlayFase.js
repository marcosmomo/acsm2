'use client';

import React, { useMemo, useState } from 'react';
import { useCPSContext } from '../context/CPSContext';
import { getActiveAcsmConfig, normalizeCpsId } from '../lib/acsm/config';

// ===== Status helpers (EN) =====
const normalizeStatus = (status) => String(status || '').toLowerCase();

const openACSMIntelligencePage = () => {
  window.open('/acsm-intelligence', '_blank'); // abre em nova aba
};

const humanizeFeatStatus = (status) => {
  const s = normalizeStatus(status);
  if (s === 'failure' || s === 'fail' || s === 'error') return 'Failure';
  if (s === 'maintenance') return 'Maintenance';
  if (s === 'awaiting_replacement' || s === 'waiting') return 'Awaiting replacement';
  if (s === 'active' || s === 'ok' || s === 'running') return 'Active';
  return '—';
};

const mapFeatStatusToBadgeClass = (status) => {
  const s = normalizeStatus(status);
  if (s === 'failure' || s === 'fail' || s === 'error') return 'feat-badge feat-failure';
  if (s === 'maintenance') return 'feat-badge feat-maintenance';
  if (s === 'awaiting_replacement' || s === 'waiting') return 'feat-badge feat-waiting';
  if (s === 'active' || s === 'ok' || s === 'running') return 'feat-badge feat-active';
  return 'feat-badge';
};

// ===== Health helpers =====
const humanizeHealthLabel = (label, score) => {
  const l = String(label || '').toLowerCase();

  if (l === 'healthy') return 'Healthy';
  if (l === 'warning') return 'Attention';
  if (l === 'critical') return 'Critical';
  if (l === 'failure') return 'Failure';
  if (l === 'unknown') return 'Unknown';

  const n = Number(score);
  if (!Number.isFinite(n)) return '—';
  if (n >= 80) return 'Healthy';
  if (n >= 50) return 'Attention';
  if (n >= 20) return 'Critical';
  return 'Failure';
};

const mapHealthBadgeClass = (label, score) => {
  const l = String(label || '').toLowerCase();
  const n = Number(score);

  if (l === 'healthy' || (!l && Number.isFinite(n) && n >= 80)) {
    return 'feat-badge feat-active';
  }
  if (l === 'warning' || (!l && Number.isFinite(n) && n >= 50 && n < 80)) {
    return 'feat-badge feat-maintenance';
  }
  if (l === 'critical' || (!l && Number.isFinite(n) && n >= 20 && n < 50)) {
    return 'feat-badge feat-waiting';
  }
  if (l === 'failure' || (!l && Number.isFinite(n) && n < 20)) {
    return 'feat-badge feat-failure';
  }

  return 'feat-badge';
};

// ===== Global CPS State helpers =====
const humanizeGlobalState = (state) => {
  const s = String(state || '').toLowerCase();

  if (s === 'running') return 'Running';
  if (s === 'stopped') return 'Stopped';
  if (s === 'maintenance') return 'Maintenance';
  if (s === 'awaiting_replacement') return 'Awaiting replacement';
  if (s === 'failure') return 'Failure';
  if (s === 'ready') return 'Ready';
  if (s === 'unplugged') return 'Unplugged';

  return '—';
};

const mapGlobalStateBadgeClass = (state) => {
  const s = String(state || '').toLowerCase();

  if (s === 'running') return 'feat-badge feat-active';
  if (s === 'maintenance') return 'feat-badge feat-maintenance';
  if (s === 'awaiting_replacement') return 'feat-badge feat-waiting';
  if (s === 'failure' || s === 'unplugged') return 'feat-badge feat-failure';
  if (s === 'stopped' || s === 'ready') return 'feat-badge';
  return 'feat-badge';
};

// ===== OEE helpers =====
const formatPercent = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
};

const humanizeOeeLabel = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 0.85) return 'Excellent';
  if (n >= 0.60) return 'Good';
  if (n >= 0.40) return 'Moderate';
  return 'Low';
};

const mapOeeBadgeClass = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'feat-badge';
  if (n >= 0.85) return 'feat-badge feat-active';
  if (n >= 0.60) return 'feat-badge feat-maintenance';
  if (n >= 0.40) return 'feat-badge feat-waiting';
  return 'feat-badge feat-failure';
};

// ===== Generic explanations =====
const statusExplanation = (status) => {
  const s = normalizeStatus(status);

  if (s === 'active' || s === 'ok' || s === 'running') {
    return {
      title: 'Active',
      text:
        'The operation is running normally. The CPS indicates that the routine is executing as expected.',
    };
  }

  if (s === 'maintenance') {
    return {
      title: 'Maintenance',
      text:
        'The operation is in maintenance mode. Execution may be restricted while inspection, calibration, or corrective actions are performed.',
    };
  }

  if (s === 'awaiting_replacement' || s === 'waiting') {
    return {
      title: 'Awaiting replacement',
      text:
        'The operation is paused waiting for a required replacement or intervention before continuing.',
    };
  }

  if (s === 'failure' || s === 'fail' || s === 'error') {
    return {
      title: 'Failure',
      text:
        'A failure condition was detected. The operation cannot continue safely until the cause is resolved.',
    };
  }

  return {
    title: 'Unknown',
    text: 'No recognized status was reported yet. Waiting for the CPS to publish a valid feature state.',
  };
};

const normalizeUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `http://${u}`;
};

const getDescriptionUrl = (cps) =>
  normalizeUrl(cps?.endpoints?.description) || normalizeUrl(cps?.dashboardUrl) || '';

const getDataUrl = (cps) =>
  normalizeUrl(cps?.endpoints?.indicators) ||
  normalizeUrl(cps?.endpoints?.summary) ||
  normalizeUrl(cps?.apiData) ||
  '';

const getHistoryUrl = (cps) => normalizeUrl(cps?.endpoints?.history) || '';
const getHealthUrl = (cps) => normalizeUrl(cps?.endpoints?.health) || '';

const openExternalUrl = (url, emptyMessage) => {
  const finalUrl = normalizeUrl(url);
  if (!finalUrl) {
    alert(emptyMessage || 'URL not available for this CPS.');
    return;
  }
  window.open(finalUrl, '_blank', 'noopener,noreferrer');
};

const openAnalyticsPage = (cps) => {
  const rawId = cps?.id || getActiveAcsmConfig().defaultCpsId;
  const cleanId = normalizeCpsId(rawId) || getActiveAcsmConfig().defaultCpsId;

  const cpsId = encodeURIComponent(cleanId);
  const cpsName = encodeURIComponent(cps?.nome || rawId || 'CPS');

  window.open(`/analytics?cpsId=${cpsId}&cpsName=${cpsName}`, '_blank', 'noopener,noreferrer');
};

const openSystemAnalyticsPage = () => {
  window.open('/analytics-system', '_blank', 'noopener,noreferrer');
};

const openKnowledgePublisherPage = () => {
  window.open('/knowledge-publisher', '_blank', 'noopener,noreferrer');
};

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const PlayFase = () => {
  const { addedCPS, startCPSById, stopCPSById, unplugCPS } = useCPSContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalCpsName, setModalCpsName] = useState('');
  const [modalOperationKey, setModalOperationKey] = useState('');
  const [modalOperationName, setModalOperationName] = useState('');
  const [modalOperationDesc, setModalOperationDesc] = useState('');
  const [modalStatus, setModalStatus] = useState(null);
  const [modalLastUpdate, setModalLastUpdate] = useState(null);

  const globalOee = useMemo(() => {
    const validOees = addedCPS
      .map((cps) => Number(cps?.oee?.value ?? cps?.oee?.current))
      .filter((v) => Number.isFinite(v) && v >= 0);

    if (!validOees.length) {
      return {
        value: null,
        label: '—',
        badgeClass: 'feat-badge',
        cpsCount: addedCPS.length,
        measuredCount: 0,
      };
    }

    const avg = validOees.reduce((acc, v) => acc + v, 0) / validOees.length;

    return {
      value: avg,
      label: humanizeOeeLabel(avg),
      badgeClass: mapOeeBadgeClass(avg),
      cpsCount: addedCPS.length,
      measuredCount: validOees.length,
    };
  }, [addedCPS]);

  const openStatusDetails = (cps, feat) => {
    setModalCpsName(cps.nome);
    setModalOperationKey(feat?.key || '');
    setModalOperationName(feat?.nome || feat?.key || '');
    setModalOperationDesc(feat?.descricao || '');
    setModalStatus(feat?.statusAtual ?? null);
    setModalLastUpdate(feat?.lastUpdate ?? null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalCpsName('');
    setModalOperationKey('');
    setModalOperationName('');
    setModalOperationDesc('');
    setModalStatus(null);
    setModalLastUpdate(null);
  };

  const handleExit = async (cps) => {
    try {
      await Promise.resolve(unplugCPS(cps.nome));
    } catch (e) {
      alert(`Failed to unplug CPS: ${e?.message || e}`);
    }
  };

  return (
    <div className="component-container play-fase">
      <h2>Play Phase</h2>

      <div className="added-cps-display-play">
        <h3>CPS in Play Phase:</h3>

        <div className="single-feature-card" style={{ marginBottom: 16 }}>
          <div
            className="single-feature-row"
            style={{
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="single-feature-title">
                Global Manufacturing OEE: <strong>{formatPercent(globalOee.value)}</strong>
              </div>

              <div className="single-feature-status">
                <span className={globalOee.badgeClass}>{globalOee.label}</span>
              </div>

              <div className="single-feature-meta">
                <div className="single-feature-time">
                  CPS measured: <span>{globalOee.measuredCount}</span> /{' '}
                  <span>{globalOee.cpsCount}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={openSystemAnalyticsPage}
                className="desc-btn"
                title="Open global system analytics"
              >
                System Analytics                
              </button>
              <button
                onClick={openKnowledgePublisherPage}
                className="desc-btn"
                title="Open ACSM knowledge publisher"
              >
                ACSM Knowledge Publisher
              </button>
              <button
                onClick={openACSMIntelligencePage}
                className="desc-btn"
                title="Open ACSM intelligent coordination center"
              >
                ACSM Intelligence
              </button>
              
            </div>
          </div>

          <div className="single-feature-row" style={{ marginBottom: 0 }}>
            <div className="single-feature-title">
              Interpretation: <strong>{globalOee.label}</strong>
            </div>
          </div>
        </div>

        <ul className="cps-list-play">
          {addedCPS.length > 0 ? (
            addedCPS.map((cps) => {
              const features = Array.isArray(cps.funcionalidades) ? cps.funcionalidades : [];

              const descriptionUrl = getDescriptionUrl(cps);
              const dataUrl = getDataUrl(cps);
              const historyUrl = getHistoryUrl(cps);
              const healthUrl = getHealthUrl(cps);

              const normalizedCpsStatus = String(cps.status || '').toLowerCase().trim();

              const isStopped = ['parado', 'stopped', 'stop', 'paused'].includes(normalizedCpsStatus);
              const isRunning = ['rodando', 'running', 'play', 'active'].includes(normalizedCpsStatus);

              const globalStateValue = cps.globalState?.state ?? null;
              const globalStateText = humanizeGlobalState(globalStateValue);
              const globalStateBadgeCls = mapGlobalStateBadgeClass(globalStateValue);
              const globalStateWhen = formatDateTime(cps.globalState?.lastUpdate);

              const healthScore = cps.health?.score ?? null;
              const healthLabel = cps.health?.label ?? null;
              const healthText = humanizeHealthLabel(healthLabel, healthScore);
              const healthBadgeCls = mapHealthBadgeClass(healthLabel, healthScore);
              const healthWhen = formatDateTime(cps.health?.lastUpdate);

              const oeeValue = cps.oee?.value ?? null;
              const oeeAvailability = cps.oee?.availability ?? null;
              const oeePerformance = cps.oee?.performance ?? null;
              const oeeQuality = cps.oee?.quality ?? null;
              const oeeText = humanizeOeeLabel(oeeValue);
              const oeeBadgeCls = mapOeeBadgeClass(oeeValue);
              const oeeWhen = formatDateTime(cps.oee?.lastUpdate);

              return (
                <li
                  key={cps.id}
                  className={`cps-item-play status-${String(cps.status || '').toLowerCase()}`}
                >
                  <div className="cps-header">
                    <span className="cps-name">
                      {cps.nome} — <strong>{isRunning ? 'Running' : isStopped ? 'Stopped' : cps.status}</strong></span>

                    <div className="action-buttons">
                      {isRunning && (
                        <>
                          <button
                            onClick={() => stopCPSById(cps.id)}
                            className="stop-btn"
                            title="Pause monitoring (CPS keeps running)"
                          >
                            Stop
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                descriptionUrl,
                                'No DescriptionEndpoint or DashboardURL found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              descriptionUrl
                                ? `Open CPS description: ${descriptionUrl}`
                                : 'Description endpoint not available'
                            }
                            disabled={!descriptionUrl}
                          >
                            Description
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                dataUrl,
                                'No IndicatorsEndpoint, SummaryEndpoint or APIData found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              dataUrl
                                ? `Open CPS data endpoint: ${dataUrl}`
                                : 'Data endpoint not available'
                            }
                            disabled={!dataUrl}
                          >
                            Data
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                historyUrl,
                                'No HistoryEndpoint found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              historyUrl
                                ? `Open CPS history endpoint: ${historyUrl}`
                                : 'History endpoint not available'
                            }
                            disabled={!historyUrl}
                          >
                            History
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                healthUrl,
                                'No HealthEndpoint found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              healthUrl
                                ? `Open CPS health endpoint: ${healthUrl}`
                                : 'Health endpoint not available'
                            }
                            disabled={!healthUrl}
                          >
                            Health API
                          </button>

                          <button
                            onClick={() => openAnalyticsPage(cps)}
                            className="desc-btn"
                            title={`Open analytics page for ${cps.nome}`}
                          >
                            Analytics
                          </button>
                        </>
                      )}

                      {isStopped && (
                        <>
                          <button
                            onClick={() => startCPSById(cps.id)}
                            className="restart-btn"
                            title="Resume monitoring"
                          >
                            Restart
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                descriptionUrl,
                                'No DescriptionEndpoint or DashboardURL found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              descriptionUrl
                                ? `Open CPS description: ${descriptionUrl}`
                                : 'Description endpoint not available'
                            }
                            disabled={!descriptionUrl}
                          >
                            Description
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                dataUrl,
                                'No IndicatorsEndpoint, SummaryEndpoint or APIData found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              dataUrl
                                ? `Open CPS data endpoint: ${dataUrl}`
                                : 'Data endpoint not available'
                            }
                            disabled={!dataUrl}
                          >
                            Data
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                historyUrl,
                                'No HistoryEndpoint found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              historyUrl
                                ? `Open CPS history endpoint: ${historyUrl}`
                                : 'History endpoint not available'
                            }
                            disabled={!historyUrl}
                          >
                            History
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                healthUrl,
                                'No HealthEndpoint found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              healthUrl
                                ? `Open CPS health endpoint: ${healthUrl}`
                                : 'Health endpoint not available'
                            }
                            disabled={!healthUrl}
                          >
                            Health API
                          </button>

                          <button
                            onClick={() => openAnalyticsPage(cps)}
                            className="desc-btn"
                            title={`Open analytics page for ${cps.nome}`}
                          >
                            Analytics
                          </button>

                          <button
                            className="exit-btn"
                            title="Remove CPS from Play Phase"
                            onClick={() => handleExit(cps)}
                          >
                            Unplug
                          </button>
                        </>
                      )}

                      {!isRunning && !isStopped && (
                        <>
                          <button
                            onClick={() =>
                              openExternalUrl(
                                descriptionUrl,
                                'No DescriptionEndpoint or DashboardURL found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              descriptionUrl
                                ? `Open CPS description: ${descriptionUrl}`
                                : 'Description endpoint not available'
                            }
                            disabled={!descriptionUrl}
                          >
                            Description
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                dataUrl,
                                'No IndicatorsEndpoint, SummaryEndpoint or APIData found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              dataUrl
                                ? `Open CPS data endpoint: ${dataUrl}`
                                : 'Data endpoint not available'
                            }
                            disabled={!dataUrl}
                          >
                            Data
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                historyUrl,
                                'No HistoryEndpoint found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              historyUrl
                                ? `Open CPS history endpoint: ${historyUrl}`
                                : 'History endpoint not available'
                            }
                            disabled={!historyUrl}
                          >
                            History
                          </button>

                          <button
                            onClick={() =>
                              openExternalUrl(
                                healthUrl,
                                'No HealthEndpoint found in the AAS.'
                              )
                            }
                            className="desc-btn"
                            title={
                              healthUrl
                                ? `Open CPS health endpoint: ${healthUrl}`
                                : 'Health endpoint not available'
                            }
                            disabled={!healthUrl}
                          >
                            Health API
                          </button>

                          <button
                            onClick={() => openAnalyticsPage(cps)}
                            className="desc-btn"
                            title={`Open analytics page for ${cps.nome}`}
                          >
                            Analytics
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="single-feature-card" style={{ marginBottom: 12 }}>
                    <div className="single-feature-row" style={{ marginBottom: 0 }}>
                      <div className="single-feature-title">
                        Global CPS State: <strong>{globalStateText}</strong>
                      </div>

                      <div className="single-feature-status">
                        <span className={globalStateBadgeCls}>{globalStateText}</span>
                      </div>

                      <div className="single-feature-meta">
                        <div className="single-feature-time">
                          Last state update: <span>{globalStateWhen}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="single-feature-card" style={{ marginBottom: 12 }}>
                    <div className="single-feature-row" style={{ marginBottom: 0 }}>
                      <div className="single-feature-title">
                        Health Indicator: <strong>{healthScore ?? '—'}</strong>
                      </div>

                      <div className="single-feature-status">
                        <span className={healthBadgeCls}>{healthText}</span>
                      </div>

                      <div className="single-feature-meta">
                        <div className="single-feature-time">
                          Last health update: <span>{healthWhen}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="single-feature-card" style={{ marginBottom: 12 }}>
                    <div className="single-feature-row" style={{ marginBottom: 8 }}>
                      <div className="single-feature-title">
                        Local OEE: <strong>{formatPercent(oeeValue)}</strong>
                      </div>

                      <div className="single-feature-status">
                        <span className={oeeBadgeCls}>{oeeText}</span>
                      </div>

                      <div className="single-feature-meta">
                        <div className="single-feature-time">
                          Last OEE update: <span>{oeeWhen}</span>
                        </div>
                      </div>
                    </div>

                    <div className="single-feature-row" style={{ marginBottom: 0 }}>
                      <div className="single-feature-title">
                        Availability: <strong>{formatPercent(oeeAvailability)}</strong>
                      </div>

                      <div className="single-feature-title">
                        Performance: <strong>{formatPercent(oeePerformance)}</strong>
                      </div>

                      <div className="single-feature-title">
                        Quality: <strong>{formatPercent(oeeQuality)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="single-feature-card" style={{ marginTop: 'auto' }}>
                    {features.length > 0 ? (
                      features.map((feat) => {
                        const statusText = humanizeFeatStatus(feat?.statusAtual);
                        const badgeCls = mapFeatStatusToBadgeClass(feat?.statusAtual);
                        const when = feat?.lastUpdate
                          ? new Date(feat.lastUpdate).toLocaleString()
                          : '—';

                        return (
                          <div
                            key={feat.key}
                            className="single-feature-row"
                            style={{ marginBottom: 10 }}
                          >
                            <div className="single-feature-title">
                              Operation: <strong>{feat.nome || feat.key}</strong>
                            </div>

                            <div className="single-feature-status">
                              <span className={badgeCls}>{statusText}</span>
                            </div>

                            <div className="single-feature-meta">
                              <div className="single-feature-time">
                                Last update: <span>{when}</span>
                              </div>
                            </div>

                            <div className="single-feature-actions">
                              <button
                                className="restart-btn"
                                title="Explain what this status means"
                                onClick={() => openStatusDetails(cps, feat)}
                              >
                                Details
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="single-feature-row" style={{ marginBottom: 10 }}>
                        <div className="single-feature-title">
                          Operation: <strong>{cps?.nome || 'Primary Operation'}</strong>
                        </div>

                        <div className="single-feature-status">
                          <span className={globalStateBadgeCls}>{globalStateText}</span>
                        </div>

                        <div className="single-feature-meta">
                          <div className="single-feature-time">
                            Last update:{' '}
                            <span>{globalStateWhen !== '—' ? globalStateWhen : oeeWhen}</span>
                          </div>
                        </div>

                        <div className="single-feature-actions">
                          <button
                            className="restart-btn"
                            title="Explain current CPS status"
                            onClick={() =>
                              openStatusDetails(cps, {
                                key: 'global_operation',
                                nome: cps?.nome || 'Primary Operation',
                                descricao:
                                  cps?.descricao ||
                                  'Primary CPS operation derived from global state, health, and OEE.',
                                statusAtual: globalStateValue || cps?.status || null,
                                lastUpdate:
                                  cps?.globalState?.lastUpdate ||
                                  cps?.oee?.lastUpdate ||
                                  cps?.health?.lastUpdate ||
                                  null,
                              })
                            }
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })
          ) : (
            <li className="no-cps">No active CPS...</li>
          )}
        </ul>
      </div>

      {modalOpen && (
        <div className="modal-overlay" role="presentation" onClick={closeModal}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-details-title"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const info = statusExplanation(modalStatus);
              const when = modalLastUpdate ? new Date(modalLastUpdate).toLocaleString() : '—';

              return (
                <>
                  <h3 id="status-details-title" className="details-modal-title">
                    Status Details — {modalCpsName}
                  </h3>

                  <div className="details-grid">
                    <div>
                      <strong>Operation</strong>
                    </div>
                    <div>{modalOperationName || modalOperationKey || '—'}</div>

                    {modalOperationDesc ? (
                      <>
                        <div>
                          <strong>Description</strong>
                        </div>
                        <div className="details-box">{modalOperationDesc}</div>
                      </>
                    ) : null}

                    <div>
                      <strong>Status</strong>
                    </div>
                    <div>{info.title}</div>

                    <div>
                      <strong>Meaning</strong>
                    </div>
                    <div className="details-box">{info.text}</div>

                    <div>
                      <strong>Last update</strong>
                    </div>
                    <div>{when}</div>
                  </div>

                  <div className="modal-footer">
                    <button className="modal-cancel-btn" onClick={closeModal}>
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayFase;
