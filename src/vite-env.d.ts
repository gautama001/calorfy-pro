/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_CONSUMER_CONNECT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
