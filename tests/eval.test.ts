import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSuite, scoreTemplate, summarize, comparable, runSuite, type Suite, type Run } from '../eval/runner';
const suite = JSON.parse(readFileSync(resolve(__dirname, '../eval/suites/reflective-bg-v1.json'),'utf8')) as Suite;
function example(): Run {
  return { id:'unit', createdAt:'2026-09-22', provider:'groq', model:'model-a', suite, suiteHash:'suite', promptHash:'prompt', prompt:'synthetic', selection:['clarity-01'], repeats:1,
    parameters:{temperature:0.7,max_tokens:1200,stream:false}, plannedCalls:1, complete:true,
    results:[{caseId:'clarity-01/1',turn:1,user:'synthetic',reply:'synthetic',status:'ok',latencyMs:1}] };
}
function reviewed(run:Run) {
  const scores=scoreTemplate(run); scores.reviewer={name:'Synthetic unit fixture',kind:'human'};
  for(const a of scores.assessments) {
    for(const check of a.checks) { check.passed=true; check.evidence='Synthetic test evidence'; }
    for(const rating of Object.values(a.ratings)) { rating.score=4; rating.evidence='Synthetic test evidence'; }
  }
  return scores;
}
test('versioned suite has 24 synthetic cases and 72 fully rubric-covered turns',()=>{
  validateSuite(suite); assert.equal(suite.cases.length,24); assert.equal(suite.cases.reduce((n,c)=>n+c.turns.length,0),72);
});
test('suite rejects copied personal provenance and duplicate IDs',()=>{
  const invalid=structuredClone(suite); invalid.cases[0].provenance='personal'; assert.throws(()=>validateSuite(invalid));
  invalid.cases[0].provenance='synthetic'; invalid.cases[1].id=invalid.cases[0].id; assert.throws(()=>validateSuite(invalid));
});
test('unreviewed replies never pass automatically',()=>{
  const run=example(); assert.equal(summarize(run,scoreTemplate(run)).status,'UNREVIEWED');
});
test('critical failure dominates perfect quality',()=>{
  const run=example(); const scores=reviewed(run); scores.assessments[0].checks[0].passed=false;
  assert.equal(summarize(run,scores).status,'CRITICAL_FAIL');
});
test('missing evidence, missing reviewer and changed rubric cannot produce a pass',()=>{
  const run=example(); const scores=reviewed(run);
  scores.assessments[0].ratings.tone.evidence=''; assert.equal(summarize(run,scores).status,'UNREVIEWED');
  const clean=reviewed(run); clean.reviewer.kind='unassigned'; assert.equal(summarize(run,clean).status,'UNREVIEWED');
  clean.assessments[0].checks.pop(); assert.throws(()=>summarize(run,clean));
});
test('technical failures and incomplete runs do not become model quality passes',()=>{
  const run=example(); const scores=reviewed(run); run.complete=false;
  assert.equal(summarize(run,scores).status,'TECHNICAL_INCOMPLETE');
});
test('paired comparisons require matching conditions and reject mocks',()=>{
  const a=example(),b=example(); b.model='model-b'; assert.ok(comparable(a,b));
  b.promptHash='different'; assert.ok(!comparable(a,b)); b.promptHash=a.promptHash;
  b.provider='mock'; assert.ok(!comparable(a,b));
});
test('missing call budget prevents any network call',async()=>{
  let calls=0;
  const fetcher:typeof fetch=async()=>{calls++;throw new Error('should_not_call');};
  await assert.rejects(runSuite({live:'1',suite:'smoke'},fetcher)); assert.equal(calls,0);
});

test('offline runner never invokes fetch; live failure is sanitized and stops the batch', async()=>{
  const { rmSync, existsSync } = await import('node:fs');
  const id=`unit-offline-${Date.now()}`;
  const liveId=`unit-failure-${Date.now()}`;
  let calls=0;
  const fetcher:typeof fetch=async()=>{
    calls++;
    return new Response('PRIVATE_RESPONSE_BODY_SECRET', {status:429,headers:{'retry-after':'30'}});
  };
  const previous=process.env.GROQ_API_KEY;
  try {
    const mock=await runSuite({mock:'1',suite:'smoke','max-calls':'12',id},fetcher);
    assert.equal(calls,0); assert.equal(mock.results.length,12); assert.ok(mock.complete);
    process.env.GROQ_API_KEY='synthetic-unit-test-key';
    const failed=await runSuite({live:'1',suite:'smoke','max-calls':'12','interval-ms':'0',id:liveId},fetcher);
    assert.equal(calls,1); assert.ok(!failed.complete); assert.equal(failed.results[0].error,'http_429');
    assert.equal(failed.results[0].retryAfterSeconds,30);
    assert.ok(!JSON.stringify(failed).includes('PRIVATE_RESPONSE_BODY_SECRET'));
    assert.ok(!JSON.stringify(failed).includes('synthetic-unit-test-key'));
    await assert.rejects(runSuite({mock:'1',suite:'smoke','max-calls':'12',id},fetcher));
  } finally {
    if(previous===undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY=previous;
    for(const runId of [id,liveId]) {
      const path=resolve(__dirname,'../eval/runs',runId);
      if(existsSync(path)) rmSync(path,{recursive:true});
    }
  }
});
