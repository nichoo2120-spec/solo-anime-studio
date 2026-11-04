import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
export function sourceDigest(){const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]),hash=createHash('sha256');for(const path of files('src').map(p=>p.replaceAll('\\','/')).sort())hash.update(path.replaceAll('\\','/')).update(readFileSync(path,'utf8').replace(/\r\n/g,'\n'));return hash.digest('hex');}
