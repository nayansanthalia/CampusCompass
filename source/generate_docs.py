from pathlib import Path
import json,hashlib,math,textwrap
from xml.sax.saxutils import escape
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Table,TableStyle,Image,KeepTogether
from reportlab.lib.styles import ParagraphStyle,getSampleStyleSheet
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing,Rect,Line,String,Polygon
P=Path(__file__).resolve().parent.parent;D=P/'docs';D.mkdir(exist_ok=True)
C=json.loads((P/'data/corpus.json').read_text());M=json.loads((P/'evidence/model_summary.json').read_text());T=json.loads((P/'evidence/component_results.json').read_text());R=json.loads((P/'evidence/model_run_manifest.json').read_text())
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
pdfmetrics.registerFont(TTFont('DV',FONT));pdfmetrics.registerFont(TTFont('DVB',BOLD));pdfmetrics.registerFontFamily('DV',normal='DV',bold='DVB',italic='DV',boldItalic='DVB')
navy=colors.HexColor('#112d3e');teal=colors.HexColor('#087c74');muted=colors.HexColor('#647780');cream=colors.HexColor('#edf4f1');orange=colors.HexColor('#b77835')
st={
 'body':ParagraphStyle('body',fontName='DV',fontSize=9.6,leading=14.2,spaceAfter=9,textColor=navy),
 'small':ParagraphStyle('small',fontName='DV',fontSize=8.0,leading=11.2,spaceAfter=7,textColor=muted),
 'h1':ParagraphStyle('h1',fontName='DVB',fontSize=25,leading=31,spaceAfter=15,textColor=navy),
 'h2':ParagraphStyle('h2',fontName='DVB',fontSize=12.6,leading=18,spaceBefore=13,spaceAfter=8,textColor=teal),
 'eyebrow':ParagraphStyle('eyebrow',fontName='DVB',fontSize=8,leading=13,spaceAfter=9,textColor=teal),
 'white':ParagraphStyle('white',fontName='DV',fontSize=12,leading=19,spaceAfter=11,textColor=colors.HexColor('#bed7da')),
 'title':ParagraphStyle('title',fontName='DVB',fontSize=44,leading=51,textColor=colors.white,spaceAfter=20),
 'code':ParagraphStyle('code',fontName='DV',fontSize=8.1,leading=12,textColor=navy,backColor=cream,borderPadding=10,spaceAfter=12),
}
def p(t,style='body'):return Paragraph(t,st[style])
def table(headers,rows,widths):
 vals=[[p(escape(str(x)),'small') for x in row] for row in [headers]+rows];tab=Table(vals,colWidths=widths,hAlign='LEFT',repeatRows=1)
 tab.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),cream),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,0),.8,colors.HexColor('#bcd6cc')),('LINEBELOW',(0,1),(-1,-1),.4,colors.HexColor('#dce5e1'))]));return tab
story=[]
def page(k,title):
 if story:story.append(PageBreak())
 story.extend([p(k.upper(),'eyebrow'),p(title,'h1')])
def body(t):story.append(p(t))
def heading(t):story.append(p(t,'h2'))
def note(t):story.append(p(t,'small'))
def callout(t):
 tb=Table([[p(t)]],colWidths=[490]);tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),cream),('BOX',(0,0),(-1,-1),.6,colors.HexColor('#cee0d6')),('LEFTPADDING',(0,0),(-1,-1),15),('RIGHTPADDING',(0,0),(-1,-1),15),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),7)]));story.append(tb);story.append(Spacer(1,10))
# Figures from measured data
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#243f4b','text.color':'#243f4b','xtick.color':'#526b75','ytick.color':'#526b75'})
fig,ax=plt.subplots(figsize=(9,3.5),layout='constrained');versions=M['versions'];x=list(range(len(versions)));w=.36
ax.bar([i-w/2 for i in x],[v['json_valid'] for v in versions],width=w,color='#bfd8d0',label='Valid JSON');ax.bar([i+w/2 for i in x],[v['contract_pass'] for v in versions],width=w,color='#087c74',label='Contract accepted');ax.set_xticks(x,[v['version'] for v in versions]);ax.set_ylim(0,9);ax.set_yticks(range(0,9,2));ax.set_ylabel('Count out of 8 development cases');ax.legend(frameon=False,ncol=2);ax.grid(axis='y',alpha=.16);ax.set_axisbelow(True);fig.savefig(D/'model_results.png',dpi=180,facecolor='white');plt.close(fig)
# vector architecture
arch=Drawing(490,270)
def box(x,y,w,h,title,sub):
 arch.add(Rect(x,y,w,h,rx=8,ry=8,fillColor=cream,strokeColor=colors.HexColor('#9cbfb4'),strokeWidth=.8));arch.add(String(x+12,y+h-22,title,fontName='DVB',fontSize=10,fillColor=navy));arch.add(String(x+12,y+17,sub,fontName='DV',fontSize=8,fillColor=muted))
