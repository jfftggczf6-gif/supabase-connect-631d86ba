import { Building2, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NoOrganizationScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold mb-2">Aucune organisation</h1>
          <p className="text-muted-foreground text-sm">
            Vous n'êtes pas encore membre d'une organisation sur ESONO.
            Contactez l'équipe pour être rattaché à votre espace de travail.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button variant="default" className="gap-2" asChild>
            <a href="mailto:contact@esono.app">
              <Mail className="h-4 w-4" /> contact@esono.app
            </a>
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <a href="https://wa.me/22500000000" target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
