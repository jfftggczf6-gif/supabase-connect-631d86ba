import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

interface ProgrammePickerProps {
  organizationId: string;
  value: string[];                 // ids cochés
  onChange: (ids: string[]) => void;
}

/** Liste à cocher des programmes d'une organisation (assignation chef de programme). */
export default function ProgrammePicker({ organizationId, value, onChange }: ProgrammePickerProps) {
  const [programmes, setProgrammes] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) { setProgrammes([]); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('programmes')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name')
      .then(({ data }) => {
        if (cancelled) return;
        setProgrammes(data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [organizationId]);

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((x) => x !== id));

  if (loading) {
    return (
      <div className="py-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Chargement…
      </div>
    );
  }
  if (!programmes.length) {
    return <p className="text-xs text-muted-foreground">Aucun programme dans cette organisation. Le chef pourra en créer un lui-même.</p>;
  }

  return (
    <div className="max-h-48 overflow-y-auto space-y-1 rounded border p-2">
      {programmes.map((p) => (
        <label key={p.id} className="flex items-center gap-2 p-1 cursor-pointer hover:bg-muted/50 rounded">
          <Checkbox checked={value.includes(p.id)} onCheckedChange={(c) => toggle(p.id, !!c)} />
          <span className="text-sm">{p.name}</span>
        </label>
      ))}
    </div>
  );
}
