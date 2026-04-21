/**
 * SOLAYA — Publisher automatique
 * Exécuté par GitHub Actions chaque lundi matin à 08h00
 *
 * Logique :
 * - Lit schedule.json
 * - Publie tous les articles dont targetDate <= aujourd'hui et published === false
 * - Met à jour schedule.json avec published: true
 */

import https from 'https';
import { readFileSync, writeFileSync } from 'fs';

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

async function main() {
  const today = new Date().toISOString().substring(0, 10);
  console.log(`\n🗓  Publication automatique SOLAYA — ${today}\n`);

  const schedule = JSON.parse(readFileSync('schedule.json', 'utf8'));

  const toPublish = schedule.filter(a => !a.published && a.targetDate <= today);

  if (toPublish.length === 0) {
    console.log('ℹ️  Aucun article à publier aujourd\'hui.\n');
    return;
  }

  console.log(`📝 ${toPublish.length} article(s) à publier :\n`);

  let success = 0;
  for (const article of toPublish) {
    const r = await apiRequest('PUT', `/blogs/${BLOG_ID}/articles/${article.id}.json`, {
      article: { id: article.id, published: true }
    });

    if (r.status === 200) {
      article.published = true;
      console.log(`  ✅ Publié : "${article.title.substring(0, 65)}"`);
      console.log(`     Planifié pour : ${article.targetDate}\n`);
      success++;
    } else {
      console.log(`  ❌ Erreur ${r.status} : "${article.title.substring(0, 40)}"`);
    }
    await sleep(500);
  }

  // Sauvegarder l'état mis à jour
  writeFileSync('schedule.json', JSON.stringify(schedule, null, 2));

  console.log(`── Résultat : ${success}/${toPublish.length} articles publiés ──\n`);

  if (success < toPublish.length) {
    process.exit(1); // Signal d'erreur pour GitHub Actions
  }
}

main().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
