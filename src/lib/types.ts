export type StringKeyMap = { [key: string]: any }

export enum FilterOp {
    EqualTo = '=',
    NotEqualTo = '!=',
    GreaterThan = '>',
    GreaterThanOrEqualTo = '>=',
    LessThan = '<',
    LessThanOrEqualTo = '<=',
    In = 'in',
    NotIn = 'not in',
}

export interface Filter {
    op: FilterOp
    value: any
}

export type Filters = StringKeyMap | StringKeyMap[]
