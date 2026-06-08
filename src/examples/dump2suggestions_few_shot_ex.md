## Few-shot Examples for MemoFlow `dump -> suggestions`

These examples are intended to teach the model how to classify raw memo dumps into structured suggestions.

Classification rules:

```text
Task = concrete action, deliverable, person to contact, deadline, or next step.
Exploration = active open question, decision, research direction, learning goal, or sensemaking problem.
Idea = possible project, feature, content idea, noun phrase, or maybe-later thought without a clear action/question.
Reference = information to save, with no direct action implied.
Clarify needed = insufficient information to safely classify.
```

The model should not infer the user's true commitment level unless the memo clearly signals it. For short bare phrases, classify by observable wording:
- concrete action phrase -> task
- question / decision / research wording -> exploration
- bare project/topic/feature phrase -> idea
- link / quote / reflection / information -> reference
- too ambiguous to interpret -> clarify_needed

---

### Example 01

Input:

```text
面试带 id！
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Bring ID to the interview",
      "description": "Remember to bring identification to the upcoming interview.",
      "status": "ready",
      "confidence": 0.95,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "interview",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 02

Input:

```text
now the gap is agentic application building experience
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Close the gap in agentic application building experience",
      "description": "Figure out what concrete projects or practice can build agentic application experience.",
      "status": "open",
      "confidence": 0.86,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "career/learning",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 03

Input:

