# OrphanLink: Video Presentation Script

**Target Length:** 10-12 minutes (Approx. 1300-1500 words spoken at a normal pace)
**Presenter Notes:** Speak clearly, pause for emphasis, and use the suggested visual cues to guide your slides or screen recordings.

---

## Introduction & Context (1-2 minutes)

**[Visual cue: Title Slide with a powerful, human-centric image (e.g., a patient and doctor talking) fading into the OrphanLink Logo.]**

**Speaker:**
"Health is the most universal human experience. When someone we love is diagnosed with a severe illness like cancer or a rare disease, the entire world stops. All that matters is finding hope—finding the right treatment. But right now, for millions of patients, that hope is buried in a database they can't understand or trapped behind administrative bottlenecks. 

Hello everyone. Today, I'm excited to present **OrphanLink**, our autonomous clinical trial matching portal. We built OrphanLink as an AI-powered B2B platform designed to seamlessly connect these patients to complex, life-saving trials from ClinicalTrials.gov. Our platform is powered by a self-correcting multi-agent orchestrator, real-time entity standardization, and hybrid semantic search to ensure zero-hallucination patient-to-trial mapping. Over the next 10 minutes, I’ll walk you through why we built this, how it works, and our vision for the future by answering five core questions."

---

## 1. What problem are you solving? (2-2.5 minutes)

**[Visual cue: Slide showing a frustrated clinician surrounded by stacks of medical papers, transitioning into a case study example of "Sarah".]**

**Speaker:**
"So, what problem are we solving? Matching patients to clinical trials is one of the most critical, yet severely bottlenecked steps in modern precision medicine. 

To put this in perspective, imagine a breast cancer patient—let's call her Sarah. Her biopsy report states she has a BRCA2 mutation. Her oncologist has 15 minutes for her consultation. In that time, the doctor cannot possibly search through the 450,000 active listings on ClinicalTrials.gov, map her exact mutation, and verify if she meets the dozens of exclusion criteria. It's humanly impossible.

This creates four massive hurdles:
First, the **Search Space**. Manual review is incredibly slow, keeping patients waiting when time is of the essence.

Second, the **Terminology Mismatch**. Sarah's lab report might say she is taking 'Keytruda' for a 'HER2' mutation. But the clinical trial lists the scientific name 'pembrolizumab' and the official gene symbol 'ERBB2'. Traditional keyword searches completely miss these matches.

Third, **Incomplete Clinical Context**. Let's say Sarah uploads her genetic report, but it doesn't mention her exact age or that she had prior chemotherapy. Standard systems will just reject her from trials immediately because the data is incomplete.

Finally, **AI Hallucinations and Safety Risks**. Conventional AI models are notoriously bad at handling complex medical negation. They will read an exclusion criteria like 'Patients with a history of heart disease are excluded,' misinterpret it, and recommend the trial anyway. In medicine, that isn't just a software bug; it's a massive safety risk."

---

## 2. How do you plan to scale it? (2 minutes)

**[Visual cue: Diagram showing a B2B2C integration model. Connecting OrphanLink to Hospital Networks, EHR Systems, and Global Trial Databases.]**

**Speaker:**
"Next, how do we plan to scale OrphanLink? Our go-to-market strategy is a **B2B2C model**. Our primary target market is oncology clinics, research networks, and large hospital systems. They are the ones who need this AI co-pilot to save billable hours. But the interface remains patient-centric, empowering individuals like Sarah to take control of their search.

From a technical perspective, our architecture is built for infinite scale. 
Instead of relying solely on heavy local AI models for everything, we use highly scalable REST APIs like RxNorm and MyGene.info for real-time standardization. 

To scale data ingestion, our next step is direct **EHR (Electronic Health Record) integration**, such as FHIR protocols for Epic or Cerner, bypassing the need for PDF uploads entirely. 

Because we use a modular **LangGraph multi-agent architecture**, scaling our capabilities is as simple as plugging in new agents. Tomorrow, we could add a Pediatric Specialist Agent, a Billing & Insurance Agent, or expand beyond oncology into immunology and neurology without rewriting our core matching engine."

