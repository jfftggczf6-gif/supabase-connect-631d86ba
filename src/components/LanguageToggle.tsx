import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageToggle({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();
  const toggle = () => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <Globe className="h-3.5 w-3.5" />
      {i18n.language === 'fr' ? 'EN' : 'FR'}
    </button>
  );
}