```text
能不能赶上具身智能风口--学习/工作蹭到/发点 paper？
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Explore whether to catch the embodied intelligence wave",
      "description": "Think through whether learning, work opportunities, or publishing a paper could help enter the embodied intelligence area.",
      "status": "open",
      "confidence": 0.88,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "career/research",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 04

Input:

```text
1. 还设备 2. 回复 gjl 3. agentic application 项目
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Return company equipment",
      "description": "Return the required equipment.",
      "status": "ready",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    },
    {
      "type": "task",
      "title": "Reply to GJL",
      "description": "Send a reply to GJL.",
      "status": "ready",
      "confidence": 0.85,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "communication",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    },
    {
      "type": "task",
      "title": "Work on the agentic application project",
      "description": "Continue or start the agentic application project.",
      "status": "ready",
      "confidence": 0.78,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "project",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 05

Input:

```text
4. 开始找工作（lance 的 ai 找岗位 tool）
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Start job search using Lance's AI job search tool",
      "description": "Begin looking for jobs, including trying Lance's AI job-search tool.",
      "status": "ready",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "job search",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 06

Input:

```text
stem opt i983 final evaluation（现在开始搞这样加快随时入职）
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Prepare STEM OPT I-983 final evaluation",
      "description": "Start preparing the STEM OPT I-983 final evaluation so the process is ready and does not delay potential new employment.",
      "status": "ready",
      "confidence": 0.93,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/immigration",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 07

Input:

```text
给 gjl 的朋友发邮件
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Email GJL's friend",
      "description": "Send an email to the friend introduced by GJL.",
      "status": "ready",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "communication/job search",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 08

Input:

```text
google内推投递
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Apply to Google through referral",
      "description": "Complete the Google referral application process.",
      "status": "ready",
      "confidence": 0.91,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "job search",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 09

Input:

```text
severance可以谈，说自己需要financial aid，开个case就行
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Open a case to negotiate severance support",
      "description": "Open a case and explain the need for financial aid or additional separation support.",
      "status": "ready",
      "confidence": 0.88,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/layoff",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 10

Input:

```text
提升工程能力 这是一个基本功
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Improve engineering ability as a core skill",
      "description": "Develop a plan or direction for improving engineering ability as a foundational capability.",
      "status": "open",
      "confidence": 0.78,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "learning/career",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 11

Input:

```text
成长也是有窗口的，抓住它，而不是焦虑求职窗口
```

Output:

```json
{
  "suggestions": [
    {
      "type": "reference",
      "title": "Growth also has a window",
      "description": "Reminder that growth opportunities also have timing; focus on catching the growth window rather than only being anxious about the job-search window.",
      "status": "saved",
      "confidence": 0.86,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "reflection",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 12

Input:

```text
面试是机会，但 chatbot 是资产
```

Output:

```json
{
  "suggestions": [
    {
      "type": "reference",
      "title": "Interview is an opportunity, but chatbot is an asset",
      "description": "Reflection that interviews are opportunities, while building a chatbot/project can become a reusable long-term asset.",
      "status": "saved",
      "confidence": 0.84,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "reflection/project strategy",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 13

Input:

```text
能力里程碑是长期可复利的财富
```

Output:

```json
{
  "suggestions": [
    {
      "type": "reference",
      "title": "Capability milestones compound over time",
      "description": "Reflection that capability milestones are long-term compounding assets.",
      "status": "saved",
      "confidence": 0.85,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "reflection/learning",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 14

Input:

```text
llm can do formatted generation at token level. What’s the implication on tabular generation?
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Explore implications of token-level formatted generation for tabular generation",
      "description": "Think through what LLM formatted generation at the token level implies for tabular data generation.",
      "status": "open",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "research/LLM",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 15

Input:

```text
Can langevin dynamics contextualized generation be applied to LLM/tranformer as generator?
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Explore whether Langevin dynamics contextualized generation can apply to LLMs or Transformers",
      "description": "Investigate whether ideas from Langevin dynamics and contextualized generation can be applied when using an LLM/Transformer as the generator.",
      "status": "open",
      "confidence": 0.89,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "research/LLM",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 16

Input:

```text
XP design for chatbot eval：optimizing API call points. Messy eval with no ground truth — only human roughly knows
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Design chatbot eval experiments for optimizing API call points",
      "description": "Explore how to evaluate chatbot workflows when the task is messy, has no clear ground truth, and humans only roughly know what good behavior looks like.",
      "status": "open",
      "confidence": 0.87,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "project/eval",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 17

Input:

```text
Difficult evals — training bot, customer success bot (sequential answers with right direction matters). Sales bot eval (hard to design problem set and no gt)
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Explore difficult eval design for training, customer success, and sales bots",
      "description": "Investigate how to evaluate bots where sequential answer direction matters and where problem sets or ground truth are hard to define.",
      "status": "open",
      "confidence": 0.89,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "project/eval",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 18

Input:

```text
Yellow banana problem
```

Output:

```json
{
  "suggestions": [
    {
      "type": "clarify_needed",
      "title": "Clarify the Yellow banana problem",
      "description": "The memo appears to refer to a concept or shorthand, but there is not enough context to determine whether it is a task, exploration, idea, or reference.",
      "status": "needs_clarification",
      "confidence": 0.55,
      "needs_clarification": true,
      "clarification_question": "What does the Yellow banana problem refer to, and do you want to save it, explore it, or turn it into an action?",
      "missing_context": [
        "Meaning of 'Yellow banana problem'",
        "Whether this is a concept, task, project idea, or reference"
      ],
      "suggested_fields": {
        "category": null,
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 19

Input:

```text
Dissertation chatbot
```

Output:

```json
{
  "suggestions": [
    {
      "type": "idea",
      "title": "Build a dissertation chatbot",
      "description": "Possible idea to create a chatbot based on dissertation content.",
      "status": "saved",
      "confidence": 0.72,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "project/research",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 20

Input:

```text
BI toolkit for microbiome data analytics 
```

Output:

```json
{
  "suggestions": [
    {
      "type": "idea",
      "title": "Build a BI toolkit for microbiome data analytics",
      "description": "Possible project idea for a business-intelligence-style toolkit focused on microbiome data analytics.",
      "status": "saved",
      "confidence": 0.78,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "project/research",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 21

Input:

```text
What’s the hierarchical modeling of LLM? How to do mixed effects/longitudinal generation? How to have covariance structure? (E.g., training, stories). 
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Explore hierarchical, mixed-effects, and longitudinal modeling ideas for LLM generation",
      "description": "Investigate how concepts like hierarchical modeling, mixed effects, longitudinal generation, and covariance structure might apply to LLM-generated data such as training trajectories or stories.",
      "status": "open",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "research/LLM",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 22

Input:

```text
Reach out to Fragomen to get H1b filed
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Reach out to Fragomen about filing H-1B",
      "description": "Contact Fragomen to ask about getting the H-1B petition filed.",
      "status": "ready",
      "confidence": 0.92,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/immigration",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": "Fragomen"
      }
    }
  ]
}
```

---

### Example 23

Input:

```text
sign the compensation (double check calculation!) 
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Review compensation calculation before signing",
      "description": "Double-check the compensation calculation before signing the agreement.",
      "status": "ready",
      "confidence": 0.92,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/layoff",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 24

Input:

```text
Update end date and report change (SEVIS?) when effective
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Update employment end date and report change when effective",
      "description": "When the employment end date becomes effective, update the end date and confirm whether the change needs to be reported in SEVIS.",
      "status": "ready",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/immigration",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 25

Input:

```text
portfolio website
```

Output:

```json
{
  "suggestions": [
    {
      "type": "idea",
      "title": "Create a portfolio website",
      "description": "Possible project or career asset: build a portfolio website.",
      "status": "saved",
      "confidence": 0.72,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "career/project",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 26

Input:

```text
Meta internal post (qqd, fig.lu)
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Save or review Meta internal posts by qqd and fig.lu",
      "description": "Find, save, or review the relevant Meta internal posts associated with qqd and fig.lu.",
      "status": "ready",
      "confidence": 0.72,
      "needs_clarification": true,
      "clarification_question": "Do you want to read these posts, save links to them, post some, or use them for a specific application/interview purpose?",
      "missing_context": [
        "What action should be taken with the Meta internal posts",
        "What qqd and fig.lu refer to"
      ],
      "suggested_fields": {
        "category": "reference/career",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 27

Input:

```text
https://www.metacareers.com/alumni_portal/resources
```

Output:

```json
{
  "suggestions": [
    {
      "type": "reference",
      "title": "Meta alumni portal resources",
      "description": "Save the Meta alumni portal resources link for future reference.",
      "status": "saved",
      "confidence": 0.86,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "career/resource",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null,
        "url": "https://www.metacareers.com/alumni_portal/resources"
      }
    }
  ]
}
```

---

### Example 28

Input:

```text
internal transfer (eligible) 
```

Output:

```json
{
  "suggestions": [
    {
      "type": "exploration",
      "title": "Check internal transfer eligibility",
      "description": "Explore whether internal transfer is possible or useful given eligibility.",
      "status": "open",
      "confidence": 0.75,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "job search/internal mobility",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 29

Input:

```text
I-983 final evaluation + 12mon eval i983
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Confirm and prepare I-983 final evaluation and 12-month evaluation",
      "description": "Handle the I-983 final evaluation and determine whether the 12-month I-983 evaluation is also needed.",
      "status": "ready",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/immigration",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 30

Input:

```text
FRAGOMEN portal login and download files
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Log into Fragomen portal and download files",
      "description": "Access the Fragomen portal and download relevant immigration files.",
      "status": "ready",
      "confidence": 0.94,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/immigration",
        "follow_up_needed": false,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 31

Input:

```text
sevp STEM OPT data validation report
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Complete SEVP STEM OPT data validation report",
      "description": "Review or complete the SEVP STEM OPT data validation report.",
      "status": "ready",
      "confidence": 0.86,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "admin/immigration",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

### Example 32

Input:

```text
google投递
```

Output:

```json
{
  "suggestions": [
    {
      "type": "task",
      "title": "Submit Google application",
      "description": "Apply to Google.",
      "status": "ready",
      "confidence": 0.9,
      "needs_clarification": false,
      "suggested_fields": {
        "category": "job search",
        "follow_up_needed": true,
        "due_date": null,
        "waiting_on": null
      }
    }
  ]
}
```

---

## Current Required Regression Examples

These examples reflect the current v0 classification policy. They should take
precedence over any older examples that accidentally promoted bare phrases into
tasks.

### Bare project phrase -> idea

Input:

```text
portfolio website
```

Expected:

```text
type: idea
status: saved
```

### Bare project phrase -> idea

Input:

```text
Dissertation chatbot
```

Expected:

```text
type: idea
status: saved
```

### Unclear shorthand -> clarify_needed

Input:

```text
Yellow banana problem
```

Expected:

```text
type: clarify_needed
status: needs_clarification
needs_clarification: true
clarification_question: present
missing_context: present
```

### Link -> reference

Input:

```text
https://www.metacareers.com/alumni_portal/resources
```

Expected:

```text
type: reference
status: saved
suggested_fields.url: https://www.metacareers.com/alumni_portal/resources
```

### Question / decision -> exploration

Input:

```text
should I build this as webapp or iOS first?
```

Expected:

```text
type: exploration
status: open
```

### Multi-item split

Input:

```text
email Duke about final eval. also maybe memo app should support waiting status
```

Expected:

```text
1. task, ready
2. idea, saved
```