---

## 3. Why do you think this problem wasn't solved yet? (2 minutes)

**[Visual cue: Side-by-side comparison of a standard ChatGPT prompt failing vs. the OrphanLink Multi-Agent workflow interacting with a patient.]**

**Speaker:**
"You might be wondering, with the recent boom in AI, why hasn't this problem been solved yet?

The answer lies in the intersection of complexity and risk. Standard Retrieval-Augmented Generation (RAG) or naive 'ChatGPT-style' wrappers simply cannot handle medical text safely. They hallucinate. They miss hidden exclusions. 

Furthermore, medical terminology is highly fragmented. Without rigorous entity standardization—mapping brand names to chemical ingredients before searching—the AI is flying blind. 

But the biggest reason this hasn't been solved is the **lack of human-in-the-loop intelligence**. Most systems try to automate 100% of the process. When they encounter a missing piece of data—like Sarah's age—they crash or guess. Nobody built a system that actively pauses, turns to the patient, and asks, *'Hi Sarah, to match you correctly, could you tell me your age and if you've had chemo?'* before proceeding. Until OrphanLink."

---

## 4. What is so unique about your implementation? (2.5 minutes)

**[Visual cue: Architecture diagram highlighting the LangGraph State Machine, Hybrid RAG, and Evaluator/Validator loop.]**

**Speaker:**
"This brings me to what is uniquely powerful about our implementation. We aren't just sending prompts to an LLM; we've built a robust, self-correcting state machine.

First, our **Intelligent Human-in-the-Loop Clarification**. As I mentioned with Sarah, if our Abstractor Agent detects missing critical fields, our Graph orchestrator dynamically pauses. A Quiz Generator Agent takes over, talks to the patient via our intake chatbot to gather those specific missing details, and then seamlessly resumes the workflow.

Second, our **API-Driven Entity Linking**. Before we even search for trials, we bounce the patient's raw data against the RxNorm and MyGene.info APIs to normalize drug brands and gene aliases to strict scientific standards.

Third, our **Hybrid Dense-Sparse Local RAG**. We don't just rely on vector search. We combine ChromaDB for semantic similarity with Rank-BM25 for exact keyword matching, merging the results via Reciprocal Rank Fusion. This guarantees top-tier trial relevance.

And finally, our crown jewel: the **Self-Correcting Multi-Agent Verification Loop**. We have an Evaluator Agent that checks criteria and mandates verbatim text evidence. But we don't stop there. A secondary Validator Agent scrutinizes that output specifically looking for hidden exclusions or contradictions. If it finds a safety conflict, it sends a structured critique back to the Evaluator to self-correct. It’s essentially AI peer-review, ensuring zero-hallucination matches."

---

## 5. Given more time and data, what could you have done better? (1.5-2 minutes)

**[Visual cue: A "Future Roadmap" slide showing custom LLM fine-tuning, deeper analytics dashboards, and global/multilingual support.]**

**Speaker:**
"Finally, given more time and data, what could we have done better?

If we had **more data**, specifically a proprietary dataset of historically successful and failed patient-to-trial matches, we wouldn't need to rely entirely on generic foundation models like LLaMA-3. We could fine-tune our own smaller, highly specialized medical LLMs for extraction and evaluation. This would drastically reduce latency, lower API costs, and improve safety guardrails natively.

If we had **more time**, we would build out native FHIR integrations to pull patient data directly from hospital databases seamlessly. We would improve the UI dashboard for clinicians, offering deep data visualization on trial cohorts and predictive analytics on trial success rates.

Crucially, we would also expand to make the platform **multilingual**. Cancer and rare diseases are global problems, yet the vast majority of clinical trial data and advanced AI tools are strictly in English. By adding robust multilingual support, we can open up these life-saving global trials to patients regardless of their native language or geographic location.

In conclusion, OrphanLink is more than a search engine; it's an intelligent, self-correcting clinical co-pilot. We believe it has the power to cut through the noise, save clinicians hours of manual labor, and ultimately get patients into the life-saving trials they need faster than ever before. 

Thank you."
