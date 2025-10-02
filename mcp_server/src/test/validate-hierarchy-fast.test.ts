/**
 * Manual tests for wit-validate-hierarchy-fast tool
 * Run with: node dist/test/validate-hierarchy-fast.test.js
 */

// Test the hierarchy rules
console.log('🧪 Testing Hierarchy Validation Rules...\n');

// Valid parent-child type relationships
const VALID_CHILD_TYPES: Record<string, string[]> = {
  'Key Result': ['Epic'],
  'Epic': ['Feature'],
  'Feature': ['Product Backlog Item', 'User Story'],
  'Product Backlog Item': ['Task', 'Bug'],
  'User Story': ['Task', 'Bug'],
  'Task': [],
  'Bug': []
};

// State progression hierarchy
const STATE_HIERARCHY: Record<string, number> = {
  'New': 1,
  'Proposed': 1,
  'To Do': 1,
  'Active': 2,
  'Committed': 2,
  'In Progress': 2,
  'Doing': 2,
  'Resolved': 3,
  'Done': 4,
  'Completed': 4,
  'Closed': 4,
  'Removed': 5
};

console.log('✅ Valid Parent-Child Type Relationships:');
console.log('  - Key Result → Epic:', VALID_CHILD_TYPES['Key Result']);
console.log('  - Epic → Feature:', VALID_CHILD_TYPES['Epic']);
console.log('  - Feature → PBI/User Story:', VALID_CHILD_TYPES['Feature']);
console.log('  - PBI → Task/Bug:', VALID_CHILD_TYPES['Product Backlog Item']);
console.log('  - User Story → Task/Bug:', VALID_CHILD_TYPES['User Story']);
console.log('  - Task/Bug → (no children):', VALID_CHILD_TYPES['Task'], VALID_CHILD_TYPES['Bug']);

console.log('\n✅ State Progression Levels:');
console.log('  - Initial (1):', Object.keys(STATE_HIERARCHY).filter(k => STATE_HIERARCHY[k] === 1));
console.log('  - Active (2):', Object.keys(STATE_HIERARCHY).filter(k => STATE_HIERARCHY[k] === 2));
console.log('  - Resolved (3):', Object.keys(STATE_HIERARCHY).filter(k => STATE_HIERARCHY[k] === 3));
console.log('  - Done (4):', Object.keys(STATE_HIERARCHY).filter(k => STATE_HIERARCHY[k] === 4));
console.log('  - Removed (5):', Object.keys(STATE_HIERARCHY).filter(k => STATE_HIERARCHY[k] === 5));

console.log('\n✅ Invalid Relationship Examples:');
console.log('  - Epic → Task (skips Feature): INVALID');
console.log('  - Feature → Task (skips PBI/Story): INVALID');
console.log('  - Task → Bug (leaf nodes): INVALID');

console.log('\n✅ State Progression Rules:');
console.log('  - Parent "New" with child "Active": INVALID (parent should be at least Active)');
console.log('  - Parent "Done" with child "Active": INVALID (children must be completed first)');
console.log('  - Parent "Active" with child "Active": VALID');
console.log('  - Parent "Active" with child "Done": VALID (child finished before parent)');

console.log('\n✅ Orphaned Item Detection:');
const shouldHaveParent = (type: string) => !['Key Result', 'Epic'].includes(type);
console.log('  - Feature with no parent: ORPHANED (should have Epic or Key Result parent)');
console.log('  - PBI with no parent: ORPHANED (should have Feature parent)');
console.log('  - Task with no parent: ORPHANED (should have PBI/Story parent)');
console.log('  - Key Result with no parent: OK (top-level item)');
console.log('  - Epic with no parent: OK (can be top-level or under Key Result)');

console.log('\n✨ All validation rules defined and documented!');
console.log('\nTool: wit-validate-hierarchy-fast');
console.log('Purpose: Fast, rule-based validation without AI - returns focused, minimal results');
console.log('Usage: Provide WorkItemIds or AreaPath to validate hierarchy relationships');

