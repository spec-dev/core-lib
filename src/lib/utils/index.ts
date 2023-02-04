import LiveObject from '../liveObject'
import { buildUpsertQuery, QueryPayload } from '@spec.dev/tables'
import { tx } from '../tables'

export async function saveAll(...liveObjects: LiveObject[]) {
    const queries: QueryPayload[] = liveObjects.map((liveObject) => {
        const { insertData, conflictColumns, updateColumns } =
            liveObject.properties.getUpsertComps(liveObject)

        return buildUpsertQuery(liveObject.table, [insertData], conflictColumns, updateColumns, '*')
    })
    return tx(queries)
}
