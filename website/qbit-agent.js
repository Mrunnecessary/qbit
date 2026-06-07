/*
  QBIT AI AGENT — Floating Chat Bubble
  =====================================
  Add this to EVERY HTML page just before </body>:

  <script src="qbit-agent.js"></script>

  That's it. The agent appears on every page automatically.
  It reads the user's Qbit profile from sessionStorage if available.
*/

(function(){
'use strict';

const AGENT_API = "https://script.google.com/macros/s/AKfycbyBFqMP07yUlPOCYTefNOVCxxsK9fEtq07KO0FtujIVKc-etKOj456O-4Ll3bPNl86F/exec";

// Read user profile from session
const userProfile = {
  name:   sessionStorage.getItem('qbit_name')   || "",
  score:  sessionStorage.getItem('qbit_score')  || "",
  role:   sessionStorage.getItem('qbit_role')   || "",
  skills: sessionStorage.getItem('qbit_skills') || "",
  email:  sessionStorage.getItem('qbit_email')  || "",
};

// Conversation history
let chatHistory = [];
let isOpen      = false;
let isThinking  = false;

// Suggested questions by page
const PAGE_SUGGESTIONS = {
  'dashboard': [
    "Which skill should I learn first?",
    "Am I ready to apply for jobs?",
    "How to improve my score fast?",
    "Help me debug a code error",
  ],
  'jobs': [
    "Should I apply for this job?",
    "How to negotiate salary?",
    "Which city is best for my role?",
    "How do I write a cover letter?",
  ],
  'interview': [
    "How to answer Tell me about yourself?",
    "What is the STAR method?",
    "How to handle salary questions?",
    "Tips for technical interviews",
  ],
  'portfolio': [
    "How to make my portfolio stand out?",
    "Tips for LinkedIn profile",
    "How to share with recruiters?",
    "What projects should I add?",
  ],
  'default': [
    "Which school board is best for my child?",
    "Debug my code error",
    "How do I switch careers?",
    "First job — what should I do in 30 days?",
  ]
};

function getPageSuggestions(){
  const path = window.location.pathname;
  if(path.includes('dashboard')) return PAGE_SUGGESTIONS.dashboard;
  if(path.includes('jobs'))      return PAGE_SUGGESTIONS.jobs;
  if(path.includes('interview')) return PAGE_SUGGESTIONS.interview;
  if(path.includes('portfolio')) return PAGE_SUGGESTIONS.portfolio;
  return PAGE_SUGGESTIONS.default;
}

// ── INJECT STYLES ──────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
#qbit-agent-btn{
  position:fixed;bottom:24px;right:24px;z-index:9999;
  width:56px;height:56px;border-radius:50%;
  background:linear-gradient(135deg,#2563eb,#7c3aed);
  border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 20px rgba(37,99,235,.4);
  transition:all .2s;font-size:22px;
  animation:qbit-pulse 3s infinite;
}
#qbit-agent-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(37,99,235,.5);}
@keyframes qbit-pulse{0%,100%{box-shadow:0 4px 20px rgba(37,99,235,.4)}50%{box-shadow:0 4px 28px rgba(37,99,235,.6)}}
#qbit-agent-badge{
  position:absolute;top:-3px;right:-3px;
  width:16px;height:16px;background:#22c55e;border-radius:50%;
  border:2px solid #0f172a;
  animation:qbit-blink 2s infinite;
}
@keyframes qbit-blink{0%,100%{opacity:1}50%{opacity:.5}}
#qbit-agent-panel{
  position:fixed;bottom:90px;right:24px;z-index:9998;
  width:370px;max-width:calc(100vw - 32px);
  background:#1e293b;border:1px solid #334155;
  border-radius:16px;
  box-shadow:0 20px 60px rgba(0,0,0,.5);
  display:none;flex-direction:column;
  overflow:hidden;
  animation:qbit-slide-in .25s ease;
  max-height:560px;
}
@keyframes qbit-slide-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
#qbit-agent-header{
  padding:14px 16px;
  background:linear-gradient(135deg,#1e3a8a,#2e1065);
  display:flex;align-items:center;gap:10px;
  border-bottom:1px solid #334155;
  flex-shrink:0;
}
#qbit-agent-avatar{
  width:36px;height:36px;border-radius:50%;
  background:linear-gradient(135deg,#2563eb,#7c3aed);
  display:flex;align-items:center;justify-content:center;
  font-size:16px;flex-shrink:0;
}
#qbit-agent-info{flex:1;}
#qbit-agent-name{font-size:14px;font-weight:700;color:#fff;font-family:Inter,sans-serif;}
#qbit-agent-status{font-size:11px;color:#93c5fd;display:flex;align-items:center;gap:4px;margin-top:1px;}
#qbit-agent-status::before{content:"";width:6px;height:6px;background:#22c55e;border-radius:50%;flex-shrink:0;}
#qbit-agent-close{
  background:transparent;border:none;color:#64748b;
  cursor:pointer;font-size:18px;padding:4px;line-height:1;
  transition:color .2s;
}
#qbit-agent-close:hover{color:#fff;}
#qbit-suggestions{
  padding:10px 12px;border-bottom:1px solid #0f172a;
  display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0;
  background:#0f172a;
}
.qbit-suggestion{
  padding:5px 10px;background:#1e293b;border:1px solid #334155;
  border-radius:20px;font-size:11px;color:#94a3b8;cursor:pointer;
  transition:all .2s;font-family:Inter,sans-serif;white-space:nowrap;
}
.qbit-suggestion:hover{border-color:#3b82f6;color:#60a5fa;}
#qbit-messages{
  flex:1;overflow-y:auto;padding:14px;
  display:flex;flex-direction:column;gap:10px;
  min-height:180px;max-height:320px;
}
#qbit-messages::-webkit-scrollbar{width:4px;}
#qbit-messages::-webkit-scrollbar-track{background:transparent;}
#qbit-messages::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}
.qbit-msg{display:flex;flex-direction:column;gap:3px;max-width:88%;}
.qbit-msg.ai{align-self:flex-start;}
.qbit-msg.user{align-self:flex-end;}
.qbit-msg-label{font-size:10px;color:#475569;font-family:Inter,sans-serif;}
.qbit-msg.user .qbit-msg-label{text-align:right;}
.qbit-msg-bubble{
  padding:9px 12px;border-radius:10px;
  font-size:13px;line-height:1.65;
  font-family:Inter,sans-serif;white-space:pre-wrap;word-wrap:break-word;
}
.qbit-msg.ai .qbit-msg-bubble{
  background:#0f172a;border:1px solid #334155;color:#f1f5f9;
  border-bottom-left-radius:3px;
}
.qbit-msg.user .qbit-msg-bubble{
  background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;
  border-bottom-right-radius:3px;
}
.qbit-typing{display:flex;gap:4px;padding:9px 12px;background:#0f172a;border:1px solid #334155;border-radius:10px;border-bottom-left-radius:3px;width:fit-content;}
.qbit-typing span{width:6px;height:6px;border-radius:50%;background:#475569;animation:qbit-typing .8s infinite;}
.qbit-typing span:nth-child(2){animation-delay:.15s;}
.qbit-typing span:nth-child(3){animation-delay:.3s;}
@keyframes qbit-typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
#qbit-input-row{
  display:flex;gap:8px;padding:10px 12px;
  border-top:1px solid #334155;flex-shrink:0;
  background:#1e293b;
}
#qbit-input{
  flex:1;padding:9px 12px;border-radius:8px;
  border:1.5px solid #334155;background:#0f172a;
  color:#f1f5f9;font-size:13px;font-family:Inter,sans-serif;
  outline:none;transition:border-color .2s;
  resize:none;
}
#qbit-input:focus{border-color:#3b82f6;}
#qbit-input::placeholder{color:#475569;}
#qbit-send{
  padding:9px 14px;background:#2563eb;color:#fff;
  border:none;border-radius:8px;cursor:pointer;
  font-size:13px;font-weight:600;font-family:Inter,sans-serif;
  transition:background .2s;white-space:nowrap;flex-shrink:0;
}
#qbit-send:hover{background:#1d4ed8;}
#qbit-send:disabled{background:#334155;cursor:not-allowed;}
#qbit-agent-footer{
  padding:6px 12px;background:#0f172a;
  font-size:10px;color:#334155;text-align:center;
  font-family:Inter,sans-serif;flex-shrink:0;
}
@media(max-width:420px){
  #qbit-agent-panel{width:calc(100vw - 20px);right:10px;bottom:80px;}
  #qbit-agent-btn{bottom:16px;right:16px;}
}
`;
document.head.appendChild(style);

// ── INJECT HTML ────────────────────────────────────────────────
const btn = document.createElement('button');
btn.id = 'qbit-agent-btn';
btn.title = 'Ask Qbit AI';
btn.innerHTML = '<span id="qbit-agent-badge"></span>🤖';
btn.onclick = toggleAgent;
document.body.appendChild(btn);

const panel = document.createElement('div');
panel.id = 'qbit-agent-panel';
panel.innerHTML = `
  <div id="qbit-agent-header">
    <div id="qbit-agent-avatar">🤖</div>
    <div id="qbit-agent-info">
      <div id="qbit-agent-name">Qbit AI</div>
      <div id="qbit-agent-status">Online · Ready to help</div>
    </div>
    <button id="qbit-agent-close" onclick="document.getElementById('qbit-agent-panel').style.display='none';window._qbitOpen=false;" title="Close">✕</button>
  </div>
  <div id="qbit-suggestions"></div>
  <div id="qbit-messages"></div>
  <div id="qbit-input-row">
    <input id="qbit-input" placeholder="Ask anything — career, jobs, interviews..." autocomplete="off">
    <button id="qbit-send" onclick="sendAgentMessage()">Send</button>
  </div>
  <div id="qbit-agent-footer">Powered by Qbit AI · tryqbit.com</div>
