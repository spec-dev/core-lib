import { SpecEvent, StringKeyMap } from '@spec.types/spec'
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
export {
    Address,
    BlockNumber,
    BlockHash,
    TransactionHash,
    Timestamp,
    Json,
    ChainId,
    StringKeyMap,
    StringMap,
    SpecEventOrigin,
    TypedSpecEvent,
    SpecEvent,
} from '@spec.types/spec'

export type Constructor<T> = { new (): T }

export type LiveObjectOptions = {
    table: string
    uniqueBy: string | string[]
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

export type EventHandler = (event: SpecEvent) => Promise<void>

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
