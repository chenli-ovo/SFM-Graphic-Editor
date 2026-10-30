import { useEffect, useState } from 'react';
import { applyTheme } from './core/data/themes';
import { startPersistence, useActiveProject, useStore } from './core/store/store';
import { setSoundEnabled } from './lib/audio';
import { readShareFromHash, type SharePayload } from './lib/share';
import { Layout } from './components/Layout';
import { ToastHost } from './components/ToastHost';
import { CommandPalette } from './components/CommandPalette';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import { HistoryDialog } from './components/dialogs/HistoryDialog';
import { AiDialog } from './components/dialogs/AiDialog';
import { SyntaxDialog } from './components/dialogs/SyntaxDialog';
import { ShareImportDialog } from './components/dialogs/ShareImportDialog';
import type { DialogKind, EditorPanelTab } from './components/TopBar';

export default function App() {
  const theme = useStore((state) => state.theme);
  const sound = useStore((state) => state.settings.sound);
  const project = useActiveProject();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [panel, setPanel] = useState<EditorPanelTab>('diagnostics');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  useEffect(() => {
    void startPersistence();
  }, []);

  // hydrate 之前先解析分享链接，弹窗在首屏渲染完成后再出现
  useEffect(() => {
    const read = () => {
      const payload = readShareFromHash(window.location.hash);
      if (payload) setSharePayload(payload);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setSoundEnabled(sound);
  }, [sound]);

  useEffect(() => {
    document.title = project ? `SFM Studio · ${project.name}` : 'SFM Studio';
  }, [project]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const inField =
        target instanceof Element &&
        Boolean(target.closest('input, textarea, select, [contenteditable="true"], .cm-editor'));
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if ((mod && key === 'k') || event.key === 'F1') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (inField) return;

      const store = useStore.getState();
      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      } else if (mod && key === 'y') {
        event.preventDefault();
        store.redo();
      } else if (mod && key === 's') {
        event.preventDefault();
        store.forceSyncFromCode();
      } else if (mod && key === 'e') {
        event.preventDefault();
        store.exportSfm();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <Layout
        onOpenDialog={(kind) => setDialog(kind)}
        onOpenPalette={() => setPaletteOpen(true)}
        panel={panel}
        onPanelChange={setPanel}
      />
      <ToastHost />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenDialog={(kind) => setDialog(kind)}
        onOpenPanel={(tab) => setPanel(tab)}
      />
      <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} />
      <HistoryDialog open={dialog === 'history'} onClose={() => setDialog(null)} />
      <AiDialog open={dialog === 'ai'} onClose={() => setDialog(null)} />
      <SyntaxDialog open={dialog === 'syntax'} onClose={() => setDialog(null)} />
      <ShareImportDialog payload={sharePayload} onClose={() => setSharePayload(null)} />
    </>
  );
}
