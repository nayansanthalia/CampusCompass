from pathlib import Path
import json,shutil
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4,landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader,PdfWriter
p=Path(__file__).resolve().parent.parent;out=p/'submission';out.mkdir(exist_ok=True)
pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'));pdfmetrics.registerFont(TTFont('DVB','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'));pdfmetrics.registerFontFamily('DV',normal='DV',bold='DVB')
ink=colors.HexColor('#153749');teal=colors.HexColor('#087c74');pale=colors.HexColor('#eef5f1')
styles={'body':ParagraphStyle('body',fontName='DV',fontSize=9,leading=13,spaceAfter=8,textColor=ink),'cell':ParagraphStyle('cell',fontName='DV',fontSize=7.7,leading=10.7,textColor=ink),'title':ParagraphStyle('title',fontName='DVB',fontSize=23,leading=29,spaceAfter=15,textColor=ink),'head':ParagraphStyle('head',fontName='DVB',fontSize=12,leading=17,spaceAfter=9,textColor=teal)}
def P(t,s='body'):return Paragraph(t,styles[s])
def T(h,rows,w):
 t=Table([[P(escape(str(c)),'cell') for c in r] for r in [h]+rows],colWidths=w,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),pale),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#d6e2de')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]));return t
rows=json.loads((p/'evidence/form_test_rows.json').read_text());prompts=json.loads((p/'data/prompts.json').read_text())
def footer(c,d):
 c.setFont('DV',7);c.setFillColor(ink);c.drawString(36,22,'TEAM AETHERMIND | PE-B37-13 | Form-aligned evidence | 18 November 2026');c.drawRightString(806,22,str(d.page))
s=[P('Milestone 2 / complete test table','title'),P('Exact form counts: <b>42 unique test inputs</b>; <b>6 saved prompt versions</b>; <b>1 active final runtime prompt</b>.'),P('The table below records the specific question and supplied scope, expected output, actual output and Pass/Fail. Normal, edge and invalid/privacy/injection cases are labelled. Repeated model calls are not counted as new test inputs. Status and expected-fact checks give 39 Pass and 3 Fail. The three failures remain visible.'),P('Evaluation mode: deterministic prototype components. The 48 comparative Qwen model completions are separate evidence and are not added to this test-input count.')]
for start in range(0,len(rows),5):
 if start:s.append(PageBreak())
 s.append(P(f'Test rows {start+1}-{min(start+5,len(rows))} of 42','head'))
 data=[]
 for r in rows[start:start+5]:
  q=r['question']+'\nScope: '+(json.dumps(r['scope']) if r['scope'] else 'not specified')
  actual=r['actual_status']+' | facts: '+(', '.join(r['actual_fact_ids']) or 'none')+'\n'+r['actual_output']
  expected=r['expected_status']+'\n'+r['expected_output']
  data.append([r['id']+'\n'+r['case_type'],q,expected,actual,'Pass' if r['pass'] else 'Fail'])
 s.append(T(['ID / case type','Specific input','Expected output','Recorded actual output','Result'],data,[88,180,210,245,47]))
s.extend([PageBreak(),P('Prompt iteration log / 6 versions','title'),P('V0 is the first saved baseline. The form example starts at v1, but the count is still six distinct saved drafts: V0, V1, V2, V3, V4 and V5. Typographical fixes and the unused reviewer design prompt are not counted as additional versions.')])
changes=[]
notes={'V0':'Milestone 1 baseline retained unchanged.','V1':'Adds evidence-only source constraints; observed free-form output remains poorly integrated.','V2':'Adds scope/JSON request; the small model still produced prose.','V3':'Fact-selection contract yields JSON, but unrelated IDs and unsafe answers remain.','V4':'Adds trusted gate + few-shot cases and reduces context; two outputs copy the schema placeholder.','V5':'Only the schema representation changes relative to V4; final eight development outputs pass the contract.'}
for v in prompts:changes.append([v['id'],v['name'],v['change'],notes[v['id']]])
s.append(T(['Version','Saved design','Purposeful change / why','Recorded observation'],changes,[60,125,330,255]));s.append(Spacer(1,12));s.append(P('The final solution uses the V5 system-instruction template together with its dynamically assembled user payload as one runtime prompt/workflow step. V0-V4 are historical comparison versions. The optional reviewer.txt file is a design reference, not an executed second model step. Therefore form Q10 = 1 and Q18 = 6.'))
appendix=out/'_test_appendix.pdf';SimpleDocTemplate(str(appendix),pagesize=landscape(A4),leftMargin=36,rightMargin=36,topMargin=35,bottomMargin=37,title='CampusCompass Milestone 2 Complete Test Table',author='TEAM AETHERMIND').build(s,onFirstPage=footer,onLaterPages=footer)
writer=PdfWriter()
for f in [p/'docs/Technical_Report.pdf',appendix]:
 for page in PdfReader(f).pages:writer.add_page(page)
writer.add_metadata({'/Title':'TEAM AETHERMIND - Milestone 2 Submission','/Author':'TEAM AETHERMIND - PE-B37-13','/Subject':'Technical report, 42 test inputs and six prompt versions'})
with (out/'TEAM_AETHERMIND_Milestone2.pdf').open('wb') as f:writer.write(f)
shutil.copyfile(p/'docs/Technical_Report.pdf',out/'TEAM_AETHERMIND_TechnicalReport.pdf');appendix.unlink()
print('Milestone PDF pages:',len(writer.pages),'Unique rows:',len(rows),'Versions:',len(prompts))
for f in out.glob('*.pdf'):print(f.name,f.stat().st_size)
