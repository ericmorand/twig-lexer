import {Token, TokenType} from "./Token";
import {TokenStream} from "./TokenStream";
import {SyntaxError} from "./SyntaxError";

let preg_quote = require('locutus/php/pcre/preg_quote');
let ctype_alpha = require('locutus/php/ctype/ctype_alpha');

export enum LexerState {
    DATA = 'DATA',
    BLOCK = 'BLOCK',
    VARIABLE = 'VARIABLE',
    STRING = 'STRING',
    INTERPOLATION = 'INTERPOLATION'
}

export type LexerOptions = {
    interpolation: Array<string>,
    tag_block: Array<string>,
    tag_comment: Array<string>,
    tag_variable: Array<string>,
    whitespace_trim: string,
    line_whitespace_trim: string
};

export type LexerRegexes = {
    interpolation_start: RegExp, // #{
    interpolation_end: RegExp, // }
    tag_start: RegExp, // {{, {%, {#
    var_end: RegExp, // }}
    block_end: RegExp, // %}
    comment_end: RegExp, // #}
    verbatim_tag_end: RegExp, // verbatim %}
    endverbatim_tag: RegExp, // {% endverbatim %}
    operator: RegExp,
    whitespace: RegExp
};

export class Lexer {
    static REGEX_TEST_OPERATOR = /^(is\s+not|is)/;
    static REGEX_NAME = /^[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/;
    static REGEX_NUMBER = /^[0-9]+(?:\.[0-9]+)?/;
    static REGEX_STRING = /^(")([^#"\\]*(?:\\.[^#"\\]*)*)(")|^(')([^'\\]*(?:\\.[^'\\]*)*)(')/;
    static REGEX_DQ_STRING_DELIM = /^"/;
    static REGEX_DQ_STRING_PART = /^[^#"\\]*(?:(?:\\\\.|#(?!{))[^#"\\]*)*/;
    static PUNCTUATION = '()[]{}?:.,|';
    static LINE_SEPARATORS = ['\\r\\n', '\\r', '\\n'];

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
    private regexes: LexerRegexes;
    private source: string;
    private state: LexerState;
    private states: LexerState[];
    private tokens: Token[];
    private latestStructuringToken: Token;
    private nextIsProperty = false;

    protected options: LexerOptions;
    protected operators: string[];

    constructor() {
        this.operators = [
            '=',
            'not',
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
            'not in',
            'in',
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

    protected getRegexes(): LexerRegexes {
        if (!this.regexes) {
            let whitespaceTrimmingPattern = this.options.whitespace_trim + '|' + this.options.line_whitespace_trim;

            this.regexes = {
                interpolation_start: new RegExp(
                    // ^(#{)(\s*)
                    '^(' + this.options.interpolation[0] + ')(\\s*)'
                ),
                interpolation_end: new RegExp(
                    // ^(\s*)(})
                    '^(\\s*)(' + this.options.interpolation[1] + ')'
                ),
                tag_start: new RegExp(
                    // ({{|{%|{#)(-|~)?
                    '(' + [this.options.tag_variable[0], this.options.tag_block[0], this.options.tag_comment[0]].join('|') + ')' +
                    '(' + whitespaceTrimmingPattern + ')?', 'g'
                ),
                var_end: new RegExp(
                    // ^(-|~?)(}})
                    '^(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_variable[1] + ')'
                ),
                block_end: new RegExp(
                    // ^(-|~?)(%}(?:\r\n|\r|\n)?)
                    '^(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_block[1] + '(?:' + Lexer.LINE_SEPARATORS.join('|') + ')?)'
                ),
                comment_end: new RegExp(
                    // (\s*)(-|~?)(#}(?:\r\n|\r|\n)?)
                    '(\\s*)(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_comment[1] + '(?:' + Lexer.LINE_SEPARATORS.join('|') + ')?)'
                ),
                verbatim_tag_end: new RegExp(
                    // ^(\s*)(verbatim)(\s*)(-|~?)(%})
                    '^(\\s*)(verbatim)(\\s*)(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_block[1] + ')'
                ),
                endverbatim_tag: new RegExp(
                    // ({%)(-|~?)(\s*)(endverbatim)(\s*)(-|~?)(%})
                    '(' + this.options.tag_block[0] + ')(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)' +
                    '(\\s*)(endverbatim)(\\s*)' +
                    '(' + this.options.whitespace_trim + '|' + this.options.line_whitespace_trim + '?)(' + this.options.tag_block[1] + ')'
                ),
                operator: this.getOperatorRegEx(),
                whitespace: new RegExp('^\\s+')
            };
        }

        return this.regexes;
    }

    public tokenize(source: string): TokenStream {
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

        while ((match = this.getRegexes().tag_start.exec(this.source)) !== null) {
            this.positions.push(match);
        }

        while (this.cursor < this.end) {
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

        return new TokenStream(this.tokens, this.source);
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

                if ((match = this.getRegexes().verbatim_tag_end.exec(this.source.substring(this.cursor))) !== null) {
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

        if ((this.brackets.length < 1) && ((match = this.getRegexes().block_end.exec(code)) !== null)) {
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

        if ((this.brackets.length < 1) && ((match = this.getRegexes().var_end.exec(this.source.substring(this.cursor))) !== null)) {
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

        if ((match = this.getRegexes().whitespace.exec(candidate)) !== null) {
            let content = match[0];

            this.pushToken(TokenType.WHITESPACE, content);
            this.moveCursor(content);
        }
    }

    protected lexExpression() {
        this.lexWhitespace();

        let match: RegExpExecArray;
        let candidate: string = this.source.substring(this.cursor);
        let punctuationCandidate: string;

        punctuationCandidate = candidate.substr(0, 1);

        // test operator
        if ((match = Lexer.REGEX_TEST_OPERATOR.exec(candidate)) !== null) {
            this.pushToken(TokenType.NAME, match[0]);
            this.moveCursor(match[0]);
        }
        // operators
        else if ((match = this.getRegexes().operator.exec(candidate)) !== null) {
            this.pushToken(TokenType.OPERATOR, match[0]);
            this.moveCursor(match[0]);
        }
        // names
        else if ((match = Lexer.REGEX_NAME.exec(candidate)) !== null) {
            let content = match[0];

            if (this.state === LexerState.BLOCK) {
                this.currentBlockName = content;
            }

            this.pushToken(TokenType.NAME, content);
            this.moveCursor(content);
        }
        // numbers
        else if ((match = Lexer.REGEX_NUMBER.exec(candidate)) !== null) {
            this.pushToken(TokenType.NUMBER, match[0]);
            this.moveCursor(match[0]);
        }
        // punctuation
        else if (Lexer.PUNCTUATION.indexOf(punctuationCandidate) > -1) {
            // opening bracket
            if ('([{'.indexOf(punctuationCandidate) > -1) {
                this.brackets.push({
                    value: punctuationCandidate,
                    line: this.lineno,
                    column: this.columnno
                });
            }
            // closing bracket
            else if (')]}'.indexOf(punctuationCandidate) > -1) {
                if (this.brackets.length < 1) {
                    throw new SyntaxError(`Unexpected "${punctuationCandidate}".`, this.lineno, this.columnno);
                }

                let bracket = this.brackets.pop();

                let expect = bracket.value
                    .replace('(', ')')
                    .replace('[', ']')
                    .replace('{', '}')
                ;

                if (punctuationCandidate != expect) {
                    throw new SyntaxError(`Unclosed bracket "${bracket.value}" opened at {${bracket.line}:${bracket.column}}.`, this.lineno, this.columnno);
                }
            }

            this.pushToken(TokenType.PUNCTUATION, punctuationCandidate);

            this.moveCursor(punctuationCandidate);
        }
        // strings
        else if ((match = Lexer.REGEX_STRING.exec(candidate)) !== null) {
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
            throw new SyntaxError(`Unexpected character "${candidate}".`, this.lineno, this.columnno);
        }
    }

    protected lexVerbatim() {
        let candidate: string = this.source.substring(this.cursor);

        let match: RegExpExecArray = this.getRegexes().endverbatim_tag.exec(candidate);

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
        let match = this.getRegexes().comment_end.exec(candidate);

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

        if ((match = this.getRegexes().interpolation_start.exec(this.source.substring(this.cursor))) !== null) {
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

        if (this.options.interpolation[0] === bracket.value && (match = this.getRegexes().interpolation_end.exec(this.source.substring(this.cursor))) !== null) {
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

    protected getOperatorRegEx() {
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
            let pattern: string;

            // an operator that ends with a character must be followed by
            // a whitespace or a parenthesis
            if (ctype_alpha(operator[length - 1])) {
                pattern = preg_quote(operator, '/') + '(?=[\\s()])';
            } else {
                pattern = preg_quote(operator, '/');
            }

            // an operator with a space can be any amount of whitespaces
            pattern = pattern.replace(/\s+/, '\\s+');

            patterns.push('^' + pattern);
        }

        return new RegExp(patterns.join('|'));
    };

    protected pushToken(type: TokenType, content: any) {
        if ((type === TokenType.TEXT || type === TokenType.WHITESPACE) && (content.length < 1)) {
            return;
        }

        let token = new Token(type, content, this.lineno, this.columnno);

        this.tokens.push(token);

        if (content) {
            this.moveCoordinates(content);
        }

        switch (token.getType()) {
            case TokenType.WHITESPACE:
            case TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING:
            case TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING:
                break;
            default:
                this.latestStructuringToken = token;
        }

        this.nextIsProperty = false;
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
