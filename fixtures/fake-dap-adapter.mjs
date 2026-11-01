// Minimal deterministic DAP adapter for testing the real stdio transport.
// Never launches or attaches to a target process.
let input = Buffer.alloc(0);
let launched;
let configured = false;
let replySeq = 0;
const send = (message) => {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  process.stdout.write(Buffer.concat([Buffer.from('Content-Length: ' + payload.length + '\r\n\r\n'),payload]));
};
const response = (request,body={}) => send({
  seq:++replySeq, type:'response', request_seq:request.seq, success:true,
  command:request.command, body
});
function onRequest(request) {
  if (request.command === 'initialize') {
    response(request,{supportsConfigurationDoneRequest:true,supportsReadMemoryRequest:false});
  } else if (request.command === 'launch' || request.command === 'attach') {
    launched = request;
    send({seq:++replySeq,type:'event',event:'initialized'});
    if (configured) finishLaunch();
  } else if (request.command === 'configurationDone') {
    response(request);
    configured=true;
    if (launched) finishLaunch();
  } else if (request.command === 'disconnect') {
    response(request);
    setTimeout(()=>process.exit(0),20);
  } else if (request.command === 'threads') {
    response(request,{threads:[{id:1,name:'mock-thread'}]});
  } else if (request.command === 'stackTrace') {
    response(request,{stackFrames:[{id:1,name:'mock-main',line:1,column:1}],totalFrames:1});
  } else {
    response(request);
  }
}
function finishLaunch() {
  const request=launched;
  launched=undefined;
  response(request);
  send({seq:++replySeq,type:'event',event:'stopped',body:{threadId:1,reason:'entry',allThreadsStopped:true}});
}
process.stdin.on('data',chunk=>{
  input=Buffer.concat([input,chunk]);
  while(true) {
    const i=input.indexOf('\r\n\r\n');
    if (i<0)return;
    const h=input.subarray(0,i).toString('ascii');
    const m=/Content-Length:\s*(\d+)/i.exec(h);
    if(!m) process.exit(2);
    const count=Number(m[1]);
    if(input.length<i+4+count)return;
    const request=JSON.parse(input.subarray(i+4,i+4+count).toString('utf8'));
    input=input.subarray(i+4+count);
    onRequest(request);
  }
});
