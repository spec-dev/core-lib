import { BigInt } from './helpers'
import {
    Filter as QueryFilter,
    FilterOp as QueryFilterOp,
    SelectOptions as QuerySelectOptions,
    OrderByDirection as SelectOrderByDirection,
    AuthOptions as QueryAuthOptions,
    QueryPayload,
} from '@spec.dev/tables'
export {
    QueryFilter,
    QueryFilterOp,
    QuerySelectOptions,
    SelectOrderByDirection,
    QueryAuthOptions,
    QueryPayload,
}
import { StringKeyMap, Address, TransactionHash, BlockHash, Transaction } from '@spec.types/spec'
export {
    Address,
    BlockHash,
    TransactionHash,
    Json,
    StringKeyMap,
    StringMap,
    Block,
    Transaction,
} from '@spec.types/spec'
export { Abi, AbiItem, AbiItemType, MetaProtocolId, ContractCallResponse } from '@spec.dev/rpc'

// Pretty much just for case-matching when building live object properties (if desired).
export type String = string
export type Boolean = boolean
export type Number = number

export enum ChainId {
    Ethereum = '1',
    Goerli = '5',
    Polygon = '137',
    Mumbai = '80001',
}

export type BlockNumber = BigInt
export type Timestamp = Date

export interface EventOrigin {
    eventTimestamp: Timestamp
    chainId: ChainId
    blockNumber: BlockNumber
    blockHash: BlockHash
    blockTimestamp: Timestamp
    contractAddress?: Address
    transaction?: Transaction
    transactionHash?: TransactionHash
    transactionIndex?: number
    logIndex?: number
    signature?: string
}

export interface CallOrigin {
    eventTimestamp: Timestamp
    chainId: ChainId
    blockNumber: BlockNumber
    blockHash: BlockHash
    blockTimestamp: Timestamp
    contractAddress: Address
    transaction?: Transaction
    transactionHash: TransactionHash
    signature: string
}

export type Call = {
    id: string
    name: string
    origin: CallOrigin
    inputs: StringKeyMap
    inputArgs: any[]
    outputs: StringKeyMap
    outputArgs: any[]
}

export type TypedEvent<T> = {
    id: string
    nonce: string
    name: string
    origin: EventOrigin
    data: T
}

export type Event = TypedEvent<StringKeyMap>

export type EventMulti = TypedEvent<StringKeyMap[]>

export type LiveTableOptions = {
    uniqueBy: string | string[] | string[][]
    table?: string
    indexBy?: string | string[] | string[][]
}

export type PropertyOptions = {
    desc?: string
    columnName?: string
    columnType?: string
    index?: boolean
    default?: any
    notNull?: boolean
    primaryTimestamp?: boolean
    canUpdate?: boolean
}

export type PropertyMetadata = {
    type: string
}

export type RegisteredProperty = {
    name: string
    metadata?: PropertyMetadata
    options: PropertyOptions
}

export type EventHandlerOptions = {
    autoSave?: boolean
    signature?: string
}

export type EventHandler = (event: Event) => Promise<boolean | void>

export type EventNameComps = {
    nsp: string
    name: string
    version: string
}

export type RegisteredEventHandler = {
    methodName: string
    options: EventHandlerOptions
}

export type CallHandlerOptions = {
    autoSave?: boolean
    signature?: string
}

export type CallHandler = (call: Call) => Promise<boolean | void>

export type RegisteredCallHandler = {
    methodName: string
    options: CallHandlerOptions
}

export type UpsertComps = {
    insertData: StringKeyMap | StringKeyMap[]
    conflictColumns: string[]
    updateColumns: string[]
    primaryTimestampColumn: string
}

export type Manifest = {
    namespace: string
    name: string
    version: string
    displayName: string
    description: string
    chains: number[] | string[]
    isContractFactory?: boolean
}

export type ColumnSpec = {
    name: string
    type: string
    default?: string
    notNull?: boolean
}

export type TableSpec = {
    schemaName: string
    tableName: string
    columns: ColumnSpec[]
    uniqueBy?: string[][]
    indexBy?: string[][]
}
