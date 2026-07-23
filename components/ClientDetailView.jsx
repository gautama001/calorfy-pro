'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  createProfessionalClientNote,
  deleteProfessionalClientNote,
  getProfessionalClientDetail,
  getProfessionalClientWorkspace,
  saveProfessionalClientContext,
} from '../lib/professionals';
import { useI18n } from './I18nProvider';

const mealLabels = { breakfast: 'breakfast', lunch: 'lunch', snack: 'snack', dinner: 'dinner' };
const permissionLabels = { diary: 'diary', weight: 'weight', goals: 'goals', photos: 'photos' };
const rangeOptions = [[7, 'range_7'], [30, 'range_30'], [90, 'range_90'], [365, 'range_365']];
const statusOptions = [
  ['up_to_date', 'up_to_date'],
  ['following', 'following'],
  ['needs_attention', 'needs_attention'],
];

function number(value, digits = 0, locale = 'es-AR') {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(value || 0));
}

function dateLabel(value, locale, options = {}) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', ...options });
}

function WeightChart({ entries, target }) {
  const { locale, t } = useI18n();
  if (!entries?.length) return <div className="detail-empty">{t('no_weight_period')}</div>;
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
    <svg className="weight-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('weight_evolution')}>
      {[0, 1, 2].map((step) => {
        const value = max - ((max - min) * step) / 2;
        return <g key={step}><line x1={padding} x2={width - padding} y1={y(value)} y2={y(value)} className="chart-grid"/><text x="0" y={y(value) + 4}>{number(value, 1, locale)}</text></g>;
      })}
      {Number.isFinite(target) && <line x1={padding} x2={width - padding} y1={y(target)} y2={y(target)} className="chart-target"/>}
      <polyline points={points} className="chart-line"/>
      {entries.map((entry, index) => <circle key={entry.measuredOn} cx={x(index)} cy={y(entry.weightKg)} r="5" className="chart-point"><title>{entry.measuredOn}: {entry.weightKg} kg</title></circle>)}
    </svg>
    <div className="chart-caption"><span>{dateLabel(`${entries[0].measuredOn}T12:00:00`, locale)}</span><span>{dateLabel(`${entries.at(-1).measuredOn}T12:00:00`, locale)}</span></div>
  </div>;
}

function LockedCard({ title, text }) {
  return <div className="locked-card"><span>◇</span><div><b>{title}</b><p>{text}</p></div></div>;
}

