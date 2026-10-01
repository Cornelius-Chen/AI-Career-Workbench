import {groupBy} from './collections.ts';

type OwnerApplication = {id: string; events: OwnerEvent[]; [key: string]: any};
type OwnerEvent = {applicationId: string; cursorId: string; [key: string]: any};
const pageSize = 200;

async function readPages<T>(view: string, cursorOf: (row: T) => string): Promise<T[]> {
  const rows: T[] = [];
  let cursor = '';
  let page: T[];
  do {
    const response = await fetch(`/api/team?view=${view}&cursor=${encodeURIComponent(cursor)}`, {cache: 'no-store'});
    const body = await response.json() as T[] | {error: string};
    if (!response.ok) throw Error((body as {error: string}).error);
    page = body as T[];
    rows.push(...page);
    if (page.length) cursor = cursorOf(page[page.length - 1]);
  } while (page.length === pageSize);
  return rows;
}

export async function loadOwnerApplications(): Promise<OwnerApplication[]> {
  // Each cursor remains sequential; only the two independent streams overlap.
  const [applications, events] = await Promise.all([
    readPages<OwnerApplication>('owner-applications', row => row.id.slice(7)),
    readPages<OwnerEvent>('owner-events', row => row.cursorId),
  ]);
  const eventsByApplication = groupBy(events, event => event.applicationId);
  return applications.map(application => ({
    ...application,
    events: eventsByApplication.get(application.id.slice(7)) || [],
  }));
}
