// Deja corriendo el Supabase/Telegram simulado para probar el panel con `next dev`.
import * as F from "./fakes";
await F.arrancar();
console.log(`Simulador en http://localhost:${F.PUERTO} · SUPABASE_SERVICE_ROLE_KEY=${F.jwt("service_role")}`);
