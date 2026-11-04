import type {Page} from '@playwright/test';
/** Park the real wheel through its UI so drawing workloads don't hit the overlay.
 * The separate fresh-workspace test verifies the left-edge default. */
export async function parkWheel(page:Page){await page.getByRole('button',{name:'Circular toolbar options',exact:true}).click();await page.getByLabel('Toolbar dock',{exact:true}).selectOption('right');await page.getByRole('button',{name:'Done',exact:true}).click();}
