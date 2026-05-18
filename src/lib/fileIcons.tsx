import {
  FileCode,
  FileJson,
  FileText,
  FileType,
  FileImage,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  FolderGit2,
  Settings,
  Lock,
  Package,
  File,
  type LucideIcon,
} from 'lucide-react';

/**
 * Returns a Lucide icon + tailwind text-color class for a given filename.
 * Mirrors the OC file-tree where extensions are color-coded.
 */
export function iconFor(name: string, isDir: boolean):
  | { Icon: LucideIcon; color: string } {
  if (isDir) {
    if (name === '.git') return { Icon: FolderGit2, color: 'text-fg-muted' };
    if (name === 'node_modules') return { Icon: Folder, color: 'text-fg-subtle' };
    return { Icon: Folder, color: 'text-accent' };
  }

  const lower = name.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';

  // Special filenames
  if (lower === 'package.json' || lower === 'package-lock.json') {
    return { Icon: Package, color: 'text-err' };
  }
  if (lower === '.gitignore' || lower === '.gitattributes') {
    return { Icon: FileText, color: 'text-fg-muted' };
  }
  if (lower.startsWith('.env')) {
    return { Icon: Lock, color: 'text-warn' };
  }
  if (lower === 'readme.md') {
    return { Icon: FileText, color: 'text-blue-300' };
  }

  switch (ext) {
    case 'ts':
    case 'tsx':
      return { Icon: FileCode, color: 'text-blue-400' };
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return { Icon: FileCode, color: 'text-yellow-300' };
    case 'json':
      return { Icon: FileJson, color: 'text-yellow-200' };
    case 'md':
    case 'mdx':
      return { Icon: FileText, color: 'text-blue-300' };
    case 'css':
    case 'scss':
    case 'sass':
      return { Icon: FileCode, color: 'text-cyan-300' };
    case 'html':
      return { Icon: FileCode, color: 'text-orange-300' };
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return { Icon: FileImage, color: 'text-purple-300' };
    case 'yml':
    case 'yaml':
    case 'toml':
    case 'ini':
    case 'conf':
      return { Icon: Settings, color: 'text-fg-muted' };
    case 'csv':
    case 'xls':
    case 'xlsx':
      return { Icon: FileSpreadsheet, color: 'text-green-300' };
    case 'lock':
      return { Icon: Lock, color: 'text-fg-subtle' };
    case 'sh':
    case 'bash':
    case 'zsh':
      return { Icon: FileCode, color: 'text-green-400' };
    case 'py':
      return { Icon: FileCode, color: 'text-blue-400' };
    case 'rs':
      return { Icon: FileCode, color: 'text-orange-400' };
    case 'go':
      return { Icon: FileCode, color: 'text-cyan-400' };
    case 'sql':
      return { Icon: FileCode, color: 'text-pink-300' };
    default:
      return { Icon: File, color: 'text-fg-subtle' };
  }
}

export const FolderIconOpen = FolderOpen;
export const FolderIcon = Folder;
export const DefaultFileIcon: LucideIcon = FileType;
