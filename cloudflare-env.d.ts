declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CAREER_WORKER_TOKEN_SHA256?: string;
    TEAM_FILE_KEY?: string;
    CAREER_FILES?: KVNamespace;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_SESSION_SECRET?: string;
    GITHUB_OWNER_ID?: string;
    GITHUB_BROTHER_ID?: string;
    CAREER_OWNER_EMAIL: string;
    CAREER_BROTHER_EMAIL: string;
  }
}

interface ImportMeta { readonly env: {readonly DEV:boolean} }
