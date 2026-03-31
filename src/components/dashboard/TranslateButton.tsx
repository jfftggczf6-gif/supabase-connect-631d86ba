import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranslateButtonProps {
  /** Ref to the container element whose text content will be translated */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function TranslateButton({ containerRef }: TranslateButtonProps) {
  const { t, i18n } = useTranslation();
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(false);
  const cloneRef = useRef<HTMLDivElement | null>(null);

  const targetLang = i18n.language === 'fr' ? 'en' : 'fr';
  const label = targetLang === 'en' ? 'EN' : 'FR';

  const handleTranslate = async () => {
    if (!containerRef.current) return;

    // Clone the entire container so we never touch React's DOM
    const clone = containerRef.current.cloneNode(true) as HTMLDivElement;

    // Collect all text nodes from the clone
    const textNodes: { node: Text; text: string }[] = [];
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.textContent?.trim();
        if (!text || text.length < 3) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent?.tagName === 'SCRIPT' || parent?.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      textNodes.push({ node, text: node.textContent || '' });
    }

    if (textNodes.length === 0) return;

    // Batch text into chunks of ~2000 chars
    const chunks: { texts: string[]; nodes: Text[] }[] = [];
    let currentChunk: { texts: string[]; nodes: Text[] } = { texts: [], nodes: [] };
    let currentLen = 0;

    for (const { node: tn, text } of textNodes) {
      if (currentLen + text.length > 2000 && currentChunk.texts.length > 0) {
        chunks.push(currentChunk);
        currentChunk = { texts: [], nodes: [] };
        currentLen = 0;
      }
      currentChunk.texts.push(text);
      currentChunk.nodes.push(tn);
      currentLen += text.length;
    }
    if (currentChunk.texts.length > 0) chunks.push(currentChunk);

    setTranslating(true);

    try {
      for (const chunk of chunks) {
        const joined = chunk.texts.map((t, i) => `[${i}] ${t}`).join('\n');
        const { data, error } = await supabase.functions.invoke('translate-content', {
          body: { text: joined, target_lang: targetLang },
        });

        if (error || !data?.translated) {
          toast.error(t('common.error'));
          continue;
        }

        // Parse translated text back by [index] markers
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

        // Apply translations to clone's DOM nodes (not React's DOM)
        for (let i = 0; i < chunk.nodes.length; i++) {
          if (translatedMap[i]) {
            chunk.nodes[i].textContent = translatedMap[i];
          }
        }
      }

      // Swap: hide React's original, show translated clone
      if (containerRef.current) {
        containerRef.current.style.display = 'none';
        cloneRef.current = clone;
        containerRef.current.parentElement?.insertBefore(clone, containerRef.current.nextSibling);
      }

      setTranslated(true);
    } catch (e: any) {
      toast.error(e.message || t('common.error'));
    } finally {
      setTranslating(false);
    }
  };

  const handleUndo = () => {
    // Remove clone, show React's original
    if (cloneRef.current) {
      cloneRef.current.remove();
      cloneRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.style.display = '';
    }
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
