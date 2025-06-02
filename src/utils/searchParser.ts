/**
 * Complex search query parser for WhatsApp chat analysis
 * Supports boolean operators, exact phrases, field searches, wildcards, and regex
 */

export interface SearchQuery {
  type: 'boolean' | 'term' | 'phrase' | 'field' | 'wildcard' | 'regex' | 'not';
  operator?: 'AND' | 'OR';
  field?: 'sender' | 'content' | 'type';
  value?: string;
  regex?: RegExp;
  children?: SearchQuery[];
  negated?: boolean;
}

export interface ParsedMessage {
  content: string;
  sender: string;
  type: 'text' | 'media' | 'call';
  datetime: Date;
}

// Token types for parsing
enum TokenType {
  WORD = 'WORD',
  PHRASE = 'PHRASE', 
  FIELD = 'FIELD',
  OPERATOR = 'OPERATOR',
  NOT = 'NOT',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  REGEX = 'REGEX',
  WILDCARD = 'WILDCARD',
  EOF = 'EOF'
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

class SearchTokenizer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input.trim();
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;

    while (this.position < this.input.length) {
      this.skipWhitespace();
      
      if (this.position >= this.input.length) break;

      const char = this.input[this.position];

      // Handle quoted phrases
      if (char === '"') {
        this.tokenizePhrase();
      }
      // Handle regex patterns
      else if (char === '/') {
        this.tokenizeRegex();
      }
      // Handle parentheses
      else if (char === '(') {
        this.addToken(TokenType.LPAREN, char);
        this.position++;
      }
      else if (char === ')') {
        this.addToken(TokenType.RPAREN, char);
        this.position++;
      }
      // Handle words, operators, fields
      else if (this.isWordChar(char) || char === '-' || char === '*') {
        this.tokenizeWord();
      }
      else {
        // Skip unknown characters
        this.position++;
      }
    }

    this.addToken(TokenType.EOF, '');
    return this.tokens;
  }

  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }

  private tokenizePhrase(): void {
    const start = this.position;
    this.position++; // Skip opening quote
    
    let value = '';
    while (this.position < this.input.length && this.input[this.position] !== '"') {
      value += this.input[this.position];
      this.position++;
    }
    
    if (this.position < this.input.length) {
      this.position++; // Skip closing quote
    }
    
    this.addToken(TokenType.PHRASE, value, start);
  }

  private tokenizeRegex(): void {
    const start = this.position;
    this.position++; // Skip opening slash
    
    let value = '';
    let escaped = false;
    
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      if (escaped) {
        value += char;
        escaped = false;
      } else if (char === '\\') {
        value += char;
        escaped = true;
      } else if (char === '/') {
        this.position++; // Skip closing slash
        break;
      } else {
        value += char;
      }
      
      this.position++;
    }
    
    this.addToken(TokenType.REGEX, value, start);
  }

  private tokenizeWord(): void {
    const start = this.position;
    let value = '';
    
    while (this.position < this.input.length && 
           (this.isWordChar(this.input[this.position]) || 
            this.input[this.position] === '*' || 
            this.input[this.position] === '-' ||
            this.input[this.position] === ':')) {
      value += this.input[this.position];
      this.position++;
    }

    // Determine token type
    const upperValue = value.toUpperCase();
    if (upperValue === 'AND' || upperValue === 'OR') {
      this.addToken(TokenType.OPERATOR, upperValue, start);
    } else if (value.startsWith('-')) {
      this.addToken(TokenType.NOT, value.substring(1), start);
    } else if (value.includes(':')) {
      this.addToken(TokenType.FIELD, value, start);
    } else if (value.includes('*')) {
      this.addToken(TokenType.WILDCARD, value, start);
    } else {
      this.addToken(TokenType.WORD, value, start);
    }
  }

  private isWordChar(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }

  private addToken(type: TokenType, value: string, position: number = this.position): void {
    this.tokens.push({ type, value, position });
  }
}

