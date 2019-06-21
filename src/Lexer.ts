import {Token, TokenType} from "./Token";
import {SyntaxError} from "./SyntaxError";

export enum LexerState {
    BLOCK = 'BLOCK',
    DATA = 'DATA',
    DOUBLE_QUOTED_STRING = 'DOUBLE_QUOTED_STRING',
    INTERPOLATION = 'INTERPOLATION',
    VARIABLE = 'VARIABLE',
    VERBATIM = 'VERBATIM'
}

const escapeRegularExpressionPattern = (pattern: string) => {
    return pattern.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
};

export const bracketPairs: [string, string][] = [['(', ')'], ['{', '}'], ['[', ']']];
export const nameRegExp: RegExp = /^[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/;
export const numberRegExp: RegExp = /^[0-9]+(?:\.[0-9]+)?/;
export const stringRegExp: RegExp = /^(")([^#"\\]*(?:\\.[^#"\\]*)*)(")|^(')([^'\\]*(?:\\.[^'\\]*)*)(')/;

let openingBrackets = [];
let closingBrackets = [];

for (let [openingBracket, closingBracket] of bracketPairs) {
    openingBrackets.push(escapeRegularExpressionPattern(openingBracket));
    closingBrackets.push(escapeRegularExpressionPattern(closingBracket));
}

export const openingBracketRegExp: RegExp = new RegExp('[' + openingBrackets.join('') + ']');
export const closingBracketRegExp: RegExp = new RegExp('[' + closingBrackets.join('') + ']');
export const punctuationRegExp: RegExp = /[?:.,|]/;
export const doubleQuotedStringDelimiterRegExp: RegExp = /^"/;
export const doubleQuotedStringPartRegExp: RegExp = /^[^#"\\]*(?:(?:\\\\.|#(?!{))[^#"\\]*)*/;
export const whitespaceRegExp: RegExp = /^[ \r\n\t\f\v]+/;
export const lineSeparators: string[] = ['\\r\\n', '\\r', '\\n'];

type LexerScope = {
    value: string,
    expected: string,
    line: number,
    column: number
};

export class Lexer {
    private _interpolationStartRegExp: RegExp;
    private _interpolationEndRegExp: RegExp;
    private _statementStartRegExp: RegExp;
    private _variableEndRegExp: RegExp;
    private _blockEndRegExp: RegExp;
    private _commentEndRegExp: RegExp;
    private _verbatimTagRegExp: RegExp;
    private _endverbatimTagRegExp: RegExp;
    private _operatorRegExp: RegExp;

    private currentVarBlockLine: number;
    private currentVarBlockColumn: number;
    private cursor: number;
    private end: number;
    private line: number; // 1-based
    private column: number; // 1-based
    private source: string;
    private state: LexerState;
    private states: LexerState[];
    private scope: LexerScope;
    private scopes: LexerScope[];
    private tokens: Token[];

    protected operators: string[];

    protected blockPair: [string, string];
    protected commentPair: [string, string];
    protected interpolationPair: [string, string];
    protected variablePair: [string, string];

    protected whitespaceTrim: string;
    protected lineWhitespaceTrim: string;

    constructor() {
        this.operators = [
            '=',
            'or',
            'and',
            'b-or',
            'b-xor',
            'b-and',
            '==',
            '!=',
            '<',
            '<=',
            '>',
            '>=',
            'is',
            'is not',
            'not',
            'in',
            'not in',
            'matches',
            'starts with',
            'ends with',
            '..',
            '+',
            '-',
            '~',
            '*',
            '/',
            '//',
            '%',
            '**',
            '??'
        ];

        this.blockPair = ['{%', '%}'];
        this.commentPair = ['{#', '#}'];
        this.interpolationPair = ['#{', '}'];
        this.variablePair = ['{{', '}}'];

        this.whitespaceTrim = '-';
        this.lineWhitespaceTrim = '~';
    }

    /**
     * Return the regular expression used to match an operator.
     *
     * @return {RegExp}
     */
    protected get operatorRegExp(): RegExp {
        if (!this._operatorRegExp) {
            let operators = Array.from([
                '=',
                ...this.operators
            ]);

            operators.sort(function (a, b) {
                return a.length > b.length ? -1 : 1;
            });

            let patterns: Array<string> = [];

            for (let operator of operators) {
                let length: number = operator.length;
                let pattern: string = escapeRegularExpressionPattern(operator);

                // an operator that ends with a character must be followed by a whitespace or an opening parenthesis
                if (new RegExp('[A-Za-z]').test(operator[length - 1])) {
                    pattern += '(?=[\\s(])';
                }

                // a space within an operator can be any amount of whitespaces
                pattern = pattern.replace(/\s+/, '\\s+');

                patterns.push(pattern);
            }

            let pattern: string = `^(${patterns.join('|')})`;

            this._operatorRegExp = new RegExp(pattern);
        }

        return this._operatorRegExp;
    }

    public tokenize(source: string): Token[] {
        this.source = source;
        this.cursor = 0;
        this.end = this.source.length;
        this.line = 1;
        this.column = 1;
        this.tokens = [];
        this.state = LexerState.DATA as any; // see https://github.com/Microsoft/TypeScript/issues/29204
        this.states = [];
        this.scope = null;
        this.scopes = [];

        // init regular expressions
        this._blockEndRegExp = new RegExp(
            '^(' + this.whitespaceTrim + '|' + this.lineWhitespaceTrim + '?)(' + this.blockPair[1] + '(?:' + lineSeparators.join('|') + ')?)'
        );

        this._commentEndRegExp = new RegExp(
            '(\\s*)(' + this.whitespaceTrim + '|' + this.lineWhitespaceTrim + '?)(' + this.commentPair[1] + '(?:' + lineSeparators.join('|') + ')?)'
        );

        this._variableEndRegExp = new RegExp(
            '^(' + this.whitespaceTrim + '|' + this.lineWhitespaceTrim + '?)(' + this.variablePair[1] + ')'
        );

        this._verbatimTagRegExp = new RegExp(
            '(' + this.blockPair[0] + ')(' + this.whitespaceTrim + '|' + this.lineWhitespaceTrim + '?)' +
            '(\\s*)(verbatim)(\\s*)' +
            '(' + this.whitespaceTrim + '|' + this.lineWhitespaceTrim + '?)(' + this.blockPair[1] + ')'
        );

        this._endverbatimTagRegExp = new RegExp(
            '(' + this.blockPair[0] + ')(' + this.whitespaceTrim + '|' + this.lineWhitespaceTrim + '?)' +
            '(\\s*)(endverbatim)(\\s*)' +
            '(' + this.whitespaceTrim + '|' + this.lineWhitespaceTrim + '?)(' + this.blockPair[1] + ')'
        );

        this._statementStartRegExp = new RegExp(
            '(' + [this.variablePair[0], this.blockPair[0], this.commentPair[0]].join('|') + ')' +
            '(' + this.whitespaceTrim + '|' + this.lineWhitespaceTrim + ')?'
        );

        this._interpolationStartRegExp = new RegExp(
            '^(' + this.interpolationPair[0] + ')(\\s*)'
        );

        this._interpolationEndRegExp = new RegExp(
            '^(\\s*)(' + this.interpolationPair[1] + ')'
        );

        while (this.cursor < this.end) {
            // dispatch to the lexing functions depending on the current state
            switch (this.state) {
                case LexerState.BLOCK:
                    this.lexBlock();
                    break;
                case LexerState.DATA:
                    this.lexData();
                    break;
                case LexerState.DOUBLE_QUOTED_STRING:
                    this.lexDoubleQuotedString();
                    break;
                case LexerState.INTERPOLATION:
                    this.lexInterpolation();
                    break;
                case LexerState.VARIABLE:
                    this.lexVariable();
                    break;
                case LexerState.VERBATIM:
                    this.lexVerbatim();
                    break;
            }
        }

        this.pushToken(TokenType.EOF, null);

        if (this.state == LexerState.VARIABLE) {
            throw new SyntaxError(`Unexpected end of file: unclosed variable opened at {${this.currentVarBlockLine}:${this.currentVarBlockColumn}}.`, this.line, this.column);
        } else if (this.state == LexerState.BLOCK) {
            throw new SyntaxError(`Unexpected end of file: unclosed block opened at {${this.currentVarBlockLine}:${this.currentVarBlockColumn}}.`, this.line, this.column);
        } else if (this.scope) {
            throw new SyntaxError(`Unexpected end of file: unclosed "${this.scope.value}" opened at {${this.scope.line}:${this.scope.column}}.`, this.line, this.column);
        }

        return this.tokens;
    }

    protected lexData() {
        let data = this.source.substring(this.cursor);

        // look for the next statement
        let match = this._statementStartRegExp.exec(data);

        // push the text
        this.pushToken(TokenType.TEXT, match ? data.substr(0, match.index) : data);

        if (match) {
            let tag: string = match[1];
            let modifier: string = match[2];

            switch (tag) {
                case this.commentPair[0]:
                    this.currentVarBlockLine = this.line;
                    this.currentVarBlockColumn = this.column;

                    this.pushToken(TokenType.COMMENT_START, tag);
                    this.pushWhitespaceTrimToken(modifier);
                    this.lexComment();
                    break;
                case this.blockPair[0]:
                    let match: RegExpExecArray;

                    if ((match = this._verbatimTagRegExp.exec(this.source.substring(this.cursor))) !== null) {
                        this.currentVarBlockLine = this.line;
                        this.currentVarBlockColumn = this.column;

                        this.pushToken(TokenType.BLOCK_START, match[1]);
                        this.pushWhitespaceTrimToken(match[2]);
                        this.pushToken(TokenType.WHITESPACE, match[3]);
                        this.pushToken(TokenType.NAME, match[4]); // verbatim itself
                        this.pushToken(TokenType.WHITESPACE, match[5]);
                        this.pushWhitespaceTrimToken(match[6]);
                        this.pushToken(TokenType.BLOCK_END, match[7]);
                        this.pushState(LexerState.VERBATIM);
                    } else {
                        this.currentVarBlockLine = this.line;
                        this.currentVarBlockColumn = this.column;

                        this.pushToken(TokenType.BLOCK_START, tag);
                        this.pushWhitespaceTrimToken(modifier);
                        this.pushState(LexerState.BLOCK);
                    }
                    break;
                case this.variablePair[0]:
                    this.currentVarBlockLine = this.line;
                    this.currentVarBlockColumn = this.column;

                    this.pushToken(TokenType.VARIABLE_START, tag);
                    this.pushWhitespaceTrimToken(modifier);
                    this.pushState(LexerState.VARIABLE);

                    break;
            }
        }
    }

    protected lexBlock() {
        this.lexWhitespace();

        let code: string = this.source.substring(this.cursor);
        let match: RegExpExecArray;

        if (!this.scope && ((match = this._blockEndRegExp.exec(code)) !== null)) {
            let tag = match[2];
            let modifier = match[1];

            this.pushWhitespaceTrimToken(modifier);
            this.pushToken(TokenType.BLOCK_END, tag);
            this.popState();
        } else {
            this.lexExpression();
        }
    }

    protected lexVariable() {
        this.lexWhitespace();

        let match: RegExpExecArray;

        if (!this.scope && ((match = this._variableEndRegExp.exec(this.source.substring(this.cursor))) !== null)) {
            this.pushWhitespaceTrimToken(match[1]);
            this.pushToken(TokenType.VARIABLE_END, match[2]);
            this.popState();
        } else {
            this.lexExpression();
        }
    }

    protected lexWhitespace() {
        let match: RegExpExecArray;
        let candidate: string = this.source.substring(this.cursor);

        if ((match = whitespaceRegExp.exec(candidate)) !== null) {
            this.pushToken(TokenType.WHITESPACE, match[0]);
        }
    }

    protected lexExpression() {
        this.lexWhitespace();

        let match: RegExpExecArray;
        let candidate: string = this.source.substring(this.cursor);
        let singleCharacterCandidate: string = candidate.substr(0, 1);

        // operator
        if ((match = this.operatorRegExp.exec(candidate)) !== null) {
            this.pushToken(TokenType.OPERATOR, match[0]);
        }
        // name
        else if ((match = nameRegExp.exec(candidate)) !== null) {
            this.pushToken(TokenType.NAME, match[0]);
        }
        // number
        else if ((match = numberRegExp.exec(candidate)) !== null) {
            this.pushToken(TokenType.NUMBER, match[0]);
        }
        // opening bracket
        else if (openingBracketRegExp.test(singleCharacterCandidate)) {
            this.pushScope(singleCharacterCandidate);
            this.pushToken(TokenType.PUNCTUATION, singleCharacterCandidate);
        }
        // closing bracket
        else if (closingBracketRegExp.test(singleCharacterCandidate)) {
            if (!this.scope) {
                throw new SyntaxError(`Unexpected "${singleCharacterCandidate}".`, this.line, this.column);
            }

            if (singleCharacterCandidate !== this.scope.expected) {
                throw new SyntaxError(`Unclosed bracket "${this.scope.value}" opened at {${this.scope.line}:${this.scope.column}}.`, this.line, this.column);
            }

            this.pushToken(TokenType.PUNCTUATION, singleCharacterCandidate);
            this.popScope();
        }
        // punctuation
        else if (punctuationRegExp.test(singleCharacterCandidate)) {
            this.pushToken(TokenType.PUNCTUATION, singleCharacterCandidate);
        }
        // string
        else if ((match = stringRegExp.exec(candidate)) !== null) {
            let openingBracket = match[1] || match[4];
            let value = match[2] || match[5];
            let closingBracket = match[3] || match[6];

            this.pushToken(TokenType.OPENING_QUOTE, openingBracket);

            if (value !== undefined) {
                this.pushToken(TokenType.STRING, value);
            }

            this.pushToken(TokenType.CLOSING_QUOTE, closingBracket);
        }
        // double quoted string
        else if ((match = doubleQuotedStringDelimiterRegExp.exec(candidate)) !== null) {
            let value = match[0];

            this.pushScope(value, value);
            this.pushToken(TokenType.OPENING_QUOTE, value);
            this.pushState(LexerState.DOUBLE_QUOTED_STRING);
        }
        // unlexable
        else if (this.cursor < this.end) {
            throw new SyntaxError(`Unexpected character "${candidate}".`, this.line, this.column);
        }
    }

    protected lexVerbatim() {
        let candidate: string = this.source.substring(this.cursor);

        let match: RegExpExecArray = this._endverbatimTagRegExp.exec(candidate);

        if (!match) {
            this.moveCoordinates(candidate);

            throw new SyntaxError(`Unexpected end of file: unclosed verbatim opened at {${this.currentVarBlockLine}:${this.currentVarBlockColumn}}.`, this.line, this.column);
        }

        let text = this.source.substr(this.cursor, match.index);

        this.pushToken(TokenType.TEXT, text);

        this.pushToken(TokenType.BLOCK_START, match[1]);
        this.pushWhitespaceTrimToken(match[2]);
        this.pushToken(TokenType.WHITESPACE, match[3]);
        this.pushToken(TokenType.NAME, match[4]); // endverbatim itself
        this.pushToken(TokenType.WHITESPACE, match[5]);
        this.pushWhitespaceTrimToken(match[6]);
        this.pushToken(TokenType.BLOCK_END, match[7]);
        this.popState();
    }

    protected lexComment() {
        this.lexWhitespace();

        let candidate: string = this.source.substring(this.cursor);
        let match = this._commentEndRegExp.exec(candidate);

        if (!match) {
            this.moveCoordinates(candidate);

            throw new SyntaxError(`Unexpected end of file: unclosed comment opened at {${this.currentVarBlockLine}:${this.currentVarBlockColumn}}.`, this.line, this.column);
        }

        let text = this.source.substr(this.cursor, match.index);

        this.pushToken(TokenType.TEXT, text);
        this.lexWhitespace();
        this.pushWhitespaceTrimToken(match[2]);
        this.pushToken(TokenType.COMMENT_END, match[3]);
    }

    protected lexDoubleQuotedString() {
        let match: RegExpExecArray;

        if ((match = this._interpolationStartRegExp.exec(this.source.substring(this.cursor))) !== null) {
            let tag = match[1];

            this.pushToken(TokenType.INTERPOLATION_START, tag);
            this.pushToken(TokenType.WHITESPACE, match[2]);
            this.pushScope(tag, this.interpolationPair[1]);
            this.pushState(LexerState.INTERPOLATION);
        } else if (((match = doubleQuotedStringPartRegExp.exec(this.source.substring(this.cursor))) !== null) && (match[0].length > 0)) {
            this.pushToken(TokenType.STRING, match[0]);
        } else {
            this.pushToken(TokenType.CLOSING_QUOTE, this.scope.value);
            this.popScope();
            this.popState();
        }
    }

    protected lexInterpolation() {
        let match: RegExpExecArray;

        if (this.scope.value === this.interpolationPair[0] && (match = this._interpolationEndRegExp.exec(this.source.substring(this.cursor))) !== null) {
            let tag = match[2];
            let whitespace = match[1] || '';

            this.pushToken(TokenType.WHITESPACE, whitespace);
            this.pushToken(TokenType.INTERPOLATION_END, tag);
            this.popScope();
            this.popState();
        } else {
            this.lexExpression();
        }
    }

    protected moveCoordinates(text: string) {
        this.cursor += text.length;
        this.column += text.length;

        let lines = text.split(/\r\n|\r|\n/);

        let lineCount = lines.length - 1;

        if (lineCount > 0) {
            this.line += lineCount;
            this.column = 1 + lines[lineCount].length;
        }
    }

    protected pushToken(type: TokenType, value: any) {
        if ((type === TokenType.TEXT || type === TokenType.WHITESPACE) && (value.length < 1)) {
            return;
        }

        let token = new Token(type, value, this.line, this.column);

        this.tokens.push(token);

        if (value) {
            this.moveCoordinates(value);
        }
    }

    protected pushWhitespaceTrimToken(modifier: string) {
        if (modifier) {
            this.pushToken(modifier === this.whitespaceTrim ? TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING : TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING, modifier);
        }
    }

    protected pushState(state: LexerState) {
        this.states.push(this.state);
        this.state = state;
    }

    protected pushScope(value: string, expected?: string) {
        if (!expected) {
            let bracketPair = bracketPairs.find((bracketPair) => {
                return bracketPair[0] === value;
            });

            expected = bracketPair[1];
        }

        this.scopes.push(this.scope);
        this.scope = {
            value: value,
            expected: expected,
            line: this.line,
            column: this.column
        };
    }

    protected popState() {
        this.state = this.states.pop();
    }

    protected popScope() {
        this.scope = this.scopes.pop();
    }
}
