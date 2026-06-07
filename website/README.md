# Qbit — Career Intelligence Engine
> AI-powered career readiness scoring, job matching, mock interviews, and portfolio builder.
> Live at [tryqbit.com](https://tryqbit.com)

---

## GitHub File Structure

```
tryqbit/
│
├── index.html              ← Homepage (landing page + email capture)
├── dashboard.html          ← Main analysis engine (score + skills + roadmap)
├── portfolio.html          ← Public career portfolio page (shareable URL + QR code)
├── jobs.html               ← Job engine (Adzuna API + JD fit + location intel + resume builder)
├── interview.html          ← AI mock interview platform (4 modes + instant feedback)
├── faq.html                ← FAQ page (accordion, dark theme)
├── privacy.html            ← Privacy policy (dark theme)
├── investors.html          ← Investor overview page
├── success.html            ← Post-session success page
│
├── favicon.ico             ← Browser tab icon
├── favicon-32.png          ← 32×32 favicon
├── apple-touch-icon.png    ← iOS home screen icon
│
├── README.md               ← This file
├── .gitkeep                ← Keeps empty folders tracked
└── style.css               ← Legacy CSS (not used in main pages — kept for reference)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 · CSS3 · Vanilla JavaScript |
| Hosting | Vercel (auto-deploy from GitHub) |
| Backend | Google Apps Script (serverless) |
| AI | Google Gemini 1.5 Flash (via Apps Script) |
| Jobs API | Adzuna Jobs API (free tier) |
| Database | Google Sheets (3 tabs) |
| Email | Resend (transactional + sequences) |
| Analytics | Google Analytics (G-24B2PVFE1Q) |
| DNS/CDN | Cloudflare |

---

## Setup Checklist

### 1. Google Sheets
Create a Google Sheet with 3 tabs, headers in Row 1:

**Tab 1 — Qbit_User_Intelligence** (37 columns A→AK)
```
timestamp | session_id | name | email | referral_code | referred_by |
referral_count | source | device | source_ip | country | current_role |
experience | current_salary | target_role | timeline | resume_uploaded |
detected_skills | skill_count | skill_gaps | score | recommended_role |
percentile | career_path | confidence_score | risk_areas | salary_prediction |
salary_gap | roadmap_requested | score_card_color | share_clicked |
analysis_count | target_salary | salary_estimate | ai_queries_count |
previous_score | returned_user
```

**Tab 2 — Qbit_Users** (8 columns A→H)
```
email | first_login | login_count | last_login |
last_session_id | referred_by | reward_sent | nudge_sent
```

**Tab 3 — Qbit_Referrals** (4 columns A→D)
```
referrer_email | referral_count | referred_emails | last_referral_date
```

---

### 2. Google Apps Script
1. Go to [script.google.com](https://script.google.com) → New project
2. Paste contents of `App_Script_FINAL.js`
3. Fill in the 3 config values at the top:
```javascript
const SHEET_ID       = "YOUR_GOOGLE_SHEET_ID";
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";   // aistudio.google.com/apikey
const RESEND_API_KEY = "YOUR_RESEND_API_KEY";   // resend.com
```
4. Deploy → New deployment → Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL
6. Replace `const API = "..."` in `index.html` and `dashboard.html`

---

### 3. Adzuna API (for jobs.html)
1. Register free at [developer.adzuna.com](https://developer.adzuna.com)
2. Create an app → copy `app_id` and `app_key`
3. In `jobs.html`, find and replace:
```javascript
const ADZUNA_ID  = "YOUR_ADZUNA_APP_ID";
const ADZUNA_KEY = "YOUR_ADZUNA_APP_KEY";
```

---

### 4. Resend Email
1. Sign up at [resend.com](https://resend.com)
2. Add your domain `tryqbit.com` → verify DNS
3. Create API key → paste into App Script config

---

### 5. Google Analytics
Already configured: `G-24B2PVFE1Q`
Replace `GA_MEASUREMENT_ID` in `index.html` with your real ID if needed.

---

### 6. Apps Script Triggers
In Apps Script editor → Triggers (clock icon) → Add 2 triggers:

| Function | Type | Frequency |
|---|---|---|
| `runEmailSequence` | Time-driven → Day timer | 9am IST daily |
| `runWeeklyEmail` | Time-driven → Week timer | Monday 9am IST |

---

### 7. Cloudflare Settings (IMPORTANT)
To prevent Cloudflare breaking your JavaScript:

Go to **Cloudflare Dashboard → tryqbit.com → Scrape Shield**:
- Email Address Obfuscation → **OFF**
- Server-side Excludes → **OFF**

Then: **Caching → Purge Everything** after each deployment.

---

### 8. Vercel Deployment
1. Push all files to GitHub (`main` branch)
2. Connect repo to [vercel.com](https://vercel.com)
3. Framework: **Other** (static HTML)
4. Output directory: leave blank (root)
5. Vercel auto-deploys on every `git push`

---

## App Script Trigger Checklist

```
runEmailSequence  → Day timer    → 9am IST  → nudges inactive users (3-day)
runWeeklyEmail    → Week timer   → Monday   → weekly score reminder to all users
```

---

## Feature Overview

| Page | Features |
|---|---|
| `index.html` | Email capture · referral detection · user count · session creation |
| `dashboard.html` | Career analysis · skill detection · score · gaps · roadmap · portfolio launch · referral panel · scorecard tiers · mock AI |
| `portfolio.html` | Public career page · photo upload · projects/certs · skill assessment · QR code · PDF download · edit mode |
| `jobs.html` | Job search (Adzuna) · JD fit analyser · smart apply · cover letter gen · location intel · resume builder |
| `interview.html` | 4 interview modes · AI questions · timer · instant feedback · score · model answers · full results |
| `faq.html` | Accordion FAQ · 4 sections · 12 questions |
| `privacy.html` | Full privacy policy · data table · third parties |
| `investors.html` | Traction · revenue model · tech stack · contact |
| `success.html` | Post-signup confirmation · next steps |

---

## Referral System

| Milestone | Reward |
|---|---|
| 1 referral | PDF report unlocked |
| 3 referrals | 3-month score history |
| 5 referrals | 1 month Premium free |
| Every 5 after | 1 more free month |

Referral URL format: `https://tryqbit.com?ref=QBNAME42`

---

## Email Sequence

| Trigger | Email sent |
|---|---|
| First login | Welcome email |
| 2nd login | "Score got smarter" feature highlight |
| 3rd login | 90-day roadmap nudge |
| 4th login | Referral program pitch |
| 5th+ login | Progress motivation |
| Day 3 (no return) | "Score still waiting" nudge (once only) |
| Every Monday | Weekly score check-in (if analysed before) |
| 5 referrals hit | Premium reward email (once only) |

---

## Contacts
- Email: hello@tryqbit.com
- Site: tryqbit.com
- Built with: Claude AI + Google Apps Script + Adzuna API + Gemini AI
