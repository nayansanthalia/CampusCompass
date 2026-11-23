from pathlib import Path
from xml.sax.saxutils import escape
import json, textwrap, subprocess
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
final = root / 'final'
work = root.parent / 'tmp' / 'm3'
work.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('DejaVu','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuBold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
styles = getSampleStyleSheet()
styles['BodyText'].fontName='DejaVu'
for key in ['Title','Heading1','Heading2']:
    styles[key].fontName = 'DejaVuBold'
    styles[key].textColor = HexColor('#08766e')
styles['BodyText'].leading = 15
styles['BodyText'].spaceAfter = 8
def read(name):
    return json.loads((root / name).read_text())
def footer(c, doc):
    c.setFillColor(HexColor('#22495b'))
    c.setFont('DejaVu', 8)
    c.drawString(52, 33, 'CAMPUSCOMPASS   /   TEAM AETHERMIND   /   PE-B37-13')
    c.drawRightString(doc.pagesize[0]-52, 33, str(doc.page))
story = [Spacer(1,90)]
toc = ['Executive summary','1. Introduction','2. Problem and domain analysis','3. Existing solutions and literature','4. Prompt and solution design','5. Prompt development and implementation','6. Evaluation and testing','7. Results and discussion','8. Responsible AI and project contribution','9. Conclusion and future scope','References','Appendices A–C · Prompts, evaluation evidence and source catalog']
for line in (final/'Final_Report.md').read_text().splitlines():
    if line == '## Executive summary':
        story.extend([Spacer(1,40),Paragraph('Contents',styles['Heading1'])])
        story.extend(Paragraph(escape(item),styles['BodyText']) for item in toc)
        story.append(PageBreak())
    if line.strip():
        tag = 'Title' if line.startswith('# ') else 'Heading1' if line.startswith('## ') else 'BodyText'
        story.append(Paragraph(escape(line.lstrip('# ')), styles[tag]))
def heading(title):
    story.append(PageBreak())
    story.append(Paragraph(title, styles['Heading1']))
def body(text):
    story.append(Paragraph(escape(text), styles['BodyText']))
heading('Appendix A | Initial and final prompts')
for p in read('data/prompts.json'):
    body(p['id'] + ' — ' + p['text'])
heading('Appendix B | Evaluation evidence')
for row in read('evidence/final_cases.json'):
    body(f"{row['id']} | {row['question']} Expected {row['expected']} / {row['expectedFact'] or 'no citation'}. Actual {row['actual']} / {', '.join(row['facts']) or 'no citation'}. {'PASS' if row['pass'] else 'FAIL'}. {row['answer']}")
body('Full 42-row regression table: evidence/component_results.csv. Original results: evidence/m2_component_baseline.json. Exact model prompts, responses and settings: evidence/model_inputs*.json, model_outputs*.jsonl and model_run_manifest*.json.')
heading('Appendix C | Official evidence catalog')
for src in read('data/corpus.json')['sources']:
    body(f"{src['id']} | {src['title']} | {src['issued']} | {src['url']}")
SimpleDocTemplate(str(final/'TEAM_AETHERMIND_Milestone3_Report.pdf'),leftMargin=52,rightMargin=52).build(story,onFirstPage=footer,onLaterPages=footer)

scenes = [
('CampusCompass', ['Prompt Engineering at Bennett University','TEAM AETHERMIND · PE-B37-13'], 'Campus Compass asks a simple question. Can students see why a campus policy answer applies? We built a source grounded helpdesk prototype for our prompt engineering project at Bennett University. It connects a limited set of questions to official evidence and makes uncertainty visible.', None),
('Why scope matters', ['Rules depend on year, programme and context','Use official channels for individual decisions'], 'A student looking up a rule may find a notice from a different cohort. A certificate request may also need action from staff. Bennett already provides registrar resources and a service desk. Our prototype helps students find evidence and routes them to the official channel when appropriate.', None),
('What existing tools teach us', ['University PDF assistants cite page locations','Hybrid retrieval helps with paraphrases','Conflict-aware tools surface incompatible rules'], 'We reviewed repository documentation for university PDF assistants, a hybrid retrieval chatbot, and Rulebook AI. These projects already demonstrate citations, refusals and conflict handling. We focused our work on Bennett specific scope and an inspectable evaluation. The comparison concerns documented features.', None),
('Follow the source', ['Curated answer, locator and short quote','Historical applicability warning'], 'Here is the attendance example from our helpdesk. The user sees a curated answer and the official source citation. The historical warning asks the student to verify present applicability. The evidence format is designed to help a student check what the document actually said.', 'attendance.jpg'),
('Handle missing evidence', ['Ask for programme, year and fee category','Direct the student to the official service desk'], 'A hostel fee or refund can depend on details the assistant does not have. The workflow asks for those details and avoids citing unrelated documents. The final version also links to the official service desk so students can contact the university when they need an authoritative answer.', 'clarify.jpg'),
('Inspect the prompt', ['Question and scope → retrieval → permitted facts','Qwen draft → validator → source-linked render'], 'In the prompt studio we expose the instructions and data sent to the local Qwen model. The application supplies a permitted status and fact identifiers. The model emits a structured draft. The validator checks that the selection matches the evidence, and the renderer keeps source wording under application control.', 'promptstudio.jpg'),
('Valid JSON can still fail', ['V3 accepted 1 of 8 contracts','Unexpected fact IDs fail validation'], 'Version three produced valid JSON in all eight development cases, but passed only one complete output contract. A draft can select a real fact that answers an entirely different question. The validator checks relevance and scope as well as JSON syntax and fact membership.', 'validator.jpg'),
('Refine the output schema', ['V4 accepted 6 of 8 contracts','V5 accepted 8 of 8 on the same questions'], 'Version four used a trusted gate and narrower evidence. Two outputs copied a placeholder. Version five changed the schema representation to a formal typed object. It passed the contract in all eight development cases. Forty eight actual responses across six versions are included for reproduction.', None),
('Recheck the final workflow', ['42/42 regression statuses, up from 39/42','12/12 additional internal checks','10/10 validator fixtures'], 'The original router missed three paraphrases even when retrieval found the relevant fact. Targeted aliases recover those cases, and the final build passes the existing forty two routing checks. Twelve additional internal questions test status and fact selection. These checks are small and were authored within the project.', None),
('Where we go next', ['Review policy applicability with staff','Measure claim support with independent queries','Reproduce the run from the source package'], 'The standalone app uses curated evidence. The prompt studio supports replay and optional local inference. A wider study needs independently written student queries and policy owner review, especially for current rules and exceptions. The final package includes the report, source, prompt history and evaluation results.', None),
]
prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
for title, bullets, narration, asset in scenes:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = RGBColor.from_string('102B3D')
    def box(text, x, y, width, height, size, color):
        shape = slide.shapes.add_textbox(Inches(x),Inches(y),Inches(width),Inches(height))
        shape.text_frame.word_wrap = True
        shape.text_frame.text = text
        for p in shape.text_frame.paragraphs:
            p.font.name='Aptos'; p.font.size=Pt(size); p.font.color.rgb=RGBColor.from_string(color)
    box('CAMPUSCOMPASS   /   MILESTONE 3',.55,.32,12,.4,15,'8DDAC5')
    box(title,.55,.95,12,1,38,'FFFFFF')
    if asset:
        slide.shapes.add_picture(str(root/'evidence/screenshots'/asset), Inches(.65), Inches(2.02), width=Inches(7.0))
    for i,b in enumerate(bullets):
        box(b,8.05 if asset else .65,2.15+i*1.11,4.7 if asset else 11,1.02,23 if asset else 30,'DDECEF')
    box('TEAM AETHERMIND   /   PE-B37-13',.55,7,12,.35,13,'8DDAC5')
    slide.notes_slide.notes_text_frame.text = narration
prs.save(final/'TEAM_AETHERMIND_Milestone3_Presentation.pptx')

if '--documents-only' in __import__('sys').argv:
    raise SystemExit(0)

def ff(args):
    subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-y',*args],check=True,cwd=work)
def stamp(sec):
    return f'{sec//3600:02d}:{sec//60%60:02d}:{sec%60:02d},000'
captions, transcript = [], []
for i,(title,bullets,narration,asset) in enumerate(scenes):
    im=Image.new('RGB',(1280,720),'#102b3d')
    draw=ImageDraw.Draw(im)
    def label(x,y,value,size,color):
        draw.text((x,y), value,font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size),fill=color)
    label(46,34,'CAMPUSCOMPASS  /  MILESTONE 3',18,'#8ddac5')
    label(46,84,title,46,'white')
    if asset:
        pic=Image.open(root/'evidence/screenshots'/asset).convert('RGB')
        pic.thumbnail((730,480))
        im.paste(pic,(46,160))
    y=185
    for bullet in bullets:
        for line in textwrap.wrap(bullet,28 if asset else 53):
            label(810 if asset else 52,y,line,26 if asset else 33,'#ddecef')
            y+=44
        y+=29
    label(46,673,'TEAM AETHERMIND  /  PE-B37-13',17,'#8ddac5')
    im.save(work/f'frame{i}.png')
    (work/f'text{i}.txt').write_text(narration)
    ff(['-f','lavfi','-i',f'flite=textfile=text{i}.txt:voice=slt',f'voice{i}.wav'])
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(work/f'voice{i}.wav')]))
    ff(['-loop','1','-framerate','12','-i',f'frame{i}.png','-i',f'voice{i}.wav','-af',f'atempo={max(1,duration/19):.5f},apad','-t','21','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','22','-pix_fmt','yuv420p','-c:a','aac',f'clip{i}.mp4'])
    captions.append(f'{i+1}\n{stamp(i*21)} --> {stamp((i+1)*21)}\n'+ '\n'.join(textwrap.wrap(narration,56))+'\n')
    transcript.append('## '+title+'\n\n'+narration)
(work/'concat.txt').write_text(''.join(f"file 'clip{i}.mp4'\n" for i in range(len(scenes))))
ff(['-f','concat','-safe','0','-i','concat.txt','-c','copy','-movflags','+faststart',str(final/'CampusCompass_Final_Demo.mp4')])
(final/'Final_Demo_Captions.srt').write_text('\n'.join(captions))
(final/'Video_Transcript.md').write_text('# Final demo transcript\n\nSynthetic narration and recorded prototype captures. Screens show the earlier prototype where the interface is shared.\n\n'+'\n\n'.join(transcript))
