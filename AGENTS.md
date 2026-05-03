Project guidelines:

- use bun for the package manager
- when installing new packages, use `bun add` instead of manually editing the package.json file
- use modern svelte 5 and sveltekit patterns (runes: `$state`, `$derived`, `$effect`, `$props`)
- avoid `as any` at all costs, try to infer types from functions as much as possible
- use tailwindcss for styling whenever possible, only resort to custom css if needed
- every svelte component should have `lang="ts"`
- this is a client-side SPA — no SSR. all routes under `/app` have `export const ssr = false`
- API client layer lives in `src/lib/services/`
- state management stores live in `src/lib/stores/` using class-based Svelte 5 runes stores with `createContext`
- reusable UI components live in `src/lib/components/`
- wrapper/provider components live in `src/lib/wrappers/`
- shared TypeScript types live in `src/lib/types/`
- utility functions live in `src/lib/utils/`
- dont write monolithic files, break them down into smaller, reusable pieces
- use descriptive names for variables, functions, and components to improve readability
- keep functions small and focused on a single task
- run `bun run lint` to check for linting errors, `bun run format`, and `bun run check` to check for errors after making changes
- sidebar collapse: icons are centered via fixed `px-3.5` padding + `overflow-hidden` on the aside — never use conditional class swaps (e.g. `justify-center` vs `gap-3 px-4`) as non-animatable properties cause visual jumps during the transition
