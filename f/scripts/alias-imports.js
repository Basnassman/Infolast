const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');
const extCandidates = ['.ts', '.tsx', '.js', '.jsx', '.json'];
const aliasRules = [
  { alias: '@core', dir: path.join(srcRoot, 'core') },
  { alias: '@modules', dir: path.join(srcRoot, 'modules') },
  { alias: '@docs', dir: path.join(srcRoot, 'docs') },
  { alias: '@shared', dir: path.join(srcRoot, 'shared') },
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function resolveTarget(filePath, relPath) {
  const abs = path.resolve(path.dirname(filePath), relPath);
  // If target is already a file/file extension, return it if exists.
  for (const ext of extCandidates) {
    if (fs.existsSync(abs + ext)) return abs + ext;
  }
  if (fs.existsSync(abs)) {
    if (fs.statSync(abs).isFile()) return abs;
    if (fs.statSync(abs).isDirectory()) {
      for (const ext of extCandidates) {
        const idx = path.join(abs, 'index' + ext);
        if (fs.existsSync(idx)) return idx;
      }
    }
  }
  return null;
}

function aliasPathFor(absPath) {
  const normalized = path.normalize(absPath);
  if (!normalized.startsWith(srcRoot)) return null;
  for (const rule of aliasRules) {
    const ruleDir = path.normalize(rule.dir);
    if (normalized === ruleDir) {
      return rule.alias;
    }
    if (normalized.startsWith(ruleDir + path.sep)) {
      let sub = normalized.slice(ruleDir.length + 1);
      if (!sub) return rule.alias;
      const parsed = path.parse(sub);
      if (parsed.base === 'index' && ['.ts', '.tsx', '.js', '.jsx'].includes(parsed.ext)) {
        sub = parsed.dir;
      } else {
        sub = path.join(parsed.dir, parsed.name);
      }
      return path.posix.join(rule.alias, sub.replace(/\\/g, '/'));
    }
  }
  // fallback to @src for everything else under src
  let rel = normalized.slice(srcRoot.length + 1);
  const parsed = path.parse(rel);
  if (parsed.base === 'index' && ['.ts', '.tsx', '.js', '.jsx'].includes(parsed.ext)) {
    rel = parsed.dir;
  } else {
    rel = path.join(parsed.dir, parsed.name);
  }
  return path.posix.join('@src', rel.replace(/\\/g, '/'));
}

function replaceImportPaths(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  const updated = content.replace(/(from\s*['"]|require\(\s*['"])(\.\.?[^'"\)]*)(['"]\s*\)?)/g, (match, prefix, relPath, suffix) => {
    if (!relPath.startsWith('.')) return match;
    if (relPath === '.' || relPath === './' || relPath === '..' || relPath === '../') return match;
    const target = resolveTarget(filePath, relPath);
    if (!target) return match;
    const alias = aliasPathFor(target);
    if (!alias) return match;
    changed = true;
    return `${prefix}${alias}${suffix}`;
  });

  if (changed) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  return false;
}

const files = [
  ...walk(path.join(projectRoot, 'src')),
  ...walk(path.join(projectRoot, 'apps')),
];

const modifiedFiles = [];
for (const file of files) {
  if (replaceImportPaths(file)) modifiedFiles.push(path.relative(projectRoot, file));
}

console.log(`Updated ${modifiedFiles.length} files.`);
for (const file of modifiedFiles) console.log(file);
if (modifiedFiles.length === 0) console.log('No relative source imports needed alias rewriting.');
