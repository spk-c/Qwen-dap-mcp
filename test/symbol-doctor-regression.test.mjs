import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {
  compareBinaryAndPdb,findLocalSymbolCandidates,configuredSymbolResolvers,
  symbolMismatchSummary,inspectBinaryIdentity,inspectPdbIdentity,
  resolveSymbolInspectionTool
} from '../src/diagnostics/symbol-doctor.js';

function sandbox(action){
 const base=mkdtempSync(join(tmpdir(),'symbol-doctor-safe-'));
 try{return action(base);}finally{rmSync(base,{recursive:true,force:true});}
}

test('GUID and age are compared with canonical formatting, not filenames',()=>{
 const binary={format:'pe',pdb:{guid:'{12345678-1234-ABCD-FFFF-0123456789AB}',age:'3',path:'C:\\symbols\\old.pdb'}};
 const pdb={guid:'123456781234abcdffff0123456789ab',age:'3'};
 const r=compareBinaryAndPdb(binary,pdb);
 assert.equal(r.comparable,true);
 assert.equal(r.match,true);
 assert.equal(r.strength,'strong-guid-age');
 assert.equal(r.guidMatch,true);
 assert.equal(r.ageMatch,true);
});

test('GUID mismatch or PDB age mismatch rejects binary identity',()=>{
 const bin={format:'pe',pdb:{guid:'aa111111111111111111111111111111',age:'4'}};
 assert.equal(compareBinaryAndPdb(bin,{guid:'bb111111111111111111111111111111',age:'4'}).match,false);
 const old=compareBinaryAndPdb(bin,{guid:'aa111111111111111111111111111111',age:'5'});
 assert.equal(old.match,false);
 assert.equal(old.ageMatch,false);
});

test('missing CodeView identity is explicitly incomparable rather than a guessed match',()=>{
 assert.equal(compareBinaryAndPdb({format:'elf'},{guid:'abc'}).comparable,false);
 assert.equal(compareBinaryAndPdb({format:'pe',pdb:{}},{guid:'abc'}).match,undefined);
 const x=compareBinaryAndPdb({format:'pe',pdb:{guid:'ABCDEF0123456789'}},{guid:'abcdef0123456789'});
 assert.equal(x.match,true);
 assert.equal(x.strength,'guid-only');
});

test('local symbol discovery matches PDB/debug artifacts by module stem',()=>{
 sandbox(root=>{
   mkdirSync(join(root,'deep'));
   writeFileSync(join(root,'hello.pdb'),'pdb dummy');
   writeFileSync(join(root,'hello.debug'),'debug dummy');
   writeFileSync(join(root,'deep','gateway.sym'),'symbol dummy');
   writeFileSync(join(root,'unrelated.txt'),'not a symbol');
   const result=findLocalSymbolCandidates([
     {name:'hello.exe',path:'C:\\build\\hello.exe'}, {name:'gateway.so'},
     {name:'missing.dll'}
   ],[root]);
   assert.equal(result.truncated,false);
   assert.equal(result.matches.filter(x=>x.module==='hello.exe').length,2);
   assert.ok(result.matches.some(x=>x.module==='gateway.so'&&x.candidate.endsWith('gateway.sym')));
   assert.ok(result.unresolvedModules.some(x=>x.module==='missing.dll'));
   assert.ok(result.matches.every(x=>!x.candidate.endsWith('unrelated.txt')));
 });
});

test('file traversal refuses to follow symlinked directories where supported',()=>{
 sandbox(root=>{
   const external=join(root,'external');
   mkdirSync(external);
   writeFileSync(join(external,'secret.pdb'),'dummy');
   const search=join(root,'search');
   mkdirSync(search);
   try {symlinkSync(external,join(search,'alias'),'dir');} catch(err) {
      if(['EPERM','EACCES','ENOTSUP'].includes(err.code)) return;
      throw err;
   }
   const result=findLocalSymbolCandidates([{name:'secret.exe'}],[search]);
   assert.equal(result.matches.length,0);
 });
});

test('dSYM bundles are candidates only, not proof of matching binary identity',()=>{
 sandbox(root=>{
   mkdirSync(join(root,'MyApp.dSYM'));
   const result=findLocalSymbolCandidates([{name:'MyApp'}],[root]);
   assert.ok(result.matches.some(x=>x.reason.includes('dSYM')));
   assert.ok(result.matches.every(x=>!x.identityVerified));
 });
});

test('symbol search enforces a strict visited-entry cap',()=>{
 sandbox(root=>{
   for(let i=0;i<12;i++)writeFileSync(join(root,'app'+i+'.pdb'),'dummy');
   const result=findLocalSymbolCandidates([{name:'app.exe'}],[root],{maxEntries:2});
   assert.equal(result.truncated,true);
   assert.ok(result.visitedEntries<=3);
 });
});

