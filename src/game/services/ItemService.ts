import { Item, ItemType, ItemCounter } from '../types/Items';

export class ItemService {
    static countItems(items: Item[]): ItemCounter {
        return {
            raw: items.filter(i => i.type === ItemType.RAW).length,
            processed: items.filter(i => i.type === ItemType.PROCESSED).length
        };
    }

    static createItem(type: ItemType): Item {
        return { type };
    }

    static processItem(_: Item): Item {
        return { type: ItemType.PROCESSED };
    }

    static formatCounterText(counter: ItemCounter, prefix: string = ''): string {
        return `${prefix}RAW: ${counter.raw} PROC: ${counter.processed}`;
    }
}
