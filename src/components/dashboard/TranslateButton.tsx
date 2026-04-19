import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranslateButtonProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function TranslateButton({ containerRef }: TranslateButtonProps) {
  const { t, i18n } = useTranslation();
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(false);
  const originalsRef = useRef<Map<Text, string>>(new Map());

  const targetLang = i18n.language === 'fr' ? 'en' : 'fr';
  const label = targetLang === 'en' ? 'EN' : 'FR';

  // Auto-reset when container content changes (tab switch, re-render)
  useEffect(() => {
    if (!translated) return;
    const observer = new MutationObserver(() => {
      // React re-rendered — our text nodes may be gone, reset state
      originalsRef.current.clear();
      setTranslated(false);
    });
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }
    return () => observer.disconnect();
  }, [translated, containerRef]);

  const collectTextNodes = (root: Node): Text[] => {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.textContent?.trim();
        if (!text || text.length < 3) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent?.tagName === 'SCRIPT' || parent?.tagName === 'STYLE' || parent?.tagName === 'BUTTON') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) nodes.push(node);
    return nodes;
  };

  const handleTranslate = async () => {
    if (!containerRef.current) {
      toast.error('Conteneur de traduction introuvable. Recharge la page.');
      console.error('[Translate] containerRef.current is null');
      return;
    }

    const textNodes = collectTextNodes(containerRef.current);
    if (textNodes.length === 0) {
      toast.error('Aucun texte à traduire trouvé dans cette section.');
      console.warn('[Translate] No text nodes found in container');
      return;
    }
    console.log(`[Translate] Found ${textNodes.length} text nodes to translate`);

    // Store originals
    const originals = new Map<Text, string>();
    for (const tn of textNodes) {
      originals.set(tn, tn.textContent || '');
    }

    // Batch into chunks (1500 chars max + 50 nodes max pour rester sous 8192 tokens output)
    const chunks: { texts: string[]; nodes: Text[] }[] = [];
    let chunk: { texts: string[]; nodes: Text[] } = { texts: [], nodes: [] };
    let len = 0;
    for (const tn of textNodes) {
      const text = tn.textContent || '';
      if ((len + text.length > 1500 || chunk.texts.length >= 50) && chunk.texts.length > 0) {
        chunks.push(chunk);
        chunk = { texts: [], nodes: [] };
        len = 0;
      }
      chunk.texts.push(text);
      chunk.nodes.push(tn);
      len += text.length;
    }
    if (chunk.texts.length > 0) chunks.push(chunk);
    console.log(`[Translate] Splitting into ${chunks.length} chunks`);

    setTranslating(true);
    let successCount = 0;
    let failCount = 0;
    let firstError: string | null = null;

    try {
      for (const ch of chunks) {
        const joined = ch.texts.map((t, i) => `[${i}] ${t}`).join('\n');
        const { data, error } = await supabase.functions.invoke('translate-content', {
          body: { text: joined, target_lang: targetLang },
        });

        if (error) {
          failCount++;
          if (!firstError) firstError = error.message || JSON.stringify(error);
          console.error('[Translate] Edge function error:', error);
          continue;
        }
        if (!data?.translated) {
          failCount++;
          if (!firstError) firstError = `Réponse vide de l'edge function (data: ${JSON.stringify(data)})`;
          console.warn('[Translate] No translated field in response:', data);
          continue;
        }

        const lines = data.translated.split('\n');
        const translatedMap: Record<number, string> = {};
        let currentIdx = -1;
        let currentText = '';

        for (const line of lines) {
          const match = line.match(/^\[(\d+)\]\s*(.*)/);
          if (match) {
            if (currentIdx >= 0) translatedMap[currentIdx] = currentText.trim();
            currentIdx = parseInt(match[1]);
            currentText = match[2];
          } else {
            currentText += '\n' + line;
          }
        }
        if (currentIdx >= 0) translatedMap[currentIdx] = currentText.trim();

        // Fallback: si l'IA n'a pas mis de marqueurs [N], faire un mapping ligne-à-ligne
        if (Object.keys(translatedMap).length === 0) {
          console.warn('[Translate] No [N] markers in response, falling back to line-by-line mapping');
          const nonEmptyLines = lines.filter((l: string) => l.trim().length > 0);
          for (let i = 0; i < Math.min(nonEmptyLines.length, ch.nodes.length); i++) {
            translatedMap[i] = nonEmptyLines[i].trim();
          }
        }
        console.log(`[Translate] Chunk parsed: ${Object.keys(translatedMap).length}/${ch.nodes.length} segments mapped`);

        for (let i = 0; i < ch.nodes.length; i++) {
          if (translatedMap[i] && ch.nodes[i].parentNode) {
            ch.nodes[i].textContent = translatedMap[i];
            successCount++;
          }
        }
      }

      originalsRef.current = originals;
      if (successCount > 0) {
        setTranslated(true);
        toast.success(`${successCount} segments traduits${failCount > 0 ? ` (${failCount} échecs)` : ''}`);
      } else {
        toast.error(firstError ? `Traduction échouée : ${firstError}` : 'Aucun segment traduit');
      }
    } catch (e: any) {
      console.error('[Translate] Exception:', e);
      toast.error(e.message || t('common.error'));
    } finally {
      setTranslating(false);
    }
  };

  const handleUndo = () => {
    // Restore original text content node by node
    for (const [node, original] of originalsRef.current) {
      if (node.parentNode) {
        node.textContent = original;
      }
    }
    originalsRef.current.clear();
    setTranslated(false);
  };

  if (translated) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleUndo}>
        <Undo2 className="h-3.5 w-3.5" />
        {t('translate.undo')}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleTranslate} disabled={translating}>
      {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
      {translating ? t('translate.translating') : `${t('translate.btn')} → ${label}`}
    </Button>
  );
}
