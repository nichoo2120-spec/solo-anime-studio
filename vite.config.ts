import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {sourceDigest} from './build/sourceDigest.mjs';
import packageInfo from './package.json';
const digest=sourceDigest(),version=packageInfo.version;
export default defineConfig({define:{__STUDIO_SOURCE_DIGEST__:JSON.stringify(digest)},// v0.5.176 faster dev start: pre-bundle the known dependencies up front (no
// mid-load 're-optimizing' page reload) and pre-transform the app entry while the server starts.
optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime','lucide-react'],entries:['index.html']},server:{warmup:{clientFiles:['./src/main.tsx','./src/ui/App.tsx','./src/engine/StudioEngine.ts']}},plugins:[react(),{name:'studio-build-manifest',generateBundle(){this.emitFile({type:'asset',fileName:'studio-build.json',source:JSON.stringify({version,sourceDigest:digest})});}}],test:{include:['tests/**/*.test.ts']}});
