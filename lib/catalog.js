const { parts } = require('../data/parts.json');

function normalizeQuery(q) {
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function scoreMatch(part, query) {
  const q = normalizeQuery(query);
  const tokens = q.split(/\s+/).filter(Boolean);
  let score = 0;

  const fields = [
    normalizeQuery(part.name),
    normalizeQuery(part.description),
    part.symptoms.map(s => normalizeQuery(s)).join(' '),
    normalizeQuery(part.part_type || ''),
    part.compatible_brands.map(b => b.toLowerCase()).join(' '),
  ];

  for (const token of tokens) {
    for (const field of fields) {
      if (field.includes(token)) score += 1;
    }
  }

  // Exact part number match
  if (query.toLowerCase() === part.part_number.toLowerCase()) score += 100;
  if (query.toLowerCase().includes(part.part_number.toLowerCase())) score += 50;

  // Symptom match boost
  for (const symptom of part.symptoms) {
    if (normalizeQuery(symptom).includes(q) || q.includes(normalizeQuery(symptom))) {
      score += 10;
    }
  }

  return score;
}

function searchParts({ query, category, max_results = 3 }) {
  let candidates = parts;

  if (category) {
    candidates = candidates.filter(p => p.category === category);
  }

  const scored = candidates
    .map(p => ({ part: p, score: scoreMatch(p, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max_results)
    .map(({ part }) => part);

  return scored;
}

function getPartByNumber(part_number) {
  return parts.find(
    p => p.part_number.toLowerCase() === part_number.toLowerCase()
  ) || null;
}

function checkCompatibility(part_number, model_number) {
  const part = getPartByNumber(part_number);
  if (!part) {
    return {
      found: false,
      message: `Part number ${part_number} was not found in our catalog.`,
    };
  }

  const normalModel = model_number.trim().toUpperCase();
  const compatible = part.compatible_models.some(
    m => m.toUpperCase() === normalModel || m.toUpperCase().startsWith(normalModel)
  );

  return {
    found: true,
    compatible,
    part_number: part.part_number,
    part_name: part.name,
    model_number,
    compatible_brands: part.compatible_brands,
    message: compatible
      ? `Part ${part.part_number} (${part.name}) is compatible with model ${model_number}.`
      : `Part ${part.part_number} (${part.name}) is not compatible with model ${model_number}. This part fits: ${part.compatible_brands.join(', ')} models including ${part.compatible_models.slice(0, 4).join(', ')}.`,
  };
}

function getPartsBySymptom(symptom, category) {
  let candidates = category ? parts.filter(p => p.category === category) : parts;
  const q = normalizeQuery(symptom);

  return candidates
    .filter(p => p.symptoms.some(s => normalizeQuery(s).includes(q) || q.includes(normalizeQuery(s))))
    .slice(0, 4);
}

module.exports = { searchParts, getPartByNumber, checkCompatibility, getPartsBySymptom };
