const { searchParts, getPartByNumber, checkCompatibility } = require('./catalog');
const { getInstallationGuide } = require('./installation-guides');
const { troubleshootIssue } = require('./troubleshoot');

const MOCK_ORDERS = {
  'PS-100421': { status: 'Delivered', tracking: '1Z999AA10123456784', carrier: 'UPS', delivered_on: '2026-05-17', items: ['PS11752778 - Ice Maker Assembly'] },
  'PS-100422': { status: 'Shipped', tracking: '9400111899223397609472', carrier: 'USPS', estimated_delivery: '2026-05-22', items: ['PS11747476 - Door Latch Assembly', 'PS11752148 - Door Gasket'] },
  'PS-100423': { status: 'Processing', tracking: null, estimated_ship: '2026-05-21', items: ['PS11748050 - Drain Pump Motor'] },
};

// Tool definitions sent to Claude
const toolDefinitions = [
  {
    name: 'search_parts',
    description: 'Search the PartSelect catalog for refrigerator or dishwasher parts by keyword, description, or symptom. Returns matching parts with price, compatibility, and ratings. Use this when the customer describes a problem or asks to find a part.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords — e.g. "ice maker", "door gasket", "water filter", "not draining"',
        },
        category: {
          type: 'string',
          enum: ['refrigerator', 'dishwasher'],
          description: 'Optional: filter results to a specific appliance type',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default 3, max 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_part_details',
    description: 'Fetch complete details for a specific part by its part number. Use this when the customer provides a part number directly or when you need full details on a specific part.',
    input_schema: {
      type: 'object',
      properties: {
        part_number: {
          type: 'string',
          description: 'The PartSelect part number (e.g. PS11752778)',
        },
      },
      required: ['part_number'],
    },
  },
  {
    name: 'check_compatibility',
    description: "Check whether a specific part is compatible with a customer's appliance model number. Always use this when the customer provides both a part number and a model number.",
    input_schema: {
      type: 'object',
      properties: {
        part_number: {
          type: 'string',
          description: 'The PartSelect part number to check',
        },
        model_number: {
          type: 'string',
          description: "The customer's appliance model number (e.g. WDT780SAEM1)",
        },
      },
      required: ['part_number', 'model_number'],
    },
  },
  {
    name: 'get_installation_guide',
    description: 'Get step-by-step installation instructions for a specific part. Use this when a customer asks how to install a part or how to perform a repair.',
    input_schema: {
      type: 'object',
      properties: {
        part_number: {
          type: 'string',
          description: 'The part number to get installation instructions for',
        },
      },
      required: ['part_number'],
    },
  },
  {
    name: 'troubleshoot_issue',
    description: 'Diagnose an appliance issue based on the customer\'s described symptoms and recommend the most likely replacement parts. Use this when the customer describes a problem without knowing which part they need.',
    input_schema: {
      type: 'object',
      properties: {
        symptom: {
          type: 'string',
          description: 'The issue or symptom the customer is experiencing (e.g. "ice maker not making ice", "dishwasher not draining")',
        },
        appliance_type: {
          type: 'string',
          enum: ['refrigerator', 'dishwasher'],
          description: 'The type of appliance',
        },
        model_number: {
          type: 'string',
          description: "Optional: the customer's model number for more specific recommendations",
        },
      },
      required: ['symptom', 'appliance_type'],
    },
  },
  {
    name: 'get_order_status',
    description: "Look up the status of an existing PartSelect order using the order number. Use when a customer asks about their order.",
    input_schema: {
      type: 'object',
      properties: {
        order_number: {
          type: 'string',
          description: 'The order number (e.g. PS-100421)',
        },
      },
      required: ['order_number'],
    },
  },
];

async function executeTool(name, input) {
  switch (name) {
    case 'search_parts': {
      const results = searchParts({
        query: input.query,
        category: input.category,
        max_results: Math.min(input.max_results || 3, 5),
      });
      return {
        found: results.length > 0,
        count: results.length,
        products: results,
        message: results.length > 0
          ? `Found ${results.length} matching part(s) for "${input.query}".`
          : `No parts found matching "${input.query}". Try different keywords.`,
      };
    }

    case 'get_part_details': {
      const part = getPartByNumber(input.part_number);
      if (!part) {
        return {
          found: false,
          message: `Part number ${input.part_number} was not found in our catalog. Verify the part number at PartSelect.com.`,
        };
      }
      return { found: true, products: [part] };
    }

    case 'check_compatibility': {
      const result = checkCompatibility(input.part_number, input.model_number);
      return {
        ...result,
        products: result.found ? [getPartByNumber(input.part_number)].filter(Boolean) : [],
      };
    }

    case 'get_installation_guide': {
      const part = getPartByNumber(input.part_number);
      if (!part) {
        return {
          found: false,
          message: `Part ${input.part_number} not found in catalog.`,
        };
      }
      const guide = getInstallationGuide(input.part_number, part.part_type);
      return { ...guide, part };
    }

    case 'troubleshoot_issue': {
      const result = troubleshootIssue(input);
      return result;
    }

    case 'get_order_status': {
      const order = MOCK_ORDERS[input.order_number];
      if (!order) {
        return {
          found: false,
          message: `Order ${input.order_number} not found. Please verify your order number in your PartSelect account or confirmation email.`,
        };
      }
      return { found: true, order_number: input.order_number, ...order };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { toolDefinitions, executeTool };
