/*!
 * react-emojione
 * Copyright(c) 2017 Pedro Ladaria
 * MIT Licensed
 *
 * Emoji provided free by http://emojione.com
 */
import React from 'react';
import ASCII_DATA from './data/ascii-to-unicode';
import getRenderer from './renderers/renderer-factory';
import {unicodes, shortToCodepoint, unicodeToCodepoint} from './utils/emoji-format-conversion';

const DEFAULT_OPTIONS = {
    convertShortnames: true,
    convertUnicode: true,
    convertAscii: true,
    style: {
        backgroundImage: 'url(https://cdnjs.cloudflare.com/ajax/libs/emojione/2.2.7/assets/sprites/emojione.sprites.png)'
    },
    onClick: undefined,
    output: 'emoji' // valid options: 'emoji', 'unicode'
};

const asciiToUnicodeCache = new Map();
const asciiRegExpToUnicode = new Map();

ASCII_DATA.forEach(([reStr, unicode]) => asciiRegExpToUnicode.set(RegExp(reStr), unicode));

// Escape RegExp code borrowed from lodash
const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExpChar = RegExp(reRegExpChar.source);
const escapeRegExp = s =>
    (s && reHasRegExpChar.test(s)) ? s.replace(reRegExpChar, '\\$&') : s;


const convertAsciiToUnicodeOrNull = text => {
    if (!text) {
        return '';
    }
    const str = String(text);
    if (asciiToUnicodeCache.has(str)) {
        return asciiToUnicodeCache.get(str);
    }
    for (const [regExp, unicode] of asciiRegExpToUnicode.entries()) {
        if (str.replace(regExp, unicode) === unicode) {
            asciiToUnicodeCache.set(str, unicode);
            return unicode;
        }
    }
    return null;
};

const asciiRegexStr = ASCII_DATA.map(([reStr, ]) => reStr).join('|');
const unicodesRegexStr = unicodes.map(escapeRegExp).join('|');
const shortnamesRegexStr = ':\\w+:';

const REGEX_CACHE = [];

const getRegex = (withUnicode, withAscii, withShortnames) => {
    const index = (withUnicode ? 1 : 0) + (withAscii ? 2 : 0) + (withShortnames ? 4 : 0);
    if (!REGEX_CACHE[index]) {
        const parts = [
            withShortnames ? shortnamesRegexStr : '',
            withUnicode ? unicodesRegexStr : '',
            withAscii ? asciiRegexStr : '',
        ].filter(Boolean);
        REGEX_CACHE[index] = RegExp(`(${parts.join('|')})`);
    }
    return REGEX_CACHE[index];
};

const startsWithSpace = str => (/^\s/).test(str);
const endsWithSpace = str => (/\s$/).test(str);

const shouldConvertAscii = (parts, index) => {
    if (parts.length === 1) {
        return true;
    }
    if (index === 0) {
        return startsWithSpace(parts[index + 1]);
    }
    if (index === parts.length - 1) {
        return endsWithSpace(parts[index - 1]);
    }
    return endsWithSpace(parts[index - 1]) && startsWithSpace(parts[index + 1]);
};

export const emojify = (str, options = {}) => {

    const mergedOptions = Object.assign({}, DEFAULT_OPTIONS, options);

    const {convertShortnames, convertUnicode, convertAscii} = mergedOptions;

    const regExp = getRegex(convertUnicode, convertAscii, convertShortnames);

    const renderCodepoint = getRenderer(mergedOptions);

    const convertedParts = str.split(regExp).filter(Boolean).map((part, index, parts) => {
        if (convertAscii && shouldConvertAscii(parts, index)) {
            const unicode = convertAsciiToUnicodeOrNull(part);
            if (unicode) {
                return renderCodepoint(unicodeToCodepoint.get(unicode), `a-${index}`);
            }
        }
        if (convertShortnames && shortToCodepoint.has(part)) {
            return renderCodepoint(shortToCodepoint.get(part), `s-${index}`);
        }
        if (convertUnicode && unicodeToCodepoint.has(part)) {
            return renderCodepoint(unicodeToCodepoint.get(part), `u-${index}`);
        }
        return part;
    });

    return mergedOptions.output === 'unicode' ? convertedParts.join('') : convertedParts;
};

class Emojify extends React.Component {

    emojifyNode(node, options) {
        if (typeof node === 'string') {
            return emojify(node, options);
        }
        if (Array.isArray(node)) {
            return node.map(n => this.emojifyNode(n, options));
        }
        if (React.isValidElement(node)) {
            return React.cloneElement(
                node,
                node.props,
                React.Children
                    .toArray(node.props.children)
                    .map(n => this.emojifyNode(n, options))
            );
        }
        return node;
    }

    render() {
        const options = this.props;
        const node = this.props.children;
        if (Array.isArray(node)) {
            return <span>{this.emojifyNode(node, options)}</span>;
        }
        const count = React.Children.count(node);
        if (count === 0) {
            return null;
        }
        if (count > 1) {
            return (
                <span>{this.emojifyNode(node, options)}</span>
            );
        }
        if (typeof node === 'string') {
            return (
                <span>{emojify(node, options)}</span>
            );
        }
        return this.emojifyNode(node, options);
    }
}

export default Emojify;
