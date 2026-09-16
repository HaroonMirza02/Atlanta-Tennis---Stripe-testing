from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.pdfbase.pdfmetrics import stringWidth
from xml.sax.saxutils import escape
import re

root = Path(__file__).resolve().parents[1]
source = root / 'docs' / 'TENNIS_PLATFORM_TECHNICAL_ASSESSMENT.md'
output = root / 'output' / 'pdf' / 'Atlanta_Tennis_Technical_Assessment.pdf'
output.parent.mkdir(parents=True, exist_ok=True)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleCustom', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=24, leading=29, textColor=colors.HexColor('#173d35'), spaceAfter=10))
styles.add(ParagraphStyle(name='H1Custom', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=15, leading=19, textColor=colors.HexColor('#173d35'), spaceBefore=18, spaceAfter=7))
styles.add(ParagraphStyle(name='H2Custom', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=colors.HexColor('#315a4d'), spaceBefore=12, spaceAfter=5))
styles.add(ParagraphStyle(name='BodyCustom', parent=styles['BodyText'], fontName='Helvetica', fontSize=9.1, leading=13, spaceAfter=5, textColor=colors.HexColor('#26332d')))
styles.add(ParagraphStyle(name='MonoCustom', parent=styles['BodyText'], fontName='Courier', fontSize=7.6, leading=10.2, leftIndent=8, rightIndent=8, backColor=colors.HexColor('#eef1ea'), borderPadding=6, spaceAfter=7))
styles.add(ParagraphStyle(name='SmallCustom', parent=styles['BodyText'], fontName='Helvetica', fontSize=7.5, leading=10, textColor=colors.HexColor('#5c6a61'), spaceAfter=3))

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#cfd8cf')); canvas.line(18*mm, 282*mm, 192*mm, 282*mm)
    canvas.setFillColor(colors.HexColor('#173d35')); canvas.setFont('Helvetica-Bold', 7)
    canvas.drawString(18*mm, 286*mm, 'ATLANTA TENNIS PLATFORM  /  TECHNICAL ASSESSMENT')
    canvas.setFont('Helvetica', 7); canvas.setFillColor(colors.HexColor('#607067'))
    canvas.drawRightString(192*mm, 12*mm, f'CONFIDENTIAL PREPARATION  •  {doc.page}')
    canvas.restoreState()

story = []
in_code = False
for raw in source.read_text(encoding='utf-8').splitlines():
    line = raw.strip()
    if line.startswith('```'):
        in_code = not in_code
        continue
    if not line:
        story.append(Spacer(1, 4)); continue
    if in_code:
        story.append(Paragraph(escape(line).replace(' ', '&nbsp;'), styles['MonoCustom'])); continue
    if line.startswith('# '):
        story.append(Paragraph(escape(line[2:]), styles['TitleCustom']))
    elif line.startswith('## '):
        story.append(Paragraph(escape(line[3:]), styles['H1Custom']))
    elif line.startswith('### '):
        story.append(Paragraph(escape(line[4:]), styles['H2Custom']))
    elif line.startswith('|'):
        cells = [cell.strip() for cell in line.strip('|').split('|')]
        if not all(set(cell) <= set('-: ') for cell in cells):
            text = '  •  '.join(cells).replace('**', '').replace('`', '')
            story.append(Paragraph(escape(text), styles['SmallCustom']))
    elif line.startswith('- '):
        clean = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', line[2:])
        story.append(Paragraph('• ' + escape(clean), styles['BodyCustom']))
    elif line[:2].isdigit() and '. ' in line[:4]:
        story.append(Paragraph(escape(line), styles['BodyCustom']))
    else:
        # Print source labels, not long Markdown URLs that would create an orphan page.
        line = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', line)
        safe = escape(line).replace('**', '')
        story.append(Paragraph(safe, styles['BodyCustom']))

doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=22*mm, bottomMargin=19*mm, title='Atlanta Tennis Platform - Technical Assessment', author='Vision71')
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(output)
