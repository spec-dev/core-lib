import { LiveObjectOptions, EventHandler } from './types'
import { queryTable, Filters as TableFilters, SpecTableQueryOptions } from '@spec.dev/tables'
import { SpecEvent, StringKeyMap } from '@spec.types/spec'

export const DEFAULT_LIVE_OBJECT_OPTIONS = {}

export class LiveObject {
    declare name: string

    declare options: LiveObjectOptions

    declare table: string

    declare eventHandlers: { [key: string]: string }

    async handleEvent(event: SpecEvent): Promise<SpecEvent | void> {
        const methodName = this.eventHandlers[event.name]
        if (!methodName) throw `No event handler registered for event ${event.name}`

        const method = ((this as StringKeyMap)[methodName] as EventHandler).bind(this)
        if (!method) throw `Live object event handler not callable: this[${methodName}]`

        return method(event)
    }

    async query(filters?: TableFilters, options?: SpecTableQueryOptions): Promise<Response> {
        return this.queryTable(this.table, filters, options)
    }

    async queryTable(
        table: string,
        filters?: TableFilters,
        options?: SpecTableQueryOptions
    ): Promise<Response> {
        return queryTable(table, filters, options)
    }
}
