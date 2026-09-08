import test from 'node:test';
import assert from 'node:assert/strict';
import { generateText, generateImage, parseJSONContent } from '../src/ai/providerAPI.mjs';
import { PROVIDERS } from '../src/ai/providerConfig.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const req=id=>({id,apiKey:`test-${id}-key`,model:'test-model',prompt:'测试',systemPrompt:'JSON'});
for(const id of Object.keys(PROVIDERS))test(`${id} text uses only chosen endpoint/credential and compatible parameters`,async()=>{
 let count=0;
 const result=await generateText({...req(id),meta:{textUrl:'https://evil.example'}},{fetchImpl:async(url,options)=>{
  count++;assert.equal(url,PROVIDERS[id].textUrl);assert.equal(options.headers.Authorization,`Bearer test-${id}-key`);
  const body=JSON.parse(options.body);assert.equal(body.model,'test-model');assert.equal(body.stream,false);
  if(id==='deepseek'){assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.response_format.type,'json_object');assert.equal(body.reasoning_split,undefined);}
  if(id==='aliyun')assert.equal(body.response_format.type,'json_object');
  return json({choices:[{message:{content:'<think>reason</think>\n```json\n{"slogan":"测试"}\n```'}}]});
 }});
 assert.equal(result.slogan,'测试');assert.equal(count,1);
});
for(const id of ['volcengine'])test(`${id} image returns portable base64 with correct schema`,async()=>{
 const result=await generateImage(req(id),{fetchImpl:async(url,options)=>{
  assert.equal(url,PROVIDERS[id].imageUrl);const body=JSON.parse(options.body);
  assert.equal(body.response_format,'b64_json');
  return json({data:[{b64_json:png}]});
 }});
 assert.equal(result,`data:image/png;base64,${png}`);
});
test('Wanx submits, polls, downloads without leaking API credential to image host',async()=>{
 const requests=[];
 const result=await generateImage(req('aliyun'),{wait:async()=>{},fetchImpl:async(url,options)=>{
  requests.push(url);
  if(url===PROVIDERS.aliyun.imageUrl){assert.equal(options.headers['X-DashScope-Async'],'enable');return json({output:{task_id:'test-task'}});}
  if(url.endsWith('/test-task'))return json({output:{task_status:'SUCCEEDED',results:[{url:'https://test.oss-cn-beijing.aliyuncs.com/image.png'}]}});
  assert.equal(options.headers,undefined);assert.equal(options.credentials,'omit');return new Response(Buffer.from(png,'base64'));
 }});
 assert.equal(result,`data:image/png;base64,${png}`);assert.equal(requests.length,3);
});
test('terminal Wanx failure stops immediately, instead of polling until timeout',async()=>{
 let count=0;await assert.rejects(generateImage(req('aliyun'),{wait:async()=>{},fetchImpl:async()=>json(++count===1?{output:{task_id:'t'}}:{output:{task_status:'FAILED'}})}),/任务失败/);assert.equal(count,2);
});
test('auth failure never switches provider or includes response content/key',async()=>{
 let count=0;await assert.rejects(generateText(req('deepseek'),{fetchImpl:async()=>{count++;return json({message:'test-deepseek-key'},401);}}),error=>error.message.includes('401')&&!error.message.includes('test-deepseek-key'));
 assert.equal(count,1);
});
test('HTTP 200 business errors, bad JSON, truncated JSON and timeout are explicit failures',async()=>{
 await assert.rejects(generateText(req('deepseek'),{fetchImpl:async()=>json({error:{message:'secret'}})}),/请求失败/);
 assert.throws(()=>parseJSONContent('not json'),/结构化/);assert.throws(()=>parseJSONContent('[]'),/结构/);
 await assert.rejects(generateText(req('aliyun'),{fetchImpl:async()=>json({choices:[{finish_reason:'length',message:{content:'{}'}}]})}),/截断/);
 await assert.rejects(generateText(req('aliyun'),{timeoutMs:1,fetchImpl:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort'))))}),/超时/);
});
test('untrusted task download URLs rejected before any fetch to unrelated destinations',async()=>{
 let count=0;
 await assert.rejects(generateImage(req('aliyun'),{wait:async()=>{},fetchImpl:async()=>json(++count===1?{output:{task_id:'t'}}:{output:{task_status:'SUCCEEDED',results:[{url:'http://localhost/private'}]}})}),/未支持/);
 assert.equal(count,2);
});
