const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const exts = ['.ts', '.tsx', '.js', '.jsx', '.json'];

function walk(dir) {
  const res = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) res.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) res.push(p);
  }
  return res;
}

function fileExistsNoExt(p) {
  for (const e of exts) {
    if (fs.existsSync(p + e)) return p + e;
  }
  // index
  for (const e of exts) {
    if (fs.existsSync(path.join(p, 'index' + e))) return path.join(p, 'index' + e);
  }
  return null;
}

function findCandidates(basename) {
  const results = [];
  function rec(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) rec(p);
      else {
        const b = path.basename(name, path.extname(name));
        if (b === basename) results.push(p);
      }
    }
  }
  rec(root);
  return results;
}

const files = walk(root);
const changes = [];
for (const file of files) {
  const relFile = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  let modified = false;
  const newLines = lines.map((line) => {
    const m = line.match(/(import\s+[^'";]+from\s+|require\()(['"])(\.\.?(?:\/[^'"\\]+)*)\2/);
    if (!m) return line;
    const importPath = m[3];
    if (!importPath.startsWith('.')) return line;
    const absTarget = path.resolve(path.dirname(file), importPath);
    const found = fileExistsNoExt(absTarget);
    if (found) return line; // ok
    // try to find candidate by basename
    const base = path.basename(importPath);
    const cands = findCandidates(base).filter(p => p.indexOf('node_modules')===-1);
    if (cands.length === 0) return line;
    // pick the best candidate: prefer those under src
    let pick = cands.find(p => p.includes('/src/')) || cands[0];
    const rel = path.relative(path.dirname(file), pick);
    let relImport = rel.replace(/\\/g, '/');
    // remove extension
    relImport = relImport.replace(/\.(ts|tsx|js|jsx|json)$/, '');
    if (!relImport.startsWith('.')) relImport = './' + relImport;
    const newLine = line.replace(importPath, relImport);
    changes.push({file: relFile, from: importPath, to: relImport, line});
    modified = true;
    return newLine;
  });
}

if (changes.length === 0) {
  console.log('No missing relative imports found.');
} else {
  console.log('Proposed fixes:\n');
  for (const c of changes) console.log(`${c.file}: ${c.from} -> ${c.to}`);
  // write proposals to file
  fs.writeFileSync(path.join(root, 'fix-imports-proposals.json'), JSON.stringify(changes, null, 2));
  console.log('\nWrote fix-imports-proposals.json with proposals.');
}
