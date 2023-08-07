import { BigNumberish } from '../helpers/ethers/bignumber'

export namespace ContractType {
    export type Number = BigNumberish
    export type String = string
    export type Bytes = string | number[]
    export type Address = string
    export type Boolean = boolean
}
