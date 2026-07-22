'use client';

import { useEffect, useMemo, useState } from 'react';
import { getProfessionalClientDetail } from '../lib/professionals';

const mealLabels = { breakfast: 'Desayuno', lunch: 'Almuerzo', snack: 'Merienda', dinner: 'Cena' };
const permissionLabels = { diary: 'Diario', weight: 'Peso', goals: 'Objetivos', photos: 'Fotos' };
const rangeOptions = [[7, '7 días'], [30, '30 días'], [90, '3 meses'], [365, '12 meses']];

function number(value, digits = 0) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(Number(value || 0));
}

function WeightChart({ entries, target }) {
  if (!entries?.length) return <div className="detail-empty">Todavía no hay registros de peso en este período.</div>;
  const width = 720;
  const height = 210;
  const padding = 30;
  const values = [...entries.map((entry) => entry.weightKg), target].filter(Number.isFinite);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const x = (index) => padding + (index * (width - padding * 2)) / Math.max(entries.length - 1, 1);
  const y = (value) => padding + ((max - value) * (height - padding * 2)) / (max - min);
  const points = entries.map((entry, index) => `${x(index)},${y(entry.weightKg)}`).join(' ');
  return <div className="weight-chart-wrap">
    <svg className="weight-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución del peso">
      {[0, 1, 2].map((step) => {
        const value = max - ((max - min) * step) / 2;
        return <g key={step}><line x1={padding} x2={width - padding} y1={y(value)} y2={y(value)} className="chart-grid"/><text x="0" y={y(value) + 4}>{number(value, 1)}</text></g>;
      })}
      {Number.isFinite(target) && <line x1={padding} x2={width - padding} y1={y(target)} y2={y(target)} className="chart-target"/>}
      <polyline points={points} className="chart-line"/>
      {entries.map((entry, index) => <circle key={entry.measuredOn} cx={x(index)} cy={y(entry.weightKg)} r="5" className="chart-point"><title>{entry.measuredOn}: {entry.weightKg} kg</title></circle>)}
    </svg>
    <div className="chart-caption"><span>{new Date(`${entries[0].measuredOn}T12:00:00`).toLocaleDateString('es-AR')}</span><span>{new Date(`${entries.at(-1).measuredOn}T12:00:00`).toLocaleDateString('es-AR')}</span></div>
  </div>;
}

function LockedCard({ title, text }) {
  return <div className="locked-card"><span>◇</span><div><b>{title}</b><p>{text}</p></div></div>;
}

