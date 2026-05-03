import { getContext, setContext, type Snippet } from 'svelte';

const PAGE_ACTIONS_KEY = Symbol('page-actions');

class PageActionsStore {
	actions: Snippet | null = $state(null);

	setActions(snippet: Snippet) {
		this.actions = snippet;
	}

	clearActions() {
		this.actions = null;
	}
}

export function setPageActionsContext(): PageActionsStore {
	const store = new PageActionsStore();
	setContext(PAGE_ACTIONS_KEY, store);
	return store;
}

export function getPageActionsContext(): PageActionsStore {
	return getContext<PageActionsStore>(PAGE_ACTIONS_KEY);
}
