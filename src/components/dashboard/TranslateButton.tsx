import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranslateButtonProps {
  /** Ref to the container element whose text content will be translated */
  containerRef: React.RefObject<HTMLElement>;
}

export default function TranslateButton({ containerRef }: TranslateButtonProps) {
  const { t, i18n } = useTranslation();
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(false);
  const originalHtmlRef = useRef<string>('');

  const targetLang = i18n.language === 'fr' ? 'en' : 'fr';
  const label = targetLang === 'en' ? 'EN' : 'FR';

  const handleTranslate = async () => {
    if (!containerRef.current) return;

    // Save original HTML for undo
    originalHtmlRef.current = containerRef.current.innerHTML;

    // Collect all text nodes
    const textNodes: { node: Text; text: string }[] = [];
    const walker = document.createTreeWalker(containerRef.current, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.textContent?.trim();
        if (!text || text.length < 3) return NodeFilter.FILTER_REJECT;
        // Skip script/style content
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

    // Batch text into chunks of ~2000 chars for efficient translation
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

        // Apply translations to DOM nodes
        for (let i = 0; i < chunk.nodes.length; i++) {
          if (translatedMap[i]) {
            chunk.nodes[i].textContent = translatedMap[i];
          }
        }
      }

      setTranslated(true);
    } catch (e: any) {
      toast.error(e.message || t('common.error'));
    } finally {
      setTranslating(false);
    }
  };

  const handleUndo = () => {
    if (containerRef.current && originalHtmlRef.current) {
      containerRef.current.innerHTML = originalHtmlRef.current;
      setTranslated(false);
    }
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
