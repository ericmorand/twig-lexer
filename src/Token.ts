export enum TokenType {
    BLOCK_END = 'BLOCK_END',
    BLOCK_START = 'BLOCK_START',
    CLOSING_QUOTE = 'CLOSING_QUOTE',
    COMMENT_END = 'COMMENT_END',
    COMMENT_START = 'COMMENT_START',
    EOF = 'EOF',
    INTERPOLATION_START = 'INTERPOLATION_START',
    INTERPOLATION_END = 'INTERPOLATION_END',
    NAME = 'NAME',
    NUMBER = 'NUMBER',
    OPENING_QUOTE = 'OPENING_QUOTE',
    OPERATOR = 'OPERATOR',
    PUNCTUATION = 'PUNCTUATION',
    STRING = 'STRING',
    TEXT = 'TEXT',
    VARIABLE_END = 'VARIABLE_END',
    VARIABLE_START = 'VARIABLE_START',
    WHITESPACE = 'WHITESPACE',
    WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING = 'WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING',
    WHITESPACE_CONTROL_MODIFIER_TRIMMING = 'WHITESPACE_CONTROL_MODIFIER_TRIMMING'
}

export class Token {
    readonly type: TokenType;
    readonly value: string;
    readonly lineno: number;
    readonly columnno: number;

    constructor(type: TokenType, value: string, lineno: number, columnno: number) {
        this.type = type;
        this.value = value;
        this.lineno = lineno;
        this.columnno = columnno;
    }

    /**
     * Returns the constant representation (internal) of a given type.
     *
     * @param {TokenType} type The token type
     * @param {boolean} short Whether to return a short representation or not
     *
     * @returns {string} The string representation
     */
    static typeToString(type: TokenType, short: boolean = false) {
        if (type in TokenType) {
            return short ? type : 'TokenType.' + type;
        } else {
            throw new Error(`Token of type "${type}" does not exist.`);
        }
    }

    /**
     * Returns the English representation of a given type.
     *
     * @param {TokenType} type The token type
     *
     * @return {string} The string representation
     */
    static typeToEnglish(type: TokenType): string {
        switch (type) {
            case TokenType.EOF:
                return 'end of template';
            case TokenType.TEXT:
                return 'text';
            case TokenType.BLOCK_START:
                return 'begin of statement block';
            case TokenType.VARIABLE_START:
                return 'begin of print statement';
            case TokenType.BLOCK_END:
                return 'end of statement block';
            case TokenType.VARIABLE_END:
                return 'end of print statement';
            case TokenType.NAME:
                return 'name';
            case TokenType.NUMBER:
                return 'number';
            case TokenType.STRING:
                return 'string';
            case TokenType.OPERATOR:
                return 'operator';
            case TokenType.PUNCTUATION:
                return 'punctuation';
            case TokenType.INTERPOLATION_START:
                return 'begin of string interpolation_pair';
            case TokenType.INTERPOLATION_END:
                return 'end of string interpolation_pair';
            case TokenType.COMMENT_START:
                return 'begin of comment statement';
            case TokenType.COMMENT_END:
                return 'end of comment statement';
            case TokenType.WHITESPACE:
                return 'whitespace';
            case TokenType.OPENING_QUOTE:
                return 'opening quote';
            case TokenType.CLOSING_QUOTE:
                return 'closing quote';
            case TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING:
                return 'trimming whitespace control modifier';
            case TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING:
                return 'line trimming whitespace control modifier';
            default:
                throw new Error(`Token of type "${type}" does not exist.`);
        }
    }

    /**
     * Tests the current token for a type and/or a content.
     *
     * @param {TokenType} type
     * @param {string|string[]|number} values
     * @returns {boolean}
     */
    public test(type: TokenType, values: string | string[] | number = null) {
        return (this.type === type) && (values === null || (Array.isArray(values) && values.includes(this.value)) || this.value == values);
    }

    /**
     * @return int
     */
    public getLine() {
        return this.lineno;
    }

    /**
     * @return int
     */
    public getColumn() {
        return this.columnno;
    }

    public getType(): TokenType {
        return this.type;
    }

    public getValue() {
        return this.value;
    }

    public toString() {
        return `${Token.typeToString(this.type, true)}(${this.value ? this.value : ''})`;
    }

    /**
     * Serialize the token to a Twig source
     *
     * @return string
     */
    public serialize() {
        return this.value;
    }
}
