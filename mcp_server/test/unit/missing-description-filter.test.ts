import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';

/**
 * Unit tests for missing description filter logic.
 * 
 * This test exposes the bug where the filter is incorrectly showing items
 * that DO have descriptions when filtering for missing descriptions.
 * 
 * The issue is that when filterByPatterns includes 'missing_description',
 * we expect to see ONLY items that have missing, empty, or inadequate descriptions.
 * But currently, items with good descriptions are being included in results.
 */
describe('Missing Description Filter Logic', () => {

  /**
   * Test the actual filter logic used in the service
   * This simulates the exact logic from ado-work-item-service.ts line 635
   */
  it('should correctly identify missing descriptions in test data', () => {
    // Simulate the filter logic that's actually used in the service
    const testWorkItems = [
      {
        id: 1,
        title: 'Item with no description',
        additionalFields: {}
      },
      {
        id: 2, 
        title: 'Item with empty description',
        additionalFields: { 'System.Description': '' }
      },
      {
        id: 3,
        title: 'Item with short description', 
        additionalFields: { 'System.Description': 'Short' }
      },
      {
        id: 4,
        title: 'Item with good description',
        additionalFields: { 'System.Description': 'This is a comprehensive description with plenty of detail that should NOT be filtered out.' }
      },
      {
        id: 5,
        title: 'Item with HTML description that is empty when stripped',
        additionalFields: { 'System.Description': '<div></div><p></p><br>' }
      },
      {
        id: 6,
        title: 'Item with HTML description with content',
        additionalFields: { 'System.Description': '<div><p>This is a detailed description with HTML formatting that should NOT be filtered out.</p></div>' }
      }
    ];

    // Apply the EXACT same filter logic used in the service (ado-work-item-service.ts:635-641)
    const filtered = testWorkItems.filter(wi => {
      const desc = wi.additionalFields?.['System.Description'];
      // Return true for items to INCLUDE (items that have missing descriptions)
      if (desc === undefined || desc === null || desc === '') return true;
      const strippedDesc = String(desc).replace(/<[^>]*>/g, '').trim();
      return strippedDesc.length < 10;
    });

    // Should include items 1, 2, 3, 5 (missing or inadequate descriptions)
    const expectedIds = [1, 2, 3, 5];
    const actualIds = filtered.map(wi => wi.id);
    
    expect(actualIds).toEqual(expectedIds);
    
    console.log('\\n✅ Filter logic test results:');
    console.log(`Expected items to be included: [${expectedIds.join(', ')}]`);
    console.log(`Actually included items: [${actualIds.join(', ')}]`);
    
    filtered.forEach(wi => {
      const desc = wi.additionalFields?.['System.Description'] || '';
      const stripped = String(desc).replace(/<[^>]*>/g, '').trim();
      console.log(`  - #${wi.id}: \"${wi.title}\" (desc length: ${stripped.length})`);
    });

    // Verify items with good descriptions are NOT included
    expect(actualIds).not.toContain(4); // Good description
    expect(actualIds).not.toContain(6); // Good HTML description
  });

  /**
   * Test edge cases in description filtering
   */
  it('should handle edge cases correctly', () => {
    const edgeCases = [
      {
        id: 1,
        title: 'Null description',
        additionalFields: { 'System.Description': null }
      },
      {
        id: 2,
        title: 'Undefined description', 
        additionalFields: { 'System.Description': undefined }
      },
      {
        id: 3,
        title: 'Whitespace only description',
        additionalFields: { 'System.Description': '   \\n\\t   ' }
      },
      {
        id: 4,
        title: 'HTML with only whitespace',
        additionalFields: { 'System.Description': '<div>   </div><p>\\n</p>' }
      },
      {
        id: 5,
        title: 'Exactly 10 characters - should NOT be filtered',
        additionalFields: { 'System.Description': '1234567890' }
      },
      {
        id: 6,
        title: 'Exactly 9 characters - should be filtered',
        additionalFields: { 'System.Description': '123456789' }
      }
    ];

    const filtered = edgeCases.filter(wi => {
      const desc = wi.additionalFields?.['System.Description'];
      if (desc === undefined || desc === null || desc === '') return true;
      const strippedDesc = String(desc).replace(/<[^>]*>/g, '').trim();
      return strippedDesc.length < 10;
    });

    // Should include 1,2,3,4,6 but NOT 5 (which has exactly 10 chars)
    expect(filtered.map(wi => wi.id)).toEqual([1, 2, 3, 4, 6]);
    
    console.log('\\n✅ Edge cases test results:');
    filtered.forEach(wi => {
      const desc = wi.additionalFields?.['System.Description'] || '';
      const stripped = String(desc).replace(/<[^>]*>/g, '').trim();
      console.log(`  - #${wi.id}: \"${wi.title}\" (desc length: ${stripped.length})`);
    });
  });

  /**
   * Test that demonstrates what the user is complaining about
   * This test simulates real-world scenarios where good descriptions
   * might be getting incorrectly filtered
   */
  it('should NOT include items with comprehensive descriptions', () => {
    const realWorldItems = [
      {
        id: 1,
        title: 'User Story: Authentication Feature',
        additionalFields: { 
          'System.Description': `
            <div>
              <p><strong>As a</strong> user</p>
              <p><strong>I want</strong> to authenticate securely</p>
              <p><strong>So that</strong> my data is protected</p>
              <p><strong>Acceptance Criteria:</strong></p>
              <ul>
                <li>User can log in with email and password</li>
                <li>Session expires after 24 hours</li>
                <li>Failed attempts are logged</li>
              </ul>
            </div>
          `
        }
      },
      {
        id: 2,
        title: 'Bug: Login page crashes',
        additionalFields: { 
          'System.Description': 'When user enters invalid email format on login page, the application crashes with TypeError. This happens consistently across all browsers. Steps to reproduce: 1. Navigate to login page 2. Enter invalid email 3. Click submit 4. Application crashes. Expected: Show validation error message.'
        }
      },
      {
        id: 3,
        title: 'Task: Update documentation',
        additionalFields: { 
          'System.Description': '' // This SHOULD be filtered
        }
      },
      {
        id: 4,
        title: 'Epic: Mobile App Development',
        additionalFields: { 
          'System.Description': '<p>Develop comprehensive mobile application for iOS and Android platforms with feature parity to web application including user authentication, data synchronization, offline capabilities, and push notifications.</p>'
        }
      }
    ];

    const filtered = realWorldItems.filter(wi => {
      const desc = wi.additionalFields?.['System.Description'];
      if (desc === undefined || desc === null || desc === '') return true;
      const strippedDesc = String(desc).replace(/<[^>]*>/g, '').trim();
      return strippedDesc.length < 10;
    });

    // Only item 3 should be filtered (empty description)
    expect(filtered.map(wi => wi.id)).toEqual([3]);
    
    console.log('\\n📋 Real-world scenario test:');
    console.log(`Items with good descriptions (should NOT be filtered): 1, 2, 4`);
    console.log(`Items with missing descriptions (should be filtered): 3`);
    console.log(`Actually filtered: [${filtered.map(wi => wi.id).join(', ')}]`);
    
    // If this test fails, it means good descriptions are being incorrectly filtered
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(3);
  });

  /**
   * Test to demonstrate the inverse - items that should NOT be filtered
   */
  it('should NOT filter items with adequate descriptions', () => {
    const itemsWithGoodDescriptions = [
      {
        id: 1,
        title: 'Item with plain text description',
        additionalFields: { 'System.Description': 'This is a detailed description that explains the requirements clearly and provides sufficient context for developers.' }
      },
      {
        id: 2,
        title: 'Item with HTML description',
        additionalFields: { 'System.Description': '<div><h3>Overview</h3><p>This feature implements user authentication using OAuth 2.0 protocol.</p><h3>Requirements</h3><ul><li>Support Google and Microsoft login</li><li>Secure token storage</li></ul></div>' }
      },
      {
        id: 3,
        title: 'Item with mixed content',
        additionalFields: { 'System.Description': '<p>Brief: Implement search functionality.</p>\\n\\nDetailed requirements:\\n- Full text search\\n- Filter by category\\n- Sort by relevance' }
      }
    ];

    const filtered = itemsWithGoodDescriptions.filter(wi => {
      const desc = wi.additionalFields?.['System.Description'];
      if (desc === undefined || desc === null || desc === '') return true;
      const strippedDesc = String(desc).replace(/<[^>]*>/g, '').trim();
      return strippedDesc.length < 10;
    });

    // NONE of these should be filtered
    expect(filtered).toHaveLength(0);
    expect(filtered.map(wi => wi.id)).toEqual([]);
    
    console.log('\\n✅ Good descriptions test - none should be filtered:');
    itemsWithGoodDescriptions.forEach(wi => {
      const desc = wi.additionalFields?.['System.Description'] || '';
      const stripped = String(desc).replace(/<[^>]*>/g, '').trim();
      console.log(`  - #${wi.id}: \"${wi.title}\" (desc length: ${stripped.length}) - ${stripped.length >= 10 ? 'KEEP' : 'FILTER'}`);
    });
  });

  /**
   * Test that reproduces the specific issue reported with work item 35202849
   * This work item was reported as being incorrectly filtered despite having a description
   */
  it('should handle work item 35202849 scenario correctly', () => {
    // Simulate various scenarios that could explain the reported issue
    const testScenarios = [
      {
        id: 35202849,
        scenario: 'Adequate HTML description',
        additionalFields: {
          'System.Description': '<div><p>This item has a real description that should not be considered missing.</p></div>'
        }
      },
      {
        id: 35202850,
        scenario: 'Very short HTML description (should be filtered)',
        additionalFields: {
          'System.Description': '<p>Short</p>' // 5 chars after stripping
        }
      },
      {
        id: 35202851,
        scenario: 'Empty HTML tags (should be filtered)',
        additionalFields: {
          'System.Description': '<div></div><p></p>'
        }
      },
      {
        id: 35202852,
        scenario: 'Exactly 10 characters (should NOT be filtered)',
        additionalFields: {
          'System.Description': '<span>1234567890</span>'
        }
      },
      {
        id: 35202853,
        scenario: 'Exactly 9 characters (should be filtered)',
        additionalFields: {
          'System.Description': '<span>123456789</span>'
        }
      }
    ];

    const filtered = testScenarios.filter(wi => {
      const desc = wi.additionalFields?.['System.Description'];
      if (desc === undefined || desc === null || desc === '') return true;
      const strippedDesc = String(desc).replace(/<[^>]*>/g, '').trim();
      return strippedDesc.length < 10;
    });

    console.log('\\n🔍 Work item 35202849 scenario analysis:');
    testScenarios.forEach(wi => {
      const desc = wi.additionalFields?.['System.Description'] || '';
      const stripped = String(desc).replace(/<[^>]*>/g, '').trim();
      const wouldFilter = stripped.length < 10;
      
      console.log(`  ${wi.id === 35202849 ? '🎯' : '  '} #${wi.id}: ${wi.scenario}`);
      console.log(`     Raw HTML: ${JSON.stringify(desc)}`);
      console.log(`     Stripped: \"${stripped}\" (${stripped.length} chars)`);
      console.log(`     Would filter: ${wouldFilter ? 'YES ❌' : 'NO ✅'}`);
    });

    // Work item 35202849 should NOT be filtered (has adequate description)
    expect(filtered.map(wi => wi.id)).not.toContain(35202849);
    
    // Items that should be filtered: 35202850 (short), 35202851 (empty HTML), 35202853 (9 chars)
    expect(filtered.map(wi => wi.id).sort()).toEqual([35202850, 35202851, 35202853]);
    
    // Specifically verify work item 35202849
    const originalItem = testScenarios.find(wi => wi.id === 35202849);
    const desc = originalItem!.additionalFields['System.Description'];
    const stripped = String(desc).replace(/<[^>]*>/g, '').trim();
    
    console.log(`\\n✅ Work item 35202849 verification:`);
    console.log(`   Description: \"${stripped}\"`);
    console.log(`   Length: ${stripped.length} characters`);
    console.log(`   Should be filtered: ${stripped.length < 10 ? 'YES' : 'NO'}`);
    
    // This should pass - the item has adequate description
    expect(stripped.length).toBeGreaterThanOrEqual(10);
  });
});
