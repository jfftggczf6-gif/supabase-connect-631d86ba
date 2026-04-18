import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, ShieldCheck, Loader2, QrCode } from 'lucide-react';

export default function MFAEnrollment() {
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  // Check current MFA status
  const checkStatus = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const totpFactor = data?.totp?.[0];
    if (totpFactor?.status === 'verified') {
      setEnrolled(true);
      setFactorId(totpFactor.id);
    }
  };

  useState(() => { checkStatus(); });

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'ESONO Authenticator',
      });
      if (error) throw error;
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'activation MFA');
    }
    setEnrolling(false);
  };

  const handleVerify = async () => {
    if (!factorId || verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
      if (!challenge) throw new Error('Challenge failed');

      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (error) throw error;

      setEnrolled(true);
      setQrCode(null);
      setSecret(null);
      toast.success('Authentification à deux facteurs activée');
    } catch (err: any) {
      toast.error(err.message || 'Code invalide');
    }
    setVerifying(false);
  };

  const handleUnenroll = async () => {
    if (!factorId) return;
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setEnrolled(false);
      setFactorId(null);
      toast.success('MFA désactivé');
    } catch (err: any) {
      toast.error(err.message);
    }
    setUnenrolling(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {enrolled ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <Shield className="h-5 w-5 text-primary" />}
          Authentification à deux facteurs (MFA)
          {enrolled && <Badge className="bg-emerald-100 text-emerald-700">Activé</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrolled ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Votre compte est protégé par l'authentification à deux facteurs via une application d'authentification (Google Authenticator, Authy, etc.).
            </p>
            <Button variant="outline" size="sm" className="text-destructive" onClick={handleUnenroll} disabled={unenrolling}>
              {unenrolling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Désactiver le MFA
            </Button>
          </div>
        ) : qrCode ? (
          <div className="space-y-4">
            <p className="text-sm">Scannez ce QR code avec votre application d'authentification :</p>
            <div className="flex justify-center">
              <img src={qrCode} alt="QR Code MFA" className="w-48 h-48 border rounded-lg" />
            </div>
            {secret && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Ou entrez ce code manuellement :</p>
                <code className="text-xs bg-muted px-2 py-1 rounded">{secret}</code>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Code à 6 chiffres"
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-40"
                maxLength={6}
              />
              <Button onClick={handleVerify} disabled={verifyCode.length !== 6 || verifying}>
                {verifying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Vérifier
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ajoutez une couche de sécurité supplémentaire à votre compte. À chaque connexion, vous devrez entrer un code depuis votre application d'authentification.
            </p>
            <p className="text-xs text-muted-foreground">
              Recommandé pour les rôles sensibles : analystes PE, managers, administrateurs.
            </p>
            <Button className="gap-2" onClick={handleEnroll} disabled={enrolling}>
              {enrolling ? <Loader2 className="h-3 w-3 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Activer le MFA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