`;
document.body.appendChild(panel);

// ── INIT ───────────────────────────────────────────────────────
window._qbitOpen = false;

// Load suggestions
const suggestions = getPageSuggestions();
const suggestionsEl = document.getElementById('qbit-suggestions');
suggestions.forEach(s => {
  const chip = document.createElement('button');
  chip.className = 'qbit-suggestion';
  chip.textContent = s;
  chip.onclick = () => {
    document.getElementById('qbit-input').value = s;
    sendAgentMessage();
  };
  suggestionsEl.appendChild(chip);
});

// Welcome message
addMessage('ai', getWelcomeMessage());

// Enter key
document.getElementById('qbit-input').addEventListener('keydown', function(e){
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    sendAgentMessage();
  }
});

function getWelcomeMessage(){
  const name = userProfile.name ? ', '+userProfile.name : '';
  const scoreCtx = userProfile.score
    ? ` I can see your career readiness score is ${userProfile.score}% for ${userProfile.role||'your target role'}.`
    : '';
  return `Hi${name}! 👋 I'm Qbit AI — your personal life, career and tech advisor.${scoreCtx}\n\nAsk me anything:\n• Career switching, jobs, salary, interviews\n• Debug code, write scripts, explain tech concepts\n• First job guidance, workplace problems, RCA support\n• School board advice, govt jobs, financial decisions\n\nSpecific questions get specific answers. What's on your mind?`;
}

// ── TOGGLE ─────────────────────────────────────────────────────
function toggleAgent(){
  window._qbitOpen = !window._qbitOpen;
  panel.style.display = window._qbitOpen ? 'flex' : 'none';
  if(window._qbitOpen){
    document.getElementById('qbit-input').focus();
    scrollToBottom();
    // Remove pulse animation once opened
    btn.style.animation = 'none';
    document.getElementById('qbit-agent-badge').style.animation = 'none';
    document.getElementById('qbit-agent-badge').style.background = '#22c55e';
  }
}

// ── ADD MESSAGE ────────────────────────────────────────────────
function addMessage(role, text){
  const msgs = document.getElementById('qbit-messages');
  const div  = document.createElement('div');
  div.className = 'qbit-msg ' + role;
  div.innerHTML = `
    <div class="qbit-msg-label">${role === 'ai' ? 'Qbit AI' : 'You'}</div>
    <div class="qbit-msg-bubble">${escHtml(text)}</div>`;
  msgs.appendChild(div);
  scrollToBottom();
  chatHistory.push({role: role === 'ai' ? 'assistant' : 'user', content: text});
  if(chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
}

function addTyping(){
  const msgs = document.getElementById('qbit-messages');
  const div  = document.createElement('div');
  div.className = 'qbit-msg ai'; div.id = 'qbit-typing-msg';
  div.innerHTML = '<div class="qbit-msg-label">Qbit AI</div><div class="qbit-typing"><span></span><span></span><span></span></div>';
  msgs.appendChild(div);
  scrollToBottom();
}

function removeTyping(){
  const el = document.getElementById('qbit-typing-msg');
  if(el) el.remove();
}

function scrollToBottom(){
  const msgs = document.getElementById('qbit-messages');
  setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 50);
}

// ── SEND MESSAGE ───────────────────────────────────────────────
async function sendAgentMessage(){
  if(isThinking) return;
  const input = document.getElementById('qbit-input');
  const msg   = input.value.trim();
  if(!msg) return;

  input.value = '';
  addMessage('user', msg);
  isThinking = true;
  document.getElementById('qbit-send').disabled = true;
  document.getElementById('qbit-agent-status').textContent = 'Thinking...';
  addTyping();

  // Build context-aware prompt
  const profileCtx = buildProfileContext();
  const historyCtx = chatHistory.slice(-8)
    .map(m => m.role+': '+m.content)
    .join('\n');

  const prompt = `You are Qbit AI — a life and career intelligence assistant for Indian professionals and families. You help people make better decisions about career, money, education, family, government jobs, and real-life problems.

