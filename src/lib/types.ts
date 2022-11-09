export {
    Filters as TableFilters,
    Filter as TableFilter,
    FilterOp as TableFilterOp,
} from '@spec.dev/tables'

export type StringKeyMap = { [key: string]: any }

export type LiveObjectOptions = {
    name?: string
    table?: string
}