export default function ClientDetailView({ client, revision, onBack }) {
  const [days, setDays] = useState(30);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    getProfessionalClientDetail(client.clientId, days)
      .then((next) => { if (!cancelled) { setDetail(next); setError(''); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'No pudimos actualizar el cliente.'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [client.clientId, days, revision, retry]);

  useEffect(() => {
    const timer = window.setInterval(() => setRetry((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const todayMeals = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return (detail?.meals ?? []).filter((meal) => new Date(meal.eatenAt).toLocaleDateString('en-CA') === today);
  }, [detail]);
  const totals = useMemo(() => todayMeals.reduce((sum, meal) => ({
    calories: sum.calories + meal.calories,
    protein: sum.protein + meal.proteinG,
    carbs: sum.carbs + meal.carbsG,
    fat: sum.fat + meal.fatG,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [todayMeals]);
  const goals = detail?.goals;
  const permissions = detail?.permissions ?? client.permissions;
  const currentWeight = detail?.weights?.at(-1)?.weightKg ?? goals?.currentWeightKg ?? client.currentWeightKg;
  const start = Number(goals?.startingWeightKg);
  const target = Number(goals?.targetWeightKg);
  const current = Number(currentWeight);
  const progress = Number.isFinite(start) && Number.isFinite(target) && Number.isFinite(current) && start !== target
    ? Math.max(0, Math.min(100, ((start - current) / (start - target)) * 100)) : 0;

  return <div className="client-detail">
    <button className="back-link" type="button" onClick={onBack}>← Volver a clientes</button>
    <section className="client-hero">
      <div className="client-avatar large">{client.displayName.charAt(0).toUpperCase()}</div>
      <div><p className="eyebrow">Seguimiento individual</p><h2>{client.displayName}</h2><p>Conectado desde {new Date(client.startedAt).toLocaleDateString('es-AR')}</p></div>
      <div className="permission-pills">{Object.entries(client.permissions).map(([key, enabled]) => <span className={enabled ? 'enabled' : ''} key={key}>{enabled ? '✓' : '–'} {permissionLabels[key]}</span>)}</div>
    </section>
    {error && <div className="notice error dashboard-notice detail-error"><span>No pudimos actualizar el detalle. {error}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>}
    {busy && !detail ? <div className="content-loader"><span className="loader dark"/>Actualizando datos…</div> : <>
      <div className="detail-kpis">
        <article><span>Peso actual</span><strong>{Number.isFinite(current) ? `${number(current, 1)} kg` : '—'}</strong><small>{permissions.weight ? 'Último registro compartido' : 'Sin permiso de peso'}</small></article>
        <article><span>Progreso del objetivo</span><strong>{goals ? `${number(progress)}%` : '—'}</strong><small>{Number.isFinite(target) ? `Objetivo ${number(target, 1)} kg` : 'Sin objetivo visible'}</small></article>
        <article><span>Consumo de hoy</span><strong>{permissions.diary && detail ? `${number(totals.calories)} kcal` : '—'}</strong><small>{permissions.diary ? `${todayMeals.length} comidas registradas` : 'Sin permiso de diario'}</small></article>
        <article><span>Última sincronización</span><strong className={detail ? 'live-value' : 'pending-value'}>{detail && <i/>} {detail ? 'En vivo' : 'Pendiente'}</strong><small>{detail?.generatedAt ? new Date(detail.generatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Esperando detalle'}</small></article>
      </div>

      <div className="detail-grid">
        <section className="panel detail-chart-panel">
          <div className="panel-heading"><div><h3>Evolución del peso</h3><p>Historial autorizado por la persona</p></div><div className="range-tabs">{rangeOptions.map(([value, label]) => <button className={days === value ? 'active' : ''} key={value} onClick={() => setDays(value)}>{label}</button>)}</div></div>
          {permissions.weight ? <WeightChart entries={detail?.weights ?? []} target={target}/> : <LockedCard title="Peso no compartido" text="La persona puede habilitar este permiso desde Calorfy."/>}
        </section>

        <section className="panel macro-panel">
          <div className="panel-heading"><div><h3>Balance de hoy</h3><p>Consumo frente al plan visible</p></div></div>
          {permissions.diary ? <>
            <div className="calorie-progress"><div><strong>{number(totals.calories)}</strong><span> / {goals?.calorieGoal ? number(goals.calorieGoal) : '—'} kcal</span></div><div className="progress-track"><i style={{ width: `${Math.min(100, goals?.calorieGoal ? (totals.calories / goals.calorieGoal) * 100 : 0)}%` }}/></div></div>
            <div className="macro-grid"><div><b>{number(totals.protein)} g</b><span>Proteínas</span><small>{goals?.proteinGoalG ? `meta ${number(goals.proteinGoalG)} g` : ''}</small></div><div><b>{number(totals.carbs)} g</b><span>Carbohidratos</span><small>{goals?.carbsGoalG ? `meta ${number(goals.carbsGoalG)} g` : ''}</small></div><div><b>{number(totals.fat)} g</b><span>Grasas</span><small>{goals?.fatGoalG ? `meta ${number(goals.fatGoalG)} g` : ''}</small></div></div>
          </> : <LockedCard title="Diario no compartido" text="No se muestran comidas ni totales nutricionales."/>}
        </section>
      </div>

      <section className="panel meals-panel">
        <div className="panel-heading"><div><h3>Comidas de hoy</h3><p>Información actualizada desde la app de la persona</p></div>{detail ? <span className="live-badge"><i/> Sincronizado</span> : <span className="live-badge pending">Pendiente</span>}</div>
        {permissions.diary ? todayMeals.length ? <div className="pro-meal-list">{todayMeals.map((meal) => <article key={meal.id}><div className="meal-time"><b>{mealLabels[meal.category] ?? 'Comida'}</b><small>{new Date(meal.eatenAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</small></div><div><b>{meal.name}</b><small>P {number(meal.proteinG)} g · C {number(meal.carbsG)} g · G {number(meal.fatG)} g</small></div><strong>{number(meal.calories)} kcal</strong></article>)}</div> : <div className="detail-empty">{detail ? 'Todavía no registró comidas hoy.' : 'Esperando la primera sincronización del detalle.'}</div> : <LockedCard title="Diario no compartido" text="La lista aparecerá cuando la persona habilite el acceso."/>}
      </section>
    </>}
  </div>;
}
