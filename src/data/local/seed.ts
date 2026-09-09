// Demo dataset — seeded ONCE per data version into IndexedDB.
// Reference date is stored; deadlines are anchored relative to it and then FROZEN,
// so reloads never shift due dates or resurrect deleted records.
// Personas use example.invalid; names of extra personas are generic. The demo
// transcript is explicitly fictionalized/sanitized.
import type {
  ActivityEvent, CalendarEvent, Decision, DocumentRecord, InboxItem, Label,
  Meeting, MeetingActionProposal, Notification, Person, Project, Report,
  ReportSchedule, SupportTicket, SupportUpdate, Task, TaskChecklistItem,
  TaskComment, TaskTemplate, TrainingModule, TrainingProgress, TranscriptSegment,
  Workstream,
} from "@/domain/types";
import { addDaysDateOnly, localInputToInstant, TZ_PRAGUE } from "@/lib/dates";
import { DEFAULT_CLOCK } from "@/lib/dates";

export const SEED_VERSION = 3;

// Deterministic demo IDs (stable across resets).
const ids = {
  oliver: "d1000000-0000-4000-8000-000000000001",
  lead: "d1000000-0000-4000-8000-000000000002", // Project Lead persona
  member1: "d1000000-0000-4000-8000-000000000003", // Petra (team member)
  member2: "d1000000-0000-4000-8000-000000000004", // Honza (team member)
  member3: "d1000000-0000-4000-8000-000000000005", // generic member
  member4: "d1000000-0000-4000-8000-000000000006", // generic member
  viewer: "d1000000-0000-4000-8000-000000000007", // read-only viewer
  project: "d2000000-0000-4000-8000-000000000001",
  wsDigital: "d3000000-0000-4000-8000-000000000001",
  wsCoord: "d3000000-0000-4000-8000-000000000002",
  wsFinance: "d3000000-0000-4000-8000-000000000003",
  wsLegal: "d3000000-0000-4000-8000-000000000004",
  wsLogistics: "d3000000-0000-4000-8000-000000000005",
  wsProduct: "d3000000-0000-4000-8000-000000000006",
  labelTraining: "d4000000-0000-4000-8000-000000000001",
  labelSetup: "d4000000-0000-4000-8000-000000000002",
  labelContract: "d4000000-0000-4000-8000-000000000003",
  labelReporting: "d4000000-0000-4000-8000-000000000004",
  labelProcurement: "d4000000-0000-4000-8000-000000000005",
  labelUrgent: "d4000000-0000-4000-8000-000000000006",
  meeting1: "d5000000-0000-4000-8000-000000000001",
  meeting2: "d5000000-0000-4000-8000-000000000002",
  meeting3: "d5000000-0000-4000-8000-000000000003",
  support1: "d6000000-0000-4000-8000-000000000001",
  support2: "d6000000-0000-4000-8000-000000000002",
  support3: "d6000000-0000-4000-8000-000000000003",
  report1: "d7000000-0000-4000-8000-000000000001",
  report2: "d7000000-0000-4000-8000-000000000002",
} as const;

export const DEMO_PERSONA_IDS = [ids.oliver, ids.lead, ids.member1, ids.viewer];