def arrow(x,y,xx,yy):
 arch.add(Line(x,y,xx,yy,strokeColor=teal,strokeWidth=1.5));
 if xx>x:pts=[xx,yy,xx-6,yy+3,xx-6,yy-3]
 else:pts=[xx,yy,xx-3,yy+6,xx+3,yy+6]
 arch.add(Polygon(pts,fillColor=teal,strokeColor=teal))
box(0,194,224,65,'1 / Question + scope','Programme / academic year / semester');box(266,194,224,65,'2 / Retrieve evidence','BM25-style ranking + aliases');arrow(224,226,266,226)
box(266,99,224,65,'3 / Application gate','Scope / source age / refusal / conflicts');arrow(378,194,378,164)
box(0,99,224,65,'4 / Optional local model','V5 selects permitted fact IDs');arrow(266,131,224,131)
box(0,4,224,65,'5 / Contract validator','Reject unknown / unrelated / extra fields');arrow(112,99,112,69)
box(266,4,224,65,'6 / Answer + evidence ledger','Curated wording / short quote / source date');arrow(224,36,266,36)
from reportlab.graphics import renderPM,renderSVG
renderSVG.drawToFile(arch,str(D/'architecture.svg'))
# Cover
story.extend([Spacer(1,104),p('SCSE4041 / PROMPT ENGINEERING MINI PROJECT','white'),Spacer(1,22),p('CampusCompass','title'),p('Evidence before answers.','white'),Spacer(1,25),p('MILESTONE 2<br/>Prompt Design, Experimentation,<br/>Implementation &amp; Demonstration','white'),Spacer(1,70),p('TEAM AETHERMIND &nbsp; / &nbsp; PE-B37-13','white'),p('Bennett University &nbsp; | &nbsp; Batch B37-B48<br/>Prepared 17 November 2026','white')])
page('01 / Executive brief','An inspectable campus helpdesk')
note('Team: Rishi Mulchandani (leader), Nayan Santhalia, Poshkar Garg, Aditya Kumar and Bhavishya Jakhar.')
body('CampusCompass addresses problem C1: students ask a natural-language question and receive an answer grounded in official university information. The project places prompt design, evidence boundaries and failure diagnosis at the centre of a small working application.')
callout('<b>What is now demonstrable:</b> a portable browser application, 19 curated fact cards, five official sources, six prompt versions, 48 actual local-model completions, 42 question checks and a contract validator.')
heading('Abstract')
body('A helpful-sounding answer can still be unsafe when its source, date or applicability is unclear. This prototype separates retrieval, scope resolution, model selection and rendering. The final prompt asks a small open-source model to select approved evidence IDs. A mechanical gate holds unsupported outputs before they become displayed claims. The project retains both positive and negative results; it makes no claim of complete policy coverage or production reliability.')
heading('Milestone 2 evidence map')
story.append(table(['Assessed component','Evidence in the package'],[['Design and diagrams / 2','This report; architecture.svg; prompt history'],['Running or partial build / 3','CampusCompass.html; shared engine; local model bridge'],['Demonstration / 2','Working UI; retained model replay; fresh API test; video'],['Updated sources / 2','Complete source folder, data, tests and reproduction scripts'],['Technical document / 1','This technical report'],['90-150 second video / 2','120-second narrated progress demo and captions']],[160,330]))
note('The source folder must be uploaded to a real team Git/Drive location with faculty access. The package does not invent that URL or claim a submitted form.')
page('02 / Solution design','A claim must survive each boundary')
arch.scale(.85,.85);arch.height=230;story.append(arch);story.append(Spacer(1,8))
body('The default browser helpdesk runs the deterministic path. Model-assisted use adds a local inference step, then applies the same validator. The model is a constrained evidence selector; it does not become the authority for university rules.')
heading('Responsibilities are explicit')
story.append(table(['Layer','Owns','Does not establish'],[['Evidence catalogue','Curated wording, short quotes and page references','Exhaustive amendment coverage'],['Retrieval','Top-four term ranking plus explicit aliases','Full semantic understanding'],['Application gate','Scope checks and allowed facts/status','Personal eligibility decisions'],['Model + prompt','A structured selection from permitted IDs','New policy facts'],['Validator + renderer','Contract consistency and curated output','That a source is currently governing']],[100,195,195]))
heading('Minimal output contract')
story.append(p('{"status": "answered", "fact_ids": ["F01"]}','code'))
body('Only an approved selection can supply factual answer text. The displayed text and citation come from the catalogue, rather than an unchecked model paragraph. This reduces expressive freedom and puts maintenance responsibility on the evidence curator.')
page('03 / Prompt development','Six versions, with a reason for each')
story.append(table(['Version','Change','Reason / observed limitation'],[[v['id']+' / '+v['name'],v['change'],{'V0':'Original Milestone 1 baseline.','V1':'Provenance requested, but raw outputs can remain broad or irrelevant.','V2':'Scope and structure requested; this small model still returned prose.','V3':'Valid JSON improved, but irrelevant IDs and unsafe answers remained.','V4':'Explicit gate improved selections; two outputs copied a schema placeholder.','V5':'Formal schema removed the misleading placeholder in the observed rerun.'}[v['id']]] for v in json.loads((P/'data/prompts.json').read_text())],[98,222,170]))
heading('A focused final refinement')
body('V4 described fact_ids using an illustrative string inside an array. In D20 and D29, the model copied that string into its output even while choosing the correct status. V5 changes only OUTPUT_SCHEMA in the user payload to a formal JSON Schema. The system prompt, question, gate, evidence and inference settings remain unchanged relative to V4.')
story.append(p('V4: "fact_ids": ["IDs from EVIDENCE only"]<br/><br/>V5: "fact_ids": {"type":"array", "items":{"type":"string"}, "maxItems":3}','code'))
note('V0-V3 are instruction-package comparisons; V4 is a workflow change. Only the V4-to-V5 comparison isolates this schema-representation change. All reruns use development cases, so the observation does not establish generalisation.')
page('04 / Evaluation protocol','Three questions. Three kinds of evidence.')
story.append(table(['Question','Procedure','Metric'],[['Can the code route and gate questions?','42 authored cases; 30 development and 12 challenge cases','Status agreement; top-four fact retrieval'],['Does the validator reject bad outputs?','10 fixtures plus two explicit conflict/complementary cases','Expected accept/reject decisions'],['How does the model respond to the prompts?','Eight fixed questions, V0-V5, one sample per version','Valid JSON, parseable status match, contract acceptance']],[150,220,120]))
heading('Executed local model configuration')
story.append(table(['Field','Recorded value'],[['Model','Qwen/Qwen2.5-0.5B-Instruct-GGUF / Q4_K_M'],['Runtime','llama-cpp-python 0.3.36; CPU; four threads; context 4096'],['Sampling','temperature 0; top_p 1; seed 42; max_tokens 160; repeat_penalty 1'],['Output constraints','No forced JSON grammar during the comparative runs'],['Records','Exact input messages, raw outputs, token counts, timing, stop reason'],['Integrity','Full model SHA-256 retained in the run manifests']],[115,375]))
heading('How to interpret the metrics')
body('<b>Valid JSON</b> measures syntax. <b>Parseable status match</b> requires an explicit JSON status that matches the authored expected status. <b>Contract acceptance</b> additionally requires permitted fields and fact IDs consistent with the application gate. Prose can be useful while scoring zero on JSON integration metrics.')
body('The expected labels were authored as test oracles. There is no independent faculty/user rating, no repeated-seed estimate, no comparison across model families and no untouched external holdout. The challenge cases are authored probes, not an independent benchmark.')
page('05 / Measured results','Structure improves; safety needs a gate')
story.append(Image(str(D/'model_results.png'),width=490,height=175))
story.append(table(['Version','JSON /8','Status /8','Contract /8','Mean sec','Input tokens'],[[v['version'],v['json_valid'],v['status_correct'],v['contract_pass'],v['mean_seconds'],v['mean_prompt_tokens']] for v in M['versions']],[65,70,80,90,85,100]))
note('Counts are on the same eight development questions per version. Latencies are observed wall-clock values on the execution machine, not portable speed guarantees. V0-V2 were not designed around the final fact-selection contract; their zeros do not mean every prose answer was factually wrong.')
heading('Component results remain separate')
story.append(table(['Measure','Observed result','Meaning'],[['Question status agreement','39/42','30/30 development; 9/12 challenge'],['Relevant fact in top four','27/27 answerable probes','Retrieval hit does not guarantee downstream use'],['Validator fixtures','10/10','Expected accepts and rejects on fixed fixtures'],['Conflict/complementary checks','2/2','Explicit contradictory values separated from complementary facts']],[190,95,205]))
body('The final V5 run passed the contract on 8/8 development cases. This result supports proceeding with a larger independent evaluation; it is not evidence that all campus questions are answered correctly.')
page('06 / Error analysis','The failed cases shaped the design')
heading('Failure 1 / Relevant retrieval, irrelevant model selection')
body('For D01, V3 selected F01 together with F13 and F07. Only F01 answered the attendance-threshold question. The output was valid JSON, yet the relevance gate rejected it. JSON syntax alone was therefore insufficient.')
heading('Failure 2 / A schema example became answer content')
body('V4 chose the correct statuses for all eight cases, but D20 and D29 returned the literal placeholder string instead of an empty fact_ids array. The validator held these outputs. V5 replaced the informal placeholder with a typed schema and passed the same cases in the observed rerun.')
heading('Failure 3 / Retrieval success did not overcome alias gating')
story.append(table(['Challenge case','Expected','Observed','Interpretation'],[['H01 / B.Tech years to graduate','answered','not_found','Right card retrieved; phrasing missed the explicit alias gate'],['H03 / where guardians meet residents','answered','not_found','Plural/paraphrase not accepted by the gate'],['H08 / office for student certificates','answered','not_found','Plural certificate phrasing missed the gate']],[240,70,80,100]))
body('These are retained false abstentions, not silently removed examples. Adding aliases would repair the specific wording, but repeated patching of the same cases would not establish generalisation. A larger independently written paraphrase set and a better relevance gate are the next evaluation steps.')
callout('<b>Practical lesson:</b> accurate retrieval, correct JSON, correct status and supported answer content are separate requirements. A single overall percentage would hide these failure modes.')
page('07 / Working implementation','Open the file. Inspect the evidence.')
story.append(Image(str(P/'evidence/screenshots/attendance.jpg'),width=490,height=410))
note('Figure: verified browser capture of the working offline helpdesk. The result shows a dated source and historical-applicability caution. This is a prototype capture, not a real student pilot.')
heading('Portable first, optional inference second')
body('CampusCompass.html contains its assets and data, so it opens without a server. The optional localhost bridge uses the shared JavaScript engine for prompt assembly and validation, then performs actual GGUF inference in Python. Fresh API inference was checked separately from the retained comparative logs.')
note('Source: source/engine.js, source/serve_model.py, source/bridge.js, app/app.js. The model binary is downloaded separately and is not included in the submission ZIP.')
page('08 / Reproducibility','Every reported count has an evidence file')
story.append(table(['File / directory','Purpose'],[['data/corpus.json','Five source records and 19 curated facts'],['data/tests.json','42 questions, explicit scopes and expected labels'],['prompts/V0.txt ... V5.txt','Versioned instructions, including unchanged baseline'],['evidence/model_inputs*.json','Exact messages executed during inference'],['evidence/model_outputs*.jsonl','Unedited raw responses and execution metadata'],['evidence/model_run_manifest*.json','Model hash, runtime, parameters and limitations'],['evidence/model_evaluation.json','Per-run checks, including rejection reasons'],['evidence/component_results.json / .csv','Question results, retained misses and validator fixtures'],['evidence/api_smoke_test.json','Fresh local API inference and validation result'],['source/test.js / evaluate_model.js','Reproduce component checks and log scoring']],[245,245]))
heading('Short reproduction sequence')
story.append(p('1. Open CampusCompass.html<br/>2. node source/test.js<br/>3. node source/evaluate_model.js<br/>4. python source/bundle.py','code'))
body('For fresh model inference, follow README.md to download the official GGUF, verify its hash, install the pinned runtime and run the saved input jobs. CPU/backend differences can affect reproduction. Preserve the supplied original logs before running scripts that overwrite them.')
heading('Development evidence')
body('Prompt files, recorded failures and a change log document actual progress in this session. Individual historical contributions are not attributed without evidence. Team members should record their actual review, reproduction and explanation work before submission.')
page('09 / Sources and responsible use','Source age is part of the answer')
story.append(table(['ID / official source','Issue / scope note'],[[s['id']+' / '+s['title'],s['issued']+'. '+s['scope']] for s in C['sources']],[200,290]))
body('Sources were inspected on 17 November 2026. Source issue dates, academic-year labels and website upload paths are treated as different metadata. In particular, the hostel document is dated 2016 even though its current URL contains 2024. A recent URL does not prove a recent policy.')
heading('Responsible-use boundaries')
body('The demo does not require personal student records. Private-record requests are refused. Historical documents carry cautions, and an unknown current rule is not inferred from an archive. The system does not grant examination eligibility, condonation, refunds or exceptions. Its curated excerpts are deliberately small; missing information produces clarification or abstention.')
body('Input text is treated as untrusted, the interface renders text safely, and the optional bridge binds to localhost with origin and request-size checks. These controls have limited tests; they do not establish comprehensive prompt-injection defence or production security.')
heading('Research context')
body('Lewis et al. (2020), <i>Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks</i>, motivates supplying external evidence rather than relying only on model memory. Min et al. (2023), <i>FActScore</i>, motivates inspecting individual factual claims. This project uses a small lexical retrieval/curated-fact design; it does not implement the original RAG training architecture or the FActScore metric.')
note('References: https://arxiv.org/abs/2005.11401 and https://arxiv.org/abs/2305.14251. Official document URLs are clickable in the app and retained in data/corpus.json. Course authority: supplied Mini Project Guidelines 2026, section 10; supplied team-ID email.')
page('10 / Demonstration and next steps','A short demo with a defensible story')
story.append(table(['Time','Show','Explain'],[['0-15 s','Project identity and evidence boundary','C1, team ID, partial academic prototype'],['15-30 s','Attendance answer + official source ledger','A source is cited and its age remains visible'],['30-45 s','Underspecified fee question','No invented amount; request the needed scope'],['45-60 s','V3 recorded output','Valid JSON can still contain irrelevant selections'],['60-75 s','V4-to-V5 schema change','A specific observed failure led to a focused refinement'],['75-90 s','Forged fact validation','An unknown fact ID is held for review'],['90-105 s','Separate model/component results','48 model outputs; retained component misses'],['105-120 s','Reproduction and next evaluation','Portable source package and explicit limits']],[65,200,225]))
heading('What must happen before submission')
body('The team should open the standalone app, watch the full video, reproduce the component checks and understand the model failures. Upload the extracted source folder to the chosen Git/Drive location and verify faculty access. Rishi Mulchandani submits for PE-B37-13, following the supplied team email and current LMS form instructions.')
heading('Next milestone acceptance criteria')
body('Expand the evidence with an amendment/applicability review; use independently written paraphrases; compare a larger model; measure repeated-run consistency; have a human check claim relevance and source interpretation; record genuine team contributions and user feedback. The final objective is reliable source-supported help, not a perfect development-set score.')
note('AI disclosure: ChatGPT assisted with research, design, implementation, prompt development, evaluation and documentation. The video uses a synthetic narrator and actual app captures. No fabricated stakeholder feedback, deployment history or individual contribution is claimed.')
# Finish

