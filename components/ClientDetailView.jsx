'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createProfessionalClientNote,
  deleteProfessionalClientNote,
  getProfessionalClientDetail,
  getProfessionalClientWorkspace,
  saveProfessionalClientContext,
} from '../lib/professionals';

const mealLabels = { breakfast: 'Desayuno', lunch: 'Almuerzo', snack: 'Merienda', dinner: 'Cena' };
const permissionLabels = { diary: 'Diario', weight: 'Peso', goals: 'Objetivos', photos: 'Fotos' };
const rangeOptions = [[7, '7 días'], [30, '30 días'], [90, '3 meses'], [365, '12 meses']];
const statusOptions = [
  ['up_to_date', 'Al día'],
  ['following', 'En seguimiento'],
  ['needs_attention', 'Requiere atención'],
];

function number(value, digits = 0) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(Number(value || 0));
}

function dateLabel(value, options = {}) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', ...options });
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
    <div className="chart-caption"><span>{dateLabel(`${entries[0].measuredOn}T12:00:00`)}</span><span>{dateLabel(`${entries.at(-1).measuredOn}T12:00:00`)}</span></div>
  </div>;
}

function LockedCard({ title, text }) {
  return <div className="locked-card"><span>◇</span><div><b>{title}</b><p>{text}</p></div></div>;
}

