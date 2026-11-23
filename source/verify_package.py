from pathlib import Path
import json,subprocess,hashlib
from pypdf import PdfReader
p=Path(__file__).resolve().parent.parent
c=json.loads((p/'data/corpus.json').read_text());m=json.loads((p/'evidence/model_summary.json').read_text());t=json.loads((p/'evidence/m2_component_baseline.json').read_text())
assert len(c['sources'])==5 and len(c['facts'])==19
assert len({f['id'] for f in c['facts']})==19
assert m['total_runs']==48 and m['versions'][-1]['contract_pass']==8
assert t['summary']['status_pass']==39 and t['summary']['questions']==42
assert len(PdfReader(p/'docs/Technical_Report.pdf').pages)==11
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p/'video/Progress_Demo.mp4')]))
assert 90<=float(probe['format']['duration'])<=150
assert any(s['codec_type']=='audio' for s in probe['streams'])
assert 'APPLICATION_GATE' in (p/'CampusCompass.html').read_text()
for name in ['model_inputs.json','model_inputs_v4.json','model_inputs_v5.json']:
 jobs=json.loads((p/'evidence'/name).read_text());assert len(jobs)==(32 if name=='model_inputs.json' else 8)
a=json.loads((p/'evidence/model_inputs_v4.json').read_text());b=json.loads((p/'evidence/model_inputs_v5.json').read_text())
for x,y in zip(a,b):
 assert x['case']==y['case'] and x['messages'][0]==y['messages'][0]
 xx=json.loads(x['messages'][1]['content']);yy=json.loads(y['messages'][1]['content']);xx.pop('OUTPUT_SCHEMA');yy.pop('OUTPUT_SCHEMA');assert xx==yy
assert json.loads((p/'evidence/api_smoke_test.json').read_text())['response']['validation']['pass']
report={'checks':'source/data counts, saved model job counts, controlled V4/V5 schema change, reported metrics, report page count, video duration/audio, fresh API response','result':'passed','video_duration_seconds':float(probe['format']['duration']),'technical_report_pages':11,'model_comparative_runs':48,'component_status_matches':'39/42','final_development_contracts':'8/8'}
(p/'evidence/package_verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
