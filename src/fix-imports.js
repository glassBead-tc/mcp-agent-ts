#!/usr/bin/env node

/**
 * Script to fix imports in TypeScript files
 * Adds .js extension to all relative imports to comply with ESM
 */

import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Regular expression to match relative imports without file extensions
const importRegex = /(import|export)[\s\S]*?from\s+['"](\.[^'"]*)['"]/g;

/**
 * Recursively finds all TypeScript files in a directory
 */
async function findTypeScriptFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir);

  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    
    const entryPath = path.join(dir, entry);
    const entryStat = await fs.stat(entryPath);
    
    if (entryStat.isDirectory()) {
      const nestedFiles = await findTypeScriptFiles(entryPath);
      files.push(...nestedFiles);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      files.push(entryPath);
    }
  }
  
  return files;
}

/**
 * Fixes imports in a file
 */
async function fixImports(filePath) {
  console.log(`Processing ${filePath}`);
  let content = await fs.readFile(filePath, 'utf8');
  let modified = false;

  // Replace imports without extensions
  const newContent = content.replace(importRegex, (match, importKeyword, importPath) => {
    // Skip if it already has an extension
    if (importPath.endsWith('.js')) {
      return match;
    }
    
    modified = true;
    const newPath = `${importPath}.js`;
    return match.replace(importPath, newPath);
  });

  if (modified) {
    await fs.writeFile(filePath, newContent, 'utf8');
    console.log(`  Updated imports in ${filePath}`);
  }
}

async function main() {
  try {
    const sourceDir = path.resolve(__dirname, '../src');
    console.log(`Finding TypeScript files in ${sourceDir}`);
    
    const files = await findTypeScriptFiles(sourceDir);
    console.log(`Found ${files.length} TypeScript files`);
    
    for (const file of files) {
      await fixImports(file);
    }
    
    console.log('Import fixes completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();