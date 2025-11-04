#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const slidesRoot = path.resolve(__dirname);

function isHidden(name) { return name.startsWith('.'); }
function isSlidesDir(name) { return !['reveal', 'core'].includes(name) && !isHidden(name) && !name.endsWith('.files'); }

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function readDeckConfig(dirPath) {
  const cfgPath = path.join(dirPath, 'deck.json');
  if (fs.existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      return cfg;
    } catch (e) {
      console.warn(`[deck] Invalid JSON in ${cfgPath}: ${e.message}`);
    }
  }
  return null;
}

function discoverSlides(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.toLowerCase().endsWith('.html') && f.toLowerCase() !== 'index.html')
    .sort(naturalCompare);
}

function generateHTML({ title, slideCount, slidesArray }) {
  const titleSafe = title || 'Slides Deck';
  const configScript = slidesArray
    ? `window.DECK_SLIDES = ${JSON.stringify(slidesArray)};`
    : `window.DECK_MAX_SLIDES = ${slideCount};`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleSafe}</title>
  <link rel="stylesheet" href="../core/deck.css">
  <style>
    .deck { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
    .deck::-webkit-scrollbar { width: 8px; }
    .deck::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 8px; }
    .deck::-webkit-scrollbar-track { background: transparent; }
    body { background: #000; }
  </style>
  </head>
<body>
  <noscript>Please enable JavaScript to view the slides.</noscript>
  <script>
    ${configScript}
  </script>
  <script src="../core/deck.js"></script>
</body>
</html>`;
}

function generateDeckForDir(dirPath) {
  const cfg = readDeckConfig(dirPath);
  const discovered = discoverSlides(dirPath);
  if (discovered.length === 0) return false;

  let html;
  if (cfg && Array.isArray(cfg.slides) && cfg.slides.length > 0) {
    html = generateHTML({ title: cfg.title, slidesArray: cfg.slides });
  } else {
    // Default: assume numeric slides from 1..N where N = max discovered numeric filename
    const numeric = discovered
      .map((f) => parseInt(path.basename(f, path.extname(f)), 10))
      .filter((n) => !Number.isNaN(n));
    const max = numeric.length ? Math.max(...numeric) : discovered.length;
    html = generateHTML({ title: cfg && cfg.title, slideCount: max });
  }

  fs.writeFileSync(path.join(dirPath, 'index.html'), html, 'utf8');
  return true;
}

function main() {
  const entries = fs.readdirSync(slidesRoot, { withFileTypes: true });
  let generated = 0;
  for (const ent of entries) {
    if (ent.isDirectory() && isSlidesDir(ent.name)) {
      const dirPath = path.join(slidesRoot, ent.name);
      if (generateDeckForDir(dirPath)) generated++;
    }
  }
  console.log(`[deck] Generated index.html for ${generated} deck(s).`);
}

main();
