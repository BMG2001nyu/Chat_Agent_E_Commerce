import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, executeTool } from '../../../lib/tools';

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a friendly and knowledgeable customer service assistant for PartSelect.com, one of the leading appliance parts retailers. You specialize exclusively in refrigerator and dishwasher parts and repairs.

You help customers:
1. Find the right replacement parts by searching the catalog
2. Check whether a part is compatible with their specific appliance model
3. Provide step-by-step installation guidance
4. Diagnose appliance problems and recommend the appropriate parts
5. Track existing orders

SCOPE — STRICTLY ENFORCED:
- You ONLY assist with refrigerator and dishwasher parts and repairs
- If asked about any other appliance (washing machine, dryer, oven, range, microwave, dishwasher other than the two supported) politely explain that you specialize in refrigerators and dishwashers only
- If asked about completely unrelated topics, politely redirect to appliance parts

TOOL USAGE RULES:
- ALWAYS use tools to retrieve part information — never invent part numbers, prices, or compatibility results
- For troubleshooting questions: call troubleshoot_issue first, then optionally get_part_details for more info
- For specific part number questions: call get_part_details
- For compatibility questions: call check_compatibility with both the part number and model number
- For installation questions: call get_installation_guide with the part number
- For part searches: call search_parts with descriptive keywords

RESPONSE STYLE:
- Be concise and helpful — customers want answers quickly
- Always mention part numbers so customers can reference them
- When showing multiple parts, briefly explain what each one does and why it might be the cause
- For troubleshooting, mention any free checks the customer can do before buying parts
- Format responses clearly with line breaks between sections`;

export async function POST(request) {
  try {
    const { messages } = await request.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build conversation — only user/assistant text messages
    const conversationMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Accumulated data from tool calls (returned to frontend for rendering)
    let allProducts = [];
    let compatibilityResult = null;
    let installationGuide = null;
    let troubleshootResult = null;

    let iterations = 0;
    const MAX_ITERATIONS = 10;

    // Agentic loop
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: toolDefinitions,
        messages: conversationMessages,
      });

      // Always add assistant response to history
      conversationMessages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const textContent = response.content.find((b) => b.type === 'text')?.text || '';
        return Response.json({
          role: 'assistant',
          content: textContent,
          products: allProducts.length > 0 ? allProducts : undefined,
          compatibilityResult: compatibilityResult || undefined,
          installationGuide: installationGuide || undefined,
          troubleshootResult: troubleshootResult || undefined,
        });
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
        const toolResultContents = [];

        for (const toolUse of toolUseBlocks) {
          const result = await executeTool(toolUse.name, toolUse.input);

          // Collect structured data for frontend rendering
          if (result.products?.length > 0) {
            const newParts = result.products.filter(
              (p) => p && !allProducts.some((existing) => existing.part_number === p.part_number)
            );
            allProducts.push(...newParts);
          }
          if (result.compatible !== undefined && !compatibilityResult) {
            compatibilityResult = result;
          }
          if (result.steps && !installationGuide) {
            installationGuide = result;
          }
          if (result.diagnosis && !troubleshootResult) {
            troubleshootResult = result;
            // Also collect troubleshoot primary parts
            if (result.primary_parts?.length > 0) {
              const newParts = result.primary_parts.filter(
                (p) => p && !allProducts.some((existing) => existing.part_number === p.part_number)
              );
              allProducts.push(...newParts);
            }
          }

          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        }

        conversationMessages.push({ role: 'user', content: toolResultContents });
      }
    }

    return Response.json({
      role: 'assistant',
      content: 'I encountered an issue processing your request. Please try again.',
    });
  } catch (err) {
    console.error('[chat/route] Error:', err);
    return Response.json(
      { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
