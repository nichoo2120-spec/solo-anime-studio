import {defineConfig} from '@playwright/test';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const vite=join(dirname(createRequire(import.meta.url).resolve('vite/package.json')),'bin','vite.js');
export default defineConfig({testDir:'tests/browser',timeout:45000,fullyParallel:false,workers:1,webServer:process.env.SOLO_STUDIO_URL?undefined:{command:`node "${vite}" --host 127.0.0.1 --port 5174 --strictPort`,url:'http://127.0.0.1:5174',reuseExistingServer:true,timeout:30000},use:{baseURL:process.env.SOLO_STUDIO_URL??'http://127.0.0.1:5174',channel:'msedge',launchOptions:{ignoreDefaultArgs:['--hide-scrollbars']},headless:true,viewport:{width:1440,height:960},acceptDownloads:true},reporter:[['list'],['json',{outputFile:'validation/browser-results.json'}]]});
