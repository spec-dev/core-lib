import { SpecTableClient } from '@spec.dev/tables'
import { QueryError } from './errors'
import { QuerySelectOptions, StringKeyMap, QueryAuthOptions, QueryPayload } from './types'

const tableClient = new SpecTableClient()

export async function select(
    table: string,
    where: StringKeyMap | StringKeyMap[],
    options?: QuerySelectOptions,
    authOptions?: QueryAuthOptions
) {
    try {
        return tableClient.select(table, where, options, authOptions)
    } catch (err) {
        throw new QueryError('select', table, err)
    }
}

export async function upsert(
    table: string,
    insertData: StringKeyMap | StringKeyMap[],
    conflictColumns: string[],
    updateColumns: string[],
    authOptions?: QueryAuthOptions
): Promise<StringKeyMap[]> {
    try {
        return tableClient.upsert(
            table,
            insertData,
            conflictColumns,
            updateColumns,
            '*',
            authOptions
        )
    } catch (err) {
        throw new QueryError('upsert', table, err)
    }
}

export async function tx(
    queries: QueryPayload[],
    authOptions?: QueryAuthOptions
): Promise<StringKeyMap[]> {
    try {
        return tableClient.tx(queries, authOptions)
    } catch (err) {
        throw new QueryError('tx', 'multiple', err)
    }
}
