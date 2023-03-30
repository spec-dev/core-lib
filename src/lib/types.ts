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
import {
    StringKeyMap,
    SpecEventOrigin,
    TypedSpecEvent,
    SpecEvent,
    SpecCall,
    SpecCallOrigin,
} from '@spec.types/spec'
export type Event = SpecEvent
export type EventOrigin = SpecEventOrigin
export type TypedEvent<T> = TypedSpecEvent<T>
export type Call = SpecCall
export type CallOrigin = SpecCallOrigin
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

import { BigInt } from './helpers'
export type BlockNumber = BigInt

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
