import { Button, Input, Textarea } from '@vendure/dashboard';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useMemo } from 'react';

type AccordionItem = {
    title: string;
    content: string;
};

const EMPTY_ITEM: AccordionItem = { title: '', content: '' };

function normalizeItem(value: any): AccordionItem {
    return {
        title: typeof value?.title === 'string' ? value.title : '',
        content: typeof value?.content === 'string' ? value.content : '',
    };
}

function parseAccordionItems(value: unknown): AccordionItem[] {
    if (Array.isArray(value)) {
        return value.map(normalizeItem);
    }
    if (typeof value !== 'string' || value.trim() === '') {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
    } catch {
        return [];
    }
}

type AccordionListInputProps = {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    labels: {
        add: string;
        remove: string;
        title: string;
        content: string;
        empty: string;
    };
};

export function AccordionListInput({ value, onChange, disabled, labels }: AccordionListInputProps) {
    const VButton = Button as any;
    const items = useMemo(() => parseAccordionItems(value), [value]);

    const updateItems = (next: AccordionItem[]) => {
        onChange(JSON.stringify(next));
    };

    const handleAdd = () => {
        updateItems([...items, { ...EMPTY_ITEM }]);
    };

    const handleRemove = (index: number) => {
        updateItems(items.filter((_, idx) => idx !== index));
    };

    const handleUpdate = (index: number, patch: Partial<AccordionItem>) => {
        updateItems(items.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
    };

    return (
        <div className="space-y-2">
            {items.length === 0 ? (
                <div className="text-sm text-muted-foreground">{labels.empty}</div>
            ) : (
                items.map((item, index) => (
                    <details key={index} className="rounded border border-border">
                        <summary className="flex items-center justify-between gap-3 px-3 py-2">
                            <span className="truncate font-medium">
                                {item.title?.trim() || `${labels.title} ${index + 1}`}
                            </span>
                            <VButton
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if(confirm(labels.remove)) {
                                        handleRemove(index);
                                    }
                                }}
                            >
                                <Trash2Icon className="mr-2 h-4 w-4" />
                                {labels.remove}
                            </VButton>
                        </summary>
                        <div className="space-y-3 border-t border-border px-3 py-3">
                            <Input
                                value={item.title}
                                onChange={event => handleUpdate(index, { title: event.target.value })}
                                placeholder={labels.title}
                                disabled={disabled}
                            />
                            <Textarea
                                value={item.content}
                                onChange={event => handleUpdate(index, { content: event.target.value })}
                                placeholder={labels.content}
                                rows={4}
                                disabled={disabled}
                            />
                        </div>
                    </details>
                ))
            )}
            <VButton type="button" variant="outline" onClick={handleAdd} disabled={disabled}>
                <PlusIcon className="mr-2 h-4 w-4" />
                {labels.add}
            </VButton>
        </div>
    );
}