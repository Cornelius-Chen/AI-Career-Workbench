declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CAREER_WORKER_TOKEN_SHA256?: string;
    CAREER_OWNER_EMAIL: string;
    BUCKET?: R2Bucket;
  }
}

interface ImportMeta { readonly env: {readonly DEV:boolean} }
