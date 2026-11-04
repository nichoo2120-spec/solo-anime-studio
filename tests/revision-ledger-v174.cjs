// v0.5.174: one shared ledger for source edits made after the last recorded fixture (v166).
// Each entry says: "the last recorded hash (before) became this current hash (after)" and why.
// Old guards still fail on ANY unrecorded edit: the current hash must equal the ledger 'after'.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),fixture=path.join(root,'tests/fixtures/performance-v174-revisions.json');
const rows=fs.existsSync(fixture)?JSON.parse(fs.readFileSync(fixture,'utf8')):{};
// v0.5.175: second link in the chain (v174 hash -> v175 hash), same rules.
const fixture175=path.join(root,'tests/fixtures/performance-v175-revisions.json'),rows175=fs.existsSync(fixture175)?JSON.parse(fs.readFileSync(fixture175,'utf8')):{};
// v0.5.176: third link (v175 hash -> v176 hash), same rules.
const fixture176=path.join(root,'tests/fixtures/performance-v176-revisions.json'),rows176=fs.existsSync(fixture176)?JSON.parse(fs.readFileSync(fixture176,'utf8')):{};
// v0.5.177: fourth link (v176 hash -> v177 hash): desktop installer build.
const fixture177=path.join(root,'tests/fixtures/performance-v177-revisions.json'),rows177=fs.existsSync(fixture177)?JSON.parse(fs.readFileSync(fixture177,'utf8')):{};
const fixture178=path.join(root,'tests/fixtures/performance-v178-revisions.json'),rows178=fs.existsSync(fixture178)?JSON.parse(fs.readFileSync(fixture178,'utf8')):{};
const fixture179=path.join(root,'tests/fixtures/performance-v179-revisions.json'),rows179=fs.existsSync(fixture179)?JSON.parse(fs.readFileSync(fixture179,'utf8')):{};
module.exports=function ledger(file,expected){
 const rel=path.isAbsolute(file)?path.relative(root,file):file,row=rows[rel];
 let r=expected;if(row&&(row.before===expected||(row.alsoBefore??[]).includes(expected)))r=row.after;
 if(process.env.LEDGER_RECORD){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');if(actual!==r)fs.appendFileSync('/tmp/ledger_rec.jsonl',JSON.stringify({file:rel,before:r,after:actual})+'\n');return actual;}
 const row175=rows175[rel];if(row175&&row175.before===r)r=row175.after;
 const row176=rows176[rel];if(row176&&row176.before===r)r=row176.after;
 const row177=rows177[rel];if(row177&&row177.before===r)r=row177.after;
 const row178=rows178[rel];if(row178&&row178.before===r)r=row178.after;
 const row179=rows179[rel];if(row179&&row179.before===r)r=row179.after;
 return r;
};
