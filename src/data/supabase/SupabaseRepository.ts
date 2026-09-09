// Supabase live repository — same contract as local demo. Only instantiated when
// VITE_DATA_MODE=supabase and VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set.
// Missing/invalid config surfaces as typed Not configured / error results; never
// falls back to demo data.
import type { DataSnapshot, WorkspaceRepository } from "@/data/contracts/repository";
import type { ServiceResult } from "@/domain/types";

export function createSupabaseRepository(): WorkspaceRepository {
  // validate required public config early so the "configuration screen" path works
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) {
    return new MissingConfigRepository("Live režim vyžaduje VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY (viz .env.example).");
  }
  return new MissingConfigRepository(
    "Supabase live repository — rozhraní připraveno, vyžaduje nakonfigurovaný Supabase projekt a autorizaci dle docs/INTEGRATIONS.md. Do nasazení a ověření zůstává plně funkční lokální demo (VITE_DATA_MODE=local)."
  );
}

class MissingConfigRepository implements WorkspaceRepository {
  readonly mode = "supabase" as const;
  constructor(private readonly msg: string) {}
  private notConfigured(): ServiceResult<never> {
    return { ok: false, error: { code: "not_configured", capability: "supabase", message: this.msg } };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async ready(): Promise<ServiceResult<null>> { return this.notConfigured() as ServiceResult<null>; }
  async loadSnapshot(): Promise<ServiceResult<DataSnapshot>> { return this.notConfigured() as ServiceResult<DataSnapshot>; }
  subscribe(): () => void { return () => undefined; }
  // All domain operations surface as not_configured — prevents silent demo fallback.
  private op(): Promise<ServiceResult<never>> { return Promise.resolve(this.notConfigured()); }
  createTask() { return this.op() as never; }
  updateTask() { return this.op() as never; }
  completeTask() { return this.op() as never; }
  reopenTask() { return this.op() as never; }
  archiveTask() { return this.op() as never; }
  restoreTask() { return this.op() as never; }
  deleteTask() { return this.op() as never; }
  duplicateTask() { return this.op() as never; }
  addChecklistItem() { return this.op() as never; }
  setChecklistItemDone() { return this.op() as never; }
  removeChecklistItem() { return this.op() as never; }
  addComment() { return this.op() as never; }
  createMeeting() { return this.op() as never; }
  updateMeeting() { return this.op() as never; }
  importTranscript() { return this.op() as never; }
  addProposal() { return this.op() as never; }
  updateProposal() { return this.op() as never; }
  approveProposal() { return this.op() as never; }
  createDecision() { return this.op() as never; }
  addInboxItem() { return this.op() as never; }
  updateInboxItem() { return this.op() as never; }
  createEvent() { return this.op() as never; }
  updateEvent() { return this.op() as never; }
  deleteEvent() { return this.op() as never; }
  createSupportTicket() { return this.op() as never; }
  updateSupportTicket() { return this.op() as never; }
  addSupportUpdate() { return this.op() as never; }
  createDocument() { return this.op() as never; }
  saveReport() { return this.op() as never; }
  updateReport() { return this.op() as never; }
  upsertSchedule() { return this.op() as never; }
  setTrainingProgress() { return this.op() as never; }
  markNotificationRead() { return this.op() as never; }
  markAllNotificationsRead() { return this.op() as never; }
  exportBackup() { return this.op() as never; }
  resetDemoData() { return this.op() as never; }
  integrationStatuses() {
    return [
      { id: "supabase" as const, state: "not_configured" as const, operations: [], lastCheck: null, message: this.msg },
      { id: "microsoft" as const, state: "not_configured" as const, operations: [], lastCheck: null, message: "Microsoft 365: nenakonfigurováno." },
      { id: "ai" as const, state: "not_configured" as const, operations: [], lastCheck: null, message: "AI: nenakonfigurováno." },
      { id: "mail" as const, state: "not_configured" as const, operations: [], lastCheck: null, message: "E-mail: nenakonfigurováno." },
    ];
  }
}
