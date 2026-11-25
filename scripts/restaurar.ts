// Restaura una copia de IVAn (el .json.gz que manda el bot) en un proyecto de Supabase.
// 1. Crea el proyecto y ejecuta las migraciones (supabase/migrations, 001 a 010, en orden). NO cargues los seeds.
// Una copia de antes de la 010 no trae titulares: restaurarCopia crea el titular desde ajustes.
// 2. Pon SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del proyecto nuevo en .env.local.
// 3. npx tsx --env-file=.env.local scripts/restaurar.ts IVAn-copia-2026-11-23.json.gz
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { restaurarCopia, type Copia } from "../lib/copia";

const archivo = process.argv[2];
if (!archivo) throw new Error("Uso: npx tsx --env-file=.env.local scripts/restaurar.ts <copia.json.gz>");
const copia = JSON.parse(gunzipSync(readFileSync(archivo)).toString()) as Copia;
console.log(`Copia del ${copia.creada}`);
const hechas = await restaurarCopia(copia);
for (const [t, n] of Object.entries(hechas)) console.log(`  ${t}: ${n}`);
console.log("Restaurada. Los PDF de IVAn se regeneran solos al pedirlos (/pdf 00339).");