function HistoryView({ detail, permissions }) {
  const { locale, t } = useI18n();
  const events = useMemo(() => {
    const weights = permissions.weight ? (detail?.weights ?? []).map((entry) => ({
      id: `weight-${entry.measuredOn}`, at: `${entry.measuredOn}T12:00:00`, kind: 'weight', title: `${number(entry.weightKg, 1, locale)} kg`, text: t('weight_record'),
    })) : [];
    const meals = permissions.diary ? (detail?.meals ?? []).map((meal) => ({
      id: `meal-${meal.id}`, at: meal.eatenAt, kind: 'meal', title: meal.name, text: `${t(mealLabels[meal.category] ?? 'meal')} · ${number(meal.calories, 0, locale)} kcal`,
    })) : [];
    const goal = permissions.goals && detail?.goals?.updatedAt ? [{
      id: 'goal-update', at: detail.goals.updatedAt, kind: 'goal', title: t('goals_updated'), text: t('goal_meta', { calories: number(detail.goals.calorieGoal, 0, locale), weight: number(detail.goals.targetWeightKg, 1, locale) }),
    }] : [];
    return [...weights, ...meals, ...goal].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [detail, locale, permissions, t]);

  return <section className="panel history-panel">
    <div className="panel-heading"><div><h3>{t('shared_history')}</h3><p>{t('shared_timeline')}</p></div><span className="history-count">{t('events_count', { value: events.length })}</span></div>
    {events.length ? <div className="timeline">{events.map((event) => <article key={event.id}>
      <span className={`timeline-icon ${event.kind}`}>{event.kind === 'weight' ? '↘' : event.kind === 'meal' ? '◌' : '◎'}</span>
      <div><b>{event.title}</b><p>{event.text}</p></div>
      <time>{dateLabel(event.at, locale)}<small>{new Date(event.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small></time>
    </article>)}</div> : <div className="detail-empty">{t('no_visible_events')}</div>}
  </section>;
}

function NotesView({ clientId, workspace, onWorkspaceChange }) {
  const { locale, t } = useI18n();
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
      setMessage(error.message || t('note_save_error'));
    } finally { setSaving(false); }
  }

  async function removeNote(noteId) {
    setSaving(true);
    setMessage('');
    try {
      await deleteProfessionalClientNote(noteId);
      onWorkspaceChange({ ...workspace, notes: workspace.notes.filter((note) => note.id !== noteId) });
    } catch (error) {
      setMessage(error.message || t('note_delete_error'));
    } finally { setSaving(false); }
  }

  return <div className="notes-layout">
    <section className="panel note-composer">
      <div className="panel-heading"><div><h3>{t('new_private_note')}</h3><p>{t('only_professional')}</p></div><span className="private-badge">{t('private')}</span></div>
      <form onSubmit={addNote}>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} placeholder={t('note_placeholder')}/>
        <div><small>{body.length}/5000</small><button className="button primary" disabled={saving || !body.trim()}>{saving ? t('saving') : t('save_note')}</button></div>
      </form>
      {message && <p className="inline-error">{message}</p>}
    </section>
    <section className="panel note-list-panel">
      <div className="panel-heading"><div><h3>{t('professional_notes')}</h3><p>{t('notes_timeline')}</p></div></div>
      {workspace.notes?.length ? <div className="note-list">{workspace.notes.map((note) => <article key={note.id}>
        <header><time>{new Date(note.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</time><button type="button" disabled={saving} onClick={() => removeNote(note.id)}>{t('delete')}</button></header>
        <p>{note.body}</p>
      </article>)}</div> : <div className="detail-empty">{t('no_private_notes')}</div>}
    </section>
  </div>;
}

export default function ClientDetailView({ client, revision, onBack }) {
  const { locale, t } = useI18n();
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
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : t('client_update_error')); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [client.clientId, days, revision, retry, t]);

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
      .catch((reason) => { if (!cancelled) setWorkspaceError(reason.message || t('workspace_unavailable')); });
    return () => { cancelled = true; };
  }, [client.clientId, t]);

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
    } catch (reason) { setWorkspaceError(reason.message || t('followup_save_error')); }
    finally { setSavingContext(false); }
  }

  return <div className="client-detail">
    <button className="back-link" type="button" onClick={onBack}>{t('back_clients')}</button>
    <section className="client-hero">
      <div className="client-avatar large">{client.displayName.charAt(0).toUpperCase()}</div>
      <div><p className="eyebrow">{t('individual_followup')}</p><h2>{client.displayName}</h2><p>{t('connected_since', { date: new Date(client.startedAt).toLocaleDateString(locale) })}</p></div>
      <div className="permission-pills">{Object.entries(client.permissions).map(([key, enabled]) => <span className={enabled ? 'enabled' : ''} key={key}>{enabled ? '✓' : '–'} {t(permissionLabels[key])}</span>)}</div>
    </section>

    <nav className="client-tabs" aria-label={t('record_sections')}>
      {[['summary', t('nav_summary')], ['history', t('history')], ['notes', t('notes', { count: workspace.notes?.length ? ` (${workspace.notes.length})` : '' })]].map(([value, label]) => <button type="button" className={activeTab === value ? 'active' : ''} key={value} onClick={() => setActiveTab(value)}>{label}</button>)}
    </nav>

    {error && <div className="notice error dashboard-notice detail-error"><span>{t('detail_update_error')} {error}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>{t('retry')}</button></div>}
    {workspaceError && <div className="notice error dashboard-notice"><span>{workspaceError}</span></div>}
    {busy && !detail ? <div className="content-loader"><span className="loader dark"/>{t('updating_data')}</div> : <>
      {activeTab === 'summary' && <>
        <div className="detail-kpis">
          <article><span>{t('current_weight')}</span><strong>{Number.isFinite(current) ? `${number(current, 1, locale)} kg` : '—'}</strong><small>{permissions.weight ? t('last_shared_record') : t('no_weight_permission')}</small></article>
          <article><span>{t('goal_progress')}</span><strong>{goals ? `${number(progress, 0, locale)}%` : '—'}</strong><small>{Number.isFinite(target) ? t('target_weight', { value: number(target, 1, locale) }) : t('no_visible_goal')}</small></article>
          <article><span>{t('today_consumption')}</span><strong>{permissions.diary && detail ? `${number(totals.calories, 0, locale)} kcal` : '—'}</strong><small>{permissions.diary ? t('meals_registered', { value: todayMeals.length }) : t('no_diary_permission')}</small></article>
          <article><span>{t('last_sync')}</span><strong className={detail ? 'live-value' : 'pending-value'}>{detail && <i/>} {detail ? t('in_live') : t('pending')}</strong><small>{detail?.generatedAt ? new Date(detail.generatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : t('waiting_detail')}</small></article>
        </div>

        <section className="panel followup-panel">
          <div className="panel-heading"><div><h3>{t('followup_context')}</h3><p>{t('followup_context_intro')}</p></div><span className={`followup-status ${contextDraft.status}`}>{t(statusOptions.find(([value]) => value === contextDraft.status)?.[1])}</span></div>
          <form className="followup-form" onSubmit={saveContext}>
            <label>{t('status')}<select value={contextDraft.status} onChange={(event) => setContextDraft((draft) => ({ ...draft, status: event.target.value }))}>{statusOptions.map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label>
            <label>{t('next_review')}<input type="date" value={contextDraft.nextReviewOn} onChange={(event) => setContextDraft((draft) => ({ ...draft, nextReviewOn: event.target.value }))}/></label>
            <label className="tag-field">{t('tags')}<input value={contextDraft.tags} onChange={(event) => setContextDraft((draft) => ({ ...draft, tags: event.target.value }))} placeholder={t('tags_placeholder')}/></label>
            <button className="button secondary" disabled={savingContext || !workspaceReady}>{savingContext ? t('saving') : t('save_followup')}</button>
          </form>
        </section>

        <div className="detail-grid">
          <section className="panel detail-chart-panel"><div className="panel-heading"><div><h3>{t('weight_evolution')}</h3><p>{t('authorized_history')}</p></div><div className="range-tabs">{rangeOptions.map(([value, label]) => <button type="button" className={days === value ? 'active' : ''} key={value} onClick={() => setDays(value)}>{t(label)}</button>)}</div></div>{permissions.weight ? <WeightChart entries={detail?.weights ?? []} target={target}/> : <LockedCard title={t('weight_not_shared')} text={t('enable_weight_permission')}/>}</section>
          <section className="panel macro-panel"><div className="panel-heading"><div><h3>{t('today_balance')}</h3><p>{t('consumption_plan')}</p></div></div>{permissions.diary ? <><div className="calorie-progress"><div><strong>{number(totals.calories, 0, locale)}</strong><span> / {goals?.calorieGoal ? number(goals.calorieGoal, 0, locale) : '—'} kcal</span></div><div className="progress-track"><i style={{ width: `${Math.min(100, goals?.calorieGoal ? (totals.calories / goals.calorieGoal) * 100 : 0)}%` }}/></div></div><div className="macro-grid"><div><b>{number(totals.protein, 0, locale)} g</b><span>{t('proteins')}</span><small>{goals?.proteinGoalG ? t('macro_target', { value: number(goals.proteinGoalG, 0, locale) }) : ''}</small></div><div><b>{number(totals.carbs, 0, locale)} g</b><span>{t('carbohydrates')}</span><small>{goals?.carbsGoalG ? t('macro_target', { value: number(goals.carbsGoalG, 0, locale) }) : ''}</small></div><div><b>{number(totals.fat, 0, locale)} g</b><span>{t('fats')}</span><small>{goals?.fatGoalG ? t('macro_target', { value: number(goals.fatGoalG, 0, locale) }) : ''}</small></div></div></> : <LockedCard title={t('diary_not_shared')} text={t('diary_totals_hidden')}/>}</section>
        </div>
        <section className="panel meals-panel"><div className="panel-heading"><div><h3>{t('todays_meals')}</h3><p>{t('updated_from_app')}</p></div>{detail ? <span className="live-badge"><i/> {t('synced')}</span> : <span className="live-badge pending">{t('pending')}</span>}</div>{permissions.diary ? todayMeals.length ? <div className="pro-meal-list">{todayMeals.map((meal) => <article key={meal.id}><div className="meal-time"><b>{t(mealLabels[meal.category] ?? 'meal')}</b><small>{new Date(meal.eatenAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small></div><div><b>{meal.name}</b><small>P {number(meal.proteinG, 0, locale)} g · C {number(meal.carbsG, 0, locale)} g · G {number(meal.fatG, 0, locale)} g</small></div><strong>{number(meal.calories, 0, locale)} kcal</strong></article>)}</div> : <div className="detail-empty">{detail ? t('no_meals_today') : t('waiting_first_sync')}</div> : <LockedCard title={t('diary_not_shared')} text={t('diary_list_permission')}/>}</section>
      </>}
      {activeTab === 'history' && <HistoryView detail={detail} permissions={permissions}/>}
      {activeTab === 'notes' && (workspaceReady
        ? <NotesView clientId={client.clientId} workspace={workspace} onWorkspaceChange={setWorkspace}/>
        : workspaceError
          ? <section className="panel"><LockedCard title={t('private_space_pending')} text={t('private_space_migration')}/></section>
          : <div className="content-loader"><span className="loader dark"/>{t('preparing_private_space')}</div>)}
    </>}
  </div>;
}
