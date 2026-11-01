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
    
    needs_info_style = ParagraphStyle(
        'NeedsInfoStyle',
        parent=normal_style,
        textColor=colors.HexColor('#d97706'),
        backColor=colors.HexColor('#fef3c7'),
        borderPadding=(2, 4, 2, 4),
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("OrphanLink Clinical Summary Report", title_style))
    elements.append(Spacer(1, 12))
    
    # Biomarkers Section
    elements.append(Paragraph("Aggregated Patient Clinical Profile", h2_style))
    elements.append(Spacer(1, 6))
    
    condition = biomarkers.get("condition_or_cancer_type") or "Not specified"
    stage = biomarkers.get("cancer_stage") or "Not assigned (Core biopsy alone / Formal TNM unassigned)"
    metastatic = biomarkers.get("metastatic_status") or "Undocumented / Unassigned"
    age = biomarkers.get("age", "Unknown")
    ecog = biomarkers.get("ecog_status") or (f"ECOG {biomarkers.get('ecog_score')}" if biomarkers.get("ecog_score") is not None else "Undocumented")
    
    # Receptor status
    rec = biomarkers.get("receptor_status")
    rec_str = "Not tested"
    if isinstance(rec, dict):
        rec_parts = [f"{k}: {v}" for k, v in rec.items() if v]
        if rec_parts:
            rec_str = ", ".join(rec_parts)
    elif rec:
        rec_str = str(rec)
        
    # Genetic Mutation Status (Distinguish 4 states)
    gen_stat = biomarkers.get("genetic_testing_status", "NOT_DOCUMENTED")
    if gen_stat == "CONFIRMED_MUTATION":
        mutations = ", ".join(biomarkers.get("active_mutations", [])) or "Confirmed Mutation"
    elif gen_stat == "CONFIRMED_NEGATIVE":
        mutations = "Confirmed Negative (No Pathogenic Variants Found)"
    elif gen_stat == "NOT_TESTED":
        mutations = "Not Tested"
    else:
        mutations = "Not Documented"
    
    # Detailed Prior Therapies / Regimens
    detailed_therapies = biomarkers.get("prior_therapies_detailed", [])
    if detailed_therapies:
        regimen_summaries = []
        for dt in detailed_therapies:
            parts = []
            if dt.get("regimen_name"):
                parts.append(dt["regimen_name"])
            elif dt.get("agent_class"):
                parts.append(dt["agent_class"])
            if dt.get("regimen_count"):
                parts.append(f"{dt['regimen_count']} regimen(s)")
            if dt.get("setting"):
                parts.append(f"{dt['setting']} setting")
            if dt.get("dates_or_timing"):
                parts.append(f"({dt['dates_or_timing']})")
            regimen_summaries.append(" - ".join(parts) if parts else str(dt))
        therapies_str = "; ".join(regimen_summaries)
    else:
        therapies_str = ", ".join(biomarkers.get("past_therapies", [])) or "None documented"

    # Verified therapies
    verified = biomarkers.get("verified_therapies", [])
    verified_names = [v.get("name", "") if isinstance(v, dict) else str(v) for v in verified]
    verified_str = ", ".join(verified_names) or "None documented"
    
    # Patient-reported therapies
    pt_reported = biomarkers.get("patient_reported_therapies", [])
    pt_names = [p.get("name", "") if isinstance(p, dict) else str(p) for p in pt_reported]
    pt_str = ", ".join(pt_names) or "None reported"
    
    # Source documents
    docs = biomarkers.get("source_documents", [])
    docs_str = ", ".join(docs) or "Uploaded medical records"
    
    data = [
        ['Condition / Cancer Type', str(condition)],
        ['Cancer Stage (TNM)', str(stage)],
        ['Metastatic Status', str(metastatic)],
        ['ECOG Performance Status', str(ecog)],
        ['Age / Demographics', str(age)],
        ['Receptor Status', rec_str],
        ['Genetic Testing & Mutations', mutations],
        ['Treatment Regimens & History', therapies_str],
        ['Verified Medications', f"✓ {verified_str}" if verified_names else "None"],
        ['Patient-Reported Regimens', f"⚠️ {pt_str} (Requires Verification)" if pt_names else "None"],
        ['Source Documents', docs_str]
    ]
    
    t = Table(data, colWidths=[160, 290])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.black),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 18))
    
    # Matches Section
    elements.append(Paragraph("Clinical Trial Eligibility Evaluations", h2_style))
    elements.append(Spacer(1, 10))
    
    exclude_style = ParagraphStyle(
        'ExcludeStyle',
        parent=normal_style,
        textColor=colors.HexColor('#dc2626'),
        backColor=colors.HexColor('#fee2e2'),
        borderPadding=(2, 4, 2, 4),
    )
    
    for i, res in enumerate(trials[:5]):
        trial_info = res.get("trial", {})
        eval_info = res.get("evaluation", {})
        
        status = eval_info.get("status", "UNKNOWN").upper()
        reason = eval_info.get("reason", "No reason provided.")
        title = trial_info.get("title", "Unknown Title")
        nct_id = trial_info.get("nct_id", "NCT_UNKNOWN")
        recruitment_status = trial_info.get("recruitment_status") or eval_info.get("recruitment_status") or "UNKNOWN"
        locations = trial_info.get("locations") or eval_info.get("locations") or []
        has_india = trial_info.get("has_indian_site") or eval_info.get("has_indian_site") or False
        
        loc_str = "Sites in India: " + ", ".join(locations[:3]) if has_india else (", ".join(locations[:2]) if locations else "Global / Multicenter")
        
        elements.append(Paragraph(f"{i+1}. {title} ({nct_id})", h3_style))
        
        if status in ["MATCH", "POTENTIAL_MATCH"]:
            badge_style = match_style
            display_status = "POTENTIAL MATCH"
        elif status == "NEEDS_MORE_INFORMATION":
            badge_style = needs_info_style
            display_status = "NEEDS MORE INFORMATION"
        else:
            badge_style = exclude_style
            display_status = f"EXCLUDED ({recruitment_status})" if recruitment_status in ["TERMINATED", "COMPLETED", "WITHDRAWN"] else "EXCLUDED"
            
        status_para = Paragraph(f"<b>Status:</b> {display_status} | <b>Recruitment:</b> {recruitment_status} | <b>Geography:</b> {loc_str}", badge_style)
        elements.append(status_para)
        elements.append(Spacer(1, 4))
        
        elements.append(Paragraph(f"<b>Reasoning:</b> {reason}", normal_style))
        
        questions = eval_info.get("missing_information_questions", [])
        if questions and status == "NEEDS_MORE_INFORMATION":
            elements.append(Spacer(1, 4))
            elements.append(Paragraph("<b>Targeted Follow-up Questions:</b>", normal_style))
            for q in questions[:2]:
                elements.append(Paragraph(f"• {q}", normal_style))
                
        elements.append(Spacer(1, 10))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer
