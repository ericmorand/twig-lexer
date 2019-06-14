import {Token, TokenType} from "./Token";

const array_merge = require('locutus/php/array/array_merge');

export class TokenStream {
    private tokens: Array<Token>;
    private current: number = 0;
    private source: string;

    constructor(tokens: Array<Token>, source: string = null) {
        this.tokens = tokens;
        this.source = source;
    }

    /**
     * Return a human-readable representation of the stream.
     *
     * @return string
     */
    public toString(): string {
        return this.tokens.map(function (token: Token) {
            return token.toString();
        }).join('\n');
    }

    /**
     * Serialize the stream to a Twig source.
     *
     * @return string
     */
    public serialize(): string {
        return this.tokens.map(function (token: Token) {
            return token.serialize();
        }).join('');
    }

    /**
     * Inject tokens after the current one.
     *
     * @param tokens
     */
    public injectTokens(tokens: Array<Token>) {
        this.tokens = array_merge(this.tokens.slice(0, this.current), tokens, this.tokens.slice(this.current));
    }

    public rewind() {
        this.current = 0;
    }

    /**
     * Sets the pointer to the next token and returns the old one.
     *
     * @return Token
     */
    public next() {
        this.current++;

        if (this.current >= this.tokens.length) {
            throw new Error('Unexpected end of template.');
        }

        return this.tokens[this.current - 1];
    }

    /**
     * Test a token, set the pointer to the next one and return the tested token.
     *
     * @return Token|null The next token if the condition is true, null otherwise
     */
    public nextIf(primary: TokenType, contents: string | string[] | number = null) {
        if (this.tokens[this.current].test(primary, contents)) {
            return this.next();
        }

        return null;
    }

    /**
     * Test a token, set the pointer to the next one and return the tested token or throw an error.
     *
     * @param {TokenType} type
     * @param {string | string[] | number} contents
     *
     * @throw Error
     *
     * @return Token
     */
    public expect(type: TokenType, contents?: string | string[] | number) {
        let token = this.tokens[this.current];

        if (!token.test(type, contents)) {
            throw new Error(
                `Unexpected token "${Token.typeToEnglish(token.getType())}" of value "${token.getContent()}" ("${Token.typeToEnglish(type)}" expected${contents ? ` with value "${contents}"` : ''}).`,
            );
        }

        this.next();

        return token;
    }

    /**
     * Look at the next token.
     *
     * @param {number} number
     *
     * @throw Error
     *
     * @return Token
     */
    public look(number: number = 1) {
        let index = this.current + number;

        if (index >= this.tokens.length) {
            throw new Error('Unexpected end of template.');
        }

        return this.tokens[index];
    }

    /**
     * Test the active token.
     *
     * @return bool
     */
    public test(primary: TokenType, contents: string | string[] | number = null) {
        return this.getCurrent().test(primary, contents);
    }

    /**
     * Checks if end of stream was reached.
     *
     * @return bool
     */
    public isEOF() {
        return this.getCurrent().getType() === TokenType.EOF;
    }

    /**
     * @return Token
     */
    public getCurrent() {
        return this.tokens[this.current];
    }

    /**
     * Gets the source associated with this stream.
     *
     * @return string
     */
    public getSource() {
        return this.source;
    }

    /**
     * @return Token[]
     */
    public getTokens(): Token[] {
        return this.tokens;
    }
}
