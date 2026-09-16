// Central route table. Deep-linkable; direct navigation and refresh work via SPA fallback.
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./Shell";
import { useApp } from "./AppProvider";

import TodayPage from "@/features/today/TodayPage";
import TasksPage from "@/features/tasks/TasksPage";
import TaskDetailPage from "@/features/tasks/TaskDetailPage";
import TaskForm from "@/features/tasks/TaskForm";
import ProjectPage from "@/features/project/ProjectPage";
import CalendarPage from "@/features/calendar/CalendarPage";
import MeetingsPage from "@/features/meetings/MeetingsPage";
import MeetingDetailPage from "@/features/meetings/MeetingDetailPage";
import MeetingForm from "@/features/meetings/MeetingForm";
import InboxPage from "@/features/inbox/InboxPage";
import InboxNewPage from "@/features/inbox/InboxNewPage";
import ReportsPage from "@/features/reports/ReportsPage";
import ReportDetailPage from "@/features/reports/ReportDetailPage";
import LearningPage from "@/features/learning/LearningPage";
import LearningModulePage from "@/features/learning/LearningModulePage";
import SupportPage from "@/features/support/SupportPage";
import SupportDetailPage from "@/features/support/SupportDetailPage";
import SupportForm from "@/features/support/SupportForm";
import DocumentsPage from "@/features/documents/DocumentsPage";
import TeamPage from "@/features/team/TeamPage";
import IntegrationsPage from "@/features/integrations/IntegrationsPage";
import SettingsPage from "@/features/settings/SettingsPage";
import SearchPage from "@/features/search/SearchPage";
import MorePage from "@/features/more/MorePage";
import NotFoundPage from "@/features/NotFoundPage";
import LiveConfigPage from "@/features/liveconfig/LiveConfigPage";
import WaygoOwnerDashboard from "@/features/waygo/WaygoOwnerDashboard";
import WaygoHotelsPage from "@/features/waygo/WaygoHotelsPage";
import WaygoHotelDetailPage from "@/features/waygo/WaygoHotelDetailPage";
import WaygoQrPrintPage from "@/features/waygo/WaygoQrPrintPage";
import WaygoOutreachDashboard from "@/features/waygo/WaygoOutreachDashboard";
import WaygoRedirectPage from "@/features/waygo/WaygoRedirectPage";

function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell routes={children} />;
}

export function AppRoutes() {
  const { repo, loading, error, t } = useApp();
  const loc = useLocation();

  // Live mode with missing/invalid config → honest configuration screen (never demo fallback).
  if (repo?.mode === "supabase") {
    // handled inside SupabaseRepository.ready(); errors surface via error state
  }

  if (loading) {
    return <div className="page" role="status" aria-live="polite"><div className="empty-state">{t.loading}</div></div>;
  }

  if (error && !repo) {
    return <LiveConfigPage message={error} />;
  }

  return (
    <Routes location={loc}>
      <Route element={<Shell><TodayPage /></Shell>} path="/" />
      {/* Waygo engine */}
      <Route element={<Shell><WaygoOwnerDashboard /></Shell>} path="/waygo" />
      <Route element={<Shell><WaygoHotelsPage /></Shell>} path="/waygo/hotels" />
      <Route element={<Shell><WaygoHotelDetailPage /></Shell>} path="/waygo/hotels/:hotelId" />
      <Route element={<WaygoQrPrintPage />} path="/waygo/hotels/:hotelId/qr" />
      <Route element={<Shell><WaygoOutreachDashboard /></Shell>} path="/waygo/outreach" />
      <Route element={<WaygoRedirectPage />} path="/r/:slug" />
      <Route element={<Shell><TasksPage /></Shell>} path="/tasks" />
      <Route element={<Shell><TaskForm /></Shell>} path="/tasks/new" />
      <Route element={<Shell><TaskDetailPage /></Shell>} path="/tasks/:taskId" />
      <Route element={<Shell><ProjectPage /></Shell>} path="/projects/:projectId" />
      <Route element={<Shell><CalendarPage /></Shell>} path="/calendar" />
      <Route element={<Shell><MeetingsPage /></Shell>} path="/meetings" />
      <Route element={<Shell><MeetingForm /></Shell>} path="/meetings/new" />
      <Route element={<Shell><MeetingDetailPage /></Shell>} path="/meetings/:meetingId" />
      <Route element={<Shell><InboxPage /></Shell>} path="/inbox" />
      <Route element={<Shell><InboxNewPage /></Shell>} path="/inbox/new" />
      <Route element={<Shell><ReportsPage /></Shell>} path="/reports" />
      <Route element={<Shell><ReportDetailPage /></Shell>} path="/reports/:reportId" />
      <Route element={<Shell><LearningPage /></Shell>} path="/learning" />
      <Route element={<Shell><LearningModulePage /></Shell>} path="/learning/:moduleId" />
      <Route element={<Shell><SupportPage /></Shell>} path="/support" />
      <Route element={<Shell><SupportForm /></Shell>} path="/support/new" />
      <Route element={<Shell><SupportDetailPage /></Shell>} path="/support/:ticketId" />
      <Route element={<Shell><DocumentsPage /></Shell>} path="/documents" />
      <Route element={<Shell><TeamPage /></Shell>} path="/team" />
      <Route element={<Shell><IntegrationsPage /></Shell>} path="/integrations" />
      <Route element={<Shell><SettingsPage /></Shell>} path="/settings" />
      <Route element={<Shell><SearchPage /></Shell>} path="/search" />
      <Route element={<Shell><MorePage /></Shell>} path="/more" />
      <Route element={<Shell><NotFoundPage /></Shell>} path="*" />
    </Routes>
  );
}

export { Navigate };
