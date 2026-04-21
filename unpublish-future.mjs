/**
 * SOLAYA — Script d'initialisation du planning
 *
 * Ce script :
 * 1. Met les articles 2-52 en brouillon (invisibles sur le site)
 * 2. Conserve l'article 1 publié (aujourd'hui)
 * 3. Stocke la date cible dans les metafields de chaque article
 *
 * À exécuter UNE SEULE FOIS pour initialiser le planning.
 */

import https from 'https';

const SHOP    = 'ip1q3w-08.myshopify.com';
const TOKEN   = process.env.SHOPIFY_ACCESS_TOKEN;
const BLOG_ID = '96886816907';

if (!TOKEN) {
  console.error('❌ Variable SHOPIFY_ACCESS_TOKEN manquante.');
  process.exit(1);
}

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: SHOP,
      path: `/admin/api/2024-01${path}`,
      method,
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Planning complet : article ID → date de publication cible
// L'article 1 (21 avril) reste publié. Tous les autres deviennent des brouillons.
const SCHEDULE = [
  // --- Déjà publié aujourd'hui ---
  { id: '571984609419', date: '2026-04-21', publish: true  }, // Art 1 — gardé publié

  // --- Brouillons à publier progressivement ---
  { id: '571984642187', date: '2026-04-24', publish: false }, // Art 2
  { id: '571984674955', date: '2026-04-28', publish: false }, // Art 3
  { id: '571984707723', date: '2026-05-01', publish: false }, // Art 4
  { id: '571984740491', date: '2026-05-05', publish: false }, // Art 5
  { id: '571984773259', date: '2026-05-08', publish: false }, // Art 6
  { id: '571984904331', date: '2026-05-11', publish: false }, // Art 7
  { id: '571984937099', date: '2026-05-18', publish: false }, // Art 8
  { id: '571984969867', date: '2026-05-25', publish: false }, // Art 9
  { id: '571985002635', date: '2026-06-01', publish: false }, // Art 10
  { id: '571985035403', date: '2026-06-08', publish: false }, // Art 11
  { id: '571985068171', date: '2026-06-15', publish: false }, // Art 12
  { id: '571985100939', date: '2026-06-22', publish: false }, // Art 13
  { id: '571985133707', date: '2026-06-29', publish: false }, // Art 14
  { id: '571985166475', date: '2026-07-06', publish: false }, // Art 15
  { id: '571985199243', date: '2026-07-13', publish: false }, // Art 16
  { id: '571985232011', date: '2026-07-20', publish: false }, // Art 17
  { id: '571985264779', date: '2026-07-27', publish: false }, // Art 18
  { id: '571985297547', date: '2026-08-03', publish: false }, // Art 19
  { id: '571985330315', date: '2026-08-10', publish: false }, // Art 20
];

// Articles 21-52 — IDs à récupérer dynamiquement
async function getArticleIds() {
  const r = await apiRequest('GET', `/blogs/${BLOG_ID}/articles.json?limit=250&fields=id,title,published_at&order=created_at+asc`);
  return r.body.articles || [];
}

async function main() {
  console.log('🔍 Récupération de tous les articles...');
  const all = await getArticleIds();
  // Sort by creation (ascending) — ID ascending is a decent proxy
  all.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  console.log(`   ${all.length} articles trouvés\n`);

  // Build full schedule using IDs in order
  const DATES_ALL = [
    '2026-04-21','2026-04-24','2026-04-28',
    '2026-05-01','2026-05-05','2026-05-08','2026-05-11','2026-05-18','2026-05-25',
    '2026-06-01','2026-06-08','2026-06-15','2026-06-22','2026-06-29',
    '2026-07-06','2026-07-13','2026-07-20','2026-07-27',
    '2026-08-03','2026-08-10','2026-08-17','2026-08-24','2026-08-31',
    '2026-09-07','2026-09-14','2026-09-21','2026-09-28',
    '2026-10-05','2026-10-12','2026-10-19','2026-10-26',
    '2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30',
    '2026-12-07','2026-12-14','2026-12-21','2026-12-28',
    '2027-01-04','2027-01-11','2027-01-18','2027-01-25',
    '2027-02-01','2027-02-08','2027-02-15','2027-02-22',
    '2027-03-01','2027-03-08','2027-03-15','2027-03-22',
  ];

  const today = new Date().toISOString().substring(0, 10);
  let published = 0, drafted = 0, errors = 0;

  // Build schedule JSON for GitHub Actions
  const scheduleForCI = [];

  for (let i = 0; i < all.length; i++) {
    const article = all[i];
    const targetDate = DATES_ALL[i] || today;
    const shouldPublish = targetDate <= today;

    scheduleForCI.push({
      id: article.id,
      title: article.title,
      targetDate,
      published: shouldPublish
    });

    const payload = shouldPublish
      ? { article: { id: article.id, published: true } }
      : { article: { id: article.id, published: false } };

    const r = await apiRequest('PUT', `/blogs/${BLOG_ID}/articles/${article.id}.json`, payload);

    if (r.status === 200) {
      const status = shouldPublish ? '✅ PUBLIÉ' : '🔒 BROUILLON';
      console.log(`${status} | ${targetDate} | ${article.title.substring(0, 55)}`);
      if (shouldPublish) published++; else drafted++;
    } else {
      console.log(`❌ ERREUR ${r.status} | ${article.title.substring(0, 40)}`);
      errors++;
    }
    await sleep(400);
  }

  // Write schedule.json for GitHub Actions
  import('fs').then(fs => {
    fs.writeFileSync('/tmp/solaya-scheduler/schedule.json', JSON.stringify(scheduleForCI, null, 2));
    console.log('\n📄 schedule.json écrit → /tmp/solaya-scheduler/schedule.json');
  });

  console.log(`\n── RÉSUMÉ ──────────────────────────────`);
  console.log(`✅ Publiés maintenant  : ${published}`);
  console.log(`🔒 Mis en brouillon   : ${drafted}`);
  console.log(`❌ Erreurs            : ${errors}`);
  console.log(`\nLe site affiche maintenant uniquement les articles dont la date <= aujourd'hui.`);
  console.log(`GitHub Actions publiera automatiquement 1 article à chaque date planifiée.\n`);
}

main().catch(console.error);
