import { INT8, FLOAT8, VARCHAR, JSON, TIMESTAMPTZ } from './columnTypes'

export const STRING = 'string'
export const NUMBER = 'number'
export const BOOLEAN = 'boolean'
export const DATE = 'date'
export const OBJECT = 'object'
export const SYMBOL = 'symbol'
export const NULL = 'null'

export const isDate = (value: any): boolean =>
    Object.prototype.toString.call(value) === '[object Date]'

export const isObject = (value: any): boolean =>
    Object.prototype.toString.call(value) === '[object Object]'
