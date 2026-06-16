from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

def create_clinical_report(biomarkers: dict, trials: list) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    title_style.alignment = 1 # Center
    
    h2_style = styles['Heading2']
    h3_style = styles['Heading3']
    normal_style = styles['Normal']
    
    match_style = ParagraphStyle(
        'MatchStyle',
        parent=normal_style,
        textColor=colors.HexColor('#059669'),
        backColor=colors.HexColor('#d1fae5'),
        borderPadding=(2, 4, 2, 4),
    )
    
    exclude_style = ParagraphStyle(
        'ExcludeStyle',
        parent=normal_style,
        textColor=colors.HexColor('#e11d48'),
        backColor=colors.HexColor('#ffe4e6'),
        borderPadding=(2, 4, 2, 4),
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("OrphanLink Clinical Summary Report", title_style))
    elements.append(Spacer(1, 12))
    
    # Biomarkers Section
    elements.append(Paragraph("Patient Biomarker Profile", h2_style))
    elements.append(Spacer(1, 6))
    
    age = biomarkers.get("age", "Unknown")
    mutations = ", ".join(biomarkers.get("active_mutations", [])) or "None"
    therapies = ", ".join(biomarkers.get("past_therapies", [])) or "None"
    
    data = [
        ['Age', str(age)],
        ['Active Mutations', mutations],
        ['Past Therapies', therapies]
    ]
    
    t = Table(data, colWidths=[150, 300])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))
    
    # Matches Section
    elements.append(Paragraph("Top Clinical Trial Evaluations", h2_style))
    elements.append(Spacer(1, 12))
    
    for i, res in enumerate(trials[:3]):
        trial_info = res.get("trial", {})
        eval_info = res.get("evaluation", {})
        
        status = eval_info.get("status", "UNKNOWN")
        reason = eval_info.get("reason", "No reason provided.")
        title = trial_info.get("title", "Unknown Title")
        nct_id = trial_info.get("nct_id", "NCT_UNKNOWN")
        
        elements.append(Paragraph(f"{i+1}. {title} ({nct_id})", h3_style))
        
        status_para = Paragraph(f"<b>Status:</b> {status}", match_style if status == "MATCH" else exclude_style)
        elements.append(status_para)
        elements.append(Spacer(1, 6))
        
        elements.append(Paragraph(f"<b>Justification:</b> {reason}", normal_style))
        elements.append(Spacer(1, 12))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer
