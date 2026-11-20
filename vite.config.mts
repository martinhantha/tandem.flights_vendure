import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';
import { resolve, join } from 'path';

export default defineConfig({
    base: '/dashboard',
    // the dashboard plugin uses its own vite root, so point to the project's public/ (login logo)
    publicDir: join(__dirname, 'public'),
    build: {
        outDir: join(__dirname, 'dist/dashboard'),
        emptyOutDir: true,
    },
    plugins: [
        // Required to compile `@lingui/react/macro` usages in the Vendure dashboard (Vite dev + build).
        vendureDashboardPlugin({
            // The vendureDashboardPlugin will scan your configuration in order
            // to find any plugins which have dashboard extensions, as well as
            // to introspect the GraphQL schema based on any API extensions
            // and custom fields that are configured.
            vendureConfigPath: pathToFileURL('./src/vendure-config.ts'),
            // Points to the location of your Vendure server.
            // "auto" = same origin as the dashboard page (production: https://ecommerce.tandem.flights).
            // Local dev: set APP_URL=http://localhost APP_PORT=3001 in .env.
            api: { host: process.env.APP_URL || "auto", port: process.env.APP_PORT ? +process.env.APP_PORT : "auto" },
            // When you start the Vite server, your Admin API schema will
            // be introspected and the types will be generated in this location.
            // These types can be used in your dashboard extensions to provide
            // type safety when writing queries and mutations.
            brand: process.env.SHOP_NAME,
            gqlOutputPath: './src/gql',
            // Preserve `src/…` layout in the dashboard temp output so imports like
            // `src/gql/generated` resolve when the config loader runs (see tsconfig paths).
            pathAdapter: {
                sourceRoot: __dirname,
                getCompiledConfigPath: ({ outputPath, configFileName }) =>
                    join(outputPath, 'src', configFileName),
            },
            // Theme section
            theme: {
                light: {
                    // Change the primary brand color to blue
                    primary: "#a9d2a5",
                    "primary-foreground": "#000",

                    // Update the brand colors to match
                    brand: "#a9d2a5", // Green-600
                    "brand-lighter": "#a9d2a5", // Green-300
                },
                dark: {
                    // Corresponding dark mode colors
                    primary: "#a9d2a5",
                    "primary-foreground": "#000",

                    // Same brand colors work for both themes
                    brand: "#a9d2a5",
                    "brand-lighter": "#a9d2a5",
                },
            },
        } as any),
    ],
    resolve: {
        // Prevent duplicate React / Lingui copies from breaking hooks/context
        // (useRef null, Trans without I18nProvider, TipTap useEditor crashes).
        dedupe: ['react', 'react-dom', '@lingui/react', '@lingui/core', '@tiptap/react'],
        alias: {
            // Force a single React instance even when packages nest their own copy.
            react: resolve(__dirname, 'node_modules/react'),
            'react-dom': resolve(__dirname, 'node_modules/react-dom'),
            // This allows all plugins to reference a shared set of
            // GraphQL types.
            '@/gql': resolve(__dirname, './src/gql/graphql.ts'),
        },
    },
});