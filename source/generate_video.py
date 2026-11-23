from pathlib import Path
import json,textwrap,subprocess
from PIL import Image,ImageDraw,ImageFont,ImageOps
P=Path(__file__).resolve().parent.parent;W=P.parent/'tmp/video_build';W.mkdir(parents=True,exist_ok=True);V=P/'video';V.mkdir(exist_ok=True)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';serif='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
def F(n,b=False):return ImageFont.truetype(bold if b else font,n)
scenes=[
('CampusCompass','Evidence before answers.','A source-grounded campus helpdesk\nTEAM AETHERMIND / PE-B37-13\nSCSE4041 / Milestone 2',None,'Campus Compass is our source grounded campus helpdesk prototype. It makes the evidence, prompt and limitations visible. This milestone includes a working application, actual local model experiments, and reproducible checks.'),
('An answer with a source','Date and scope remain visible.','19 curated facts\n5 official sources\nHistorical evidence stays dated','attendance.jpg','A student asks about attendance. The application displays a curated answer, a source quote and a page reference. It also warns that this historical notification needs a current applicability check.'),
('Missing scope is a decision','No invented fee amount.','Underspecified question\nClarify the needed scope\nNo unsupported citation','clarify.jpg','When a fee question lacks scope, the assistant asks for the programme, year and category. It does not invent an amount or attach a source that does not support the answer.'),
('A real model failure','Correct JSON is not enough.','V3 / D01\nSelected F01, F13 and F07\nOnly F01 answers the question', 'raw-v3','We ran the same eight questions across six prompt versions with a small local Qwen model. Version three produced valid JSON, but selected unrelated facts. The validator rejected that result.'),
('A focused schema refinement','V4 → V5','V4 copied a placeholder\nV5 uses a typed JSON Schema\n8/8 development contracts accepted','raw-v5','Version four copied a schema placeholder into two outputs. Version five changed only that schema representation. The same development cases then passed all eight contracts. This is a pilot result, not a reliability guarantee.'),
('Reject an invented fact','F999 is held for review.','Membership check\nRelevance and scope gate\nCurated wording only','validator.jpg','The Prompt Studio exposes the full assembled prompt. Here, an invented fact ID is held for review. Only approved selections can reach the renderer, which supplies the curated wording and source ledger.'),
('Keep the measures separate','Failures remain in the package.','48 retained model responses\n39/42 component status matches\n3 paraphrase misses preserved','chart','The package keeps all forty eight comparative model outputs. Separately, component checks match thirty nine of forty two expected statuses. Three paraphrase misses remain documented, even though retrieval found the right cards.'),
('Inspect. Reproduce. Explain.','Ready for a faculty demonstration.','Open CampusCompass.html\nReplay prompts and model outputs\nReview source files and limitations',None,'Open the standalone application, inspect the evidence, replay the experiments, and rerun the checks. Next, we will expand source coverage and use independent evaluation. This demonstration uses a synthetic narrator and verified application captures.')]
allout=[]
for i,(title,sub,points,asset,narration) in enumerate(scenes):
 im=Image.new('RGB',(1920,1080),'#102b3d');d=ImageDraw.Draw(im)
 d.text((70,38),'CAMPUSCOMPASS  /  MILESTONE 2',font=F(23,True),fill='#8ddac5');d.text((70,88),title,font=F(49,True),fill='white');d.text((73,158),sub,font=F(28),fill='#c4d9dc')
 if asset in ['attendance.jpg','clarify.jpg','validator.jpg']:
  screenshot=Image.open(P/'evidence/screenshots'/asset).convert('RGB');screenshot.thumbnail((1060,780));im.paste(screenshot,(65,240));x=1190;y=290
 elif asset in ['raw-v3','raw-v5']:
  d.rounded_rectangle((65,240,1100,965),18,fill='#f1f6f3');d.text((100,275),'ACTUAL RECORDED QWEN OUTPUT',font=F(22,True),fill='#087c74');runs=[json.loads(l) for n in ['model_outputs.jsonl','model_outputs_v5.jsonl'] for l in (P/'evidence'/n).read_text().splitlines()];run=next(r for r in runs if r['case']=='D01' and r['version']==('V3' if asset=='raw-v3' else 'V5'))
  y=355
  for line in run['raw_output'].splitlines():d.text((105,y),line,font=F(35),fill='#183e4b');y+=56
  d.text((105,880),run['version']+' / D01 / retained raw output',font=F(23),fill='#607780');x=1190;y=290
 elif asset=='chart':
  pic=Image.open(P/'docs/model_results.png').convert('RGB');pic.thumbnail((1100,650));im.paste(pic,(65,300));x=1240;y=300
 else:
  d.text((80,345),'Campus',font=ImageFont.truetype(serif,115),fill='white');d.text((80,490),'Compass',font=ImageFont.truetype(serif,115),fill='#8ddac5');d.line((85,675,1000,675),fill='#4c6c79',width=2);d.text((85,710),'Ground → select → verify → explain',font=F(32),fill='#c4d9dc');x=1190;y=310
 for point in points.split('\n'):
  for line in textwrap.wrap(point,width=27):d.text((x,y),line,font=F(31,True),fill='white');y+=48
  y+=28
 d.text((72,1022),'TEAM AETHERMIND · PE-B37-13',font=F(22),fill='#a7c5cc');d.text((1260,1022),f'{i+1:02d} / 08     VERIFIED PROTOTYPE / PILOT',font=F(20),fill='#a7c5cc');im.save(W/f'scene{i}.png')
 (W/f'narration{i}.txt').write_text(narration)
 voice=P.parent/'tmp/voice/voice.onnx'
 subprocess.run(['python3','-m','piper','-m',str(voice),'-c',str(voice)+'.json','-i',str(W/f'narration{i}.txt'),'-f',str(W/f'raw{i}.wav')],check=True,capture_output=True)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(W/f'raw{i}.wav')]))
 tempo=max(1,duration/14.2)
 subprocess.run(['ffmpeg','-y','-i',str(W/f'raw{i}.wav'),'-af',f'atempo={tempo:.5f},apad','-t','15','-ar','44100',str(W/f'audio{i}.wav'),'-loglevel','error'],check=True)
 subprocess.run(['ffmpeg','-y','-loop','1','-i',str(W/f'scene{i}.png'),'-i',str(W/f'audio{i}.wav'),'-t','15','-vf','fps=24','-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-shortest',str(W/f'clip{i}.mp4'),'-loglevel','error'],check=True)
 allout.append({'start':i*15,'end':(i+1)*15,'title':title,'narration':narration});print('Rendered scene',i+1,flush=True)
(W/'concat.txt').write_text(''.join("file '"+str(W/f'clip{i}.mp4')+"'\n" for i in range(8)))
subprocess.run(['ffmpeg','-y','-f','concat','-safe','0','-i',str(W/'concat.txt'),'-c','copy','-movflags','+faststart',str(V/'Progress_Demo.mp4'),'-loglevel','error'],check=True)
def stamp(s):return f'{s//3600:02d}:{s//60%60:02d}:{s%60:02d},000'
(V/'Captions.srt').write_text('\n\n'.join(str(i+1)+'\n'+stamp(r['start'])+' --> '+stamp(r['end'])+'\n'+r['narration'] for i,r in enumerate(allout)))
(V/'Transcript.md').write_text('# CampusCompass - 120-second progress demonstration\n\nSynthetic narration; real application captures and retained inference outputs. Edited demonstration, not an uninterrupted live-session recording.\n\n'+'\n\n'.join(f"## {r['start']}-{r['end']} seconds / {r['title']}\n\n{r['narration']}" for r in allout)+'\n\nVoice: Piper en_US-lessac-low; source https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/lessac/low . Model weights are not redistributed in this package.')
print('120-second narrated video complete',flush=True)
