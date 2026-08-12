/**
 * Reseed the Meta sandbox to the 100-product Style Union PILOT.
 *
 * The implementation lives in src/generator/seed-pilot.ts so it is compiled into dist and can also run
 * at boot (deployed containers start with an empty DB). This is just the manual entry point.
 *
 * Run from sandbox-meta:  npx tsx script/seed-su-pilot.ts
 */
import { seedPilotCatalog, pilotDataPath } from "../src/generator/seed-pilot.js";
import { config } from "../src/config.js";

console.log(`Pilot dataset: ${pilotDataPath() ?? "NOT FOUND"}`);
const { products, insightRows, skus } = seedPilotCatalog();
console.log(`Meta sandbox catalog ${config.catalogId}: ${products} products, ${insightRows} insight rows (${skus} SKUs).`);
process.exit(0);
