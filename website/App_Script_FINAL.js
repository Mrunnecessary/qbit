/************************************************
  QBIT CAREER INTELLIGENCE ENGINE
  Backend — Google Apps Script
  Updated: March 2026

  SETUP CHECKLIST:
  1. Replace SHEET_ID with your Google Sheet ID
  2. Replace GEMINI_API_KEY — free key at aistudio.google.com/apikey
  3. Replace RESEND_API_KEY with your Resend key
  4. Create 3 tabs in your Google Sheet:
       "Qbit_User_Intelligence"  — 37 columns (see schema below)
       "Qbit_Users"              — 8 columns
       "Qbit_Referrals"          — 4 columns
  5. Set two time-based triggers in Apps Script:
       Function: runEmailSequence  → Day timer → every 24 hours
       Function: runWeeklyEmail    → Week timer → every Monday 9am

  SHEET SCHEMAS — paste these as row 1 headers:
  ─────────────────────────────────────────────
  Qbit_User_Intelligence (37 cols, A→AK):
  timestamp | session_id | name | email | referral_code |
  referred_by | referral_count | source | device | source_ip |
  country | current_role | experience | current_salary | target_role |
  timeline | resume_uploaded | detected_skills | skill_count | skill_gaps |
  score | recommended_role | percentile | career_path | confidence_score |
  risk_areas | salary_prediction | salary_gap | roadmap_requested |
  score_card_color | share_clicked | analysis_count | target_salary |
  salary_estimate | ai_queries_count | previous_score | returned_user

  Qbit_Users (8 cols, A→H):
  email | first_login | login_count | last_login |
  last_session_id | referred_by | reward_sent | nudge_sent

  Qbit_Referrals (4 cols, A→D):
  referrer_email | referral_count | referred_emails | last_referral_date
  ─────────────────────────────────────────────
************************************************/

/******** CONFIG — FILL THESE IN ********/

const SHEET_ID       = "1IRI9BwRv6--ATFwOlIa-nTjsIHja-zdELf0l6kMIcC8";
const GEMINI_API_KEY = "AIzaSyAKeJzMXjbppTkjQr4L9YBlR3toZHc7ojU";
const RESEND_API_KEY = "re_TFnwddsE_FH5bYq3i1YPk4YJkwY6HUGuZ";
const ADMIN_EMAIL    = "hello@tryqbit.com";
const FROM_EMAIL     = "Qbit <hello@tryqbit.com>";
const SITE_URL       = "https://tryqbit.com";

const DATASET_SHEET  = "Qbit_User_Intelligence";
const USERS_SHEET    = "Qbit_Users";
const REFERRAL_SHEET = "Qbit_Referrals";

/******** ROLE DATABASE ********/

const ROLE_DB = {
  "DevOps Engineer":["docker","kubernetes","linux","cicd","cloud"],
  "Cloud Engineer":["aws","cloud","linux","terraform","network"],
  "Site Reliability Engineer":["linux","monitoring","automation","cloud"],
  "Backend Developer":["api","database","python","node","microservices"],
  "Frontend Developer":["javascript","html","css","react","ui"],
  "Full Stack Developer":["javascript","node","database","api","react"],
  "Data Analyst":["excel","sql","analysis","dashboard","reporting"],
  "Data Scientist":["python","machine learning","statistics","analysis"],
  "Machine Learning Engineer":["python","ml","model","data","deployment"],
  "Business Analyst":["analysis","reporting","documentation","stakeholder"],
  "Product Manager":["roadmap","stakeholder","analysis","product"],
  "Project Manager":["planning","management","communication","delivery"],
  "QA Engineer":["testing","automation","selenium","qa"],
  "Cyber Security Analyst":["security","network","risk","vulnerability"],
  "Network Engineer":["network","routing","switching","linux"],
  "System Administrator":["linux","server","network","maintenance"],
  "Database Administrator":["sql","database","backup","optimization"],
  "Digital Marketing Specialist":["seo","ads","content","analytics"],
  "SEO Specialist":["seo","keywords","content","analytics"],
  "Content Strategist":["content","writing","seo","strategy"],
  "UI UX Designer":["ui","ux","wireframe","design"],
  "Graphic Designer":["design","photoshop","illustrator","branding"],
  "HR Specialist":["recruitment","interview","hr","communication"],
  "Talent Acquisition Specialist":["recruitment","sourcing","interview"],
  "Financial Analyst":["finance","analysis","excel","forecast"],
  "Accountant":["accounting","tax","finance","reporting"],
  "Operations Manager":["operations","management","process","planning"],
  "Supply Chain Analyst":["supply chain","logistics","analysis"],
  "Customer Success Manager":["customer","support","communication","crm"],
  "Sales Manager":["sales","crm","negotiation","communication"]
};

/******** HELPERS ********/

