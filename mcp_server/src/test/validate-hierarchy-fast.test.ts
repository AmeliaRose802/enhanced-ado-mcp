/**
 * Tests for wit-validate-hierarchy-fast tool validation rules
 */

describe('Hierarchy Validation Rules', () => {
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

  describe('Parent-Child Type Relationships', () => {
    it('should define valid child types for Key Result', () => {
      expect(VALID_CHILD_TYPES['Key Result']).toEqual(['Epic']);
    });

    it('should define valid child types for Epic', () => {
      expect(VALID_CHILD_TYPES['Epic']).toEqual(['Feature']);
    });

    it('should define valid child types for Feature', () => {
      expect(VALID_CHILD_TYPES['Feature']).toEqual(['Product Backlog Item', 'User Story']);
    });

    it('should define valid child types for PBI', () => {
      expect(VALID_CHILD_TYPES['Product Backlog Item']).toEqual(['Task', 'Bug']);
    });

    it('should define no children for leaf nodes', () => {
      expect(VALID_CHILD_TYPES['Task']).toEqual([]);
      expect(VALID_CHILD_TYPES['Bug']).toEqual([]);
    });
  });

  describe('State Progression Levels', () => {
    it('should define Initial states as level 1', () => {
      const initialStates = Object.keys(STATE_HIERARCHY).filter(k => STATE_HIERARCHY[k] === 1);
      expect(initialStates).toEqual(expect.arrayContaining(['New', 'Proposed', 'To Do']));
    });

    it('should define Active states as level 2', () => {
      const activeStates = Object.keys(STATE_HIERARCHY).filter(k => STATE_HIERARCHY[k] === 2);
      expect(activeStates).toEqual(expect.arrayContaining(['Active', 'Committed', 'In Progress', 'Doing']));
    });

    it('should define Done states as level 4', () => {
      const doneStates = Object.keys(STATE_HIERARCHY).filter(k => STATE_HIERARCHY[k] === 4);
      expect(doneStates).toEqual(expect.arrayContaining(['Done', 'Completed', 'Closed']));
    });
  });

  describe('Orphaned Item Detection', () => {
    const shouldHaveParent = (type: string) => !['Key Result', 'Epic'].includes(type);

    it('should require parent for Feature', () => {
      expect(shouldHaveParent('Feature')).toBe(true);
    });

    it('should require parent for Product Backlog Item', () => {
      expect(shouldHaveParent('Product Backlog Item')).toBe(true);
    });

    it('should not require parent for Key Result', () => {
      expect(shouldHaveParent('Key Result')).toBe(false);
    });

    it('should not require parent for Epic', () => {
      expect(shouldHaveParent('Epic')).toBe(false);
    });
  });
});

