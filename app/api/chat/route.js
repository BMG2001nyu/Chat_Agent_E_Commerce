import Anthropic from '@anthropic-ai/sdk';
import { toolDefinitions, executeTool } from '../../../lib/tools';
import { buildFallbackResponse, collectToolData } from '../../../lib/fallback-agent';

export const maxDuration = 60;

// Matches appliance model numbers (e.g. WRS325SDHZ01, WDT780SAEM1) but not part numbers (PS + 7-8 digits)
function extractModelNumber(text) {
  if (!text || typeof text !== 'string') return null;
  const matches = text.toUpperCase().matchAll(/\b([A-Z]{2,5}\d{2,8}[A-Z0-9]{0,6})\b/g);
  for (const match of matches) {
    const candidate = match[1];
    if (/^PS\d{7,8}$/.test(candidate)) continue;
    if (candidate.length >= 7 && /[A-Z]/.test(candidate) && /\d/.test(candidate)) return candidate;
  }
  return null;
}

const SYSTEM_PROMPT = `You are a friendly and knowledgeable customer service assistant for PartSelect.com, one of the leading appliance parts retailers. You specialize exclusively in refrigerator and dishwasher parts and repairs.

You help customers:
1. Find the right replacement parts by searching the catalog
2. Check whether a part is compatible with their specific appliance model
3. Provide step-by-step installation guidance
4. Diagnose appliance problems and recommend the appropriate parts
5. Track existing orders

SCOPE — STRICTLY ENFORCED:
- You ONLY assist with refrigerator and dishwasher parts and repairs
- If asked about any other appliance (washing machine, dryer, oven, range, microwave, etc.) politely explain that you specialize in refrigerators and dishwashers only
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
  let messages = [];

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    messages = body?.messages;
    if (!Array.isArray(messages)) {
      return Response.json({ error: 'messages must be an array' }, { status: 400 });
    }

    // Model number memory: client sends what it already knows; we also scan the latest user message
    const clientModelNumber = body?.modelNumber || null;
    const latestUserText = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const detectedModel = !clientModelNumber ? extractModelNumber(latestUserText) : null;
    const sessionModel = clientModelNumber || detectedModel;

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(await buildFallbackResponse(messages));
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Inject the customer's known model number into the system prompt so Claude never asks for it twice
    const effectiveSystem = sessionModel
      ? `${SYSTEM_PROMPT}\n\nSESSION CONTEXT: The customer's appliance model number is ${sessionModel}. Use it automatically for all compatibility checks, troubleshooting, and part searches — do not ask them to repeat it.`
      : SYSTEM_PROMPT;

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
    let orderStatus = null;

    const trackedData = {
      get products() { return allProducts; },
      set products(value) { allProducts = value; },
      get compatibilityResult() { return compatibilityResult; },
      set compatibilityResult(value) { compatibilityResult = compatibilityResult || value; },
      get installationGuide() { return installationGuide; },
      set installationGuide(value) { installationGuide = installationGuide || value; },
      get troubleshootResult() { return troubleshootResult; },
      set troubleshootResult(value) { troubleshootResult = troubleshootResult || value; },
      get orderStatus() { return orderStatus; },
      set orderStatus(value) { orderStatus = orderStatus || value; },
    };

    let iterations = 0;
    const MAX_ITERATIONS = 10;

    // Agentic loop
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: effectiveSystem,
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
          orderStatus: orderStatus || undefined,
          detectedModel: detectedModel || undefined,
        });
      }

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
        const toolResultContents = [];

        for (const toolUse of toolUseBlocks) {
          const result = await executeTool(toolUse.name, toolUse.input);
          collectToolData(trackedData, result);

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
    if (messages.length > 0) {
      return Response.json(await buildFallbackResponse(messages));
    }
    return Response.json(
      { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