${profileCtx}

You can solve ANY of these:

CAREER & JOBS:
- Career switching, readiness scores, skill gaps
- Job search strategy, JD analysis, salary negotiation
- Resume, LinkedIn, cover letters
- Interview preparation and coaching
- Promotion strategy, handling PIPs, workplace conflicts

EDUCATION & FAMILY:
- Which school board is best for my child in my city (CBSE/ICSE/IB/State)
- Best colleges for specific streams and careers
- Coaching vs school investment decisions
- Career guidance for children based on interests
- Education loans and planning

MONEY & FINANCE:
- Should I take this job offer or stay
- Is an MBA worth it for my situation
- Freelance vs employment — what's better for me
- How to save for child's education in India
- Should I buy a house now or wait
- Getting out of debt while switching careers

GOVERNMENT JOBS:
- Which government job suits my age and qualification
- How to prepare for SSC, UPSC, Banking, PSU exams
- Which state has better opportunities for my role
- Pension vs NPS comparison
- Age limits and eligibility for specific exams

REAL LIFE PROBLEMS:
- My manager is taking credit for my work — what to do
- I have a 3-year gap in my resume — how do I explain
- Should I relocate to another city for this job
- Got a PIP at work — how do I respond
- Work-life balance, burnout, career plateau
- Any life decision that needs structured thinking

