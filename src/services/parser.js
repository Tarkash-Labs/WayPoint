/**
 * Code Parser Service
 * Extracts structural knowledge from raw source code to build a "Knowledge Document"
 * for high-quality semantic embeddings.
 */

export function parseFileToDocument(filePath, sourceCode) {
  const ext = filePath.includes('.') ? filePath.split('.').pop().toLowerCase() : '';
  const lines = sourceCode.split('\n');
  
  const structure = {
    path: filePath,
    folder: filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : 'root',
    language: mapExtensionToLanguage(ext),
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    summary: '',
  };
  
  // Rough heuristic AST parsing (good enough for JS/TS/Python without massive libraries)
  lines.forEach((line) => {
    const text = line.trim();
    
    if (text.startsWith('import ') || text.startsWith('from ')) {
      structure.imports.push(text);
    } else if (text.startsWith('export ')) {
      // Keep it clean
      structure.exports.push(text.replace(/\{|\}/g, '').trim());
    } else if (text.match(/^(async\s+)?function\s+(\w+)/) || text.match(/^(export\s+)?const\s+(\w+)\s*=\s*(async\s*)?\(/)) {
      structure.functions.push(text.split('{')[0].trim());
    } else if (text.match(/^(export\s+)?class\s+(\w+)/)) {
      structure.classes.push(text.split('{')[0].trim());
    }
  });
  
  // Generate a basic heuristic summary based on the path and structural hints
  structure.summary = generateHeuristicSummary(structure);
  
  // Construct the Knowledge Document String
  return buildDocumentString(structure);
}

function mapExtensionToLanguage(ext) {
  const map = {
    'js': 'JavaScript', 'jsx': 'React (JSX)', 'ts': 'TypeScript', 'tsx': 'React (TSX)',
    'py': 'Python', 'go': 'Go', 'rs': 'Rust', 'java': 'Java', 'cs': 'C#', 'cpp': 'C++',
    'c': 'C', 'html': 'HTML', 'css': 'CSS', 'json': 'JSON', 'md': 'Markdown'
  };
  return map[ext] || ext.toUpperCase();
}

function generateHeuristicSummary(structure) {
  const p = structure.path.toLowerCase();
  
  if (p.includes('auth')) return 'Handles authentication, login, or session logic.';
  if (p.includes('api') || p.includes('route') || p.includes('controller')) return 'API route handler or controller logic.';
  if (p.includes('model') || p.includes('schema') || p.includes('db')) return 'Database schema, model, or ORM logic.';
  if (p.includes('component') || p.includes('view') || p.includes('page')) return 'UI Component or View template.';
  if (p.includes('util') || p.includes('helper')) return 'Utility functions and shared helpers.';
  if (p.includes('config') || p.includes('setup')) return 'Configuration and environment setup.';
  if (p.includes('index.') || p.includes('main.')) return 'Entry point or main module export.';
  
  return 'General source file.';
}

function buildDocumentString(s) {
  let doc = `Path:\n${s.path}\n\nFolder:\n${s.folder}\n\nLanguage:\n${s.language}\n`;
  
  if (s.imports.length > 0) doc += `\nImports:\n${s.imports.slice(0, 10).join('\n')}\n`;
  if (s.exports.length > 0) doc += `\nExports:\n${s.exports.slice(0, 10).join('\n')}\n`;
  if (s.functions.length > 0) doc += `\nFunctions:\n${s.functions.slice(0, 15).join('\n')}\n`;
  if (s.classes.length > 0) doc += `\nClasses:\n${s.classes.join('\n')}\n`;
  
  doc += `\nSummary:\n${s.summary}\n`;
  
  return doc;
}
