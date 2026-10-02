import assert from 'node:assert/strict';
import { createProgressMachine, progressFromDto } from '../src/progress/model.ts';

const episode={
  id:'e1',title:'test',startSceneId:'start',
  scenes:[
    {id:'start',kind:'dialogue',text:'start',nextSceneId:'choice'},
    {id:'choice',kind:'dialogue',text:'choose',choices:[{id:'go',text:'go',nextSceneId:'done',effects:[{kind:'inc',score:'truthScore',by:2}]}]},
    {id:'done',kind:'terminal',text:'done'},
  ],
};
const serverDto={storyId:'last-online',seasonId:'season-1',episodeId:'e1',sceneId:'choice',junhoScore:1,taeyunScore:0,truthScore:0,riskScore:0,flags:{from_server:true}};
const restored=progressFromDto(serverDto,episode);
assert.equal(restored.sceneId,'choice');
assert.equal(restored.storyState.junhoScore,1);

let attempts=0;
const save=async (dto)=>{
  attempts++;
  if(attempts===1) throw new Error('offline');
  return dto;
};
const machine=createProgressMachine({episode,initial:restored,save});
await assert.rejects(()=>machine.choose('go'),/offline/);
assert.equal(machine.current().sceneId,'choice','failed save must not advance committed scene');
assert.equal(machine.pending()?.sceneId,'done','candidate is retained for retry');
const retried=await machine.retry();
assert.equal(retried.sceneId,'done');
assert.equal(retried.storyState.truthScore,2);
assert.equal(attempts,2,'retry replays same save once');
console.log('PASS: progress machine save-before-advance, retry, and server restore');
