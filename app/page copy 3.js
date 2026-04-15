'use client';

import Link from 'next/link';
import MainComponent from '../components/MainComponent';

export default function Home() {
  return (
    <div className="home-shell">
      <section className="premium-hero">
        <div className="premium-hero-bg" />

        <div className="premium-hero-content">
          <div className="premium-hero-left">
            <div className="premium-chip-row">
              <span className="premium-chip">ACSM Platform</span>
              <span className="premium-chip premium-chip-soft">Cognitive Coordination</span>
              <span className="premium-chip premium-chip-soft">Industry 4.0</span>
            </div>

            <h1 className="premium-title">
              Advanced Coordination for
              <span> CPS-Based Manufacturing Systems</span>
            </h1>

            <p className="premium-subtitle">
              Visualize the cognitive layer of the ACSM with global OEE,
              bottleneck detection, critical CPS identification, predicted risk,
              recommendations and explainable system-level reasoning.
            </p>

            <div className="premium-actions">
              <Link href="/acsm-intelligence" className="premium-btn premium-btn-primary">
                Open Intelligence Center
              </Link>

              <a href="#main-platform" className="premium-btn premium-btn-secondary">
                Go to Main Platform
              </a>
            </div>
          </div>

          <div className="premium-hero-right">
            <div className="premium-panel premium-panel-main">
              <div className="premium-panel-label">Operational Focus</div>
              <div className="premium-panel-title">ACSM Intelligence Center</div>
              <div className="premium-panel-text">
                Executive view of system coordination with integrated reasoning,
                learning and synthesized recommendations for the manufacturing cell.
              </div>

              <div className="premium-mini-grid">
                <div className="premium-mini-card">
                  <span className="premium-mini-label">Module</span>
                  <strong>Global OEE</strong>
                </div>

                <div className="premium-mini-card">
                  <span className="premium-mini-label">Module</span>
                  <strong>Critical CPS</strong>
                </div>

                <div className="premium-mini-card">
                  <span className="premium-mini-label">Module</span>
                  <strong>Bottleneck</strong>
                </div>

                <div className="premium-mini-card">
                  <span className="premium-mini-label">Module</span>
                  <strong>Predicted Risk</strong>
                </div>
              </div>
            </div>

            <div className="premium-kpi-row">
              <div className="premium-kpi-card">
                <span className="premium-kpi-label">Architecture</span>
                <strong>Meta-Orchestrator</strong>
              </div>

              <div className="premium-kpi-card">
                <span className="premium-kpi-label">Core Capability</span>
                <strong>Reasoning + Learning</strong>
              </div>

              <div className="premium-kpi-card">
                <span className="premium-kpi-label">Output</span>
                <strong>Explainable Coordination</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="premium-access-strip">
        <div className="premium-access-card">
          <div>
            <h3>Intelligence Access</h3>
            <p>
              Open the ACSM intelligence layer to inspect OEE, bottleneck,
              systemic loss, learned pattern and coordination recommendation.
            </p>
          </div>

          <Link href="/acsm-intelligence" className="premium-strip-btn">
            Enter Intelligence Center →
          </Link>
        </div>
      </section>

      <div id="main-platform">
        <MainComponent />
      </div>
    </div>
  );
}