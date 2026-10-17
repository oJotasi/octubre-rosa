declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    STATS_ACCESS_TOKEN?: string;
    GAME_FRONTEND_ORIGIN?: string;
  }
}
