import * as tape from 'tape';
import {Lexer} from '../../../src/Lexer';
import {Token, TokenType} from "../../../src/Token";
import {SyntaxError} from '../../../src/SyntaxError';

let createLexer = (): Lexer => {
    return new Lexer();
};

let testToken = (test: tape.Test, token: Token, value: any, line: number, column: number, type: TokenType = null) => {
    test.looseEqual(token.getContent(), value, token.getType() + ' value should be "' + ((value && value.length > 80) ? value.substr(0, 77) + '...' : value) + '"');
    test.same(token.getLine(), line, 'line should be ' + line);
    test.same(token.getColumn(), column, 'column should be ' + column);

    if (type) {
        test.same(token.getType(), type, 'type should be "' + Token.typeToEnglish(type) + '"');
    }
};

tape('Lexer', (test) => {
    test.test('constructor', (test) => {
        let lexer = new Lexer();

        test.end();
    });

    test.test('lex properties', (test) => {
        test.test('using dot notation', (test) => {
            let source = '{{foo.foo}}';

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            console.warn(stream);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 3);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '.', 1, 6);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 7);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 10);
            testToken(test, stream.getCurrent(), null, 1, 12, TokenType.EOF);

            test.end();
        });

        test.test('using bracket notation', (test) => {
            let data = '{{foo[foo]}}';

            let lexer = createLexer();
            let stream = lexer.tokenize(data);

            console.warn(stream);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 3);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '[', 1, 6);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 7);
            testToken(test, stream.expect(TokenType.PUNCTUATION), ']', 1, 10);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 11);
            testToken(test, stream.getCurrent(), null, 1, 13, TokenType.EOF);

            test.end();
        });

        test.test('using a mix of dot and bracket notation', (test) => {
            let data = '{{foo[foo.5[foo][foo]]}}';

            let lexer = createLexer();
            let stream = lexer.tokenize(data);

            console.warn(stream);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 3);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '[', 1, 6);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 7);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '.', 1, 10);
            testToken(test, stream.expect(TokenType.NUMBER), '5', 1, 11);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '[', 1, 12);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 13);
            testToken(test, stream.expect(TokenType.PUNCTUATION), ']', 1, 16);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '[', 1, 17);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 18);
            testToken(test, stream.expect(TokenType.PUNCTUATION), ']', 1, 21);
            testToken(test, stream.expect(TokenType.PUNCTUATION), ']', 1, 22);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 23);
            testToken(test, stream.getCurrent(), null, 1, 25, TokenType.EOF);

            test.end();
        });

        test.test('named like operators', (test) => {
            let data = '{{foo.in}}';

            let lexer = createLexer();
            let stream = lexer.tokenize(data);

            console.warn(stream);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 3);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '.', 1, 6);
            testToken(test, stream.expect(TokenType.NAME), 'in', 1, 7);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 9);
            testToken(test, stream.getCurrent(), null, 1, 11, TokenType.EOF);

            test.end();
        });

        test.test('named like the test operator', (test) => {
            let data = '{{foo.is}}';

            let lexer = createLexer();
            let stream = lexer.tokenize(data);

            console.warn(stream);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 3);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '.', 1, 6);
            testToken(test, stream.expect(TokenType.NAME), 'is', 1, 7);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 9);
            testToken(test, stream.getCurrent(), null, 1, 11, TokenType.EOF);

            test.end();
        });

        test.test('bracket notation', (test) => {
            test.test('supports string', (test) => {
                let data = '{{foo["bar"]}}';

                let lexer = createLexer();
                let stream = lexer.tokenize(data);

                console.warn(stream);

                testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
                testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 3);
                testToken(test, stream.expect(TokenType.PUNCTUATION), '[', 1, 6);
                testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 7);
                testToken(test, stream.expect(TokenType.STRING), 'bar', 1, 8);
                testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 11);
                testToken(test, stream.expect(TokenType.PUNCTUATION), ']', 1, 12);
                testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 13);
                testToken(test, stream.getCurrent(), null, 1, 15, TokenType.EOF);

                test.end();
            });

            test.test('supports string with interpolation', (test) => {
                let data = '{{foo["#{bar}"]}}';

                let lexer = createLexer();
                let stream = lexer.tokenize(data);

                console.warn(stream);

                testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
                testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 3);
                testToken(test, stream.expect(TokenType.PUNCTUATION), '[', 1, 6);
                testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 7);
                testToken(test, stream.expect(TokenType.INTERPOLATION_START), '#{', 1, 8);
                testToken(test, stream.expect(TokenType.NAME), 'bar', 1, 10);
                testToken(test, stream.expect(TokenType.INTERPOLATION_END), '}', 1, 13);
                testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 14);
                testToken(test, stream.expect(TokenType.PUNCTUATION), ']', 1, 15);
                testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 16);
                testToken(test, stream.getCurrent(), null, 1, 18, TokenType.EOF);

                test.end();
            });

            test.end();
        });

        test.end();
    });

    test.test('lex strings', (test) => {
        test.test('empty', (test) => {
            let source = '{{""}}';

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 3);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 4);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 5);
            testToken(test, stream.getCurrent(), null, 1, 7, TokenType.EOF);

            test.end();
        });

        test.end();
    });

    test.test('lex brackets', (test) => {
        let lexer = createLexer();
        let stream = lexer.tokenize('{{ {"a":{"b":"c"}} }}');

        testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
        testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
        testToken(test, stream.expect(TokenType.PUNCTUATION), '{', 1, 4);
        testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 5);
        testToken(test, stream.expect(TokenType.STRING), 'a', 1, 6);
        testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 7);
        testToken(test, stream.expect(TokenType.PUNCTUATION), ':', 1, 8);
        testToken(test, stream.expect(TokenType.PUNCTUATION), '{', 1, 9);
        testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 10);
        testToken(test, stream.expect(TokenType.STRING), 'b', 1, 11);
        testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 12);
        testToken(test, stream.expect(TokenType.PUNCTUATION), ':', 1, 13);
        testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 14);
        testToken(test, stream.expect(TokenType.STRING), 'c', 1, 15);
        testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 16);
        testToken(test, stream.expect(TokenType.PUNCTUATION), '}', 1, 17);
        testToken(test, stream.expect(TokenType.PUNCTUATION), '}', 1, 18);
        testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 19);
        testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 20);
        testToken(test, stream.getCurrent(), null, 1, 22, TokenType.EOF);

        test.test('with non-opening bracket', (test) => {
            let lexer = createLexer();

            try {
                lexer.tokenize('{{ a] }}');

                test.fail('should throw a syntax error');
            } catch (e) {
                test.same((e as SyntaxError).name, 'SyntaxError');
                test.same((e as SyntaxError).message, 'Unexpected "]".');
                test.same((e as SyntaxError).line, 1);
                test.same((e as SyntaxError).column, 5);
            }

            test.end();
        });

        test.end();
    });

    test.test('lex verbatim', (test) => {
        test.test('spanning multiple lines', (test) => {
            let source = `{% verbatim %}
    {{ "bla" }}
{% endverbatim %}`;

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'verbatim', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 12);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 13);
            testToken(test, stream.expect(TokenType.TEXT), '\n    {{ "bla" }}\n', 1, 15);
            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 3, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 3, 3);
            testToken(test, stream.expect(TokenType.NAME), 'endverbatim', 3, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 3, 15);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 3, 16);
            testToken(test, stream.getCurrent(), null, 3, 18, TokenType.EOF);

            test.end();
        });

        test.test('long', (test) => {
            let source = `{% verbatim %}${'*'.repeat(100000)}{% endverbatim %}`;

            let lexer = createLexer();
            let stream = lexer.tokenize(source);


            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'verbatim', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 12);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 13);
            testToken(test, stream.expect(TokenType.TEXT), '*'.repeat(100000), 1, 15);
            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 100015);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 100017);
            testToken(test, stream.expect(TokenType.NAME), 'endverbatim', 1, 100018);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 100029);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 100030);
            testToken(test, stream.getCurrent(), null, 1, 100032, TokenType.EOF);

            test.end();
        });

        test.test('surrounded by data and containing Twig syntax', (test) => {
            let source = `foo{% verbatim %}{{bla}}{% endverbatim %}foo`;

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.TEXT), 'foo', 1, 1);
            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 6);
            testToken(test, stream.expect(TokenType.NAME), 'verbatim', 1, 7);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 15);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 16);
            testToken(test, stream.expect(TokenType.TEXT), '{{bla}}', 1, 18);
            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 25);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 27);
            testToken(test, stream.expect(TokenType.NAME), 'endverbatim', 1, 28);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 39);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 40);
            testToken(test, stream.expect(TokenType.TEXT), 'foo', 1, 42);
            testToken(test, stream.getCurrent(), null, 1, 45, TokenType.EOF);

            test.end();
        });

        test.test('unclosed', (test) => {
            let lexer = createLexer();

            try {
                lexer.tokenize(`{% verbatim %}
{{ "bla" }}`);

                test.fail('should throw a syntax error');
            } catch (e) {
                test.same((e as SyntaxError).name, 'SyntaxError');
                test.same((e as SyntaxError).message, 'Unexpected end of file: unclosed verbatim opened at {1:1}.');
                test.same((e as SyntaxError).line, 2);
                test.same((e as SyntaxError).column, 12);
            }

            test.end();
        });

        test.end();
    });

    test.test('lex variable', (test) => {
        test.test('without whitespaces', (test) => {
            let source = `{{bla}}`;

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.NAME), 'bla', 1, 3);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 6);
            testToken(test, stream.getCurrent(), null, 1, 8, TokenType.EOF);

            test.end();
        });

        test.test('with whitespaces', (test) => {
            let source = `{{ 
bla }}`;

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' \n', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'bla', 2, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 2, 4);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 2, 5);
            testToken(test, stream.getCurrent(), null, 2, 7, TokenType.EOF);

            test.end();
        });

        test.test('long', (test) => {
            let source = `{{ ${'x'.repeat(100000)} }}`;

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'x'.repeat(100000), 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 100004);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 100005);
            testToken(test, stream.getCurrent(), null, 1, 100007, TokenType.EOF);

            test.end();
        });

        test.test('with special character as name', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ § }}');

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), '§', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 5);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 6);
            testToken(test, stream.getCurrent(), null, 1, 8, TokenType.EOF);

            test.end();
        });

        test.test('with parenthesis', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ f() }}');

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'f', 1, 4);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '(', 1, 5);
            testToken(test, stream.expect(TokenType.PUNCTUATION), ')', 1, 6);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 7);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 8);
            testToken(test, stream.getCurrent(), null, 1, 10, TokenType.EOF);

            test.end();
        });

        test.test('with parenthesis and parameters', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ f("foo {{bar}}") }}');

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'f', 1, 4);
            testToken(test, stream.expect(TokenType.PUNCTUATION), '(', 1, 5);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 6);
            testToken(test, stream.expect(TokenType.STRING), 'foo {{bar}}', 1, 7);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 18);
            testToken(test, stream.expect(TokenType.PUNCTUATION), ')', 1, 19);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 20);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 21);
            testToken(test, stream.getCurrent(), null, 1, 23, TokenType.EOF);

            test.end();
        });

        test.test('unclosed', (test) => {
            let lexer = createLexer();

            try {
                lexer.tokenize('{{ bar ');

                test.fail('should throw a syntax error');
            } catch (e) {
                test.same((e as SyntaxError).name, 'SyntaxError');
                test.same((e as SyntaxError).message, 'Unexpected end of file: unclosed variable opened at {1:1}.');
                test.same((e as SyntaxError).line, 1);
                test.same((e as SyntaxError).column, 8);
            }

            test.end();
        });

        test.end();
    });

    test.test('lex block', (test) => {
        test.test('multiple lines', (test) => {
            let source = `{%
bla
%}`;

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), '\n', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'bla', 2, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), '\n', 2, 4);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 3, 1);
            testToken(test, stream.getCurrent(), null, 3, 3, TokenType.EOF);

            test.end();
        });

        test.test('long', (test) => {
            let source = `{% ${'x'.repeat(100000)} %}`;

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'x'.repeat(100000), 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 100004);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 100005);
            testToken(test, stream.getCurrent(), null, 1, 100007, TokenType.EOF);

            test.end();
        });

        test.test('with special character as name', (test) => {
            let source = '{% § %}';

            let lexer = createLexer();
            let stream = lexer.tokenize(source);

            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), '§', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 5);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 6);
            testToken(test, stream.getCurrent(), null, 1, 8, TokenType.EOF);

            test.end();
        });

        test.test('unclosed', (test) => {
            let lexer = createLexer();

            try {
                lexer.tokenize('{% bar ');

                test.fail('should throw a syntax error');
            } catch (e) {
                test.same((e as SyntaxError).name, 'SyntaxError');
                test.same((e as SyntaxError).message, 'Unexpected end of file: unclosed block opened at {1:1}.');
                test.same((e as SyntaxError).line, 1);
                test.same((e as SyntaxError).column, 8);
            }

            test.end();
        });

        test.test('block end consumes next line separator', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{%rn%}\r\n{%r%}\r{%n%}\n');

            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.NAME), 'rn', 1, 3);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}\r\n', 1, 5);
            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 2, 1);
            testToken(test, stream.expect(TokenType.NAME), 'r', 2, 3);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}\r', 2, 4);
            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 3, 1);
            testToken(test, stream.expect(TokenType.NAME), 'n', 3, 3);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}\n', 3, 4);
            testToken(test, stream.getCurrent(), null, 4, 1, TokenType.EOF);

            test.end();
        });

        test.end();
    });

    test.test('lex number', (test) => {
        test.test('integer', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ 922337203685477580700 }}');

            console.warn(stream);

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NUMBER), '922337203685477580700', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 25);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 26);
            testToken(test, stream.getCurrent(), null, 1, 28, TokenType.EOF);

            test.end();
        });

        test.test('float', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ 92233720368547.7580700 }}');

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NUMBER), '92233720368547.7580700', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 26);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 27);
            testToken(test, stream.getCurrent(), null, 1, 29, TokenType.EOF);

            test.end();
        });

        test.end();
    });

    test.test('lex string', (test) => {
        test.test('with escaped delimiter', (test) => {
            let fixtures = [
                {template: "{{ 'foo \\' bar' }}", name: "foo \\' bar", expected: "foo \\' bar", quote: '\''},
                {template: '{{ "foo \\" bar" }}', name: 'foo \\" bar', expected: 'foo \\" bar', quote: '"'}
            ];

            fixtures.forEach((fixture) => {
                let lexer = createLexer();
                let stream = lexer.tokenize(fixture.template);

                testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
                testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
                testToken(test, stream.expect(TokenType.OPENING_QUOTE), fixture.quote, 1, 4);
                testToken(test, stream.expect(TokenType.STRING), fixture.expected, 1, 5);
                testToken(test, stream.expect(TokenType.CLOSING_QUOTE), fixture.quote, 1, 15);
                testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 16);
                testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 17);
                testToken(test, stream.getCurrent(), null, 1, 19, TokenType.EOF);
            });

            test.end();
        });

        test.test('with interpolation', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('foo {{ "bar #{ baz + 1 }" }}');

            testToken(test, stream.expect(TokenType.TEXT), 'foo ', 1, 1);
            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 5);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 7);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 8);
            testToken(test, stream.expect(TokenType.STRING), 'bar ', 1, 9);
            testToken(test, stream.expect(TokenType.INTERPOLATION_START), '#{', 1, 13);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 15);
            testToken(test, stream.expect(TokenType.NAME), 'baz', 1, 16);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 19);
            testToken(test, stream.expect(TokenType.OPERATOR), '+', 1, 20);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 21);
            testToken(test, stream.expect(TokenType.NUMBER), '1', 1, 22);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 23);
            testToken(test, stream.expect(TokenType.INTERPOLATION_END), '}', 1, 24);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 25);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 26);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 27);
            testToken(test, stream.getCurrent(), null, 1, 29, TokenType.EOF);

            test.end();
        });

        test.test('with escaped interpolation', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ "bar \\#{baz+1}" }}');

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 4);
            testToken(test, stream.expect(TokenType.STRING), 'bar \\#{baz+1}', 1, 5);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 18);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 19);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 20);
            testToken(test, stream.getCurrent(), null, 1, 22, TokenType.EOF);

            test.end();
        });

        test.test('with hash', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ "bar # baz" }}');

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 4);
            testToken(test, stream.expect(TokenType.STRING), 'bar # baz', 1, 5);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 14);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 15);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 16);
            testToken(test, stream.getCurrent(), null, 1, 18, TokenType.EOF);

            test.end();
        });

        test.test('with unclosed interpolation', (test) => {
            let lexer = createLexer();

            try {
                lexer.tokenize(`{{ "bar #{x" }}
 `);

                test.fail('should throw a syntax error');
            } catch (e) {
                test.same((e as SyntaxError).name, 'SyntaxError');
                test.same((e as SyntaxError).message, 'Unexpected end of file: unclosed """ opened at {1:12}.');
                test.same((e as SyntaxError).line, 2);
                test.same((e as SyntaxError).column, 2);
            }

            test.end();
        });

        test.test('with nested interpolation', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ "bar #{ "foo#{bar}" }" }}');

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 4);
            testToken(test, stream.expect(TokenType.STRING), 'bar ', 1, 5);
            testToken(test, stream.expect(TokenType.INTERPOLATION_START), '#{', 1, 9);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 11);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 12);
            testToken(test, stream.expect(TokenType.STRING), 'foo', 1, 13);
            testToken(test, stream.expect(TokenType.INTERPOLATION_START), '#{', 1, 16);
            testToken(test, stream.expect(TokenType.NAME), 'bar', 1, 18);
            testToken(test, stream.expect(TokenType.INTERPOLATION_END), '}', 1, 21);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 22);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 23);
            testToken(test, stream.expect(TokenType.INTERPOLATION_END), '}', 1, 24);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 25);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 26);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 27);
            testToken(test, stream.getCurrent(), null, 1, 29, TokenType.EOF);

            test.end();
        });

        test.test('with nested interpolation in block', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{% foo "bar #{ "foo#{bar}" }" %}');

            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 7);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 8);
            testToken(test, stream.expect(TokenType.STRING), 'bar ', 1, 9);
            testToken(test, stream.expect(TokenType.INTERPOLATION_START), '#{', 1, 13);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 15);
            testToken(test, stream.expect(TokenType.OPENING_QUOTE), '"', 1, 16);
            testToken(test, stream.expect(TokenType.STRING), 'foo', 1, 17);
            testToken(test, stream.expect(TokenType.INTERPOLATION_START), '#{', 1, 20);
            testToken(test, stream.expect(TokenType.NAME), 'bar', 1, 22);
            testToken(test, stream.expect(TokenType.INTERPOLATION_END), '}', 1, 25);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 26);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 27);
            testToken(test, stream.expect(TokenType.INTERPOLATION_END), '}', 1, 28);
            testToken(test, stream.expect(TokenType.CLOSING_QUOTE), '"', 1, 29);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 30);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 31);
            testToken(test, stream.getCurrent(), null, 1, 33, TokenType.EOF);

            test.end();
        });

        test.end();
    });

    test.test('lex operator', (test) => {
        test.test('ending with a letter at the end of a line', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{{ 1 and\n0}}');

            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.NUMBER), '1', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 5);
            testToken(test, stream.expect(TokenType.OPERATOR), 'and', 1, 6);
            testToken(test, stream.expect(TokenType.WHITESPACE), '\n', 1, 9);
            testToken(test, stream.expect(TokenType.NUMBER), '0', 2, 1);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 2, 2);
            testToken(test, stream.getCurrent(), null, 2, 4, TokenType.EOF);

            test.end();
        });

        test.end();
    });

    test.test('lex text', (test) => {
        let lexer = createLexer();
        let stream = lexer.tokenize('foo ');

        testToken(test, stream.expect(TokenType.TEXT), 'foo ', 1, 1);
        testToken(test, stream.getCurrent(), null, 1, 5, TokenType.EOF);

        test.test('containing line feeds', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('\r\rfoo\r\nbar\roof\n\r');

            testToken(test, stream.expect(TokenType.TEXT), '\r\rfoo\r\nbar\roof\n\r', 1, 1);
            testToken(test, stream.getCurrent(), null, 7, 1, TokenType.EOF);

            test.end();
        });

        test.test('at start and end of a template', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('foo {{bar}} bar');

            testToken(test, stream.expect(TokenType.TEXT), 'foo ', 1, 1);
            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 5);
            testToken(test, stream.expect(TokenType.NAME), 'bar', 1, 7);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 10);
            testToken(test, stream.expect(TokenType.TEXT), ' bar', 1, 12);
            testToken(test, stream.getCurrent(), null, 1, 16, TokenType.EOF);

            test.end();
        });

        test.end();
    });

    test.test('lex whitespace control modifiers', (test) => {
        test.test('whitespace trimming', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{%- foo -%}');

            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING), '-', 1, 3);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 4);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 5);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 8);
            testToken(test, stream.expect(TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING), '-', 1, 9);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 10);
            testToken(test, stream.getCurrent(), null, 1, 12, TokenType.EOF);

            test.end();
        });

        test.test('line whitespace trimming', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{%~ foo ~%}');

            testToken(test, stream.expect(TokenType.BLOCK_START), '{%', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING), '~', 1, 3);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 4);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 5);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 8);
            testToken(test, stream.expect(TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING), '~', 1, 9);
            testToken(test, stream.expect(TokenType.BLOCK_END), '%}', 1, 10);
            testToken(test, stream.getCurrent(), null, 1, 12, TokenType.EOF);

            test.end();
        });
    });

    test.test('lex comment', (test) => {
        let lexer = createLexer();
        let stream = lexer.tokenize('{# foo bar #}');

        testToken(test, stream.expect(TokenType.COMMENT_START), '{#', 1, 1);
        testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
        testToken(test, stream.expect(TokenType.TEXT), 'foo bar', 1, 4);
        testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 11);
        testToken(test, stream.expect(TokenType.COMMENT_END), '#}', 1, 12);
        testToken(test, stream.getCurrent(), null, 1, 14, TokenType.EOF);

        test.test('long comments', (test) => {
            let value = '*'.repeat(100000);

            let lexer = createLexer();
            let stream = lexer.tokenize('{#' + value + '#}');

            testToken(test, stream.expect(TokenType.COMMENT_START), '{#', 1, 1);
            testToken(test, stream.expect(TokenType.TEXT), value, 1, 3);
            testToken(test, stream.expect(TokenType.COMMENT_END), '#}', 1, 100003);
            testToken(test, stream.getCurrent(), null, 1, 100005, TokenType.EOF);

            test.end();
        });

        test.test('unclosed', (test) => {
            try {
                lexer.tokenize(`{#
 `);

                test.fail('should throw a syntax error');
            } catch (e) {
                test.same((e as SyntaxError).name, 'SyntaxError');
                test.same((e as SyntaxError).message, 'Unexpected end of file: unclosed comment opened at {1:1}.');
                test.same((e as SyntaxError).line, 2);
                test.same((e as SyntaxError).column, 2);
            }

            test.end();
        });

        test.test('and consume next line separator', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{#rn#}\r\n{#r#}\r{#n#}\n');

            testToken(test, stream.expect(TokenType.COMMENT_START), '{#', 1, 1);
            testToken(test, stream.expect(TokenType.TEXT), 'rn', 1, 3);
            testToken(test, stream.expect(TokenType.COMMENT_END), '#}\r\n', 1, 5);
            testToken(test, stream.expect(TokenType.COMMENT_START), '{#', 2, 1);
            testToken(test, stream.expect(TokenType.TEXT), 'r', 2, 3);
            testToken(test, stream.expect(TokenType.COMMENT_END), '#}\r', 2, 4);
            testToken(test, stream.expect(TokenType.COMMENT_START), '{#', 3, 1);
            testToken(test, stream.expect(TokenType.TEXT), 'n', 3, 3);
            testToken(test, stream.expect(TokenType.COMMENT_END), '#}\n', 3, 4);
            testToken(test, stream.getCurrent(), null, 4, 1, TokenType.EOF);

            test.end();
        });

        test.test('followed by a non-comment', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{# a #}{{foo}}');

            testToken(test, stream.expect(TokenType.COMMENT_START), '{#', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.TEXT), 'a', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 5);
            testToken(test, stream.expect(TokenType.COMMENT_END), '#}', 1, 6);
            testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 8);
            testToken(test, stream.expect(TokenType.NAME), 'foo', 1, 10);
            testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 13);
            testToken(test, stream.getCurrent(), null, 1, 15, TokenType.EOF);

            test.end();
        });

        test.test('containing block', (test) => {
            let lexer = createLexer();
            let stream = lexer.tokenize('{# {{a}} #}');

            testToken(test, stream.expect(TokenType.COMMENT_START), '{#', 1, 1);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
            testToken(test, stream.expect(TokenType.TEXT), '{{a}}', 1, 4);
            testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 9);
            testToken(test, stream.expect(TokenType.COMMENT_END), '#}', 1, 10);
            testToken(test, stream.getCurrent(), null, 1, 12, TokenType.EOF);

            test.end();
        });

        test.end();
    });

    test.test('lex punctuation', (test) => {
        let lexer = createLexer();
        let stream = lexer.tokenize('{{ [1, 2] }}');

        testToken(test, stream.expect(TokenType.VARIABLE_START), '{{', 1, 1);
        testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 3);
        testToken(test, stream.expect(TokenType.PUNCTUATION), '[', 1, 4);
        testToken(test, stream.expect(TokenType.NUMBER), '1', 1, 5);
        testToken(test, stream.expect(TokenType.PUNCTUATION), ',', 1, 6);
        testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 7);
        testToken(test, stream.expect(TokenType.NUMBER), '2', 1, 8);
        testToken(test, stream.expect(TokenType.PUNCTUATION), ']', 1, 9);
        testToken(test, stream.expect(TokenType.WHITESPACE), ' ', 1, 10);
        testToken(test, stream.expect(TokenType.VARIABLE_END), '}}', 1, 11);
        testToken(test, stream.getCurrent(), null, 1, 13, TokenType.EOF);

        test.test('unclosed bracket', (test) => {
            try {
                lexer.tokenize(`{{ [1 }}`);

                test.fail('should throw a syntax error');
            } catch (e) {
                test.same((e as SyntaxError).name, 'SyntaxError');
                test.same((e as SyntaxError).message, 'Unclosed bracket "[" opened at {1:4}.');
                test.same((e as SyntaxError).line, 1);
                test.same((e as SyntaxError).column, 7);
            }

            test.end();
        });

        test.end();
    });

    test.test('handle unlexable source', (test) => {
        let lexer = createLexer();

        try {
            lexer.tokenize('{{ ^ }}');

            test.fail('should throw a syntax error');
        } catch (e) {
            test.same((e as SyntaxError).name, 'SyntaxError');
            test.same((e as SyntaxError).message, 'Unexpected character "^ }}".');
            test.same((e as SyntaxError).line, 1);
            test.same((e as SyntaxError).column, 4);
        }

        test.end();
    });

    test.end();
});