class SearchParser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): SearchQuery {
    const result = this.parseExpression();
    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token at position ${this.peek().position}: ${this.peek().value}`);
    }
    return result;
  }

  private parseExpression(): SearchQuery {
    return this.parseOr();
  }

  private parseOr(): SearchQuery {
    let expr = this.parseAnd();

    while (this.match(TokenType.OPERATOR) && this.previous().value === 'OR') {
      const right = this.parseAnd();
      expr = {
        type: 'boolean',
        operator: 'OR',
        children: [expr, right]
      };
    }

    return expr;
  }

  private parseAnd(): SearchQuery {
    let expr = this.parseUnary();

    while (!this.isAtEnd() && 
           !this.check(TokenType.RPAREN) && 
           !(this.check(TokenType.OPERATOR) && this.peek().value === 'OR')) {
      
      // Handle explicit AND
      if (this.match(TokenType.OPERATOR) && this.previous().value === 'AND') {
        const right = this.parseUnary();
        expr = {
          type: 'boolean',
          operator: 'AND',
          children: [expr, right]
        };
      }
      // Handle implicit AND (space)
      else {
        const right = this.parseUnary();
        expr = {
          type: 'boolean',
          operator: 'AND',
          children: [expr, right]
        };
      }
    }

    return expr;
  }

  private parseUnary(): SearchQuery {
    if (this.match(TokenType.NOT)) {
      const expr = this.parsePrimary();
      return {
        type: 'not',
        children: [expr],
        negated: true
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): SearchQuery {
    if (this.match(TokenType.PHRASE)) {
      return {
        type: 'phrase',
        value: this.previous().value
      };
    }

    if (this.match(TokenType.REGEX)) {
      try {
        const regex = new RegExp(this.previous().value, 'i');
        return {
          type: 'regex',
          regex,
          value: this.previous().value
        };
      } catch {
        throw new Error(`Invalid regex pattern: ${this.previous().value}`);
      }
    }

    if (this.match(TokenType.WILDCARD)) {
      return {
        type: 'wildcard',
        value: this.previous().value
      };
    }

    if (this.match(TokenType.FIELD)) {
      const fieldValue = this.previous().value;
      const [field, value] = fieldValue.split(':', 2);
      
      if (!['sender', 'content', 'type'].includes(field)) {
        throw new Error(`Invalid field: ${field}. Valid fields are: sender, content, type`);
      }

      return {
        type: 'field',
        field: field as 'sender' | 'content' | 'type',
        value
      };
    }

    if (this.match(TokenType.WORD)) {
      return {
        type: 'term',
        value: this.previous().value
      };
    }

    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression();
      if (!this.match(TokenType.RPAREN)) {
        throw new Error('Expected closing parenthesis');
      }
      return expr;
    }

    throw new Error(`Unexpected token: ${this.peek().value}`);
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }
}

export class SearchQueryEvaluator {
  evaluate(query: SearchQuery, message: ParsedMessage): boolean {
    switch (query.type) {
      case 'boolean':
        return this.evaluateBoolean(query, message);
      case 'term':
        return this.evaluateTerm(query, message);
      case 'phrase':
        return this.evaluatePhrase(query, message);
      case 'field':
        return this.evaluateField(query, message);
      case 'wildcard':
        return this.evaluateWildcard(query, message);
      case 'regex':
        return this.evaluateRegex(query, message);
      case 'not':
        return this.evaluateNot(query, message);
      default:
        return false;
    }
  }

  private evaluateBoolean(query: SearchQuery, message: ParsedMessage): boolean {
    if (!query.children || query.children.length === 0) return false;

    if (query.operator === 'OR') {
      return query.children.some(child => this.evaluate(child, message));
    } else {
      // AND or implicit AND
      return query.children.every(child => this.evaluate(child, message));
    }
  }

  private evaluateTerm(query: SearchQuery, message: ParsedMessage): boolean {
    if (!query.value) return false;
    const term = query.value.toLowerCase();
    
    return message.content.toLowerCase().includes(term) ||
           message.sender.toLowerCase().includes(term);
  }

  private evaluatePhrase(query: SearchQuery, message: ParsedMessage): boolean {
    if (!query.value) return false;
    const phrase = query.value.toLowerCase();
    
    return message.content.toLowerCase().includes(phrase) ||
           message.sender.toLowerCase().includes(phrase);
  }

  private evaluateField(query: SearchQuery, message: ParsedMessage): boolean {
    if (!query.field || !query.value) return false;
    
    const value = query.value.toLowerCase();
    
    switch (query.field) {
      case 'sender':
        return message.sender.toLowerCase().includes(value);
      case 'content':
        return message.content.toLowerCase().includes(value);
      case 'type':
        return message.type === value;
      default:
        return false;
    }
  }

  private evaluateWildcard(query: SearchQuery, message: ParsedMessage): boolean {
    if (!query.value) return false;
    
    const pattern = query.value.toLowerCase()
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${pattern}$`, 'i');
    
    const content = message.content.toLowerCase();
    const sender = message.sender.toLowerCase();
    
    return regex.test(content) || regex.test(sender) ||
           content.split(' ').some(word => regex.test(word)) ||
           sender.split(' ').some(word => regex.test(word));
  }

  private evaluateRegex(query: SearchQuery, message: ParsedMessage): boolean {
    if (!query.regex) return false;
    
    return query.regex.test(message.content) || query.regex.test(message.sender);
  }

  private evaluateNot(query: SearchQuery, message: ParsedMessage): boolean {
    if (!query.children || query.children.length === 0) return true;
    
    return !this.evaluate(query.children[0], message);
  }
}

