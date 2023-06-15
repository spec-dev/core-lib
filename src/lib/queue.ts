import { StringKeyMap } from './types'

class Queue {
    protected queue: StringKeyMap[] = []

    push(event: StringKeyMap) {
        this.queue.push(event)
    }

    items(): StringKeyMap[] {
        return [...this.queue]
    }
}

export default Queue