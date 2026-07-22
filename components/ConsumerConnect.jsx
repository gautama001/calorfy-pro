'use client';

import { useEffect, useState } from 'react';
import { acceptProfessionalInvite, previewProfessionalInvite } from '../lib/professionals';
import { supabase } from '../lib/supabase';

const initialPermissions = { diary: false, weight: false, goals: false, photos: false };

function readableError(reason) {
  const message = reason instanceof Error
    ? reason.message
    : reason && typeof reason === 'object'
      ? [reason.message, reason.details, reason.hint].filter(Boolean).join(' · ')
      : String(reason ?? '');
  if (message.includes('Invitation is invalid or expired')) return 'La invitación venció, fue utilizada o ya no está disponible.';
  if (message.includes('A professional cannot invite their own account')) return 'Abriste la invitación con la cuenta profesional. Cerrá sesión e ingresá con tu cuenta personal de Calorfy.';
  if (message.includes('Invalid login credentials')) return 'El correo o la contraseña no son correctos.';
  return message || 'No pudimos completar la conexión.';
}

function Brand() {
  return <a className="brand" href="https://calorfy.com"><span className="brand-mark" aria-hidden="true"/><span>Calorfy</span></a>;
}

export default function ConsumerConnect({ token }) {
  const [session, setSession] = useState(null);
  const [preview, setPreview] = useState(null);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [stage, setStage] = useState('loading');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadInvite(nextSession) {
    setSession(nextSession);
    if (!nextSession) {
      setStage('auth');
      return;
    }
    setStage('loading');
    setNotice('');
    try {
      const nextPreview = await previewProfessionalInvite(token);
      if (!nextPreview) throw new Error('Invitation is invalid or expired');
      setPreview(nextPreview);
      setStage('consent');
    } catch (reason) {
      setNotice(readableError(reason));
      setStage('error');
    }
  }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => loadInvite(data.session));
  }, [token]);

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    const form = new FormData(event.currentTarget);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(form.get('email') ?? '').trim(),
        password: String(form.get('password') ?? ''),
      });
      if (error) throw error;
      await loadInvite(data.session);
    } catch (reason) {
      setNotice(readableError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    setBusy(true);
    setNotice('');
    try {
      await acceptProfessionalInvite(token, permissions);
      setStage('success');
    } catch (reason) {
      setNotice(readableError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function changeAccount() {
    await supabase.auth.signOut();
    setSession(null);
    setPreview(null);
    setNotice('');
    setStage('auth');
  }

  return <main className="connect-page">
    <header><Brand/><span>Conexión profesional segura</span></header>
    <section className="connect-card">
      {stage === 'loading' && <div className="connect-loading"><span className="loader dark"/><p>Validando invitación…</p></div>}

      {stage === 'auth' && <>
        <p className="eyebrow">Invitación privada</p>
        <h1>Ingresá con tu cuenta personal</h1>
        <p className="connect-lead">Usá la misma cuenta que utilizás en Calorfy. La cuenta profesional que generó el enlace no puede aceptarlo.</p>
        {notice && <div className="notice error">{notice}</div>}
        <form className="form-grid" onSubmit={login}>
          <label>Correo electrónico<input name="email" required type="email" autoComplete="email"/></label>
          <label>Contraseña<input name="password" required type="password" autoComplete="current-password"/></label>
          <button className="button primary full" disabled={busy}>{busy ? 'Ingresando…' : 'Continuar'}</button>
        </form>
      </>}

      {stage === 'consent' && preview && <>
        <p className="eyebrow">Elegís qué compartir</p>
        <h1>{preview.professionalName} quiere acompañarte</h1>
        <div className="professional-preview">
          <span>{preview.professionalName.charAt(0).toUpperCase()}</span>
          <div><b>{preview.professionalName}</b><small>{preview.profession === 'nutritionist' ? 'Nutricionista' : 'Entrenador/a personal'}{preview.organizationName ? ` · ${preview.organizationName}` : ''}</small></div>
          <i>{preview.verificationStatus === 'verified' ? 'Verificado' : 'Sin verificar'}</i>
        </div>
        <p className="connect-lead">Podés modificar o revocar estos permisos más adelante desde Calorfy.</p>
        <div className="permission-list">
          {[
            ['diary', 'Diario de comidas', 'Comidas, cantidades y nutrientes registrados.'],
            ['weight', 'Progreso de peso', 'Pesos guardados y evolución en el tiempo.'],
            ['goals', 'Objetivos', 'Meta de peso y objetivo calórico actual.'],
            ['photos', 'Fotos', 'Imágenes que decidas conservar en el diario.'],
          ].map(([key, title, description]) => <label key={key}>
            <span><b>{title}</b><small>{description}</small></span>
            <input type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions((current) => ({ ...current, [key]: event.target.checked }))}/>
          </label>)}
        </div>
        {notice && <div className="notice error">{notice}</div>}
        <button className="button primary full" onClick={connect} disabled={busy}>{busy ? 'Conectando…' : 'Aceptar y conectar'}</button>
        <button className="text-button connect-account" onClick={changeAccount}>No soy {session?.user.email} · cambiar cuenta</button>
      </>}

      {stage === 'success' && <div className="connect-success">
        <span>✓</span><p className="eyebrow">Conexión completada</p><h1>Ya estás conectado</h1>
        <p>El profesional solamente podrá consultar los datos que autorizaste. Ya podés volver a Calorfy.</p>
        <a className="button primary full" href="https://calorfy.com">Volver a Calorfy</a>
      </div>}

      {stage === 'error' && <div className="connect-success error-state">
        <span>!</span><p className="eyebrow">No disponible</p><h1>No pudimos abrir la invitación</h1>
        <div className="notice error">{notice}</div>
        {session && <button className="button secondary full" onClick={changeAccount}>Cambiar cuenta</button>}
      </div>}
    </section>
    <footer>La relación no concede acceso automático. Vos controlás cada permiso.</footer>
  </main>;
}
