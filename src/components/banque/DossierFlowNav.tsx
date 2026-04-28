// DossierFlowNav — barre de navigation entre les écrans d'un dossier de crédit (segment Banque).
//
// Lit `flow_nav_screens` (catalogue des écrans) et `flow_nav_per_role` (qui voit quoi)
// dans config_banque. Les écrans non encore implémentés (`available: false`) sont rendus
// désactivés avec un tag "Bientôt".
//
// L'utilisateur peut simuler un autre rôle via la pipeline (state qui sera plus tard
// piloté par le rôle réel de l'utilisateur). Pour l'instant le composant accepte un
// `viewAs` en prop.

import { useNavigate, useLocation } from 'react-router-dom';

interface FlowScreen {
  code: string;
  label: string;
  path: string;
  available?: boolean;
}

interface DossierFlowNavProps {
  enterpriseId: string;
  configBanque: any;
  viewAs?: string | null;
  currentScreenCode: string;
}

export default function DossierFlowNav({
  enterpriseId, configBanque, viewAs, currentScreenCode,
}: DossierFlowNavProps) {
  const nav = useNavigate();
  const location = useLocation();

  if (!configBanque?.flow_nav_screens) return null;

  const screens: FlowScreen[] = configBanque.flow_nav_screens || [];
  const flowPerRole: Record<string, string[]> = configBanque.flow_nav_per_role || {};

  // Si pas de role spécifié, afficher tous les écrans (vue admin/superadmin)
  const allowedCodes = viewAs ? (flowPerRole[viewAs] || screens.map(s => s.code)) : screens.map(s => s.code);
  const visibleScreens = screens.filter(s => allowedCodes.includes(s.code));

  const goTo = (s: FlowScreen) => {
    if (s.available === false) return;
    const path = s.path.replace(':id', enterpriseId);
    nav(path);
  };

  return (
    <div className="flex gap-1 mb-4 bg-card border rounded-xl p-1 overflow-x-auto">
      {visibleScreens.map(s => {
        const isActive = currentScreenCode === s.code || (s.code !== 'pipeline' && location.pathname.includes(`/${s.code.replace('_', '-')}`));
        const isDisabled = s.available === false;
        return (
          <button
            key={s.code}
            onClick={() => goTo(s)}
            disabled={isDisabled}
            className={`relative flex-1 min-w-[100px] text-xs px-3 py-2 rounded-lg whitespace-nowrap transition-all
              ${isActive ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted'}
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {s.label}
            {isDisabled && (
              <span className="ml-1 text-[8px] uppercase tracking-wide opacity-70">bientôt</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
