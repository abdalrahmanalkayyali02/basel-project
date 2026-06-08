/*
 * MomsMed Guide - Express backend
 * --------------------------------
 * - Serves the SPA from /public
 * - Persists the entire catalog to a single flat file: file.json (JSON)
 * - Provides:
 *     GET  /api/data            -> returns the current catalog JSON
 *     POST /api/login           -> validates hardcoded admin credentials
 *     POST /api/save            -> overwrites file.json with new catalog (auth-gated)
 *
 * Credentials are intentionally hardcoded per project spec:
 *   Username: basel
 *   Password: basel2004
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'file.json');
const FEEDBACK_FILE = path.join(__dirname, 'feedbackfile.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const ADMIN_USER = 'basel';
const ADMIN_PASS = 'basel2004';

// ---------------------------------------------------------------------------
// Initial catalog payload (used to seed file.json on first launch)
// ---------------------------------------------------------------------------
const INITIAL_DATA = {
  meta: {
    title: 'MomsMed Guide',
    tagline: 'Pregnancy-safe medication & herb catalog',
    updatedAt: new Date().toISOString(),
    version: 1
  },
  regions: [
    { id: 'all', label: 'All Markets', flag: '🌍' },
    { id: 'jordan', label: 'Jordan', flag: '🇯🇴' },
    { id: 'europe', label: 'Europe / UK', flag: '🇪🇺' },
    { id: 'us', label: 'USA', flag: '🇺🇸' }
  ],
  categories: {
    green: {
      id: 'green',
      label: 'Safe',
      emoji: '🟢',
      headline: 'Approved during pregnancy',
      blurb:
        'First-line options with the strongest safety record. Always follow dosage and double-check with your physician.',
      medications: [
        {
          id: 'med-paracetamol',
          name: 'Acetaminophen (Paracetamol)',
          purpose: 'Fever & Pain',
          brands: {
            jordan: ['Revanin', 'Panadol'],
            europe: ['Panadol', 'Doliprane'],
            us: ['Tylenol']
          },
          dosage: '500–1000 mg every 6 hours as needed. Max 4000 mg / 24h.',
          warning:
            'Avoid "Extra" formulations — they contain caffeine or NSAIDs (ibuprofen / Advil) which are not first-line safe.'
        },
        {
          id: 'med-morning-sickness',
          name: 'Vitamin B6 (Pyridoxine) + Doxylamine / Meclozine',
          purpose: 'Morning Sickness (Nausea & Vomiting)',
          brands: {
            jordan: ['Navidoxine', 'Vominore'],
            europe: ['Xonvea', 'Cariban'],
            us: ['Diclegis (Rx)', 'OTC Vitamin B6 + Unisom Sleep Tabs']
          },
          dosage: 'Typically 1 tablet before bed. Adjust to symptom severity under guidance.',
          warning: 'Do not combine with other sedating antihistamines without pharmacist advice.'
        },
        {
          id: 'med-constipation',
          name: 'Psyllium husk (fiber) or Docusate sodium',
          purpose: 'Constipation',
          brands: {
            jordan: ['Agiolax', 'Normacol'],
            europe: ['Fybogel', 'DulcoSoft'],
            us: ['Metamucil', 'Colace']
          },
          dosage: 'One sachet or tablespoon in a full glass of water daily.',
          warning: 'Drink plenty of water. Avoid stimulant laxatives unless prescribed.'
        },
        {
          id: 'med-allergies',
          name: 'Loratadine or Cetirizine',
          purpose: 'Allergies',
          brands: {
            jordan: ['Histine', 'Claritine'],
            europe: ['Clarityn', 'Zirtek'],
            us: ['Claritin', 'Zyrtec']
          },
          dosage: '10 mg once daily.',
          warning: 'Avoid first-generation antihistamines with strong sedation unless approved.'
        }
      ],
      herbs: [
        {
          id: 'herb-peppermint',
          name: 'Peppermint',
          benefit:
            'Reduces nausea, speeds gastric emptying, soothes the stomach, alleviates acid reflux.'
        },
        {
          id: 'herb-ginger',
          name: 'Ginger',
          benefit:
            'Contains gingerol — reduces morning sickness and may ease early uterine contractions.'
        },
        {
          id: 'herb-thyme',
          name: 'Thyme',
          benefit: 'Strengthens immunity, rich in vitamins, calms the nervous system, improves mood.'
        },
        {
          id: 'herb-chamomile',
          name: 'Chamomile',
          benefit:
            'Relieves gas, bloating and constipation; reduces digestive inflammation; eases nausea.'
        },
        {
          id: 'herb-green-tea',
          name: 'Green Tea',
          benefit:
            'Rich in antioxidants, speeds metabolism, fights mood swings, supports digestion. Keep intake moderate.'
        },
        {
          id: 'herb-raspberry-leaf',
          name: 'Red Raspberry Leaf',
          benefit:
            'High in iron; soothes the uterus; eases labor pains; promotes milk production after birth.'
        },
        {
          id: 'herb-echinacea',
          name: 'Echinacea',
          benefit: 'Helps prevent colds and shortens their duration during pregnancy-related immune dips.'
        }
      ]
    },
    yellow: {
      id: 'yellow',
      label: 'Caution',
      emoji: '🟡',
      headline: 'Use only under medical supervision',
      blurb:
        'These conditions and medications require professional monitoring. Self-adjustment is unsafe.',
      medications: [
        {
          id: 'med-antacids',
          name: 'Antacids (Calcium / Magnesium carbonate, Alginates)',
          purpose: 'Acid Reflux & Heartburn',
          brands: {
            jordan: ['Rennie', 'Gaviscon'],
            europe: ['Rennie', 'Gaviscon'],
            us: ['Tums', 'Mylanta']
          },
          dosage: '10–20 ml liquid OR 2 tablets after meals and before bed.',
          warning:
            'Gaviscon contains sodium. If you have high blood pressure or preeclampsia, switch to low-sodium options like Tums or Rennie under medical advice.',
          alert: 'HIGH SODIUM IN GAVISCON — caution with hypertension or preeclampsia.'
        },
        {
          id: 'med-insulin',
          name: 'Insulin',
          purpose: 'Diabetes (Gestational or Chronic)',
          brands: {
            jordan: ['Insulin (all approved brands)'],
            europe: ['Insulin (all approved brands)'],
            us: ['Insulin (all approved brands)']
          },
          dosage:
            'Dose changes per trimester. Never self-adjust — requires endocrinologist supervision and frequent glucose monitoring.',
          warning:
            'Gold standard: a large molecule that does not cross the placenta. Untreated hyperglycemia causes macrosomia and delivery complications.'
        },
        {
          id: 'med-methyldopa-labetalol',
          name: 'Methyldopa or Labetalol',
          purpose: 'Hypertension (High Blood Pressure)',
          brands: {
            jordan: ['Aldomet (Methyldopa)', 'Trandate (Labetalol)'],
            europe: ['Aldomet', 'Trandate'],
            us: ['Aldomet', 'Trandate / Normodyne']
          },
          dosage:
            'Per physician — typically titrated to target BP. Requires fetal heart-rate monitoring and maternal kidney function checks.',
          warning:
            'Avoid ACE inhibitors and ARBs completely — they cause fetal renal agenesis (Red Category).'
        },
        {
          id: 'med-nifedipine',
          name: 'Nifedipine (Calcium Channel Blocker)',
          purpose: 'Hypertension — Chronic or Crisis',
          brands: {
            jordan: ['Adalat', 'Epilat'],
            europe: ['Adalat LA', 'Coracten'],
            us: ['Procardia', 'Adalat CC']
          },
          dosage:
            'Extended-Release (chronic): 30–60 mg orally once daily; titrate every 7–14 days; max 120 mg/day. Immediate-Release (crisis, SBP ≥160 or DBP ≥110): 10–20 mg orally, repeat in 20–30 minutes, max 60 mg per acute episode.',
          warning:
            'Linked with reduced preeclampsia/eclampsia risk and no significant impact on birthweight — but must be supervised.'
        }
      ],
      herbs: []
    },
    red: {
      id: 'red',
      label: 'Danger',
      emoji: '🔴',
      headline: 'Strictly prohibited during pregnancy',
      blurb:
        'These substances are globally dangerous. They remain visible across every regional filter.',
      medications: [
        {
          id: 'red-methotrexate',
          name: 'Methotrexate',
          reason:
            'Blocks DNA synthesis via dihydrofolate reductase inhibition. Disrupts rapidly dividing embryonic cells — causes miscarriage and malformations.'
        },
        {
          id: 'red-isotretinoin',
          name: 'Isotretinoin',
          reason:
            'Highly teratogenic. Disrupts craniofacial and CNS development via retinoic acid receptors — even minimal exposure is harmful.'
        },
        {
          id: 'red-thalidomide',
          name: 'Thalidomide',
          reason: 'Interferes with limb angiogenesis — causes phocomelia and shortened or absent limbs.'
        },
        {
          id: 'red-warfarin',
          name: 'Warfarin',
          reason:
            'Crosses the placenta. Vitamin K antagonism disrupts fetal bone/cartilage formation — skeletal dysplasia.'
        },
        {
          id: 'red-ace',
          name: 'ACE Inhibitors',
          reason:
            'Blocks angiotensin II that fetal kidneys depend on — causes renal agenesis and oligohydramnios.'
        },
        {
          id: 'red-tetracyclines',
          name: 'Tetracyclines',
          reason:
            'Chelate calcium, deposit into fetal teeth and bones — permanent discoloration and growth inhibition.'
        },
        {
          id: 'red-valproic',
          name: 'Valproic Acid',
          reason:
            'Inhibits histone deacetylase and folate metabolism — neural tube defects.'
        },
        { id: 'red-ribavirin', name: 'Ribavirin', reason: 'Guanosine analog. Severe teratogenicity in animal studies — contraindicated.' },
        { id: 'red-statins', name: 'Statins', reason: 'Cholesterol is vital for fetal organogenesis and steroid synthesis — inhibition is harmful.' },
        { id: 'red-misoprostol', name: 'Misoprostol', reason: 'Used for medical abortion. If pregnancy continues — linked with Möbius sequence and limb defects.' },
        { id: 'red-danazol', name: 'Danazol', reason: 'Androgenic — causes virilization of female fetuses.' },
        { id: 'red-finasteride', name: 'Finasteride / Dutasteride', reason: 'Disrupts development of male external genitalia.' },
        { id: 'red-leflunomide', name: 'Leflunomide', reason: 'Highly teratogenic — long washout period required.' },
        { id: 'red-mifepristone', name: 'Mifepristone', reason: 'Antiprogestin — induces abortion.' },
        { id: 'red-clomiphene', name: 'Clomiphene', reason: 'Use only pre-conception. Continued exposure may cause fetal harm.' },
        { id: 'red-raloxifene', name: 'Raloxifene', reason: 'Selective estrogen receptor modulator — fetal harm.' },
        { id: 'red-ergot', name: 'Ergot Derivatives', reason: 'Uterine vasoconstriction — fetal hypoxia.' },
        { id: 'red-endothelin', name: 'Endothelin Antagonists (Bosentan, Ambrisentan)', reason: 'Teratogenic in animal models — contraindicated.' },
        { id: 'red-acitretin', name: 'Acitretin', reason: 'Retinoid — severe teratogenicity persisting years after discontinuation.' }
      ],
      herbs: [
        { id: 'herb-rosemary', name: 'Rosemary', reason: 'Raises blood pressure, hard to digest, may cause fatigue.' },
        { id: 'herb-dong-quai', name: 'Dong Quai', reason: 'Triggers uterine contractions — risk of miscarriage or premature birth.' },
        { id: 'herb-ginseng', name: 'Ginseng', reason: 'Can harm the fetus — avoid during pregnancy.' },
        { id: 'herb-cohosh', name: 'Cohosh (Black & Blue)', reason: 'Causes uterine contractions, premature birth, and may raise preeclampsia risk.' },
        { id: 'herb-hibiscus', name: 'Hibiscus', reason: 'Disrupts pregnancy hormones — may cause premature birth.' },
        { id: 'herb-st-johns-wort', name: "St. John's Wort", reason: 'Linked with birth defects and uterine stimulation.' },
        { id: 'herb-yarrow', name: 'Yarrow', reason: 'Muscle relaxant — may contribute to premature labor.' },
        { id: 'herb-lemongrass', name: 'Lemongrass', reason: 'In excess may increase contractions and lower blood pressure.' }
      ]
    }
  },
  quiz: [
    {
      id: 'q1',
      statement: 'All natural herbs are completely safe during pregnancy since they come from nature.',
      answer: false,
      feedbackTone: 'red',
      explanation:
        'False ❌ — herbs like Dong Quai and Cohosh trigger immediate uterine contractions and miscarriage risk. "Natural" never means automatically safe.'
    },
    {
      id: 'q2',
      statement: 'Pregnant women can safely take any version of paracetamol, including "Extra" labeled packs.',
      answer: false,
      feedbackTone: 'red',
      explanation:
        'False ❌ — "Extra" packs contain added caffeine or NSAIDs (e.g. ibuprofen) which are not first-line safe. Stick to plain paracetamol.'
    },
    {
      id: 'q3',
      statement:
        'Gaviscon is perfectly safe for a pregnant woman even if she suffers from chronic high blood pressure.',
      answer: false,
      feedbackTone: 'yellow',
      explanation:
        'False ❌ — Gaviscon has a high sodium load. Hypertensive or preeclampsia patients should switch to low-sodium options like Tums or Rennie.'
    },
    {
      id: 'q4',
      statement: 'Insulin is considered the Gold Standard treatment for managing gestational diabetes.',
      answer: true,
      feedbackTone: 'green',
      explanation:
        'True ✅ — Insulin molecules are too large to cross the placental barrier, keeping the baby safe while controlling maternal glucose.'
    }
  ]
};

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------
function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf8');
    console.log('[MomsMed] Seeded file.json with initial dataset');
    return;
  }
  try {
    JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.warn('[MomsMed] file.json is corrupted, re-seeding…', err.message);
    fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf8');
  }
}

function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeData(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }
  payload.meta = {
    ...(payload.meta || {}),
    updatedAt: new Date().toISOString(),
    version: ((payload.meta && payload.meta.version) || 0) + 1
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Auth (single in-memory session token for the hardcoded admin)
// ---------------------------------------------------------------------------
const sessions = new Set();

function issueToken() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.add(token);
  return token;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (token && sessions.has(token)) return next();
  return res.status(401).json({ error: 'Unauthorized — please log in as the pharmacy doctor.' });
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/data', (_req, res) => {
  try {
    res.json(readData());
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file.json: ' + err.message });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = issueToken();
    return res.json({ ok: true, token, role: 'doctor' });
  }
  return res
    .status(401)
    .json({ ok: false, error: 'Invalid username or password. Access is limited to the pharmacy doctor.' });
});

app.post('/api/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.post('/api/save', requireAuth, (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.categories || !payload.quiz) {
      return res.status(400).json({ error: 'Payload missing required fields (categories, quiz).' });
    }
    writeData(payload);
    res.json({ ok: true, data: readData() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write file.json: ' + err.message });
  }
});

app.post('/api/feedback', (req, res) => {
  try {
    const feedback = req.body;
    if (!feedback || !feedback.text) {
      return res.status(400).json({ error: 'Feedback text is required' });
    }
    
    let existingFeedback = [];
    if (fs.existsSync(FEEDBACK_FILE)) {
      try {
        existingFeedback = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
      } catch (err) {
        console.warn('[MomsMed] feedbackfile.json corrupted, starting fresh.');
      }
    }
    
    existingFeedback.push({
      id: crypto.randomBytes(8).toString('hex'),
      text: feedback.text,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(existingFeedback, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save feedback: ' + err.message });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

ensureDataFile();
app.listen(PORT, () => {
  console.log(`\n  MomsMed Guide is live at http://localhost:${PORT}\n`);
});
