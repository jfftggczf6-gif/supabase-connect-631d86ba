/**
 * Extrait le message d'erreur réel d'un appel `supabase.functions.invoke`.
 *
 * supabase-js range le corps d'une réponse non-2xx dans `error.context`
 * (un objet `Response`), et non dans `data`. Sans ce parsing, l'UI n'affiche
 * que le générique « Edge Function returned a non-2xx status code ».
 *
 * @param error l'erreur renvoyée par `invoke` (FunctionsHttpError | null)
 * @param data  le corps renvoyé par `invoke` (peut contenir `{ error }`)
 * @returns le message d'erreur lisible, ou `null` s'il n'y a pas d'erreur
 */
export async function extractEdgeError(error: any, data: any): Promise<string | null> {
  // Cas 1 : la fonction a répondu 2xx mais avec un { error } applicatif.
  if (data?.error) return data.error;
  if (!error) return null;

  // Cas 2 : FunctionsHttpError — le vrai message est dans error.context (Response).
  const ctx = error.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // corps non-JSON : on retombe sur error.message
    }
  }

  return error.message ?? 'Erreur inconnue';
}
