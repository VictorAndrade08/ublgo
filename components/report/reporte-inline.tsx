import React from 'react';
import { PropertyData, AvaluoResult } from '../../types';
import { fmtUSD, fmtNum, plural, generateMockResult } from '../../lib/api';


interface ReporteInlineProps {
  data: PropertyData;
  result: AvaluoResult;
  reportId: string;
}

export default function ReporteInline({ data, result, reportId }: ReporteInlineProps) {
  const dateStr = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });

  const chartData = (() => {
    const points = result.trend && result.trend.length > 0 ? result.trend : generateMockResult(data).trend;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const xStart = 60, xEnd = 555, yTop = 20, yBottom = 110;

    const coords = points.map((val, i) => ({
      x: Math.round(xStart + (i / (points.length - 1)) * (xEnd - xStart)),
      y: Math.round(yBottom - ((val - min) / range) * (yBottom - yTop)),
      val,
    }));

    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x},${c.y}`).join(' ');
    const area = `${line} L ${xEnd},120 L ${xStart},120 Z`;
    const dotIndices = [0, 3, 6, 9, 11];
    const dots = dotIndices.map(i => coords[i]).filter(Boolean);
    const yAxis = [max, Math.round((max + min) / 2), min];

    return { line, area, dots, yAxis };
  })();

  const monthLabels = (() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const labels: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(`${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`);
    }
    return [labels[0], labels[3], labels[6], labels[9], labels[11]];
  })();

  const growthPct = result.trend && result.trend.length >= 2
    ? (((result.trend[result.trend.length - 1] - result.trend[0]) / result.trend[0]) * 100).toFixed(1)
    : '9.4';

  return (
    <div className="relative w-full mx-auto">
      <style>{`
        .pdf-page { background: white; width: 100%; max-width: 680px; margin: 0 auto; border: 0.5px solid #EEEEEE; border-radius: 12px; overflow: hidden; font-family: system-ui, sans-serif; color: #1e293b; }
        .pdf-hdr { background: #0f172a; color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
        .pdf-logo { display: flex; align-items: center; gap: 10px; }
        .pdf-logo-mark { width: 32px; height: 32px; background: #0f172a; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        .pdf-brand { font-size: 15px; font-weight: 500; letter-spacing: 0.02em; }
        .pdf-brand-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
        .pdf-meta { font-size: 11px; color: #94a3b8; text-align: right; }
        .pdf-body { padding: 32px; }
        .pdf-section { margin-bottom: 32px; }
        .pdf-eyebrow { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px; }
        .pdf-h1 { font-size: 22px; font-weight: 500; margin: 0 0 6px; letter-spacing: -0.01em; color: #0f172a; }
        .pdf-h2 { font-size: 18px; font-weight: 600; margin: 0 0 16px; color: #0f172a; display: flex; align-items: center; gap: 10px; letter-spacing: -0.01em; }
        .pdf-h2::before { content: ""; width: 4px; height: 20px; background: #1a56db; border-radius: 4px; }
        .pdf-prop-card { background: #f0f4fa; border-left: 3px solid #1a56db; padding: 18px 20px; border-radius: 0 8px 8px 0; margin-bottom: 8px; }
        .pdf-addr { font-size: 13px; color: #1e3a8a; margin: 0 0 4px; font-weight: 500; }
        .pdf-specs { font-size: 12px; color: #3b82f6; margin: 0; }
        .pdf-value-block { text-align: center; padding: 24px; background: #f8fafc; border-radius: 10px; border: 0.5px solid #e2e8f0; margin-bottom: 16px; }
        .pdf-value-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px; }
        .pdf-value-big { font-size: 38px; font-weight: 500; margin: 0; letter-spacing: -0.02em; color: #0f172a; }
        .pdf-value-range { font-size: 12px; color: #64748b; margin: 6px 0 0; }
        .pdf-confidence { display: inline-flex; align-items: center; gap: 6px; background: #ecfdf5; color: #10b981; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; margin-top: 10px; }
        .pdf-conf-dot { width: 6px; height: 6px; background: #34d399; border-radius: 50%; }
        .pdf-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
        .pdf-stat { background: #f8fafc; padding: 14px 12px; border-radius: 8px; text-align: center; border: 0.5px solid #e2e8f0; }
        .pdf-stat-num { font-size: 18px; font-weight: 500; color: #0f172a; margin: 0; }
        .pdf-stat-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 4px 0 0; }
        .pdf-comp-row { display: grid; grid-template-columns: 36px 1fr 90px 90px; gap: 16px; align-items: center; padding: 20px 0; border-bottom: 1px solid #f1f5f9; }
        .pdf-comp-row:last-child { border-bottom: none; }
        .pdf-comp-num { width: 36px; height: 36px; background: #e0e7ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: #1a56db; }
        .pdf-comp-addr { display: block; margin: 0 0 6px; font-size: 15px; font-weight: 600; color: #0f172a; text-decoration: none; transition: color 0.2s; }
        .pdf-comp-addr:hover { color: #1a56db; text-decoration: underline; }
        .pdf-comp-meta { margin: 0; font-size: 13px; color: #64748b; }
        .pdf-comp-m2 { font-size: 13px; color: #475569; text-align: right; line-height: 1.5; }
        .pdf-comp-price { font-size: 18px; font-weight: 600; color: #0f172a; text-align: right; letter-spacing: -0.01em; }
        .pdf-chart { position: relative; height: 140px; margin-top: 16px; }
        .pdf-chart svg { width: 100%; height: 100%; display: block; }
        .pdf-chart-axis { font-size: 9px; fill: #64748b; }
        .pdf-chart-line { fill: none; stroke: #1a56db; stroke-width: 2; }
        .pdf-chart-area { fill: #1a56db; fill-opacity: 0.08; }
        .pdf-chart-dot { fill: #1a56db; stroke: white; stroke-width: 1.5; }
        .pdf-grid-line { stroke: #f1f5f9; stroke-width: 1; }
        .pdf-cta { background: #0f172a; color: white; padding: 24px 28px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 8px; }
        .pdf-cta-text { flex: 1; }
        .pdf-cta-title { font-size: 15px; font-weight: 500; margin: 0 0 4px; color: white; }
        .pdf-cta-sub { font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.5; }
        .pdf-cta-btn { background: #1a56db; color: white; padding: 11px 20px; border-radius: 6px; font-size: 12px; font-weight: 500; white-space: nowrap; border: none; cursor: pointer; font-family: inherit; transition: opacity 0.2s; }
        .pdf-cta-btn:hover { opacity: 0.9; }
        .pdf-foot { padding: 18px 32px; background: #f8fafc; border-top: 0.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #64748b; }
        .pdf-disclaimer { font-size: 10px; color: #64748b; line-height: 1.6; margin-top: 16px; padding: 12px 14px; background: #f8fafc; border-radius: 6px; border-left: 2px solid #cbd5e1; }
        .pdf-method { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 8px; }
        .pdf-method-item { padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 0.5px solid #e2e8f0; }
        .pdf-method-pct { font-size: 13px; font-weight: 500; color: #1a56db; margin: 0; }
        .pdf-method-lbl { font-size: 11px; color: #0f172a; margin: 2px 0 0; font-weight: 500; }
        .pdf-method-desc { font-size: 10px; color: #64748b; margin: 3px 0 0; line-height: 1.5; }
        .pdf-page-num { font-size: 9px; color: #94a3b8; }
      `}</style>

      <div className="pdf-page shadow-sm">
        <div className="pdf-hdr">
          <div className="pdf-logo">
            <div className="pdf-logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" aria-hidden="true">
                <path d="M3 12 L12 3 L21 12 M5 10 V21 H19 V10" />
              </svg>
            </div>
            <div>
              <p className="pdf-brand" style={{ margin: 0 }}>Un Buen Lugar</p>
              <p className="pdf-brand-sub" style={{ margin: 0 }}>Reporte de avalúo IA</p>
            </div>
          </div>
          <div className="pdf-meta">
            <p style={{ margin: 0 }}>Generado el {dateStr}</p>
            <p style={{ margin: '2px 0 0' }}>ID: {reportId}</p>
          </div>
        </div>

        <div className="pdf-body">
          <section className="pdf-section">
            <p className="pdf-eyebrow">Reporte preparado para</p>
            <h1 className="pdf-h1">{data.name || 'Usuario'}</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              {data.email || 'correo@ejemplo.com'} · {data.city}, Ecuador
            </p>
          </section>

          <section className="pdf-section">
            <h2 className="pdf-h2">Tu propiedad</h2>
            <div className="pdf-prop-card">
              <p className="pdf-addr">{data.type} en {data.sector || 'Sector'}, {data.city}</p>
              <p className="pdf-specs">
                {data.area} m² · {plural(data.rooms, 'habitación', 'habitaciones')} · {plural(data.baths, 'baño', 'baños')} · {plural(data.parking, 'parqueadero', 'parqueaderos')} · estado: {data.condition}
              </p>
            </div>
          </section>

          <section className="pdf-section">
            <h2 className="pdf-h2">Valor estimado de mercado</h2>
            <div className="pdf-value-block">
              <p className="pdf-value-label">Valor comercial estimado</p>
              <p className="pdf-value-big">{fmtUSD(result.value)}</p>
              <p className="pdf-value-range">Rango: {fmtUSD(result.rangeLow)} – {fmtUSD(result.rangeHigh)}</p>
              <span className="pdf-confidence">
                <span className="pdf-conf-dot"></span>Nivel de confianza {result.confidence}%
              </span>
            </div>
            <div className="pdf-stats">
              <div className="pdf-stat">
                <p className="pdf-stat-num">{fmtUSD(result.pricePerM2)}</p>
                <p className="pdf-stat-lbl">Por m²</p>
              </div>
              <div className="pdf-stat">
                <p className="pdf-stat-num">+8.2%</p>
                <p className="pdf-stat-lbl">vs avalúo catastral</p>
              </div>
              <div className="pdf-stat">
                <p className="pdf-stat-num">{result.daysOnMarket} días</p>
                <p className="pdf-stat-lbl">Tiempo medio de venta</p>
              </div>
            </div>
          </section>

          <section className="pdf-section">
            <h2 className="pdf-h2">Comparables en tu zona</h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px' }}>
              {result.comparables.length} propiedades similares vendidas o publicadas en los últimos 90 días, en un radio de 800 m.
            </p>
            {result.comparables.map((comp, index) => (
              <article key={comp.id} className="pdf-comp-row">
                <div className="pdf-comp-num" aria-hidden="true">{index + 1}</div>
                <div>
                  <a href={comp.url || '#'} target="_blank" rel="noopener noreferrer" className="pdf-comp-addr">
                    {comp.address}
                  </a>
                  <p className="pdf-comp-meta">
                    {comp.rooms} hab · {plural(comp.baths, 'baño', 'baños')} · a {comp.distance} m
                  </p>
                </div>
                <p className="pdf-comp-m2">
                  {comp.area} m²<br />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{fmtUSD(comp.pricePerM2)}/m²</span>
                </p>
                <p className="pdf-comp-price">{fmtUSD(comp.price)}</p>
              </article>
            ))}
          </section>

          <section className="pdf-section">
            <h2 className="pdf-h2">Tendencia del barrio · últimos 12 meses</h2>
            <div className="pdf-chart" role="img" aria-label={`Precio por m² creció ${growthPct}% en 12 meses`}>
              <svg viewBox="0 0 600 140" preserveAspectRatio="none">
                <line x1="40" y1="20" x2="600" y2="20" className="pdf-grid-line" />
                <line x1="40" y1="60" x2="600" y2="60" className="pdf-grid-line" />
                <line x1="40" y1="100" x2="600" y2="100" className="pdf-grid-line" />

                <text x="35" y="24" textAnchor="end" className="pdf-chart-axis">{fmtUSD(chartData.yAxis[0])}</text>
                <text x="35" y="64" textAnchor="end" className="pdf-chart-axis">{fmtUSD(chartData.yAxis[1])}</text>
                <text x="35" y="104" textAnchor="end" className="pdf-chart-axis">{fmtUSD(chartData.yAxis[2])}</text>

                <path className="pdf-chart-area" d={chartData.area} />
                <path className="pdf-chart-line" d={chartData.line} />

                {chartData.dots.map((dot, i) => (
                  <circle key={i} cx={dot.x} cy={dot.y} r={i === chartData.dots.length - 1 ? 4 : 3} className="pdf-chart-dot" />
                ))}

                {monthLabels.map((label, i) => {
                  const positions = [60, 195, 330, 465, 555];
                  return (
                    <text key={i} x={positions[i]} y="135" textAnchor="middle" className="pdf-chart-axis">
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '16px 0 0' }}>
              El precio por m² en {data.sector || 'el sector'} creció{' '}
              <strong style={{ color: '#10b981', fontWeight: 500 }}>+{growthPct}%</strong>{' '}
              en los últimos 12 meses.
            </p>
          </section>

          <section className="pdf-section">
            <h2 className="pdf-h2">Cómo calculamos tu avalúo</h2>
            <div className="pdf-method">
              <div className="pdf-method-item">
                <p className="pdf-method-pct">60%</p>
                <p className="pdf-method-lbl">Análisis Multimodal con IA</p>
                <p className="pdf-method-desc">Procesamiento de imágenes y contexto espacial en tiempo real.</p>
              </div>
              <div className="pdf-method-item">
                <p className="pdf-method-pct">25%</p>
                <p className="pdf-method-lbl">Comparables reales</p>
                <p className="pdf-method-desc">Propiedades vendidas y publicadas en tu zona los últimos 90 días.</p>
              </div>
              <div className="pdf-method-item">
                <p className="pdf-method-pct">15%</p>
                <p className="pdf-method-lbl">Análisis hedónico</p>
                <p className="pdf-method-desc">Validación estadística que detecta y corrige outliers.</p>
              </div>
            </div>
          </section>

          <section className="pdf-section">
            <div className="pdf-cta">
              <div className="pdf-cta-text">
                <p className="pdf-cta-title">¿Listo para vender al precio justo?</p>
                <p className="pdf-cta-sub">Publica tu propiedad en Un Buen Lugar y conecta con compradores reales en menos de 60 días.</p>
              </div>
              <button type="button" className="pdf-cta-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Publicar ahora →
              </button>
            </div>
          </section>

          <div className="pdf-disclaimer">
            <strong style={{ color: '#64748b', fontWeight: 500 }}>Disclaimer:</strong>{' '}
            Este reporte es una estimación referencial generada por algoritmos de inteligencia artificial sobre datos públicos del mercado inmobiliario ecuatoriano. No reemplaza un avalúo certificado por un perito acreditado por la Superintendencia de Bancos y Seguros, requerido para trámites bancarios o legales. Un Buen Lugar S.A. no se responsabiliza por decisiones de compra-venta basadas únicamente en este reporte.
          </div>
        </div>

        <div className="pdf-foot">
          <span>unbuenlugar.com · contacto@unbuenlugar.com</span>
          <span className="pdf-page-num">Página 1 de 1</span>
        </div>
      </div>
    </div>
  );
}