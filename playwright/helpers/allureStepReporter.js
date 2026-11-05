const { AllureReporter } = require('allure-playwright');

function fmt(value, max = 160) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) text = String(value);
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// Playwright expect steps carry { expected, locator? } in step.params but
// allure-playwright only writes step.title — values never reach the report.
class EnrichedAllureReporter extends AllureReporter {
  onStepBegin(test, result, step) {
    if (step.category === 'expect' && step.params && !step.__enriched) {
      const bits = [];
      if ('expected' in step.params) bits.push(`expected: ${fmt(step.params.expected)}`);
      if (step.params.locator) bits.push(step.params.locator);
      if (bits.length) step.title = `${step.title} (${bits.join(', ')})`;
      step.__enriched = true;
    }
    super.onStepBegin(test, result, step);
  }
}

module.exports = EnrichedAllureReporter;
