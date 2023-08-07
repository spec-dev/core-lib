import { ZERO_ADDRESS } from './constants'

export const isNullAddress = (value: any): boolean => value === ZERO_ADDRESS || value === null
