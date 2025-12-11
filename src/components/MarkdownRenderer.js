'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

/**
 * MarkdownRenderer component for rendering markdown content in chat messages
 * @param {Object} props - Component props
 * @param {string} props.content - Markdown content to render
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} Rendered markdown content
 */
function MarkdownRenderer({ content, className = '' }) {
  // Fallback for empty or invalid content
  if (!content || typeof content !== 'string') {
    return <span className={className}>No content</span>;
  }

  // Custom components for styling markdown elements
  const components = {
    // Headers
    h1: ({ children }) => (
      <h1 className="text-xl font-bold mb-2 text-white">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-bold mb-2 text-white">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-bold mb-1 text-white">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-sm font-bold mb-1 text-white">{children}</h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-sm font-semibold mb-1 text-white">{children}</h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-xs font-semibold mb-1 text-white">{children}</h6>
    ),

    // Paragraphs
    p: ({ children }) => (
      <p className="mb-2 last:mb-0 text-gray-100 leading-relaxed">{children}</p>
    ),

    // Lists
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-2 space-y-1 text-gray-100">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-100">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-gray-100">{children}</li>
    ),

    // Emphasis
    strong: ({ children }) => (
      <strong className="font-bold text-white">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-200">{children}</em>
    ),

    // Code
    code: ({ inline, children }) => {
      if (inline) {
        return (
          <code className="bg-gray-700 text-gray-200 px-1 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        );
      }
      return (
        <code className="block bg-gray-700 text-gray-200 p-2 rounded text-sm font-mono overflow-x-auto">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="bg-gray-700 text-gray-200 p-3 rounded mb-2 overflow-x-auto">
        {children}
      </pre>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline"
      >
        {children}
      </a>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gray-600 pl-4 mb-2 italic text-gray-300">
        {children}
      </blockquote>
    ),

    // Horizontal rule
    hr: () => (
      <hr className="border-gray-600 my-3" />
    ),

    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto mb-2">
        <table className="min-w-full border-collapse border border-gray-600">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-700">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody>{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="border-b border-gray-600">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="border border-gray-600 px-2 py-1 text-left font-semibold text-white">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-600 px-2 py-1 text-gray-100">
        {children}
      </td>
    ),

    // Strikethrough
    del: ({ children }) => (
      <del className="line-through text-gray-400">{children}</del>
    ),
  };

  try {
    return (
      <div className={`markdown-content ${className}`}>
        <ReactMarkdown
          components={components}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          skipHtml={true} // Skip HTML for security
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  } catch (error) {
    console.error('Markdown rendering error:', error);
    // Fallback to plain text if markdown rendering fails
    return (
      <div className={`whitespace-pre-wrap ${className}`}>
        {content}
      </div>
    );
  }
}

export default memo(MarkdownRenderer);