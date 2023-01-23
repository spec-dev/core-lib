import { SpecEvent } from '@spec.types/spec'

export {
    Filters as TableFilters,
    Filter as TableFilter,
    FilterOp as TableFilterOp,
} from '@spec.dev/tables'

export {
    Address,
    BlockNumber,
    BlockHash,
    TransactionHash,
    Timestamp,
    Json,
    ChainId,
    StringKeyMap,
    SpecEventOrigin,
    TypedSpecEvent,
    SpecEvent,
} from '@spec.types/spec'

export type LiveObjectOptions = {
    table: string
    uniqueBy?: string[] | string[][]
    indexBy?: string[] | string[][]
}

export type PropertyOptions = {
    desc?: string
    column?: string
    unique?: boolean
    index?: boolean
    default?: any
    primaryTimestamp?: boolean
}

export type EventHandlerOptions = {}

export type EventHandler = (event: SpecEvent) => Promise<SpecEvent | void>
