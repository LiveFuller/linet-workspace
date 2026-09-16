// IndexedDB wrapper for demo mode. idb provides a typed thin layer.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  ActivityEvent, CalendarEvent, Decision, DocumentRecord, InboxItem, Label,
  Meeting, MeetingActionProposal, Notification, Person, Project, Report,
  ReportSchedule, SupportTicket, SupportUpdate, Task, TaskChecklistItem,
  TaskComment, TaskTemplate, TrainingModule, TrainingProgress, TranscriptSegment,
  Workstream,
} from "@/domain/types";
import type {
  WaygoHotel, WaygoReceptionCode, WaygoScan, WaygoBooking, WaygoOutreach, WaygoProvider,
} from "@/domain/waygo";

const DB_NAME = "linet-workspace";
const DB_VERSION = 2;

export interface WorkspaceDBSchema extends DBSchema {
  meta: { key: string; value: { key: string; value: unknown } };
  people: { key: string; value: Person };
  projects: { key: string; value: Project; indexes: { "by-project": string } };
  workstreams: { key: string; value: Workstream; indexes: { "by-project": string } };
  labels: { key: string; value: Label; indexes: { "by-project": string } };
  tasks: { key: string; value: Task; indexes: { "by-project": string } };
  checklistItems: { key: string; value: TaskChecklistItem; indexes: { "by-task": string } };
  comments: { key: string; value: TaskComment; indexes: { "by-task": string } };
  templates: { key: string; value: TaskTemplate; indexes: { "by-project": string } };
  events: { key: string; value: CalendarEvent; indexes: { "by-project": string } };
  inbox: { key: string; value: InboxItem; indexes: { "by-project": string } };
  meetings: { key: string; value: Meeting; indexes: { "by-project": string } };
  transcripts: { key: string; value: TranscriptSegment; indexes: { "by-meeting": string } };
  proposals: { key: string; value: MeetingActionProposal; indexes: { "by-meeting": string } };
  decisions: { key: string; value: Decision; indexes: { "by-project": string } };
  reports: { key: string; value: Report; indexes: { "by-project": string } };
  schedules: { key: string; value: ReportSchedule; indexes: { "by-project": string } };
  modules: { key: string; value: TrainingModule };
  trainingProgress: { key: [string, string]; value: TrainingProgress };
  supportTickets: { key: string; value: SupportTicket; indexes: { "by-project": string } };
  supportUpdates: { key: string; value: SupportUpdate; indexes: { "by-ticket": string } };
  documents: { key: string; value: DocumentRecord; indexes: { "by-project": string } };
  notifications: { key: string; value: Notification; indexes: { "by-person": string } };
  activity: { key: string; value: ActivityEvent; indexes: { "by-project": string } };
  attachments: { key: string; value: { id: string; parentId: string; name: string; mime: string; size: number; blob: Blob } };
  // Waygo engine
  waygoHotels: { key: string; value: WaygoHotel; indexes: { "by-project": string; "by-slug": string } };
  waygoCodes: { key: string; value: WaygoReceptionCode; indexes: { "by-hotel": string; "by-slug": string } };
  waygoScans: { key: string; value: WaygoScan; indexes: { "by-hotel": string; "by-slug": string } };
  waygoBookings: { key: string; value: WaygoBooking; indexes: { "by-hotel": string } };
  waygoOutreach: { key: string; value: WaygoOutreach; indexes: { "by-hotel": string; "by-project": string } };
  waygoProviders: { key: string; value: WaygoProvider; indexes: { "by-project": string } };
}

export type AppDB = IDBPDatabase<WorkspaceDBSchema>;

let dbPromise: Promise<AppDB> | null = null;

