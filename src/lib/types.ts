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
import { StringKeyMap, SpecEventOrigin, TypedSpecEvent, SpecEvent } from '@spec.types/spec'
export type Event = SpecEvent
export type EventOrigin = SpecEventOrigin
export type TypedEvent<T> = TypedSpecEvent<T>
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
    uniqueBy: string | string[]
    table?: string
    indexBy?: string | string[]
}

export type PropertyOptions = {
    desc?: string
    columnName?: string
    columnType?: string
    index?: boolean
    default?: any
    primaryTimestamp?: boolean
    update?: boolean
}

export type RegisteredProperty = {
    name: string
    metadata: any
    options: PropertyOptions
}

export type EventHandlerOptions = {}

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

export type UpsertComps = {
    insertData: StringKeyMap | StringKeyMap[]
    conflictColumns: string[]
    updateColumns: string[]
}
