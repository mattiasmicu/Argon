#!/usr/bin/env node
/**
 * Script to fix import paths after component reorganization
 * Run with: node fix-imports.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, 'src');

// Import path mappings: old -> new
const IMPORT_MAPPINGS = [
  // Button imports
  {
    from: /from\s+['"]\.\.\/components\/animate-ui\/components\/buttons\/button['"]/g,
    to: `from '../components/Button'`
  },
  {
    from: /from\s+['"]\.\.\/components\/buttons\/button['"]/g,
    to: `from '../components/Button'`
  },
  {
    from: /from\s+['"]\.\.\/\.\.\/components\/buttons\/button['"]/g,
    to: `from '../../components/Button'`
  },
  {
    from: /from\s+['"]@\/components\/button-primitives\/button['"]/g,
    to: `from '@/components/Button'`
  },
  
  // Dialog imports
  {
    from: /from\s+['"]@\/components\/animate-ui\/components\/radix\/dialog['"]/g,
    to: `from '@/components/Dialog'`
  },
  {
    from: /from\s+['"]\.\.\/components\/radix\/dialog['"]/g,
    to: `from '../components/Dialog'`
  },
  {
    from: /from\s+['"]@\/components\/radix\/dialog['"]/g,
    to: `from '@/components/Dialog'`
  },
  
  // Files imports
  {
    from: /from\s+['"]\.\.\/components\/animate-ui\/components\/radix\/files['"]/g,
    to: `from '../components/Files'`
  },
  {
    from: /from\s+['"]\.\.\/components\/radix-primitives\/files['"]/g,
    to: `from '../components/Files'`
  },
  
  // DropdownMenu imports
  {
    from: /from\s+['"]\.\.\/components\/radix\/dropdown-menu['"]/g,
    to: `from '../components/DropdownMenu'`
  },
  {
    from: /from\s+['"]\.\.\/components\/dropdown-menu['"]/g,
    to: `from '../components/DropdownMenu'`
  },
  
  // Slot imports
  {
    from: /from\s+['"]@\/components\/animate-ui\/primitives\/animate\/slot['"]/g,
    to: `from '@/components/Slot'`
  },
  
  // cn utility - more relative paths
  {
    from: /from\s+['"]\.\.\.\.\.\.\/\.\.\/lib\/utils['"]/g,
    to: `from '@/lib/utils'`
  },
  {
    from: /from\s+['"]\.\.\.\.\.\.\/lib\/utils['"]/g,
    to: `from '@/lib/utils'`
  },
  {
    from: /from\s+['"]\.\.\/\.\.\/\.\.\/\.\.\/lib\/utils['"]/g,
    to: `from '@/lib/utils'`
  },
  {
    from: /from\s+['"]\.\.\/\.\.\/\.\.\/lib\/utils['"]/g,
    to: `from '@/lib/utils'`
  },
  {
    from: /from\s+['"]\.\.\/\.\.\/lib\/utils['"]/g,
    to: `from '@/lib/utils'`
  },
  
  // Button imports - more paths
  {
    from: /from\s+['"]\.\.\/animate-ui\/components\/buttons\/button['"]/g,
    to: `from '../Button'`
  },
  {
    from: /from\s+['"]\.\.\.\.\/animate-ui\/components\/buttons\/button['"]/g,
    to: `from '../../Button'`
  },
  {
    from: /from\s+['"]\.\/animate-ui\/components\/buttons\/button['"]/g,
    to: `from './Button'`
  },
  {
    from: /from\s+['"]\.\.\/store\/UseLauncherStore['"]/g,
    to: `from '../store/useLauncherStore'`
  },
  {
    from: /from\s+['"]\.\.\/\.\.\/store\/UseLauncherStore['"]/g,
    to: `from '../../store/useLauncherStore'`
  },
  {
    from: /from\s+['"]\.\/store\/UseLauncherStore['"]/g,
    to: `from './store/useLauncherStore'`
  },
  
  // SetupWizard -> AuthScreen
  {
    from: /from\s+['"]\.\.\/panels\/SetupWizard['"]/g,
    to: `from '../panels/AuthScreen'`
  },
  {
    from: /from\s+['"]\.\.\/\.\.\/panels\/SetupWizard['"]/g,
    to: `from '../../panels/AuthScreen'`
  },
  
  // Files imports - more animate-ui paths
  {
    from: /from\s+['"]@\/components\/animate-ui\/primitives\/radix\/files['"]/g,
    to: `from '@/components/Files'`
  },
  {
    from: /from\s+['"]\.\.\/components\/animate-ui\/primitives\/radix\/files['"]/g,
    to: `from '../components/Files'`
  },
  
  // DialogPrimitive circular imports
  {
    from: /from\s+['"]@\/components\/DialogPrimitive['"]/g,
    to: `from '@radix-ui/react-dialog'`
  },
];

// Files to skip
const SKIP_FILES = ['node_modules', '.git', 'dist', 'build'];

// File extensions to process
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  return EXTENSIONS.includes(ext) && !SKIP_FILES.some(skip => filePath.includes(skip));
}

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  for (const mapping of IMPORT_MAPPINGS) {
    if (mapping.from.test(content)) {
      content = content.replace(mapping.from, mapping.to);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Fixed imports in: ${path.relative(SRC_DIR, filePath)}`);
    return true;
  }
  
  return false;
}

function walkDirectory(dir) {
  let fixedCount = 0;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !SKIP_FILES.includes(entry.name)) {
      fixedCount += walkDirectory(fullPath);
    } else if (entry.isFile() && shouldProcessFile(fullPath)) {
      if (fixImportsInFile(fullPath)) {
        fixedCount++;
      }
    }
  }
  
  return fixedCount;
}

console.log('🔧 Fixing import paths...\n');

const fixedCount = walkDirectory(SRC_DIR);

console.log(`\n✅ Fixed imports in ${fixedCount} files`);
console.log('\nNext steps:');
console.log('1. Run: npm run dev (or your dev command)');
console.log('2. Check for any remaining import errors');
