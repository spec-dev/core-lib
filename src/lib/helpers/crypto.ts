import Keccak256 from 'keccak256'

export const keccak256 = (value: string): string => Keccak256(value).toString('hex')
