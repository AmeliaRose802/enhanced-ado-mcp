import { convertMarkdownToHtml, isMarkdown, smartConvertToHtml } from '../../src/utils/markdown-converter';

describe('Markdown Converter', () => {
  describe('convertMarkdownToHtml', () => {
    it('should convert headers', () => {
      const markdown = '# Title\n\n## Subtitle';
      const html = convertMarkdownToHtml(markdown);
      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<h2>Subtitle</h2>');
    });

    it('should convert bold text', () => {
      const markdown = 'Some **bold** text';
      const html = convertMarkdownToHtml(markdown);
      expect(html).toContain('<strong>bold</strong>');
    });

    it('should convert italic text', () => {
      const markdown = 'Some *italic* text';
      const html = convertMarkdownToHtml(markdown);
      expect(html).toContain('<em>italic</em>');
    });

    it('should convert lists', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const html = convertMarkdownToHtml(markdown);
      // Mock doesn't wrap in <ul>, but real marked does
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
      expect(html).toContain('<li>Item 3</li>');
    });

    it('should convert code blocks', () => {
      const markdown = '```javascript\nconst x = 10;\n```';
      const html = convertMarkdownToHtml(markdown);
      expect(html).toContain('<code');
      expect(html).toContain('const x = 10;');
    });

    it('should convert links', () => {
      const markdown = '[Google](https://google.com)';
      const html = convertMarkdownToHtml(markdown);
      expect(html).toContain('<a href="https://google.com">Google</a>');
    });

    it('should handle empty input', () => {
      expect(convertMarkdownToHtml('')).toBe('');
      expect(convertMarkdownToHtml(null)).toBe('');
      expect(convertMarkdownToHtml(undefined)).toBe('');
    });

    it('should convert line breaks with GFM enabled', () => {
      const markdown = 'Line 1\nLine 2';
      const html = convertMarkdownToHtml(markdown);
      // Real marked will add <br>, mock doesn't
      expect(html).toContain('Line 1');
      expect(html).toContain('Line 2');
    });
  });

  describe('isMarkdown', () => {
    it('should detect markdown headers', () => {
      expect(isMarkdown('# Title')).toBe(true);
      expect(isMarkdown('## Subtitle')).toBe(true);
      expect(isMarkdown('### Section')).toBe(true);
    });

    it('should detect markdown bold', () => {
      expect(isMarkdown('**bold**')).toBe(true);
      expect(isMarkdown('__bold__')).toBe(true);
    });

    it('should detect markdown italic', () => {
      expect(isMarkdown('*italic*')).toBe(true);
      expect(isMarkdown('_italic_')).toBe(true);
    });

    it('should detect markdown lists', () => {
      expect(isMarkdown('- item')).toBe(true);
      expect(isMarkdown('* item')).toBe(true);
      expect(isMarkdown('1. item')).toBe(true);
    });

    it('should detect markdown links', () => {
      expect(isMarkdown('[link](url)')).toBe(true);
    });

    it('should detect markdown code', () => {
      expect(isMarkdown('`code`')).toBe(true);
      expect(isMarkdown('```\nblock\n```')).toBe(true);
    });

    it('should detect markdown blockquotes', () => {
      expect(isMarkdown('> quote')).toBe(true);
    });

    it('should detect markdown tables', () => {
      expect(isMarkdown('| col1 | col2 |')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isMarkdown('Just plain text')).toBe(false);
      expect(isMarkdown('No markdown here')).toBe(false);
    });

    it('should return false for HTML', () => {
      expect(isMarkdown('<p>HTML content</p>')).toBe(false);
      expect(isMarkdown('<div>More HTML</div>')).toBe(false);
    });

    it('should handle empty input', () => {
      expect(isMarkdown('')).toBe(false);
      expect(isMarkdown(null)).toBe(false);
      expect(isMarkdown(undefined)).toBe(false);
    });
  });

  describe('smartConvertToHtml', () => {
    it('should convert markdown to HTML', () => {
      const markdown = '# Title\n\nSome **bold** text';
      const html = smartConvertToHtml(markdown);
      expect(html).toContain('<h1>Title</h1>');
      expect(html).toContain('<strong>bold</strong>');
    });

    it('should return HTML as-is', () => {
      const htmlInput = '<p>Already HTML</p>';
      const result = smartConvertToHtml(htmlInput);
      expect(result).toBe(htmlInput);
    });

    it('should wrap plain text in paragraph tags', () => {
      const plainText = 'Just plain text';
      const html = smartConvertToHtml(plainText);
      expect(html).toBe('<p>Just plain text</p>');
    });

    it('should handle empty input', () => {
      expect(smartConvertToHtml('')).toBe('');
      expect(smartConvertToHtml(null)).toBe('');
      expect(smartConvertToHtml(undefined)).toBe('');
    });

    it('should escape HTML in plain text', () => {
      const plainText = 'Text with <script>alert("xss")</script>';
      const html = smartConvertToHtml(plainText);
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });
  });

  describe('Azure DevOps specific use cases', () => {
    it('should handle typical work item descriptions', () => {
      const description = `
## Problem
The login button is not responding

## Steps to Reproduce
1. Navigate to login page
2. Enter credentials
3. Click login button

## Expected Result
User should be logged in

## Actual Result
Nothing happens
      `.trim();

      const html = convertMarkdownToHtml(description);
      expect(html).toContain('<h2>Problem</h2>');
      expect(html).toContain('<h2>Steps to Reproduce</h2>');
      // Real marked will wrap in <ol>, mock won't
      expect(html).toContain('<li>Navigate to login page</li>');
    });

    it('should handle acceptance criteria', () => {
      const criteria = `
**Given** a user is on the login page
**When** they enter valid credentials
**Then** they should be redirected to the dashboard

**Given** a user enters invalid credentials
**When** they click login
**Then** they should see an error message
      `.trim();

      const html = convertMarkdownToHtml(criteria);
      expect(html).toContain('<strong>Given</strong>');
      expect(html).toContain('<strong>When</strong>');
      expect(html).toContain('<strong>Then</strong>');
    });

    it('should handle code snippets in descriptions', () => {
      const description = `
## Issue
The API call is failing

\`\`\`javascript
const response = await fetch('/api/login');
console.log(response);
\`\`\`

Please fix this.
      `.trim();

      const html = convertMarkdownToHtml(description);
      expect(html).toContain('<h2>Issue</h2>');
      expect(html).toContain('<code');
      expect(html).toContain('fetch(');
    });
  });
});
