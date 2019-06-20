import {Token, TokenType} from "./Token";
import {SyntaxError} from "./SyntaxError";

export enum LexerState {
    DATA = 'DATA',
    BLOCK = 'BLOCK',
    VARIABLE = 'VARIABLE',
    STRING = 'STRING',
    INTERPOLATION = 'INTERPOLATION'
}

export type LexerOptions = {
    interpolation: [string, string],
    tag_block: [string, string],
    tag_comment: [string, string]
    tag_variable: [string, string],
    whitespace_trim: string,
    line_whitespace_trim: string
};

export const nameRegExp: RegExp = /^[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/;
export const numberRegExp: RegExp = /^[0-9]+(?:\.[0-9]+)?/;
export const stringRegExp: RegExp = /^(")([^#"\\]*(?:\\.[^#"\\]*)*)(")|^(')([^'\\]*(?:\\.[^'\\]*)*)(')/;
export const openingBracketRegExp: RegExp = /[(\[{]/;
export const closingBracketRegExp: RegExp = /[)\]}]/;
export const punctuationRegExp: RegExp = /[?:.,|]/;
export const doubleQuotedStringDelimiterRegExp: RegExp = /^"/;
export const doubleQuotedStringPartRegExp: RegExp = /^[^#"\\]*(?:(?:\\\\.|#(?!{))[^#"\\]*)*/;
export const lineSeparatorRegExp: RegExp = /\r\n|\r|\n/;
export const whitespaceRegExp: RegExp = /^[ \r\n\t\f\v]+/;

export class Lexer {
    static REGEX_DQ_STRING_DELIM = /^"/;
    static REGEX_DQ_STRING_PART = /^[^#"\\]*(?:(?:\\\\.|#(?!{))[^#"\\]*)*/;
    static LINE_SEPARATORS = ['\\r\\n', '\\r', '\\n'];

    private _interpolationStartRegExp: RegExp;
    private _interpolationEndRegExp: RegExp;
    private _tagStartRegExp: RegExp;
    private _variableEndRegExp: RegExp;
    private _blockEndRegExp: RegExp;
    private _commentEndRegExp: RegExp;
    private _verbatimTagEndRegExp: RegExp;
    private _endverbatimTagRegExp: RegExp;
    private _operatorRegExp: RegExp;

    private brackets: {
        value: string,
        line: number,
        column: number
    }[];
    private currentVarBlockLine: number;
    private currentVarBlockColumn: number;
    private currentBlockName: string;
    private cursor: number;
    private end: number;
    private lineno: number; // 1-based
    private columnno: number; // 1-based
    private position: number;
    private positions: RegExpExecArray[];
    private source: string;
    private state: LexerState;
    private states: LexerState[];
    private tokens: Token[];

    protected options: LexerOptions;
    protected operators: string[];

    constructor() {
        this.operators = [
            '=',
            '-',
            '+',
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

        this.options = {
            interpolation: ['#{', '}'],
            tag_block: ['{%', '%}'],
            tag_comment: ['{#', '#}'],
            tag_variable: ['{{', '}}'],
            whitespace_trim: '-',
            line_whitespace_trim: '~'
        };
    }

    /**
     * Return the regular expression used to match an "interpolation start" tag.
     *
     * @return {RegExp}
     */
    protected get interpolationStartRegExp(): RegExp {
        if (!this._interpolationStartRegExp) {
            this._interpolationStartRegExp = new RegExp(
                '^(' + this.options.interpolation[0] + ')(\\s*)'
            );
        }

        return this._interpolationStartRegExp;
    }

    /**
     * Return the regular expression used to match an "interpolation end" tag.
     *
     * @return {RegExp}
     */
    protected get interpolationEndRegExp(): RegExp {
        if (!this._interpolationEndRegExp) {
            this._interpolationEndRegExp = new RegExp(
                '^(\\s*)(' + this.options.interpolation[1] + ')'
            );
        }

        return this._interpolationEndRegExp;
    }

    /**
     * Return the regular expression used to match a tag start.
     *
     * @return {RegExp}
     */
    protected get tagStartRegExp(): RegExp {
        if (!this._tagStartRegExp) {
            this._tagStartRegExp = new RegExp(
                '(' + [this.options.tag_variable[0], this.options.tag_block[0], this.options.tag_comment[0]].join('|') + ')' +
                '(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + ')?', 'g'
            );
        }

        return this._tagStartRegExp;
    }

    /**
     * Return the regular expression used to match a "variable end" tag.
     *
     * @return {RegExp}
     */
    protected get variableEndRegExp(): RegExp {
        if (!this._variableEndRegExp) {
            this._variableEndRegExp = new RegExp(
                '^(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_variable[1] + ')'
            );
        }

        return this._variableEndRegExp;
    }

    /**
     * Return the regular expression used to match a "block end" tag.
     *
     * @return {RegExp}
     */
    protected get blockEndRegExp(): RegExp {
        if (!this._blockEndRegExp) {
            this._blockEndRegExp = new RegExp(
                '^(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_block[1] + '(?:' + Lexer.LINE_SEPARATORS.join('|') + ')?)'
            );
        }

        return this._blockEndRegExp;
    }

    /**
     * Return the regular expression used to match a "comment end" tag.
     *
     * @return {RegExp}
     */
    protected get commentEndRegExp(): RegExp {
        if (!this._commentEndRegExp) {
            this._commentEndRegExp = new RegExp(
                '(\\s*)(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_comment[1] + '(?:' + Lexer.LINE_SEPARATORS.join('|') + ')?)'
            );
        }

        return this._commentEndRegExp;
    }

    /**
     * Return the regular expression used to match a "verbatim tag" end.
     *
     * @return {RegExp}
     */
    protected get verbatimTagEndRegExp(): RegExp {
        if (!this._verbatimTagEndRegExp) {
            this._verbatimTagEndRegExp = new RegExp(
                '^(\\s*)(verbatim)(\\s*)(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_block[1] + ')'
            );
        }

        return this._verbatimTagEndRegExp;
    }

    /**
     * Return the regular expression used to match a "endverbatim" tag.
     *
     * @return {RegExp}
     */
    protected get endverbatimTagRegExp(): RegExp {
        if (!this._endverbatimTagRegExp) {
            this._endverbatimTagRegExp = new RegExp(
                '(' + this.options.tag_block[0] + ')(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)' +
                '(\\s*)(endverbatim)(\\s*)' +
                '(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_block[1] + ')'
            );
        }

        return this._endverbatimTagRegExp;
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
                let pattern: string = operator.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

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
        this.lineno = 1;
        this.columnno = 1;
        this.tokens = [];
        this.state = LexerState.DATA as any; // see https://github.com/Microsoft/TypeScript/issues/29204
        this.states = [];
        this.brackets = [];
        this.position = -1;
        this.positions = [];

        // find all token starts in one go
        let match: RegExpExecArray;

        while ((match = this.tagStartRegExp.exec(this.source)) !== null) {
            this.positions.push(match);
        }

        while (this.cursor < this.end) {
            console.warn('HERE WE GO', this.cursor, this.end, this.tokens);

            // dispatch to the lexing functions depending on the current state
            switch (this.state) {
                case LexerState.DATA:
                    this.lexData();
                    break;
                case LexerState.BLOCK:
                    this.lexBlock();
                    break;
                case LexerState.VARIABLE:
                    this.lexVar();
                    break;
                case LexerState.STRING:
                    this.lexString();
                    break;
                case LexerState.INTERPOLATION:
                    this.lexInterpolation();
                    break;
            }
        }

        this.pushToken(TokenType.EOF, null);

        if (this.state == LexerState.VARIABLE) {
            throw new SyntaxError(`Unexpected end of file: unclosed variable opened at {${this.currentVarBlockLine}:${this.currentVarBlockColumn}}.`, this.lineno, this.columnno);
        } else if (this.state == LexerState.BLOCK) {
            throw new SyntaxError(`Unexpected end of file: unclosed block opened at {${this.currentVarBlockLine}:${this.currentVarBlockColumn}}.`, this.lineno, this.columnno);
        } else if (this.brackets.length > 0) {
            let bracket = this.brackets.pop();

            throw new SyntaxError(`Unexpected end of file: unclosed "${bracket.value}" opened at {${bracket.line}:${bracket.column}}.`, this.lineno, this.columnno);
        }

        return this.tokens;
    }

    protected lexData() {
        // if no matches are left we return the rest of the template as simple text token
        if (this.position === (this.positions.length - 1)) {
            let text = this.source.substring(this.cursor);

            this.pushToken(TokenType.TEXT, text);
            this.moveCursor(text);

            return;
        }

        // find the first token after the current cursor
        let position: RegExpExecArray = this.positions[++this.position];

        while (position.index < this.cursor) {
            if (this.position == (this.positions.length - 1)) {
                return;
            }

            position = this.positions[++this.position];
        }

        // push the template text first
        let text: string = this.source.substr(this.cursor, position.index - this.cursor);

        this.pushToken(TokenType.TEXT, text);
        this.moveCursor(text);

        let tag = position[1];
        let modifier = position[2];

        this.moveCursor(tag + (modifier ? modifier : ''));

        switch (tag) {
            case this.options.tag_comment[0]:
                this.currentVarBlockLine = this.lineno;
                this.currentVarBlockColumn = this.columnno;

                this.pushToken(TokenType.COMMENT_START, tag);
                this.pushWhitespaceTrimToken(modifier);
                this.lexComment();
                break;
            case this.options.tag_block[0]:
                let match: RegExpExecArray;

                if ((match = this.verbatimTagEndRegExp.exec(this.source.substring(this.cursor))) !== null) {
                    this.currentVarBlockLine = this.lineno;
                    this.currentVarBlockColumn = this.columnno;

                    this.pushToken(TokenType.BLOCK_START, tag);
                    this.pushWhitespaceTrimToken(modifier);
                    this.pushToken(TokenType.WHITESPACE, match[1]);
                    this.pushToken(TokenType.NAME, match[2]); // verbatim itself
                    this.pushToken(TokenType.WHITESPACE, match[3]);
                    this.pushWhitespaceTrimToken(match[4]);
                    this.pushToken(TokenType.BLOCK_END, match[5]);
                    this.moveCursor(match[0]);
                    this.lexVerbatim();
                } else {
                    this.currentVarBlockLine = this.lineno;
                    this.currentVarBlockColumn = this.columnno;

                    this.pushToken(TokenType.BLOCK_START, tag);
                    this.pushWhitespaceTrimToken(modifier);
                    this.pushState(LexerState.BLOCK);
                }
                break;
            case this.options.tag_variable[0]:
                this.currentVarBlockLine = this.lineno;
                this.currentVarBlockColumn = this.columnno;

                this.pushToken(TokenType.VARIABLE_START, tag);
                this.pushWhitespaceTrimToken(modifier);
                this.pushState(LexerState.VARIABLE);

                break;
        }
    }

    protected lexBlock() {
        this.lexWhitespace();

        let code: string = this.source.substring(this.cursor);
        let match: RegExpExecArray;

        if ((this.brackets.length < 1) && ((match = this.blockEndRegExp.exec(code)) !== null)) {
            let tag = match[2];
            let modifier = match[1];

            this.pushWhitespaceTrimToken(modifier);
            this.pushToken(TokenType.BLOCK_END, tag);
            this.moveCursor(tag + (modifier ? modifier : ''));

            this.popState();
        } else {
            this.lexExpression();
        }
    }

    protected lexVar() {
        this.lexWhitespace();

        let match: RegExpExecArray;

        if ((this.brackets.length < 1) && ((match = this.variableEndRegExp.exec(this.source.substring(this.cursor))) !== null)) {
            this.pushWhitespaceTrimToken(match[1]);
            this.pushToken(TokenType.VARIABLE_END, match[2]);
            this.moveCursor(match[0]);
            this.popState();
        } else {
            this.lexExpression();
        }
    }

    protected lexWhitespace() {
        let match: RegExpExecArray;
        let candidate: string = this.source.substring(this.cursor);

        if ((match = whitespaceRegExp.exec(candidate)) !== null) {
            let content = match[0];

            this.pushToken(TokenType.WHITESPACE, content);
            this.moveCursor(content);
        }
    }

    protected lexExpression() {

        console.warn('LEX EXPR', this.state);

        this.lexWhitespace();

        let match: RegExpExecArray;
        let candidate: string = this.source.substring(this.cursor);
        let singleCharacterCandidate: string = candidate.substr(0, 1);

        // operator
        if ((match = this.operatorRegExp.exec(candidate)) !== null) {
            this.pushToken(TokenType.OPERATOR, match[0]);
            this.moveCursor(match[0]);
        }
        // name
        else if ((match = nameRegExp.exec(candidate)) !== null) {
            let content = match[0];

            if (this.state === LexerState.BLOCK) {
                this.currentBlockName = content;
            }

            this.pushToken(TokenType.NAME, content);
            this.moveCursor(content);
        }
        // number
        else if ((match = numberRegExp.exec(candidate)) !== null) {
            this.pushToken(TokenType.NUMBER, match[0]);
            this.moveCursor(match[0]);
        }
        // opening bracket
        else if (openingBracketRegExp.test(singleCharacterCandidate)) {
            this.brackets.push({
                value: singleCharacterCandidate,
                line: this.lineno,
                column: this.columnno
            });

            this.pushToken(TokenType.OPENING_BRACKET, singleCharacterCandidate);

            this.moveCursor(singleCharacterCandidate);
        }
        // closing bracket
        else if (closingBracketRegExp.test(singleCharacterCandidate)) {
            if (this.brackets.length < 1) {
                throw new SyntaxError(`Unexpected "${singleCharacterCandidate}".`, this.lineno, this.columnno);
            }

            let bracket = this.brackets.pop();

            let expect = bracket.value
                .replace('(', ')')
                .replace('[', ']')
                .replace('{', '}')
            ;

            if (singleCharacterCandidate != expect) {
                throw new SyntaxError(`Unclosed bracket "${bracket.value}" opened at {${bracket.line}:${bracket.column}}.`, this.lineno, this.columnno);
            }

            this.pushToken(TokenType.CLOSING_BRACKET, singleCharacterCandidate);

            this.moveCursor(singleCharacterCandidate);
        }
        // punctuation
        else if (punctuationRegExp.test(singleCharacterCandidate)) {
            this.pushToken(TokenType.PUNCTUATION, singleCharacterCandidate);

            this.moveCursor(singleCharacterCandidate);
        }
        // string
        else if ((match = stringRegExp.exec(candidate)) !== null) {
            let openingBracket = match[1] || match[4];
            let content = match[2] || match[5];
            let closingBracket = match[3] || match[6];

            this.pushToken(TokenType.OPENING_QUOTE, openingBracket);
            this.moveCursor(openingBracket);

            if (content !== undefined) {
                this.pushToken(TokenType.STRING, content);
                this.moveCursor(content);
            }

            this.pushToken(TokenType.CLOSING_QUOTE, closingBracket);
            this.moveCursor(closingBracket);
        }
        // opening double quoted string
        else if ((match = Lexer.REGEX_DQ_STRING_DELIM.exec(candidate)) !== null) {
            this.brackets.push({
                value: match[0],
                line: this.lineno,
                column: this.columnno
            });

            this.pushToken(TokenType.OPENING_QUOTE, match[0]);
            this.pushState(LexerState.STRING);
            this.moveCursor(match[0]);
        }
        // unlexable
        else {
            console.warn(this.source, this.tokens, candidate, this.cursor, this.end);

            throw new SyntaxError(`Unexpected character "${candidate}".`, this.lineno, this.columnno);
        }
    }

    protected lexVerbatim() {
        let candidate: string = this.source.substring(this.cursor);

        let match: RegExpExecArray = this.endverbatimTagRegExp.exec(candidate);

        if (!match) {
            this.moveCoordinates(candidate);

            throw new SyntaxError(`Unexpected end of file: unclosed verbatim opened at {${this.currentVarBlockLine}:${this.currentVarBlockColumn}}.`, this.lineno, this.columnno);
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

        this.moveCursor(text + match[0]);
    }

    protected lexComment() {
        this.lexWhitespace();

        let candidate: string = this.source.substring(this.cursor);
        let match = this.commentEndRegExp.exec(candidate);

        if (!match) {
            this.moveCoordinates(candidate);

            throw new SyntaxError(`Unexpected end of file: unclosed comment opened at {${this.currentVarBlockLine}:${this.currentVarBlockColumn}}.`, this.lineno, this.columnno);
        }

        let text = this.source.substr(this.cursor, match.index);

        this.pushToken(TokenType.TEXT, text);
        this.moveCursor(text);

        this.lexWhitespace();

        this.pushWhitespaceTrimToken(match[2]);

        this.pushToken(TokenType.COMMENT_END, match[3]);
        this.moveCursor(match[3]);
    }

    protected lexString() {
        let match: RegExpExecArray;

        if ((match = this.interpolationStartRegExp.exec(this.source.substring(this.cursor))) !== null) {
            let tag = match[1];
            let whitespace = match[2];

            this.brackets.push({
                value: tag,
                line: this.lineno,
                column: this.columnno
            });

            this.pushToken(TokenType.INTERPOLATION_START, tag);
            this.pushToken(TokenType.WHITESPACE, whitespace);
            this.moveCursor(tag + (whitespace ? whitespace : ''));
            this.pushState(LexerState.INTERPOLATION);
        } else if (((match = Lexer.REGEX_DQ_STRING_PART.exec(this.source.substring(this.cursor))) !== null) && (match[0].length > 0)) {
            this.pushToken(TokenType.STRING, match[0]);
            this.moveCursor(match[0]);
        } else {
            let content = this.brackets.pop().value;

            this.pushToken(TokenType.CLOSING_QUOTE, content);
            this.moveCursor(content);
            this.popState();
        }
    }

    protected lexInterpolation() {
        let match: RegExpExecArray;
        let bracket = this.brackets[this.brackets.length - 1];

        if (this.options.interpolation[0] === bracket.value && (match = this.interpolationEndRegExp.exec(this.source.substring(this.cursor))) !== null) {
            let tag = match[2];
            let whitespace = match[1] || '';

            this.brackets.pop();

            this.pushToken(TokenType.WHITESPACE, whitespace);
            this.pushToken(TokenType.INTERPOLATION_END, tag);
            this.moveCursor(tag + whitespace);
            this.popState();
        } else {
            this.lexExpression();
        }
    }

    protected moveCursor(text: string) {
        this.cursor += text.length;
    }

    protected moveCoordinates(text: string) {
        this.columnno += text.length;

        let lines = text.split(/\r\n|\r|\n/);

        let lineCount = lines.length - 1;

        if (lineCount > 0) {
            this.lineno += lineCount;
            this.columnno = 1 + lines[lineCount].length;
        }
    }

    protected pushToken(type: TokenType, content: any) {
        if ((type === TokenType.TEXT || type === TokenType.WHITESPACE) && (content.length < 1)) {
            return;
        }

        let token = new Token(type, content, this.lineno, this.columnno);

        this.tokens.push(token);

        if (content) {
            this.moveCoordinates(content);
        }
    }

    protected pushWhitespaceTrimToken(modifier: string) {
        if (modifier) {
            let type: TokenType;

            if (modifier === this.options.whitespace_trim) {
                type = TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING;
            } else {
                type = TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING;
            }

            this.tokens.push(new Token(type, modifier, this.lineno, this.columnno));
            this.moveCoordinates(modifier);
        }
    }

    protected pushState(state: LexerState) {
        this.states.push(this.state);
        this.state = state;
    }

    /**
     * @return TwingLexerState
     */
    protected popState() {
        this.state = this.states.pop();
    }
}
