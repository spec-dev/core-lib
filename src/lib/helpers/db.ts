import LiveObject from '../liveObject'
import { UpsertPayload } from '@spec.dev/tables'
import { tx } from '../tables'

export async function saveAll(...liveObjects: LiveObject[]) {
    // Get upsert payloads for each live object.
    const payloads: UpsertPayload[] = liveObjects.map((liveObject) => {
        const { insertData, conflictColumns, updateColumns } =
            liveObject._properties.getUpsertComps(liveObject)
        return {
            table: liveObject._table,
            data: [insertData],
            conflictColumns,
            updateColumns,
            returning: '*',
        }
    })

    // Get tables api token from the first one with it set.
    const authToken = liveObjects.find(
        (liveObject) => !!liveObject._tablesApiToken
    )?._tablesApiToken

    // Upsert all live objects in a single transaction.
    const results = await tx(payloads, { token: authToken || null })

    // Map column names back to propertes and assign values.
    for (let i = 0; i < results.length; i++) {
        const records = results[i]
        if (!records?.length) continue
        liveObjects[i].assignProperties(liveObjects[i]._properties.fromRecord(records[0]))
        liveObjects[i].publishChange()
    }
}
