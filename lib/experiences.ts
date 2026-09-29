export function factLines(text:string){return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)}
