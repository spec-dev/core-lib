import { QueryPayload, SpecTableClient } from '@spec.dev/tables'
import { StringKeyMap } from '@spec.types/spec'
import { QueryError } from './errors'
import { QuerySelectOptions } from './types'

const tableClient = new SpecTableClient()

export async function select(
    table: string,
    where: StringKeyMap | StringKeyMap[],
    options?: QuerySelectOptions
) {
    try {
        return tableClient.select(table, where, options)
    } catch (err) {
        throw new QueryError('select', table, err)
    }
}

export async function upsert(
    table: string,
    insertData: StringKeyMap | StringKeyMap[],
    conflictColumns: string[],
    updateColumns: string[]
): Promise<StringKeyMap[]> {
    try {
        return tableClient.upsert(table, insertData, conflictColumns, updateColumns)
    } catch (err) {
        throw new QueryError('upsert', table, err)
    }
}

export async function tx(queries: QueryPayload[]): Promise<StringKeyMap[]> {
    try {
        return tableClient.tx(queries)
    } catch (err) {
        throw new QueryError('tx', 'multiple', err)
    }
}