function HistoryView({ detail, permissions }) {
  const events = useMemo(() => {
    const weights = permissions.weight ? (detail?.weights ?? []).map((entry) => ({
      id: `weight-${entry.measuredOn}`, at: `${entry.measuredOn}T12:00:00`, kind: 'weight', title: `${number(entry.weightKg, 1)} kg`, text: 'Registro de peso',
    })) : [];
    const meals = permissions.diary ? (detail?.meals ?? []).map((meal) => ({
      id: `meal-${meal.id}`, at: meal.eatenAt, kind: 'meal', title: meal.name, text: `${mealLabels[meal.category] ?? 'Comida'} · ${number(meal.calories)} kcal`,
    })) : [];
    const goal = permissions.goals && detail?.goals?.updatedAt ? [{
      id: 'goal-update', at: detail.goals.updatedAt, kind: 'goal', title: 'Objetivos actualizados', text: `${number(detail.goals.calorieGoal)} kcal · meta ${number(detail.goals.targetWeightKg, 1)} kg`,
    }] : [];
    return [...weights, ...meals, ...goal].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [detail, permissions]);

  return <section className="panel history-panel">
    <div className="panel-heading"><div><h3>Historial compartido</h3><p>Una línea de tiempo construida con los permisos vigentes.</p></div><span className="history-count">{events.length} eventos</span></div>
    {events.length ? <div className="timeline">{events.map((event) => <article key={event.id}>
      <span className={`timeline-icon ${event.kind}`}>{event.kind === 'weight' ? '↘' : event.kind === 'meal' ? '◌' : '◎'}</span>
      <div><b>{event.title}</b><p>{event.text}</p></div>
      <time>{dateLabel(event.at)}<small>{new Date(event.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</small></time>
    </article>)}</div> : <div className="detail-empty">No hay eventos visibles en este período.</div>}
  </section>;
}

function NotesView({ clientId, workspace, onWorkspaceChange }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function addNote(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      const note = await createProfessionalClientNote(clientId, body);
      onWorkspaceChange({ ...workspace, notes: [note, ...(workspace.notes ?? [])] });
      setBody('');
    } catch (error) {
      setMessage(error.message || 'No pudimos guardar la nota.');
    } finally { setSaving(false); }
  }

  async function removeNote(noteId) {
    setSaving(true);
    setMessage('');
    try {
      await deleteProfessionalClientNote(noteId);
      onWorkspaceChange({ ...workspace, notes: workspace.notes.filter((note) => note.id !== noteId) });
    } catch (error) {
      setMessage(error.message || 'No pudimos eliminar la nota.');
    } finally { setSaving(false); }
  }

  return <div className="notes-layout">
    <section className="panel note-composer">
      <div className="panel-heading"><div><h3>Nueva nota privada</h3><p>Sólo es visible para tu cuenta profesional.</p></div><span className="private-badge">Privada</span></div>
      <form onSubmit={addNote}>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} placeholder="Observaciones de la consulta, acuerdos, contexto clínico o próximos pasos…"/>
        <div><small>{body.length}/5000</small><button className="button primary" disabled={saving || !body.trim()}>{saving ? 'Guardando…' : 'Guardar nota'}</button></div>
      </form>
      {message && <p className="inline-error">{message}</p>}
    </section>
    <section className="panel note-list-panel">
      <div className="panel-heading"><div><h3>Notas profesionales</h3><p>Registro cronológico del acompañamiento.</p></div></div>
      {workspace.notes?.length ? <div className="note-list">{workspace.notes.map((note) => <article key={note.id}>
        <header><time>{new Date(note.createdAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}</time><button type="button" disabled={saving} onClick={() => removeNote(note.id)}>Eliminar</button></header>
        <p>{note.body}</p>
      </article>)}</div> : <div className="detail-empty">Todavía no hay notas privadas para esta persona.</div>}
    </section>
  </div>;
}

export default function ClientDetailView({ client, revision, onBack }) {
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState('summary');
  const [detail, setDetail] = useState(null);
  const [workspace, setWorkspace] = useState({ context: null, notes: [] });
  const [busy, setBusy] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [error, setError] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [retry, setRetry] = useState(0);
  const [contextDraft, setContextDraft] = useState({ status: 'up_to_date', nextReviewOn: '', tags: '' });
  const [savingContext, setSavingContext] = useState(false);

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
    let cancelled = false;
    getProfessionalClientWorkspace(client.clientId)
      .then((next) => {
        if (cancelled) return;
        setWorkspace(next);
        setContextDraft({ status: next.context?.status ?? 'up_to_date', nextReviewOn: next.context?.next_review_on ?? '', tags: (next.context?.tags ?? []).join(', ') });
        setWorkspaceReady(true);
        setWorkspaceError('');
      })
      .catch((reason) => { if (!cancelled) setWorkspaceError(reason.message || 'El espacio profesional todavía no está disponible.'); });
    return () => { cancelled = true; };
  }, [client.clientId]);

  useEffect(() => {
    const timer = window.setInterval(() => setRetry((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const todayMeals = useMemo(() => {
    const today = new Date().toLocaleDateString('en-CA');
    return (detail?.meals ?? []).filter((meal) => new Date(meal.eatenAt).toLocaleDateString('en-CA') === today);
  }, [detail]);
  const totals = useMemo(() => todayMeals.reduce((sum, meal) => ({ calories: sum.calories + meal.calories, protein: sum.protein + meal.proteinG, carbs: sum.carbs + meal.carbsG, fat: sum.fat + meal.fatG }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [todayMeals]);
  const goals = detail?.goals;
  const permissions = detail?.permissions ?? client.permissions;
  const currentWeight = detail?.weights?.at(-1)?.weightKg ?? goals?.currentWeightKg ?? client.currentWeightKg;
  const start = Number(goals?.startingWeightKg);
  const target = Number(goals?.targetWeightKg);
  const current = Number(currentWeight);
  const progress = Number.isFinite(start) && Number.isFinite(target) && Number.isFinite(current) && start !== target ? Math.max(0, Math.min(100, ((start - current) / (start - target)) * 100)) : 0;

  async function saveContext(event) {
    event.preventDefault();
    setSavingContext(true);
    setWorkspaceError('');
    try {
      const context = await saveProfessionalClientContext(client.clientId, { status: contextDraft.status, nextReviewOn: contextDraft.nextReviewOn, tags: contextDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      setWorkspace((currentWorkspace) => ({ ...currentWorkspace, context }));
      setWorkspaceReady(true);
    } catch (reason) { setWorkspaceError(reason.message || 'No pudimos guardar el seguimiento.'); }
    finally { setSavingContext(false); }
  }

  return <div className="client-detail">
    <button className="back-link" type="button" onClick={onBack}>← Volver a clientes</button>
    <section className="client-hero">
      <div className="client-avatar large">{client.displayName.charAt(0).toUpperCase()}</div>
      <div><p className="eyebrow">Seguimiento individual</p><h2>{client.displayName}</h2><p>Conectado desde {new Date(client.startedAt).toLocaleDateString('es-AR')}</p></div>
      <div className="permission-pills">{Object.entries(client.permissions).map(([key, enabled]) => <span className={enabled ? 'enabled' : ''} key={key}>{enabled ? '✓' : '–'} {permissionLabels[key]}</span>)}</div>
    </section>

    <nav className="client-tabs" aria-label="Secciones de la ficha">
      {[['summary', 'Resumen'], ['history', 'Historial'], ['notes', `Notas${workspace.notes?.length ? ` (${workspace.notes.length})` : ''}`]].map(([value, label]) => <button type="button" className={activeTab === value ? 'active' : ''} key={value} onClick={() => setActiveTab(value)}>{label}</button>)}
    </nav>

    {error && <div className="notice error dashboard-notice detail-error"><span>No pudimos actualizar el detalle. {error}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>}
    {workspaceError && <div className="notice error dashboard-notice"><span>{workspaceError}</span></div>}
    {busy && !detail ? <div className="content-loader"><span className="loader dark"/>Actualizando datos…</div> : <>
      {activeTab === 'summary' && <>
        <div className="detail-kpis">
          <article><span>Peso actual</span><strong>{Number.isFinite(current) ? `${number(current, 1)} kg` : '—'}</strong><small>{permissions.weight ? 'Último registro compartido' : 'Sin permiso de peso'}</small></article>
          <article><span>Progreso del objetivo</span><strong>{goals ? `${number(progress)}%` : '—'}</strong><small>{Number.isFinite(target) ? `Objetivo ${number(target, 1)} kg` : 'Sin objetivo visible'}</small></article>
          <article><span>Consumo de hoy</span><strong>{permissions.diary && detail ? `${number(totals.calories)} kcal` : '—'}</strong><small>{permissions.diary ? `${todayMeals.length} comidas registradas` : 'Sin permiso de diario'}</small></article>
          <article><span>Última sincronización</span><strong className={detail ? 'live-value' : 'pending-value'}>{detail && <i/>} {detail ? 'En vivo' : 'Pendiente'}</strong><small>{detail?.generatedAt ? new Date(detail.generatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Esperando detalle'}</small></article>
        </div>

        <section className="panel followup-panel">
          <div className="panel-heading"><div><h3>Contexto del seguimiento</h3><p>Organizá tu cartera sin modificar ningún dato de la persona.</p></div><span className={`followup-status ${contextDraft.status}`}>{statusOptions.find(([value]) => value === contextDraft.status)?.[1]}</span></div>
          <form className="followup-form" onSubmit={saveContext}>
            <label>Estado<select value={contextDraft.status} onChange={(event) => setContextDraft((draft) => ({ ...draft, status: event.target.value }))}>{statusOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Próxima revisión<input type="date" value={contextDraft.nextReviewOn} onChange={(event) => setContextDraft((draft) => ({ ...draft, nextReviewOn: event.target.value }))}/></label>
            <label className="tag-field">Etiquetas<input value={contextDraft.tags} onChange={(event) => setContextDraft((draft) => ({ ...draft, tags: event.target.value }))} placeholder="Ej.: vegetariano, control mensual"/></label>
            <button className="button secondary" disabled={savingContext || !workspaceReady}>{savingContext ? 'Guardando…' : 'Guardar seguimiento'}</button>
          </form>
        </section>

        <div className="detail-grid">
          <section className="panel detail-chart-panel"><div className="panel-heading"><div><h3>Evolución del peso</h3><p>Historial autorizado por la persona</p></div><div className="range-tabs">{rangeOptions.map(([value, label]) => <button className={days === value ? 'active' : ''} key={value} onClick={() => setDays(value)}>{label}</button>)}</div></div>{permissions.weight ? <WeightChart entries={detail?.weights ?? []} target={target}/> : <LockedCard title="Peso no compartido" text="La persona puede habilitar este permiso desde Calorfy."/>}</section>
          <section className="panel macro-panel"><div className="panel-heading"><div><h3>Balance de hoy</h3><p>Consumo frente al plan visible</p></div></div>{permissions.diary ? <><div className="calorie-progress"><div><strong>{number(totals.calories)}</strong><span> / {goals?.calorieGoal ? number(goals.calorieGoal) : '—'} kcal</span></div><div className="progress-track"><i style={{ width: `${Math.min(100, goals?.calorieGoal ? (totals.calories / goals.calorieGoal) * 100 : 0)}%` }}/></div></div><div className="macro-grid"><div><b>{number(totals.protein)} g</b><span>Proteínas</span><small>{goals?.proteinGoalG ? `meta ${number(goals.proteinGoalG)} g` : ''}</small></div><div><b>{number(totals.carbs)} g</b><span>Carbohidratos</span><small>{goals?.carbsGoalG ? `meta ${number(goals.carbsGoalG)} g` : ''}</small></div><div><b>{number(totals.fat)} g</b><span>Grasas</span><small>{goals?.fatGoalG ? `meta ${number(goals.fatGoalG)} g` : ''}</small></div></div></> : <LockedCard title="Diario no compartido" text="No se muestran comidas ni totales nutricionales."/>}</section>
        </div>
        <section className="panel meals-panel"><div className="panel-heading"><div><h3>Comidas de hoy</h3><p>Información actualizada desde la app de la persona</p></div>{detail ? <span className="live-badge"><i/> Sincronizado</span> : <span className="live-badge pending">Pendiente</span>}</div>{permissions.diary ? todayMeals.length ? <div className="pro-meal-list">{todayMeals.map((meal) => <article key={meal.id}><div className="meal-time"><b>{mealLabels[meal.category] ?? 'Comida'}</b><small>{new Date(meal.eatenAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</small></div><div><b>{meal.name}</b><small>P {number(meal.proteinG)} g · C {number(meal.carbsG)} g · G {number(meal.fatG)} g</small></div><strong>{number(meal.calories)} kcal</strong></article>)}</div> : <div className="detail-empty">{detail ? 'Todavía no registró comidas hoy.' : 'Esperando la primera sincronización del detalle.'}</div> : <LockedCard title="Diario no compartido" text="La lista aparecerá cuando la persona habilite el acceso."/>}</section>
      </>}
      {activeTab === 'history' && <HistoryView detail={detail} permissions={permissions}/>}
      {activeTab === 'notes' && (workspaceReady
        ? <NotesView clientId={client.clientId} workspace={workspace} onWorkspaceChange={setWorkspace}/>
        : workspaceError
          ? <section className="panel"><LockedCard title="Espacio privado pendiente" text="Aplicá la migración profesional para habilitar notas y seguimiento."/></section>
          : <div className="content-loader"><span className="loader dark"/>Preparando espacio privado…</div>)}
    </>}
  </div>;
}
