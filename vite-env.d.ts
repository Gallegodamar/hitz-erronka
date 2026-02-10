// Fix: Removed the '/// <reference types="vite/client" />' directive to resolve the "Cannot find type definition file" error.
// Manually defining the ImportMeta interfaces to maintain TypeScript support for Vite environment variables.

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
