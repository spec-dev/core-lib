import LiveObject from '../liveObject'
import { buildUpsertQuery, QueryPayload } from '@spec.dev/tables'
import { tx } from '../tables'

export async function saveAll(...liveObjects: LiveObject[]) {
    // Get upsert quries for each live object.
    const queries: QueryPayload[] = liveObjects.map((liveObject) => {
        const { insertData, conflictColumns, updateColumns } =
            liveObject.properties.getUpsertComps(liveObject)
        return buildUpsertQuery(liveObject.table, [insertData], conflictColumns, updateColumns, '*')
    })

    // Upsert all live objects in a single transaction.
    const results = await tx(queries)

    // Map column names back to propertes and assign values.
    for (let i = 0; i < results.length; i++) {
        const records = results[i]
        if (!records?.length) continue
        liveObjects[i].assignProperties(liveObjects[i].properties.fromRecord(records[0]))
        liveObjects[i].publishChange()
    }
}