TECH SUPPORT FOR NEW JOINERS & PROFESSIONALS:
- Debug any code error — Python, JavaScript, SQL, Java, Shell
- Write small automation scripts on demand (Excel, CSV, file tasks, API calls)
- Explain any tech concept simply — REST API, Git, Docker, microservices, CI/CD
- Help with first 30/60/90 days at a new job — what to do, what to avoid
- Professional communication — emails, Slack messages, escalation templates
- Tool guidance — Git commands, Postman, Linux basics, VS Code tips
- RCA support — production issue, how to debug, how to write incident report
- Interview coding problems — explain approach, write solution, explain complexity
- Office politics — how to handle tough manager, how to speak up in meetings
- Fresher to professional transition — corporate culture, work etiquette

HOW TO RESPOND:
- Be direct, structured, and specific — like a knowledgeable senior friend or mentor
- Use Indian context always: salary in LPA, Indian cities, Indian companies, Indian exams
- For code/tech questions: always show working code with explanation
- For complex decisions: give pros/cons + your clear recommendation
- For school/education: mention specific schools/boards relevant to their city
- For government jobs: mention age limits, exam names, preparation time
- For new joiners: be encouraging, practical, and reassuring
- For RCA/debugging: walk through step by step like a senior colleague
- Never give vague generic advice — always be specific to their situation
- If they paste code or an error — fix it and explain why

Conversation so far:
${historyCtx}

User's latest message: "${msg}"

Solve their problem. If it needs structured analysis — give it. If it needs a direct answer — give that. Always end with one clear actionable next step.`;

  try{
    const res  = await fetch(AGENT_API + "?careerAI=true&data=" + encodeURIComponent(JSON.stringify({
      question: prompt,
      skills:   userProfile.skills ? userProfile.skills.split(',') : [],
      role:     userProfile.role   || "",
      score:    parseInt(userProfile.score) || 0
    })));
    const text = await res.text();
    removeTyping();
    addMessage('ai', text && !text.toLowerCase().includes('unavailable')
      ? text
      : "I'm having trouble connecting right now. Please try again in a moment.");
  }catch(e){
    removeTyping();
    addMessage('ai', "Connection issue. Please check your internet and try again.");
  }

  isThinking = false;
  document.getElementById('qbit-send').disabled = false;
  document.getElementById('qbit-agent-status').textContent = 'Online · Ready to help';
  document.getElementById('qbit-input').focus();
}

function buildProfileContext(){
  if(!userProfile.score && !userProfile.role) {
    return "User has not yet completed their Qbit career analysis.";
  }
  return `User profile from Qbit:
Name: ${userProfile.name || 'Not set'}
Career readiness score: ${userProfile.score || 'Not analysed'}%
Target role: ${userProfile.role || 'Not set'}
Detected skills: ${userProfile.skills || 'Not analysed'}
Email: ${userProfile.email || 'Not set'}`;
}

function escHtml(s){
  return (s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}

// Expose globally so pages can pass profile data
window.QbitAgent = {
  setProfile: function(data){
    Object.assign(userProfile, data);
    if(data.name || data.score){
      // Update welcome message context
      const msgs = document.getElementById('qbit-messages');
      if(msgs && msgs.children.length === 1){
        msgs.innerHTML = '';
        addMessage('ai', getWelcomeMessage());
      }
    }
  },
  open: function(){ if(!window._qbitOpen) toggleAgent(); },
  ask:  function(q){ document.getElementById('qbit-input').value = q; if(!window._qbitOpen) toggleAgent(); }
};

})();
