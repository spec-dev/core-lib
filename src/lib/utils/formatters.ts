import { EventNameComps } from '../types'
import humps from './humps'

export const toNamespacedVersion = (nsp: string, name: string, version: string) =>
    `${nsp}.${name}@${version}`

export const fromNamespacedVersion = (namespacedVersion: string): EventNameComps => {
    const atSplit = (namespacedVersion || '').split('@')
    if (atSplit.length !== 2) {
        return { nsp: '', name: '', version: '' }
    }

    const [nspName, version] = atSplit
    const dotSplit = (nspName || '').split('.')
    if (dotSplit.length < 2) {
        return { nsp: '', name: '', version: '' }
    }

    const name = dotSplit.pop() || ''
    const nsp = dotSplit.join('.')
    return { nsp, name, version }
}

export const removeFirstDotSection = (nsp: string): string => {
    const split = nsp.split('.')
    split.shift()
    return split.join('.')
}

export const removeAcronymFromCamel = (val: string): string => {
    val = val || ''

    let formattedVal = ''
    for (let i = 0; i < val.length; i++) {
        const [prevChar, char, nextChar] = [val[i - 1], val[i], val[i + 1]]
        const [prevCharIsUpperCase, charIsUpperCase, nextCharIsUpperCase] = [
            prevChar && prevChar === prevChar.toUpperCase(),
            char && char === char.toUpperCase(),
            nextChar && nextChar === nextChar.toUpperCase(),
        ]

        if (
            prevCharIsUpperCase &&
            charIsUpperCase &&
            (nextCharIsUpperCase || i === val.length - 1)
        ) {
            formattedVal += char.toLowerCase()
        } else {
            formattedVal += char
        }
    }

    return formattedVal
}

export const camelToSnake = (val: string): string => {
    return humps.decamelize(removeAcronymFromCamel(val))
}

export const snakeToCamel = (val: string): string => {
    return humps.camelize(val)
}

export function stringify(data: any, fallback: any = null): string | null {
    try {
        return JSON.stringify(data)
    } catch (err) {
        return fallback
    }
}

export const attemptToParseNumber = (originalValue: any): any => {
    try {
        const numberValue = Number(originalValue)
        return numberValue > Number.MAX_SAFE_INTEGER ? originalValue : numberValue
    } catch (err) {
        return originalValue
    }
}

export const attemptToParseDate = (originalValue: any): any => {
    try {
        return new Date(originalValue)
    } catch (err) {
        return originalValue
    }
}
