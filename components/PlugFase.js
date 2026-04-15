'use client';

import React, { useRef, useState, useMemo } from 'react';
import { useCPSContext } from '../context/CPSContext';

const formatEventDate = (ts) => {
  if (!ts) return 'Timestamp unavailable';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

const normalizeUrl = (url) => {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `http://${u}`;
};

const getEventVariantClass = (type) => {
  const v = String(type || '').toLowerCase();

  if (v === 'maintenance_started') return 'plug-asset-event-start';
  if (v === 'maintenance_completed') return 'plug-asset-event-complete';
  if (v === 'update_functions') return 'plug-asset-event-complete';
  return 'plug-asset-event-neutral';
};

const getEventTitle = (entry) => {
  if (entry?.title) return entry.title;

  const t = String(entry?.type || '').toLowerCase();

  if (t === 'maintenance_started') return 'Maintenance started';
  if (t === 'maintenance_completed') return 'Maintenance completed';
  if (t === 'update_functions') return 'Maintenance update';

  return 'Lifecycle update';
};

const getLifecycleBadgeLabel = ({ inPlay, maintenanceInProgress }) => {
  if (maintenanceInProgress) return 'Maintenance';
  if (inPlay) return 'Operational';
  return 'Ready';
};

const getLifecycleBadgeClass = ({ inPlay, maintenanceInProgress }) => {
  if (maintenanceInProgress) return 'plug-asset-state-maintenance';
  if (inPlay) return 'plug-asset-state-operational';
  return 'plug-asset-state-ready';
};

const PlugFase = () => {
  const {
    availableCPSNames = [],
    availableCPS = [],
    registerCPS,
    addCPS,
    addedCPS,
    unplugCPS,
  } = useCPSContext();

  const fileInputRef = useRef(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [openUpdates, setOpenUpdates] = useState({});
  const [isDownloadingLog, setIsDownloadingLog] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMsg('');
    setErrorMsg('');

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const text = String(evt.target?.result || '');
        const parsed = JSON.parse(text);

        const ok = registerCPS(parsed);

        if (ok) {
          setStatusMsg('CPS loaded into Plug Phase successfully.');
        } else {
          setErrorMsg('Failed to load CPS into Plug Phase. Check the lifecycle log.');
        }
      } catch {
        setErrorMsg(
          'Invalid JSON or incompatible CPS AAS. Verify assetAdministrationShells, submodels and AssetInterfacesDescription.'
        );
      } finally {
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      setErrorMsg('Could not read the selected file.');
      e.target.value = '';
    };

    reader.readAsText(file);
  };

  const handleDownloadPlugLog = async () => {
    try {
      setIsDownloadingLog(true);
      setStatusMsg('');
      setErrorMsg('');

      const response = await fetch('/api/plug-log/export', {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        let message = 'Failed to download the lifecycle JSON log.';
        try {
          const err = await response.json();
          message = err?.error || err?.details || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');

      let fileName = 'plug-phase-log.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setStatusMsg('Plug Phase JSON lifecycle log downloaded successfully.');
    } catch (error) {
      console.error('Error downloading lifecycle JSON log:', error);
      setErrorMsg(error.message || 'Error downloading the lifecycle JSON log.');
    } finally {
      setIsDownloadingLog(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPdf(true);
      setStatusMsg('');
      setErrorMsg('');

      const response = await fetch('/api/plug-log/export-pdf', {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        let message = 'Failed to download the lifecycle PDF report.';
        try {
          const err = await response.json();
          message = err?.error || err?.details || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');

      let fileName = 'plug-phase-log-report.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setStatusMsg('Plug Phase PDF lifecycle report downloaded successfully.');
    } catch (error) {
      console.error('Error downloading lifecycle PDF report:', error);
      setErrorMsg(error.message || 'Error downloading the lifecycle PDF report.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const cpsNamesInPlay = useMemo(
    () => new Set((addedCPS || []).map((cps) => cps.nome)),
    [addedCPS]
  );

  const cpsByName = useMemo(() => {
    const map = {};
    (availableCPS || []).forEach((cps) => {
      if (cps?.nome) map[cps.nome] = cps;
    });
    return map;
  }, [availableCPS]);

  const toggleUpdates = (name) => {
    setOpenUpdates((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const openIfAvailable = (url, message) => {
    const finalUrl = normalizeUrl(url);
    if (!finalUrl) {
      alert(message || 'Resource not available for this CPS.');
      return;
    }
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="component-container plug-fase plug-asset-phase">
      <div className="plug-asset-header plug-asset-header-top">
        <div className="plug-asset-header-main">
          <h2>Plug Phase</h2>
          <p className="plug-asset-subtitle">
            Asset registration, onboarding and lifecycle evidence for cyber-physical systems.
          </p>
        </div>

        <div className="plug-asset-summary plug-asset-summary-extended">
          <div className="plug-asset-summary-card">
            <span className="plug-asset-summary-label">Registered CPS</span>
            <strong className="plug-asset-summary-value">{availableCPSNames.length}</strong>
          </div>

          <div className="plug-asset-summary-card">
            <span className="plug-asset-summary-label">Operationally linked</span>
            <strong className="plug-asset-summary-value">{addedCPS.length}</strong>
          </div>

          <button
            type="button"
            className={`plug-asset-summary-card plug-asset-summary-card-action ${
              isDownloadingLog ? 'is-loading' : ''
            }`}
            onClick={handleDownloadPlugLog}
            disabled={isDownloadingLog}
            title="Download lifecycle log in JSON format"
          >
            <span className="plug-asset-summary-label">Lifecycle log</span>
            <strong className="plug-asset-summary-action-value">
              {isDownloadingLog ? 'Exporting...' : 'Export JSON'}
            </strong>
          </button>

          <button
            type="button"
            className={`plug-asset-summary-card plug-asset-summary-card-action ${
              isDownloadingPdf ? 'is-loading' : ''
            }`}
            onClick={handleDownloadPDF}
            disabled={isDownloadingPdf}
            title="Download human-readable PDF report"
          >
            <span className="plug-asset-summary-label">Lifecycle report</span>
            <strong className="plug-asset-summary-action-value">
              {isDownloadingPdf ? 'Exporting...' : 'Export PDF'}
            </strong>
          </button>
        </div>
      </div>

      <div className="button-group plug-asset-actions">
        <button type="button" onClick={handlePickFile}>
          Load AAS manually...
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="Select CPS JSON file"
        />
      </div>

      {statusMsg ? (
        <div className="plug-feedback plug-feedback-success" role="status">
          {statusMsg}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="plug-feedback plug-feedback-error" role="alert">
          {errorMsg}
        </div>
      ) : null}

      <div className="plug-asset-section">
        <div className="plug-asset-section-header">
          <h3>Lifecycle registry</h3>
          <span className="plug-asset-section-caption">
            Registered industrial assets and lifecycle evidence
          </span>
        </div>

        {availableCPSNames.length ? (
          <div className="plug-asset-grid">
            {availableCPSNames.map((name) => {
              const inPlay = cpsNamesInPlay.has(name);
              const cps = cpsByName[name] || null;
              const isOpen = !!openUpdates[name];

              const updateMessage = cps?.updates?.lastMessage || '';
              const updateType = cps?.updates?.lastType || '';
              const updateTs = cps?.updates?.lastTs || null;

              const history =
                Array.isArray(cps?.updates?.history) && cps.updates.history.length
                  ? cps.updates.history
                  : updateMessage
                  ? [
                      {
                        id: `${name}-fallback-update`,
                        type: updateType || 'update',
                        title: getEventTitle({
                          type: updateType,
                          title: cps?.updates?.title,
                        }),
                        message: updateMessage,
                        ts: updateTs,
                      },
                    ]
                  : [];

              const lastEvent = history[0] || null;
              const maintenanceInProgress = !!cps?.maintenance?.inProgress;

              const descriptionUrl =
                normalizeUrl(cps?.endpoints?.description) ||
                normalizeUrl(cps?.dashboardUrl) ||
                '';

              const summaryUrl = normalizeUrl(cps?.endpoints?.summary) || '';
              const indicatorsUrl = normalizeUrl(cps?.endpoints?.indicators) || '';
              const historyUrl = normalizeUrl(cps?.endpoints?.history) || '';
              const healthUrl = normalizeUrl(cps?.endpoints?.health) || '';

              const brokerWs = normalizeUrl(cps?.brokerWs) || '';
              const brokerWss = normalizeUrl(cps?.brokerWss) || '';

              const currentPhase = cps?.lifecycle?.currentPhase || '—';
              const supportedPhases = cps?.lifecycle?.supportedPhases || '—';

              const currentTemperature = cps?.operationalData?.currentTemperature ?? '—';
              const currentRPM = cps?.operationalData?.currentRPM ?? '—';
              const currentTorque = cps?.operationalData?.currentTorque ?? '—';
              const pieceCounter = cps?.operationalData?.pieceCounter ?? '—';
              const cycleTimeMs = cps?.operationalData?.cycleTimeMs ?? '—';
              const operationMode = cps?.operationalData?.operationMode ?? '—';

              return (
                <article key={name} className="plug-asset-card">
                  <div className="plug-asset-card-topbar">
                    <div className="plug-asset-card-titleblock">
                      <div className="plug-asset-card-title-row">
                        <h4 className="plug-asset-card-title">{name}</h4>
                        <span
                          className={`plug-asset-state-badge ${getLifecycleBadgeClass({
                            inPlay,
                            maintenanceInProgress,
                          })}`}
                        >
                          {getLifecycleBadgeLabel({
                            inPlay,
                            maintenanceInProgress,
                          })}
                        </span>
                      </div>

                      <div className="plug-asset-card-subline">
                        {cps?.id ? <span>CPS ID: {cps.id}</span> : null}
                        {cps?.topic ? <span>MQTT Topic: {cps.topic}</span> : null}
                        {cps?.server ? <span>Broker: {cps.server}</span> : null}
                      </div>
                    </div>

                    <div className="plug-asset-card-actions">
                      {inPlay ? (
                        <button
                          className="exit-btn"
                          onClick={() => unplugCPS(name)}
                          title={`Remove ${name} from Play Phase and architecture`}
                        >
                          Unplug
                        </button>
                      ) : (
                        <button
                          className="start-ops-btn"
                          onClick={() => addCPS(name)}
                          title={`Move ${name} to Play Phase and start operations`}
                        >
                          Play
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="plug-asset-card-body">
                    <div className="plug-asset-left">
                      <div className="plug-asset-description-box">
                        <div className="plug-asset-box-title">Asset description</div>
                        <p className="plug-asset-description">
                          {cps?.descricao || 'No description available for this CPS.'}
                        </p>
                      </div>

                      <div className="plug-asset-condition-grid">
                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Current operational condition</span>
                          <strong className="plug-asset-info-value">
                            {maintenanceInProgress
                              ? 'Maintenance in progress'
                              : inPlay
                              ? 'Integrated into Play Phase'
                              : 'Available for onboarding'}
                          </strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Maintenance status</span>
                          <strong className="plug-asset-info-value">
                            {maintenanceInProgress ? 'Active maintenance' : 'No active maintenance'}
                          </strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Recorded maintenance events</span>
                          <strong className="plug-asset-info-value">{history.length}</strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Last recorded update</span>
                          <strong className="plug-asset-info-value">
                            {lastEvent ? formatEventDate(lastEvent.ts) : '—'}
                          </strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Current lifecycle phase</span>
                          <strong className="plug-asset-info-value">{currentPhase}</strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Supported phases</span>
                          <strong className="plug-asset-info-value">{supportedPhases}</strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Operation mode</span>
                          <strong className="plug-asset-info-value">{operationMode}</strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Piece counter</span>
                          <strong className="plug-asset-info-value">{pieceCounter}</strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Cycle time</span>
                          <strong className="plug-asset-info-value">{cycleTimeMs} ms</strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Temperature</span>
                          <strong className="plug-asset-info-value">{currentTemperature}</strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">RPM</span>
                          <strong className="plug-asset-info-value">{currentRPM}</strong>
                        </div>

                        <div className="plug-asset-info-box">
                          <span className="plug-asset-info-label">Torque</span>
                          <strong className="plug-asset-info-value">{currentTorque}</strong>
                        </div>
                      </div>

                      <div className="plug-asset-description-box" style={{ marginTop: 16 }}>
                        <div className="plug-asset-box-title">AAS integration endpoints</div>

                        <div className="plug-asset-card-subline" style={{ marginBottom: 10 }}>
                          {descriptionUrl ? <span>Description: {descriptionUrl}</span> : null}
                          {summaryUrl ? <span>Summary: {summaryUrl}</span> : null}
                          {indicatorsUrl ? <span>Indicators: {indicatorsUrl}</span> : null}
                          {historyUrl ? <span>History: {historyUrl}</span> : null}
                          {healthUrl ? <span>Health: {healthUrl}</span> : null}
                        </div>

                        <div className="plug-asset-card-actions">
                          <button
                            type="button"
                            className="start-ops-btn"
                            disabled={!descriptionUrl}
                            onClick={() =>
                              openIfAvailable(
                                descriptionUrl,
                                'No DescriptionEndpoint or DashboardURL found in the AAS.'
                              )
                            }
                            title={
                              descriptionUrl
                                ? `Open description endpoint: ${descriptionUrl}`
                                : 'Description endpoint not available'
                            }
                          >
                            Description
                          </button>

                          <button
                            type="button"
                            className="start-ops-btn"
                            disabled={!summaryUrl}
                            onClick={() =>
                              openIfAvailable(
                                summaryUrl,
                                'No SummaryEndpoint found in the AAS.'
                              )
                            }
                            title={
                              summaryUrl
                                ? `Open summary endpoint: ${summaryUrl}`
                                : 'Summary endpoint not available'
                            }
                          >
                            Summary
                          </button>

                          <button
                            type="button"
                            className="start-ops-btn"
                            disabled={!indicatorsUrl}
                            onClick={() =>
                              openIfAvailable(
                                indicatorsUrl,
                                'No IndicatorsEndpoint found in the AAS.'
                              )
                            }
                            title={
                              indicatorsUrl
                                ? `Open indicators endpoint: ${indicatorsUrl}`
                                : 'Indicators endpoint not available'
                            }
                          >
                            Indicators
                          </button>

                          <button
                            type="button"
                            className="start-ops-btn"
                            disabled={!historyUrl}
                            onClick={() =>
                              openIfAvailable(
                                historyUrl,
                                'No HistoryEndpoint found in the AAS.'
                              )
                            }
                            title={
                              historyUrl
                                ? `Open history endpoint: ${historyUrl}`
                                : 'History endpoint not available'
                            }
                          >
                            History
                          </button>

                          <button
                            type="button"
                            className="start-ops-btn"
                            disabled={!healthUrl}
                            onClick={() =>
                              openIfAvailable(
                                healthUrl,
                                'No HealthEndpoint found in the AAS.'
                              )
                            }
                            title={
                              healthUrl
                                ? `Open health endpoint: ${healthUrl}`
                                : 'Health endpoint not available'
                            }
                          >
                            Health API
                          </button>
                        </div>
                      </div>

                      <div className="plug-asset-description-box" style={{ marginTop: 16 }}>
                        <div className="plug-asset-box-title">Communication interfaces</div>

                        <div className="plug-asset-card-subline" style={{ marginBottom: 10 }}>
                          {brokerWs ? <span>MQTT WS: {brokerWs}</span> : null}
                          {brokerWss ? <span>MQTT WSS: {brokerWss}</span> : null}
                        </div>

                        <div className="plug-asset-card-actions">
                          <button
                            type="button"
                            className="start-ops-btn"
                            disabled={!brokerWs}
                            onClick={() =>
                              openIfAvailable(
                                brokerWs,
                                'No MQTT WebSocket endpoint found in the AAS.'
                              )
                            }
                            title={brokerWs ? brokerWs : 'MQTT WS not available'}
                          >
                            MQTT WS
                          </button>

                          <button
                            type="button"
                            className="start-ops-btn"
                            disabled={!brokerWss}
                            onClick={() =>
                              openIfAvailable(
                                brokerWss,
                                'No secure MQTT WebSocket endpoint found in the AAS.'
                              )
                            }
                            title={brokerWss ? brokerWss : 'MQTT WSS not available'}
                          >
                            MQTT WSS
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="plug-asset-right">
                      <div className="plug-asset-evidence-panel">
                        <div className="plug-asset-evidence-header">
                          <div>
                            <div className="plug-asset-evidence-title">Lifecycle evidence</div>
                            <div className="plug-asset-evidence-subtitle">
                              State transitions and maintenance event trace
                            </div>
                          </div>

                          <button
                            type="button"
                            className="plug-toggle-updates-btn"
                            onClick={() => toggleUpdates(name)}
                          >
                            {isOpen ? 'Hide log' : 'Show log'}
                            <span className="plug-toggle-counter">{history.length}</span>
                          </button>
                        </div>

                        {lastEvent ? (
                          <div className="plug-asset-last-event">
                            <div
                              className={`plug-asset-last-event-marker ${getEventVariantClass(
                                lastEvent.type
                              )}`}
                            />
                            <div className="plug-asset-last-event-content">
                              <div className="plug-asset-last-event-label">
                                Latest recorded event
                              </div>
                              <div className="plug-asset-last-event-title">
                                {getEventTitle(lastEvent)}
                              </div>
                              <div className="plug-asset-last-event-message">
                                {lastEvent.message || 'No message available.'}
                              </div>
                              <div className="plug-asset-last-event-time">
                                {formatEventDate(lastEvent.ts)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="plug-empty-log">
                            No maintenance or lifecycle events recorded yet for this CPS.
                          </div>
                        )}

                        {isOpen && history.length ? (
                          <div className="plug-asset-timeline">
                            {history.map((entry, index) => (
                              <div
                                key={entry.id || `${name}-event-${index}`}
                                className="plug-asset-timeline-item"
                              >
                                <div
                                  className={`plug-asset-timeline-dot ${getEventVariantClass(
                                    entry.type
                                  )}`}
                                />
                                <div className="plug-asset-timeline-body">
                                  <div className="plug-asset-timeline-title">
                                    {getEventTitle(entry)}
                                  </div>
                                  <div className="plug-asset-timeline-message">
                                    {entry.message || 'No message available.'}
                                  </div>
                                  <div className="plug-asset-timeline-time">
                                    {formatEventDate(entry.ts)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="plug-empty-state">
            No CPS currently registered in Plug Phase.
          </div>
        )}
      </div>
    </div>
  );
};

export default PlugFase;