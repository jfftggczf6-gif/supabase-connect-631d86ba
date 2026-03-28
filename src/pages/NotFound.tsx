import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from 'react-i18next';

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">{t('pages.not_found_title')}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t('pages.not_found_text')}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t('pages.not_found_link')}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
