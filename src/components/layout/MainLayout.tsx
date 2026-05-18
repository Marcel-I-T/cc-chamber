import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';
import { BottomDock } from './BottomDock';
import { BottomComposer } from './BottomComposer';
import { TerminalView } from '@/components/views/TerminalView';
import { ChatView } from '@/components/chat/ChatView';
import { useSessionStore } from '@/stores/useSessionStore';
import { IpcHealthBanner } from '@/components/IpcHealthBanner';
// FilesView retired — file tree now lives in RightSidebar.
import { SettingsView } from '@/components/views/SettingsView';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

export function MainLayout() {
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const isRightSidebarOpen = useUIStore((s) => s.isRightSidebarOpen);
  const activeMainTab = useUIStore((s) => s.activeMainTab);

  const activeId = useSessionStore((s) => s.activeId);
  const sessions = useSessionStore((s) => s.sessions);
  const active = sessions.find((s) => s.id === activeId);
  const viewMode = active?.viewMode ?? 'terminal';

  return (
    <div className="flex h-full w-full flex-col bg-bg text-fg">
      <Header />
      <IpcHealthBanner />
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'border-r border-border bg-bg-subtle transition-[width] duration-150',
            isSidebarOpen ? 'w-[260px]' : 'w-0 overflow-hidden'
          )}
        >
          <Sidebar />
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            {activeMainTab === 'terminal' &&
              (viewMode === 'chat' && active ? (
                <ChatView session={active} />
              ) : (
                <TerminalView />
              ))}
            {activeMainTab === 'settings' && <SettingsView />}
          </div>
          {activeMainTab === 'terminal' && <BottomComposer />}
          <BottomDock />
        </main>

        <aside
          className={cn(
            'border-l border-border bg-bg-subtle transition-[width] duration-150',
            isRightSidebarOpen ? 'w-[320px]' : 'w-0 overflow-hidden'
          )}
        >
          <RightSidebar />
        </aside>
      </div>
    </div>
  );
}
