'use client';

import React, { useEffect, useState } from 'react';
import { normalizeCpsId } from '../lib/acsm/config';

export default function CPSDescription({ cps }) {

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const cpsId = normalizeCpsId(cps?.id);
  const API =
    cps?.endpoints?.description ||
    (cpsId ? `http://localhost:1880/api/${cpsId}/discovery` : null);

  useEffect(() => {
    if (!API) {
      setLoading(false);
      return undefined;
    }

    async function load() {
      try {

        const res = await fetch(API);
        const json = await res.json();

        setData(json);
        setLoading(false);

      } catch (err) {
        console.error("Error loading CPS", err);
      }
    }

    load();

    const timer = setInterval(load, 5000);

    return () => clearInterval(timer);

  }, [API]);

  if (loading) return <div>Loading CPS...</div>;
  if (!data) return <div>Description endpoint unavailable for this CPS.</div>;

  const runtime = data.runtime || {};
  const docs = data.documentation || {};

  return (

    <div style={{
      padding: 20,
      background: "#f3f6fa"
    }}>

      <h2>{data.cpsName} — Description</h2>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20
      }}>

        {/* DOCUMENTATION */}

        <div style={{
          background: "white",
          padding: 20,
          borderRadius: 8
        }}>

          <h3>Asset Documentation</h3>

          <p><b>CPS ID:</b> {data.cpsId}</p>
          <p><b>Tipo:</b> {data.assetType}</p>
          <p><b>Fabricante:</b> {data.manufacturer}</p>
          <p><b>ECLASS:</b> {data.eclass}</p>
          <p><b>Feature:</b> {data.feature}</p>

          <hr/>

          <a
            href={`http://localhost:1880${docs?.datasheet?.publicUrl}`}
            target="_blank"
          >
            Open Datasheet
          </a>

          <br/><br/>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`http://localhost:1880${docs?.thumbnail?.publicUrl}`}
            alt={`Thumbnail do ${data.cpsName || data.cpsId || 'CPS'}`}
            style={{ width: "100%" }}
          />

        </div>

        {/* STATUS OPERACIONAL */}

        <div style={{
          background: "white",
          padding: 20,
          borderRadius: 8
        }}>

          <h3>Status Operacional</h3>

          <p><b>Status:</b> {runtime.status?.status}</p>
          <p><b>Modo:</b> {runtime.status?.mode}</p>

          <hr/>

          <h4>Health</h4>

          <p>Score: {runtime.health?.healthScore}</p>
          <p>Label: {runtime.health?.healthLabel}</p>

          <hr/>

          <h4>OEE</h4>

          <p>Availability: {(runtime.oee?.availability * 100).toFixed(1)}%</p>
          <p>Performance: {(runtime.oee?.performance * 100).toFixed(1)}%</p>
          <p>Quality: {(runtime.oee?.quality * 100).toFixed(1)}%</p>
          <p><b>OEE:</b> {(runtime.oee?.oee * 100).toFixed(1)}%</p>

        </div>

      </div>

    </div>
  );
}
