'use client';

import { useEffect, useState } from 'react';
import { acceptProfessionalInvite, previewProfessionalInvite } from '../lib/professionals';
import { supabase } from '../lib/supabase';
import { useI18n } from './I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';

const initialPermissions = { diary: false, weight: false, goals: false, photos: false };

function readableError(reason, t) {
  const message = reason instanceof Error
    ? reason.message
    : reason && typeof reason === 'object'
      ? [reason.message, reason.details, reason.hint].filter(Boolean).join(' · ')
      : String(reason ?? '');
  if (message.includes('Invitation is invalid or expired')) return t('invitation_expired');
  if (message.includes('A professional cannot invite their own account')) return t('professional_own_account');
  if (message.includes('Invalid login credentials')) return t('invalid_credentials');
  return message || t('connection_error');
}

function Brand() {
  return <a className="brand" href="https://calorfy.com"><span className="brand-mark" aria-hidden="true"/><span>Calorfy</span></a>;
}

export default function ConsumerConnect({ token }) {
  const { t } = useI18n();
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
      setNotice(readableError(reason, t));
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
      setNotice(readableError(reason, t));
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
      setNotice(readableError(reason, t));
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
    <header><Brand/><span>{t('secure_connection')}</span><LanguageSwitcher compact/></header>
    <section className="connect-card">
      {stage === 'loading' && <div className="connect-loading"><span className="loader dark"/><p>{t('validating_invitation')}</p></div>}

      {stage === 'auth' && <>
        <p className="eyebrow">{t('private_invitation')}</p>
        <h1>{t('personal_account_login')}</h1>
        <p className="connect-lead">{t('personal_account_intro')}</p>
        {notice && <div className="notice error">{notice}</div>}
        <form className="form-grid" onSubmit={login}>
          <label>{t('email')}<input name="email" required type="email" autoComplete="email"/></label>
          <label>{t('password')}<input name="password" required type="password" autoComplete="current-password"/></label>
          <button className="button primary full" disabled={busy}>{busy ? t('signing_in') : t('continue')}</button>
        </form>
      </>}

      {stage === 'consent' && preview && <>
        <p className="eyebrow">{t('choose_sharing')}</p>
        <h1>{t('wants_to_support', { name: preview.professionalName })}</h1>
        <div className="professional-preview">
          <span>{preview.professionalName.charAt(0).toUpperCase()}</span>
          <div><b>{preview.professionalName}</b><small>{preview.profession === 'nutritionist' ? t('nutritionist') : t('personal_trainer')}{preview.organizationName ? ` · ${preview.organizationName}` : ''}</small></div>
          <i>{preview.verificationStatus === 'verified' ? t('verified') : t('unverified')}</i>
        </div>
        <p className="connect-lead">{t('permission_control_intro')}</p>
        <div className="permission-list">
          {[
            ['diary', t('food_diary'), t('food_diary_description')],
            ['weight', t('weight_progress'), t('weight_progress_description')],
            ['goals', t('goals'), t('goals_permission_description')],
            ['photos', t('photos'), t('photos_permission_description')],
          ].map(([key, title, description]) => <label key={key}>
            <span><b>{title}</b><small>{description}</small></span>
            <input type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions((current) => ({ ...current, [key]: event.target.checked }))}/>
          </label>)}
        </div>
        {notice && <div className="notice error">{notice}</div>}
        <button className="button primary full" onClick={connect} disabled={busy}>{busy ? t('connecting_account') : t('accept_connect')}</button>
        <button className="text-button connect-account" onClick={changeAccount}>{t('not_this_account', { email: session?.user.email })}</button>
      </>}

      {stage === 'success' && <div className="connect-success">
        <span>✓</span><p className="eyebrow">{t('connection_completed')}</p><h1>{t('now_connected')}</h1>
        <p>{t('connection_success_body')}</p>
        <a className="button primary full" href="https://calorfy.com">{t('return_calorfy')}</a>
      </div>}

      {stage === 'error' && <div className="connect-success error-state">
        <span>!</span><p className="eyebrow">{t('unavailable')}</p><h1>{t('invitation_open_error')}</h1>
        <div className="notice error">{notice}</div>
        {session && <button className="button secondary full" onClick={changeAccount}>{t('change_account')}</button>}
      </div>}
    </section>
    <footer>{t('permission_footer')}</footer>
  </main>;
}
