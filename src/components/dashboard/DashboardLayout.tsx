import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, User, Users, ClipboardList, Globe, ChevronDown, Check, Building2, Settings, BarChart3, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '@/contexts/OrganizationContext';
import { humanizeRole } from '@/hooks/useCurrentRole';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const { profile, role, signOut } = useAuth();
  const { currentOrg, currentRole: orgRole, memberships, isSuperAdmin, switchOrganization } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const showProgrammes = isSuperAdmin || ['owner', 'admin', 'manager', 'coach', 'analyst'].includes(orgRole || '') || role === 'chef_programme' || role === 'coach';
  const showOrgSwitcher = memberships.length > 1 || isSuperAdmin;
  const canManageMembers = ['owner', 'admin', 'manager'].includes(orgRole || '') || isSuperAdmin;
  const toggleLang = () => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="w-full px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-display font-bold text-primary-foreground">ES</span>
            </div>
            <span className="font-display font-bold text-lg">ESONO</span>
            {/* Sélecteur d'organisation */}
            {!currentOrg ? (
              <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                {role}
              </span>
            ) : !showOrgSwitcher ? (
              <span className="hidden sm:inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {currentOrg.name} · {humanizeRole(orgRole, currentOrg.type)}
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
                    {currentOrg.logo_url ? (
                      <img src={currentOrg.logo_url} alt="" className="h-5 w-5 rounded" />
                    ) : (
                      <Building2 className="h-4 w-4 text-primary" />
                    )}
                    <span className="hidden sm:inline font-medium">{currentOrg.name}</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  {memberships.map(m => (
                    <DropdownMenuItem
                      key={m.organization.id}
                      onClick={() => switchOrganization(m.organization.id)}
                      className="gap-2"
                    >
                      {m.organization.id === currentOrg.id ? <Check className="h-3.5 w-3.5 text-primary" /> : <div className="w-3.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.organization.name}</p>
                        <p className="text-[10px] text-muted-foreground">{humanizeRole(m.role, m.organization.type)}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {canManageMembers && (
                    <>
                      <div className="border-t my-1" />
                      <DropdownMenuItem onClick={() => navigate('/organization/members')} className="gap-2 text-xs">
                        <Users className="h-3.5 w-3.5" /> Membres
                      </DropdownMenuItem>
                    </>
                  )}
                  {isSuperAdmin && (
                    <>
                      <div className="border-t my-1" />
                      <DropdownMenuItem onClick={() => navigate('/admin/organizations')} className="gap-2 text-xs">
                        <Settings className="h-3.5 w-3.5" /> Toutes les organisations
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/admin/metering')} className="gap-2 text-xs">
                        <BarChart3 className="h-3.5 w-3.5" /> Metering IA
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/admin/knowledge-review')} className="gap-2 text-xs">
                        <BookOpen className="h-3.5 w-3.5" /> Validation KB
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {showProgrammes && (
              <Button
                variant="ghost"
                size="sm"
                className={cn('gap-1.5 text-xs', (location.pathname.startsWith('/programmes') || location.pathname === '/dashboard') && 'bg-muted')}
                onClick={() => navigate('/programmes')}
              >
                <ClipboardList className="h-4 w-4" /> {t('nav.programmes')}
              </Button>
            )}
            {!showProgrammes && location.pathname !== '/dashboard' && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => navigate('/dashboard')}
              >
                {t('nav.dashboard')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs h-8 px-2"
              onClick={toggleLang}
            >
              <Globe className="h-3.5 w-3.5" />
              {i18n.language === 'fr' ? 'EN' : 'FR'}
            </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">{profile?.full_name || t('nav.user_fallback')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2">
                <User className="h-4 w-4" /> {t('nav.profile')}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4" /> Paramètres & Sécurité
              </DropdownMenuItem>
              <div className="border-t my-1" />
              <DropdownMenuItem className="gap-2 text-destructive" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> {t('nav.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="w-full px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}
