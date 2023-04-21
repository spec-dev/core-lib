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
import { StringKeyMap, Timestamp, Address, TransactionHash, BlockHash } from '@spec.types/spec'
export {
    Address,
    BlockHash,
    TransactionHash,
    Timestamp,
    Json,
    StringKeyMap,
    StringMap,
    Block,
    Transaction,
} from '@spec.types/spec'

export type ChainId = string

export type BlockNumber = BigInt

export interface EventOrigin {
    eventTimestamp: Timestamp
    chainId: ChainId
    blockNumber: BlockNumber
    blockHash: BlockHash
    blockTimestamp: Timestamp
    transactionHash?: TransactionHash
    contractAddress?: Address
}

export interface CallOrigin {
    eventTimestamp: Timestamp
    chainId: ChainId
    blockNumber: BlockNumber
    blockHash: BlockHash
    blockTimestamp: Timestamp
    transactionHash: TransactionHash
    contractAddress: Address
    contractName: string
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

export type LiveObjectOptions = {
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
    canReplay?: boolean
    autoSave?: boolean
}

export type EventHandler = (event: Event) => Promise<void>

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
    canReplay?: boolean
    autoSave?: boolean
}

export type CallHandler = (call: Call) => Promise<void>

export type RegisteredCallHandler = {
    methodName: string
    options: CallHandlerOptions
}

export type UpsertComps = {
    insertData: StringKeyMap | StringKeyMap[]
    conflictColumns: string[]
    updateColumns: string[]
}

export type Manifest = {
    namespace: string
    name: string
    version: string
    displayName: string
    description: string
    chains: number[] | string[]
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