export function buildSeed(now = DEFAULT_CLOCK()) {
  const nowIso = now.toISOString();
  const todayPrague = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_PRAGUE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const T = todayPrague;
  const at = (days: number) => addDaysDateOnly(T, days);

  const people: Person[] = [
    { id: ids.oliver, name: "Oliver", email: "oliver@example.invalid", initials: "OL", role: "it_coordinator", tz: TZ_PRAGUE },
    { id: ids.lead, name: "Vedoucí projektu", email: "project.lead@example.invalid", initials: "VP", role: "project_lead", tz: TZ_PRAGUE },
    { id: ids.member1, name: "Petra", email: "petra@example.invalid", initials: "PE", role: "member", tz: TZ_PRAGUE },
    { id: ids.member2, name: "Honza", email: "honza@example.invalid", initials: "HO", role: "member", tz: TZ_PRAGUE },
    { id: ids.member3, name: "Krištof", email: "kristof@example.invalid", initials: "KR", role: "member", tz: TZ_PRAGUE },
    { id: ids.member4, name: "Tereza", email: "tereza@example.invalid", initials: "TE", role: "member", tz: "Pacific/Port_Moresby" },
    { id: ids.viewer, name: "Petr (jen čtení)", email: "petr@example.invalid", initials: "PT", role: "viewer", tz: TZ_PRAGUE },
  ];

  const project: Project = {
    id: ids.project,
    name: "Papua-Nová Guinea — projekt nemocnice",
    nameEn: "Papua New Guinea — Hospital Project",
    description:
      "Koordinační pracoviště pro přípravu a realizaci dodávky lůžek a příslušenství do nemocnice v Papui-Nové Guineji. " +
      "Sledujeme koordinační úkoly, dokumenty a školení — nikoli klinické záznamy ani platební operace. " +
      "Projektový kontext pochází z interní porady; neověřené údaje (rozpočet, termín otevření) záměrně neuvádíme.",
    sourceOfTruth: "standalone",
    timezone: TZ_PRAGUE,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const workstreams: Workstream[] = [
    { id: ids.wsDigital, projectId: ids.project, name: "Digitalizace & IT", nameEn: "Digitalization & IT", description: "Základní školení, Teams, Copilot, sdílené složky, IT požadavky." },
    { id: ids.wsCoord, projectId: ids.project, name: "Koordinace projektu", nameEn: "Project Coordination", description: "Porady, reporting, rozhodnutí, komunikace s partnery." },
    { id: ids.wsFinance, projectId: ids.project, name: "Finance", nameEn: "Finance", description: "Uzávěrky, rozpočtová koordinace." },
    { id: ids.wsLegal, projectId: ids.project, name: "Právní", nameEn: "Legal", description: "NDA, smlouvy, Compliance kontrola." },
    { id: ids.wsLogistics, projectId: ids.project, name: "Nákup & logistika", nameEn: "Procurement & Logistics", description: "Dodavatelé, tendry, přeprava, celní odbavení." },
    { id: ids.wsProduct, projectId: ids.project, name: "Architektura & produkt", nameEn: "Architecture & Product", description: "Produktová konfigurace, technická dokumentace." },
  ];

  const labels: Label[] = [
    { id: ids.labelTraining, projectId: ids.project, name: "Školení", color: "brand" },
    { id: ids.labelSetup, projectId: ids.project, name: "Zřízení / přístupy", color: "brand" },
    { id: ids.labelContract, projectId: ids.project, name: "Smlouvy", color: "brand" },
    { id: ids.labelReporting, projectId: ids.project, name: "Reporting", color: "brand" },
    { id: ids.labelProcurement, projectId: ids.project, name: "Nákup", color: "brand" },
    { id: ids.labelUrgent, projectId: ids.project, name: "Pozor – priorita", color: "warning" },
  ];

  const mkTask = (
    n: number, o: Partial<Task>
  ): Task => {
    const id = `d8000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    return {
      id, projectId: ids.project, workstreamId: null, labelIds: [],
      title: "", description: "", status: "todo",
      statusNote: null, ownerId: null, createdBy: ids.lead, dueDate: null,
      lifecycle: "active", completedAt: null, completedBy: null, source: "manual",
      sourceRef: null, sourceUrl: null, version: 1, createdAt: nowIso, updatedAt: nowIso,
      ...o,
    };
  };

  // ~30 tasks anchored relative to stored reference date; mix of states.
  const tasks: Task[] = [
    // --- Digitalization & training (M01) ---
    mkTask(1, { title: "Základní školení Teams — uspořádat a zapsat termíny", workstreamId: ids.wsDigital, labelIds: [ids.labelTraining], ownerId: ids.oliver, dueDate: at(3), description: "Praktické školení pro celý tým: Teams, kanály, správné sdílení složek, Q&A. Reusable pro onboarding." }),
    mkTask(2, { title: "Inventory existujících Planner plánů a jejich obsazení", workstreamId: ids.wsDigital, ownerId: ids.member1, dueDate: at(-4), status: "in_progress", description: "Seznam stávajících Planner plánů, kdo je používá, co v nich je. Podklad pro rozhodnutí, co zůstane v Planneru." }),
    mkTask(3, { title: "Napsat jednoduchá provozní pravidla pro sdílené složky", workstreamId: ids.wsDigital, labelIds: [ids.labelTraining], ownerId: ids.oliver, dueDate: at(6) }),
    mkTask(4, { title: "Vyřešit přístup ke Copilot licencím pro projektový tým", workstreamId: ids.wsDigital, labelIds: [ids.labelSetup, ids.labelUrgent], ownerId: ids.oliver, dueDate: at(-2), status: "blocked", statusNote: "Čeká na odpověď LINET IT k dostupnosti licencí (podpora ticket #S1)." }),
    mkTask(5, { title: "Krátký přehled „AI/Copilot bezpečně“ pro kolegy", workstreamId: ids.wsDigital, labelIds: [ids.labelTraining], ownerId: ids.oliver, dueDate: at(9), status: "todo" }),
    mkTask(6, { title: "Onboarding checklist vyzkoušet na novém kolegovi", workstreamId: ids.wsDigital, labelIds: [ids.labelTraining], ownerId: ids.member1, dueDate: at(12) }),
    mkTask(7, { title: "Sdílet příklady předchozích prací a první návrh (balíček pro vedení)", workstreamId: ids.wsCoord, ownerId: ids.oliver, dueDate: at(4), description: "Příklady realizací + koncept jednoduchého pracovníka úkolů. Termín je ilustrativní z porady, ne potvrzený smluvní termín." }),
    // --- Coordination ---
    mkTask(8, { title: "Týdenní review — otevřít společný seznam úkolů", workstreamId: ids.wsCoord, labelIds: [ids.labelReporting], ownerId: ids.lead, dueDate: at(1), description: "Probíráme: letošní týden, zpožděné položky, příští týden. Seznam jako živá data, ne screenshot." }),
    mkTask(9, { title: "Založit evidenci rozhodnutí projektu (decision register)", workstreamId: ids.wsCoord, ownerId: ids.lead, dueDate: at(2) }),
    mkTask(10, { title: "Dohodnout NDA / smluvní balíček s právním", workstreamId: ids.wsLegal, labelIds: [ids.labelContract], ownerId: ids.member2, dueDate: at(5), status: "in_progress", description: "Navazuje na slíbené zaslání NDA podkladů ze strany vedení. Stav je z porady; ověřit aktuálnost." }),
    mkTask(11, { title: "Zpracovat zprávu o stavu projektu pro vedení", workstreamId: ids.wsCoord, labelIds: [ids.labelReporting], ownerId: ids.lead, dueDate: at(2) }),
    mkTask(12, { title: "Aktualizovat seznam účastníků a kontaktů na eskalaci", workstreamId: ids.wsCoord, ownerId: ids.lead, dueDate: at(-7), status: "waiting", statusNote: "Čekáme na oficiální kontakty z LINET IT (dojednání z porady)." }),
    // --- Finance ---
    mkTask(13, { title: "Uzavřít měsíční finance — kontrola položek projektu", workstreamId: ids.wsFinance, labelIds: [ids.labelReporting], ownerId: ids.member3, dueDate: at(4) }),
    mkTask(14, { title: "Připravit rozpočtovou strukturu pro sledování nákladů", workstreamId: ids.wsFinance, ownerId: ids.member3, dueDate: at(10) }),
    // --- Legal ---
    mkTask(15, { title: "Kontrola smlouvy s dodavatelem přepravy — právní revize", workstreamId: ids.wsLegal, labelIds: [ids.labelContract], ownerId: ids.member2, dueDate: at(-3), status: "in_progress" }),
    mkTask(16, { title: "Zmapovat požadavky na certifikace/dokumentaci pro PNG", workstreamId: ids.wsLegal, ownerId: ids.member2, dueDate: at(15) }),
    // --- Logistics ---
    mkTask(17, { title: "Tender na přepravu — připravit podklady", workstreamId: ids.wsLogistics, labelIds: [ids.labelProcurement], ownerId: ids.member4, dueDate: at(7) }),
    mkTask(18, { title: "Zjistit celní požadavky pro dovoz zdravotnických prostředků", workstreamId: ids.wsLogistics, ownerId: ids.member4, dueDate: at(-1), status: "waiting", statusNote: "Čekáme na odpověď celního zástupce." }),
    mkTask(19, { title: "Nacenit varianty přepravy (letecká × námořní)", workstreamId: ids.wsLogistics, labelIds: [ids.labelProcurement], ownerId: ids.member4, dueDate: null }),
    mkTask(20, { title: "Sjednat schůzku s dopravcem", workstreamId: ids.wsLogistics, ownerId: ids.member4, dueDate: at(-6), status: "done", completedAt: nowIso, completedBy: ids.member4 }),
    // --- Product ---
    mkTask(21, { title: "Produktová konfigurace lůžek — doplnit technické listy", workstreamId: ids.wsProduct, ownerId: ids.member3, dueDate: at(8), status: "in_progress" }),
    mkTask(22, { title: "Ověřit kompatibilitu příslušenství s konfigurací", workstreamId: ids.wsProduct, ownerId: ids.member1, dueDate: at(11) }),
    mkTask(23, { title: "Vytvořit 3D vizualizaci pro prezentaci", workstreamId: ids.wsProduct, ownerId: ids.member1, dueDate: at(-9), status: "done", completedAt: nowIso, completedBy: ids.member1 }),
    // --- review-case tasks ---
    mkTask(24, { title: "Vzorek eml s požadavkem na nabídku (z inboxu)", workstreamId: ids.wsLogistics, ownerId: null, dueDate: null, source: "email_capture", status: "todo" }),
    mkTask(25, { title: "Dohledat potenciální duplicitu kalendář/úkol", workstreamId: ids.wsCoord, ownerId: ids.member2, dueDate: at(2), description: "Kalendářový záznam i úkol pro totéž — rozhodnout, co je zdrojem pravdy." }),
    mkTask(26, { title: "Připravit workstation možnosti pro tým na místě", workstreamId: ids.wsDigital, labelIds: [ids.labelSetup], ownerId: ids.member1, dueDate: at(5), description: "Vedení slíbilo zaslat dostupné varianty workstationů. Následně vyhodnotit; paměť „48/64“ je neověřený požadavek, ne schválená specifikace." }),
    mkTask(27, { title: "Objednat velký monitor pro Olivera (slíbená podpora vedení)", workstreamId: ids.wsDigital, labelIds: [ids.labelSetup], ownerId: ids.lead, dueDate: at(6) }),
    mkTask(28, { title: "Zjistit termín a rozsah dvoutýdenní cesty do PNG", workstreamId: ids.wsCoord, ownerId: ids.lead, dueDate: null, description: "Z porady: cesta byla zmíněna, konkrétní termín nebyl stanoven. Nedohadovat termín bez potvrzení." }),
    mkTask(29, { title: "Vyrovnat papierové seznamy kolegů do systému (asistovaně)", workstreamId: ids.wsCoord, ownerId: ids.member1, dueDate: at(13), description: "Trpělivě, bez tlaku — někteří kolegové preferují papír. Navrhovat postupné převádění." }),
    mkTask(30, { title: "Starší položka: aktualizovat projektový plán po poradě", workstreamId: ids.wsCoord, ownerId: ids.lead, dueDate: at(-14), status: "todo" }),
    // completed + archived samples
    mkTask(31, { title: "Vyzkoušet forward e-mailu do sběrné adresy (test)", workstreamId: ids.wsDigital, ownerId: ids.oliver, dueDate: at(-5), status: "done", completedAt: nowIso, completedBy: ids.oliver, source: "email_capture" }),
    mkTask(32, { title: "Archivovaný úkol — starý poptávkový dotaz", workstreamId: ids.wsLogistics, ownerId: ids.member4, dueDate: at(-20), lifecycle: "archived", status: "todo" }),
  ];

  const checklist: TaskChecklistItem[] = [
    { id: "d9000000-0000-4000-8000-000000000001", taskId: tasks[0].id, title: "Rezervovat meeting room / Teams call", position: 0, done: true, doneAt: nowIso, doneBy: ids.oliver },
    { id: "d9000000-0000-4000-8000-000000000002", taskId: tasks[0].id, title: "Připravit agendu a příklady", position: 1, done: false, doneAt: null, doneBy: null },
    { id: "d9000000-0000-4000-8000-000000000003", taskId: tasks[0].id, title: "Odeslat pozvánku celému týmu", position: 2, done: false, doneAt: null, doneBy: null },
    { id: "d9000000-0000-4000-8000-000000000004", taskId: tasks[10].id, title: "Návrh (draft)", position: 0, done: true, doneAt: nowIso, doneBy: ids.member2 },
    { id: "d9000000-0000-4000-8000-000000000005", taskId: tasks[10].id, title: "Interní revize", position: 1, done: false, doneAt: null, doneBy: null },
    { id: "d9000000-0000-4000-8000-000000000006", taskId: tasks[10].id, title: "Schválení protistranou", position: 2, done: false, doneAt: null, doneBy: null },
    { id: "d9000000-0000-4000-8000-000000000007", taskId: tasks[10].id, title: "Podepsáno", position: 3, done: false, doneAt: null, doneBy: null },
    { id: "d9000000-0000-4000-8000-000000000008", taskId: tasks[17].id, title: "Sjednat požadavky s nákupem", position: 0, done: false, doneAt: null, doneBy: null },
    { id: "d9000000-0000-4000-8000-000000000009", taskId: tasks[17].id, title: "Srovnat min. 3 nabídky", position: 1, done: false, doneAt: null, doneBy: null },
  ];

  const comments: TaskComment[] = [
    { id: "da000000-0000-4000-8000-000000000001", taskId: tasks[3].id, authorId: ids.member1, body: "Copilot by hodně pomohl u překladů dokumentace. Držím palce u IT.", createdAt: nowIso },
    { id: "da000000-0000-4000-8000-000000000002", taskId: tasks[3].id, authorId: ids.oliver, body: "Ticket u LINET IT je založený, čekám na odpověď. Ref: SND-2026-0114 (illustrativní).", createdAt: nowIso },
  ];

  const templates: TaskTemplate[] = [
    { id: "db000000-0000-4000-8000-000000000001", projectId: ids.project, name: "Uzavření měsíce (finance)", description: "Standardní koordinační kroky uzávěrky.", checklist: [{ title: "Kontrola faktur projektu" }, { title: "Souhlas s položkami" }, { title: "Uzavřít v systému" }] },
    { id: "db000000-0000-4000-8000-000000000002", projectId: ids.project, name: "Příprava smlouvy", description: "Draft → interní revize → schválení protistranou → podepsáno.", checklist: [{ title: "Návrh (draft)" }, { title: "Interní revize" }, { title: "Schválení protistranou" }, { title: "Podepsáno" }] },
    { id: "db000000-0000-4000-8000-000000000003", projectId: ids.project, name: "Koordinace dodavatele/tenderu", description: "Postup pro tendry a dodavatele.", checklist: [{ title: "Sjednat požadavky" }, { title: "Srovnat min. 3 nabídky" }, { title: "Vyhodnotit a doporučit" }, { title: "Smluvní balíček k revizi" }] },
    { id: "db000000-0000-4000-8000-000000000004", projectId: ids.project, name: "Logistika — sledování", description: "Kontrola přepravy a odbavení.", checklist: [{ title: "Potvrdit Incoterms" }, { title: "Rezervovat přepravu" }, { title: "Sledovat celní odbavení" }] },
    { id: "db000000-0000-4000-8000-000000000005", projectId: ids.project, name: "IT přístup — žádost", description: "Zřízení přístupu s ohledem na oficiální ticket.", checklist: [{ title: "Zjistit, co je potřeba" }, { title: "Založit oficiální ticket pod vlastním loginem" }, { title: "Zapsat referenci do appky" }, { title: "Sledovat do vyřešení" }] },
  ];

  const events: CalendarEvent[] = [
    { id: "dc000000-0000-4000-8000-000000000001", projectId: ids.project, kind: "deadline_marker", title: "Uzavření měsíce", dateMode: "date_only", start: at(4), end: null, durationMin: null, allDay: true, timezone: TZ_PRAGUE, linkedTaskId: tasks[12].id, location: null, meetingId: null, createdAt: nowIso, updatedAt: nowIso },
    { id: "dc000000-0000-4000-8000-000000000002", projectId: ids.project, kind: "focus_block", title: "Fokus: smlouva s dopravcem", dateMode: "timed", start: localInputToInstant(`${at(1)}T09:00`, TZ_PRAGUE), end: null, durationMin: 90, allDay: false, timezone: TZ_PRAGUE, linkedTaskId: tasks[14].id, location: null, meetingId: null, createdAt: nowIso, updatedAt: nowIso },
    { id: "dc000000-0000-4000-8000-000000000003", projectId: ids.project, kind: "meeting", title: "Týdenní projektové review", dateMode: "timed", start: localInputToInstant(`${at(1)}T08:30`, TZ_PRAGUE), end: null, durationMin: 60, allDay: false, timezone: TZ_PRAGUE, linkedTaskId: null, location: "Teams", meetingId: ids.meeting3, createdAt: nowIso, updatedAt: nowIso },
    { id: "dc000000-0000-4000-8000-000000000004", projectId: ids.project, kind: "meeting", title: "Pracovní porada — digitální základy", dateMode: "timed", start: localInputToInstant(`${at(-6)}T09:00`, TZ_PRAGUE), end: null, durationMin: 120, allDay: false, timezone: TZ_PRAGUE, linkedTaskId: null, location: "zasedačka", meetingId: ids.meeting1, createdAt: nowIso, updatedAt: nowIso },
    { id: "dc000000-0000-4000-8000-000000000005", projectId: ids.project, kind: "focus_block", title: "Fokus: PNG celní požadavky", dateMode: "timed", start: localInputToInstant(`${at(2)}T14:00`, TZ_PRAGUE), end: null, durationMin: 60, allDay: false, timezone: TZ_PRAGUE, linkedTaskId: tasks[17].id, location: null, meetingId: null, createdAt: nowIso, updatedAt: nowIso },
    { id: "dc000000-0000-4000-8000-000000000006", projectId: ids.project, kind: "meeting", title: "Přehled dodavatelů (nadváha)", dateMode: "timed", start: localInputToInstant(`${at(-13)}T10:00`, TZ_PRAGUE), end: null, durationMin: 45, allDay: false, timezone: TZ_PRAGUE, linkedTaskId: null, location: "Teams", meetingId: ids.meeting2, createdAt: nowIso, updatedAt: nowIso },
  ];

  const inbox: InboxItem[] = [
    {
      id: "dd000000-0000-4000-8000-000000000001", projectId: ids.project, kind: "email",
      capturedById: ids.lead, isPrivateDraft: false,
      title: "Fw: Žádost o nabídku — příslušenství lůžek",
      body: `From: nákup@example.invalid\nTo: projekty@example.invalid\nSubject: Žádost o nabídku — příslušenství lůžek\nDate: ${at(-1)}\n\nDobrý den,\n\nprosím o nabídku na příslušenství k lůžkům pro nemocnici (bočnice, stolečky, držáky infuzních stojanů). Termín dodání by byl do konce příštího měsíce.\n\nDěkuji.\n\nJana Nováková, nákup`,
      sourceMessageId: "<sample-1@example.invalid>", fingerprint: "seed-email-1",
      state: "unprocessed", createdTaskId: null, createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: "dd000000-0000-4000-8000-000000000002", projectId: ids.project, kind: "note",
      capturedById: ids.member2, isPrivateDraft: true,
      title: "Poznámka: zeptat se na pojištění přepravy",
      body: "Z kedlobby: řešili jsme, jestli přeprava má celní pojištění. Ověřit u právního.",
      sourceMessageId: null, fingerprint: "seed-note-1",
      state: "unprocessed", createdTaskId: null, createdAt: nowIso, updatedAt: nowIso,
    },
  ];

  // Fictionalized demo transcript (sanitized; deliberately includes action-like lines,
  // an ownerless action, and relative dates requiring confirmation).
  const transcriptSegments: TranscriptSegment[] = [
    { id: "de000000-0000-4000-8000-000000000001", meetingId: ids.meeting1, position: 0, speaker: "Vedoucí", startMs: 0, endMs: 14200, text: "Dobrá, tak shrňme, kde jsme. Nejdřív potřebujeme, aby zvládli Teams a ty složky, teprv pak něco složitějšího." },
    { id: "de000000-0000-4000-8000-000000000002", meetingId: ids.meeting1, position: 1, speaker: "Oliver", startMs: 14200, endMs: 30000, text: "Jo, základní školení udělám. Připravím i Q&A a pravidla pro sdílení složek." },
    { id: "de000000-0000-4000-8000-000000000003", meetingId: ids.meeting1, position: 2, speaker: "Vedoucí", startMs: 30000, endMs: 48000, text: "Dobře. Ať to celé máme v jednom systému, ať každý vidí, co má." },
    { id: "de000000-0000-4000-8000-000000000004", meetingId: ids.meeting1, position: 3, speaker: "Petra", startMs: 48000, endMs: 66000, text: "V Planneru máme tři plány. Zkontroluju, kdo je používá a co v nich je." },
    { id: "de000000-0000-4000-8000-000000000005", meetingId: ids.meeting1, position: 4, speaker: "Oliver", startMs: 66000, endMs: 90000, text: "Také by se hodil přístup ke Copilotovi. Založím na to ticket." },
    { id: "de000000-0000-4000-8000-000000000006", meetingId: ids.meeting1, position: 5, speaker: null, startMs: 90000, endMs: 104000, text: "Domluvili jsme se, že příští týden projdeme celý seznam úkolů." },
    { id: "de000000-0000-4000-8000-000000000007", meetingId: ids.meeting1, position: 6, speaker: "Vedoucí", startMs: 104000, endMs: 120000, text: "A ještě — Oliver, pošli do pěti dnů příklady předchozích prací a první návrh." },
    { id: "de000000-0000-4000-8000-000000000008", meetingId: ids.meeting1, position: 7, speaker: "Vedoucí", startMs: 120000, endMs: 138000, text: "Zpracuji NDA a seznámím Olivera s lidmi z IT." },
  ];

  const meetings: Meeting[] = [
    { id: ids.meeting1, projectId: ids.project, workstreamId: ids.wsDigital, title: "Pracovní porada — digitální základy", startsAt: localInputToInstant(`${at(-6)}T09:00`, TZ_PRAGUE), durationMin: 120, participants: [ids.oliver, ids.lead, ids.member1], agenda: "1) Trénink základů 2) Planner stav 3) Copilot přístup 4) další kroky", status: "in_review", notesSummary: "", publishedNotes: null, hasTranscript: true, createdAt: nowIso, updatedAt: nowIso },
    { id: ids.meeting2, projectId: ids.project, workstreamId: ids.wsLogistics, title: "Přehled dodavatelů", startsAt: localInputToInstant(`${at(-13)}T10:00`, TZ_PRAGUE), durationMin: 45, participants: [ids.lead, ids.member4], agenda: "Stav tendru, termíny", status: "notes_published", notesSummary: "Srovnali jsme tři dodavatele přepravy. Rozhodnutí o variantě přesunuto na příští review.", publishedNotes: "Srovnali jsme tři dodavatele přepravy. Rozhodnutí o variantě přesunuto na příští review.", hasTranscript: false, createdAt: nowIso, updatedAt: nowIso },
    { id: ids.meeting3, projectId: ids.project, workstreamId: ids.wsCoord, title: "Týdenní projektové review", startsAt: localInputToInstant(`${at(1)}T08:30`, TZ_PRAGUE), durationMin: 60, participants: [ids.oliver, ids.lead, ids.member1, ids.member2], agenda: "Přejít přes společný seznam: tento týden, zpožděné, příští týden.", status: "planned", notesSummary: "", publishedNotes: null, hasTranscript: false, createdAt: nowIso, updatedAt: nowIso },
  ];

  const proposals: MeetingActionProposal[] = [
    {
      id: "df000000-0000-4000-8000-000000000001", meetingId: ids.meeting1,
      sourceActionKey: "demo-m1-p1",
      evidenceText: "Jo, základní školení udělám. Připravím i Q&A a pravidla pro sdílení složek.",
      evidenceSegmentId: "de000000-0000-4000-8000-000000000002", startMs: 14200, endMs: 30000,
      proposedTitle: "Základní školení Teams — uspořádat a zapsat termíny",
      proposedOwnerId: ids.oliver, proposedDueDate: null,
      extractionMethod: "deterministic_helper", state: "needs_review", createdTaskId: null,
      acceptedAt: null, createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: "df000000-0000-4000-8000-000000000002", meetingId: ids.meeting1,
      sourceActionKey: "demo-m1-p2",
      evidenceText: "Domluvili jsme se, že příští týden projdeme celý seznam úkolů.",
      evidenceSegmentId: "de000000-0000-4000-8000-000000000006", startMs: 90000, endMs: 104000,
      proposedTitle: "Projít celý seznam úkolů", proposedOwnerId: null, proposedDueDate: null,
      extractionMethod: "deterministic_helper", state: "needs_review", createdTaskId: null,
      acceptedAt: null, createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: "df000000-0000-4000-8000-000000000003", meetingId: ids.meeting1,
      sourceActionKey: "demo-m1-p3",
      evidenceText: "A ještě — Oliver, pošli do pěti dnů příklady předchozích prací a první návrh.",
      evidenceSegmentId: "de000000-0000-4000-8000-000000000007", startMs: 104000, endMs: 120000,
      proposedTitle: "Sdílet příklady předchozích prací a první návrh", proposedOwnerId: ids.oliver,
      proposedDueDate: null, // relative "5 days" requires human confirmation — left empty
      extractionMethod: "deterministic_helper", state: "needs_review", createdTaskId: null,
      acceptedAt: null, createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: "df000000-0000-4000-8000-000000000004", meetingId: ids.meeting1,
      sourceActionKey: "demo-m1-p4",
      evidenceText: "V Planneru máme tři plány. Zkontroluju, kdo je používá a co v nich je.",
      evidenceSegmentId: "de000000-0000-4000-8000-000000000004", startMs: 48000, endMs: 66000,
      proposedTitle: "Inventory existujících Planner plánů a jejich obsazení",
      proposedOwnerId: ids.member1, proposedDueDate: null,
      extractionMethod: "deterministic_helper", state: "accepted",
      createdTaskId: tasks[1].id, acceptedAt: nowIso, createdAt: nowIso, updatedAt: nowIso,
    },
  ];

  const decisions: Decision[] = [
    { id: "e1000000-0000-4000-8000-000000000001", projectId: ids.project, title: "Základní digitální školení před implementací", text: "Tým nejdřív projde praktickým školením Teams/složek/AI; teprve potom se zavádí složitější systémy.", decidedOn: at(-6), decisionMakerId: ids.lead, sourceMeetingId: ids.meeting1, relatedTaskIds: [tasks[0].id], supersededBy: null, createdAt: nowIso, updatedAt: nowIso },
    { id: "e1000000-0000-4000-8000-000000000002", projectId: ids.project, title: "Jeden společný systém úkolů", text: "Projektová práce se eviduje v jednom společném systému, nikoli roztroušeně v Planneru/Excelu/papírech.", decidedOn: at(-6), decisionMakerId: ids.lead, sourceMeetingId: ids.meeting1, relatedTaskIds: [], supersededBy: null, createdAt: nowIso, updatedAt: nowIso },
    { id: "e1000000-0000-4000-8000-000000000003", projectId: ids.project, title: "Přístup ke Copilotovi", text: "Požádáme LINET IT o licence Copilot pro projektový tým.", decidedOn: at(-6), decisionMakerId: ids.lead, sourceMeetingId: ids.meeting1, relatedTaskIds: [tasks[3].id], supersededBy: null, createdAt: nowIso, updatedAt: nowIso },
  ];

  const reports: Report[] = [
    {
      id: ids.report1, projectId: ids.project, kind: "weekly",
      periodStart: at(-13), periodEnd: at(-7), timezone: TZ_PRAGUE,
      generatedAt: nowIso, status: "published",
      filtersSummary: "Celý projekt / all workstreams",
      commentary: "Převažovala příprava školení a evidence. Zpoždění u Copilot licencí blokuje AI školení.",
      items: [
        { kind: "completed", taskId: tasks[19].id, decisionId: null, title: tasks[19].title, detail: null, ownerId: ids.member4, dueDate: tasks[19].dueDate },
        { kind: "overdue", taskId: tasks[11].id, decisionId: null, title: tasks[11].title, detail: "Čekáme na oficiální kontakty z LINET IT", ownerId: ids.lead, dueDate: tasks[11].dueDate },
        { kind: "blocker", taskId: tasks[3].id, decisionId: null, title: tasks[3].title, detail: "Blokováno na LINET IT", ownerId: ids.oliver, dueDate: tasks[3].dueDate },
      ],
      createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: ids.report2, projectId: ids.project, kind: "daily",
      periodStart: T, periodEnd: T, timezone: TZ_PRAGUE,
      generatedAt: nowIso, status: "draft",
      filtersSummary: "Dnes / today",
      commentary: "",
      items: [
        { kind: "upcoming", taskId: tasks[7].id, decisionId: null, title: tasks[7].title, detail: null, ownerId: ids.lead, dueDate: tasks[7].dueDate },
      ],
      createdAt: nowIso, updatedAt: nowIso,
    },
  ];

  const schedules: ReportSchedule[] = [
    { id: "e2000000-0000-4000-8000-000000000001", projectId: ids.project, kind: "weekly", cadence: "weekly", timezone: TZ_PRAGUE, sendAtLocal: "08:00", channel: "in_app", recipients: [], enabled: false, lastRunAt: null, createdAt: nowIso, updatedAt: nowIso },
  ];

  const modules: TrainingModule[] = [
    {
      id: "teams-collab", slug: "teams-collab", title: "Spolupráce v Microsoft Teams", titleEn: "Collaborating in Microsoft Teams",
      objective: "Zvládnout kanály, vlákna, soubory a meetingy v Teams tak, aby to šlo použít hned.", objectiveEn: "Use channels, threads, files and meetings in Teams well enough to work immediately.",
      content: [
        { heading: "Kanály a vlákna", body: "Kanál = téma (např. Projekt PNG). Vlákno = jedna otázka či téma. Napiš odpověď do vlákna, ne do kanálu — kolegové se pak snáz vyznají." },
        { heading: "Soubory", body: "Soubor v Teams sdílej odkazem na složku v SharePointu, ne přílohou ve zprávě. Každý pak vidí jednu aktuální verzi." },
        { heading: "Meetingy", body: "Pozvánku posílá z meetingu v Teams; záznam a přepis se objeví v kanálu. Přepis je dobrý podklad pro poznámky." },
      ],
      contentEn: [
        { heading: "Channels and threads", body: "Channel = topic (e.g. PNG project). Thread = one question. Reply in the thread, not the channel — colleagues keep orientation." },
        { heading: "Files", body: "Share a link to the folder in SharePoint, not a message attachment. Everyone sees one current version." },
        { heading: "Meetings", body: "Invite from the Teams meeting; recording and transcript appear in the channel. A transcript is good source material for notes." },
      ],
      example: "Petra nahraje draft cenové nabídky do složky \\Projekt PNG\\Nabídky a odkáže na ni ve vlákně „Příslušenství“.",
      exampleEn: "Petra uploads a draft quote to \\PNG Project\\Quotes and links it in the \"Accessories\" thread.",
      checklist: [
        { id: "c1", title: "Napsat zprávu do vlákna v kanálu projektu", titleEn: "Post a message in a project channel thread" },
        { id: "c2", title: "Sdílet odkaz na soubor ze sdílené složky", titleEn: "Share a link to a file from the shared folder" },
        { id: "c3", title: "Připojit se ke schůzce z kalendáře Teams", titleEn: "Join a meeting from the Teams calendar" },
      ],
      estimatedMinutes: 10, contentOwner: "Oliver", reviewStatus: "in_review", version: 1, isOnboardingPath: true,
    },
    {
      id: "copilot-basics", slug: "copilot-basics", title: "AI/Copilot základy a bezpečné použití", titleEn: "AI/Copilot basics and safe use",
      objective: "Chápat, k čemu Copilot slouží, co do něj psát smí a co ne.", objectiveEn: "Understand what Copilot is for, what may be typed into it and what may not.",
      content: [
        { heading: "K čemu to je", body: "Copilot pomáhá s formulacemi, shrnutími a prvními verzemi textů. Vhodné např. pro shrnutí dlouhého e-mailu nebo přípravu agendy." },
        { heading: "Co do něj nepatří", body: "Osobní údaje pacientů, přístupové údaje, smluvní tajemství a citlivé osobní údaje kolegů. Když si nejste jisti, položte otázku bez citlivého obsahu." },
        { heading: "Přístup", body: "Licence jsou spravovány přes LINET IT. Žádost podává uživatel ticketem pod vlastním přihlášením; potvrzení přepošle koordinátorovi, který ji dořeší." },
      ],
      contentEn: [
        { heading: "What it is for", body: "Copilot helps with wording, summaries and first drafts, e.g. summarizing a long email or preparing an agenda." },
        { heading: "What does not belong", body: "Patient personal data, access credentials, contract secrets and colleagues' sensitive personal data. When unsure, ask without the sensitive content." },
        { heading: "Access", body: "Licenses are managed by LINET IT. A user requests via a ticket under their own login; the confirmation is forwarded to the coordinator who follows it through." },
      ],
      example: "Shrnutí 20 e-mailů z minulého týdne do 5 bodů pro review — Copilot to zvládne za vás, ale kontrolu dělá člověk.",
      exampleEn: "Summarize 20 emails from last week into 5 points for a review — Copilot drafts it, a human checks it.",
      checklist: [
        { id: "c1", title: "Vyzkoušet jeden bezpečný prompt (bez citlivých údajů)", titleEn: "Try one safe prompt (no sensitive data)" },
        { id: "c2", title: "Najít interní pravidla pro AI použití", titleEn: "Locate internal AI usage guidance" },
        { id: "c3", title: "Vědět, jak žádat o Copilot licenci", titleEn: "Know how to request a Copilot license" },
      ],
      estimatedMinutes: 10, contentOwner: "Oliver", reviewStatus: "in_review", version: 1, isOnboardingPath: true,
    },
    {
      id: "file-sharing", slug: "file-sharing", title: "Správné sdílení souborů a složek", titleEn: "Correct file and folder sharing",
      objective: "Sdílet soubory přes odkazy na správné místo, s správnými právy.", objectiveEn: "Share files via links to the right location with correct permissions.",
      content: [
        { heading: "Jedno místo pravdy", body: "Každý dokument má jedno domovské umístění. Odkazujte na něj, ne na kopie v přílohách." },
        { heading: "Práva", body: "Sdílejte se skupinou/týmem, ne s jednotlivci, kde to jde. Změna složení týmu pak nezpůsobí ztrátu přístupu." },
        { heading: "Pojmenování", body: "Název souboru má být srozumitelný: „PNG_smlouva_dodavatel_v2.docx“, nikoli „dokument(3).docx“." },
      ],
      contentEn: [
        { heading: "One source of truth", body: "Every document has one home location. Link to it, not to attachment copies." },
        { heading: "Permissions", body: "Share with a group/team rather than individuals where possible. Team changes then do not break access." },
        { heading: "Naming", body: "File names should be meaningful: \"PNG_supplier_contract_v2.docx\", not \"document(3).docx\"." },
      ],
      example: "Složka \\Projekt PNG\\Právní obsahuje NDA; odkaz na ni půjde do tasku „Dohodnout NDA“ místo posílání příloh.",
      exampleEn: "The \\PNG Project\\Legal folder holds the NDA; link it in the \"Agree NDA\" task instead of sending attachments.",
      checklist: [
        { id: "c1", title: "Najít hlavní sdílenou složku projektu", titleEn: "Locate the project's main shared folder" },
        { id: "c2", title: "Vytvořit odkaz se správnými právy", titleEn: "Create a link with correct permissions" },
      ],
      estimatedMinutes: 8, contentOwner: "Oliver", reviewStatus: "in_review", version: 1, isOnboardingPath: true,
    },
    {
      id: "task-workflow", slug: "task-workflow", title: "Jednoduchý úkolový workflow", titleEn: "The simple task workflow",
      objective: "Zapsat úkol za 10 sekund, doplnit detaily později, jeden klik k dokončení.", objectiveEn: "Capture a task in 10 seconds, add details later, complete in one tap.",
      content: [
        { heading: "Zápis", body: "Přidat → název → (volitelně majitel, termín) → Uložit. Popis a štítky klidně dodatečně." },
        { heading: "Stavy", body: "K dispozici / Rozpracováno / Čeká / Blokováno / Hotovo. U Čeká/Blokováno vyplňte krátký důvod — pomůže to při review." },
        { heading: "Dokončení", body: "Jedno klepnutí dokončí úkol; akci lze vrátit zpět (Undo). Dokončený úkol není „zpožděný“." },
      ],
      contentEn: [
        { heading: "Capture", body: "Add → title → (optionally owner, date) → Save. Description and labels can come later." },
        { heading: "Statuses", body: "To do / In progress / Waiting / Blocked / Done. Add a short reason for Waiting/Blocked — it helps the review." },
        { heading: "Completion", body: "One tap completes; Undo restores. A completed task is never \"overdue\"." },
      ],
      example: "Z Champions League přijde nápad „zjistit celní sazebník“ → přidat → hotovo za 5 s, detail doplní Honza.",
      exampleEn: "An idea like \"check the customs tariff\" → Add → done in 5 s; details come later.",
      checklist: [
        { id: "c1", title: "Vytvořit první úkol", titleEn: "Create your first task" },
        { id: "c2", title: "Dokončit úkol jedním klepnutím", titleEn: "Complete a task with one tap" },
      ],
      estimatedMinutes: 6, contentOwner: "Oliver", reviewStatus: "in_review", version: 1, isOnboardingPath: true,
    },
    {
      id: "weekly-review", slug: "weekly-review", title: "Týdenní review a zápis z porad", titleEn: "Weekly review and meeting capture",
      objective: "Vést review nad skutečným seznamem úkolů a převádět porady na akce.", objectiveEn: "Run reviews over the real task list and turn meetings into actions.",
      content: [
        { heading: "Review rituál", body: "Jednou týdně: tento týden → zpožděné → čekající → příští týden. Vždy s otevřeným seznamem úkolů." },
        { heading: "Z porady do úkolu", body: "Přepis/diktát → návrhy akcí → schválení → úkol s odkazem na zdroj. Nikdy ne ručně opisovat, když to jde kliknutím." },
        { heading: "Kde se co dozvím", body: "Odkaz na zdroj (segment přepisu) zůstává u úkolu — každý vidí, odkud úkol pochází." },
      ],
      contentEn: [
        { heading: "Review ritual", body: "Once a week: this week → overdue → waiting → next week. Always with the real task list open." },
        { heading: "Meeting to task", body: "Transcript/dictation → action proposals → approval → task linked to its source. Never retype when a link exists." },
        { heading: "Provenance", body: "The source link (transcript segment) stays with the task — everyone sees where it came from." },
      ],
      example: "Z porady: „Petra, zkontroluj Planner“ → návrh akce → Schválit → úkol s důkazem z přepisu.",
      exampleEn: "From a meeting: \"Petra, check Planner\" → proposal → Approve → task with transcript evidence.",
      checklist: [
        { id: "c1", title: "Zúčastnit se jednoho review", titleEn: "Attend one review" },
        { id: "c2", title: "Schválit jednu akci z porady", titleEn: "Approve one meeting action" },
      ],
      estimatedMinutes: 8, contentOwner: "Oliver", reviewStatus: "in_review", version: 1, isOnboardingPath: true,
    },
    {
      id: "it-help", slug: "it-help", title: "Jak žádat o IT pomoc", titleEn: "How to get IT help",
      objective: "Vědět, jak správně žádat o přístupy, hardware a podporu.", objectiveEn: "Know how to correctly request access, hardware and support.",
      content: [
        { heading: "Oficiální cesta", body: "Žádosti na přístupy/hardware/VPN se zakládají jako oficiální ticket pod vlastním přihlášením uživatele. Tato aplikace není oficiální service desk." },
        { heading: "Koordinace", body: "Potvrzení o založení ticketu přepošlete koordinátorovi (Oliver). Ten sleduje stav až do vyřešení — vidíte to v sekci Podpora." },
        { heading: "Kdy založit ticket", body: "Přístup, Copilot, Teams, VPN, hardware, školení. U spěchových věcí vždy uveďte vliv na projekt." },
      ],
      contentEn: [
        { heading: "The official path", body: "Access/hardware/VPN requests are filed as an official ticket under the user's own login. This app is not the official service desk." },
        { heading: "Coordination", body: "Forward the ticket confirmation to the coordinator (Oliver). He follows it to resolution — visible in the Support section." },
        { heading: "When to file", body: "Access, Copilot, Teams, VPN, hardware, training. For urgent matters state the impact on the project." },
      ],
      example: "Petra potřebuje VPN přístup → založí oficiální ticket → přepošle potvrzení Oliverovi → Oliver eviduje a dořeší.",
      exampleEn: "Petra needs VPN → files the official ticket → forwards the confirmation to Oliver → Oliver tracks and follows through.",
      checklist: [
        { id: "c1", title: "Vědět, kde zakládat oficiální ticket", titleEn: "Know where to file the official ticket" },
        { id: "c2", title: "Vytvořit koordinační požadavek v aplikaci", titleEn: "Create a coordination request in the app" },
      ],
      estimatedMinutes: 5, contentOwner: "Oliver", reviewStatus: "in_review", version: 1, isOnboardingPath: true,
    },
  ];

  const trainingProgress: TrainingProgress[] = [
    { moduleId: "teams-collab", personId: ids.member1, state: "completed", checklistDone: ["c1", "c2", "c3"], completedAt: nowIso, updatedAt: nowIso },
    { moduleId: "task-workflow", personId: ids.member1, state: "in_progress", checklistDone: ["c1"], completedAt: null, updatedAt: nowIso },
    { moduleId: "teams-collab", personId: ids.member2, state: "in_progress", checklistDone: ["c1"], completedAt: null, updatedAt: nowIso },
  ];

  const supportTickets: SupportTicket[] = [
    {
      id: ids.support1, projectId: ids.project, title: "Copilot licence pro projektový tým",
      category: "copilot", description: "Požádáme o licenci Copilot pro 3 členy projektového týmu. Ticket založen pod vlastním loginem, potvrzení přeposláno.",
      requesterId: ids.oliver, coordinatorId: ids.oliver, status: "with_linet_it", impact: "high",
      officialTicketRef: "SND-2026-0114 (ilustrační)", followUpDate: at(1), attachmentNames: [], createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: ids.support2, projectId: ids.project, title: "VPN přístup pro práci z domu",
      category: "vpn", description: "Nastavení VPN pro vzdálenou práci. Čeká na vyřízení.",
      requesterId: ids.member1, coordinatorId: ids.oliver, status: "awaiting_official_ticket", impact: "medium",
      officialTicketRef: null, followUpDate: at(2), attachmentNames: [], createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: ids.support3, projectId: ids.project, title: "Velký monitor — objednávka",
      category: "hardware", description: "Podpora vedení slíbila velký monitor. Zjišťujeme konkrétní model.",
      requesterId: ids.oliver, coordinatorId: null, status: "captured", impact: "low",
      officialTicketRef: null, followUpDate: null, attachmentNames: [], createdAt: nowIso, updatedAt: nowIso,
    },
  ];

  const supportUpdates: SupportUpdate[] = [
    { id: "e3000000-0000-4000-8000-000000000001", ticketId: ids.support1, authorId: ids.oliver, body: "Ticket SND-2026-0114 založen a přeposlán potvrzením LINET IT. Čekáme na přiřazení.", visibleToRequester: true, createdAt: nowIso },
    { id: "e3000000-0000-4000-8000-000000000002", ticketId: ids.support2, authorId: ids.member1, body: "Petra: založím ticket dnes odpoledne.", visibleToRequester: true, createdAt: nowIso },
  ];

  const documents: DocumentRecord[] = [
    { id: "e4000000-0000-4000-8000-000000000001", projectId: ids.project, title: "Pravidla sdílených složek (návrh)", category: "procedure", description: "Jak pojmenovávat a sdílet soubory projektu.", ownerId: ids.oliver, updatedAt: nowIso, workstreamId: ids.wsDigital, url: null, localSample: true, content: "# Pravidla sdílených složek (návrh)\n\n- Jedno domovské umístění pro každý dokument\n- Sdílet odkazy se skupinou, ne s jednotlivci\n- Názvy: PNG_predmet_verze\n- Citlivé dokumenty jen v složce Právní s omezeným přístupem\n\nStav: návrh, čeká na schválení." },
    { id: "e4000000-0000-4000-8000-000000000002", projectId: ids.project, title: "Zaškolení — Teams (prezentace)", category: "training", description: "Materiály pro základní školení Teams.", ownerId: ids.oliver, updatedAt: nowIso, workstreamId: ids.wsDigital, url: null, localSample: true, content: "# Teams — základní školení\n\n## Kanály a vlákna\n- Kanál = téma, vlákno = jedna otázka\n- Odpovídej ve vlákně\n\n## Soubory\n- Odkaz na složku, ne přílohu\n\n## Meetingy\n- Záznam a přepis v kanálu — využij pro poznámky" },
    { id: "e4000000-0000-4000-8000-000000000003", projectId: ids.project, title: "Poznámky z porady — digitální základy", category: "meeting_notes", description: "Publikované poznámky z porady 1.", ownerId: ids.lead, updatedAt: nowIso, workstreamId: ids.wsCoord, url: null, localSample: true, content: "# Poznámky z porady — digitální základy\n\n- Základní školení před implementací (rozhodnuto)\n- Planner inventory — Petra\n- Copilot přístup — ticket na LINET IT\n- Oliver pošle příklady a první návrh" },
    { id: "e4000000-0000-4000-8000-000000000004", projectId: ids.project, title: "Seznam eskalačních kontaktů (bude doplněn)", category: "reference", description: "Oficiální kontakty na LINET IT čekají na doplnění.", ownerId: ids.lead, updatedAt: nowIso, workstreamId: null, url: null, localSample: true, content: "# Eskalační kontakty\n\nStav: čekáme na oficiální kontakty z LINET IT. \nBude doplněno po dohodnutí (nevyhazovat staré). " },
  ];

  const notifications: Notification[] = [
    { id: "e5000000-0000-4000-8000-000000000001", personId: ids.oliver, kind: "assigned", title: "Nově přiřazeno", body: "Vzorek eml s požadavkem na nabídku je nepřiřazen — zvažte přiřazení.", destination: "/tasks", readAt: null, dedupeKey: "seed-n1", createdAt: nowIso },
    { id: "e5000000-0000-4000-8000-000000000002", personId: ids.oliver, kind: "support", title: "Podpora: Copilot licence", body: "Ticket u LINET IT — následná kontrola tento týden.", destination: `/support/${ids.support1}`, readAt: null, dedupeKey: "seed-n2", createdAt: nowIso },
    { id: "e5000000-0000-4000-8000-000000000003", personId: ids.lead, kind: "deadline", title: "Termín blíží", body: "Týdenní review je naplánováno na zítra.", destination: "/calendar", readAt: null, dedupeKey: "seed-n3", createdAt: nowIso },
  ];

  const activity: ActivityEvent[] = [
    { id: "e6000000-0000-4000-8000-000000000001", taskId: tasks[3].id, meetingId: null, supportTicketId: null, projectId: ids.project, actorId: ids.oliver, kind: "task.blocked", summary: "Úkol zablokován: čeká na LINET IT", detail: "Copilot licence", createdAt: nowIso },
    { id: "e6000000-0000-4000-8000-000000000002", taskId: tasks[19].id, meetingId: null, supportTicketId: null, projectId: ids.project, actorId: ids.member4, kind: "task.completed", summary: "Úkol dokončen", detail: null, createdAt: nowIso },
  ];

  return {
    people, project, workstreams, labels, tasks, checklist, comments, templates,
    events, inbox, meetings, transcriptSegments, proposals, decisions, reports,
    schedules, modules, trainingProgress, supportTickets, supportUpdates,
    documents, notifications, activity,
    referenceDate: T,
  };
}

export type SeedData = ReturnType<typeof buildSeed>;
export const SEED_IDS = ids;
