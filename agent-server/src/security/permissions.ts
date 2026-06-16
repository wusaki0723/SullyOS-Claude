import { config } from '../config.js';
import type { PermissionPreset } from '../types.js';

export function resolveAllowedTools(preset: PermissionPreset | undefined, requestedTools: string[] = []): string[] {
  if (!config.enableBuiltinTools) return [];

  if (preset === 'read-only-tools') {
    return config.enableWebSearch ? ['WebSearch', 'WebFetch'] : [];
  }

  if (preset === 'custom-tools') {
    return requestedTools.filter((tool) => tool.startsWith('sully__'));
  }

  return [];
}

export function resolveBaseTools(allowedTools: string[]): string[] {
  if (!allowedTools.length) return [];

  const safe = new Set(allowedTools);
  if (!config.enableBash) safe.delete('Bash');
  if (!config.enableFileEdit) {
    safe.delete('Edit');
    safe.delete('Write');
    safe.delete('MultiEdit');
  }

  return Array.from(safe);
}
