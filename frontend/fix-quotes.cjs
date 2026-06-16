const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.jsx') || file.endsWith('.js')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // fix trailing single quote that was left over from my previous bad replace
  // It looks like: fetch(`${import.meta.env.VITE_API_URL}/api/v1/notifications/unread-count');
  // or fetch(`${import.meta.env.VITE_API_URL}/api/v1...');
  
  content = content.replace(/fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/v1([^']+)'\)/g, "fetch(`${import.meta.env.VITE_API_URL}/api/v1$1`)");
  content = content.replace(/fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/v1([^']+)',/g, "fetch(`${import.meta.env.VITE_API_URL}/api/v1$1`,");

  // fix double quotes if any
  content = content.replace(/fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/v1([^"]+)"\)/g, "fetch(`${import.meta.env.VITE_API_URL}/api/v1$1`)");
  content = content.replace(/fetch\(`\$\{import\.meta\.env\.VITE_API_URL\}\/api\/v1([^"]+)",/g, "fetch(`${import.meta.env.VITE_API_URL}/api/v1$1`,");


  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
  }
});

console.log('Syntax errors fixed in files:', changed);