test('symbol search enforces nesting depth and does not treat all names as matches',()=>{
 sandbox(root=>{
   const nested=join(root,'deep','deeper');
   mkdirSync(nested,{recursive:true});
   writeFileSync(join(nested,'worker.pdb'),'dummy');
   assert.equal(findLocalSymbolCandidates([{name:'worker.exe'}],[root],{maxDepth:0}).matches.length,0);
   assert.equal(findLocalSymbolCandidates([{name:'worker.exe'}],[root],{maxDepth:3}).matches.length,1);
 });
});

test('symbol search validates configured directories and never walks missing roots',()=>{
 assert.throws(()=>findLocalSymbolCandidates([{name:'x'}],[join(tmpdir(),'no-such-symbol-search-root-2026')]),/directory|exist|found|inaccessible/i);
});

test('debuginfod candidates are explicit instructions, not network fetches',()=>{
 const r=configuredSymbolResolvers({format:'elf',buildId:'aabbcc'},' https://symbols.example.org/,http://localhost:8000 ');
 assert.equal(r.configured,true);
 assert.equal(r.networkFetchPerformed,false);
 assert.equal(r.candidates[0].kind,'debuginfod-compatible-candidate');
 assert.equal(r.candidates[0].url,'https://symbols.example.org/buildid/aabbcc/debuginfo');
 assert.equal(r.candidates[1].url,'http://localhost:8000/buildid/aabbcc/debuginfo');
});

test('configured symbol roots retain identity-specific types without inventing URLs',()=>{
 const pe=configuredSymbolResolvers({format:'pe'},'https://symbols.example.org');
 assert.equal(pe.candidates[0].kind,'pdb-symbol-server-root');
 assert.equal(pe.candidates[0].url,undefined);
 const fallback=configuredSymbolResolvers(undefined,'file:///tmp/cache');
 assert.equal(fallback.candidates[0].kind,'configured-symbol-server-root');
 assert.equal(fallback.candidates[0].url,undefined);
 assert.equal(configuredSymbolResolvers(undefined,'').configured,false);
});

test('symbol resolvers cap configuration at twenty nonempty entries',()=>{
 const value=Array.from({length:30},(_,i)=>'https://example.org/'+i).join(', ,');
 const r=configuredSymbolResolvers({format:'elf',buildId:'cafebabe'},value);
 assert.equal(r.servers.length,20);
 assert.equal(r.candidates.length,20);
});

test('mismatch report surfaces explicit missing modules and a high-severity PDB mismatch',()=>{
 const bin={format:'pe',pdb:{guid:'0123456789abcdef',age:'1'}};
 const pdb={guid:'fedcba9876543210',age:'1'};
 const r=symbolMismatchSummary({
    modules:[{name:'one',path:'/one.so',symbolStatus:'not loaded'},{name:'two',symbolStatus:'missing'}],
    binaryIdentity:bin,pdbIdentity:pdb,
    localSearch:{matches:[{module:'one',candidate:'/symbols/one.debug'}]}
 });
 assert.equal(r.status,'mismatch');
 assert.equal(r.issues.filter(x=>x.kind==='module-symbols-missing').length,2);
 assert.equal(r.issues.find(x=>x.kind==='binary-pdb-identity-mismatch').severity,'high');
 assert.equal(r.localCandidates.length,1);
});

test('missing symbol status has a distinct diagnosis from no explicit mismatch',()=>{
 assert.equal(symbolMismatchSummary({modules:[{name:'one',symbolStatus:'no symbols'}]}).status,'missing-or-incomplete');
 const clean=symbolMismatchSummary({modules:[{name:'one',symbolStatus:'loaded'}]});
 assert.equal(clean.status,'no-explicit-mismatch');
 assert.equal(clean.binaryPdbComparison,undefined);
});

test('explicit tool path is validated without executing the provided file',()=>{
 sandbox(root=>{
   const file=join(root,'fixture.exe');
   writeFileSync(file,'not executable and not invoked');
   const key='QWEN_DAP_MCP_TEST_SYMBOL_TOOL';
   const original=process.env[key];
   try{
     process.env[key]=file;
     assert.equal(resolveSymbolInspectionTool('test tool',key),resolve(file));
   }finally{
     if(original===undefined) delete process.env[key];
     else process.env[key]=original;
   }
 });
});

test('identity inspection on owned dummy file is bounded and does not claim invented identifiers',()=>{
 sandbox(root=>{
   const file=join(root,'dummy.pdb');
   writeFileSync(file,'dummy data');
   const pdb=inspectPdbIdentity(file);
   assert.equal(pdb.path,resolve(file));
   assert.equal(pdb.guid,undefined);
   assert.equal(pdb.age,undefined);
   const binary=inspectBinaryIdentity(file);
   assert.equal(binary.path,resolve(file));
   assert.ok(['unknown','pe','elf','macho'].includes(binary.format));
   assert.ok(Array.isArray(binary.probes));
 });
});
