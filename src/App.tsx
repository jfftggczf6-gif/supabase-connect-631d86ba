import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import AiJobsLiveToast from "@/components/AiJobsLiveToast";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RequireSuperAdmin from "@/components/guards/RequireSuperAdmin";
import RequireRole from "@/components/guards/RequireRole";
import OrganizationsPage from "./pages/admin/OrganizationsPage";
import OrganizationDetailPage from "./pages/admin/OrganizationDetailPage";
import MeteringDashboard from "./pages/admin/MeteringDashboard";
import CandidatureRecoveryAdminPage from "./pages/admin/CandidatureRecoveryAdminPage";
import AddEntrepreneurAdminPage from "./pages/admin/AddEntrepreneurAdminPage";
import CandidatureRecovery from "./pages/CandidatureRecovery";
import MembersPage from "./pages/org/MembersPage";
import InvitationAcceptPage from "./pages/InvitationAcceptPage";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import SelectRole from "./pages/SelectRole";
import Dashboard from "./pages/Dashboard";
import Livrables from "./pages/Livrables";
import BmcModule from "./pages/modules/BmcModule";
import GenericModule from "./pages/modules/GenericModule";
import Templates from "./pages/Templates";
import DataRoomPublic from "./pages/DataRoomPublic";
import ProgrammeListPage from "./pages/ProgrammeListPage";
import ProgrammeCreatePage from "./pages/ProgrammeCreatePage";
import ProgrammeDetailPage from "./pages/ProgrammeDetailPage";
import ProgrammeFormPage from "./pages/ProgrammeFormPage";
import ProgrammeEnterprisePage from "./pages/ProgrammeEnterprisePage";
import PublicCandidatureForm from "./pages/PublicCandidatureForm";
import Settings from "./pages/Settings";
import KnowledgePage from "./pages/KnowledgePage";
import KnowledgeReviewPage from "./pages/admin/KnowledgeReviewPage";
import PeRequireType from "./components/pe/PeRequireType";
import PeWorkspacePage from "./pages/pe/PeWorkspacePage";
import PeCandidatureFormEditorPage from "./pages/pe/PeCandidatureFormEditorPage";
import PePipelinePage from "./pages/pe/PePipelinePage";
import PeDealDetailPage from "./pages/pe/PeDealDetailPage";
import PeTeamPage from "./pages/pe/PeTeamPage";
import PeLpReportingPage from "./pages/pe/PeLpReportingPage";
import DossierWorkspacePage from "./pages/banque/DossierWorkspacePage";
import BanquePipelinePage from "./pages/banque/BanquePipelinePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Composant interne pour utiliser le hook useAuth (besoin d'être dans AuthProvider)
function GlobalAiJobsToast() {
  const { user } = useAuth();
  return <AiJobsLiveToast userId={user?.id ?? null} />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <OrganizationProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/register" element={<Register />} />
            <Route path="/select-role" element={
              <ProtectedRoute><SelectRole /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/programmes" element={
              <ProtectedRoute><RequireRole roles={['owner', 'admin', 'manager', 'managing_director', 'investment_manager']}><ProgrammeListPage /></RequireRole></ProtectedRoute>
            } />
            <Route path="/programmes/new" element={
              <ProtectedRoute><RequireRole roles={['owner', 'admin', 'manager', 'managing_director', 'investment_manager']}><ProgrammeCreatePage /></RequireRole></ProtectedRoute>
            } />
            <Route path="/programmes/:id" element={
              <ProtectedRoute><RequireRole roles={['owner', 'admin', 'manager', 'managing_director', 'investment_manager']}><ProgrammeDetailPage /></RequireRole></ProtectedRoute>
            } />
            <Route path="/programmes/:id/form" element={
              <ProtectedRoute><RequireRole roles={['owner', 'admin', 'manager']}><ProgrammeFormPage /></RequireRole></ProtectedRoute>
            } />
            <Route path="/programmes/:id/enterprise/:enterpriseId" element={
              <ProtectedRoute><RequireRole roles={['owner', 'admin', 'manager', 'coach', 'analyst']}><ProgrammeEnterprisePage /></RequireRole></ProtectedRoute>
            } />
            <Route path="/pe" element={
              <ProtectedRoute><PeRequireType><PeWorkspacePage /></PeRequireType></ProtectedRoute>
            } />
            <Route path="/pe/candidature/:programmeId/edit" element={
              <ProtectedRoute><PeRequireType><PeCandidatureFormEditorPage /></PeRequireType></ProtectedRoute>
            } />
            <Route path="/pe/pipeline" element={
              <ProtectedRoute><PeRequireType><PePipelinePage /></PeRequireType></ProtectedRoute>
            } />
            <Route path="/pe/deals/:dealId" element={
              <ProtectedRoute><PeRequireType><PeDealDetailPage /></PeRequireType></ProtectedRoute>
            } />
            <Route path="/pe/team" element={
              <ProtectedRoute><PeRequireType><PeTeamPage /></PeRequireType></ProtectedRoute>
            } />
            <Route path="/pe/reporting-lp" element={
              <ProtectedRoute><PeRequireType><PeLpReportingPage /></PeRequireType></ProtectedRoute>
            } />
            <Route path="/candidature/:slug" element={<PublicCandidatureForm />} />
            <Route path="/candidature/recovery/:token" element={<CandidatureRecovery />} />
            <Route path="/livrables" element={
              <ProtectedRoute><Livrables /></ProtectedRoute>
            } />
            <Route path="/templates" element={
              <ProtectedRoute><Templates /></ProtectedRoute>
            } />
            <Route path="/module/bmc" element={
              <ProtectedRoute><BmcModule /></ProtectedRoute>
            } />
            <Route path="/module/:moduleCode" element={
              <ProtectedRoute><GenericModule /></ProtectedRoute>
            } />
            <Route path="/data-room/:slug" element={<DataRoomPublic />} />
            <Route path="/invitation/:token" element={<InvitationAcceptPage />} />
            <Route path="/admin/organizations" element={<ProtectedRoute><RequireSuperAdmin><OrganizationsPage /></RequireSuperAdmin></ProtectedRoute>} />
            <Route path="/admin/organizations/:id" element={<ProtectedRoute><RequireSuperAdmin><OrganizationDetailPage /></RequireSuperAdmin></ProtectedRoute>} />
            <Route path="/admin/metering" element={<ProtectedRoute><RequireSuperAdmin><MeteringDashboard /></RequireSuperAdmin></ProtectedRoute>} />
            <Route path="/admin/candidature-recovery" element={<ProtectedRoute><RequireSuperAdmin><CandidatureRecoveryAdminPage /></RequireSuperAdmin></ProtectedRoute>} />
            <Route path="/admin/add-entrepreneur" element={<ProtectedRoute><RequireSuperAdmin><AddEntrepreneurAdminPage /></RequireSuperAdmin></ProtectedRoute>} />
            <Route path="/admin/knowledge-review" element={<ProtectedRoute><RequireSuperAdmin><KnowledgeReviewPage /></RequireSuperAdmin></ProtectedRoute>} />
            <Route path="/organization/members" element={<ProtectedRoute><RequireRole roles={['owner', 'admin', 'manager', 'directeur_pme', 'direction_pme', 'directeur_agence', 'analyste_credit']}><MembersPage /></RequireRole></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/knowledge" element={<ProtectedRoute><KnowledgePage /></ProtectedRoute>} />
            <Route path="/banque/pipeline" element={
              <ProtectedRoute>
                <RequireRole roles={['owner','admin','manager','conseiller_pme','analyste_credit','directeur_pme','direction_pme','directeur_agence']}>
                  <BanquePipelinePage />
                </RequireRole>
              </ProtectedRoute>
            } />
            <Route path="/banque/dossiers/:id" element={
              <ProtectedRoute>
                <RequireRole roles={['owner','admin','manager','conseiller_pme','analyste_credit','directeur_pme','direction_pme','directeur_agence']}>
                  <DossierWorkspacePage />
                </RequireRole>
              </ProtectedRoute>
            } />
            <Route path="/banque/dossiers/:id/diagnostic" element={
              <ProtectedRoute>
                <RequireRole roles={['owner','admin','manager','conseiller_pme','analyste_credit','directeur_pme','direction_pme','directeur_agence']}>
                  <DossierWorkspacePage />
                </RequireRole>
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <GlobalAiJobsToast />
        </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
