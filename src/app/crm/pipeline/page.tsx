'use client';

import { LeadsKanbanBoard } from './_components/LeadsKanbanBoard';

export default function PipelinePage() {
  return (
    <div className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8">
      <LeadsKanbanBoard />
    </div>
  );
}
