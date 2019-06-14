import * as tape from 'tape';
import {TokenStream} from '../../../src/TokenStream';
import {Token, TokenType} from "../../../src/Token";
import {SyntaxError} from "../../../src/SyntaxError";

tape('Token stream', (test) => {
    test.test('constructor', (test) => {
        let tokens = [
            new Token(TokenType.PUNCTUATION, '{', 1, 1),
            new Token(TokenType.WHITESPACE, '\n ', 1, 1),
            new Token(TokenType.NAME, 'foo', 1, 1),
            new Token(TokenType.EOF, null, 1, 1)
        ];

        let stream = new TokenStream(tokens);

        test.same(stream.getTokens(), tokens);

        test.test('accept two parameters', (test) => {
            let stream = new TokenStream(tokens, 'foo');

            test.same(stream.getTokens(), tokens);
            test.same(stream.getSource(), 'foo');

            test.end();
        });

        test.end();
    });

    test.test('injectTokens', (test) => {
        let tokens = [
            new Token(TokenType.WHITESPACE, '\n ', 1, 1),
            new Token(TokenType.NAME, 'foo', 1, 1),
            new Token(TokenType.EOF, null, 1, 1)
        ];

        let stream = new TokenStream(tokens);

        test.test('inject the token at the current position', (test) => {
            stream.next();

            stream.injectTokens([
                new Token(TokenType.PUNCTUATION, '{', 1, 1),
            ]);

            let token = stream.next();

            test.same(token.getType(), TokenType.PUNCTUATION);
            test.same(stream.getCurrent().getType(), TokenType.NAME);

            test.end();
        });

        test.end();
    });

    test.test('rewind', (test) => {
        let tokens = [
            new Token(TokenType.PUNCTUATION, '{', 1, 1),
            new Token(TokenType.WHITESPACE, '\n ', 1, 1),
            new Token(TokenType.NAME, 'foo', 1, 1),
            new Token(TokenType.EOF, null, 1, 1)
        ];

        let stream = new TokenStream(tokens);

        stream.next();
        stream.rewind();

        test.same(stream.getCurrent().getType(), TokenType.PUNCTUATION);

        test.end();
    });
    
    test.test('next', (test) => {
        test.test('return the current token and set the pointer to the next', (test) => {
            let tokens = [
                new Token(TokenType.PUNCTUATION, '{', 1, 1),
                new Token(TokenType.WHITESPACE, '\n ', 1, 1),
                new Token(TokenType.NAME, 'foo', 1, 1),
                new Token(TokenType.EOF, null, 1, 1)
            ];

            let stream = new TokenStream(tokens);

            let token = stream.next();

            test.true(token.getType() === TokenType.PUNCTUATION);
            test.true(stream.getCurrent().getType() === TokenType.WHITESPACE);

            test.end();
        });

        test.test('throw on unexpected EOF', (test) => {
            let tokens = [
                new Token(TokenType.EOF, null, 1, 1)
            ];

            let stream = new TokenStream(tokens);

            test.throws(function () {
                stream.next();
            }, 'Unexpected end of template.');

            test.end();
        });

        test.end();
    });

    test.test('nextIf', (test) => {
        test.test('accept a single parameter', (test) => {
            let tokens = [
                new Token(TokenType.PUNCTUATION, '{', 1, 1),
                new Token(TokenType.WHITESPACE, '\n ', 1, 1),
                new Token(TokenType.NAME, 'foo', 1, 1),
                new Token(TokenType.EOF, null, 1, 1)
            ];

            let stream = new TokenStream(tokens);

            let token = stream.nextIf(TokenType.PUNCTUATION);

            test.same(token ? token.getType() : null, TokenType.PUNCTUATION);
            test.same(stream.nextIf(TokenType.PUNCTUATION), null);

            test.end();
        });

        test.test('accept two parameters', (test) => {
            let tokens = [
                new Token(TokenType.PUNCTUATION, '{', 1, 1),
                new Token(TokenType.WHITESPACE, '\n ', 1, 1),
                new Token(TokenType.NAME, 'foo', 1, 1),
                new Token(TokenType.EOF, null, 1, 1)
            ];

            let stream = new TokenStream(tokens);

            test.same(stream.nextIf(TokenType.PUNCTUATION, '}'), null);

            test.end();
        });

        test.end();
    });

    test.test('expect', (test) => {
        let stream = new TokenStream([
            new Token(TokenType.PUNCTUATION, '{', 1, 1),
            new Token(TokenType.EOF, null, 1, 1)
        ]);

        try {
            stream.expect(TokenType.TEXT);

            test.fail('should throw an error');
        }
        catch (e) {
            test.same((e as SyntaxError).name, 'SyntaxError');
            test.same((e as SyntaxError).message, 'Unexpected token "punctuation" of value "{" ("text" expected).');
            test.same((e as SyntaxError).line, 1);
            test.same((e as SyntaxError).column, 1);
        }

        try {
            stream.expect(TokenType.PUNCTUATION);

            test.pass();
        }
        catch (e) {
            test.fail('should not throw an error');
        }

        test.test('accept two parameters', (test) => {
            let stream = new TokenStream([
                new Token(TokenType.PUNCTUATION, '{', 1, 1),
                new Token(TokenType.EOF, null, 1, 1)
            ]);

            try {
                stream.expect(TokenType.PUNCTUATION, '}');

                test.fail('should throw an error');
            }
            catch (e) {
                test.same((e as SyntaxError).name, 'SyntaxError');
                test.same((e as SyntaxError).message, 'Unexpected token "punctuation" of value "{" ("punctuation" expected with value "}").');
                test.same((e as SyntaxError).line, 1);
                test.same((e as SyntaxError).column, 1);
            }

            try {
                stream.expect(TokenType.PUNCTUATION, '{');

                test.pass();
            }
            catch (e) {
                test.fail('should not throw an error');
            }

            test.end();
        });

        test.end();
    });

    test.test('test', (test) => {
        test.test('accept a single parameter', (test) => {
            let tokens = [
                new Token(TokenType.PUNCTUATION, '{', 1, 1),
                new Token(TokenType.WHITESPACE, '\n ', 1, 1),
                new Token(TokenType.NAME, 'foo', 1, 1),
                new Token(TokenType.EOF, null, 1, 1)
            ];

            let stream = new TokenStream(tokens);


            test.true(stream.test(TokenType.PUNCTUATION));
            test.false(stream.nextIf(TokenType.TEXT));

            test.end();
        });

        test.test('accept two parameters', (test) => {
            test.test('with string as second parameter', (test) => {
                let tokens = [
                    new Token(TokenType.PUNCTUATION, '{', 1, 1),
                    new Token(TokenType.EOF, null, 1, 1)
                ];

                let stream = new TokenStream(tokens);

                test.true(stream.test(TokenType.PUNCTUATION, '{'));
                test.false(stream.test(TokenType.PUNCTUATION, '}'));

                test.end();
            });

            test.test('with number as second parameter', (test) => {
                let tokens = [
                    new Token(TokenType.NUMBER, '5', 1, 1),
                    new Token(TokenType.EOF, null, 1, 1)
                ];

                let stream = new TokenStream(tokens);

                test.true(stream.test(TokenType.NUMBER, 5));
                test.false(stream.test(TokenType.NUMBER, 6));

                test.end();
            });

            test.test('with array of strings as second parameter', (test) => {
                let tokens = [
                    new Token(TokenType.TEXT, 'foo', 1, 1),
                    new Token(TokenType.EOF, null, 1, 1)
                ];

                let stream = new TokenStream(tokens);

                test.true(stream.test(TokenType.TEXT, ['foo', 'bar']));
                test.false(stream.test(TokenType.TEXT, ['fooo', 'bar']));

                test.end();
            });

            test.end();
        });

        test.end();
    });

    test.test('look', (test) => {
        let stream = new TokenStream([
            new Token(TokenType.PUNCTUATION, '{', 1, 1),
            new Token(TokenType.NAME, 'foo', 1, 1),
            new Token(TokenType.EOF, null, 1, 1)
        ]);

        test.same(stream.look().getType(), TokenType.NAME);

        test.throws(function () {
            stream.look(3);
        }, 'Unexpected end of template.');

        test.end();
    });

    test.test('toString', (test) => {
        let tokens = [
            new Token(TokenType.PUNCTUATION, '{', 1, 1),
            new Token(TokenType.WHITESPACE, '\n ', 1, 1),
            new Token(TokenType.NAME, 'foo', 1, 1),
            new Token(TokenType.EOF, null, 1, 1)
        ];

        let stream = new TokenStream(tokens);

        test.same(stream.toString(), `PUNCTUATION({)
WHITESPACE(
 )
NAME(foo)
EOF()`);

        test.end();
    });

    test.test('serialize', (test) => {
        let stream = new TokenStream([
            new Token(TokenType.PUNCTUATION, '{', 1, 1),
            new Token(TokenType.WHITESPACE, '\n ', 1, 1),
            new Token(TokenType.NAME, 'foo', 1, 1),
            new Token(TokenType.EOF, null, 1, 1)
        ]);

        let expected = `{
 foo`;
        let actual = stream.serialize();

        test.same(actual, expected);

        test.end();
    });

    test.test('isEOF', (test) => {
        let stream = new TokenStream([
            new Token(TokenType.TEXT, '', 1, 1),
            new Token(TokenType.EOF, null, 1, 1)
        ]);

        test.false(stream.isEOF());

        stream.next();

        test.true(stream.isEOF());

        test.end();
    });

    test.end();
});