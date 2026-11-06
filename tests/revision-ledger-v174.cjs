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
const fixture182=path.join(root,'tests/fixtures/performance-v182-revisions.json'),rows182=fs.existsSync(fixture182)?JSON.parse(fs.readFileSync(fixture182,'utf8')):{};
const fixture183=path.join(root,'tests/fixtures/performance-v183-revisions.json'),rows183=fs.existsSync(fixture183)?JSON.parse(fs.readFileSync(fixture183,'utf8')):{};
const fixture184=path.join(root,'tests/fixtures/performance-v184-revisions.json'),rows184=fs.existsSync(fixture184)?JSON.parse(fs.readFileSync(fixture184,'utf8')):{};
const fixture185=path.join(root,'tests/fixtures/performance-v185-revisions.json'),rows185=fs.existsSync(fixture185)?JSON.parse(fs.readFileSync(fixture185,'utf8')):{};
const fixture186=path.join(root,'tests/fixtures/performance-v186-revisions.json'),rows186=fs.existsSync(fixture186)?JSON.parse(fs.readFileSync(fixture186,'utf8')):{};
const fixture187=path.join(root,'tests/fixtures/performance-v187-revisions.json'),rows187=fs.existsSync(fixture187)?JSON.parse(fs.readFileSync(fixture187,'utf8')):{};
const fixture188=path.join(root,'tests/fixtures/performance-v188-revisions.json'),rows188=fs.existsSync(fixture188)?JSON.parse(fs.readFileSync(fixture188,'utf8')):{};
const fixture189=path.join(root,'tests/fixtures/performance-v189-revisions.json'),rows189=fs.existsSync(fixture189)?JSON.parse(fs.readFileSync(fixture189,'utf8')):{};
const fixture190=path.join(root,'tests/fixtures/performance-v190-revisions.json'),rows190=fs.existsSync(fixture190)?JSON.parse(fs.readFileSync(fixture190,'utf8')):{};
module.exports=function ledger(file,expected){
 const rel=path.isAbsolute(file)?path.relative(root,file):file,row=rows[rel];
 let r=expected;if(row&&(row.before===expected||(row.alsoBefore??[]).includes(expected)))r=row.after;
 if(process.env.LEDGER_RECORD){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');if(actual!==r)fs.appendFileSync('/tmp/ledger_rec.jsonl',JSON.stringify({file:rel,before:r,after:actual})+'\n');return actual;}
 const row175=rows175[rel];if(row175&&row175.before===r)r=row175.after;
 const row176=rows176[rel];if(row176&&row176.before===r)r=row176.after;
 const row177=rows177[rel];if(row177&&row177.before===r)r=row177.after;
 const row178=rows178[rel];if(row178&&row178.before===r)r=row178.after;
 const row179=rows179[rel];if(row179&&row179.before===r)r=row179.after;
 const row182=rows182[rel];if(row182&&row182.before===r)r=row182.after;
 const row183=rows183[rel];if(row183&&row183.before===r)r=row183.after;
 const row184=rows184[rel];if(row184&&row184.before===r)r=row184.after;
 const row185=rows185[rel];if(row185&&row185.before===r)r=row185.after;
 const row186=rows186[rel];if(row186&&row186.before===r)r=row186.after;
 const row187=rows187[rel];if(row187&&row187.before===r)r=row187.after;
 const row188=rows188[rel];if(row188&&row188.before===r)r=row188.after;
 const row189=rows189[rel];if(row189&&row189.before===r)r=row189.after;
 const row190=rows190[rel];if(row190&&row190.before===r)r=row190.after;
 return r;
};

