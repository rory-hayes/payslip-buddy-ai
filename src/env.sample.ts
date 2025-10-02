/**
 * Environment Variables Documentation
 * 
 * This file documents the environment variables used in this project.
 * For Lovable builds, these are automatically configured.
 * For non-Lovable builds (e.g., local development), create a .env file with these values.
 * 
 * Example .env file:
 * 
 * VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
 * VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
 * VITE_SUPABASE_PROJECT_ID=your-project-id
 */

// TypeScript interface for type safety (optional)
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
