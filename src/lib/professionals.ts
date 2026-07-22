import { supabase } from './supabase';

export type Profession = 'nutritionist' | 'personal_trainer';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type ProfessionalProfile = {
  userId: string;
  profession: Profession;
  publicName: string;
  countryCode: string | null;
  organizationName: string | null;
  licenseNumber: string | null;
  verificationStatus: VerificationStatus;
};

export type ProfessionalClientSummary = {
  relationshipId: string;
  clientId: string;
  displayName: string;
  startedAt: string;
  permissions: {
    diary: boolean;
    weight: boolean;
    goals: boolean;
    photos: boolean;
  };
  currentWeightKg: number | null;
  lastWeightOn: string | null;
  targetWeightKg: number | null;
  calorieGoal: number | null;
};

export type ProfessionalInvite = {
  id: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type ProfileRow = {
  user_id: string;
  profession: Profession;
  public_name: string;
  country_code: string | null;
  organization_name: string | null;
  license_number: string | null;
  verification_status: VerificationStatus;
};

type ClientSummaryRow = {
  relationship_id: string;
  client_id: string;
  display_name: string;
  started_at: string;
  share_diary: boolean;
  share_weight: boolean;
  share_goals: boolean;
  share_photos: boolean;
  current_weight_kg: number | string | null;
  last_weight_on: string | null;
  target_weight_kg: number | string | null;
  calorie_goal: number | null;
};

function mapProfile(row: ProfileRow): ProfessionalProfile {
  return {
    userId: row.user_id,
    profession: row.profession,
    publicName: row.public_name,
    countryCode: row.country_code,
    organizationName: row.organization_name,
    licenseNumber: row.license_number,
    verificationStatus: row.verification_status,
  };
}

export async function getProfessionalProfile(userId: string) {
  const { data, error } = await supabase
    .from('professional_profiles')
    .select('user_id,profession,public_name,country_code,organization_name,license_number,verification_status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function saveProfessionalProfile(
  userId: string,
  input: Omit<ProfessionalProfile, 'userId' | 'verificationStatus'>,
) {
  const { data, error } = await supabase.rpc('upsert_professional_profile', {
    p_profession: input.profession,
    p_public_name: input.publicName,
    p_country_code: input.countryCode,
    p_organization_name: input.organizationName,
    p_license_number: input.licenseNumber,
  }).single();
  if (error) throw error;
  const saved = data as ProfileRow;
  if (saved.user_id !== userId) throw new Error('La sesión cambió durante el guardado.');
  return mapProfile(saved);
}

export async function createProfessionalInvite() {
  const { data, error } = await supabase.rpc('create_professional_invite');
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('No pudimos crear la invitación.');
  return data;
}

export async function getProfessionalOverview(userId: string) {
  const [relationships, invites] = await Promise.all([
    supabase
      .from('professional_client_relationships')
      .select('id,status,started_at,updated_at')
      .eq('professional_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('professional_invites')
      .select('id,expires_at,accepted_at,revoked_at,created_at')
      .eq('professional_id', userId)
      .order('created_at', { ascending: false }),
  ]);
  if (relationships.error) throw relationships.error;
  if (invites.error) throw invites.error;
  return {
    relationships: relationships.data ?? [],
    invites: (invites.data ?? []).map((invite) => ({
      id: invite.id,
      expiresAt: invite.expires_at,
      acceptedAt: invite.accepted_at,
      revokedAt: invite.revoked_at,
      createdAt: invite.created_at,
    })) satisfies ProfessionalInvite[],
  };
}

export async function getProfessionalClients() {
  const { data, error } = await supabase.rpc('get_professional_client_summaries');
  if (error) throw error;
  return (data ?? []).map((row: ClientSummaryRow) => ({
    relationshipId: row.relationship_id,
    clientId: row.client_id,
    displayName: row.display_name,
    startedAt: row.started_at,
    permissions: {
      diary: row.share_diary,
      weight: row.share_weight,
      goals: row.share_goals,
      photos: row.share_photos,
    },
    currentWeightKg: row.current_weight_kg === null ? null : Number(row.current_weight_kg),
    lastWeightOn: row.last_weight_on,
    targetWeightKg: row.target_weight_kg === null ? null : Number(row.target_weight_kg),
    calorieGoal: row.calorie_goal,
  })) satisfies ProfessionalClientSummary[];
}

export async function revokeProfessionalInvite(inviteId: string) {
  const { error } = await supabase.rpc('revoke_professional_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

export function professionalInviteUrl(token: string) {
  const base = (import.meta.env.VITE_CONSUMER_CONNECT_URL ?? 'https://calorfy.com/connect').replace(/\/$/, '');
  return `${base}/${encodeURIComponent(token)}`;
}
