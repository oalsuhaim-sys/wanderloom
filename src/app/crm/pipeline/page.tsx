'use client';

import { LeadsKanbanBoard } from './_components/LeadsKanbanBoard';

export default function PipelinePage() {
  return (
    <div className="max-w-full min-h-screen overflow-x-hidden bg-slate-50 p-4 transition-colors duration-300 dark:bg-[#151D1A] sm:p-6 lg:p-8">
      <LeadsKanbanBoard />
    </div>
  );
}
