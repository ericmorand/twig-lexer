export class SyntaxError extends Error {
    private _line: number;
    private _column: number;

    /**
     * @param message
     * @param line The line where the error occurred
     * @param column The column where the error occurred
     */
    constructor(message: string, line: number, column: number) {
        super(message);

        this.name = 'SyntaxError';

        this._line = line;
        this._column = column;
    }

    get line(): number {
        return this._line;
    }

    get column(): number {
        return this._column;
    }
}