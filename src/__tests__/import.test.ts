import { describe, expect, it } from 'vitest';
import { createDefaultProject, createBuiltinTemplates, DEFAULT_SETTINGS, DEFAULT_THEME_STATE } from '@/core/data/defaults';
import { buildBackup, parseBackup, parseProjectImport } from '@/core/store/io';

describe('import / export round-trip', () => {
  it('restores a project exported as JSON', () => {
    const project = createDefaultProject('往返测试');
    const text = JSON.stringify({ ...project, exportedAt: Date.now() }, null, 2);
    const parsed = parseProjectImport(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.projects).toHaveLength(1);
    expect(parsed!.projects[0].name).toBe('往返测试');
    expect(parsed!.projects[0].rules.length).toBeGreaterThan(0);
  });

  it('restores a full backup bundle', () => {
    const project = createDefaultProject('备份测试');
    const bundle = buildBackup({
      projects: [project],
      templates: createBuiltinTemplates(),
      theme: DEFAULT_THEME_STATE,
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseBackup(JSON.stringify(bundle, null, 2));
    expect(parsed).not.toBeNull();
    expect(parsed!.projects).toHaveLength(1);
    expect(parsed!.projects[0].name).toBe('备份测试');
    expect(parsed!.templates.length).toBeGreaterThan(0);
  });

  it('accepts a backup file through the project importer', () => {
    const project = createDefaultProject('混合导入');
    const bundle = buildBackup({
      projects: [project],
      templates: [],
      theme: DEFAULT_THEME_STATE,
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseProjectImport(JSON.stringify(bundle));
    expect(parsed?.projects[0].name).toBe('混合导入');
  });

  it('rejects a plain text file', () => {
    expect(parseProjectImport('not a json')).toBeNull();
    expect(parseBackup('not a json')).toBeNull();
  });
});
