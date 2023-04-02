import LiveObject from '../liveObject'
import { UpsertPayload } from '@spec.dev/tables'
import { tx } from '../tables'

export async function saveAll(...liveObjects: LiveObject[]) {
    // Get upsert payloads for each live object.
    const payloads = liveObjects
        .map((liveObject) => {
            if (!liveObject._properties.haveChanged(liveObject)) return null

            const upsertComps = liveObject._properties.getUpsertComps(liveObject)
            if (!upsertComps) return null
            const { insertData, conflictColumns, updateColumns } = upsertComps

            return {
                table: liveObject._table,
                data: [insertData],
                conflictColumns,
                updateColumns,
                returning: '*',
            }
        })
        .filter((p) => !!p) as UpsertPayload[]

    // Get tables api token from the first one with it set.
    const authToken = liveObjects.find(
        (liveObject) => !!liveObject._tablesApiToken
    )?._tablesApiToken

    // Upsert all live objects in a single transaction.
    const results = await tx(payloads, { token: authToken || null })

    // Map column names back to properties and assign values.
    for (let i = 0; i < results.length; i++) {
        const records = results[i]
        if (!records?.length) continue
        liveObjects[i].assignProperties(liveObjects[i]._properties.fromRecord(records[0]))
        liveObjects[i].publishChange()
    }
}
