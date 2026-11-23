"""Actual CPU inference; model file is external and not bundled."""
import json,hashlib,time,sys,platform
from datetime import datetime,timezone
from pathlib import Path
from llama_cpp import Llama,__version__
r=Path(__file__).resolve().parent.parent
model=Path(sys.argv[1]); jobs=json.loads((r/'evidence/model_inputs_v5.json').read_text())
config=dict(temperature=0.0,top_p=1.0,max_tokens=160,repeat_penalty=1.0,seed=42)
manifest={'run_started':datetime.now(timezone.utc).isoformat(),'model':'Qwen/Qwen2.5-0.5B-Instruct-GGUF','filename':model.name,'sha256':hashlib.sha256(model.read_bytes()).hexdigest(),'llama_cpp_python':__version__,'python':platform.python_version(),'platform':platform.platform(),'n_ctx':4096,'n_threads':4,'settings':config,'runs':len(jobs),'sampling':'one deterministic sample per case/version; no forced JSON grammar','design':'V5 changes only the OUTPUT_SCHEMA representation relative to V4; same system prompt, gate, evidence and inference settings; same development cases'}
(r/'evidence/model_run_manifest_v5.json').write_text(json.dumps(manifest,indent=2))
llm=Llama(model_path=str(model),n_ctx=4096,n_threads=4,verbose=False)
with (r/'evidence/model_outputs_v5.jsonl').open('w') as f:
 for i,j in enumerate(jobs):
  start=time.perf_counter();res=llm.create_chat_completion(messages=j['messages'],**config)
  out={'case':j['case'],'version':j['version'],'raw_output':res['choices'][0]['message']['content'],'finish_reason':res['choices'][0]['finish_reason'],'usage':res.get('usage'),'seconds':round(time.perf_counter()-start,3),'recorded_at':datetime.now(timezone.utc).isoformat()}
  f.write(json.dumps(out)+'\n');f.flush();print(f"{i+1}/{len(jobs)} {j['case']} {j['version']} {out['seconds']}s",flush=True)
print('Inference complete',flush=True)
