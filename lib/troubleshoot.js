const { getPartsBySymptom, searchParts } = require('./catalog');

const DIAGNOSTIC_FLOWS = {
  refrigerator: [
    {
      patterns: ['ice maker', 'no ice', 'ice not making', 'not producing ice', 'ice maker broken', 'ice maker stopped'],
      diagnosis: 'Ice maker failure',
      explanation: 'The most common causes are a failed ice maker assembly, a blocked water supply, or a faulty water inlet valve. Start by checking that the wire shutoff arm is in the down position and water is reaching the refrigerator.',
      primary_parts: ['PS11752778', 'PS2358533'],
      secondary_parts: ['PS11750593'],
    },
    {
      patterns: ['not cooling', 'warm fridge', 'refrigerator not cold', 'refrigerator warm entire', 'not cold enough', 'stopped cooling', 'not keeping cold', 'entire fridge warm', 'whole refrigerator warm'],
      diagnosis: 'Refrigerator not cooling',
      explanation: 'If the freezer is still cold but the fresh food section is warm, the evaporator fan motor is likely failed. If the entire unit is warm, suspect the compressor start relay or defrost system.',
      primary_parts: ['PS12584916', 'PS11746329'],
      secondary_parts: ['PS11770398', 'PS11770397'],
    },
    {
      patterns: ['freezer cold refrigerator warm', 'fridge section warm', 'freezer works refrigerator doesnt', 'refrigerator compartment warm', 'fridge warm freezer cold', 'freezer cold fridge warm', 'freezer fine refrigerator warm', 'freezer ok fridge warm'],
      diagnosis: 'Evaporator fan failure',
      explanation: 'When the freezer is cold but the refrigerator section is warm, the evaporator fan motor is almost always the cause. The fan circulates cold air from the freezer into the fresh food section.',
      primary_parts: ['PS12584916'],
      secondary_parts: [],
    },
    {
      patterns: ['water dispenser not working', 'no water', 'dispenser stopped', 'water not coming out'],
      diagnosis: 'Water supply issue',
      explanation: 'A non-functioning water dispenser is usually caused by a clogged water filter, failed water inlet valve, or frozen supply line. Start with the water filter — it\'s the easiest fix.',
      primary_parts: ['PS11748465', 'PS11750593'],
      secondary_parts: [],
    },
    {
      patterns: ['frost buildup', 'frost in freezer', 'excessive frost', 'freezer frosted', 'ice on walls', 'ice on back of freezer'],
      diagnosis: 'Defrost system failure',
      explanation: 'Excessive frost buildup points to a defrost system problem — usually a failed defrost heater or defrost timer. The defrost heater melts frost from the evaporator coils during the automatic defrost cycle.',
      primary_parts: ['PS11770398', 'PS11770397'],
      secondary_parts: ['PS12584916'],
    },
    {
      patterns: ['clicking noise', 'compressor clicking', 'refrigerator clicking', 'compressor not starting'],
      diagnosis: 'Compressor start relay failure',
      explanation: 'A clicking sound every few minutes is the classic symptom of a failed start relay. The compressor tries to start, fails, and the overload protector clicks off. The start relay is inexpensive and easy to replace.',
      primary_parts: ['PS11746329'],
      secondary_parts: [],
    },
    {
      patterns: ['door not sealing', 'door gasket', 'door seal', 'condensation', 'running constantly', 'door warm'],
      diagnosis: 'Door gasket failure',
      explanation: 'A torn or compressed door gasket allows warm air to enter, causing the refrigerator to run constantly and form condensation. The "dollar bill test" confirms: if a bill slides freely from the closed door, the seal has failed.',
      primary_parts: ['PS11752784'],
      secondary_parts: [],
    },
    {
      patterns: ['leaking water', 'water on floor', 'water pooling', 'dripping'],
      diagnosis: 'Water leak',
      explanation: 'Refrigerator leaks typically come from a cracked water filter, failed water inlet valve, or a clogged defrost drain. Check the water supply connections and the door gasket first.',
      primary_parts: ['PS11750593', 'PS11748465'],
      secondary_parts: ['PS11752784'],
    },
  ],

  dishwasher: [
    {
      patterns: ['not draining', 'standing water', 'water in bottom', 'wont drain', 'water left after cycle'],
      diagnosis: 'Drain system blockage or pump failure',
      explanation: 'Standing water after a cycle is caused by a blocked filter, clogged drain hose, or a failed drain pump motor. Always start by cleaning the filter — it\'s the most common cause and requires no parts.',
      primary_parts: ['PS11748050'],
      secondary_parts: ['PS3408057'],
      check_first: 'Remove and clean the filter basket under the lower spray arm. Check the drain hose for kinks.',
    },
    {
      patterns: ['not cleaning', 'dirty dishes', 'dishes not clean', 'food residue', 'not washing properly'],
      diagnosis: 'Poor wash performance',
      explanation: 'Dishes coming out dirty is usually caused by clogged spray arms, a failing wash pump, or insufficient detergent. Start by cleaning or replacing the spray arms — clogged holes are extremely common.',
      primary_parts: ['PS11765789', 'PS11752524'],
      secondary_parts: ['PS3408057', 'PS11765901'],
      check_first: 'Remove spray arms and clear any clogged holes with a toothpick. Ensure you\'re using the correct amount of detergent.',
    },
    {
      patterns: ['door wont close', 'door wont latch', 'not starting', 'wont run', 'door latch', 'door broken'],
      diagnosis: 'Door latch assembly failure',
      explanation: 'If the dishwasher door won\'t stay closed or the machine won\'t start despite the door being closed, the door latch assembly is likely failed. The latch completes a safety circuit that allows the dishwasher to start.',
      primary_parts: ['PS11747476'],
      secondary_parts: [],
    },
    {
      patterns: ['leaking', 'water on floor', 'leaking from door', 'water leaking during cycle'],
      diagnosis: 'Door seal leak',
      explanation: 'Water leaking from the door edge indicates a worn or torn door gasket/seal. Water pooling from the front during the cycle is the key symptom.',
      primary_parts: ['PS11752148'],
      secondary_parts: ['PS11752999'],
    },
    {
      patterns: ['not drying', 'wet dishes', 'dishes still wet', 'not heating', 'cold water', 'dishes wet', 'still wet after', 'wet after cycle', 'dishes not dry', 'glasses still wet'],
      diagnosis: 'Heating element failure',
      explanation: 'Dishes remaining wet after the dry cycle almost always indicates a failed heating element. The element also heats wash water — cold water means poor cleaning and poor drying.',
      primary_parts: ['PS11748043'],
      secondary_parts: [],
    },
    {
      patterns: ['soap not dispensing', 'detergent not releasing', 'soap stuck', 'detergent door', 'soap cup'],
      diagnosis: 'Detergent dispenser failure',
      explanation: 'If the soap dispenser door doesn\'t open during the wash cycle, the dispenser mechanism or its wax motor has failed. This causes dishes to be poorly cleaned even with a good spray arm and heating element.',
      primary_parts: ['PS11765901'],
      secondary_parts: [],
    },
    {
      patterns: ['loud noise', 'grinding noise', 'rattling', 'humming', 'squealing', 'noisy dishwasher'],
      diagnosis: 'Pump or wash motor noise',
      explanation: 'Grinding or rattling during the wash cycle is often a foreign object in the pump, a failing wash pump motor, or a damaged spray arm bearing. Check for broken glass or debris in the filter first.',
      primary_parts: ['PS3408057'],
      secondary_parts: ['PS11765789', 'PS11752524'],
      check_first: 'Clean the filter and check for broken glass or debris in the sump area.',
    },
    {
      patterns: ['not starting', 'wont turn on', 'control panel not working', 'error code', 'lights flashing', 'control board'],
      diagnosis: 'Control board or door latch issue',
      explanation: 'If the dishwasher shows error codes or won\'t respond to controls, the control board may have failed. However, first check the door latch — a faulty latch prevents the machine from starting entirely.',
      primary_parts: ['PS11747476', 'PS8766820'],
      secondary_parts: [],
    },
    {
      patterns: ['upper rack', 'top rack falling', 'rack wont adjust', 'rack broken', 'rack slides out'],
      diagnosis: 'Rack adjuster failure',
      explanation: 'The plastic rack adjusters that allow the upper rack to slide and lock at different heights commonly break. The fix is a direct bolt-on replacement kit.',
      primary_parts: ['PS11765433'],
      secondary_parts: [],
    },
  ],
};

