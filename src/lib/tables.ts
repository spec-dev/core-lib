import { SpecTableClient, UpsertPayload } from '@spec.dev/tables'
import { QueryError } from './errors'
import { QuerySelectOptions, StringKeyMap, QueryAuthOptions } from './types'

const tableClient = new SpecTableClient()
const prodTableClient = new SpecTableClient({ origin: 'https://tables-ingress.spec.dev' })

export async function select(
    table: string,
    where: StringKeyMap | StringKeyMap[],
    options?: QuerySelectOptions,
    authOptions?: QueryAuthOptions
) {
    try {
        return await tableClient.select(table, where, options, authOptions)
    } catch (err) {
        throw new QueryError('select', table, err)
    }
}

export async function upsert(
    payload: UpsertPayload,
    authOptions?: QueryAuthOptions
): Promise<StringKeyMap[]> {
    try {
        return await tableClient.upsert(payload, authOptions)
    } catch (err) {
        throw new QueryError('upsert', payload?.table, err)
    }
}

export async function tx(
    payloads: UpsertPayload[],
    authOptions?: QueryAuthOptions
): Promise<StringKeyMap[]> {
    try {
        return await tableClient.tx(payloads, authOptions)
    } catch (err) {
        throw new QueryError('tx', (payloads || []).map((p) => p.table).join(', '), err)
    }
}

export async function prodSelect(
    table: string,
    where: StringKeyMap | StringKeyMap[],
    options?: QuerySelectOptions,
    authOptions?: QueryAuthOptions
) {
    try {
        return await prodTableClient.select(table, where, options, authOptions)
    } catch (err) {
        throw new QueryError('select', table, err)
    }
}
