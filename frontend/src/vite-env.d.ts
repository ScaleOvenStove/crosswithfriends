/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV?: string;
  readonly VITE_USE_LOCAL_SERVER?: string;
  readonly VITE_STAGING_API_URL?: string;
  readonly VITE_API_URL?: string;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
