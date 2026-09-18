const fs = require('fs');
const path = require('path');

const backendPath = process.argv[2];
if (!backendPath) { console.error('Usage: node rename.js <backend-path>'); process.exit(1); }

// Rename command-router.ts
const crPath = path.join(backendPath, 'app/pats/command-router.ts');
let cr = fs.readFileSync(crPath, 'utf8');

// 1. Schema names (NOT stationStepCreateSchema)
cr = cr.replace(/stationCreateSchema/g, 'sectionCreateSchema');
cr = cr.replace(/stationPatchSchema/g, 'sectionPatchSchema');
cr = cr.replace(/stationProcessesSchema/g, 'sectionProcessesSchema');
cr = cr.replace(/stationOrderSchema/g, 'sectionOrderSchema');

// 2. API routes — /stations → /sections (but NOT /station-steps or /monitoring...)
// Use specific patterns for route paths
cr = cr.replace(/router\.post\("\/stations"/g, 'router.post("/sections"');
cr = cr.replace(/router\.get\("\/stations"/g, 'router.get("/sections"');
cr = cr.replace(/router\.patch\("\/stations\/:stationId"/g, 'router.patch("/sections/:sectionId"');
cr = cr.replace(/router\.put\("\/stations\/order"/g, 'router.put("/sections/order"');
cr = cr.replace(/router\.put\("\/stations\/:stationId\/processes"/g, 'router.put("/sections/:sectionId/processes"');
cr = cr.replace(/router\.delete\("\/stations\/:stationId"/g, 'router.delete("/sections/:sectionId"');

// 3. Parameter names :stationId → :sectionId (in route paths)
// Also change req.params.stationId → req.params.sectionId for section endpoints
cr = cr.replace(/:stationId/g, ':sectionId');
cr = cr.replace(/req\.params\.stationId/g, 'req.params.sectionId');
// Variable name in section handler functions
cr = cr.replace(/const stationId = req\.params\.sectionId/g, 'const sectionId = req.params.sectionId');
cr = cr.replace(/const stationId = /g, 'const sectionId = ');
cr = cr.replace(/\bstationId\b/g, 'sectionId');

// 4. Command/transaction names (NOT stationStepCreate)
cr = cr.replace(/\bstationCreate\b/g, 'sectionCreate');
cr = cr.replace(/\bstationUpdate\b/g, 'sectionUpdate');
cr = cr.replace(/\bstationDelete\b/g, 'sectionDelete');
cr = cr.replace(/\bstationProcessesReplace\b/g, 'sectionProcessesReplace');
cr = cr.replace(/\bstationOrderReorder\b/g, 'sectionOrderReorder');

// 5. Record command names (STATION_* → SECTION_*)
cr = cr.replace(/STATION_CREATED/g, 'SECTION_CREATED');
cr = cr.replace(/STATION_UPDATED/g, 'SECTION_UPDATED');
cr = cr.replace(/STATION_DELETED/g, 'SECTION_DELETED');
cr = cr.replace(/STATION_PROCESSES_REPLACED/g, 'SECTION_PROCESSES_REPLACED');
cr = cr.replace(/STATIONS_REORDERED/g, 'SECTIONS_REORDERED');
// Keep STATION_STEP_CREATED (it's about StationStep entity, not Station entity)

// 6. Response body fields (only in section-related responses, careful with StationStep)
// stationId → sectionId in section-related context
// These appear in section responses, not StationStep responses
cr = cr.replace(/stationId: station\.id/g, 'sectionId: station.id');
cr = cr.replace(/stationId: updated\.id/g, 'sectionId: updated.id');
cr = cr.replace(/body: \{ stationId/g, 'body: { sectionId');
cr = cr.replace(/body: \{ stationId, processIds/g, 'body: { sectionId, processIds');
cr = cr.replace(/body: \{ stationId, name: updated\.name/g, 'body: { sectionId, name: updated.name');
cr = cr.replace(/body: \{ stationId, name/g, 'body: { sectionId, name');
cr = cr.replace(/return \{ status: 200, body: \{ stationId \}/g, 'return { status: 200, body: { sectionId } }');
cr = cr.replace(/stationId: op\.stationId/g, 'sectionId: op.stationId');
// Note: op.stationId stays as-is in PendingOp type (frontend concern)

// 7. stationCode → sectionCode in section responses
cr = cr.replace(/stationCode: station\.stationCode/g, 'sectionCode: station.stationCode');
cr = cr.replace(/stationCode: updated\.name/g, 'sectionCode: updated.name'); // unlikely but safe
cr = cr.replace(/stationCode: body\.stationCode/g, 'sectionCode: body.sectionCode');

// 8. Location headers
cr = cr.replace(/\/api\/v1\/stations\//g, '/api/v1/sections/');

// 9. Error messages
cr = cr.replace(/The requested station was not found\./g, 'The requested section was not found.');
cr = cr.replace(/The requested station stage was not found\./g, 'The requested section stage was not found.');
cr = cr.replace(/The following stations were not found:/g, 'The following sections were not found:');

// 10. Variable names in section context (transaction.station.* stays — Prisma model unchanged)
// But local variable names in section handlers should use section context
// transaction.station.findUnique({ where: { id: stationId } }) → keep transaction.station (Prisma) but stationId → sectionId local var
// Actually, let's keep transaction.station as-is (it's the Prisma model)
// The param names are now :sectionId (from step 3), and we use sectionId variable
// The variable declarations like const stationId = req.params.stationId; are already handled by step 3

fs.writeFileSync(crPath, cr);
console.log('command-router.ts renamed');

// Rename domain-read.ts
const drPath = path.join(backendPath, 'app/pats/domain-read.ts');
let dr = fs.readFileSync(drPath, 'utf8');

// Routes
dr = dr.replace(/router\.get\("\/stations"/g, 'router.get("/sections"');
dr = dr.replace(/router\.get\("\/stations\/:stationId\/history"/g, 'router.get("/sections/:sectionId/history"');
dr = dr.replace(/router\.get\("\/stations\/:stationId\/support"/g, 'router.get("/sections/:sectionId/support"');

// Error messages (be careful not to change station-related error messages in non-station contexts)
dr = dr.replace(/PATS station configuration is unavailable\./g, 'PATS section configuration is unavailable.');

fs.writeFileSync(drPath, dr);
console.log('domain-read.ts renamed');

console.log('Done.');
