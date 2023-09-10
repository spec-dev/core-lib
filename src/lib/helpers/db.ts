import LiveTable from '../LiveTable'
import { UpsertPayload } from '@spec.dev/tables'
import { tx } from '../tables'

export async function saveAll(...liveObjects: LiveTable[]) {
    if (liveObjects.length === 1 && Array.isArray(liveObjects[0])) {
        liveObjects = liveObjects[0]
    }
    liveObjects = liveObjects.filter((v) => !!v)

    // Get upsert payloads for each live object.
    const payloads = (
        await Promise.all(
            liveObjects.map(async (liveObject) => {
                await liveObject._fsPromises()
                if (!liveObject._properties.haveChanged(liveObject)) return null

                const upsertComps = liveObject._properties.getUpsertComps(liveObject)
                if (!upsertComps) return null
                const { insertData, conflictColumns, updateColumns, primaryTimestampColumn } =
                    upsertComps

                return {
                    table: liveObject._table,
                    data: [insertData],
                    conflictColumns,
                    updateColumns,
                    primaryTimestampColumn,
                    returning: '*',
                }
            })
        )
    ).filter((p) => !!p) as UpsertPayload[]
    if (!payloads.length) {
        console.log(
            'Empty payload when saving live objects',
            liveObjects.map((lo) => lo._liveObjectName).join(', '),
            liveObjects.map((lo) => lo._properties.haveChanged(lo)),
            liveObjects.map((lo) => !!lo._properties.getUpsertComps(lo))
        )
        return
    }

    // Get tables api token from the first one with it set.
    const authToken = liveObjects.find(
        (liveObject) => !!liveObject._tablesApiToken
    )?._tablesApiToken

    // Upsert all live objects in a single transaction.
    const results = await tx(payloads, { token: authToken || null })

    // Map column names back to properties and assign values.
    for (let i = 0; i < results.length; i++) {
        const records = results[i]
        if (!records?.length || !records[0]) continue
        liveObjects[i].assignProperties(liveObjects[i]._properties.fromRecord(records[0]))
        await liveObjects[i].publishChange()
    }
}