export function parseSearchQuery(input: string): SearchQuery | null {
  if (!input.trim()) return null;
  
  try {
    const tokenizer = new SearchTokenizer(input);
    const tokens = tokenizer.tokenize();
    const parser = new SearchParser(tokens);
    return parser.parse();
  } catch (error) {
    console.warn('Search query parse error:', error);
    // Fallback to simple term search
    return {
      type: 'term',
      value: input.trim()
    };
  }
}

export function validateSearchQuery(input: string): { valid: boolean; error?: string } {
  if (!input.trim()) return { valid: true };
  
  try {
    const tokenizer = new SearchTokenizer(input);
    const tokens = tokenizer.tokenize();
    const parser = new SearchParser(tokens);
    parser.parse();
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid search query' 
    };
  }
}

export function getSearchSuggestions(input: string): string[] {
  const suggestions = [
    '"exact phrase"',
    'sender:john',
    'content:hello',
    'type:media',
    'hello AND world',
    'john OR mary',
    '-exclude',
    'hello*',
    '/regex pattern/'
  ];
  
  if (!input.trim()) return suggestions;
  
  const lowercaseInput = input.toLowerCase();
  return suggestions.filter(suggestion => 
    suggestion.toLowerCase().includes(lowercaseInput)
  );
}

// Utility functions for highlighting search matches
export interface MatchPosition {
  start: number;
  end: number;
  term: string;
  type: 'term' | 'phrase' | 'regex' | 'wildcard';
}

/**
 * Extract highlightable terms from a parsed query for a specific field
 */
export function extractHighlightTerms(query: SearchQuery, field: 'content' | 'sender' = 'content'): string[] {
  const terms: string[] = [];
  
  function extract(q: SearchQuery): void {
    if (q.negated) return; // Don't highlight negated terms
    
    switch (q.type) {
      case 'term':
      case 'phrase':
        if (q.value) terms.push(q.value);
        break;
      
      case 'field':
        // Only include if field matches or no field specified
        if (q.field === field || !q.field) {
          if (q.value) terms.push(q.value);
        }
        break;
      
      case 'wildcard':
        if (q.value) {
          // Convert wildcard to regex for highlighting
          const regexPattern = q.value
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\*/g, '.*')
            .replace(/\\\?/g, '.');
          terms.push(regexPattern);
        }
        break;
      
      case 'regex':
        if (q.value) terms.push(q.value);
        break;
      
      case 'boolean':
        if (q.children) {
          q.children.forEach(extract);
        }
        break;
    }
  }
  
  extract(query);
  return terms;
}

/**
 * Find match positions in text for highlighting
 */
export function findMatchPositions(query: SearchQuery, text: string, field: 'content' | 'sender' = 'content'): MatchPosition[] {
  const terms = extractHighlightTerms(query, field);
  const positions: MatchPosition[] = [];
  
  for (const term of terms) {
    try {
      // Determine if this is a regex pattern or simple term
      const isRegex = term.includes('.*') || term.includes('.') || query.type === 'regex';
      const flags = 'gi'; // Case insensitive, global
      
      let regex: RegExp;
      if (isRegex) {
        regex = new RegExp(term, flags);
      } else {
        // Escape special regex characters for literal matching
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`\\b${escaped}\\b`, flags);
      }
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        positions.push({
          start: match.index,
          end: match.index + match[0].length,
          term: match[0],
          type: isRegex ? (query.type === 'wildcard' ? 'wildcard' : 'regex') : 
                query.type === 'phrase' ? 'phrase' : 'term'
        });
        
        // Prevent infinite loop for zero-length matches
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    } catch (error) {
      // Skip invalid regex patterns
      console.warn('Invalid search pattern:', term, error);
    }
  }
  
  // Sort positions by start index and merge overlapping
  positions.sort((a, b) => a.start - b.start);
  
  // Remove overlaps (keep first match when overlapping)
  const merged: MatchPosition[] = [];
  for (const pos of positions) {
    const lastMerged = merged[merged.length - 1];
    if (!lastMerged || pos.start >= lastMerged.end) {
      merged.push(pos);
    }
  }
  
  return merged;
}