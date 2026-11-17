function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const env = {
  get telegramToken() {
    return req("TELEGRAM_BOT_TOKEN");
  },
  get allowedUserId() {
    return Number(req("TELEGRAM_ALLOWED_USER_ID"));
  },
  get webhookSecret() {
    return req("TELEGRAM_WEBHOOK_SECRET");
  },
  get supabaseUrl() {
    return req("SUPABASE_URL");
  },
  get supabaseKey() {
    return req("SUPABASE_SERVICE_ROLE_KEY");
  },
  get anthropicModel() {
    return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  },
  get panelSecret() {
    return req("PANEL_SECRET");
  },
  get appUrl() {
    return req("APP_URL").replace(/\/$/, "");
  },
  get openaiKey() {
    return process.env.OPENAI_API_KEY ?? null;
  },
  get cronSecret() {
    return req("CRON_SECRET");
  },
};