function troubleshootIssue({ symptom, appliance_type, model_number }) {
  const flows = DIAGNOSTIC_FLOWS[appliance_type] || [];
  const normalSymptom = symptom.toLowerCase().replace(/[^a-z0-9\s]/g, '');

  let matched = null;
  let bestScore = 0;

  for (const flow of flows) {
    let score = 0;
    for (const pattern of flow.patterns) {
      if (normalSymptom.includes(pattern) || pattern.includes(normalSymptom)) {
        score += pattern.length;
      }
      const patternWords = pattern.split(' ');
      for (const word of patternWords) {
        if (word.length > 3 && normalSymptom.includes(word)) score += 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      matched = flow;
    }
  }

  if (!matched) {
    // Fallback: search catalog by symptom
    const fallbackParts = getPartsBySymptom(symptom, appliance_type);
    return {
      diagnosis: 'Appliance issue',
      explanation: `Based on your description, here are the most likely parts needed for "${symptom}" on your ${appliance_type}.`,
      primary_parts: fallbackParts,
      secondary_parts: [],
      model_number: model_number || null,
      check_first: null,
    };
  }

  const partsData = require('../data/parts.json').parts;

  const primaryParts = matched.primary_parts
    .map(pn => partsData.find(p => p.part_number === pn))
    .filter(Boolean);

  const secondaryParts = matched.secondary_parts
    .map(pn => partsData.find(p => p.part_number === pn))
    .filter(Boolean);

  return {
    diagnosis: matched.diagnosis,
    explanation: matched.explanation,
    check_first: matched.check_first || null,
    primary_parts: primaryParts,
    secondary_parts: secondaryParts,
    model_number: model_number || null,
  };
}

module.exports = { troubleshootIssue };
