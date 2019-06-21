import * as tape from 'tape';
import {Token, TokenType} from '../../../src/Token';

tape('Token', (test) => {
    test.test('should support type to string representation', (test) => {
        test.same(Token.typeToString(TokenType.BLOCK_END), 'TokenType.BLOCK_END');
        test.same(Token.typeToString(TokenType.BLOCK_START), 'TokenType.BLOCK_START');
        test.same(Token.typeToString(TokenType.EOF), 'TokenType.EOF');
        test.same(Token.typeToString(TokenType.INTERPOLATION_END), 'TokenType.INTERPOLATION_END');
        test.same(Token.typeToString(TokenType.INTERPOLATION_START), 'TokenType.INTERPOLATION_START');
        test.same(Token.typeToString(TokenType.NAME), 'TokenType.NAME');
        test.same(Token.typeToString(TokenType.NUMBER), 'TokenType.NUMBER');
        test.same(Token.typeToString(TokenType.OPERATOR), 'TokenType.OPERATOR');
        test.same(Token.typeToString(TokenType.PUNCTUATION), 'TokenType.PUNCTUATION');
        test.same(Token.typeToString(TokenType.STRING), 'TokenType.STRING');
        test.same(Token.typeToString(TokenType.TEXT), 'TokenType.TEXT');
        test.same(Token.typeToString(TokenType.VARIABLE_END), 'TokenType.VARIABLE_END');
        test.same(Token.typeToString(TokenType.VARIABLE_START), 'TokenType.VARIABLE_START');
        test.same(Token.typeToString(TokenType.WHITESPACE), 'TokenType.WHITESPACE');
        test.same(Token.typeToString(TokenType.CLOSING_QUOTE), 'TokenType.CLOSING_QUOTE');
        test.same(Token.typeToString(TokenType.OPENING_QUOTE), 'TokenType.OPENING_QUOTE');
        test.same(Token.typeToString(TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING), 'TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING');
        test.same(Token.typeToString(TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING), 'TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING');
        test.same(Token.typeToString(TokenType.BLOCK_END, true), 'BLOCK_END');
        test.same(Token.typeToString(TokenType.BLOCK_START, true), 'BLOCK_START');
        test.same(Token.typeToString(TokenType.EOF, true), 'EOF');
        test.same(Token.typeToString(TokenType.INTERPOLATION_END, true), 'INTERPOLATION_END');
        test.same(Token.typeToString(TokenType.INTERPOLATION_START, true), 'INTERPOLATION_START');
        test.same(Token.typeToString(TokenType.NAME, true), 'NAME');
        test.same(Token.typeToString(TokenType.NUMBER, true), 'NUMBER');
        test.same(Token.typeToString(TokenType.OPERATOR, true), 'OPERATOR');
        test.same(Token.typeToString(TokenType.PUNCTUATION, true), 'PUNCTUATION');
        test.same(Token.typeToString(TokenType.STRING, true), 'STRING');
        test.same(Token.typeToString(TokenType.TEXT, true), 'TEXT');
        test.same(Token.typeToString(TokenType.VARIABLE_END, true), 'VARIABLE_END');
        test.same(Token.typeToString(TokenType.VARIABLE_START, true), 'VARIABLE_START');
        test.same(Token.typeToString(TokenType.COMMENT_START, true), 'COMMENT_START');
        test.same(Token.typeToString(TokenType.COMMENT_END, true), 'COMMENT_END');
        test.same(Token.typeToString(TokenType.WHITESPACE, true), 'WHITESPACE');
        test.same(Token.typeToString(TokenType.CLOSING_QUOTE, true), 'CLOSING_QUOTE');
        test.same(Token.typeToString(TokenType.OPENING_QUOTE, true), 'OPENING_QUOTE');
        test.same(Token.typeToString(TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING, true), 'WHITESPACE_CONTROL_MODIFIER_TRIMMING');
        test.same(Token.typeToString(TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING, true), 'WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING');

        test.throws(function () {
            Token.typeToString(-999 as any);
        }, 'Token of type "-999" does not exist.');

        test.end();
    });

    test.test('should support type to english representation', (test) => {
        test.same(Token.typeToEnglish(TokenType.BLOCK_END), 'end of statement block');
        test.same(Token.typeToEnglish(TokenType.BLOCK_START), 'begin of statement block');
        test.same(Token.typeToEnglish(TokenType.EOF), 'end of template');
        test.same(Token.typeToEnglish(TokenType.INTERPOLATION_END), 'end of string interpolation_pair');
        test.same(Token.typeToEnglish(TokenType.INTERPOLATION_START), 'begin of string interpolation_pair');
        test.same(Token.typeToEnglish(TokenType.NAME), 'name');
        test.same(Token.typeToEnglish(TokenType.NUMBER), 'number');
        test.same(Token.typeToEnglish(TokenType.OPERATOR), 'operator');
        test.same(Token.typeToEnglish(TokenType.PUNCTUATION), 'punctuation');
        test.same(Token.typeToEnglish(TokenType.STRING), 'string');
        test.same(Token.typeToEnglish(TokenType.TEXT), 'text');
        test.same(Token.typeToEnglish(TokenType.VARIABLE_END), 'end of print statement');
        test.same(Token.typeToEnglish(TokenType.VARIABLE_START), 'begin of print statement');
        test.same(Token.typeToEnglish(TokenType.COMMENT_START), 'begin of comment statement');
        test.same(Token.typeToEnglish(TokenType.COMMENT_END), 'end of comment statement');
        test.same(Token.typeToEnglish(TokenType.WHITESPACE), 'whitespace');
        test.same(Token.typeToEnglish(TokenType.CLOSING_QUOTE), 'closing quote');
        test.same(Token.typeToEnglish(TokenType.OPENING_QUOTE), 'opening quote');
        test.same(Token.typeToEnglish(TokenType.WHITESPACE_CONTROL_MODIFIER_TRIMMING), 'trimming whitespace control modifier');
        test.same(Token.typeToEnglish(TokenType.WHITESPACE_CONTROL_MODIFIER_LINE_TRIMMING), 'line trimming whitespace control modifier');

        test.throws(function () {
            Token.typeToEnglish('999' as any);
        }, 'Token of type "-999" does not exist.');

        test.end();
    });

    test.test('test', (test) => {
        test.test('accept a single parameter', (test) => {
            let token = new Token(TokenType.TEXT, 'foo', 1, 1);

            test.true(token.test(TokenType.TEXT));
            test.false(token.test(TokenType.STRING));

            test.end();
        });

        test.test('accept two parameters', (test) => {
            test.test('with string as second parameter', (test) => {
                let token = new Token(TokenType.TEXT, 'foo', 1, 1);

                test.true(token.test(TokenType.TEXT, 'foo'));
                test.false(token.test(TokenType.TEXT, 'bar'));

                test.end();
            });

            test.test('with number as second parameter', (test) => {
                let token = new Token(TokenType.TEXT, '5', 1, 1);

                test.true(token.test(TokenType.TEXT, 5));
                test.false(token.test(TokenType.TEXT, 6));

                test.end();
            });

            test.test('with array of strings as second parameter', (test) => {
                let token = new Token(TokenType.TEXT, 'foo', 1, 1);

                test.true(token.test(TokenType.TEXT, ['foo', 'bar']));
                test.false(token.test(TokenType.TEXT, ['fooo', 'bar']));

                test.end();
            });
        });

        test.end();
    });

    test.test('serialize', (test) => {
        let token = new Token(TokenType.TEXT, '\nfoo\nbar\n', 1, 1);

        let expected = `
foo
bar
`;

        test.same(token.serialize(), expected);

        test.end();
    });

    test.test('toString', (test) => {
        let token = new Token(TokenType.TEXT, '\nfoo\nbar\n', 1, 1);

        let expected = `TEXT(\nfoo\nbar\n)`;

        test.same(token.toString(), expected);

        test.end();

        test.test('on token with null content', (test) => {
            let token = new Token(TokenType.TEXT, null, 1, 1);

            let expected = `TEXT()`;

            test.same(token.toString(), expected);

            test.end();
        });
    });

    test.end();
});