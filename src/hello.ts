import {createServer} from "node:http";

createServer((q: any,s:any)=>{
    console.log(">> req",q.url);
    s.end("ok!!")
}
).listen(5001, () => console.log('listening on :' + 5001))

console.log("start")
