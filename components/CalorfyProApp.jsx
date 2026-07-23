'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createProfessionalInvite, getProfessionalClients, getProfessionalOverview, getProfessionalProfile, professionalInviteUrl, revokeProfessionalInvite, saveProfessionalProfile, subscribeToProfessionalUpdates, } from '../lib/professionals';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import ClientDetailView from './ClientDetailView';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from './I18nProvider';
const countries = [
    ['AR', 'country_ar'], ['BR', 'country_br'], ['CL', 'country_cl'], ['CO', 'country_co'],
    ['MX', 'country_mx'], ['PE', 'country_pe'], ['UY', 'country_uy'], ['OTHER', 'country_other'],
];
function friendlyError(error, t) {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : error && typeof error === 'object'
                ? [error.message, error.details, error.hint, error.code].filter(Boolean).join(' · ')
                : '';
    if (message.includes('Invalid login credentials'))
        return t('invalid_credentials');
    if (message.includes('Email not confirmed'))
        return t('confirm_email');
    if (message.includes('already registered'))
        return t('account_exists');
    if (message.includes('Too many active invitations'))
        return t('too_many_invites');
    if (message.includes('get_professional_client_summaries'))
        return t('clients_model_missing');
    if (message.includes('get_professional_client_detail') || message.includes('professional_client_sync_state'))
        return t('live_data_missing');
    return message || t('unexpected_error');
}
function professionLabel(profession, t) {
    return profession === 'nutritionist' ? t('nutritionist') : t('personal_trainer');
}
function Brand({ compact = false }) {
    return <a className="brand" href="/"><span className="brand-mark" aria-hidden="true"/>{!compact && <><span>Calorfy</span><small>PRO</small></>}</a>;
}
function LoadingScreen() {
    const { t } = useI18n();
    return <main className="loading-screen"><Brand /><span className="loader" aria-label={t('loading')}/></main>;
}
function ConfigurationScreen() {
    const { t } = useI18n();
    return (<main className="configuration-screen">
      <div className="configuration-card">
        <Brand />
        <span className="config-icon">⚙</span>
        <p className="eyebrow">{t('configuration_pending')}</p>
        <h1>{t('configuration_title')}</h1>
        <p>{t('configuration_body')}</p>
      </div>
    </main>);
}
function AuthScreen({ onAuthenticated }) {
    const { t } = useI18n();
    const [mode, setMode] = useState('login');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    async function submit(event) {
        event.preventDefault();
        setNotice(null);
        setBusy(true);
        const form = new FormData(event.currentTarget);
        const email = String(form.get('email') ?? '').trim();
        const password = String(form.get('password') ?? '');
        try {
            if (mode === 'signup') {
                const displayName = String(form.get('displayName') ?? '').trim();
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin },
                });
                if (error)
                    throw error;
                if (data.session)
                    onAuthenticated(data.session);
                else
                    setNotice({ type: 'success', text: t('account_created') });
            }
            else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error)
                    throw error;
                onAuthenticated(data.session);
            }
        }
        catch (error) {
            setNotice({ type: 'error', text: friendlyError(error, t) });
        }
        finally {
            setBusy(false);
        }
    }
    return (<main className="auth-layout">
      <section className="auth-story">
        <div className="auth-brand-row"><Brand /><LanguageSwitcher dark /></div>
        <div className="story-copy">
          <p className="eyebrow">{t('connected_followup')}</p>
          <h1>{t('auth_story_title')}</h1>
          <p>{t('auth_story_body')}</p>
          <div className="story-points">
            <article><span>◎</span><b>{t('longitudinal_progress')}</b></article>
            <article><span>↗</span><b>{t('real_habits')}</b></article>
            <article><span>⌁</span><b>{t('revocable_permissions')}</b></article>
          </div>
        </div>
        <footer><span>{t('granular_permissions')}</span><a href="https://calorfy.com">{t('back_calorfy')}</a></footer>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{t('professional_portal')}</p>
          <h2>{mode === 'login' ? t('welcome_back') : t('create_professional_account')}</h2>
          <p>{mode === 'login' ? t('login_intro') : t('signup_intro')}</p>
          <div className="auth-tabs" role="tablist">
            <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => { setMode('login'); setNotice(null); }}>{t('login')}</button>
            <button className={mode === 'signup' ? 'active' : ''} type="button" onClick={() => { setMode('signup'); setNotice(null); }}>{t('create_account')}</button>
          </div>
          {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
          <form className="form-grid" onSubmit={submit}>
            {mode === 'signup' && <label>{t('full_name')}<input name="displayName" required minLength={2} autoComplete="name" placeholder={t('full_name_placeholder')}/></label>}
            <label>{t('email')}<input name="email" required type="email" autoComplete="email" placeholder="nombre@consultorio.com"/></label>
            <label>{t('password')}<input name="password" required type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={t('password_placeholder')}/></label>
            <button className="button primary full" disabled={busy}>{busy ? t('processing') : mode === 'login' ? t('login') : t('create_account')}</button>
          </form>
          <small className="legal">{t('legal')}</small>
        </div>
      </section>
    </main>);
}
function ProfileFields({ initial, submitLabel, onSubmit }) {
    const { t } = useI18n();
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState(null);
    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setNotice(null);
        const form = new FormData(event.currentTarget);
        try {
            await onSubmit({
                profession: String(form.get('profession')),
                publicName: String(form.get('publicName') ?? '').trim(),
                countryCode: String(form.get('countryCode')) === 'OTHER' ? null : String(form.get('countryCode')),
                organizationName: String(form.get('organizationName') ?? '').trim() || null,
                licenseNumber: String(form.get('licenseNumber') ?? '').trim() || null,
            });
            setNotice({ type: 'success', text: t('profile_saved') });
        }
        catch (error) {
            setNotice({ type: 'error', text: friendlyError(error, t) });
        }
        finally {
            setBusy(false);
        }
    }
    return (<form className="form-grid" onSubmit={submit}>
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      <label>{t('profession')}<select name="profession" defaultValue={initial?.profession ?? 'nutritionist'}><option value="nutritionist">{t('nutritionist')}</option><option value="personal_trainer">{t('personal_trainer')}</option></select></label>
      <label>{t('public_name')}<input name="publicName" required minLength={2} maxLength={80} defaultValue={initial?.publicName ?? ''} placeholder="Lic. Laura Méndez"/></label>
      <div className="field-row">
        <label>{t('country')}<select name="countryCode" defaultValue={initial?.countryCode ?? 'AR'}>{countries.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
        <label>{t('license_optional')}<input name="licenseNumber" maxLength={80} defaultValue={initial?.licenseNumber ?? ''} placeholder="MN 12345"/></label>
      </div>
      <label>{t('organization_optional')}<input name="organizationName" maxLength={120} defaultValue={initial?.organizationName ?? ''} placeholder="Centro Integral Salud"/></label>
      <p className="form-hint">{t('license_hint')}</p>
      <button className="button primary full" disabled={busy}>{busy ? t('saving') : submitLabel}</button>
    </form>);
}
function OnboardingScreen({ session, onComplete }) {
    const { t } = useI18n();
    return (<main className="onboarding-page">
      <header><Brand /><LanguageSwitcher /><button className="text-button" onClick={() => supabase.auth.signOut()}>{t('sign_out')}</button></header>
      <section className="onboarding-card">
        <aside>
          <span className="pro-pill">{t('setup')}</span>
          <h1>{t('onboarding_title')}</h1>
          <p>{t('onboarding_intro')}</p>
          <ol><li><b>1</b> {t('professional_profile')}</li><li><b>2</b> {t('verification')}</li><li><b>3</b> {t('first_client')}</li></ol>
        </aside>
        <div className="onboarding-form">
          <p className="eyebrow">{t('step_1_3')}</p>
          <h2>{t('professional_information')}</h2>
          <p>{t('editable_later')}</p>
          <ProfileFields submitLabel={t('create_workspace')} onSubmit={async (input) => onComplete(await saveProfessionalProfile(session.user.id, input))}/>
        </div>
      </section>
    </main>);
}
function InviteModal({ onClose, onCreated }) {
    const { t } = useI18n();
    const [busy, setBusy] = useState(false);
    const [link, setLink] = useState('');
    const [error, setError] = useState('');
    async function create() {
        setBusy(true);
        setError('');
        try {
            const token = await createProfessionalInvite();
            setLink(professionalInviteUrl(token));
            await onCreated();
        }
        catch (reason) {
            setError(friendlyError(reason, t));
        }
        finally {
            setBusy(false);
        }
    }
    async function copy() {
        await navigator.clipboard.writeText(link);
    }
    return (<div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <button className="modal-close" onClick={onClose} aria-label={t('close')}>×</button>
        <span className="modal-icon">↗</span>
        <p className="eyebrow">{t('private_connection')}</p>
        <h2 id="invite-title">{t('invite_title')}</h2>
        <p>{t('invite_body')}</p>
        {error && <div className="notice error">{error}</div>}
        {!link ? <button className="button primary full" disabled={busy} onClick={create}>{busy ? t('generating') : t('generate_secure_invite')}</button> : <div className="generated-link"><code>{link}</code><button className="button primary full" onClick={copy}>{t('copy_link')}</button><small>{t('link_once')}</small></div>}
      </section>
    </div>);
}
function daysSince(value) {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}
function clientSignals(client, t) {
    const signals = [];
    const today = new Date().toISOString().slice(0, 10);
    if (client.attentionStatus === 'needs_attention')
        signals.push({ id: 'manual', label: t('marked_attention'), tone: 'danger' });
    if (client.nextReviewOn && client.nextReviewOn < today)
        signals.push({ id: 'overdue', label: t('overdue_review'), tone: 'danger' });
    const mealDays = daysSince(client.lastMealAt);
    if (client.permissions.diary && (mealDays === null || mealDays >= 3))
        signals.push({ id: 'diary', label: mealDays === null ? t('no_meals_logged') : t('days_without_meals', { value: mealDays }), tone: 'warning' });
    const weightDays = daysSince(client.lastWeightOn);
    if (client.permissions.weight && (weightDays === null || weightDays >= 7))
        signals.push({ id: 'weight', label: weightDays === null ? t('no_weight_logged') : t('days_without_weight', { value: weightDays }), tone: 'warning' });
    return signals;
}
function portfolioStatus(client, t) {
    const signals = clientSignals(client, t);
    if (client.attentionStatus === 'needs_attention' || signals.some((signal) => signal.tone === 'danger'))
        return 'needs_attention';
    if (client.attentionStatus === 'following' || signals.length)
        return 'following';
    return 'up_to_date';
}
function SummaryView({ clients, invites, onInvite, onOpenClient }) {
    const { locale, t } = useI18n();
    const activeInvites = invites.filter((invite) => !invite.acceptedAt && !invite.revokedAt && new Date(invite.expiresAt) > new Date());
    const attention = clients.filter((client) => portfolioStatus(client, t) === 'needs_attention');
    const following = clients.filter((client) => portfolioStatus(client, t) === 'following');
    const upToDate = clients.filter((client) => portfolioStatus(client, t) === 'up_to_date');
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const upcoming = clients.filter((client) => client.nextReviewOn && client.nextReviewOn >= new Date().toISOString().slice(0, 10) && client.nextReviewOn <= nextWeek).sort((a, b) => a.nextReviewOn.localeCompare(b.nextReviewOn));
    return <>
    <div className="stats-grid">
      <article className="stat-card attention"><header><span>{t('attend_today')}</span><i>!</i></header><strong>{attention.length}</strong><small>{t('visible_priority')}</small></article>
      <article className="stat-card"><header><span>{t('following')}</span><i>↗</i></header><strong>{following.length}</strong><small>{t('pending_signal')}</small></article>
      <article className="stat-card"><header><span>{t('clients_up_to_date')}</span><i>✓</i></header><strong>{upToDate.length}</strong><small>{t('no_pending_signals')}</small></article>
      <article className="stat-card"><header><span>{t('open_invitations')}</span><i>＋</i></header><strong>{activeInvites.length}</strong><small>{t('pending_acceptance')}</small></article>
    </div>
    <div className="attention-grid">
      <section className="panel attention-panel">
        <div className="panel-heading"><div><h3>{t('attend_today')}</h3><p>{t('manual_priorities')}</p></div><span className="queue-count">{attention.length}</span></div>
        {attention.length ? <div className="client-list">{attention.map((client) => <ClientRow client={client} key={client.relationshipId} onOpen={onOpenClient}/>)}</div> : <div className="portfolio-empty"><span>✓</span><div><b>{t('no_urgent_priorities')}</b><p>{t('no_urgent_priorities_detail')}</p></div></div>}
      </section>
      <section className="panel review-panel">
        <div className="panel-heading"><div><h3>{t('upcoming_reviews')}</h3><p>{t('next_7_days')}</p></div></div>
        {upcoming.length ? <div className="review-list">{upcoming.map((client) => <button key={client.relationshipId} onClick={() => onOpenClient(client)}><span>{new Date(`${client.nextReviewOn}T12:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}</span><div><b>{client.displayName}</b><small>{client.tags.slice(0, 2).join(' · ') || t('no_tags')}</small></div><i>›</i></button>)}</div> : <div className="portfolio-empty compact"><span>○</span><div><b>{t('available_week')}</b><p>{t('no_scheduled_reviews')}</p></div></div>}
        {!clients.length && <button className="button mint full" onClick={onInvite}>{t('invite_first_client')}</button>}
      </section>
    </div>
  </>;
}
function ClientRow({ client, onOpen }) {
    const { locale, t } = useI18n();
    const permissionCount = Object.values(client.permissions).filter(Boolean).length;
    const status = portfolioStatus(client, t);
    const signals = clientSignals(client, t);
    return <button type="button" className="client-row" onClick={() => onOpen(client)}><span className="client-avatar">{client.displayName.charAt(0).toUpperCase()}</span><span className="client-copy"><b>{client.displayName}</b><small>{signals[0]?.label ?? (client.lastSyncAt ? t('synced_date', { date: new Date(client.lastSyncAt).toLocaleDateString(locale) }) : t('since_date', { date: new Date(client.startedAt).toLocaleDateString(locale) }))}</small>{client.tags?.length ? <span className="mini-tags">{client.tags.slice(0, 2).map((tag) => <em key={tag}>{tag}</em>)}</span> : null}</span><span className={`portfolio-pill ${status}`}>{t(status)}</span><span className="client-metric">{client.currentWeightKg ? <><b>{client.currentWeightKg} kg</b><small>{t('latest_weight')}</small></> : <><b>{permissionCount}/4</b><small>{t('permissions')}</small></>}</span><span className="row-arrow">›</span></button>;
}
function EmptyClients({ onInvite }) {
    const { t } = useI18n();
    return <div className="empty-state"><span>◎</span><h4>{t('no_connected_clients')}</h4><p>{t('no_connected_clients_detail')}</p><button className="text-link" onClick={onInvite}>{t('create_invitation')}</button></div>;
}
function ClientsView({ clients, onInvite, onOpenClient }) {
    const { language, t } = useI18n();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const normalizedQuery = query.trim().toLocaleLowerCase(language);
    const visibleClients = clients.filter((client) => {
        const matchesQuery = !normalizedQuery || `${client.displayName} ${(client.tags ?? []).join(' ')}`.toLocaleLowerCase(language).includes(normalizedQuery);
        const status = portfolioStatus(client, t);
        return matchesQuery && (filter === 'all' || filter === status);
    }).sort((a, b) => {
        const rank = { needs_attention: 0, following: 1, up_to_date: 2 };
        return rank[portfolioStatus(a, t)] - rank[portfolioStatus(b, t)] || a.displayName.localeCompare(b.displayName, language);
    });
    const filters = [['all', t('all')], ['needs_attention', t('need_attention_plural')], ['following', t('following')], ['up_to_date', t('up_to_date')]];
    return <section className="panel large-panel"><div className="panel-heading"><div><h3>{t('nav_clients')}</h3><p>{t('clients_sorted')}</p></div><button className="button secondary" onClick={onInvite}>{t('invite_client')}</button></div>{clients.length ? <><div className="client-toolbar"><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search_client')}/></label><div className="portfolio-filters">{filters.map(([value, label]) => <button type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>{label}</button>)}</div></div><div className="client-list expanded">{visibleClients.length ? visibleClients.map((client) => <ClientRow client={client} key={client.relationshipId} onOpen={onOpenClient}/>) : <div className="portfolio-empty"><span>⌕</span><div><b>{t('no_results')}</b><p>{t('no_results_detail')}</p></div></div>}</div></> : <EmptyClients onInvite={onInvite}/>}</section>;
}
function InvitationsView({ invites, onRefresh, onInvite }) {
    const { locale, t } = useI18n();
    const [busyId, setBusyId] = useState('');
    async function revoke(id) {
        setBusyId(id);
        try {
            await revokeProfessionalInvite(id);
            await onRefresh();
        }
        finally {
            setBusyId('');
        }
    }
    return <section className="panel large-panel"><div className="panel-heading"><div><h3>{t('nav_invitations')}</h3><p>{t('manage_invites')}</p></div><button className="button secondary" onClick={onInvite}>{t('new_invitation')}</button></div><div className="invite-table">{invites.length ? invites.map((invite) => {
            const expired = new Date(invite.expiresAt) < new Date();
            const statusKey = invite.acceptedAt ? 'accepted' : invite.revokedAt ? 'revoked' : expired ? 'expired' : 'active';
            const active = statusKey === 'active';
            return <article key={invite.id}><span className={`status-dot ${active ? 'active' : ''}`}/><div><b>{t('invitation', { id: invite.id.slice(0, 8) })}</b><small>{t('created_on', { date: new Date(invite.createdAt).toLocaleDateString(locale) })}</small></div><span className={`status-pill ${active ? 'active' : ''}`}>{t(statusKey)}</span>{active ? <button className="text-button danger" disabled={busyId === invite.id} onClick={() => revoke(invite.id)}>{t('revoke')}</button> : <span />}</article>;
        }) : <div className="empty-state compact"><span>↗</span><h4>{t('no_invites')}</h4><button className="text-link" onClick={onInvite}>{t('create_first')}</button></div>}</div></section>;
}
function SettingsView({ session, profile, onSaved }) {
    const { t } = useI18n();
    return <div className="settings-grid"><section className="panel"><div className="panel-heading"><div><h3>{t('professional_profile')}</h3><p>{t('profile_visible_invites')}</p></div></div><ProfileFields initial={profile} submitLabel={t('save_changes')} onSubmit={async (input) => onSaved(await saveProfessionalProfile(session.user.id, input))}/></section><aside className="verification-card"><span>◆</span><p className="eyebrow">{t('verification')}</p><h3>{profile.verificationStatus === 'verified' ? t('verified_profile') : t('pending_validation')}</h3><p>{t('verification_future')}</p></aside></div>;
}
const dashboardPaths = {
    summary: '/dashboard',
    clients: '/dashboard/clients',
    invitations: '/dashboard/invitations',
    settings: '/dashboard/settings',
};
function Dashboard({ session, profile, onProfileSaved, initialView }) {
    const { locale, t } = useI18n();
    const router = useRouter();
    const [view, setView] = useState(initialView);
    const [clients, setClients] = useState([]);
    const [invites, setInvites] = useState([]);
    const [busy, setBusy] = useState(true);
    const [notice, setNotice] = useState('');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [revision, setRevision] = useState(0);
    const [connectionState, setConnectionState] = useState('connecting');
    const [lastUpdated, setLastUpdated] = useState(null);
    const refresh = useCallback(async () => {
        setNotice('');
        try {
            const overview = await getProfessionalOverview(session.user.id);
            setInvites(overview.invites);
            const hasActiveClients = overview.relationships.some((relationship) => relationship.status === 'active');
            if (!hasActiveClients) {
                setClients([]);
                return;
            }
            try {
                setClients(await getProfessionalClients());
            }
            catch (error) {
                setClients([]);
                setNotice(friendlyError(error, t));
            }
        }
        catch (error) {
            setNotice(friendlyError(error, t));
        }
        finally {
            setBusy(false);
            setLastUpdated(new Date());
        }
    }, [session.user.id, t]);
    useEffect(() => { void refresh(); }, [refresh]);
    useEffect(() => subscribeToProfessionalUpdates(session.user.id, (event) => {
        if (event.type === 'connection') {
            setConnectionState(event.status === 'SUBSCRIBED' ? 'live' : 'connecting');
            return;
        }
        setRevision((value) => value + 1);
        void refresh();
    }), [refresh, session.user.id]);
    useEffect(() => {
        const requestedClient = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('client');
        if (requestedClient && clients.length) setSelectedClient(clients.find((client) => client.clientId === requestedClient) ?? null);
    }, [clients]);
    function openClient(client) {
        setSelectedClient(client);
        setView('clients');
        router.push(`/dashboard/clients?client=${encodeURIComponent(client.clientId)}`);
    }
    function closeClient() {
        setSelectedClient(null);
        router.push('/dashboard/clients');
        void refresh();
    }
    const firstName = profile.publicName.split(' ')[0];
    const titles = { summary: t('nav_summary'), clients: t('nav_clients'), invitations: t('nav_invitations'), settings: t('nav_settings') };
    const nav = useMemo(() => [['summary', '⌂', t('nav_summary')], ['clients', '◎', t('nav_clients')], ['invitations', '↗', t('nav_invitations')], ['settings', '⚙', t('nav_settings')]], [t]);
    return <div className="dashboard-shell">
    <aside className="sidebar"><Brand /><nav>{nav.map(([id, icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setSelectedClient(null); setView(id); router.push(dashboardPaths[id]); }}><span>{icon}</span><b>{label}</b></button>)}</nav><div className="side-account"><span>{profile.publicName.charAt(0).toUpperCase()}</span><div><b>{profile.publicName}</b><small>{professionLabel(profile.profession, t)}</small></div><button aria-label={t('sign_out')} onClick={() => supabase.auth.signOut()}>↪</button></div></aside>
    <main className="dashboard-main">
      <header className="topbar"><Brand compact/><h1>{selectedClient ? selectedClient.displayName : titles[view]}</h1><div><LanguageSwitcher /><span className={`sync-indicator ${connectionState}`}><i/> {connectionState === 'live' ? t('live') : t('connecting')}</span><span className={`verification ${profile.verificationStatus}`}>● {profile.verificationStatus === 'verified' ? t('verified') : t('unverified')}</span><button className="button secondary" onClick={() => setInviteOpen(true)}>{t('invite_client')}</button></div></header>
      <div className="dashboard-content">
        {!selectedClient && <div className="welcome"><div><p className="eyebrow">{t('workspace')}</p><h2>{view === 'summary' ? t('good_morning', { name: firstName }) : titles[view]}</h2><p>{view === 'summary' ? t('summary_intro') : t('management_intro')}</p>{lastUpdated && <small className="last-updated">{t('updated_at', { time: lastUpdated.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</small>}</div>{view === 'summary' && <button className="button primary" onClick={() => setInviteOpen(true)}>{t('invite_new_client')}</button>}</div>}
        {notice && <div className="notice error dashboard-notice">{notice}</div>}
        {busy ? <div className="content-loader"><span className="loader dark"/>{t('loading_information')}</div> : <>
          {view === 'summary' && <SummaryView clients={clients} invites={invites} onInvite={() => setInviteOpen(true)} onOpenClient={openClient}/>}
          {view === 'clients' && (selectedClient ? <ClientDetailView client={selectedClient} revision={revision} onBack={closeClient}/> : <ClientsView clients={clients} onInvite={() => setInviteOpen(true)} onOpenClient={openClient}/>)}
          {view === 'invitations' && <InvitationsView invites={invites} onRefresh={refresh} onInvite={() => setInviteOpen(true)}/>}
          {view === 'settings' && <SettingsView session={session} profile={profile} onSaved={onProfileSaved}/>}
        </>}
      </div>
    </main>
    {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onCreated={refresh}/>}
  </div>;
}
export default function CalorfyProApp({ initialView = 'summary' }) {
    const router = useRouter();
    const pathname = usePathname();
    const [screen, setScreen] = useState('loading');
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const routeSession = useCallback(async (nextSession) => {
        setSession(nextSession);
        if (!nextSession) {
            setProfile(null);
            setScreen('auth');
            if (pathname !== '/login') router.replace('/login');
            return;
        }
        setScreen('loading');
        try {
            const nextProfile = await getProfessionalProfile(nextSession.user.id);
            setProfile(nextProfile);
            setScreen(nextProfile ? 'dashboard' : 'onboarding');
            if (!nextProfile && pathname !== '/onboarding') router.replace('/onboarding');
            if (nextProfile && (pathname === '/login' || pathname === '/onboarding')) router.replace('/dashboard');
        }
        catch {
            setScreen('auth');
        }
    }, [pathname, router]);
    useEffect(() => {
        if (!isSupabaseConfigured)
            return;
        void supabase.auth.getSession().then(({ data }) => routeSession(data.session));
        const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
            if (event === 'SIGNED_OUT')
                void routeSession(null);
        });
        return () => data.subscription.unsubscribe();
    }, [routeSession]);
    if (!isSupabaseConfigured)
        return <ConfigurationScreen />;
    if (screen === 'loading')
        return <LoadingScreen />;
    if (screen === 'auth')
        return <AuthScreen onAuthenticated={routeSession}/>;
    if (screen === 'onboarding' && session)
        return <OnboardingScreen session={session} onComplete={(nextProfile) => { setProfile(nextProfile); setScreen('dashboard'); router.replace('/dashboard'); }}/>;
    if (screen === 'dashboard' && session && profile)
        return <Dashboard session={session} profile={profile} onProfileSaved={setProfile} initialView={initialView}/>;
    return <LoadingScreen />;
}
