import test from 'node:test';
import assert from 'node:assert/strict';

// Test implementation of pure business logic functions (identical to src/lib/validation.ts and export.ts)

function compareDates(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isValidDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function evaluateRequirementStatus(requirement, matchedFile, expiryDate, submissionDeadline) {
  const hasMatch = matchedFile !== null;

  if (!hasMatch) {
    return requirement.mandatory ? 'missing' : 'not_provided';
  }

  if (requirement.has_expiry) {
    if (!expiryDate || expiryDate.trim() === '') {
      return 'expiry_needed';
    }
    const cmp = compareDates(expiryDate, submissionDeadline);
    if (cmp < 0) {
      return 'expired';
    }
  }

  return 'ok';
}

function isBlocking(status) {
  return status === 'missing' || status === 'expiry_needed' || status === 'expired';
}

function validateRequirementsJson(data) {
  if (!data || typeof data !== 'object') {
    return 'Root must be an object';
  }

  const obj = data;

  if (!obj.tender || typeof obj.tender !== 'object') {
    return 'Missing "tender" object';
  }

  const tender = obj.tender;
  const requiredTenderFields = [
    'tender_id',
    'title',
    'procuring_entity',
    'bidder',
    'submission_deadline',
  ];

  for (const field of requiredTenderFields) {
    if (!tender[field] || typeof tender[field] !== 'string') {
      return `Missing or invalid tender field: "${field}"`;
    }
  }

  const deadline = tender.submission_deadline;
  if (!isValidDate(deadline)) {
    return `Invalid submission_deadline: "${deadline}". Must be YYYY-MM-DD`;
  }

  if (!Array.isArray(obj.requirements)) {
    return 'Missing "requirements" array';
  }

  if (obj.requirements.length === 0) {
    return 'Requirements array is empty';
  }

  const ids = new Set();
  const orders = new Set();

  for (let i = 0; i < obj.requirements.length; i++) {
    const req = obj.requirements[i];
    if (!req || typeof req !== 'object') {
      return `Requirement at index ${i} is not an object`;
    }

    const r = req;

    if (!r.id || typeof r.id !== 'string' || r.id.trim() === '') {
      return `Requirement at index ${i} has missing or invalid "id"`;
    }

    if (ids.has(r.id)) {
      return `Duplicate requirement id: "${r.id}"`;
    }
    ids.add(r.id);

    if (typeof r.order !== 'number' || !Number.isInteger(r.order) || r.order < 0) {
      return `Requirement "${r.id}" has invalid "order" (must be non-negative integer)`;
    }

    if (orders.has(r.order)) {
      return `Duplicate order value: ${r.order}`;
    }
    orders.add(r.order);

    if (!r.title_en || typeof r.title_en !== 'string') {
      return `Requirement "${r.id}" missing "title_en"`;
    }

    if (!r.title_bn || typeof r.title_bn !== 'string') {
      return `Requirement "${r.id}" missing "title_bn"`;
    }

    if (typeof r.mandatory !== 'boolean') {
      return `Requirement "${r.id}" has invalid "mandatory" (must be boolean)`;
    }

    if (typeof r.has_expiry !== 'boolean') {
      return `Requirement "${r.id}" has invalid "has_expiry" (must be boolean)`;
    }
  }

  return null;
}

// Tests Suite

test('Date validation & comparison logic', () => {
  assert.equal(isValidDate('2026-12-31'), true);
  assert.equal(isValidDate('2026-02-28'), true);
  assert.equal(isValidDate('2026-02-29'), false); // 2026 is not a leap year
  assert.equal(isValidDate('not-a-date'), false);
  assert.equal(isValidDate(''), false);

  assert.equal(compareDates('2026-05-10', '2026-05-10'), 0);
  assert.equal(compareDates('2026-05-09', '2026-05-10'), -1);
  assert.equal(compareDates('2026-05-11', '2026-05-10'), 1);
});

test('Document status determination engine (Official Rulebook Spec)', () => {
  const deadline = '2026-06-01';

  // 1. Mandatory requirement without file -> missing
  const reqMandatory = { id: 'tax', mandatory: true, has_expiry: false };
  assert.equal(evaluateRequirementStatus(reqMandatory, null, undefined, deadline), 'missing');

  // 2. Optional requirement without file -> not_provided
  const reqOptional = { id: 'iso', mandatory: false, has_expiry: false };
  assert.equal(evaluateRequirementStatus(reqOptional, null, undefined, deadline), 'not_provided');

  // 3. Matched requirement without expiry -> ok
  const dummyFile = { id: 'f1', name: 'trade.pdf', size: 1024, pageCount: 2 };
  assert.equal(evaluateRequirementStatus(reqMandatory, dummyFile, undefined, deadline), 'ok');

  // 4. Requirement with expiry, but no date supplied -> expiry_needed
  const reqExpiry = { id: 'license', mandatory: true, has_expiry: true };
  assert.equal(evaluateRequirementStatus(reqExpiry, dummyFile, undefined, deadline), 'expiry_needed');
  assert.equal(evaluateRequirementStatus(reqExpiry, dummyFile, '', deadline), 'expiry_needed');

  // 5. Requirement with expiry before deadline -> expired
  assert.equal(evaluateRequirementStatus(reqExpiry, dummyFile, '2026-05-31', deadline), 'expired');

  // 6. Requirement with expiry exactly on deadline -> ok (rulebook: valid until end of deadline day)
  assert.equal(evaluateRequirementStatus(reqExpiry, dummyFile, '2026-06-01', deadline), 'ok');

  // 7. Requirement with expiry after deadline -> ok
  assert.equal(evaluateRequirementStatus(reqExpiry, dummyFile, '2027-01-01', deadline), 'ok');
});

test('Blocking issue detection', () => {
  assert.equal(isBlocking('missing'), true);
  assert.equal(isBlocking('expiry_needed'), true);
  assert.equal(isBlocking('expired'), true);
  assert.equal(isBlocking('ok'), false);
  assert.equal(isBlocking('not_provided'), false);
});

test('requirements.json Schema Validator', () => {
  const validData = {
    tender: {
      tender_id: 'TR-2026-001',
      title: 'Supply of IT Hardware',
      procuring_entity: 'Ministry of ICT',
      bidder: 'Acme Systems Ltd',
      submission_deadline: '2026-10-15',
    },
    requirements: [
      {
        id: 'trade_license',
        order: 1,
        title_en: 'Trade License',
        title_bn: 'ট্রেড লাইসেন্স',
        mandatory: true,
        has_expiry: true,
      },
      {
        id: 'tin_certificate',
        order: 2,
        title_en: 'TIN Certificate',
        title_bn: 'টিআইএন সার্টিফিকেট',
        mandatory: true,
        has_expiry: false,
      },
    ],
  };

  assert.equal(validateRequirementsJson(validData), null);

  // Missing tender field
  const invalidTender = JSON.parse(JSON.stringify(validData));
  delete invalidTender.tender.tender_id;
  assert.match(validateRequirementsJson(invalidTender), /Missing or invalid tender field/);

  // Invalid date format
  const invalidDate = JSON.parse(JSON.stringify(validData));
  invalidDate.tender.submission_deadline = '15-10-2026';
  assert.match(validateRequirementsJson(invalidDate), /Invalid submission_deadline/);

  // Duplicate IDs
  const duplicateId = JSON.parse(JSON.stringify(validData));
  duplicateId.requirements.push({
    id: 'trade_license',
    order: 3,
    title_en: 'Duplicate',
    title_bn: 'ডুপ্লিকেট',
    mandatory: false,
    has_expiry: false,
  });
  assert.match(validateRequirementsJson(duplicateId), /Duplicate requirement id/);

  // Duplicate order
  const duplicateOrder = JSON.parse(JSON.stringify(validData));
  duplicateOrder.requirements[1].order = 1;
  assert.match(validateRequirementsJson(duplicateOrder), /Duplicate order value/);
});
