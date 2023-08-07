import { VARCHAR, INT4, INT8, TIMESTAMPTZ, JSON } from './columnTypes'

export const STRING = 'string'
export const NUMBER = 'number'
export const BOOLEAN = 'boolean'
export const BIG_INT = 'BigInt'
export const BLOCK_NUMBER = 'BlockNumber'
export const TIMESTAMP = 'Timestamp'
export const ADDRESS = 'Address'
export const BLOCK_HASH = 'BlockHash'
export const TRANSACTION_HASH = 'TransactionHash'
export const CHAIN_ID = 'ChainId'
export const JSON_PROPERTY_TYPE = 'Json'
export const DATE = 'date'
export const OBJECT = 'object'
export const SYMBOL = 'symbol'

export const isDate = (value: any): boolean =>
    Object.prototype.toString.call(value) === '[object Date]'

export const isObject = (value: any): boolean =>
    Object.prototype.toString.call(value) === '[object Object]'

export function guessColType(t: string): string {
    switch (t.toLowerCase()) {
        // Varchars
        case STRING:
        case SYMBOL:
        case ADDRESS.toLowerCase():
        case CHAIN_ID.toLowerCase():
        case BLOCK_HASH.toLowerCase():
        case TRANSACTION_HASH.toLowerCase():
        case BIG_INT.toLowerCase(): // extra protection
            return VARCHAR

        // Integer
        case NUMBER:
            return INT4

        // Big Ints (within range - i.e. block number)
        case BLOCK_NUMBER.toLowerCase():
            return INT8

        // Booleans
        case BOOLEAN:
            return BOOLEAN

        // Datetimes
        case DATE:
        case TIMESTAMP.toLowerCase():
            return TIMESTAMPTZ

        // JSON
        case OBJECT:
        case JSON_PROPERTY_TYPE.toLowerCase():
            return JSON

        default:
            throw `Unable to guess column type for property type "${t}"`
    }
}
