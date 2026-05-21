const { executeTool } = require('./tools');

const ORDER_NUMBER_RE = /\bPS-\d{5,}\b/i;
const PART_NUMBER_RE = /\bPS\d{4,}\b/i;
const MODEL_NUMBER_RE = /\b[A-Z]{2,}\d[A-Z0-9/-]{3,}\b/i;

function latestUserMessage(messages) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content || '';
}

function findLastPartNumber(messages) {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'user') continue;
    const match = String(message.content).match(PART_NUMBER_RE);
    if (match) return match[0].toUpperCase();
  }
  return null;
}

function extractModelNumber(text) {
  const candidates = String(text).toUpperCase().match(new RegExp(MODEL_NUMBER_RE, 'g')) || [];
  return candidates.find((candidate) => !candidate.startsWith('PS')) || null;
}

function detectApplianceType(text) {
  const normalized = String(text).toLowerCase();

  if (/\b(dishwasher|dish washer|dishes|dish rack|spray arm|drain pump|standing water)\b/.test(normalized)) {
    return 'dishwasher';
  }

  if (/\b(refrigerator|fridge|freezer|ice maker|icemaker|ice|water dispenser|cooling)\b/.test(normalized)) {
    return 'refrigerator';
  }

  return null;
}

function isOutOfScope(text) {
  const normalized = String(text).toLowerCase();
  return /\b(washing machine|clothes washer|laundry washer|dryer|oven|range|stove|cooktop|microwave|furnace|hvac)\b/.test(normalized);
}

function collectToolData(response, result) {
  if (result.products?.length > 0) {
    response.products = mergeProducts(response.products || [], result.products);
  }

  if (result.primary_parts?.length > 0 || result.secondary_parts?.length > 0) {
    const parts = [...(result.primary_parts || []), ...(result.secondary_parts || [])];
    response.products = mergeProducts(response.products || [], parts);
  }

  if (typeof result.compatible === 'boolean') {
    response.compatibilityResult = result;
  }

  if (result.steps) {
    response.installationGuide = result;
  }

  if (result.diagnosis) {
    response.troubleshootResult = result;
  }

  if (result.order_number && result.status) {
    response.orderStatus = result;
  }

  return response;
}

function mergeProducts(existing, incoming) {
  const seen = new Set(existing.map((part) => part.part_number));
  const merged = [...existing];

  for (const part of incoming) {
    if (part?.part_number && !seen.has(part.part_number)) {
      seen.add(part.part_number);
      merged.push(part);
    }
  }

  return merged;
}

function formatProductSummary(part) {
  const stock = part.in_stock ? 'in stock' : 'currently out of stock';
  return `${part.part_number} (${part.name}) is ${stock} at $${part.price.toFixed(2)}. Repair difficulty: ${part.difficulty}; typical time: ${part.repair_time}.`;
}

function responseWith(content, result) {
  const response = { role: 'assistant', content };
  return result ? collectToolData(response, result) : response;
}

async function buildFallbackResponse(messages) {
  const userText = latestUserMessage(messages);
  const normalized = userText.toLowerCase();
  const partNumber = (userText.match(PART_NUMBER_RE)?.[0] || findLastPartNumber(messages))?.toUpperCase();
  const orderNumber = userText.match(ORDER_NUMBER_RE)?.[0]?.toUpperCase();
  const modelNumber = extractModelNumber(userText);
  const applianceType = detectApplianceType(userText);

  if (isOutOfScope(userText)) {
    return responseWith(
      'I can help with PartSelect refrigerator and dishwasher parts, compatibility checks, installation guidance, troubleshooting, and order status. I cannot provide support for that appliance category here.'
    );
  }

  if (orderNumber || /\b(order|track|tracking|shipment|delivery)\b/.test(normalized)) {
    if (!orderNumber) {
      return responseWith('Please send your PartSelect order number, for example PS-100422, and I can look up the current status.');
    }

    const result = await executeTool('get_order_status', { order_number: orderNumber });
    if (!result.found) return responseWith(result.message, result);

    const delivery = result.delivered_on
      ? `Delivered on ${result.delivered_on}.`
      : result.estimated_delivery
        ? `Estimated delivery: ${result.estimated_delivery}.`
        : `Estimated ship date: ${result.estimated_ship}.`;

    return responseWith(
      `Order ${result.order_number} is ${result.status}. ${delivery} ${result.tracking ? `${result.carrier} tracking: ${result.tracking}.` : 'Tracking has not been assigned yet.'}`,
      result
    );
  }

  if (/\b(compatible|compatibility|fit|fits|work with|model)\b/.test(normalized)) {
    if (!partNumber || !modelNumber) {
      return responseWith('Please provide both the PartSelect part number and your appliance model number. Example: "Is PS11747476 compatible with WDT780SAEM1?"');
    }

    const result = await executeTool('check_compatibility', {
      part_number: partNumber,
      model_number: modelNumber,
    });
    return responseWith(result.message, result);
  }

  if (/\b(install|installation|replace|replacement steps|repair steps|how do i)\b/.test(normalized)) {
    if (!partNumber) {
      return responseWith('Please send the PartSelect part number you want to install, and I will pull the matching step-by-step guide.');
    }

    const result = await executeTool('get_installation_guide', { part_number: partNumber });
    if (!result.found) return responseWith(result.message, result);

    return responseWith(
      `Here is the installation plan for ${partNumber}. Disconnect power before starting, review the required tools, and use the guide below for the full sequence.`,
      result
    );
  }

  if (partNumber) {
    const result = await executeTool('get_part_details', { part_number: partNumber });
    if (!result.found) return responseWith(result.message, result);

    return responseWith(formatProductSummary(result.products[0]), result);
  }

  if (applianceType && /\b(not|won't|wont|broken|leaking|drain|clean|cool|ice|noise|water|dry|starting|frost|warm|stopped)\b/.test(normalized)) {
    const result = await executeTool('troubleshoot_issue', {
      symptom: userText,
      appliance_type: applianceType,
      model_number: modelNumber || undefined,
    });

    const checkFirst = result.check_first ? ` First check: ${result.check_first}` : '';
    const recommended = result.primary_parts?.length
      ? ` Likely part${result.primary_parts.length > 1 ? 's' : ''}: ${result.primary_parts.map((part) => part.part_number).join(', ')}.`
      : '';

    return responseWith(`${result.diagnosis}: ${result.explanation}${checkFirst}${recommended}`, result);
  }

  if (/\b(find|search|need|buy|price|part|filter|gasket|pump|shelf|basket|rack)\b/.test(normalized)) {
    const result = await executeTool('search_parts', {
      query: userText,
      category: applianceType || undefined,
      max_results: 4,
    });

    if (!result.found) {
      return responseWith(`${result.message} I can search refrigerator and dishwasher parts by symptom, part name, or PartSelect number.`, result);
    }

    return responseWith(
      `I found ${result.count} matching PartSelect part${result.count === 1 ? '' : 's'}. The cards below show price, fit brands, repair difficulty, and cart actions.`,
      result
    );
  }

  return responseWith(
    'I can help with refrigerator and dishwasher part lookup, compatibility checks, installation guides, troubleshooting, and order status. Send a symptom, part number, model number, or order number to get started.'
  );
}

module.exports = { buildFallbackResponse, collectToolData };