export function openWorkspaceDB(): Promise<AppDB> {
  if (!dbPromise) {
    dbPromise = openDB<WorkspaceDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion) {
        const create = (name: string, index?: { name: string; keyPath: string }, extraIndex?: { name: string; keyPath: string }) => {
          if (!db.objectStoreNames.contains(name as never)) {
            const store = db.createObjectStore(name as "people", { keyPath: "id" });
            if (index) store.createIndex(index.name as "by-project" as never, index.keyPath);
            if (extraIndex) store.createIndex(extraIndex.name as never, extraIndex.keyPath);
          }
        };
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        create("people");
        create("projects", { name: "by-project", keyPath: "projectId" });
        create("workstreams", { name: "by-project", keyPath: "projectId" });
        create("labels", { name: "by-project", keyPath: "projectId" });
        create("tasks", { name: "by-project", keyPath: "projectId" });
        create("checklistItems", { name: "by-task", keyPath: "taskId" });
        create("comments", { name: "by-task", keyPath: "taskId" });
        create("templates", { name: "by-project", keyPath: "projectId" });
        create("events", { name: "by-project", keyPath: "projectId" });
        create("inbox", { name: "by-project", keyPath: "projectId" });
        create("meetings", { name: "by-project", keyPath: "projectId" });
        create("transcripts", { name: "by-meeting", keyPath: "meetingId" });
        create("proposals", { name: "by-meeting", keyPath: "meetingId" });
        create("decisions", { name: "by-project", keyPath: "projectId" });
        create("reports", { name: "by-project", keyPath: "projectId" });
        create("schedules", { name: "by-project", keyPath: "projectId" });
        create("modules");
        create("supportTickets", { name: "by-project", keyPath: "projectId" });
        create("supportUpdates", { name: "by-ticket", keyPath: "ticketId" });
        create("documents", { name: "by-project", keyPath: "projectId" });
        create("activity", { name: "by-project", keyPath: "projectId" });
        create("notifications", { name: "by-person", keyPath: "personId" });
        if (!db.objectStoreNames.contains("trainingProgress")) {
          db.createObjectStore("trainingProgress", { keyPath: ["moduleId", "personId"] });
        }
        if (!db.objectStoreNames.contains("attachments")) {
          db.createObjectStore("attachments", { keyPath: "id" });
        }
        // Waygo v2 stores
        if (!db.objectStoreNames.contains("waygoHotels")) {
          const s = db.createObjectStore("waygoHotels", { keyPath: "id" });
          s.createIndex("by-project", "projectId");
          s.createIndex("by-slug", "slug");
        }
        if (!db.objectStoreNames.contains("waygoCodes")) {
          const s = db.createObjectStore("waygoCodes", { keyPath: "id" });
          s.createIndex("by-hotel", "hotelId");
          s.createIndex("by-slug", "slug");
        }
        if (!db.objectStoreNames.contains("waygoScans")) {
          const s = db.createObjectStore("waygoScans", { keyPath: "id" });
          s.createIndex("by-hotel", "hotelId");
          s.createIndex("by-slug", "slug");
        }
        if (!db.objectStoreNames.contains("waygoBookings")) {
          const s = db.createObjectStore("waygoBookings", { keyPath: "id" });
          s.createIndex("by-hotel", "hotelId");
        }
        if (!db.objectStoreNames.contains("waygoOutreach")) {
          const s = db.createObjectStore("waygoOutreach", { keyPath: "id" });
          s.createIndex("by-hotel", "hotelId");
          s.createIndex("by-project", "projectId");
        }
        if (!db.objectStoreNames.contains("waygoProviders")) {
          const s = db.createObjectStore("waygoProviders", { keyPath: "id" });
          s.createIndex("by-project", "projectId");
        }
      },
      blocked() { /* another tab holds an older version; will upgrade when it closes */ },
    });
  }
  return dbPromise;
}

export const STORES = [
  "people", "projects", "workstreams", "labels", "tasks", "checklistItems", "comments",
  "templates", "events", "inbox", "meetings", "transcripts", "proposals", "decisions",
  "reports", "schedules", "modules", "trainingProgress", "supportTickets",
  "supportUpdates", "documents", "notifications", "activity", "attachments",
  "waygoHotels", "waygoCodes", "waygoScans", "waygoBookings", "waygoOutreach", "waygoProviders",
] as const;

export type StoreName = (typeof STORES)[number];

export async function getAll<K extends StoreName>(db: AppDB, store: K) {
  return db.getAll(store);
}

export async function putAll<K extends StoreName>(db: AppDB, store: K, items: WorkspaceDBSchema[K]["value"][]) {
  const tx = db.transaction(store, "readwrite");
  await Promise.all([...items.map((i) => tx.store.put(i as never)), tx.done]);
}

export async function clearAllStores(db: AppDB) {
  const tx = db.transaction([...STORES, "meta"], "readwrite");
  await Promise.all([
    ...STORES.map((s) => tx.objectStore(s).clear()),
    tx.objectStore("meta").clear(),
    tx.done,
  ]);
}

export async function getMeta<T>(db: AppDB, key: string): Promise<T | undefined> {
  const rec = await db.get("meta", key);
  return rec?.value as T | undefined;
}

export async function setMeta(db: AppDB, key: string, value: unknown) {
  await db.put("meta", { key, value }, key);
}
