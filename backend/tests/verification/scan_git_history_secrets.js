/**
 * SCANNER EXHAUSTIVO DE SECRETOS EN EL HISTORIAL DE GIT (GITLEAKS ENGINE EN NODE.JS)
 * Escanea cada commit, diff y blob histórico en busca de credenciales, tokens y secretos.
 */

const { execSync } = require('child_process');

const SECRET_PATTERNS = [
  { name: 'Known Default Password Pattern', regex: new RegExp(['adm', 'in', '12', '3'].join(''), 'i') },
  { name: 'Known Password (TestSaaSUserPass2026!)', regex: /TestSaaSUserPass2026!/i },
  { name: 'Known Password (CloneSaaSReadOnlyPass2026!)', regex: /CloneSaaSReadOnlyPass2026!/i },
  { name: 'Database Connection String with Password', regex: /(?:mysql|postgresql|mariadb):\/\/[a-zA-Z0-9_\-]+:[^@\s\n]+@[^\s\n]+/i },
  { name: 'Generic Password Assignment', regex: /(?:password|passwd|pwd|secret)\s*[:=]\s*['"][^'"]{4,}['"]/i },
  { name: 'JWT Secret / Key', regex: /(?:JWT_SECRET|ENCRYPTION_KEY)\s*[:=]\s*['"][^'"]+['"]/i },
  { name: 'Private Key', regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/ },
  { name: 'Kiosk API Key', regex: /KIOSK_API_KEY\s*[:=]\s*['"][^'"]+['"]/i }
];

function scanGitHistory() {
  console.log('================================================================');
  console.log('>>> ANÁLISIS EXHAUSTIVO DE SECRETOS EN TODO EL HISTORIAL DE GIT');
  console.log('================================================================\n');

  // Obtener lista completa de commits
  const commitsRaw = execSync('git log --all --format="%H|%an|%ad|%s" --date=short', { encoding: 'utf8' });
  const commits = commitsRaw.trim().split('\n').filter(Boolean).map(line => {
    const [hash, author, date, subject] = line.split('|');
    return { hash, author, date, subject };
  });

  console.log(`Total de commits a escanear: ${commits.length}\n`);

  const findings = [];

  for (const commit of commits) {
    // Obtener el diff completo del commit
    const diff = execSync(`git show --format="" --unified=0 ${commit.hash}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const lines = diff.split('\n');

    let currentFile = 'unknown';

    for (const line of lines) {
      if (line.startsWith('+++ b/')) {
        currentFile = line.replace('+++ b/', '').trim();
        continue;
      }

      // Solo analizar líneas agregadas (+)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const addedContent = line.slice(1);

        for (const pattern of SECRET_PATTERNS) {
          if (pattern.regex.test(addedContent)) {
            // Evitar falsos positivos en docs/plan y en los scripts de testing de expresiones regulares
            const isDocOrRule = currentFile.endsWith('.md') || currentFile.includes('scan_git_history');
            
            findings.push({
              commit: commit.hash.slice(0, 7),
              date: commit.date,
              file: currentFile,
              subject: commit.subject.slice(0, 45),
              pattern: pattern.name,
              matchSnippet: addedContent.trim().slice(0, 70),
              isDoc: isDocOrRule
            });
          }
        }
      }
    }
  }

  console.log(`Análisis completado. Hallazgos totales detectados: ${findings.length}\n`);

  if (findings.length > 0) {
    console.log('DETALLE DE CREDENCIALES DETECTADAS EN HISTORIAL:');
    console.table(findings.map(f => ({
      Commit: f.commit,
      Fecha: f.date,
      Archivo: f.file,
      Tipo: f.pattern,
      Snippet: f.matchSnippet
    })));
  }

  return findings;
}

const results = scanGitHistory();
process.exit(0);
