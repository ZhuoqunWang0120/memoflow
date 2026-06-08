- prefix caching for the common prompt (e.g. for dumptosuggestions which includes long examples). 
- use llm to review the proj after completion, to find the unknown potential optimizations. 

- some examples differentiating this product from a typical todo list:
  - a suddenly poped up idea to jot down
  - saw a linkedin job post, wanted to save as reference and apply later
  - i gotta do this, but not sure how, so it's not a well defined task yet, but i need to log it now
  - heard a terminology, need to look up later 
  - saw an email notification, need to check later
  - it's done, but i need to keep the record
  - here's the meeting link lemme add to memo

- guardrails:
  - LLM cost rate limit
  - prevent hacking (注入攻击)
  - other risks and common guardrails? ask ChatGPT


- cost: 
  - get a sense of $ cost of 100 memo (run a test)
  - maybe limit users to 10 dumps per day?