'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createProfessionalInvite, getProfessionalClients, getProfessionalOverview, getProfessionalProfile, professionalInviteUrl, revokeProfessionalInvite, saveProfessionalProfile, subscribeToProfessionalUpdates, } from '../lib/professionals';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import ClientDetailView from './ClientDetailView';
const countries = [
    ['AR', 'Argentina'], ['BR', 'Brasil'], ['CL', 'Chile'], ['CO', 'Colombia'],
    ['MX', 'México'], ['PE', 'Perú'], ['UY', 'Uruguay'], ['OTHER', 'Otro'],
];
function friendlyError(error) {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : error && typeof error === 'object'
                ? [error.message, error.details, error.hint, error.code].filter(Boolean).join(' · ')
                : '';
    if (message.includes('Invalid login credentials'))
        return 'El correo o la contraseña no son correctos.';
    if (message.includes('Email not confirmed'))
        return 'Confirmá tu correo antes de ingresar.';
    if (message.includes('already registered'))
        return 'Ya existe una cuenta con ese correo.';
    if (message.includes('Too many active invitations'))
        return 'Ya tenés 10 invitaciones abiertas. Revocá alguna antes de crear otra.';
    if (message.includes('get_professional_client_summaries'))
        return 'El modelo seguro de clientes todavía no fue aplicado en Supabase.';
    if (message.includes('get_professional_client_detail') || message.includes('professional_client_sync_state'))
        return 'Falta aplicar la actualización de datos en vivo del portal profesional.';
    return message || 'Ocurrió un error inesperado.';
}
function professionLabel(profession) {
    return profession === 'nutritionist' ? 'Nutricionista' : 'Entrenador/a personal';
}
function Brand({ compact = false }) {
    return <a className="brand" href="/"><span className="brand-mark" aria-hidden="true"/>{!compact && <><span>Calorfy</span><small>PRO</small></>}</a>;
}
function LoadingScreen() {
    return <main className="loading-screen"><Brand /><span className="loader" aria-label="Cargando"/></main>;
}
function ConfigurationScreen() {
    return (<main className="configuration-screen">
      <div className="configuration-card">
        <Brand />
        <span className="config-icon">⚙</span>
        <p className="eyebrow">Configuración pendiente</p>
        <h1>Conectemos Calorfy Pro con Supabase.</h1>
        <p>Agregá <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> en las variables del despliegue y volvé a compilar.</p>
      </div>
    </main>);
}
function AuthScreen({ onAuthenticated }) {
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
                    setNotice({ type: 'success', text: 'Cuenta creada. Revisá tu correo para confirmarla y luego ingresá.' });
            }
            else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error)
                    throw error;
                onAuthenticated(data.session);
            }
        }
        catch (error) {
            setNotice({ type: 'error', text: friendlyError(error) });
        }
        finally {
            setBusy(false);
        }
    }
    return (<main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <p className="eyebrow">Seguimiento profesional conectado</p>
          <h1>Más contexto para acompañar mejor.</h1>
          <p>El espacio de trabajo para profesionales que necesitan entender la evolución de sus clientes entre consultas.</p>
          <div className="story-points">
            <article><span>◎</span><b>Progreso longitudinal</b></article>
            <article><span>↗</span><b>Hábitos reales</b></article>
            <article><span>⌁</span><b>Permisos revocables</b></article>
          </div>
        </div>
        <footer><span>Datos protegidos por permisos granulares.</span><a href="https://calorfy.com">Volver a Calorfy.com</a></footer>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">Portal profesional</p>
          <h2>{mode === 'login' ? 'Bienvenido de nuevo' : 'Creá tu cuenta profesional'}</h2>
          <p>{mode === 'login' ? 'Ingresá para continuar con tus clientes.' : 'Empezá a construir tu espacio de seguimiento.'}</p>
          <div className="auth-tabs" role="tablist">
            <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => { setMode('login'); setNotice(null); }}>Ingresar</button>
            <button className={mode === 'signup' ? 'active' : ''} type="button" onClick={() => { setMode('signup'); setNotice(null); }}>Crear cuenta</button>
          </div>
          {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
          <form className="form-grid" onSubmit={submit}>
            {mode === 'signup' && <label>Nombre y apellido<input name="displayName" required minLength={2} autoComplete="name" placeholder="Ej. Laura Méndez"/></label>}
            <label>Correo electrónico<input name="email" required type="email" autoComplete="email" placeholder="nombre@consultorio.com"/></label>
            <label>Contraseña<input name="password" required type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="Mínimo 8 caracteres"/></label>
            <button className="button primary full" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
          </form>
          <small className="legal">Al continuar aceptás las condiciones de uso y la política de privacidad.</small>
        </div>
      </section>
    </main>);
}
function ProfileFields({ initial, submitLabel, onSubmit }) {
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
            setNotice({ type: 'success', text: 'Perfil guardado correctamente.' });
        }
        catch (error) {
            setNotice({ type: 'error', text: friendlyError(error) });
        }
        finally {
            setBusy(false);
        }
    }
    return (<form className="form-grid" onSubmit={submit}>
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      <label>Profesión<select name="profession" defaultValue={initial?.profession ?? 'nutritionist'}><option value="nutritionist">Nutricionista</option><option value="personal_trainer">Entrenador/a personal</option></select></label>
      <label>Nombre público<input name="publicName" required minLength={2} maxLength={80} defaultValue={initial?.publicName ?? ''} placeholder="Lic. Laura Méndez"/></label>
      <div className="field-row">
        <label>País<select name="countryCode" defaultValue={initial?.countryCode ?? 'AR'}>{countries.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Matrícula (opcional)<input name="licenseNumber" maxLength={80} defaultValue={initial?.licenseNumber ?? ''} placeholder="MN 12345"/></label>
      </div>
      <label>Consultorio u organización (opcional)<input name="organizationName" maxLength={120} defaultValue={initial?.organizationName ?? ''} placeholder="Centro Integral Salud"/></label>
      <p className="form-hint">La matrícula solo se mostrará como verificada después de completar la validación.</p>
      <button className="button primary full" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
    </form>);
}
function OnboardingScreen({ session, onComplete }) {
    return (<main className="onboarding-page">
      <header><Brand /><button className="text-button" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button></header>
      <section className="onboarding-card">
        <aside>
          <span className="pro-pill">CONFIGURACIÓN</span>
          <h1>Creemos tu espacio profesional.</h1>
          <p>Estos datos identifican tu perfil ante las personas que invites.</p>
          <ol><li><b>1</b> Perfil profesional</li><li><b>2</b> Verificación</li><li><b>3</b> Primer cliente</li></ol>
        </aside>
        <div className="onboarding-form">
          <p className="eyebrow">Paso 1 de 3</p>
          <h2>Información profesional</h2>
          <p>Podrás actualizarla más adelante.</p>
          <ProfileFields submitLabel="Crear espacio profesional" onSubmit={async (input) => onComplete(await saveProfessionalProfile(session.user.id, input))}/>
        </div>
      </section>
    </main>);
}
function InviteModal({ onClose, onCreated }) {
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
            setError(friendlyError(reason));
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
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        <span className="modal-icon">↗</span>
        <p className="eyebrow">Conexión privada</p>
        <h2 id="invite-title">Invitá a un cliente</h2>
        <p>El enlace es de un solo uso, vence en siete días y no comparte ningún dato hasta que la persona autorice los permisos.</p>
        {error && <div className="notice error">{error}</div>}
        {!link ? <button className="button primary full" disabled={busy} onClick={create}>{busy ? 'Generando…' : 'Generar invitación segura'}</button> : <div className="generated-link"><code>{link}</code><button className="button primary full" onClick={copy}>Copiar enlace</button><small>Por seguridad, este enlace solo se muestra ahora.</small></div>}
      </section>
    </div>);
}
function SummaryView({ clients, invites, onInvite, onOpenClient }) {
    const activeInvites = invites.filter((invite) => !invite.acceptedAt && !invite.revokedAt && new Date(invite.expiresAt) > new Date());
    const sharedWeight = clients.filter((client) => client.permissions.weight).length;
    return <>
    <div className="stats-grid">
      <article className="stat-card"><header><span>Clientes activos</span><i>◎</i></header><strong>{clients.length}</strong><small>con acceso autorizado</small></article>
      <article className="stat-card"><header><span>Invitaciones abiertas</span><i>↗</i></header><strong>{activeInvites.length}</strong><small>pendientes de aceptar</small></article>
      <article className="stat-card"><header><span>Comparten progreso</span><i>⌁</i></header><strong>{sharedWeight}</strong><small>clientes con permiso de peso</small></article>
    </div>
    <div className="summary-grid">
      <section className="panel">
        <div className="panel-heading"><div><h3>Clientes recientes</h3><p>Información habilitada por cada persona</p></div></div>
        {clients.length ? <div className="client-list">{clients.slice(0, 5).map((client) => <ClientRow client={client} key={client.relationshipId} onOpen={onOpenClient}/>)}</div> : <EmptyClients onInvite={onInvite}/>}
      </section>
      <aside className="invite-card"><p className="eyebrow">Nueva conexión</p><h3>Sumá tu primer cliente</h3><p>Creá una invitación privada y dejá que la persona elija qué información compartir.</p><button className="button mint full" onClick={onInvite}>Generar invitación</button><div className="privacy-copy"><span>◆</span><small>La relación profesional por sí sola no habilita datos de salud.</small></div></aside>
    </div>
  </>;
}
function ClientRow({ client, onOpen }) {
    const permissionCount = Object.values(client.permissions).filter(Boolean).length;
    return <button type="button" className="client-row" onClick={() => onOpen(client)}><span className="client-avatar">{client.displayName.charAt(0).toUpperCase()}</span><span className="client-copy"><b>{client.displayName}</b><small>Desde {new Date(client.startedAt).toLocaleDateString('es-AR')}</small></span><span className="client-metric">{client.currentWeightKg ? <><b>{client.currentWeightKg} kg</b><small>Último peso</small></> : <><b>{permissionCount}/4</b><small>Permisos</small></>}</span><span className="row-arrow">›</span></button>;
}
function EmptyClients({ onInvite }) {
    return <div className="empty-state"><span>◎</span><h4>Todavía no hay clientes conectados</h4><p>Creá una invitación segura para vincular a tu primera persona.</p><button className="text-link" onClick={onInvite}>Crear invitación →</button></div>;
}
function ClientsView({ clients, onInvite, onOpenClient }) {
    return <section className="panel large-panel"><div className="panel-heading"><div><h3>Clientes</h3><p>Datos visibles según los permisos vigentes</p></div><button className="button secondary" onClick={onInvite}>+ Invitar cliente</button></div>{clients.length ? <div className="client-list expanded">{clients.map((client) => <ClientRow client={client} key={client.relationshipId} onOpen={onOpenClient}/>)}</div> : <EmptyClients onInvite={onInvite}/>}</section>;
}
function InvitationsView({ invites, onRefresh, onInvite }) {
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
    return <section className="panel large-panel"><div className="panel-heading"><div><h3>Invitaciones</h3><p>Administrá enlaces emitidos desde tu cuenta</p></div><button className="button secondary" onClick={onInvite}>+ Nueva invitación</button></div><div className="invite-table">{invites.length ? invites.map((invite) => {
            const expired = new Date(invite.expiresAt) < new Date();
            const status = invite.acceptedAt ? 'Aceptada' : invite.revokedAt ? 'Revocada' : expired ? 'Vencida' : 'Activa';
            const active = status === 'Activa';
            return <article key={invite.id}><span className={`status-dot ${active ? 'active' : ''}`}/><div><b>Invitación {invite.id.slice(0, 8)}</b><small>Creada el {new Date(invite.createdAt).toLocaleDateString('es-AR')}</small></div><span className={`status-pill ${active ? 'active' : ''}`}>{status}</span>{active ? <button className="text-button danger" disabled={busyId === invite.id} onClick={() => revoke(invite.id)}>Revocar</button> : <span />}</article>;
        }) : <div className="empty-state compact"><span>↗</span><h4>No emitiste invitaciones todavía</h4><button className="text-link" onClick={onInvite}>Crear la primera →</button></div>}</div></section>;
}
function SettingsView({ session, profile, onSaved }) {
    return <div className="settings-grid"><section className="panel"><div className="panel-heading"><div><h3>Perfil profesional</h3><p>Información visible en tus invitaciones</p></div></div><ProfileFields initial={profile} submitLabel="Guardar cambios" onSubmit={async (input) => onSaved(await saveProfessionalProfile(session.user.id, input))}/></section><aside className="verification-card"><span>◆</span><p className="eyebrow">Verificación</p><h3>{profile.verificationStatus === 'verified' ? 'Perfil verificado' : 'Validación pendiente'}</h3><p>La verificación de matrícula e identidad será habilitada en una próxima etapa. Tu perfil puede operar mientras tanto como no verificado.</p></aside></div>;
}
const dashboardPaths = {
    summary: '/dashboard',
    clients: '/dashboard/clients',
    invitations: '/dashboard/invitations',
    settings: '/dashboard/settings',
};
function Dashboard({ session, profile, onProfileSaved, initialView }) {
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
                setNotice(friendlyError(error));
            }
        }
        catch (error) {
            setNotice(friendlyError(error));
        }
        finally {
            setBusy(false);
            setLastUpdated(new Date());
        }
    }, [session.user.id]);
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
    }
    const firstName = profile.publicName.split(' ')[0];
    const titles = { summary: 'Resumen', clients: 'Clientes', invitations: 'Invitaciones', settings: 'Ajustes' };
    const nav = useMemo(() => [['summary', '⌂', 'Resumen'], ['clients', '◎', 'Clientes'], ['invitations', '↗', 'Invitaciones'], ['settings', '⚙', 'Ajustes']], []);
    return <div className="dashboard-shell">
    <aside className="sidebar"><Brand /><nav>{nav.map(([id, icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setSelectedClient(null); setView(id); router.push(dashboardPaths[id]); }}><span>{icon}</span><b>{label}</b></button>)}</nav><div className="side-account"><span>{profile.publicName.charAt(0).toUpperCase()}</span><div><b>{profile.publicName}</b><small>{professionLabel(profile.profession)}</small></div><button aria-label="Cerrar sesión" onClick={() => supabase.auth.signOut()}>↪</button></div></aside>
    <main className="dashboard-main">
      <header className="topbar"><Brand compact/><h1>{selectedClient ? selectedClient.displayName : titles[view]}</h1><div><span className={`sync-indicator ${connectionState}`}><i/> {connectionState === 'live' ? 'EN VIVO' : 'CONECTANDO'}</span><span className={`verification ${profile.verificationStatus}`}>● {profile.verificationStatus === 'verified' ? 'VERIFICADO' : 'SIN VERIFICAR'}</span><button className="button secondary" onClick={() => setInviteOpen(true)}>+ Invitar cliente</button></div></header>
      <div className="dashboard-content">
        {!selectedClient && <div className="welcome"><div><p className="eyebrow">Tu espacio de trabajo</p><h2>{view === 'summary' ? `Buenos días, ${firstName}` : titles[view]}</h2><p>{view === 'summary' ? 'Un resumen claro del acompañamiento de tus clientes.' : 'Gestión segura del trabajo profesional.'}</p>{lastUpdated && <small className="last-updated">Actualizado {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</small>}</div>{view === 'summary' && <button className="button primary" onClick={() => setInviteOpen(true)}>+ Invitar nuevo cliente</button>}</div>}
        {notice && <div className="notice error dashboard-notice">{notice}</div>}
        {busy ? <div className="content-loader"><span className="loader dark"/>Cargando información…</div> : <>
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
