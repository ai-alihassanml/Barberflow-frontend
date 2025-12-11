/**
 * Text processing utilities for markdown cleaning and TTS optimization
 */

/**
 * Remove markdown syntax symbols for text-to-speech
 * @param {string} text - Text containing markdown syntax
 * @returns {string} - Clean text without markdown symbols
 */
export function cleanMarkdownForSpeech(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleanText = text;

  // Remove code blocks (```code```)
  cleanText = cleanText.replace(/```[\s\S]*?```/g, ' code block ');
  
  // Remove inline code (`code`)
  cleanText = cleanText.replace(/`([^`]+)`/g, '$1');
  
  // Remove headers (# ## ### etc.)
  cleanText = cleanText.replace(/^#{1,6}\s+/gm, '');
  
  // Remove bold and italic markers (** __ * _)
  cleanText = cleanText.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleanText = cleanText.replace(/__([^_]+)__/g, '$1');
  cleanText = cleanText.replace(/\*([^*]+)\*/g, '$1');
  cleanText = cleanText.replace(/_([^_]+)_/g, '$1');
  
  // Remove strikethrough (~~text~~)
  cleanText = cleanText.replace(/~~([^~]+)~~/g, '$1');
  
  // Remove links but keep text [text](url) -> text
  cleanText = cleanText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove images ![alt](url) -> alt text
  cleanText = cleanText.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  
  // Remove blockquotes (> text)
  cleanText = cleanText.replace(/^>\s*/gm, '');
  
  // Remove horizontal rules (--- or ***)
  cleanText = cleanText.replace(/^[-*]{3,}$/gm, '');
  
  // Remove table syntax (| column |)
  cleanText = cleanText.replace(/\|/g, ' ');
  
  // Remove remaining markdown symbols
  cleanText = cleanText.replace(/[#*_`~|]/g, '');
  
  // Clean up extra whitespace
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  return cleanText;
}

/**
 * Convert markdown formatting to natural speech patterns
 * @param {string} text - Text containing markdown
 * @returns {string} - Text formatted for natural speech
 */
export function formatForSpeech(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let speechText = text;

  // Convert headers to natural speech
  speechText = speechText.replace(/^#{1}\s+(.+)$/gm, 'Heading: $1.');
  speechText = speechText.replace(/^#{2}\s+(.+)$/gm, 'Subheading: $1.');
  speechText = speechText.replace(/^#{3,6}\s+(.+)$/gm, 'Section: $1.');

  // Convert lists to natural speech with pauses
  speechText = speechText.replace(/^[-*+]\s+(.+)$/gm, 'Item: $1.');
  speechText = speechText.replace(/^\d+\.\s+(.+)$/gm, 'Number $&');

  // Convert emphasis to natural speech
  speechText = speechText.replace(/\*\*([^*]+)\*\*/g, 'emphasized $1');
  speechText = speechText.replace(/__([^_]+)__/g, 'emphasized $1');
  speechText = speechText.replace(/\*([^*]+)\*/g, 'emphasized $1');
  speechText = speechText.replace(/_([^_]+)_/g, 'emphasized $1');

  // Convert code to natural speech
  speechText = speechText.replace(/`([^`]+)`/g, 'code $1');
  speechText = speechText.replace(/```[\s\S]*?```/g, ' code block ');

  // Convert links to natural speech
  speechText = speechText.replace(/\[([^\]]+)\]\([^)]+\)/g, 'link to $1');

  // Convert blockquotes
  speechText = speechText.replace(/^>\s*(.+)$/gm, 'Quote: $1');

  // Clean up and add natural pauses
  speechText = speechText.replace(/\n\n+/g, '. '); // Paragraph breaks
  speechText = speechText.replace(/\n/g, ', '); // Line breaks
  speechText = speechText.replace(/\s+/g, ' ').trim();

  return speechText;
}

/**
 * Extract plain text from markdown, removing all formatting
 * @param {string} text - Markdown text
 * @returns {string} - Plain text content
 */
export function extractPlainText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let plainText = text;

  // Remove code blocks first
  plainText = plainText.replace(/```[\s\S]*?```/g, '');
  
  // Remove inline code
  plainText = plainText.replace(/`([^`]+)`/g, '$1');
  
  // Remove images (keep alt text)
  plainText = plainText.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  
  // Remove links (keep link text)
  plainText = plainText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove all markdown formatting
  plainText = plainText.replace(/^#{1,6}\s+/gm, ''); // Headers
  plainText = plainText.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
  plainText = plainText.replace(/__([^_]+)__/g, '$1'); // Bold
  plainText = plainText.replace(/\*([^*]+)\*/g, '$1'); // Italic
  plainText = plainText.replace(/_([^_]+)_/g, '$1'); // Italic
  plainText = plainText.replace(/~~([^~]+)~~/g, '$1'); // Strikethrough
  plainText = plainText.replace(/^>\s*/gm, ''); // Blockquotes
  plainText = plainText.replace(/^[-*+]\s+/gm, ''); // List markers
  plainText = plainText.replace(/^\d+\.\s+/gm, ''); // Numbered lists
  plainText = plainText.replace(/^[-*]{3,}$/gm, ''); // Horizontal rules
  plainText = plainText.replace(/\|/g, ' '); // Table separators
  
  // Remove any remaining markdown symbols
  plainText = plainText.replace(/[#*_`~]/g, '');
  
  // Clean up whitespace
  plainText = plainText.replace(/\s+/g, ' ').trim();
  
  return plainText;
}

/**
 * Check if text contains markdown syntax
 * @param {string} text - Text to check
 * @returns {boolean} - True if markdown syntax is detected
 */
export function hasMarkdownSyntax(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headers
    /\*\*[^*]+\*\*/, // Bold
    /__[^_]+__/, // Bold
    /\*[^*]+\*/, // Italic
    /_[^_]+_/, // Italic
    /`[^`]+`/, // Inline code
    /```[\s\S]*?```/, // Code blocks
    /\[[^\]]+\]\([^)]+\)/, // Links
    /!\[[^\]]*\]\([^)]+\)/, // Images
    /^>\s+/m, // Blockquotes
    /^[-*+]\s+/m, // Lists
    /^\d+\.\s+/m, // Numbered lists
    /~~[^~]+~~/, // Strikethrough
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}