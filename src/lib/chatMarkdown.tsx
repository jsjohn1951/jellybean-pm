import React from 'react';
import { T } from './theme';

const preStyle: React.CSSProperties = {
  background: 'rgba(168,85,247,0.1)',
  border: '1px solid rgba(168,85,247,0.2)',
  borderRadius: '6px',
  padding: '8px 12px',
  overflowX: 'auto',
  fontFamily: T.fontMono,
  fontSize: '12px',
  color: T.textSecond,
  margin: '4px 0',
  whiteSpace: 'pre',
};

const codeStyle: React.CSSProperties = {
  background: 'rgba(168,85,247,0.15)',
  color: T.accentText,
  padding: '1px 4px',
  borderRadius: '3px',
  fontFamily: T.fontMono,
  fontSize: '12px',
};

const linkStyle: React.CSSProperties = {
  color: T.accentText,
};

/** Renders markdown text as safe React nodes. No dangerouslySetInnerHTML. */
export function chatMarkdown(text: string, keyPrefix: string): React.ReactNode[] {

  // Step 1: Split by fenced code blocks (``` ... ```)
  const codeBlockPattern = /```[\s\S]*?```/g;
  const codeBlockParts = text.split(codeBlockPattern);
  const codeBlockMatches = text.match(codeBlockPattern) || [];

  const result: React.ReactNode[] = [];
  let resultIndex = 0;

  for (let i = 0; i < codeBlockParts.length; i++) {
    // Process non-code segment
    const segment = codeBlockParts[i];
    if (segment) {
      const inlineNodes = processInline(segment, keyPrefix, resultIndex, codeStyle, linkStyle);
      result.push(...inlineNodes);
      resultIndex += inlineNodes.length;
    }

    // Add code block if it exists
    if (i < codeBlockMatches.length) {
      const codeBlock = codeBlockMatches[i];
      const raw = codeBlock.slice(3, -3);
      const firstNewline = raw.indexOf('\n');
      const codeContent = firstNewline !== -1 && !/\s/.test(raw.slice(0, firstNewline).trim())
        ? raw.slice(firstNewline + 1).trim()
        : raw.trim();
      result.push(
        <pre key={`${keyPrefix}-${resultIndex}-pre`} style={preStyle}>
          <code>{codeContent}</code>
        </pre>
      );
      resultIndex += 1;
    }
  }

  return result;
}

/**
 * Process inline markdown patterns: inline code, bold, italic, links, and newlines
 */
function processInline(
  text: string,
  keyPrefix: string,
  startIndex: number,
  codeStyle: React.CSSProperties,
  linkStyle: React.CSSProperties
): React.ReactNode[] {
  // Order of processing: inline code, bold, italic, links, newlines
  return processInlineCode(text, keyPrefix, startIndex, codeStyle, linkStyle);
}

/**
 * Step 1: Process inline code (backticks)
 */
function processInlineCode(
  text: string,
  keyPrefix: string,
  startIndex: number,
  codeStyle: React.CSSProperties,
  linkStyle: React.CSSProperties
): React.ReactNode[] {
  const inlineCodePattern = /`[^`]+`/g;
  const parts = text.split(inlineCodePattern);
  const matches = text.match(inlineCodePattern) || [];

  const result: React.ReactNode[] = [];
  let index = startIndex;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      const subnodes = processBold(parts[i], keyPrefix, index, linkStyle);
      result.push(...subnodes);
      index += subnodes.length;
    }

    if (i < matches.length) {
      const codeText = matches[i].slice(1, -1); // Remove backticks
      result.push(
        <code key={`${keyPrefix}-${index}-code`} style={codeStyle}>
          {codeText}
        </code>
      );
      index += 1;
    }
  }

  return result;
}

/**
 * Step 2: Process bold (**text**)
 */
function processBold(
  text: string,
  keyPrefix: string,
  startIndex: number,
  linkStyle: React.CSSProperties
): React.ReactNode[] {
  const boldPattern = /\*\*[^*]+\*\*/g;
  const parts = text.split(boldPattern);
  const matches = text.match(boldPattern) || [];

  const result: React.ReactNode[] = [];
  let index = startIndex;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      const subnodes = processItalic(parts[i], keyPrefix, index, linkStyle);
      result.push(...subnodes);
      index += subnodes.length;
    }

    if (i < matches.length) {
      const boldText = matches[i].slice(2, -2); // Remove **
      result.push(
        <strong key={`${keyPrefix}-${index}-strong`} style={{ color: T.textPrimary }}>
          {boldText}
        </strong>
      );
      index += 1;
    }
  }

  return result;
}

/**
 * Step 3: Process italic (_text_)
 */
function processItalic(
  text: string,
  keyPrefix: string,
  startIndex: number,
  linkStyle: React.CSSProperties
): React.ReactNode[] {
  const italicPattern = /(?<![a-zA-Z0-9])_[^_]+_(?![a-zA-Z0-9])/g;
  const parts = text.split(italicPattern);
  const matches = text.match(italicPattern) || [];

  const result: React.ReactNode[] = [];
  let index = startIndex;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      const subnodes = processLinks(parts[i], keyPrefix, index, linkStyle);
      result.push(...subnodes);
      index += subnodes.length;
    }

    if (i < matches.length) {
      const italicText = matches[i].slice(1, -1); // Remove underscores
      result.push(
        <em key={`${keyPrefix}-${index}-em`} style={{ color: T.textSecond }}>
          {italicText}
        </em>
      );
      index += 1;
    }
  }

  return result;
}

/**
 * Step 4: Process links ([label](url)) and newlines
 */
function processLinks(
  text: string,
  keyPrefix: string,
  startIndex: number,
  linkStyle: React.CSSProperties
): React.ReactNode[] {
  const linkPattern = /\[[^\]]+\]\([^\)]+\)/g;
  const parts = text.split(linkPattern);
  const matches = text.match(linkPattern) || [];

  const result: React.ReactNode[] = [];
  let index = startIndex;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      const subnodes = processNewlines(parts[i], keyPrefix, index);
      result.push(...subnodes);
      index += subnodes.length;
    }

    if (i < matches.length) {
      const linkMatch = matches[i];
      const labelMatch = linkMatch.match(/\[([^\]]+)\]/);
      const urlMatch = linkMatch.match(/\(([^\)]+)\)/);

      if (labelMatch && urlMatch) {
        const label = labelMatch[1];
        const url = urlMatch[1];

        // Only render as <a> if URL is https:// or http://
        if (url.startsWith('https://') || url.startsWith('http://')) {
          result.push(
            <a
              key={`${keyPrefix}-${index}-link`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              {label}
            </a>
          );
        } else {
          // Render as plain text
          result.push(`[${label}](${url})`);
        }
      } else {
        // If regex extraction fails, render as plain text fallback
        result.push(linkMatch);
      }
      index += 1;
    }
  }

  return result;
}

/**
 * Step 5: Process newlines (\n → <br />)
 */
function processNewlines(text: string, keyPrefix: string, startIndex: number): React.ReactNode[] {
  const parts = text.split('\n');
  const result: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      result.push(parts[i]);
    }

    // Add <br> after each newline (except the last one)
    if (i < parts.length - 1) {
      result.push(<br key={`${keyPrefix}-${startIndex}-br-${i}`} />);
    }
  }

  return result;
}
