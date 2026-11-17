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
  /** Solo se cambia en las pruebas de integración (Telegram simulado). */
  get telegramApiRoot() {
    return (process.env.TELEGRAM_API_ROOT || "https://api.telegram.org").replace(/\/$/, "");
  },
  get openaiBaseUrl() {
    return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  },
  get openaiKey() {
    return process.env.OPENAI_API_KEY ?? null;
  },
  get cronSecret() {
    return req("CRON_SECRET");
  },
};
