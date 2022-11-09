import { LiveObjectOptions } from './types'
import { queryTable, Filters as TableFilters } from '@spec.dev/tables'

export const DEFAULT_OPTIONS = {}

export class LiveObject {
    declare name: string

    declare mainFunctionName?: string

    declare options: LiveObjectOptions

    async main(...args: any[]): Promise<any> {
        let mainFunc
        if (!this.mainFunctionName || !this.hasOwnProperty(this.mainFunctionName)) {
            if (!this.options.table) throw 'No main function set or default table to query.'
            mainFunc = this._queryDefaultTable.bind(this)
        }

        mainFunc =
            mainFunc ||
            (this[this.mainFunctionName as keyof typeof this] as unknown as Function).bind(this)
        if (!mainFunc)
            throw `Live object main function not callable: this[${this.mainFunctionName}]`

        return mainFunc(...args)
    }

    async queryTable(table: string, filters?: TableFilters): Promise<Response> {
        return queryTable(table, filters)
    }

    async _queryDefaultTable(filters?: TableFilters): Promise<Response> {
        return queryTable(this.options.table!, filters)
    }
}
