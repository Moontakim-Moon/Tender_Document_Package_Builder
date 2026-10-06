import test from 'node:test';
import assert from 'node:assert/strict';

function escapeCSV(value) {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateCsvChecklist(statuses, _tenderId, language) {
  const BOM = '\uFEFF';
  const headers = language === 'bn'
    ? ['ক্রম', 'ডকুমেন্ট (বাংলা)', 'ডকুমেন্ট (ইংরেজি)', 'ফাইলের নাম', 'পৃষ্ঠা', 'মেয়াদ তারিখ', 'অবস্থা']
    : ['Order', 'Document (English)', 'Document (Bangla)', 'File Name', 'Pages', 'Expiry Date', 'Status'];

  const statusLabels = {
    missing: { en: 'Missing', bn: 'অনুপস্থিত' },
    expiry_needed: { en: 'Expiry Date Needed', bn: 'মেয়াদ তারিখ প্রয়োজন' },
    expired: { en: 'Expired', bn: 'মেয়াদ শেষ' },
    not_provided: { en: 'Not Provided', bn: 'প্রদান করা হয়নি' },
    ok: { en: 'OK', bn: 'ঠিক আছে' },
  };

  const rows = statuses.map((s) => {
    const cells = [
      String(s.requirement.order),
      s.requirement.title_en,
      s.requirement.title_bn,
      s.matchedFile?.name ?? '',
      s.matchedFile?.pageCount != null ? String(s.matchedFile.pageCount) : '',
      s.expiryDate ?? '',
      statusLabels[s.status]?.[language] ?? s.status,
    ];
    return cells.map(escapeCSV).join(',');
  });

  const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  return BOM + csvContent;
}

function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[_\-./\\]/g, ' ')
    .replace(/[^a-z0-9\s\u0980-\u09FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityScore(a, b) {
  if (!a || !b) return 0;
  const tokensA = new Set(a.split(' ').filter(Boolean));
  const tokensB = new Set(b.split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let matches = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) matches++;
    else {
      tokensB.forEach((bToken) => {
        if (token.length > 3 && (token.includes(bToken) || bToken.includes(token))) {
          matches += 0.5;
        }
      });
    }
  });

  return matches / Math.max(tokensA.size, tokensB.size);
}

function generateSmartMatchSuggestions(fileName, requirements) {
  const normalizedFile = normalizeString(fileName.replace(/\.[^.]+$/, ''));
  const suggestions = requirements.map((req) => {
    const scoreEn = similarityScore(normalizedFile, normalizeString(req.title_en));
    const scoreBn = similarityScore(normalizedFile, normalizeString(req.title_bn));
    const scoreId = similarityScore(normalizedFile, normalizeString(req.id));
    const maxScore = Math.max(scoreEn, scoreBn, scoreId);
    return {
      requirementId: req.id,
      title: req.title_en,
      score: maxScore,
    };
  });

  return suggestions
    .filter((s) => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

test('CSV Checklist Generation (UTF-8 BOM + Bilingual)', () => {
  const dummyStatuses = [
    {
      requirement: { order: 1, title_en: 'Trade License', title_bn: 'ট্রেড লাইসেন্স' },
      matchedFile: { name: 'trade_license_2026.pdf', pageCount: 3 },
      expiryDate: '2026-12-31',
      status: 'ok',
    },
    {
      requirement: { order: 2, title_en: 'TIN Certificate', title_bn: 'টিআইএন সার্টিফিকেট' },
      matchedFile: null,
      expiryDate: undefined,
      status: 'missing',
    },
  ];

  const csvEn = generateCsvChecklist(dummyStatuses, 'T-001', 'en');
  assert.ok(csvEn.startsWith('\uFEFF'), 'Must start with UTF-8 BOM for Excel compatibility');
  assert.ok(csvEn.includes('Order,Document (English)'), 'Contains English headers');
  assert.ok(csvEn.includes('Trade License'), 'Contains document title');
  assert.ok(csvEn.includes('OK'), 'Contains English OK status');
  assert.ok(csvEn.includes('Missing'), 'Contains English Missing status');

  const csvBn = generateCsvChecklist(dummyStatuses, 'T-001', 'bn');
  assert.ok(csvBn.startsWith('\uFEFF'));
  assert.ok(csvBn.includes('ক্রম,ডকুমেন্ট (বাংলা)'), 'Contains Bangla headers');
  assert.ok(csvBn.includes('ট্রেড লাইসেন্স'));
  assert.ok(csvBn.includes('ঠিক আছে'));
  assert.ok(csvBn.includes('অনুপস্থিত'));
});

test('Smart Match Suggestions', () => {
  const requirements = [
    { id: 'trade_license', title_en: 'Trade License', title_bn: 'ট্রেড লাইসেন্স' },
    { id: 'tin_certificate', title_en: 'TIN Certificate', title_bn: 'টিআইএন সার্টিফিকেট' },
    { id: 'bank_solvency', title_en: 'Bank Solvency Certificate', title_bn: 'ব্যাংক সলভেন্সি' },
  ];

  const match1 = generateSmartMatchSuggestions('my_trade_license_copy.pdf', requirements);
  assert.ok(match1.length > 0);
  assert.equal(match1[0].requirementId, 'trade_license');

  const match2 = generateSmartMatchSuggestions('bank_solvency_jan2026.pdf', requirements);
  assert.ok(match2.length > 0);
  assert.equal(match2[0].requirementId, 'bank_solvency');
});
