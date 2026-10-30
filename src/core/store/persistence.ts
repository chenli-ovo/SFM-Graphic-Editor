import localforage from 'localforage';
import type { Project, Settings, Template, ThemeState } from '../types';
import type { SidebarTab } from './store';

export interface PersistedState {
  version: number;
  projects: Project[];
  activeProjectId: string;
  templates: Template[];
  theme: ThemeState;
  settings: Settings;
  sidebarTab: SidebarTab;
  sidebarCollapsed: boolean;
  savedAt: number;
}

const KEY = 'workspace-v1';
let db: LocalForage | null = null;

function storage(): LocalForage {
  if (!db) {
    db = localforage.createInstance({
      name: 'sfm-studio',
      storeName: 'workspace',
      description: 'SFM Studio local workspace (projects, tags, items, templates)',
    });
  }
  return db;
}

export async function loadWorkspace(): Promise<PersistedState | null> {
  try {
    const raw = await storage().getItem<PersistedState>(KEY);
    if (!raw || typeof raw !== 'object') return null;
    return raw;
  } catch (error) {
    console.warn('[SFM Studio] 无法读取本地工作区，将使用默认项目。', error);
    return null;
  }
}

export async function saveWorkspace(state: PersistedState): Promise<void> {
  try {
    await storage().setItem(KEY, state);
  } catch (error) {
    console.warn('[SFM Studio] 本地保存失败（可能是隐私模式或存储空间不足）。', error);
  }
}

export async function clearWorkspace(): Promise<void> {
  try {
    await storage().removeItem(KEY);
  } catch (error) {
    console.warn('[SFM Studio] 清空本地工作区失败。', error);
  }
}
