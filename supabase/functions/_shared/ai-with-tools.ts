/**
 * ai-with-tools.ts
 * 
 * Appel IA avec boucle tool_use. L'IA peut appeler la calculatrice
 * autant de fois qu'elle veut pendant son raisonnement.
 * Quand elle a fini, elle produit son JSON final.
 */

import { CALCULATOR_TOOLS, executeCalculatorTool } from "./financial-calculator-tools.ts";

const MAX_TOOL_ROUNDS = 10; // Reduced: Sonnet 4.6 is thorough, 10 rounds is plenty

export async function callAIWithCalculator(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 16384,
  model: string = "claude-sonnet-4-20250514",  // Sonnet 4 — 4.6 gets stuck in tool loops
  temperature: number = 0,
): Promise<Record<string, any>> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const messages: Array<{ role: string; content: any }> = [
    { role: "user", content: userPrompt },
  ];

  let toolCallCount = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages,
        tools: CALCULATOR_TOOLS,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ai-tools] API error ${response.status}:`, errText.slice(0, 300));
      throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const result = await response.json();
    const stopReason = result.stop_reason;
    const content = result.content || [];

    // Token tracking
    const usage = result.usage;
    if (usage) {
      const cost = ((usage.input_tokens || 0) * 3 + (usage.output_tokens || 0) * 15) / 1_000_000;
      console.log(`[cost] tool-round ${round}: ${usage.input_tokens || 0} in + ${usage.output_tokens || 0} out = $${cost.toFixed(4)}`);
    }

    // Add assistant response to conversation
    messages.push({ role: "assistant", content });

    // If the AI is done (no more tool calls)
    if (stopReason === "end_turn" || stopReason === "max_tokens") {
      // Extract the final text (should be JSON)
      const textBlocks = content.filter((b: any) => b.type === "text");
      const finalText = textBlocks.map((b: any) => b.text).join("");

      console.log(`[ai-tools] Done after ${round + 1} rounds, ${toolCallCount} tool calls`);

      // Parse JSON
      const cleaned = finalText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      try {
        return JSON.parse(cleaned);
      } catch (err) {
        console.error("[ai-tools] JSON parse error:", err, "Text:", cleaned.slice(0, 500));
        throw new Error(`JSON parse error: ${err}`);
      }
    }

    // If AI wants to use tools
    if (stopReason === "tool_use") {
      const toolUseBlocks = content.filter((b: any) => b.type === "tool_use");
      const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

      for (const toolCall of toolUseBlocks) {
        toolCallCount++;
        const toolName = toolCall.name;
        const toolInput = toolCall.input;

        console.log(`[ai-tools] Tool call #${toolCallCount}: ${toolName}(${JSON.stringify(toolInput).slice(0, 100)}...)`);

        // Execute the tool
        const result = executeCalculatorTool(toolName, toolInput);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Add tool results to conversation
      messages.push({ role: "user", content: toolResults });

      // Force completion when approaching limit
      if (round >= MAX_TOOL_ROUNDS - 2) {
        messages.push({ role: "user", content: [{ type: "text", text: "Tu as fait suffisamment de calculs. Produis maintenant le JSON final avec toutes les données collectées. NE FAIS PLUS d'appels outils." }] });
      }
    }
  }

  throw new Error(`[ai-tools] Max rounds (${MAX_TOOL_ROUNDS}) exceeded — AI stuck in tool loop`);
}
