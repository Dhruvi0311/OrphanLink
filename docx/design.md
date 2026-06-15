A well-executed aesthetic is just as important as the backend architecture for this hackathon. Platforms like Carebox Health and Trialing.org succeed because they strip away the intimidating complexity of medical data and replace it with a "trust-first," highly accessible design language.

Here is the comprehensive Design Document for your Clinical Trial Matching Portal, reverse-engineered from those industry leaders and tailored specifically for your B2B web dashboard.

---

# UI/UX Design Document: Clinical Trial Portal

## 1. Design Philosophy & Aesthetic

The aesthetic must balance **clinical authority** with **modern software elegance**. The design language should feel less like a chaotic hospital database and more like a sleek, modern queue management or monitoring system. It needs to convey safety, speed, and precision.

* **Whitespace is your primary tool:** Use massive amounts of negative space to prevent cognitive overload when displaying dense medical text.
* **Minimalist Terminal Aesthetics:** For the live LangGraph execution logs, avoid messy console outputs. Frame them as clean, aesthetic status trackers with clear step-by-step progress indicators.

## 2. Color Palette (The "Clinical Trust" Theme)

Avoid harsh blacks or aggressive reds. Use deeply calming, professional tones that pass strict WCAG contrast ratios for accessibility.

* **Primary Action Color (The "Trust" Blue):** `#0F62FE` (IBM Blue) or `#2563EB` (Tailwind Blue). Use strictly for primary buttons ("Analyze Patient") and active progress states.
* **Background Color (Base):** `#F8FAFC` (Slate 50). An off-white background reduces eye strain compared to pure white and gives the application a modern SaaS feel.
* **Surface Color (Cards & Modules):** `#FFFFFF` (Pure White). Cards sitting on the off-white background create subtle, clean depth.
* **Text - Primary:** `#1E293B` (Slate 800) for high-legibility headings.
* **Text - Secondary:** `#64748B` (Slate 500) for timestamps, metadata, and minor UI labels.
* **Semantic Colors (For the LangGraph Terminal):**
* *Success/Match:* `#10B981` (Emerald)
* *Exclusion/Reject:* `#F43F5E` (Rose)
* *Extracting/Thinking:* `#F59E0B` (Amber)



## 3. Typography System

Medical text is incredibly dense. Your typography must be flawless to ensure judges can quickly read the matched protocols.

* **Primary Font Family:** **Inter** or **Roboto**. These sans-serif fonts are designed specifically for highly legible screen interfaces.
* **Hierarchy:**
* **H1 (Dashboard Titles):** Inter SemiBold, 24px, Slate 800.
* **H2 (Card Headers, e.g., "Matched Trial"):** Inter Medium, 18px, Slate 800.
* **Body Text (Medical Protocol text):** Inter Regular, 15px, Slate 600, with a spacious line-height of `1.6` (160%).
* **Terminal/Code Blocks:** **Fira Code** or **JetBrains Mono**, 13px. Using a monospace font for your agentic execution logs visually separates the "AI brain" from the clinical results.



## 4. Layout Structure: The Dual-Pane "Control Center"

Since the goal is to show the backend agents working in real-time alongside the medical data, a side-by-side layout works best for desktop/presentation formats.

* **Left Pane (30% Width) - The Ingestion & Log Zone:**
* **Top:** A dashed-border, soft-gray dropzone for the PDF lab report.
* **Bottom:** The "Agentic Tracker." A sleek, dark-themed (or soft gray) terminal box mapping the background processes. As your LangGraph nodes fire, sleek text lines appear here with timestamps, showing the batch processes executing in sequence.


* **Right Pane (70% Width) - The Results Canvas:**
* Starts empty with a subtle, pulsing empty-state icon.
* Once processing is complete, it populates with cleanly separated **Cards**.
* Each card represents a matched trial, displaying the Trial Title, the exact matched Biomarkers (as neat, pill-shaped tags), and the inclusion criteria validated by the AI.



## 5. Component Styling

Take cues from the component libraries of modern health-tech platforms:

* **Cards & Containers:** `border-radius: 12px;` with a very soft, diffused drop shadow (e.g., `box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);`). No harsh, dark borders.
* **Tags & Badges:** When extracting medical acronyms (like "BRCA1" or "Phase II"), wrap them in soft pill-shaped badges (e.g., light blue background with dark blue text, fully rounded corners).
* **Buttons:** Rounded rectangles (`border-radius: 8px;`). They should have a subtle hover effect (slight lift or color darkening) to feel responsive.
* **Data Presentation:** Never display raw JSON to the user unless it's inside the "Agentic Terminal" window. Convert all extracted JSON arrays into bulleted lists with subtle checkmark icons.

## 6. Micro-interactions & Polish

* **The Loading State (Crucial for Demo):** Since the RRF hybrid search and multi-node routing take a few seconds, do not use a standard spinning wheel. Use a **skeleton loader** (gray pulsing boxes shaped like text) in the right pane, while the left pane's terminal log actively streams exactly what the AI is analyzing at that exact millisecond.
* **Citations:** When the portal cites an exclusion criteria rule, underline it with a very thin, dashed line. When the user hovers over it, a small, elegant tooltip should appear showing the exact page number of the source document.