def footer(c,doc):
 if doc.page==1:
  c.setFillColor(navy);c.rect(0,0,595.28,841.89,fill=1,stroke=0);c.setFillColor(teal);c.rect(50,748,45,5,fill=1,stroke=0)
 else:
  c.setFillColor(muted);c.setFont('DV',7.5);c.drawString(50,810,'CAMPUSCOMPASS  /  MILESTONE 2');c.drawRightString(545,810,'TEAM AETHERMIND · PE-B37-13');c.drawString(50,29,'SCSE4041 | Bennett University | 17 November 2026');c.drawRightString(545,29,f'{doc.page:02d}')
SimpleDocTemplate(str(D/'Technical_Report.pdf'),pagesize=(595.28,841.89),title='CampusCompass - Milestone 2 Technical Report',author='TEAM AETHERMIND - PE-B37-13',leftMargin=50,rightMargin=50,topMargin=53,bottomMargin=48).build(story,onFirstPage=footer,onLaterPages=footer)
# Viva guide (short, human-friendly)
v=[]
def vh(t):v.append(p(t,'h2'))
def vb(t):v.append(p(t))
v.extend([p('FACULTY DEMO & VIVA','eyebrow'),p('Explain the project clearly.','h1')]);vb('TEAM AETHERMIND | PE-B37-13 | CampusCompass')
vh('Your opening explanation')
vb('“CampusCompass answers selected campus questions from official evidence. We compare six prompt versions on a small local model, keep the raw failures, and validate the model’s selected fact IDs before rendering approved wording. Our final pilot passes eight development cases, while the larger component suite still has three paraphrase misses.”')
vh('Simple terms you should remember')
v.append(table(['Term','Simple meaning / Hinglish cue'],[['Grounding','Answer ko supplied evidence se jodna.'],['Retrieval','Question ke liye relevant evidence dhoondhna.'],['BM25-style ranking','Query words ka relevance score; rare matching words get more weight.'],['RAG','Retrieval-Augmented Generation: retrieve context, then use it in generation. Our build is a small hybrid, not the original trained RAG model.'],['Prompt injection','Question/document ke andar instruction jo system ke rules badalne ki koshish kare.'],['Schema','Output ka fixed structure: kaunse keys aur types allowed hain.'],['Hallucination','Evidence ke bina confident claim.'],['Abstention','Evidence insufficient ho toh answer invent na karna.'],['Ablation','Ek specific change ka effect dekhna, baaki inputs same rakhna.'],['Provenance','Claim kis source, page aur date se aaya.']],[115,375]))
v.append(PageBreak());v.extend([p('TOUGH QUESTIONS','eyebrow'),p('Answers you can defend.','h1')])
qa=[('Is 8/8 proof the chatbot is accurate?','No. It is contract acceptance on eight reused development cases. The independent reliability question remains open.'),('Why does V0 get zero?','It returned prose, while the metric checks the final JSON integration contract. Zero does not mean every prose sentence is factually false.'),('What is the real V5 improvement?','V4 copied the placeholder string in two outputs. V5 replaces only that schema description with a typed JSON Schema; the two observed failures disappear in the rerun.'),('What is the model actually doing?','It selects permitted evidence IDs. The application gate determines scope and allowed facts, and the renderer supplies curated wording. This conservative task limits unsupported generation.'),('Could the offline path work without the model?','Yes. The deterministic path is deliberately available. The model experiment studies instruction following and the tradeoff between flexibility and control; we do not claim the model is necessary for every fixed-card query.'),('Why not trust a 2024 URL?','It is an upload path, not necessarily the policy’s issue date. The hostel source itself is dated 2016.'),('What still fails?','Three authored paraphrases are retrieved but rejected by alias gating. We retain those misses and need independent paraphrase testing.'),('Did every member do the assigned work?','Only describe actual contributions. The package does not manufacture historical work attribution.')]
for q,a in qa:vh(q);vb(a)
v.append(PageBreak());v.extend([p('LIVE DEMO CHECKLIST','eyebrow'),p('Keep the demonstration simple.','h1')])
vb('1. Double-click CampusCompass.html. Ask the default attendance question. Point to the source date and historical caution.');vb('2. Click Missing scope. Explain why the assistant does not invent a fee amount.');vb('3. Open Prompt Studio. Choose V3 and replay D01: it selects unrelated IDs. Choose V5 and show the corrected selection.');vb('4. Click Try a forged fact. Explain why F999 is held for review.');vb('5. Open Evaluation bench. State the difference between model pilot counts and component checks.');vb('6. If live inference is requested, use the optional bridge after installing the model. Recorded replay is labelled and is not live inference.')
vh('Suggested review responsibilities - not completed-work claims')
v.append(table(['Member','Suggested review before viva'],[['Rishi Mulchandani','Architecture, submission, source-folder access'],['Nayan Santhalia','Prompt iterations, V4/V5 explanation, viva narrative'],['Poshkar Garg','Official evidence, dates and applicability'],['Aditya Kumar','Reproduction scripts, tests and model configuration'],['Bhavishya Jakhar','Video, report consistency and demo flow']],[170,320]))
vh('What to say if you do not know')
vb('“I have not verified that yet. The relevant evidence file is available, and I would check it before making that claim.”')
SimpleDocTemplate(str(D/'Demo_and_Viva_Guide.pdf'),pagesize=(595.28,841.89),leftMargin=50,rightMargin=50,topMargin=53,bottomMargin=48).build(v,onFirstPage=lambda c,d:None,onLaterPages=footer)
print('Technical report and viva guide created')
