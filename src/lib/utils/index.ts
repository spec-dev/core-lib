import LiveObject from '../liveObject'
import { buildUpsertQuery } from '@spec.dev/tables'
import { QueryPayload } from '../types'
import { tx } from '../tables'

export async function saveAll(...liveObjects: LiveObject[]) {
    // Get upsert quries for each live object.
    const queries: QueryPayload[] = liveObjects.map((liveObject) => {
        const { insertData, conflictColumns, updateColumns } =
            liveObject.properties.getUpsertComps(liveObject)
        return buildUpsertQuery(liveObject.table, [insertData], conflictColumns, updateColumns, '*')
    })

    // Get tables api token from the first one with it set.
    const authToken = liveObjects.find((liveObject) => !!liveObject.tablesApiToken)?.tablesApiToken

    // Upsert all live objects in a single transaction.
    const results = await tx(queries, { token: authToken || null })

    // Map column names back to propertes and assign values.
    for (let i = 0; i < results.length; i++) {
        const records = results[i]
        if (!records?.length) continue
        liveObjects[i].assignProperties(liveObjects[i].properties.fromRecord(records[0]))
        liveObjects[i].publishChange()
    }
}

export const mapByKey = (iterable: object[], key: string): { [key: string]: any } => {
    let m = {}
    let val
    for (let i = 0; i < iterable.length; i++) {
        val = iterable[i][key]
        m[val] = iterable[i]
    }
    return m
}