function jsonResponse(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function textResponse(text){
  return ContentService.createTextOutput(text||"").setMimeType(ContentService.MimeType.TEXT);
}
function getSheet(name){
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

/******** SOURCE IP + GEO DETECTION ********/
// Apps Script captures the caller's IP via the request event object.
// We also use ip-api.com (free, no key needed) to resolve country/org.

function getIpInfo(e){
  let ip = "";
  let country = "";
  let org = "";

  // Try to get IP from request headers (available in doGet/doPost event)
  try{
    if(e && e.parameter && e.parameter.client_ip){
      ip = e.parameter.client_ip; // passed from frontend
    }
  }catch(err){}

  // Geo-resolve if we have an IP
  if(ip && ip !== "unknown"){
    try{
      const res  = UrlFetchApp.fetch("http://ip-api.com/json/"+ip+"?fields=country,org", {muteHttpExceptions:true});
      const data = JSON.parse(res.getContentText());
      country = data.country || "";
      org     = data.org     || ""; // e.g. "AS7018 AT&T Services" or "AS15169 Google LLC"
    }catch(err){
      Logger.log("IP geo error: "+err);
    }
  }

  return { ip, country, org };
}

/******** ROUTER ********/

function doGet(e){
  const p = e.parameter;
  if(p.create_session)  return handleCreateSession(p, e);
  if(p.count)           return getUserCount();
  if(p.explain)         return handleExplain(p);
  if(p.careerAI)        return handleCareerAI(p);
  if(p.analyze)         return handleAnalyze(p, e);
  if(p.referral_count)  return getReferralCount(p);
  if(p.history)         return getScoreHistory(p);
  return jsonResponse({status:"Qbit API running"});
}

function doPost(e){
  try{
    let params={};
    try{ params=JSON.parse(e.postData.contents); }catch(ex){ params=e.parameter||{}; }
    if(params.action==="create_session") return handleCreateSession(params, e);
    if(params.action==="roadmap")        return handleRoadmap(params);
    if(params.action==="track_referral") return trackReferral(params);
    return jsonResponse({status:"ok"});
  }catch(err){ return jsonResponse({error:err.toString()}); }
}

/******** SESSION + LOGIN TRACKING ********/

function handleCreateSession(p, e){
  const email      = (p.email||"").toLowerCase().trim();
  const referredBy = (p.referred_by||"").toLowerCase().trim();
  const sessionId  = Utilities.getUuid();

  if(!email) return jsonResponse({session:sessionId, login_count:0, referral_count:0, referral_code:""});

  // Track referral if came via link
  if(referredBy && referredBy !== email) incrementReferralCount(referredBy, email);

  // Login info
  const loginInfo  = getUserLoginInfo(email);
  const loginCount = loginInfo.count;

  // Upsert user record
  upsertUser(email, sessionId, referredBy);

  // Email based on login count
  try{
    if(loginCount === 0)  sendWelcomeEmail(email);
    else                  sendReturningUserEmail(email, loginCount + 1);
  }catch(err){ Logger.log("Email: "+err); }

  // Referral reward (5 referrals = 1 month premium)
  const referralCount  = getUserReferralCount(email);
  const rewardUnlocked = referralCount >= 5 && !loginInfo.reward_sent;
  if(rewardUnlocked){
    try{ sendReferralRewardEmail(email, referralCount); markRewardSent(email); }catch(err){}
  }

  return jsonResponse({
    session:         sessionId,
    login_count:     loginCount,
    referral_count:  referralCount,
    referral_code:   emailToCode(email),
    referral_url:    SITE_URL + "?ref=" + emailToCode(email),
    reward_unlocked: rewardUnlocked
  });
}

/******** USER HELPERS ********/

function getUserLoginInfo(email){
  try{
    const rows = getSheet(USERS_SHEET).getDataRange().getValues();
    for(let i=1;i<rows.length;i++){
      if((rows[i][0]||"").toLowerCase()===email)
        return { count: parseInt(rows[i][2])||0, reward_sent: rows[i][6]===true||rows[i][6]==="TRUE" };
    }
  }catch(e){}
  return {count:0, reward_sent:false};
}

function upsertUser(email, sessionId, referredBy){
  try{
    const sheet = getSheet(USERS_SHEET);
    const rows  = sheet.getDataRange().getValues();
    for(let i=1;i<rows.length;i++){
      if((rows[i][0]||"").toLowerCase()===email){
        sheet.getRange(i+1,3).setValue((parseInt(rows[i][2])||0)+1);
        sheet.getRange(i+1,4).setValue(new Date());
        sheet.getRange(i+1,5).setValue(sessionId);
        return;
      }
    }
    // email | first_login | login_count | last_login | last_session_id | referred_by | reward_sent | nudge_sent
    sheet.appendRow([email, new Date(), 1, new Date(), sessionId, referredBy, false, false]);
  }catch(e){ Logger.log("upsertUser: "+e); }
}

function markRewardSent(email){
  try{
    const sheet = getSheet(USERS_SHEET);
    const rows  = sheet.getDataRange().getValues();
    for(let i=1;i<rows.length;i++){
      if((rows[i][0]||"").toLowerCase()===email){ sheet.getRange(i+1,7).setValue(true); return; }
    }
  }catch(e){}
}

/******** REFERRAL ********/

function emailToCode(email){
  if(!email) return "";
  const base = email.split("@")[0].replace(/[^a-z0-9]/gi,"").substring(0,8).toUpperCase();
  let hash=0;
  for(let c of email) hash=((hash<<5)-hash)+c.charCodeAt(0);
  return "QB"+base+Math.abs(hash%100).toString().padStart(2,"0");
}

function incrementReferralCount(referrerEmail, newUserEmail){
  try{
    const sheet = getSheet(REFERRAL_SHEET);
    const rows  = sheet.getDataRange().getValues();
    for(let i=1;i<rows.length;i++){
      if((rows[i][0]||"").toLowerCase()===referrerEmail){
        sheet.getRange(i+1,2).setValue((parseInt(rows[i][1])||0)+1);
        const existing = rows[i][2]||"";
        sheet.getRange(i+1,3).setValue(existing ? existing+","+newUserEmail : newUserEmail);
        sheet.getRange(i+1,4).setValue(new Date());
        return;
      }
    }
    // referrer_email | referral_count | referred_emails | last_referral_date
    sheet.appendRow([referrerEmail, 1, newUserEmail, new Date()]);
  }catch(e){ Logger.log("incrementReferral: "+e); }
}

function getUserReferralCount(email){
  try{
    const rows = getSheet(REFERRAL_SHEET).getDataRange().getValues();
    for(let i=1;i<rows.length;i++){
      if((rows[i][0]||"").toLowerCase()===email) return parseInt(rows[i][1])||0;
    }
  }catch(e){}
  return 0;
}

function getReferralCount(p){
  const email = (p.email||"").toLowerCase().trim();
  const count = getUserReferralCount(email);
  const code  = emailToCode(email);
  return jsonResponse({count, code, referral_url: SITE_URL+"?ref="+code});
}

function trackReferral(params){
  const code     = (params.code||"").toUpperCase();
  const newEmail = (params.email||"").toLowerCase().trim();
  if(!code||!newEmail) return jsonResponse({status:"invalid"});
  try{
    const rows = getSheet(USERS_SHEET).getDataRange().getValues();
    for(let i=1;i<rows.length;i++){
      const e = (rows[i][0]||"").toLowerCase();
      if(emailToCode(e)===code){ incrementReferralCount(e,newEmail); return jsonResponse({status:"ok"}); }
    }
  }catch(e){}
  return jsonResponse({status:"not_found"});
}

/******** ANALYSIS ********/

function handleAnalyze(p, e){
  try{
    let payload = {};

try{
  payload = JSON.parse(p.data || "{}");
}catch(err){
  Logger.log("Invalid payload JSON");
  payload = {};
}

    // Capture IP from request — frontend passes it as client_ip param
    // Apps Script itself cannot access the caller IP directly from event,
    // but we receive it as a URL param sent from the browser (see dashboard.html)
    const ipInfo = getIpInfo(p);
    payload.source_ip = ipInfo.ip     || payload.source_ip || "";
    payload.country   = ipInfo.country || payload.country  || "";
    payload.org       = ipInfo.org     || "";

    // Check if returning user (has previous score)
    const previousScore = getPreviousScore(payload.email);
    payload.previous_score = previousScore;
    payload.returned_user  = previousScore > 0 ? "yes" : "no";

    const result = analyzeCareer(payload);
    storeDataset(payload, result);
    return jsonResponse(result);
  }catch(err){
    Logger.log("handleAnalyze: "+err);
    return jsonResponse({error:err.toString(), score:30, skills:[], gaps:[], role:"Career Match", careerOptions:[]});
  }
}

function handleExplain(p){
  try{
    const d = JSON.parse(p.data);
    const prompt = `You are a career advisor. A user received a career readiness score.
Target role: ${d.role}
Detected skills: ${(d.skills||[]).join(", ")}
Missing skills: ${(d.gaps||[]).join(", ")}
In 3-4 sentences explain: why they got this score, which 2 missing skills matter most, one concrete step they can take this week.`;
    return textResponse(callGemini(prompt));
  }catch(e){ return textResponse("Unable to generate explanation. Please try again."); }
}

function handleCareerAI(p){
  try{
    const d = JSON.parse(p.data);
    return textResponse(careerAI(d));
  }catch(e){ return textResponse("AI temporarily unavailable. Please try again."); }
}

/******** PREVIOUS SCORE LOOKUP ********/

function getPreviousScore(email){
  if(!email) return 0;
  try{
    const sheet = getSheet(DATASET_SHEET);
    const rows  = sheet.getDataRange().getValues();
    // Scan backwards to find most recent score for this email
    for(let i=rows.length-1; i>=1; i--){
      if((rows[i][3]||"").toLowerCase() === email.toLowerCase()){
        const score = parseInt(rows[i][20]); // column Q = score (index 20, 0-based)
        if(score > 0) return score;
      }
    }
  }catch(e){ Logger.log("getPreviousScore: "+e); }
  return 0;
}

/******** SCORE HISTORY ********/

function getScoreHistory(p){
  try{
    const email = (p.email||"").toLowerCase().trim();
    if(!email) return jsonResponse({rows:[]});
    const sheet = getSheet(DATASET_SHEET);
    const rows  = sheet.getDataRange().getValues();
    const history = [];
    for(let i=1; i<rows.length; i++){
      if((rows[i][3]||"").toLowerCase() === email && rows[i][20]){
        history.push([
          rows[i][20], // score
          new Date(rows[i][0]).toLocaleDateString('en-IN',{day:'numeric',month:'short'})
        ]);
      }
    }
    return jsonResponse({rows: history.slice(-6)}); // last 6 analyses
  }catch(e){ return jsonResponse({rows:[]}); }
}

/******** SKILL EXTRACTION ********/

function extractSkillsAI(text){
  // Guard: don't call Gemini if text is missing or too short to extract skills from
  if(!text || text.trim().length < 15){
    Logger.log("extractSkillsAI: text too short — skipping AI call, using keyword fallback");
    return [];
  }
  try{
    const safeText = text.trim().substring(0, 800);
    const prompt = "Extract professional and technical skills from this work description. "
      + "Return ONLY valid JSON with no markdown, no explanation, no code fences: "
      + '{"skills":["skill1","skill2"]} '
      + "Text: " + safeText;
    const raw     = callGemini(prompt);
    if(!raw || raw.includes("unavailable")) return [];
    const cleaned = raw.replace(/```json|```/g,"").trim();
    // Find the JSON array even if Gemini adds surrounding text
    const start = cleaned.indexOf("{");
    const end   = cleaned.lastIndexOf("}");
    if(start === -1 || end === -1) return [];
    const parsed = JSON.parse(cleaned.substring(start, end+1));
    return Array.isArray(parsed.skills) ? parsed.skills : [];
  }catch(e){
    Logger.log("extractSkillsAI error: "+e.toString());
    return [];
  }
}

function keywordDetection(text){
  return ["excel","sql","python","docker","kubernetes","linux","aws","cloud","terraform",
    "devops","cicd","api","analysis","reporting","dashboard","network","javascript","react",
    "node","database","security","seo","design","communication","management","recruitment",
    "finance","testing","automation","machine learning","statistics","product","crm"
  ].filter(k => text.includes(k));
}

function normalizeSkills(skills){
  const map = {
    "spreadsheet":"excel","pivot":"excel","vlookup":"excel","analytics":"analysis",
    "gcp":"cloud","azure":"cloud","ci/cd":"cicd","jenkins":"cicd",
    "postgres":"database","mysql":"database","mongodb":"database","nodejs":"node",
    "tensorflow":"ml","pytorch":"ml","figma":"wireframe","tableau":"dashboard","power bi":"dashboard"
  };
  return [...new Set(skills.map(s=>{ s=s.toLowerCase().trim(); return map[s]||s; }))].filter(s=>s.length>1);
}

/******** CAREER ANALYSIS ENGINE ********/

function analyzeCareer(payload){
  const text       = (payload.text||"").toLowerCase();
  const targetRole = (payload.targetRole||"").trim();
  let skills = normalizeSkills([...extractSkillsAI(text), ...keywordDetection(text)]);

  if(text.includes("aws")||text.includes("cloud"))        skills.push("aws","cloud","devops","linux");
  if(text.includes("excel")||text.includes("dashboard"))  skills.push("excel","analysis","reporting");
  if(text.includes("design")&&text.includes("ui"))        skills.push("ui","ux","design");
  if(text.includes("marketing")||text.includes("seo"))    skills.push("seo","content","analytics");
  if(text.includes("python")||text.includes("data"))      skills.push("python","analysis","data");
  skills = [...new Set(skills)];

  let roleScores = Object.entries(ROLE_DB).map(([role,required])=>({
    role,
    score: Math.round(required.filter(s=>skills.includes(s)).length / required.length * 100)
  })).sort((a,b)=>b.score-a.score);

  let best = roleScores[0];
  if(targetRole){
    const match = roleScores.find(r=>r.role.toLowerCase().includes(targetRole.toLowerCase()));
    if(match) best = match;
  }

  const required = ROLE_DB[best.role]||[];
  const gaps     = required.filter(s=>!skills.includes(s));

  // Confidence score: how well the work description matches the role
  const confidence = Math.min(100, Math.round(best.score * 0.8 + (skills.length > 5 ? 20 : skills.length * 4)));

  // Risk areas: skills with high market demand that user is missing
  const highDemandSkills = ["python","sql","cloud","api","machine learning","data","security"];
  const riskAreas = gaps.filter(g => highDemandSkills.includes(g));

  return {
    skills:         skills.slice(0,15),
    gaps,
    score:          best.score,
    role:           best.role,
    careerOptions:  roleScores.slice(0,5),
    salary:         salaryEstimate(best.role, payload.salary),
    career_path:    careerGraph(best.role),
    weekly:         weeklyFocus(gaps),
    percentile:     percentileText(best.score),
    confidence:     confidence,
    risk_areas:     riskAreas
  };
}

/******** SALARY / GRAPH / PERCENTILE ********/

function salaryEstimate(role, userSalary){
  const S = {
    "Data Analyst":[6,14],"Data Scientist":[12,25],"Machine Learning Engineer":[15,30],
    "DevOps Engineer":[10,22],"Cloud Engineer":[12,24],"Backend Developer":[8,20],
    "Frontend Developer":[6,16],"Full Stack Developer":[10,22],"Product Manager":[12,28],
    "Business Analyst":[7,16],"Cyber Security Analyst":[10,22],"UI UX Designer":[6,16],
    "Digital Marketing Specialist":[4,12],"Financial Analyst":[7,18],"HR Specialist":[4,10]
  };
  let base = S[role]||[5,14];
  if(userSalary){
    const m = userSalary.match(/\d+/);
    if(m){
      const u = parseInt(m[0]);
      if(u>=15) base=[base[0]+8, base[1]+12];
      else if(u>=10) base=[base[0]+4, base[1]+8];
    }
  }
  return `₹${base[0]}L – ₹${base[1]}L`;
}

function careerGraph(role){
  const g = {
    "Data Analyst":"Data Analyst → Analytics Engineer → Data Scientist → Lead",
    "Data Scientist":"Data Scientist → Senior DS → ML Engineer → AI Lead",
    "DevOps Engineer":"DevOps → Platform Engineer → Cloud Architect → VP Eng",
    "Cloud Engineer":"Cloud Engineer → Cloud Architect → Principal Architect",
    "Backend Developer":"Backend Dev → Senior Engineer → Tech Lead → Eng Manager",
    "Frontend Developer":"Frontend Dev → Senior Frontend → Full Stack → Tech Lead",
    "Full Stack Developer":"Full Stack Dev → Senior → Tech Lead → CTO",
    "Product Manager":"PM → Senior PM → Group PM → Director of Product",
    "Business Analyst":"BA → Senior BA → Product Manager → Strategy Lead",
    "UI UX Designer":"Designer → Senior Designer → Design Lead → Head of Design",
    "Digital Marketing Specialist":"Digital Marketer → Manager → Director → CMO",
    "Financial Analyst":"Financial Analyst → Senior → Finance Manager → CFO",
    "HR Specialist":"HR Specialist → HR Manager → HRBP → CHRO"
  };
  return g[role]||`${role} → Senior ${role} → Lead → Director`;
}

function weeklyFocus(gaps){
  if(!gaps||!gaps.length) return "Build a portfolio project using your strongest skills.";
  return `This week: Start with ${gaps.slice(0,2).join(" and ")}. 30–60 min daily. Build one small project applying what you learn.`;
}

function percentileText(score){
  if(score>=75) return "Ahead of 80% of professionals exploring this transition";
  if(score>=55) return "Ahead of 65% of professionals exploring this transition";
  if(score>=40) return "Ahead of 50% of professionals exploring this transition";
  return "Ahead of 30% of professionals — most successful switchers started here";
}

/******** STORE DATASET — ALL 37 COLUMNS ********/
/*
  Column mapping (A=1, B=2 ... AK=37):
  A  timestamp          B  session_id         C  name
  D  email              E  referral_code       F  referred_by
  G  referral_count     H  source              I  device
  J  source_ip          K  country             L  current_role
  M  experience         N  current_salary      O  target_role
  P  timeline           Q  resume_uploaded     R  detected_skills
  S  skill_count        T  skill_gaps          U  score
  V  recommended_role   W  percentile          X  career_path
  Y  confidence_score   Z  risk_areas          AA salary_prediction
  AB salary_gap         AC roadmap_requested   AD score_card_color
  AE share_clicked      AF analysis_count      AG target_salary
  AH salary_estimate    AI ai_queries_count    AJ previous_score
  AK returned_user
*/

function storeDataset(payload, result){
  try{
    // Calculate salary gap
    const salaryGap = calculateSalaryGap(payload.salary, result.salary);

    // Get analysis count for this user
    const analysisCount = getAnalysisCount(payload.email);

    getSheet(DATASET_SHEET).appendRow([
      new Date(),                                    // A  timestamp
      payload.session_id     || "",                  // B  session_id
      payload.name           || "",                  // C  name
      payload.email          || "",                  // D  email
      payload.referral_code  || "",                  // E  referral_code (code they used)
      payload.referred_by    || "",                  // F  referred_by (who referred them)
      getUserReferralCount(payload.email),            // G  referral_count (how many they've referred)
      payload.source         || "dashboard",          // H  source
      payload.device         || "",                  // I  device
      payload.source_ip      || "",                  // J  source_ip
      payload.country        || "",                  // K  country
      payload.role           || "",                  // L  current_role
      payload.exp            || "",                  // M  experience
      payload.salary         || "",                  // N  current_salary
      payload.targetRole     || "",                  // O  target_role
      payload.timeline       || "",                  // P  timeline
      payload.resume_uploaded|| "no",                // Q  resume_uploaded
      (result.skills||[]).join(", "),                // R  detected_skills
      (result.skills||[]).length,                    // S  skill_count
      (result.gaps||[]).join(", "),                  // T  skill_gaps
      result.score           || "",                  // U  score
      result.role            || "",                  // V  recommended_role
      result.percentile      || "",                  // W  percentile
      result.career_path     || "",                  // X  career_path
      result.confidence      || "",                  // Y  confidence_score
      (result.risk_areas||[]).join(", "),             // Z  risk_areas
      result.salary          || "",                  // AA salary_prediction
      salaryGap,                                     // AB salary_gap
      payload.roadmap_requested || "no",             // AC roadmap_requested
      payload.score_card_color  || "",               // AD score_card_color
      payload.share_clicked     || "no",             // AE share_clicked
      analysisCount + 1,                             // AF analysis_count
      payload.targetSalary   || "",                  // AG target_salary
      result.salary          || "",                  // AH salary_estimate (same as AA, explicit)
      payload.ai_queries     || 0,                   // AI ai_queries_count
      payload.previous_score || 0,                   // AJ previous_score
      payload.returned_user  || "no"                 // AK returned_user
    ]);
  }catch(e){ Logger.log("storeDataset: "+e); }
}

/******** SALARY GAP CALCULATOR ********/

function calculateSalaryGap(currentSalaryStr, predictedSalaryStr){
  try{
    if(!currentSalaryStr || !predictedSalaryStr) return "";
    const curMatch  = currentSalaryStr.match(/(\d+)/);
    const predMatch = predictedSalaryStr.match(/(\d+)/);
    if(!curMatch || !predMatch) return "";
    const cur  = parseInt(curMatch[1]);
    const pred = parseInt(predMatch[1]);
    const gap  = pred - cur;
    return gap >= 0 ? `+₹${gap}L` : `₹${gap}L`;
  }catch(e){ return ""; }
}

/******** ANALYSIS COUNT ********/

function getAnalysisCount(email){
  if(!email) return 0;
  try{
    const sheet = getSheet(DATASET_SHEET);
    const rows  = sheet.getDataRange().getValues();
    let count = 0;
    for(let i=1; i<rows.length; i++){
      if((rows[i][3]||"").toLowerCase() === email.toLowerCase()) count++;
    }
    return count;
  }catch(e){ return 0; }
}

/******** USER COUNT ********/

function getUserCount(){
  try{
    const sheet = getSheet(DATASET_SHEET);
    let count = Math.max(sheet.getLastRow()-1, 0);
    if(count < 650) count = 650;
    return jsonResponse({count});
  }catch(e){ return jsonResponse({count:650}); }
}

/******** ROADMAP ********/

function handleRoadmap(params){
  const {name, email, role, skills, score} = params;
  const prompt = `Create a 90-day career roadmap.
User: ${name}, Target: ${role}, Score: ${score}%, Skills: ${skills}
Include: week-by-week plan (months 1/2/3), 2-3 portfolio projects, top 3 certifications, interview prep checklist. Be specific.`;
  const roadmap = callGemini(prompt);

  try{ MailApp.sendEmail(ADMIN_EMAIL, `Qbit Roadmap — ${name} (${role})`, `${name}\n${email}\n${role}\n${score}%\n\n${roadmap}`); }catch(e){}
  if(email){
    try{ sendViaResend({from:FROM_EMAIL, to:email, subject:`Your 90-day ${role} roadmap from Qbit`, html:roadmapEmailHTML(name,role,roadmap)}); }catch(e){}
  }
  // Log roadmap request row (minimal — main data already stored in analysis row)
  try{
    getSheet(DATASET_SHEET).appendRow([
      new Date(),"",name,email,"","",0,"roadmap_request","","","",
      "","","",role,"","no","","",""
      ,"","","","","","","","","yes","","",1,"","","",0,0,"no"
    ]);
  }catch(e){}
  return jsonResponse({status:"ok"});
}

/******** CAREER AI ********/

function careerAI(payload){
  // Guard: don't call Gemini if question is missing
  const question = (payload.question || "").trim();
  if(!question){
    Logger.log("careerAI: empty question received");
    return "Please enter a question and try again.";
  }
  const prompt = "You are Qbit AI — a direct, practical career mentor. "
    + "User: role=" + (payload.role||"unknown")
    + ", score=" + (payload.score||0) + "%, "
    + "skills=" + ((payload.skills||[]).join(",") || "not specified") + ". "
    + "Question: " + question + ". "
    + "Answer in 3-5 sentences. Be specific and encouraging. End with one concrete step they can take today.";
  return callGemini(prompt);
}

/******** GEMINI ********/

function callGemini(prompt){
  // Guard: reject empty/undefined prompt — Gemini returns INVALID_ARGUMENT otherwise
  if(!prompt || typeof prompt !== "string" || prompt.trim().length < 5){
    Logger.log("callGemini: empty or invalid prompt — skipping API call");
    return "AI temporarily unavailable. Please try again.";
  }
  try{
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key="+GEMINI_API_KEY;
    const res  = UrlFetchApp.fetch(url,{
      method:"post", contentType:"application/json", muteHttpExceptions:true,
      payload:JSON.stringify({
        contents:[{ parts:[{ text: prompt.trim() }] }],
        generationConfig:{ temperature:0.7, maxOutputTokens:800 }
      })
    });
    const data = JSON.parse(res.getContentText());
    if(data.error){ Logger.log("Gemini API error: "+JSON.stringify(data.error)); return "AI temporarily unavailable."; }
    if(data.candidates && data.candidates.length > 0){
      const part = data.candidates[0].content.parts[0];
      return (part && part.text) ? part.text : "AI returned empty response.";
    }
    return "AI temporarily unavailable. Please try again.";
  }catch(e){ Logger.log("callGemini exception: "+e.toString()); return "AI temporarily unavailable."; }
}

/******** EMAILS ********/

function sendWelcomeEmail(email){
  sendViaResend({
    from:FROM_EMAIL, to:email,
    subject:"Welcome to Qbit — your career score is ready 🚀",
    html:`<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(90deg,#2563eb,#7c3aed);padding:28px 24px;border-radius:10px 10px 0 0">
  <h2 style="color:#fff;margin:0">Welcome to Qbit 👋</h2>
  <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Career Intelligence Engine</p>
</div>
<div style="background:#f8fafc;padding:28px 24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none">
  <p>You're about to discover hidden skills and find out exactly how ready you are for your next career move.</p>
  <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px;border-radius:0 6px 6px 0;margin:16px 0;font-size:14px">
    <b>What Qbit does:</b>
    <ul style="margin:8px 0 0;padding-left:18px;line-height:2;color:#334155">
      <li>Detects transferable skills from your daily work</li>
      <li>Calculates readiness score for 30 career roles</li>
      <li>Identifies exact skill gaps holding you back</li>
      <li>Gives you a week-by-week growth roadmap</li>
    </ul>
  </div>
  <p style="text-align:center;margin:24px 0">
    <a href="${SITE_URL}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Check My Career Score →</a>
  </p>
  <p style="font-size:13px;color:#64748b;text-align:center">Reply to this email with any questions — we read every one.</p>
</div></div>`
  });
}

function sendReturningUserEmail(email, loginCount){
  const templates = [
    { subject:"Your career score just got smarter 📊",
      body:`<p>Hi there,</p><p>Every time you use Qbit, your career intelligence sharpens. Come back and run a fresh analysis — your score improves as you learn new skills.</p>
<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px;border-radius:0 6px 6px 0;margin:16px 0;font-size:14px">
  <b>New: Score Comparison</b> — See how you rank against professionals exploring the same role.
</div>`},
    { subject:"Have you tried the 90-day roadmap? 🗺️",
      body:`<p>Hi there,</p><p>After your career score, the next step is a personalized 90-day roadmap — projects, certifications, interview prep. Log in and click <b>Generate My Roadmap</b>.</p>`},
    { subject:"Refer 5 friends → get 1 month Premium free 🎁",
      body:`<p>Hi there,</p><p>Qbit's referral program is live:</p>
<div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px;border-radius:0 6px 6px 0;margin:16px 0;font-size:14px">
  <b>Refer 5 professionals → 1 month of Qbit Premium, free.</b><br>
  <span style="color:#15803d;font-size:13px">Your referral link is on your dashboard.</span>
</div>`},
    { subject:"Most professionals improve 20% in 30 days 📈",
      body:`<p>Hi there,</p><p>Professionals who return weekly improve their readiness score by <b>20% in 30 days</b> — just by focusing on 2–3 targeted skills at a time.</p><p>Log in, recheck your score, and see how far you've come.</p>`}
  ];
  const tmpl = templates[Math.min(loginCount-2, templates.length-1)];
  sendViaResend({
    from:FROM_EMAIL, to:email, subject:tmpl.subject,
    html:`<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(90deg,#2563eb,#7c3aed);padding:20px 24px;border-radius:10px 10px 0 0">
  <h3 style="color:#fff;margin:0">Qbit Career Intelligence</h3>
</div>
<div style="background:#f8fafc;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;font-size:15px;line-height:1.7">
  ${tmpl.body}
  <p style="text-align:center;margin:24px 0">
    <a href="${SITE_URL}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open Qbit →</a>
  </p>
  <p style="font-size:12px;color:#94a3b8;text-align:center">Qbit — tryqbit.com</p>
</div></div>`
  });
}

function sendReferralRewardEmail(email, count){
  sendViaResend({
    from:FROM_EMAIL, to:email,
    subject:"🎁 You've unlocked Qbit Premium — 1 month free!",
    html:`<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(90deg,#f59e0b,#d97706);padding:24px;border-radius:10px 10px 0 0;text-align:center">
  <h2 style="color:#fff;margin:0">🎉 Referral Reward Unlocked!</h2>
</div>
<div style="background:#fffbeb;padding:24px;border-radius:0 0 10px 10px;border:1px solid #fde68a;border-top:none">
  <p>You've referred <b>${count} professionals</b> to Qbit — incredible!</p>
  <p>You've unlocked <b>1 month of Qbit Premium, free.</b></p>
  <div style="background:#fff;border:1px solid #fde68a;padding:16px;border-radius:8px;margin:16px 0;font-size:14px">
    <b>Premium includes:</b>
    <ul style="line-height:2;color:#334155;margin:8px 0 0;padding-left:18px">
      <li>Detailed PDF career score reports</li>
      <li>Salary gap analysis & negotiation tips</li>
      <li>Weekly career progress tracking</li>
      <li>Priority AI mentor responses</li>
      <li>Recruiter profile visibility (coming soon)</li>
    </ul>
  </div>
  <p>We'll activate your account within 24 hours. Reply to confirm.</p>
  <p style="font-size:13px;color:#92400e">Every 5 referrals = 1 more free month. Keep sharing!</p>
</div></div>`
  });
}

function roadmapEmailHTML(name, role, roadmap){
  return `<div style="font-family:sans-serif;max-width:580px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(90deg,#2563eb,#7c3aed);padding:24px;border-radius:10px 10px 0 0">
  <h2 style="color:#fff;margin:0">Your 90-Day ${role} Roadmap</h2>
</div>
<div style="background:#f8fafc;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none">
  <p>Hi ${name},</p>
  <p>Here's your personalized roadmap to become a <b>${role}</b>:</p>
  <div style="background:#fff;border:1px solid #e2e8f0;padding:18px;border-radius:8px;font-size:14px;line-height:1.8;white-space:pre-wrap">${roadmap}</div>
  <p style="text-align:center;margin-top:20px">
    <a href="${SITE_URL}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Recheck My Score →</a>
  </p>
</div></div>`;
}

/******** RESEND ********/

function sendViaResend(payload){
  try{
    UrlFetchApp.fetch("https://api.resend.com/emails",{
      method:"post", contentType:"application/json", muteHttpExceptions:true,
      headers:{Authorization:"Bearer "+RESEND_API_KEY},
      payload:JSON.stringify(payload)
    });
  }catch(e){ Logger.log("sendViaResend: "+e); }
}

/******** DAILY TRIGGER — nudge one-time users (set: every 24 hours) ********/

function runEmailSequence(){
  try{
    const sheet = getSheet(USERS_SHEET);
    const rows  = sheet.getDataRange().getValues();
    const now   = new Date();
    for(let i=1; i<rows.length; i++){
      const email      = rows[i][0];
      const firstLogin = new Date(rows[i][1]);
      const loginCount = parseInt(rows[i][2])||0;
      const nudgeSent  = rows[i][7];
      const diffDays   = (now - firstLogin) / (1000*60*60*24);
      if(!email || nudgeSent || loginCount > 1 || diffDays < 3) continue;
      sendViaResend({
        from:FROM_EMAIL, to:email,
        subject:"Your career score is still waiting ⏳",
        html:`<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(90deg,#2563eb,#7c3aed);padding:20px 24px;border-radius:10px 10px 0 0">
  <h3 style="color:#fff;margin:0">Don't leave your career score on the table</h3>
</div>
<div style="background:#f8fafc;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;font-size:15px;line-height:1.7">
  <p>You started something. Professionals who complete their Qbit analysis make smarter career decisions.</p>
  <p>Takes 30 seconds. No resume needed.</p>
  <p style="text-align:center;margin:24px 0">
    <a href="${SITE_URL}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">Get My Career Score →</a>
  </p>
</div></div>`
      });
      sheet.getRange(i+1, 8).setValue(true); // mark nudge sent
    }
  }catch(e){ Logger.log("runEmailSequence: "+e); }
}

/******** WEEKLY EMAIL (set: every Monday 9am IST) ********/

function runWeeklyEmail(){
  try{
    const usersSheet   = getSheet(USERS_SHEET);
    const datasetSheet = getSheet(DATASET_SHEET);
    const userRows     = usersSheet.getDataRange().getValues();
    const dataRows     = datasetSheet.getDataRange().getValues();

    for(let i=1; i<userRows.length; i++){
      const email      = userRows[i][0];
      const loginCount = parseInt(userRows[i][2])||0;
      if(!email || loginCount < 1) continue;

      // Find last score for this user
      let lastScore = 0, lastRole = "", lastDate = "";
      for(let j=dataRows.length-1; j>=1; j--){
        if((dataRows[j][3]||"").toLowerCase() === email){
          lastScore = parseInt(dataRows[j][20])||0; // col U = score
          lastRole  = dataRows[j][21]||"";          // col V = recommended_role
          lastDate  = new Date(dataRows[j][0]).toLocaleDateString('en-IN');
          break;
        }
      }
      if(!lastScore) continue;

      sendViaResend({
        from:FROM_EMAIL, to:email,
        subject:"Your weekly career check-in 📊",
        html:`<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(90deg,#2563eb,#7c3aed);padding:20px 24px;border-radius:10px 10px 0 0">
  <h3 style="color:#fff;margin:0">Your weekly career update</h3>
</div>
<div style="background:#f8fafc;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;font-size:15px;line-height:1.7">
  <p>Your last score: <b style="color:#2563eb">${lastScore}%</b> for <b>${lastRole}</b> (${lastDate})</p>
  <p>Recheck your score this week to track your progress.</p>
  <p style="font-size:14px;color:#64748b">Tip: Focus on one skill gap at a time. Mastery beats breadth for career switchers.</p>
  <p style="text-align:center;margin:24px 0">
    <a href="${SITE_URL}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Recheck My Score →</a>
  </p>
</div></div>`
      });
    }
  }catch(e){ Logger.log("runWeeklyEmail: "+e); }
}

// Paste this at the bottom of your script temporarily, run it, then delete it

function testGemini(){
  const result = callGemini("Say hello in one sentence.");
  Logger.log(result);
}

function testExtract(){
  const result = extractSkillsAI("I create Excel dashboards and manage KPI reporting for senior management.");
  Logger.log(JSON.stringify(result));
}

function testAnalyze(){
  const payload = {
    text: "I create Excel dashboards, manage KPI reporting, and analyze data for management.",
    targetRole: "Data Analyst",
    name: "Test User",
    email: "test@test.com",
    session_id: "test-123",
    salary: "5L - 10L",
    exp: "3"
  };
  const result = analyzeCareer(payload);
  Logger.log(JSON.stringify(result));
}

function testSession(){
  const result = handleCreateSession({
    email: "test@test.com",
    referred_by: ""
  }, {});
  Logger.log(JSON.stringify(result));
}


/******** ═══════════════════════════════════════════════════════
  AUTOMATION EMAIL SYSTEM
  Run these manually from Apps Script editor OR set as triggers.
  
  MANUAL TRIGGERS (run from editor anytime):
  → sendFeatureAnnouncement()   — announce new features to all users
  → sendReferralSummary()       — email each user their referral count + link
  → sendRewardCheck()           — check who hit 5 referrals, send reward
  → sendReEngagement()          — email users inactive for 14+ days
  → sendWeeklyLeaderboard()     — top referrers this week
  → sendPremiumOffer()          — special offer to high-score free users
  
  SHEET TRIGGERS (set in Apps Script → Triggers):
  → runEmailSequence            — Day timer → every 24 hours
  → runWeeklyEmail              → Week timer → Monday 9am IST
  → runReferralRewardCheck      → Hour timer → every 6 hours
  → runReEngagement             → Week timer → Wednesday 9am IST
════════════════════════════════════════════════════════════════*/

/******** 1. FEATURE ANNOUNCEMENT — run manually when you ship ********/
// Edit the feature details below, then click Run in Apps Script editor
function sendFeatureAnnouncement(){
  // ── EDIT THESE BEFORE RUNNING ──────────────────────────────
  const FEATURE_TITLE   = "🆕 Mock Interview is now live on Qbit!";
  const FEATURE_SUBJECT = "New on Qbit: AI Mock Interview — Practice for free";
  const FEATURE_BODY    = `
    <p>Hi there,</p>
    <p>We just launched something we're really excited about: <b>AI Mock Interview</b> on Qbit.</p>
    <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px;border-radius:0 8px 8px 0;margin:16px 0;font-size:14px;">
      <b>What's new:</b>
      <ul style="margin:8px 0 0;padding-left:18px;line-height:2;color:#334155">
        <li>4 interview modes — Quick, Full, HR Round, Technical</li>
        <li>AI-generated questions specific to your target role</li>
        <li>Instant feedback on every answer with model answers</li>
        <li>Full session score + question-by-question breakdown</li>
      </ul>
    </div>
    <p>It's completely free. Start practicing in 30 seconds — no sign up needed.</p>`;
  const FEATURE_CTA_URL  = SITE_URL+"/interview.html";
  const FEATURE_CTA_TEXT = "Try Mock Interview →";
  const TARGET_SEGMENT   = "all"; // "all" | "premium" | "free" | "inactive"
  // ── END EDIT ───────────────────────────────────────────────

  const users = getUsersForSegment(TARGET_SEGMENT);
  let sent = 0, failed = 0;

  users.forEach(email => {
    try{
      sendViaResend({
        from: FROM_EMAIL, to: email,
        subject: FEATURE_SUBJECT,
        html: buildEmailHTML(FEATURE_TITLE, FEATURE_BODY, FEATURE_CTA_URL, FEATURE_CTA_TEXT)
      });
      sent++;
      Utilities.sleep(200); // avoid rate limit
    }catch(e){ failed++; Logger.log("Feature email failed for "+email+": "+e); }
  });

  Logger.log("Feature announcement sent: "+sent+" success, "+failed+" failed, "+users.length+" total");
  logCampaign("feature_announcement", FEATURE_SUBJECT, sent, failed);
}

/******** 2. REFERRAL SUMMARY — sends each user their personal referral status ********/
function sendReferralSummary(){
  try{
    const userRows = getSheet(USERS_SHEET).getDataRange().getValues();
    const refRows  = getSheet(REFERRAL_SHEET).getDataRange().getValues();
    let sent = 0;

    // Build referral lookup map
    const refMap = {};
    for(let i=1;i<refRows.length;i++){
      refMap[(refRows[i][0]||"").toLowerCase()] = {
        count: parseInt(refRows[i][1])||0,
        emails: refRows[i][2]||""
      };
    }

    for(let i=1;i<userRows.length;i++){
      const email     = (userRows[i][0]||"").toLowerCase();
      const loginCount = parseInt(userRows[i][2])||0;
      if(!email || loginCount < 1) continue;

      const ref       = refMap[email] || {count:0, emails:""};
      const count     = ref.count;
      const code      = emailToCode(email);
      const refUrl    = SITE_URL+"?ref="+code;
      const toNext    = count>=5 ? Math.ceil(count/5)*5 - count : 5 - count;
      const nextReward= count>=5 ? "next free month" : "first free month";
      const bars      = "█".repeat(Math.min(count,5)) + "░".repeat(Math.max(0,5-count));

      sendViaResend({
        from: FROM_EMAIL, to: email,
        subject: `Your Qbit referral score: ${count}/5 🎁`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(90deg,#2563eb,#7c3aed);padding:20px 24px;border-radius:10px 10px 0 0">
  <h3 style="color:#fff;margin:0">Your referral dashboard</h3>
</div>
<div style="background:#f8fafc;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none">
  <div style="text-align:center;margin-bottom:20px">
    <div style="font-size:42px;font-weight:900;color:#2563eb">${count}</div>
    <div style="font-size:14px;color:#64748b">professionals referred so far</div>
    <div style="font-size:18px;letter-spacing:4px;margin:8px 0;color:#334155">${bars}</div>
    <div style="font-size:13px;color:#64748b"><b>${toNext} more</b> to unlock your ${nextReward}</div>
  </div>
  ${count>0?`<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#166534">
    🎉 You've already referred <b>${count} professional${count>1?'s':''}</b>. Amazing!
  </div>`:''}
  <p style="font-size:14px;color:#475569;margin-bottom:12px">Your personal referral link:</p>
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;color:#334155;margin-bottom:16px;word-break:break-all">${refUrl}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;text-align:center;font-size:12px">
    <div style="background:${count>=1?'#dcfce7':'#f1f5f9'};border-radius:6px;padding:10px;color:${count>=1?'#166534':'#94a3b8'}">
      1 referral<br><b>${count>=1?'✅ Unlocked':'🔒 Locked'}</b><br>PDF Report
    </div>
    <div style="background:${count>=3?'#dcfce7':'#f1f5f9'};border-radius:6px;padding:10px;color:${count>=3?'#166534':'#94a3b8'}">
      3 referrals<br><b>${count>=3?'✅ Unlocked':'🔒 Locked'}</b><br>Score History
    </div>
    <div style="background:${count>=5?'#fef9c3':'#f1f5f9'};border-radius:6px;padding:10px;color:${count>=5?'#92400e':'#94a3b8'}">
      5 referrals<br><b>${count>=5?'🎁 Premium!':'🔒 Locked'}</b><br>1 Month Free
    </div>
  </div>
  <p style="text-align:center">
    <a href="${SITE_URL}" style="background:#2563eb;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Open Qbit →</a>
  </p>
</div></div>`
      });
      sent++;
      Utilities.sleep(200);
    }
    Logger.log("Referral summary sent to "+sent+" users");
    logCampaign("referral_summary", "Referral dashboard email", sent, 0);
  }catch(e){ Logger.log("sendReferralSummary error: "+e); }
}

/******** 3. REFERRAL REWARD CHECK — run as trigger every 6 hours ********/
function runReferralRewardCheck(){
  try{
    const userRows = getSheet(USERS_SHEET).getDataRange().getValues();
    const refRows  = getSheet(REFERRAL_SHEET).getDataRange().getValues();

    const refMap = {};
    for(let i=1;i<refRows.length;i++){
      refMap[(refRows[i][0]||"").toLowerCase()] = parseInt(refRows[i][1])||0;
    }

    for(let i=1;i<userRows.length;i++){
      const email      = (userRows[i][0]||"").toLowerCase();
      const rewardSent = userRows[i][6]===true||userRows[i][6]==="TRUE";
      if(!email || rewardSent) continue;

      const count = refMap[email] || 0;
      if(count >= 5){
        try{
          sendReferralRewardEmail(email, count);
          getSheet(USERS_SHEET).getRange(i+1,7).setValue(true);
          Logger.log("Reward sent to: "+email+" ("+count+" referrals)");
        }catch(e){ Logger.log("Reward email failed: "+email+": "+e); }
      }
    }
  }catch(e){ Logger.log("runReferralRewardCheck error: "+e); }
}

/******** 4. RE-ENGAGEMENT — users inactive 14+ days ********/
function runReEngagement(){
  try{
    const sheet = getSheet(USERS_SHEET);
    const rows  = sheet.getDataRange().getValues();
    const now   = new Date();
    let sent = 0;

    for(let i=1;i<rows.length;i++){
      const email      = rows[i][0];
      const lastLogin  = new Date(rows[i][3]);
      const loginCount = parseInt(rows[i][2])||0;
      const reEngaged  = rows[i][8]; // col I — add this column to Qbit_Users
      const diffDays   = (now-lastLogin)/(1000*60*60*24);

      if(!email || reEngaged || loginCount<1 || diffDays<14) continue;

      // Get their last score
      let lastScore=0, lastRole="";
      try{
        const ds = getSheet(DATASET_SHEET).getDataRange().getValues();
        for(let j=ds.length-1;j>=1;j--){
          if((ds[j][3]||"").toLowerCase()===email){
            lastScore=ds[j][20]||0; lastRole=ds[j][21]||""; break;
          }
        }
      }catch(e){}

      sendViaResend({
        from: FROM_EMAIL, to: email,
        subject: "We miss you on Qbit 👋 Your score is waiting",
        html: buildEmailHTML(
          "Your career progress is waiting",
          `<p>Hi there,</p>
          <p>It's been ${Math.floor(diffDays)} days since you last checked your career score on Qbit.</p>
          ${lastScore?`<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:14px;border-radius:0 8px 8px 0;margin:16px 0;font-size:14px;">
            Your last score: <b>${lastScore}%</b> for <b>${lastRole}</b>. Have you learned new skills since then?
          </div>`:''}
          <p>Career transitions take time — but consistent tracking is what gets people there. Come back and check in.</p>
          <p style="font-size:13px;color:#64748b">Also new since you left: <b>AI Mock Interview</b>, <b>Job Search engine</b>, and <b>Location Intelligence</b>.</p>`,
          SITE_URL, "Check My Score Now →"
        )
      });
      sheet.getRange(i+1,9).setValue(true);
      sent++;
      Utilities.sleep(200);
    }
    Logger.log("Re-engagement sent to "+sent+" users");
  }catch(e){ Logger.log("runReEngagement error: "+e); }
}

/******** 5. WEEKLY LEADERBOARD — top 5 referrers this week ********/
function sendWeeklyLeaderboard(){
  try{
    const refRows = getSheet(REFERRAL_SHEET).getDataRange().getValues();
    const now     = new Date();

    // Sort by referral count descending
    const sorted = refRows.slice(1)
      .filter(r=>r[0]&&parseInt(r[1])>0)
      .sort((a,b)=>(parseInt(b[1])||0)-(parseInt(a[1])||0))
      .slice(0,5);

    if(!sorted.length){ Logger.log("No referrers yet"); return; }

    const leaderboardHTML = sorted.map((r,i)=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:${i===0?'#fef9c3':'#f8fafc'};border-radius:8px;margin-bottom:6px;">
        <span style="font-weight:600">${["🥇","🥈","🥉","4️⃣","5️⃣"][i]} ${r[0].split("@")[0]}...</span>
        <span style="font-weight:700;color:#2563eb">${r[1]} referral${r[1]>1?'s':''}</span>
      </div>`).join("");

    // Send to admin only (or to all users as motivation)
    sendViaResend({
      from: FROM_EMAIL, to: ADMIN_EMAIL,
      subject: `Qbit Weekly Referral Leaderboard — w/e ${now.toLocaleDateString('en-IN')}`,
      html: buildEmailHTML(
        "🏆 Weekly Referral Leaderboard",
        `<p>Top referrers this week:</p>${leaderboardHTML}
        <p style="font-size:13px;color:#64748b;margin-top:14px">Total unique referrers: ${refRows.length-1}</p>`,
        SITE_URL, "Open Qbit →"
      )
    });
    Logger.log("Leaderboard sent to admin");
  }catch(e){ Logger.log("sendWeeklyLeaderboard error: "+e); }
}

/******** 6. PREMIUM OFFER — target free users with score 70%+ ********/
function sendPremiumOffer(){
  try{
    const ds    = getSheet(DATASET_SHEET).getDataRange().getValues();
    const users = getSheet(USERS_SHEET).getDataRange().getValues();

    // Find users with score 70+ who have not been offered premium
    const highScorers = new Set();
    for(let i=1;i<ds.length;i++){
      const score = parseInt(ds[i][20])||0;
      const email = (ds[i][3]||"").toLowerCase();
      if(score>=70 && email) highScorers.add(email);
    }

    let sent=0;
    highScorers.forEach(email=>{
      sendViaResend({
        from: FROM_EMAIL, to: email,
        subject: "You scored 70%+ on Qbit — here's something special 🌟",
        html: buildEmailHTML(
          "You're in the top 20% — unlock Premium",
          `<p>Hi there,</p>
          <p>Your career readiness score puts you in the <b>top 20% of professionals</b> on Qbit. That's genuinely impressive.</p>
          <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">
            <b>🌟 Special offer for high scorers:</b><br>
            <span style="font-size:14px;color:#92400e">Get 1 month of Qbit Premium free — just refer 3 friends instead of 5.</span><br>
            <span style="font-size:12px;color:#b45309">Limited time · Only for users who scored 70%+</span>
          </div>
          <p style="font-size:14px;color:#475569">Premium gives you: unlimited AI mentor, 3-month score history, Gold scorecard, mock interview sessions, and priority roadmap generation.</p>`,
          SITE_URL, "Claim My Premium →"
        )
      });
      sent++;
      Utilities.sleep(200);
    });
    Logger.log("Premium offer sent to "+sent+" high scorers");
    logCampaign("premium_offer", "Premium offer to 70%+ scorers", sent, 0);
  }catch(e){ Logger.log("sendPremiumOffer error: "+e); }
}

/******** 7. CAMPAIGN STATS — run to see all email performance ********/
function getCampaignStats(){
  try{
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Qbit_Campaigns");
    if(!sheet){ Logger.log("Create a Qbit_Campaigns tab first"); return; }
    const rows = sheet.getDataRange().getValues();
    rows.forEach((r,i)=>{ if(i>0) Logger.log(`${r[0]} | ${r[1]} | Sent:${r[2]} | Failed:${r[3]} | Date:${r[4]}`); });
  }catch(e){ Logger.log("getCampaignStats: "+e); }
}

/******** HELPER — get users by segment ********/
function getUsersForSegment(segment){
  try{
    const users  = getSheet(USERS_SHEET).getDataRange().getValues();
    const ds     = getSheet(DATASET_SHEET).getDataRange().getValues();

    // Build score map
    const scoreMap = {};
    for(let i=1;i<ds.length;i++){
      const e = (ds[i][3]||"").toLowerCase();
      const s = parseInt(ds[i][20])||0;
      if(e && s>scoreMap[e]||0) scoreMap[e]=s;
    }

    return users.slice(1).filter(r=>{
      const email = (r[0]||"").toLowerCase();
      const count = parseInt(r[2])||0;
      const lastLogin = new Date(r[3]);
      const daysSince = (Date.now()-lastLogin)/(1000*60*60*24);
      if(!email || count<1) return false;
      if(segment==="all") return true;
      if(segment==="premium") return false; // future: check premium flag
      if(segment==="free") return true;
      if(segment==="inactive") return daysSince>=14;
      if(segment==="active") return daysSince<7;
      if(segment==="high_score") return (scoreMap[email]||0)>=70;
      return true;
    }).map(r=>(r[0]||"").toLowerCase()).filter(Boolean);
  }catch(e){ Logger.log("getUsersForSegment: "+e); return []; }
}

/******** HELPER — standard email HTML wrapper ********/
function buildEmailHTML(title, body, ctaUrl, ctaText){
  return `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
<div style="background:linear-gradient(90deg,#2563eb,#7c3aed);padding:20px 24px;border-radius:10px 10px 0 0">
  <h3 style="color:#fff;margin:0">${title}</h3>
</div>
<div style="background:#f8fafc;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e2e8f0;border-top:none;font-size:15px;line-height:1.7">
  ${body}
  <p style="text-align:center;margin:24px 0">
    <a href="${ctaUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${ctaText}</a>
  </p>
  <p style="font-size:11px;color:#94a3b8;text-align:center">
    Qbit Career Intelligence Engine · <a href="${SITE_URL}" style="color:#94a3b8">tryqbit.com</a>
  </p>
</div></div>`;
}

/******** HELPER — log campaign to sheet ********/
function logCampaign(type, subject, sent, failed){
  try{
    let sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName("Qbit_Campaigns");
    if(!sheet){
      sheet = SpreadsheetApp.openById(SHEET_ID).insertSheet("Qbit_Campaigns");
      sheet.appendRow(["type","subject","sent","failed","date"]);
    }
    sheet.appendRow([type, subject, sent, failed, new Date()]);
  }catch(e){ Logger.log("logCampaign: "+e); }
}
