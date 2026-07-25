/**
 * Local File System Service
 * Uses the File System Access API to read a local folder instantly.
 */

let localRepoCache = null;

export function getCachedLocalRepo() {
  return localRepoCache;
}

export function clearCachedLocalRepo() {
  localRepoCache = null;
}

export async function selectLocalDirectory() {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    const repoName = dirHandle.name;
    const files = await scanDirectory(dirHandle, '');
    
    // Normalize to match what github.js produces
    const repoData = {
      repoName,
      files,
      localHandle: dirHandle, // Keep this! We need it for the Deep Read phase
      source: 'local'
    };
    
    localRepoCache = repoData;
    return repoData;
  } catch (error) {
    if (error.name === 'AbortError') return null; // User cancelled
    throw error;
  }
}

async function scanDirectory(dirHandle, currentPath) {
  // Ignore heavy or irrelevant folders
  const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache', 'out', 'vendor'
  ]);
  
  // Ignore binaries and assets
  const IGNORED_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.mp4', '.svg', '.ico', '.pdf', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf'
  ]);
  
  const files = [];
  
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory') {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      
      const subFiles = await scanDirectory(entry, `${currentPath}${entry.name}/`);
      files.push(...subFiles);
    } else if (entry.kind === 'file') {
      // Ignore hidden files and lockfiles (optional, but keeps tree clean)
      if (entry.name.startsWith('.') || entry.name === 'package-lock.json' || entry.name === 'yarn.lock') continue;
      
      const ext = entry.name.includes('.') ? entry.name.substring(entry.name.lastIndexOf('.')) : '';
      if (IGNORED_EXTS.has(ext)) continue;
      
      const file = await entry.getFile();
      
      // We don't read the text here (to make scanning instant).
      // We estimate LOC based on file size (avg ~30-40 bytes per line of code).
      // The actual text will be fetched during the Deep Read phase using `entry.handle`.
      files.push({
        path: `${currentPath}${entry.name}`,
        size: file.size,
        linesOfCode: Math.max(1, Math.round(file.size / 35)),
        handle: entry 
      });
    }
  }
  
  return files;
}
