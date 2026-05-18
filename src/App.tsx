import { useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useProjectsStore } from '@/stores/useProjectsStore';

export default function App() {
  const projects = useProjectsStore((s) => s.projects);
  const addProject = useProjectsStore((s) => s.addProject);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const setActiveProject = useProjectsStore((s) => s.setActive);

  // Bootstrap: ensure at least one project (Home) exists on first launch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (projects.length === 0) {
        const home = await window.api.app.homedir();
        if (cancelled) return;
        addProject(home, 'Home');
      } else if (!activeProjectId || !projects.find((p) => p.id === activeProjectId)) {
        setActiveProject(projects[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <MainLayout />;
}
