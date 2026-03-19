// v6 — specialized African financial OCR + 4096 tokens 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/helpers_v5.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw { status: 401, message: "Non autorisé" };

    const { file_base64, file_name, media_type } = await req.json();
    if (!file_base64 || !file_name) throw { status: 400, message: "file_base64 et file_name requis" };

    console.log("[parse-vision] Processing:", file_name, "| base64 length:", file_base64.length);

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const mimeType = media_type || (file_name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    const contentType = file_name.endsWith('.pdf') ? 'document' : 'image';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            {
              type: contentType,
              source: { type: "base64", media_type: mimeType, data: file_base64 },
            },
            {
              type: "text",
              text: `Tu es un OCR expert spécialisé dans les documents d'entreprises africaines francophones.

EXTRAIS TOUT le contenu de ce document avec une PRÉCISION MAXIMALE.

RÈGLES STRICTES :
1. TABLEAUX : Restitue CHAQUE tableau en format structuré avec | comme séparateur. Préserve TOUTES les colonnes et TOUTES les lignes, y compris les totaux et sous-totaux.

2. CHIFFRES : Extrais CHAQUE montant avec précision. Les montants FCFA sont souvent en notation française (1 234 567). Ne JAMAIS arrondir ou simplifier.

3. SI C'EST UN ÉTAT FINANCIER (bilan, compte de résultat SYSCOHADA) :
   - Extrais chaque poste comptable avec son montant exact
   - Préserve la hiérarchie (postes principaux / sous-postes)
   - Inclus les totaux et sous-totaux
   - Note l'exercice fiscal (année)

4. SI C'EST UN RELEVÉ BANCAIRE (BCEAO, SGBCI, Ecobank, BNI) :
   - Extrais CHAQUE transaction : date | libellé | débit | crédit | solde
   - Inclus le numéro de compte, la banque, la période
   - Note le solde initial et le solde final

5. SI C'EST UNE FACTURE :
   - Numéro, date, émetteur, destinataire
   - Chaque ligne : description | quantité | prix unitaire | montant
   - Total HT, TVA, Total TTC

6. ILLISIBLE : Si une partie est illisible (tampon, écriture manuscrite floue), indique [ILLISIBLE] à cet endroit.

7. NE JAMAIS résumer, interpréter ou omettre du contenu. Extraction INTÉGRALE.`,
            },
          ],
        }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      console.error("[parse-vision] API error:", response.status, err.substring(0, 200));
      throw { status: 500, message: "Erreur Vision API" };
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    console.log("[parse-vision] Extracted", text.length, "chars from", file_name);

    return new Response(JSON.stringify({ success: true, text, file_name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[parse-vision] Error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erreur" }), {
      status: e.status || 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
