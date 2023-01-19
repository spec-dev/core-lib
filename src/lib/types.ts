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
} from '@spec.types/spec'

export type LiveObjectOptions = {
    table?: string
    uniqueBy?: string[] | string[][]
    indexBy?: string[] | string[][]
}

export type PropertOptions = {
    desc?: string
    column?: string
    unique?: boolean
    index?: boolean
    primaryTimestamp?: boolean
}
