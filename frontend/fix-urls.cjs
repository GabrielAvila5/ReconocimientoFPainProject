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

  // We accidentally removed the host entirely, turning things like:
  // fetch('http://localhost:4000/api/v1...') into fetch('/api/v1...')
  // and io('http://localhost:4000') into io('')
  // We need to find fetch('/api/v1 and replace it with fetch(`${import.meta.env.VITE_API_URL}/api/v1`
  // We need to find fetch(`/api/v1 and replace it with fetch(`${import.meta.env.VITE_API_URL}/api/v1`
  // We need to find io('') and replace it with io(import.meta.env.VITE_API_URL)
  
  content = content.replace(/fetch\('\/api\/v1/g, "fetch(`${import.meta.env.VITE_API_URL}/api/v1");
  content = content.replace(/fetch\(`\/api\/v1/g, "fetch(`${import.meta.env.VITE_API_URL}/api/v1");
  
  // also handle io('')
  content = content.replace(/io\('',/g, "io(import.meta.env.VITE_API_URL,");

  // fix any double quotes if any
  content = content.replace(/fetch\("\/api\/v1/g, "fetch(`${import.meta.env.VITE_API_URL}/api/v1");

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
  }
});

console.log('Files fixed:', changed);
