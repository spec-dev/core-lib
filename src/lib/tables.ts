import { SpecTableClient, UpsertPayload } from '@spec.dev/tables'
import { QueryError } from './errors'
import { QuerySelectOptions, StringKeyMap, QueryAuthOptions } from './types'

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
    payload: UpsertPayload,
    authOptions?: QueryAuthOptions
): Promise<StringKeyMap[]> {
    try {
        return tableClient.upsert(payload, authOptions)
    } catch (err) {
        throw new QueryError('upsert', payload?.table, err)
    }
}

export async function tx(
    payloads: UpsertPayload[],
    authOptions?: QueryAuthOptions
): Promise<StringKeyMap[]> {
    try {
        return tableClient.tx(payloads, authOptions)
    } catch (err) {
        throw new QueryError('tx', (payloads || []).map((p) => p.table).join(', '), err)
    }
}
