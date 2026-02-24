import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExpressionForRow, parseQueryExpression, type SemanticRow } from './semanticSearch.js';

const makeRow = (status: string, title = 'Sample task'): SemanticRow => ({
  id: 't-1',
  title,
  status,
  priority: 'MEDIUM',
  due_date: null,
  project_id: 'p-1',
  project_name: 'Project One',
  score: 0.9,
});

test('parseQueryExpression handles "find todo" as a TODO status condition', () => {
  const expression = parseQueryExpression('find todo');
  assert.equal(expression.hasBooleanOperators, false);
  assert.equal(expression.conditions.length, 1);
  assert.deepEqual(expression.conditions[0], { type: 'status', value: 'TODO' });
});

test('evaluateExpressionForRow matches TODO row for "find todo"', () => {
  const expression = parseQueryExpression('find todo');
  assert.equal(evaluateExpressionForRow(makeRow('TODO'), expression), true);
  assert.equal(evaluateExpressionForRow(makeRow('DONE'), expression), false);
});

test('parse/evaluate boolean expression still works', () => {
  const expression = parseQueryExpression('todo and api');
  assert.equal(evaluateExpressionForRow(makeRow('TODO', 'API cleanup task'), expression), true);
  assert.equal(evaluateExpressionForRow(makeRow('TODO', 'UI polish task'), expression), false);
});

test('parse/evaluate "find polish or todo" includes polish terms and TODO status', () => {
  const expression = parseQueryExpression('find polish or todo');
  assert.deepEqual(
    expression.conditions,
    [
      { type: 'term', value: 'polish' },
      { type: 'status', value: 'TODO' },
    ],
  );
  assert.deepEqual(expression.operators, ['or']);
  assert.equal(evaluateExpressionForRow(makeRow('IN_REVIEW', 'Polish account settings UI'), expression), true);
  assert.equal(evaluateExpressionForRow(makeRow('TODO', 'Implement endpoint'), expression), true);
});
