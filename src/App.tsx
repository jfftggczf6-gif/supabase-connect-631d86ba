import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RequireSuperAdmin from "@/components/guards/RequireSuperAdmin";
import OrganizationsPage from "./pages/admin/OrganizationsPage";
import OrganizationDetailPage from "./pages/admin/OrganizationDetailPage";
import MeteringDashboard from "./pages/admin/MeteringDashboard";
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
import ProgrammeEnterprisePage from "./pages/ProgrammeEnterprisePage";
import PublicCandidatureForm from "./pages/PublicCandidatureForm";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              <ProtectedRoute><ProgrammeListPage /></ProtectedRoute>
            } />
            <Route path="/programmes/new" element={
              <ProtectedRoute><ProgrammeCreatePage /></ProtectedRoute>
            } />
            <Route path="/programmes/:id" element={
              <ProtectedRoute><ProgrammeDetailPage /></ProtectedRoute>
            } />
            <Route path="/programmes/:id/enterprise/:enterpriseId" element={
              <ProtectedRoute><ProgrammeEnterprisePage /></ProtectedRoute>
            } />
            <Route path="/candidature/:slug" element={<PublicCandidatureForm />} />
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
            <Route path="/organization/members" element={<ProtectedRoute><MembersPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
